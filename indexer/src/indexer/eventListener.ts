// ---------------------------------------------------------------------------
// Aztec public event listener.
//
// Polls the Aztec node for new blocks and indexes public state changes from:
//   - MarketFactory: market creation events (public state writes)
//   - Oracle: resolution proposals, disputes, finalisations, voids
//   - AMM: reserve changes (price snapshots)
//
// Architecture (v4.1.3):
//   - Uses node_getPublicStorageAt to read public storage slots directly.
//   - For scalar fields (next_market_id, etc.) we read the known storage slot.
//   - For map fields (per-market data) we derive the slot with pedersen
//     or read the count and then read per-index. Where slot derivation is not
//     available, we fall back to reading the block and parsing events.
//   - Uses a block-number watermark stored in `indexer_state` to resume.
// ---------------------------------------------------------------------------

import { config } from "../config.js";
import {
  query,
  execute,
  getIndexerState,
  setIndexerState,
} from "../db/client.js";
import { MarketStatus, ResolutionState } from "../types/index.js";

const WATERMARK_KEY = "last_indexed_block";

// ---------------------------------------------------------------------------
// Storage slot constants from contract artifacts (codegen)
// ---------------------------------------------------------------------------

const SLOTS = {
  marketFactory: {
    next_market_id: "0x08", // Fr(8n)
    // Maps (per-market): slots 10-15
    // market_question_hash: base=10, market_criteria_hash: base=11, etc.
    // Map slot = poseidon2([base_slot, market_id]) — computed at runtime if hash is available
  },
  oracle: {
    // Maps (per-market):
    // resolution_state: base=4, proposed_outcome: base=5, proposed_at: base=6
  },
  amm: {
    // Maps (per-market):
    // reserve_yes: base=6, reserve_no: base=7
  },
} as const;

/** JSON-RPC helper to call the Aztec node. */
async function aztecRpc(method: string, params: unknown[] = []): Promise<any> {
  const res = await fetch(config.aztecRpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = (await res.json()) as { result?: any; error?: any };
  if (json.error) {
    throw new Error(`Aztec RPC error [${method}]: ${JSON.stringify(json.error)}`);
  }
  return json.result;
}

/** Get the current block number from the Aztec node. */
async function getBlockNumber(): Promise<number> {
  const result = await aztecRpc("node_getBlockNumber");
  return Number(result);
}

/**
 * Read a public storage slot from a deployed contract.
 * Uses node_getPublicStorageAt(referenceBlock, contractAddress, slot).
 */
async function readPublicSlot(
  contractAddress: string,
  slotHex: string,
  blockNumber: number | "latest" = "latest",
): Promise<string> {
  const result = await aztecRpc("node_getPublicStorageAt", [
    blockNumber,
    contractAddress,
    slotHex,
  ]);
  return String(result);
}

// ---------------------------------------------------------------------------
// Market Factory indexing
// ---------------------------------------------------------------------------

/**
 * Read MarketFactory public state to discover new markets.
 *
 * Strategy: read `next_market_id` and compare against indexed markets.
 * For any new IDs, read per-market public slots (question_hash, creator, etc.).
 */
async function indexMarketFactory(fromBlock: number, toBlock: number): Promise<void> {
  if (!config.contracts.marketFactory) return;

  try {
    // Read next_market_id from known public storage slot (Fr(8n) = 0x08)
    const nextIdRaw = await readPublicSlot(
      config.contracts.marketFactory,
      SLOTS.marketFactory.next_market_id,
      toBlock,
    );
    const nextMarketId = Number(nextIdRaw);
    if (nextMarketId <= 1) return; // no markets yet

    // Check which markets we've already indexed
    const existing = await query<{ market_id: string }>(
      "SELECT market_id FROM markets ORDER BY market_id",
    );
    const existingIds = new Set(existing.map((r) => r.market_id));

    // Index any missing markets
    for (let i = 1; i < nextMarketId; i++) {
      const mid = String(i);
      if (existingIds.has(mid)) continue;

      try {
        // TODO: Per-market data lives in map storage slots that require
        // poseidon2(base_slot, market_id) derivation. Without the hash
        // function available server-side, we insert the market with
        // placeholder data. A future version should install @aztec/wallets
        // and use executeUtility to call the view functions.
        await execute(
          `INSERT INTO markets (market_id, question_hash, criteria_hash, source_hash, creator, end_date, bond_amount, status)
           VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '7 days', $6, $7)
           ON CONFLICT (market_id) DO NOTHING`,
          [mid, "pending", "pending", "pending", "pending", "0", MarketStatus.Open],
        );

        await execute(
          `INSERT INTO resolutions (market_id, state)
           VALUES ($1, $2)
           ON CONFLICT (market_id) DO NOTHING`,
          [mid, ResolutionState.Unresolved],
        );

        console.log(`[indexer] Indexed new market #${mid} (metadata pending)`);
      } catch (err) {
        console.error(`[indexer] Failed to index market #${mid}:`, err);
      }
    }
  } catch (err) {
    if (config.contracts.marketFactory) {
      console.warn("[indexer] MarketFactory read failed (may not be deployed yet):", (err as Error).message);
    }
  }
}

// ---------------------------------------------------------------------------
// Oracle indexing
// ---------------------------------------------------------------------------

async function indexOracleResolutions(): Promise<void> {
  if (!config.contracts.oracle) return;

  try {
    // Get all markets that haven't been finalised or voided yet
    const pending = await query<{ market_id: string }>(
      "SELECT market_id FROM resolutions WHERE state < 2",
    );

    for (const { market_id } of pending) {
      try {
        // TODO: resolution_state, proposed_outcome, proposed_at are in map storage
        // (base slots 4, 5, 6 respectively). Need poseidon2(base_slot, market_id)
        // to derive the actual slot. For now, skip per-market oracle reads
        // until server-side hash derivation is available.
        // The frontend reads oracle state directly via contract view functions
        // through the embedded wallet, so this indexer gap doesn't block UI usage.
        console.debug(`[indexer] Oracle state read for market ${market_id} skipped (map slot derivation not yet implemented)`);
      } catch (err) {
        console.error(`[indexer] Oracle read failed for market ${market_id}:`, (err as Error).message);
      }
    }
  } catch (err) {
    console.warn("[indexer] Oracle indexing failed:", (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// AMM price snapshots
// ---------------------------------------------------------------------------

async function indexAmmSnapshots(blockNumber: number): Promise<void> {
  if (!config.contracts.amm) return;

  try {
    const markets = await query<{ market_id: string }>(
      "SELECT market_id FROM markets WHERE status IN ('open', 'halted', 'resolution_proposed')",
    );

    for (const { market_id } of markets) {
      try {
        // TODO: reserve_yes and reserve_no are in map storage (base slots 6, 7).
        // Need poseidon2(base_slot, market_id) to derive the actual slot.
        // For now, skip AMM snapshot reads until server-side hash derivation is available.
        // The frontend can read reserves directly via contract view functions.
        console.debug(`[indexer] AMM snapshot for market ${market_id} skipped (map slot derivation not yet implemented)`);
      } catch {
        // AMM may not have this market initialised yet
      }
    }
  } catch (err) {
    console.warn("[indexer] AMM snapshot failed:", (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Halt detection — check if markets passed end_date
// ---------------------------------------------------------------------------

async function markHaltedMarkets(): Promise<void> {
  await execute(
    `UPDATE markets SET status = $1
     WHERE status = $2 AND end_date <= NOW()`,
    [MarketStatus.Halted, MarketStatus.Open],
  );
}

// ---------------------------------------------------------------------------
// Main polling loop
// ---------------------------------------------------------------------------

let running = false;

async function pollOnce(): Promise<void> {
  const lastRaw = await getIndexerState(WATERMARK_KEY);
  const lastBlock = lastRaw ? Number(lastRaw) : 0;

  let headBlock: number;
  try {
    headBlock = await getBlockNumber();
  } catch (err) {
    console.warn("[indexer] Cannot reach Aztec node:", (err as Error).message);
    return;
  }

  if (headBlock <= lastBlock) return; // nothing new

  console.log(`[indexer] Processing blocks ${lastBlock + 1} → ${headBlock}`);

  await indexMarketFactory(lastBlock + 1, headBlock);
  await indexOracleResolutions();
  await indexAmmSnapshots(headBlock);
  await markHaltedMarkets();

  await setIndexerState(WATERMARK_KEY, String(headBlock));
}

export function startEventListener(): void {
  if (running) return;
  running = true;

  console.log(`[indexer] Starting event listener (poll every ${config.pollIntervalMs}ms)`);

  // Initial poll
  pollOnce().catch((err) => console.error("[indexer] Poll error:", err));

  // Recurring poll
  const interval = setInterval(() => {
    pollOnce().catch((err) => console.error("[indexer] Poll error:", err));
  }, config.pollIntervalMs);

  // Graceful shutdown
  const shutdown = () => {
    running = false;
    clearInterval(interval);
    console.log("[indexer] Event listener stopped.");
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

export { pollOnce };
