// ---------------------------------------------------------------------------
// useMarkets — reads market list directly from public storage maps on the
// Aztec node. No wallet required: any visitor sees all markets.
//
// Slot derivation: poseidon2([base_slot_Fr, market_id_Fr])
// Base slots match MarketFactory storage layout (from contract source).
//
// Question/criteria/source text: Once the MarketFactory contract is updated
// to emit public logs on create_market, this hook will read them via
// node_getPublicLogs. Until then, markets without emitted text show
// "Market #N" as a fallback — no hardcoded seed data.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from "react";
import { aztecConfig } from "../config/aztec";
import type { Market, MarketDetail, PricePoint } from "../types";

// ---------------------------------------------------------------------------
// MarketFactory public storage base slots (from contracts/market_factory/src/main.nr)
// ---------------------------------------------------------------------------
const MF_SLOTS = {
  next_market_id: 6n,
  market_question_hash: 8n,
  market_criteria_hash: 9n,
  market_source_hash: 10n,
  market_creator: 11n,
  market_end_date: 12n,
  market_bond: 13n,
} as const;

const ZERO = "0x0000000000000000000000000000000000000000000000000000000000000000";

// ---------------------------------------------------------------------------
// RPC helpers — talk directly to the Aztec node, no wallet needed.
// ---------------------------------------------------------------------------
async function aztecRpc(method: string, params: unknown[]): Promise<string> {
  const url = aztecConfig.pxeUrl;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = (await res.json()) as { result?: string; error?: unknown };
  if (json.error) throw new Error(`[rpc] ${method}: ${JSON.stringify(json.error)}`);
  return String(json.result ?? ZERO);
}

async function readSlot(contract: string, slotHex: string): Promise<bigint> {
  const raw = await aztecRpc("node_getPublicStorageAt", ["latest", contract, slotHex]);
  if (!raw || raw === ZERO || raw === "0x0") return 0n;
  return BigInt(raw);
}

/** Derive the storage slot for a Map entry using Aztec's domain-separated hash. */
async function mapSlot(base: bigint, key: bigint): Promise<string> {
  const { deriveStorageSlotInMap } = await import("@aztec/stdlib/hash");
  const { Fr } = await import("@aztec/aztec.js/fields");
  const frKey = new Fr(key);
  const h = await deriveStorageSlotInMap(new Fr(base), { toField: () => frKey });
  return h.toString();
}

function toHex64(n: bigint): string {
  return `0x${n.toString(16).padStart(64, "0")}`;
}

// ---------------------------------------------------------------------------
// AMM price reader — reads reserves directly from public storage.
// No wallet required — avoids aztec_executeUtility which crashes via Azguard.
// AMM storage: admin=1, vault=2, oracle=3, deps_set=4,
//              reserve_yes=5, reserve_no=6, invariant_k=7
// ---------------------------------------------------------------------------
const AMM_SLOTS = { reserve_yes: 5n, reserve_no: 6n } as const;
const SCALE = 1_000_000n;

async function fetchAmmPrices(ammAddr: string, marketId: bigint): Promise<{ yesPrice: number; noPrice: number; liquidity: number }> {
  try {
    const [rySlot, rnSlot] = await Promise.all([
      mapSlot(AMM_SLOTS.reserve_yes, marketId),
      mapSlot(AMM_SLOTS.reserve_no, marketId),
    ]);
    const [ryRaw, rnRaw] = await Promise.all([
      readSlot(ammAddr, rySlot),
      readSlot(ammAddr, rnSlot),
    ]);
    const ry = ryRaw;
    const rn = rnRaw;
    if (ry === 0n && rn === 0n) return { yesPrice: 0.5, noPrice: 0.5, liquidity: 0 };
    const total = ry + rn;
    const yesPrice = Number((rn * SCALE) / total) / Number(SCALE);
    const noPrice = Number((ry * SCALE) / total) / Number(SCALE);
    return { yesPrice, noPrice, liquidity: Number(total) };
  } catch {
    return { yesPrice: 0.5, noPrice: 0.5, liquidity: 0 };
  }
}

// ---------------------------------------------------------------------------
// Public log reading — fetch question/criteria/source from emitted events.
// The MarketFactory emits a public log on create_market containing:
//   [market_id, question_packed_0, question_packed_1, criteria_packed_0,
//    criteria_packed_1, source_packed_0, end_date, creator_field]
//
// Each packed field encodes up to 31 UTF-8 bytes (fits in a Noir Field).
// Returns a map from market_id → { question, criteria, source }.
// ---------------------------------------------------------------------------
interface MarketText { question?: string; criteria?: string; source?: string; }

function fieldsToString(fields: bigint[]): string {
  let result = "";
  for (const f of fields) {
    if (f === 0n) continue;
    // Each field encodes up to 31 bytes big-endian
    const bytes: number[] = [];
    let v = f;
    while (v > 0n) {
      bytes.unshift(Number(v & 0xffn));
      v >>= 8n;
    }
    // Trim leading zeros (from packing) and decode as UTF-8
    const chunk = new TextDecoder().decode(new Uint8Array(bytes.filter((b) => b !== 0)));
    result += chunk;
  }
  return result.replace(/\0/g, "").trim();
}

async function fetchMarketTextFromLogs(factoryAddr: string): Promise<Record<number, MarketText>> {
  try {
    const res = await fetch(aztecConfig.pxeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "node_getPublicLogs",
        params: [{ contractAddress: factoryAddr }],
      }),
    });
    const json = (await res.json()) as { result?: { logs: Array<unknown> } };
    const logs = json.result?.logs ?? [];
    const textMap: Record<number, MarketText> = {};

    for (const entry of logs) {
      try {
        // The Aztec node returns logs with emitted fields accessible via
        // log.log.fields (array of hex strings) or log.log.getEmittedFields().
        // MarketCreated struct serializes to 10 Fields:
        // [market_id, q0, q1, q2, c0, c1, s0, s1, end_date, creator]
        const logObj = (entry as { log?: unknown }).log ?? entry;
        let rawFields: string[] | undefined;

        if (Array.isArray((logObj as { fields?: string[] }).fields)) {
          rawFields = (logObj as { fields: string[] }).fields;
        } else if (typeof (logObj as { data?: string }).data === "string") {
          // packed hex blob: split into 32-byte chunks
          const hex = (logObj as { data: string }).data.replace(/^0x/, "");
          rawFields = [];
          for (let i = 0; i < hex.length; i += 64) {
            rawFields.push("0x" + hex.slice(i, i + 64).padStart(64, "0"));
          }
        }

        if (!rawFields || rawFields.length < 10) continue;
        const fields = rawFields.map((h: string) => BigInt(h));

        // The Serialize derive prepends an event tag field (eventSelector hash).
        // Skip leading tag if present (fields[0] would be huge, not a small market_id).
        const offset = fields[0] > 1000000n ? 1 : 0;
        const marketId = Number(fields[offset]);
        if (!marketId || marketId <= 0 || marketId > 10000) continue;

        textMap[marketId] = {
          question: fieldsToString([fields[offset + 1], fields[offset + 2], fields[offset + 3]]),
          criteria: fieldsToString([fields[offset + 4], fields[offset + 5]]),
          source: fieldsToString([fields[offset + 6], fields[offset + 7]]),
        };
      } catch { /* skip malformed log */ }
    }
    return textMap;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Core: fetch all market data from public storage (no wallet needed)
// ---------------------------------------------------------------------------
async function fetchAllMarketsFromChain(factoryAddr: string): Promise<Market[]> {
  const nextIdRaw = await readSlot(factoryAddr, toHex64(MF_SLOTS.next_market_id));
  const nextId = Number(nextIdRaw);
  if (nextId <= 1) return [];

  // Fetch text from public logs in parallel with storage reads
  const [textMap, ...marketData] = await Promise.all([
    fetchMarketTextFromLogs(factoryAddr),
    ...Array.from({ length: nextId - 1 }, (_, i) => i + 1).map(async (id) => {
      const mid = BigInt(id);
      try {
        const [qSlot, cSlot, sSlot, crSlot, edSlot, bSlot] = await Promise.all([
          mapSlot(MF_SLOTS.market_question_hash, mid),
          mapSlot(MF_SLOTS.market_criteria_hash, mid),
          mapSlot(MF_SLOTS.market_source_hash, mid),
          mapSlot(MF_SLOTS.market_creator, mid),
          mapSlot(MF_SLOTS.market_end_date, mid),
          mapSlot(MF_SLOTS.market_bond, mid),
        ]);

        const [questionHash, criteriaHash, sourceHash, creatorRaw, endDateRaw, bondRaw] = await Promise.all([
          readSlot(factoryAddr, qSlot),
          readSlot(factoryAddr, cSlot),
          readSlot(factoryAddr, sSlot),
          readSlot(factoryAddr, crSlot),
          readSlot(factoryAddr, edSlot),
          readSlot(factoryAddr, bSlot),
        ]);

        if (questionHash === 0n && creatorRaw === 0n) return null;

        const endSec = Number(endDateRaw);
        const now = Math.floor(Date.now() / 1000);

        return {
          marketId: id,
          questionHash: toHex64(questionHash),
          criteriaHash: toHex64(criteriaHash),
          sourceHash: toHex64(sourceHash),
          creator: toHex64(creatorRaw),
          endDate: endSec,
          bond: Number(bondRaw),
          status: endSec > now ? "active" : "resolving",
          createdAt: new Date().toISOString(),
        } satisfies Market;
      } catch (err) {
        console.warn(`[useMarkets] Market ${id}: storage read failed`, err);
        return null;
      }
    }),
  ]);

  const markets = marketData.filter((m): m is Market => m !== null);

  // Enrich with text from public logs
  for (const m of markets) {
    const text = (textMap as Record<number, MarketText>)[m.marketId];
    if (text?.question) m.question = text.question;
    if (text?.criteria) m.criteria = text.criteria;
    if (text?.source) m.source = text.source;
  }

  return markets;
}

// ---------------------------------------------------------------------------
// Hook: useMarkets — wallet-free market listing
// ---------------------------------------------------------------------------
export function useMarkets(_params?: { status?: string; page?: number; limit?: number }) {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    setError(null);

    const factoryAddr = aztecConfig.contracts.marketFactory;
    if (!factoryAddr) {
      setMarkets([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    try {
      const result = await fetchAllMarketsFromChain(factoryAddr);
      setMarkets(result);
      setTotal(result.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMarkets(); }, [fetchMarkets]);

  return { markets, total, loading, error, refetch: fetchMarkets };
}

// ---------------------------------------------------------------------------
// Hook: useMarketDetail — wallet-optional (tries storage read first)
// ---------------------------------------------------------------------------
export function useMarketDetail(marketId: number | null) {
  const [market, setMarket] = useState<MarketDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (marketId === null) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const factoryAddr = aztecConfig.contracts.marketFactory;
        const ammAddr = aztecConfig.contracts.amm;
        if (!factoryAddr) throw new Error("Contract addresses not configured.");

        const mid = BigInt(marketId);

        const [qSlot, cSlot, sSlot, crSlot, edSlot, bSlot] = await Promise.all([
          mapSlot(MF_SLOTS.market_question_hash, mid),
          mapSlot(MF_SLOTS.market_criteria_hash, mid),
          mapSlot(MF_SLOTS.market_source_hash, mid),
          mapSlot(MF_SLOTS.market_creator, mid),
          mapSlot(MF_SLOTS.market_end_date, mid),
          mapSlot(MF_SLOTS.market_bond, mid),
        ]);

        const [[questionHash, criteriaHash, sourceHash, creatorRaw, endDateRaw, bondRaw], textMap] =
          await Promise.all([
            Promise.all([
              readSlot(factoryAddr, qSlot),
              readSlot(factoryAddr, cSlot),
              readSlot(factoryAddr, sSlot),
              readSlot(factoryAddr, crSlot),
              readSlot(factoryAddr, edSlot),
              readSlot(factoryAddr, bSlot),
            ]),
            fetchMarketTextFromLogs(factoryAddr),
          ]);

        if (questionHash === 0n) throw new Error("Market not found.");

        const endSec = Number(endDateRaw);
        const now = Math.floor(Date.now() / 1000);
        const text = textMap[marketId];

        // Fetch AMM prices directly from chain storage — no wallet needed, no Azguard crash.
        const { yesPrice, noPrice, liquidity } = ammAddr
          ? await fetchAmmPrices(ammAddr, mid)
          : { yesPrice: 0.5, noPrice: 0.5, liquidity: 0 };

        if (!cancelled) {
          setMarket({
            marketId,
            questionHash: toHex64(questionHash),
            criteriaHash: toHex64(criteriaHash),
            sourceHash: toHex64(sourceHash),
            creator: toHex64(creatorRaw),
            endDate: endSec,
            bond: Number(bondRaw),
            status: endSec > now ? "active" : "resolving",
            createdAt: new Date().toISOString(),
            question: text?.question,
            criteria: text?.criteria,
            source: text?.source,
            yesPrice,
            noPrice,
            liquidity,
            resolution: null,
          });
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [marketId]);

  return { market, loading, error };
}

// ---------------------------------------------------------------------------
// Hook: useMarketPrices — snapshot prices from AMM (wallet required)
// ---------------------------------------------------------------------------
export function useMarketPrices(marketId: number | null) {
  const [prices, setPrices] = useState<PricePoint[]>([]);

  useEffect(() => {
    if (marketId === null) return;
    let cancelled = false;

    (async () => {
      try {
        const ammAddr = aztecConfig.contracts.amm;
        if (!ammAddr) return;

        const { yesPrice, noPrice, liquidity } = await fetchAmmPrices(ammAddr, BigInt(marketId));

        if (!cancelled) {
          setPrices([{ timestamp: new Date().toISOString(), yesPrice, noPrice, liquidity }]);
        }
      } catch (err) {
        console.warn("[useMarketPrices] chain read failed:", err);
      }
    })();

    return () => { cancelled = true; };
  }, [marketId]);

  return prices;
}
