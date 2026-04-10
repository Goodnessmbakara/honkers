// ---------------------------------------------------------------------------
// useMarkets — fetch market list/detail from indexer API (FR-M-1, FR-M-2)
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from "react";
import { aztecConfig } from "../config/aztec";
import type { ApiResponse, Market, MarketDetail, PricePoint } from "../types";

const api = (path: string) => `${aztecConfig.indexerUrl}${path}`;

export function useMarkets(params?: { status?: string; page?: number; limit?: number }) {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (params?.status) qs.set("status", params.status);
      if (params?.page) qs.set("page", String(params.page));
      if (params?.limit) qs.set("limit", String(params.limit));
      const res = await fetch(api(`/api/markets?${qs}`));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: ApiResponse<Market[]> = await res.json();
      setMarkets(json.data);
      setTotal(json.pagination?.total ?? json.data.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [params?.status, params?.page, params?.limit]);

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
