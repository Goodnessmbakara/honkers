// ---------------------------------------------------------------------------
// useMarkets — fetch market list/detail from indexer API (FR-M-1, FR-M-2)
// Falls back to reading directly from the MarketFactory contract on-chain
// when the indexer is unavailable.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from "react";
import { aztecConfig } from "../config/aztec";
import { useAztecWallet } from "./useAztecWallet";
import { getArtifact } from "../config/contractArtifacts";
import { Contract } from "@aztec/aztec.js/contracts";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import type { ApiResponse, Market, MarketDetail, MarketStatus, PricePoint } from "../types";
import { ammPriceToFloat, fieldLikeToBigInt, unwrapSimulate } from "../utils/aztecSimulate";

const api = (path: string) => `${aztecConfig.indexerUrl}${path}`;

// Known market questions — maps questionHash to human-readable text.
// In production this would come from the indexer / IPFS / metadata service.
const KNOWN_QUESTIONS: Record<string, string> = {
  "0x00a22e5706261089c02407859a5b71b7ff4d95c89d0da2479cfa89d1fc9895be":
    "Will Bola Ahmed Tinubu win the 2027 Nigerian Presidential Election?",
};

function mapIndexerStatus(s: string | undefined): MarketStatus {
  const m: Record<string, MarketStatus> = {
    open: "active",
    halted: "halted",
    resolution_proposed: "resolving",
    disputed: "resolving",
    resolved: "resolved",
    voided: "voided",
  };
  return m[String(s ?? "").toLowerCase()] ?? "active";
}

/** Indexer detail JSON (camelCase) or frontend `MarketDetail` → unified `MarketDetail`. */
function normalizeMarketDetailPayload(raw: unknown): MarketDetail | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const inner = (r.data ?? r) as Record<string, unknown>;
  const mid = Number(inner.marketId ?? inner.market_id);
  if (!Number.isFinite(mid)) return null;

  const yesPrice =
    typeof inner.yesPrice === "number"
      ? inner.yesPrice
      : typeof inner.priceYes === "number"
        ? inner.priceYes
        : 0.5;
  const noPrice =
    typeof inner.noPrice === "number"
      ? inner.noPrice
      : typeof inner.priceNo === "number"
        ? inner.priceNo
        : 0.5;

  const endRaw = inner.endDate ?? inner.end_date;
  const endDate =
    typeof endRaw === "number"
      ? endRaw
      : typeof endRaw === "string"
        ? Math.floor(new Date(endRaw).getTime() / 1000)
        : 0;

  const bondRaw = inner.bond ?? inner.bondAmount ?? inner.bond_amount;
  const bond = typeof bondRaw === "number" ? bondRaw : Number(bondRaw ?? 0);

  const liquidityRaw = inner.liquidity ?? inner.volume;
  const liquidity = typeof liquidityRaw === "number" ? liquidityRaw : Number(liquidityRaw ?? 0);

  return {
    marketId: mid,
    questionHash: String(inner.questionHash ?? inner.question_hash ?? ""),
    criteriaHash: String(inner.criteriaHash ?? inner.criteria_hash ?? ""),
    sourceHash: String(inner.sourceHash ?? inner.source_hash ?? ""),
    creator: String(inner.creator ?? ""),
    endDate,
    bond,
    status: mapIndexerStatus(String(inner.status ?? "open")),
    createdAt: String(inner.createdAt ?? inner.created_at ?? new Date().toISOString()),
    question:
      (inner.question as string | undefined) ??
      (inner.questionText as string | undefined) ??
      (inner.question_text as string | undefined),
    criteria: (inner.criteria as string | undefined) ?? (inner.criteriaText as string | undefined),
    source: (inner.source as string | undefined) ?? (inner.sourceText as string | undefined),
    resolution: (inner.resolution as MarketDetail["resolution"]) ?? null,
    yesPrice,
    noPrice,
    liquidity,
  };
}

export function useMarkets(params?: { status?: string; page?: number; limit?: number }) {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { pxeInstance } = useAztecWallet();

  const fetchFromChain = useCallback(async (): Promise<Market[]> => {
    if (!pxeInstance) return [];
    const { wallet } = pxeInstance;
    const factoryAddr = aztecConfig.contracts.marketFactory;
    if (!factoryAddr) return [];

    const artifact = getArtifact(factoryAddr);
    const address = AztecAddress.fromString(factoryAddr);
    const contract = Contract.at(address, artifact, wallet);

    // Read next_market_id to know how many markets exist
    const nextIdRaw = await contract.methods.get_next_market_id().simulate();
    const nextId = Number(nextIdRaw);
    if (nextId <= 1) return []; // no markets

    const results: Market[] = [];
    for (let id = 1; id < nextId; id++) {
      try {
        const info = await contract.methods.get_market_info(id).simulate();
        if (!info) {
          console.warn(`[useMarkets] Market ${id}: simulate returned undefined (stale contract address?)`);
          continue;
        }
        // info is a tuple: (questionHash, criteriaHash, sourceHash, creator, endDate, bond)
        const raw = info as unknown as unknown[];
        const questionHash = raw[0] as bigint | undefined;
        const criteriaHash = raw[1] as bigint | undefined;
        const sourceHash = raw[2] as bigint | undefined;
        const creator = raw[3] as { toString(): string } | undefined;
        const endDate = raw[4] as bigint | undefined;
        const bond = raw[5] as bigint | undefined;

        if (questionHash == null || creator == null) {
          console.warn(`[useMarkets] Market ${id}: incomplete data from chain, skipping`);
          continue;
        }

        const qHash = `0x${questionHash.toString(16).padStart(64, "0")}`;
        results.push({
          marketId: id,
          questionHash: qHash,
          criteriaHash: criteriaHash != null ? `0x${criteriaHash.toString(16).padStart(64, "0")}` : "0x0",
          sourceHash: sourceHash != null ? `0x${sourceHash.toString(16).padStart(64, "0")}` : "0x0",
          creator: creator.toString(),
          endDate: endDate != null ? Number(endDate) : 0,
          bond: bond != null ? Number(bond) : 0,
          status: endDate != null && Number(endDate) * 1000 > Date.now() ? "active" : "resolving",
          createdAt: new Date().toISOString(),
          question: KNOWN_QUESTIONS[qHash],
        });
      } catch (err) {
        console.warn(`[useMarkets] Failed to read market ${id} from chain:`, err);
      }
    }
    return results;
  }, [pxeInstance]);

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Try indexer first
      const qs = new URLSearchParams();
      if (params?.status) qs.set("status", params.status);
      if (params?.page) qs.set("page", String(params.page));
      if (params?.limit) qs.set("limit", String(params.limit));
      const res = await fetch(api(`/api/markets?${qs}`));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ApiResponse<Market[]> & { markets?: Market[] };
      const data = json.data ?? json.markets ?? [];
      setMarkets(data);
      setTotal(json.pagination?.total ?? data.length);
    } catch {
      // Indexer unavailable — fall back to on-chain reads
      try {
        const onChainMarkets = await fetchFromChain();
        setMarkets(onChainMarkets);
        setTotal(onChainMarkets.length);
        if (onChainMarkets.length === 0 && !pxeInstance) {
          setError("Indexer offline. Connect wallet to load markets from chain.");
        }
      } catch (chainErr) {
        setError(chainErr instanceof Error ? chainErr.message : String(chainErr));
      }
    } finally {
      setLoading(false);
    }
  }, [params?.status, params?.page, params?.limit, fetchFromChain, pxeInstance]);

  useEffect(() => { fetchMarkets(); }, [fetchMarkets]);

  return { markets, total, loading, error, refetch: fetchMarkets };
}

export function useMarketDetail(marketId: number | null) {
  const [market, setMarket] = useState<MarketDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { pxeInstance } = useAztecWallet();

  const fetchMarketDetailFromChain = useCallback(
    async (id: number): Promise<MarketDetail | null> => {
      if (!pxeInstance) return null;
      const { wallet } = pxeInstance;
      const factoryAddr = aztecConfig.contracts.marketFactory;
      const ammAddr = aztecConfig.contracts.amm;
      if (!factoryAddr || !ammAddr) return null;

      const factoryArtifact = getArtifact(factoryAddr);
      const ammArtifact = getArtifact(ammAddr);
      const factory = Contract.at(AztecAddress.fromString(factoryAddr), factoryArtifact, wallet);
      const amm = Contract.at(AztecAddress.fromString(ammAddr), ammArtifact, wallet);
      const mid = BigInt(id);

      const infoRaw = await factory.methods.get_market_info(mid).simulate();
      const info = unwrapSimulate(infoRaw) as unknown;
      const raw = Array.isArray(info) ? info : info != null && typeof info === "object" ? Object.values(info as object) : [];
      const questionHash = raw[0] as bigint | undefined;
      const criteriaHash = raw[1] as bigint | undefined;
      const sourceHash = raw[2] as bigint | undefined;
      const creator = raw[3] as { toString(): string } | undefined;
      const endDate = raw[4] as bigint | undefined;
      const bond = raw[5] as bigint | undefined;
      if (questionHash == null || creator == null) return null;

      const qHash = `0x${questionHash.toString(16).padStart(64, "0")}`;
      const yesRaw = await amm.methods.get_price_yes(mid).simulate();
      const noRaw = await amm.methods.get_price_no(mid).simulate();
      const yesPrice = ammPriceToFloat(fieldLikeToBigInt(unwrapSimulate(yesRaw)));
      const noPrice = ammPriceToFloat(fieldLikeToBigInt(unwrapSimulate(noRaw)));

      let liquidity = 0;
      try {
        const resRaw = await amm.methods.get_reserves(mid).simulate();
        const tup = unwrapSimulate(resRaw) as unknown;
        const pair = Array.isArray(tup) ? tup : tup != null && typeof tup === "object" ? Object.values(tup as object) : [];
        const ry = pair[0] != null ? fieldLikeToBigInt(pair[0]) : 0n;
        const rn = pair[1] != null ? fieldLikeToBigInt(pair[1]) : 0n;
        liquidity = Number(ry + rn);
      } catch {
        /* reserves optional */
      }

      const endSec = endDate != null ? Number(endDate) : 0;
      return {
        marketId: id,
        questionHash: qHash,
        criteriaHash: criteriaHash != null ? `0x${criteriaHash.toString(16).padStart(64, "0")}` : "0x0",
        sourceHash: sourceHash != null ? `0x${sourceHash.toString(16).padStart(64, "0")}` : "0x0",
        creator: creator.toString(),
        endDate: endSec,
        bond: bond != null ? Number(bond) : 0,
        status: endSec * 1000 > Date.now() ? "active" : "resolving",
        createdAt: new Date().toISOString(),
        question: KNOWN_QUESTIONS[qHash],
        yesPrice,
        noPrice,
        liquidity,
        resolution: null,
      };
    },
    [pxeInstance],
  );

  useEffect(() => {
    if (marketId === null) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch(api(`/api/markets/${marketId}`));
        if (res.ok) {
          const raw = await res.json();
          const m = normalizeMarketDetailPayload(raw);
          if (m) {
            if (!cancelled) {
              setMarket(m);
              setError(null);
            }
            return;
          }
        } else if (res.status !== 404) {
          throw new Error(`HTTP ${res.status}`);
        }
      } catch (e) {
        if (!cancelled) {
          console.warn("[useMarketDetail] indexer request failed, trying chain:", e);
        }
      }

      const chain = await fetchMarketDetailFromChain(marketId);
      if (!cancelled) {
        if (chain) {
          setMarket(chain);
          setError(null);
        } else {
          setMarket(null);
          setError(
            pxeInstance
              ? "Market not found on indexer or chain."
              : "Market not found. Connect wallet to load from chain when indexer is offline.",
          );
        }
      }
    })().finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [marketId, fetchMarketDetailFromChain, pxeInstance]);

  return { market, loading, error };
}

export function useMarketPrices(marketId: number | null) {
  const [prices, setPrices] = useState<PricePoint[]>([]);
  const { pxeInstance } = useAztecWallet();

  const fetchPricesFromChain = useCallback(
    async (id: number): Promise<PricePoint[]> => {
      if (!pxeInstance) return [];
      const { wallet } = pxeInstance;
      const ammAddr = aztecConfig.contracts.amm;
      if (!ammAddr) return [];
      const ammArtifact = getArtifact(ammAddr);
      const amm = Contract.at(AztecAddress.fromString(ammAddr), ammArtifact, wallet);
      const mid = BigInt(id);
      const yesRaw = await amm.methods.get_price_yes(mid).simulate();
      const noRaw = await amm.methods.get_price_no(mid).simulate();
      const yes = ammPriceToFloat(fieldLikeToBigInt(unwrapSimulate(yesRaw)));
      const no = ammPriceToFloat(fieldLikeToBigInt(unwrapSimulate(noRaw)));
      let liquidity = 0;
      try {
        const resRaw = await amm.methods.get_reserves(mid).simulate();
        const tup = unwrapSimulate(resRaw) as unknown;
        const pair = Array.isArray(tup) ? tup : tup != null && typeof tup === "object" ? Object.values(tup as object) : [];
        const ry = pair[0] != null ? fieldLikeToBigInt(pair[0]) : 0n;
        const rn = pair[1] != null ? fieldLikeToBigInt(pair[1]) : 0n;
        liquidity = Number(ry + rn);
      } catch {
        /* optional */
      }
      return [
        {
          timestamp: new Date().toISOString(),
          yesPrice: yes,
          noPrice: no,
          liquidity,
        },
      ];
    },
    [pxeInstance],
  );

  useEffect(() => {
    if (marketId === null) return;
    let cancelled = false;
    fetch(api(`/api/markets/${marketId}/prices`))
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();
        const snaps = (raw as { snapshots?: Record<string, unknown>[] }).snapshots;
        if (snaps?.length) {
          const mapped: PricePoint[] = snaps.map((s) => ({
            timestamp: String(s.captured_at ?? s.capturedAt ?? ""),
            yesPrice: Number(s.price_yes ?? s.priceYes ?? 0.5),
            noPrice: Number(s.price_no ?? s.priceNo ?? 0.5),
            liquidity: Number(s.reserve_yes ?? s.reserveYes ?? 0) + Number(s.reserve_no ?? s.reserveNo ?? 0),
          }));
          if (!cancelled) setPrices(mapped);
          return;
        }
        const data = (raw as ApiResponse<PricePoint[]>).data;
        if (Array.isArray(data) && data.length) {
          if (!cancelled) setPrices(data);
          return;
        }
        throw new Error("empty");
      })
      .catch(async () => {
        const fallback = await fetchPricesFromChain(marketId);
        if (!cancelled) setPrices(fallback);
      });
    return () => {
      cancelled = true;
    };
  }, [marketId, fetchPricesFromChain]);

  return prices;
}
