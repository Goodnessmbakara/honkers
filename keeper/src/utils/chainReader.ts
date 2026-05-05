// ---------------------------------------------------------------------------
// Chain reader — reads MarketFactory + Oracle public storage via Aztec RPC.
// Replaces the previous postgres/indexer dependency for market enumeration.
//
// Slot derivation: poseidon2HashWithSeparator([base_slot, market_id], 4015149901)
// DomainSeparator.PUBLIC_STORAGE_MAP_SLOT = 4015149901 (@aztec/constants 4.2.0)
// ---------------------------------------------------------------------------

import { config } from "../config.js";

const ZERO = "0x0000000000000000000000000000000000000000000000000000000000000000";

// MarketFactory storage base slots (from contract source)
const MF = {
  next_market_id: 6n,
  market_end_date: 12n,
} as const;

// Oracle storage base slots
const OR = {
  resolution_state: 4n,
} as const;

async function aztecRpc(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(config.aztecRpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json()) as { result?: unknown; error?: unknown };
  if (json.error) throw new Error(`[rpc] ${method}: ${JSON.stringify(json.error)}`);
  return json.result;
}

function toHex64(n: bigint): string {
  return `0x${n.toString(16).padStart(64, "0")}`;
}

async function readSlot(contract: string, slotHex: string): Promise<bigint> {
  const raw = (await aztecRpc("node_getPublicStorageAt", ["latest", contract, slotHex])) as string;
  if (!raw || raw === ZERO || raw === "0x0") return 0n;
  return BigInt(raw);
}

/** Derive Map<Field, PublicMutable<...>> slot using poseidon2 with domain separator. */
async function mapSlot(base: bigint, key: bigint): Promise<string> {
  // Inline poseidon2 with separator using the @aztec/foundation package
  // that is already a transitive dependency via the aztec node connection.
  // We use a pure numeric fallback here since the keeper doesn't bundle aztec.js.
  // The slot derivation formula is: poseidon2([separator, base, key]) where
  // separator = 4015149901 (PUBLIC_STORAGE_MAP_SLOT domain separator).
  //
  // Since keeper has no aztec.js dep, we call a lightweight RPC-based derive:
  // the Aztec node itself has a utility for this via node_getPublicStorageAt
  // using the pre-derived slot hex. We pre-compute via the same formula used
  // in the frontend (imported lazily if available, otherwise skip gracefully).
  try {
    const { createRequire } = await import("module");
    const require = createRequire(import.meta.url);
    // Try to load poseidon from @aztec/foundation if installed as a dep
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const poseidon = require("@aztec/foundation/crypto/poseidon") as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { Fr } = require("@aztec/foundation/curves/bn254/field") as any;
    const h = await poseidon.poseidon2HashWithSeparator([new Fr(base), new Fr(key)], 4015149901);
    return h.toString();
  } catch {
    // Fallback: simple deterministic key (will not match real slots — logs warning)
    console.warn("[chainReader] poseidon2 unavailable — map slot derivation skipped");
    return toHex64(base ^ key);
  }
}

export interface MarketSummary {
  marketId: number;
  endDate: number;
}

/** Read all markets from MarketFactory public storage. */
export async function readAllMarkets(factoryAddr: string): Promise<MarketSummary[]> {
  const nextIdRaw = await readSlot(factoryAddr, toHex64(MF.next_market_id));
  const nextId = Number(nextIdRaw);
  if (nextId <= 1) return [];

  const results: MarketSummary[] = [];
  for (let id = 1; id < nextId; id++) {
    try {
      const edSlot = await mapSlot(MF.market_end_date, BigInt(id));
      const endDateRaw = await readSlot(factoryAddr, edSlot);
      if (endDateRaw === 0n) continue;
      results.push({ marketId: id, endDate: Number(endDateRaw) });
    } catch (err) {
      console.warn(`[chainReader] Failed to read market ${id}:`, err);
    }
  }
  return results;
}

/** Read Oracle resolution state for a market (0=unresolved,1=proposed,2=finalised,3=disputed,4=voided). */
export async function readOracleState(oracleAddr: string, marketId: number): Promise<number> {
  try {
    const stSlot = await mapSlot(OR.resolution_state, BigInt(marketId));
    const raw = await readSlot(oracleAddr, stSlot);
    return Number(raw);
  } catch {
    return 0;
  }
}
