// ---------------------------------------------------------------------------
// useTrade — trade execution, local proof generation, tx submission
// (FR-T-1 through FR-T-5)
//
// Flow: deposit_collateral(amount) → buy_shares(..., shares_out, price_per_share).
// Price and min shares follow AMM utility functions (SCALE = 1e6).
// ---------------------------------------------------------------------------

import { useCallback, useState } from "react";
import type { ProofStep, TradeParams } from "../types";
import { aztecConfig } from "../config/aztec";
import { usePXE } from "./usePXE";
import { Fr } from "@aztec/aztec.js/fields";

const SCALE = 1_000_000n;

function fieldLikeToBigInt(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(Math.trunc(v));
  if (v != null && typeof (v as { toBigInt?: () => bigint }).toBigInt === "function") {
    return (v as { toBigInt: () => bigint }).toBigInt();
  }
  throw new Error("Unexpected field value from simulate");
}

export function useTrade() {
  const { simulateAndProve, simulateView, cancelProof } = usePXE();
  const [step, setStep] = useState<ProofStep | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (params: TradeParams, walletAddress: string) => {
      setStep(null);
      setElapsed(0);
      setTxHash(null);
      setError(null);

      const t0 = Date.now();
      const timer = setInterval(() => setElapsed(Date.now() - t0), 500);

      try {
        const amm = aztecConfig.contracts.amm;
        if (!amm) throw new Error("AMM address not configured");

        const priceFn = params.side === "yes" ? "get_price_yes" : "get_price_no";
        const priceRaw = await simulateView(amm, priceFn, [params.marketId]);
        const pricePerShare = fieldLikeToBigInt(priceRaw);
        if (pricePerShare === 0n) throw new Error("AMM price is zero (market not initialized?)");

        const collateralAmount = BigInt(params.amount);
        const expectedShares = (collateralAmount * SCALE) / pricePerShare;
        const bps = BigInt(Math.min(10_000, Math.max(0, params.maxSlippage)));
        const minSharesOut = (expectedShares * (10_000n - bps)) / 10_000n;
        if (minSharesOut === 0n) throw new Error("Trade size too small after slippage");

        const sideField = params.side === "yes" ? 1 : 0;

        const onStep = (s: string) => setStep(s as ProofStep);

        const hashDeposit = await simulateAndProve(
          aztecConfig.contracts.privateVault,
          "deposit_collateral",
          [new Fr(collateralAmount)],
          walletAddress,
          onStep,
        );

        const hashBuy = await simulateAndProve(
          aztecConfig.contracts.privateVault,
          "buy_shares",
          [
            new Fr(params.marketId),
            new Fr(sideField),
            new Fr(collateralAmount),
            new Fr(minSharesOut),
            new Fr(pricePerShare),
          ],
          walletAddress,
          onStep,
        );

        setTxHash(`${hashDeposit},${hashBuy}`);
        setStep("confirmed");
      } catch (err) {
        setStep("failed");
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        clearInterval(timer);
      }
    },
    [simulateAndProve, simulateView],
  );

  const cancel = useCallback(() => {
    cancelProof();
    setStep(null);
  }, [cancelProof]);

  const reset = useCallback(() => {
    setStep(null);
    setElapsed(0);
    setTxHash(null);
    setError(null);
  }, []);

  return { step, elapsed, txHash, error, execute, cancel, reset };
}
