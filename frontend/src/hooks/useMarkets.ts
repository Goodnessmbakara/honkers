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
import type { ApiResponse, Market, MarketDetail, PricePoint } from "../types";

const api = (path: string) => `${aztecConfig.indexerUrl}${path}`;

// Known market questions — maps questionHash to human-readable text.
// In production this would come from the indexer / IPFS / metadata service.
const KNOWN_QUESTIONS: Record<string, string> = {
  "0x00a22e5706261089c02407859a5b71b7ff4d95c89d0da2479cfa89d1fc9895be":
    "Will Bola Ahmed Tinubu win the 2027 Nigerian Presidential Election?",
};

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
        // info is a tuple: (questionHash, criteriaHash, sourceHash, creator, endDate, bond)
        const [questionHash, criteriaHash, sourceHash, creator, endDate, bond] = info as [
          bigint, bigint, bigint, { toString(): string }, bigint, bigint,
        ];
        const qHash = `0x${questionHash.toString(16).padStart(64, "0")}`;
        results.push({
          marketId: id,
          questionHash: qHash,
          criteriaHash: `0x${criteriaHash.toString(16).padStart(64, "0")}`,
          sourceHash: `0x${sourceHash.toString(16).padStart(64, "0")}`,
          creator: creator.toString(),
          endDate: Number(endDate),
          bond: Number(bond),
          status: Number(endDate) * 1000 > Date.now() ? "active" : "resolving",
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
      const json: ApiResponse<Market[]> = await res.json();
      setMarkets(json.data);
      setTotal(json.pagination?.total ?? json.data.length);
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

  useEffect(() => {
    if (marketId === null) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(api(`/api/markets/${marketId}`))
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: ApiResponse<MarketDetail> = await res.json();
        if (!cancelled) setMarket(json.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [marketId]);

  return { market, loading, error };
}

export function useMarketPrices(marketId: number | null) {
  const [prices, setPrices] = useState<PricePoint[]>([]);

  useEffect(() => {
    if (marketId === null) return;
    let cancelled = false;
    fetch(api(`/api/markets/${marketId}/prices`))
      .then(async (res) => {
        if (!res.ok) return;
        const json: ApiResponse<PricePoint[]> = await res.json();
        if (!cancelled) setPrices(json.data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [marketId]);

  return prices;
}
