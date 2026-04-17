// ---------------------------------------------------------------------------
// Aztec public event listener.
//
// Polls the Aztec node for new blocks and indexes public state changes from:
//   - MarketFactory: market creation (public map reads via poseidon2 slot derivation)
//   - Oracle: resolution state / outcomes / timestamps
//   - AMM: reserve snapshots and implied prices
//
// Map slot formula (v4.1.3): poseidon2([base_slot, market_id])
// Base slots match tests/integration/src/artifacts/* ContractStorageLayout.
// ---------------------------------------------------------------------------

import { config } from "../config.js";
import {
  query,
  execute,
  getIndexerState,
  setIndexerState,
} from "../db/client.js";
import { MarketStatus, ResolutionState } from "../types/index.js";
import { deriveMapSlot } from "./mapSlot.js";

const WATERMARK_KEY = "last_indexed_block";

/** Base storage slot indices (Fr) from codegen — MarketFactoryContract.storage */
const MF = {
  next_market_id: 6n,
  market_question_hash: 8n,
  market_criteria_hash: 9n,
  market_source_hash: 10n,
  market_creator: 11n,
  market_end_date: 12n,
  market_bond: 13n,
} as const;

/** OracleContract.storage map bases */
const OR = {
  resolution_state: 4n,
  proposed_outcome: 5n,
  proposed_at: 6n,
} as const;

/** AMMContract.storage map bases */
const AMM = {
  reserve_yes: 5n,
  reserve_no: 6n,
} as const;

const SCALE = 1_000_000n;

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

async function getBlockNumber(): Promise<number> {
  const result = await aztecRpc("node_getBlockNumber");
  return Number(result);
}

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

function parseFieldRpcValue(raw: string): bigint {
  const t = raw.trim();
  if (!t || t === "0x" || t === "0X") return 0n;
  if (t.startsWith("0x") || t.startsWith("0X")) return BigInt(t);
  return BigInt(t);
}

function fieldToHex64(field: bigint): string {
  return `0x${field.toString(16).padStart(64, "0")}`;
}

function oracleStateToMarketStatus(oracleState: bigint): MarketStatus {
  switch (Number(oracleState)) {
    case 1:
      return MarketStatus.ResolutionProposed;
    case 2:
      return MarketStatus.Resolved;
    case 3:
      return MarketStatus.Disputed;
    case 4:
      return MarketStatus.Voided;
    default:
      return MarketStatus.Open;
  }
}

// ---------------------------------------------------------------------------
// Market Factory indexing
// ---------------------------------------------------------------------------

async function indexMarketFactory(_fromBlock: number, toBlock: number): Promise<void> {
  if (!config.contracts.marketFactory) return;

  try {
    const nextIdSlot = fieldToHex64(MF.next_market_id);
    const nextIdRaw = await readPublicSlot(config.contracts.marketFactory, nextIdSlot, toBlock);
    const nextMarketId = Number(parseFieldRpcValue(nextIdRaw));
    if (nextMarketId <= 1) return;

    for (let i = 1; i < nextMarketId; i++) {
      const mid = String(i);
      const mk = BigInt(i);

      try {
        const qSlot = await deriveMapSlot(MF.market_question_hash, mk);
        const cSlot = await deriveMapSlot(MF.market_criteria_hash, mk);
        const sSlot = await deriveMapSlot(MF.market_source_hash, mk);
        const crSlot = await deriveMapSlot(MF.market_creator, mk);
        const edSlot = await deriveMapSlot(MF.market_end_date, mk);
        const bSlot = await deriveMapSlot(MF.market_bond, mk);

        const qHash = parseFieldRpcValue(await readPublicSlot(config.contracts.marketFactory, qSlot, toBlock));
        const cHash = parseFieldRpcValue(await readPublicSlot(config.contracts.marketFactory, cSlot, toBlock));
        const sHash = parseFieldRpcValue(await readPublicSlot(config.contracts.marketFactory, sSlot, toBlock));
        const creatorF = parseFieldRpcValue(await readPublicSlot(config.contracts.marketFactory, crSlot, toBlock));
        const endDateF = parseFieldRpcValue(await readPublicSlot(config.contracts.marketFactory, edSlot, toBlock));
        const bondF = parseFieldRpcValue(await readPublicSlot(config.contracts.marketFactory, bSlot, toBlock));

        const creatorHex = fieldToHex64(creatorF);
        const endDateSec = Number(endDateF);
        const endDate = new Date(endDateSec > 0 ? endDateSec * 1000 : Date.now());

        await execute(
          `INSERT INTO markets (market_id, question_hash, criteria_hash, source_hash, creator, end_date, bond_amount, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (market_id) DO UPDATE SET
             question_hash = EXCLUDED.question_hash,
             criteria_hash = EXCLUDED.criteria_hash,
             source_hash = EXCLUDED.source_hash,
             creator = EXCLUDED.creator,
             end_date = EXCLUDED.end_date,
             bond_amount = EXCLUDED.bond_amount,
             updated_at = NOW()`,
          [
            mid,
            fieldToHex64(qHash),
            fieldToHex64(cHash),
            fieldToHex64(sHash),
            creatorHex,
            endDate,
            bondF.toString(),
            MarketStatus.Open,
          ],
        );

        await execute(
          `INSERT INTO resolutions (market_id, state)
           VALUES ($1, $2)
           ON CONFLICT (market_id) DO NOTHING`,
          [mid, ResolutionState.Unresolved],
        );

        console.log(`[indexer] Upserted market #${mid} from chain`);
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

async function indexOracleResolutions(headBlock: number): Promise<void> {
  if (!config.contracts.oracle) return;

  try {
    const rows = await query<{ market_id: string }>("SELECT market_id FROM markets");

    for (const { market_id } of rows) {
      try {
        const mk = BigInt(market_id);
        const stSlot = await deriveMapSlot(OR.resolution_state, mk);
        const outSlot = await deriveMapSlot(OR.proposed_outcome, mk);
        const atSlot = await deriveMapSlot(OR.proposed_at, mk);

        const st = parseFieldRpcValue(await readPublicSlot(config.contracts.oracle, stSlot, headBlock));
        const outcome = parseFieldRpcValue(await readPublicSlot(config.contracts.oracle, outSlot, headBlock));
        const proposedAtF = parseFieldRpcValue(await readPublicSlot(config.contracts.oracle, atSlot, headBlock));

        const resState = Number(st);
        const proposedAtSec = Number(proposedAtF);
        const proposedAt =
          proposedAtSec > 0 ? new Date(proposedAtSec * 1000) : null;
        const proposedOutcome =
          resState >= 1 && (outcome === 0n || outcome === 1n) ? Number(outcome) : null;

        await execute(
          `UPDATE resolutions SET
             state = $1,
             proposed_outcome = $2,
             proposed_at = $3,
             updated_at = NOW()
           WHERE market_id = $4`,
          [resState, proposedOutcome, proposedAt, market_id],
        );

        if (st > 0n) {
          const mstat = oracleStateToMarketStatus(st);
          await execute(`UPDATE markets SET status = $1, updated_at = NOW() WHERE market_id = $2`, [
            mstat,
            market_id,
          ]);
        }
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

function pricesFromReserves(ry: bigint, rn: bigint): { priceYes: number; priceNo: number } {
  const sum = ry + rn;
  if (sum === 0n) return { priceYes: 0, priceNo: 0 };
  const py = Number((rn * SCALE) / sum) / Number(SCALE);
  const pn = Number((ry * SCALE) / sum) / Number(SCALE);
  return { priceYes: py, priceNo: pn };
}

async function indexAmmSnapshots(blockNumber: number): Promise<void> {
  if (!config.contracts.amm) return;

  try {
    const markets = await query<{ market_id: string }>(
      "SELECT market_id FROM markets WHERE status IN ('open', 'halted', 'resolution_proposed')",
    );

    for (const { market_id } of markets) {
      try {
        const mk = BigInt(market_id);
        const rySlot = await deriveMapSlot(AMM.reserve_yes, mk);
        const rnSlot = await deriveMapSlot(AMM.reserve_no, mk);

        const ry = parseFieldRpcValue(await readPublicSlot(config.contracts.amm, rySlot, blockNumber));
        const rn = parseFieldRpcValue(await readPublicSlot(config.contracts.amm, rnSlot, blockNumber));

        const { priceYes, priceNo } = pricesFromReserves(ry, rn);

        await execute(
          `INSERT INTO amm_snapshots (market_id, reserve_yes, reserve_no, price_yes, price_no, block_number)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [market_id, ry.toString(), rn.toString(), priceYes, priceNo, blockNumber],
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

  if (headBlock <= lastBlock) return;

  console.log(`[indexer] Processing blocks ${lastBlock + 1} → ${headBlock}`);

  await indexMarketFactory(lastBlock + 1, headBlock);
  await indexOracleResolutions(headBlock);
  await indexAmmSnapshots(headBlock);
  await markHaltedMarkets();

  await setIndexerState(WATERMARK_KEY, String(headBlock));
}

export function startEventListener(): void {
  if (running) return;
  running = true;

  console.log(`[indexer] Starting event listener (poll every ${config.pollIntervalMs}ms)`);

  pollOnce().catch((err) => console.error("[indexer] Poll error:", err));

  const interval = setInterval(() => {
    pollOnce().catch((err) => console.error("[indexer] Poll error:", err));
  }, config.pollIntervalMs);

  const shutdown = () => {
    running = false;
    clearInterval(interval);
    console.log("[indexer] Event listener stopped.");
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

export { pollOnce };
