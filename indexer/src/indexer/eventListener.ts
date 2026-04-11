// ---------------------------------------------------------------------------
// Aztec public event listener.
//
// Polls the Aztec node for new blocks and indexes public state changes from:
//   - MarketFactory: market creation events (public state writes)
//   - Oracle: resolution proposals, disputes, finalisations, voids
//   - AMM: reserve changes (price snapshots)
//
// Architecture:
//   - Uses a block-number watermark stored in `indexer_state` to resume.
//   - Each poll fetches blocks from (lastBlock+1) to nodeHead.
//   - Public storage slot reads are used to detect state changes since
//     Aztec does not have traditional "event logs" — public state is the
//     canonical source for non-private data.
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
  // In production this would do proper public storage slot reads.
  // For Phase 1 / Sandbox, we use unconstrained view functions via RPC.
  // This is a polling-based approach where we check next_market_id.

  if (!config.contracts.marketFactory) return;

  try {
    // Read next_market_id from the factory (unconstrained fn)
    const nextId = await aztecRpc("node_call", [
      {
        to: config.contracts.marketFactory,
        functionName: "get_next_market_id",
        args: [],
      },
    ]);

    const nextMarketId = Number(nextId);

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
        const info = await aztecRpc("node_call", [
          {
            to: config.contracts.marketFactory,
            functionName: "get_market_info",
            args: [mid],
          },
        ]);

        // info returns (question_hash, criteria_hash, source_hash, creator, end_date, bond_amount)
        const [questionHash, criteriaHash, sourceHash, creator, endDate, bondAmount] = info;

        await execute(
          `INSERT INTO markets (market_id, question_hash, criteria_hash, source_hash, creator, end_date, bond_amount, status)
           VALUES ($1, $2, $3, $4, $5, to_timestamp($6), $7, $8)
           ON CONFLICT (market_id) DO NOTHING`,
          [mid, questionHash, criteriaHash, sourceHash, creator, Number(endDate), bondAmount, MarketStatus.Open],
        );

        // Also insert a resolution row for tracking
        await execute(
          `INSERT INTO resolutions (market_id, state)
           VALUES ($1, $2)
           ON CONFLICT (market_id) DO NOTHING`,
          [mid, ResolutionState.Unresolved],
        );

        console.log(`[indexer] Indexed new market #${mid}`);
      } catch (err) {
        console.error(`[indexer] Failed to index market #${mid}:`, err);
      }
    }
  } catch (err) {
    // Contract may not be deployed yet — this is fine during startup
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
        const state = await aztecRpc("node_call", [
          {
            to: config.contracts.oracle,
            functionName: "get_resolution_state",
            args: [market_id],
          },
        ]);

        const oracleState = Number(state);

        let proposedOutcome: number | null = null;
        let proposedAt: number | null = null;

        if (oracleState >= ResolutionState.Proposed) {
          proposedOutcome = Number(
            await aztecRpc("node_call", [
              { to: config.contracts.oracle, functionName: "get_proposed_outcome", args: [market_id] },
            ]),
          );
          proposedAt = Number(
            await aztecRpc("node_call", [
              { to: config.contracts.oracle, functionName: "get_proposed_at", args: [market_id] },
            ]),
          );
        }

        // Map oracle state to market status
        let marketStatus: MarketStatus;
        switch (oracleState) {
          case ResolutionState.Proposed:
            marketStatus = MarketStatus.ResolutionProposed;
            break;
          case ResolutionState.Finalised:
            marketStatus = MarketStatus.Resolved;
            break;
          case ResolutionState.Disputed:
            marketStatus = MarketStatus.Disputed;
            break;
          case ResolutionState.Voided:
            marketStatus = MarketStatus.Voided;
            break;
          default:
            marketStatus = MarketStatus.Open;
        }

        // Update resolution row
        await execute(
          `UPDATE resolutions
           SET state = $1,
               proposed_outcome = $2,
               proposed_at = CASE WHEN $3::bigint > 0 THEN to_timestamp($3::bigint) ELSE proposed_at END,
               finalised_at = CASE WHEN $1 = 2 THEN NOW() ELSE finalised_at END
           WHERE market_id = $4`,
          [oracleState, proposedOutcome, proposedAt ?? 0, market_id],
        );

        // Sync market status
        await execute(
          "UPDATE markets SET status = $1 WHERE market_id = $2",
          [marketStatus, market_id],
        );
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
        const reserves = await aztecRpc("node_call", [
          {
            to: config.contracts.amm,
            functionName: "get_reserves",
            args: [market_id],
          },
        ]);

        const [reserveYes, reserveNo] = reserves;
        const ry = Number(reserveYes);
        const rn = Number(reserveNo);
        const total = ry + rn;

        const priceYes = total > 0 ? rn / total : 0;
        const priceNo = total > 0 ? ry / total : 0;

        await execute(
          `INSERT INTO amm_snapshots (market_id, reserve_yes, reserve_no, price_yes, price_no, block_number)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [market_id, reserveYes, reserveNo, priceYes, priceNo, blockNumber],
        );
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
