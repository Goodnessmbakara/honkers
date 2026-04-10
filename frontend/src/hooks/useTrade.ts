// ---------------------------------------------------------------------------
// useTrade — trade execution, local proof generation, tx submission
// (FR-T-1 through FR-T-5)
// ---------------------------------------------------------------------------

import { useCallback, useState } from "react";
import type { ProofStep, TradeParams } from "../types";
import { aztecConfig } from "../config/aztec";
import { usePXE } from "./usePXE";

export function useTrade() {
  const { simulateAndProve, cancelProof } = usePXE();
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
        const hash = await simulateAndProve(
          aztecConfig.contracts.privateVault,
          "buy_shares",
          [params.marketId, params.side === "yes" ? 1 : 0, params.amount, params.maxSlippage],
          walletAddress,
          (s) => setStep(s as ProofStep),
        );
        setTxHash(hash);
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
    setError(null);
  }, []);

  return { step, elapsed, txHash, error, execute, cancel, reset };
}
