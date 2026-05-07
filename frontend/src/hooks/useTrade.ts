// ---------------------------------------------------------------------------
// useTrade — trade execution, local proof generation, tx submission
//
// Flow: deposit_collateral(amount) → buy_shares(..., min_shares_out, price_per_share).
// Price is read directly from AMM public storage (no wallet/Azguard needed).
// ---------------------------------------------------------------------------

import { useCallback, useState } from "react";
import type { ProofStep, TradeParams } from "../types";
import { aztecConfig } from "../config/aztec";
import { usePXE } from "./usePXE";
import { Fr } from "@aztec/aztec.js/fields";
import { fetchAmmPrices } from "./useMarkets";

const SCALE = 1_000_000n;

export function useTrade() {
  const { simulateAndProve, cancelProof } = usePXE();
  const [step, setStep] = useState<ProofStep | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txHashes, setTxHashes] = useState<[string, string] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (params: TradeParams, walletAddress: string) => {
      setStep(null);
      setElapsed(0);
      setTxHash(null);
      setTxHashes(null);
      setError(null);

      const t0 = Date.now();
      const timer = setInterval(() => setElapsed(Date.now() - t0), 500);

      try {
        const amm = aztecConfig.contracts.amm;
        if (!amm) throw new Error("AMM address not configured");

        // Read price directly from chain storage — no wallet/Azguard utility call
        const mid = BigInt(params.marketId);
        const { yesPrice, noPrice } = await fetchAmmPrices(amm, mid);
        const rawPrice = params.side === "yes" ? yesPrice : noPrice;
        const pricePerShare = BigInt(Math.round(rawPrice * Number(SCALE)));
        if (pricePerShare === 0n) throw new Error("AMM price is zero (market not initialized?)");

        const collateralAmount = BigInt(params.amount);
        const expectedShares = (collateralAmount * SCALE) / pricePerShare;
        const bps = BigInt(Math.min(10_000, Math.max(0, params.maxSlippage)));
        const minSharesOut = (expectedShares * (10_000n - bps)) / 10_000n;
        if (minSharesOut === 0n) throw new Error("Trade size too small after slippage");

        const sideField = params.side === "yes" ? 1 : 0;

        const mapDeposit = (s: string): ProofStep => {
          if (s === "witness") return "deposit_witness";
          if (s === "proving") return "deposit_proving";
          if (s === "submitting") return "deposit_submitting";
          if (s === "confirming") return "deposit_confirming";
          return s as ProofStep;
        };
        const mapBuy = (s: string): ProofStep => {
          if (s === "witness") return "buy_witness";
          if (s === "proving") return "buy_proving";
          if (s === "submitting") return "buy_submitting";
          if (s === "confirming") return "buy_confirming";
          return s as ProofStep;
        };

        const hashDeposit = await simulateAndProve(
          aztecConfig.contracts.privateVault,
          "deposit_collateral",
          [new Fr(collateralAmount)],
          walletAddress,
          (s) => setStep(mapDeposit(s)),
        );

        const hashBuy = await simulateAndProve(
          aztecConfig.contracts.privateVault,
          "buy_shares",
          [
            new Fr(mid),
            new Fr(sideField),
            new Fr(collateralAmount),
            new Fr(minSharesOut),
            new Fr(pricePerShare),
          ],
          walletAddress,
          (s) => setStep(mapBuy(s)),
        );

        setTxHashes([hashDeposit as string, hashBuy as string]);
        setTxHash(null);
        setStep("confirmed");
      } catch (err) {
        setStep("failed");
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        clearInterval(timer);
      }
    },
    [simulateAndProve],
  );

  const cancel = useCallback(() => {
    cancelProof();
    setStep(null);
  }, [cancelProof]);

  const reset = useCallback(() => {
    setStep(null);
    setElapsed(0);
    setTxHash(null);
    setTxHashes(null);
    setError(null);
  }, []);

  return { step, elapsed, txHash, txHashes, error, execute, cancel, reset };
}
