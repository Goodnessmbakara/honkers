// ---------------------------------------------------------------------------
// useMarkets — reads market data directly from the Aztec node / contracts.
// No indexer required: all data is fetched via contract simulation over the
// PXE's aztecNode connection.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from "react";
import { aztecConfig } from "../config/aztec";
import { useWalletContext } from "../contexts/WalletContext";
import { getArtifact } from "../config/contractArtifacts";
import { Contract } from "@aztec/aztec.js/contracts";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import type { Market, MarketDetail, PricePoint } from "../types";
import { ammPriceToFloat, fieldLikeToBigInt, unwrapSimulate } from "../utils/aztecSimulate";
import { ensureContractRegisteredWithPXE } from "../utils/ensureContractRegistered";

// Known market questions — maps questionHash → human-readable text.
// Add entries here after creating markets on-chain.
const KNOWN_QUESTIONS: Record<string, string> = {
  "0x00762187ff993c3095a609b997a1894c40eb6d6a70b2c16016ad6f752342f809":
    "Will Bitcoin (BTC) reach $200,000 USD by December 31, 2026?",
};

export function useMarkets(_params?: { status?: string; page?: number; limit?: number }) {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { wallet, aztecNode } = useWalletContext();

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (!wallet || !aztecNode) {
      setMarkets([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    try {
      const factoryAddr = aztecConfig.contracts.marketFactory;
      if (!factoryAddr) {
        setMarkets([]);
        setTotal(0);
        setLoading(false);
        return;
      }

      const artifact = getArtifact(factoryAddr);
      const address = AztecAddress.fromString(factoryAddr);
      await ensureContractRegisteredWithPXE(wallet, aztecNode, factoryAddr, artifact);
      const contract = Contract.at(address, artifact, wallet);

      const nextIdRaw = await contract.methods.get_next_market_id().simulate();
      const nextId = Number(fieldLikeToBigInt(unwrapSimulate(nextIdRaw)));
      if (nextId <= 1) {
        setMarkets([]);
        setTotal(0);
        setLoading(false);
        return;
      }

      const results: Market[] = [];
      for (let id = 1; id < nextId; id++) {
        try {
          const infoRaw = await contract.methods.get_market_info(id).simulate();
          const info = unwrapSimulate(infoRaw) as unknown;
          if (!info) continue;

          const raw = Array.isArray(info)
            ? info
            : typeof info === "object"
              ? Object.values(info as object)
              : [];

          const questionHash = raw[0] != null ? fieldLikeToBigInt(raw[0]) : undefined;
          const criteriaHash = raw[1] != null ? fieldLikeToBigInt(raw[1]) : undefined;
          const sourceHash = raw[2] != null ? fieldLikeToBigInt(raw[2]) : undefined;
          const creator = raw[3] as { toString(): string } | undefined;
          const endDate = raw[4] != null ? fieldLikeToBigInt(raw[4]) : undefined;
          const bond = raw[5] != null ? fieldLikeToBigInt(raw[5]) : undefined;

          if (questionHash == null || creator == null) continue;

          const qHash = `0x${questionHash.toString(16).padStart(64, "0")}`;
          const endSec = endDate != null ? Number(endDate) : 0;
          results.push({
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
          });
        } catch (err) {
          console.warn(`[useMarkets] Market ${id}: failed to read from chain`, err);
        }
      }

      setMarkets(results);
      setTotal(results.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [wallet, aztecNode]);

  useEffect(() => { fetchMarkets(); }, [fetchMarkets]);

  return { markets, total, loading, error, refetch: fetchMarkets };
}

export function useMarketDetail(marketId: number | null) {
  const [market, setMarket] = useState<MarketDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { wallet, aztecNode } = useWalletContext();

  useEffect(() => {
    if (marketId === null || !wallet || !aztecNode) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const factoryAddr = aztecConfig.contracts.marketFactory;
        const ammAddr = aztecConfig.contracts.amm;
        if (!factoryAddr || !ammAddr) throw new Error("Contract addresses not configured.");

        const factoryArtifact = getArtifact(factoryAddr);
        const ammArtifact = getArtifact(ammAddr);
        const factoryAddress = AztecAddress.fromString(factoryAddr);
        const ammAddress = AztecAddress.fromString(ammAddr);

        await ensureContractRegisteredWithPXE(wallet, aztecNode, factoryAddr, factoryArtifact);
        await ensureContractRegisteredWithPXE(wallet, aztecNode, ammAddr, ammArtifact);

        const factory = Contract.at(factoryAddress, factoryArtifact, wallet);
        const amm = Contract.at(ammAddress, ammArtifact, wallet);
        const mid = BigInt(marketId);

        const infoRaw = await factory.methods.get_market_info(mid).simulate();
        const info = unwrapSimulate(infoRaw) as unknown;
        const raw = Array.isArray(info)
          ? info
          : info != null && typeof info === "object"
            ? Object.values(info as object)
            : [];

        const questionHash = raw[0] as bigint | undefined;
        const criteriaHash = raw[1] as bigint | undefined;
        const sourceHash = raw[2] as bigint | undefined;
        const creator = raw[3] as { toString(): string } | undefined;
        const endDate = raw[4] as bigint | undefined;
        const bond = raw[5] as bigint | undefined;
        if (questionHash == null || creator == null) throw new Error("Market not found.");

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
        } catch { /* optional */ }

        const endSec = endDate != null ? Number(endDate) : 0;
        if (!cancelled) {
          setMarket({
            marketId,
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
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [marketId, wallet, aztecNode]);

  return { market, loading, error };
}

export function useMarketPrices(marketId: number | null) {
  const [prices, setPrices] = useState<PricePoint[]>([]);
  const { wallet, aztecNode } = useWalletContext();

  useEffect(() => {
    if (marketId === null || !wallet || !aztecNode) return;
    let cancelled = false;

    (async () => {
      try {
        const ammAddr = aztecConfig.contracts.amm;
        if (!ammAddr) return;

        const ammArtifact = getArtifact(ammAddr);
        const amm = Contract.at(AztecAddress.fromString(ammAddr), ammArtifact, wallet);
        const mid = BigInt(marketId);

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
        } catch { /* optional */ }

        if (!cancelled) {
          setPrices([{
            timestamp: new Date().toISOString(),
            yesPrice: yes,
            noPrice: no,
            liquidity,
          }]);
        }
      } catch (err) {
        console.warn("[useMarketPrices] chain read failed:", err);
      }
    })();

    return () => { cancelled = true; };
  }, [marketId, wallet, aztecNode]);

  return prices;
}
