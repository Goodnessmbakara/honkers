// ---------------------------------------------------------------------------
// useFaucet — testnet USDC faucet request with fair-use enforcement (FR-F-1)
// ---------------------------------------------------------------------------

import { useCallback, useState } from "react";
import { aztecConfig } from "../config/aztec";
import { usePXE } from "./usePXE";

const MAX_AMOUNT = 100; // testnet USDC
const COOLDOWN_KEY = "honkers:faucet-last";
const COOLDOWN_MS = 3600 * 1000; // 1 hour

export function useFaucet(walletAddress: string | null) {
  const { simulateAndProve } = usePXE();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const cooldownRemaining = (): number => {
    const last = Number(localStorage.getItem(COOLDOWN_KEY) ?? 0);
    const diff = COOLDOWN_MS - (Date.now() - last);
    return diff > 0 ? diff : 0;
  };

  const request = useCallback(
    async (amount: number) => {
      if (!walletAddress) throw new Error("Connect wallet first");
      if (amount <= 0 || amount > MAX_AMOUNT) throw new Error(`Amount must be 1–${MAX_AMOUNT}`);

      const remaining = cooldownRemaining();
      if (remaining > 0) {
        throw new Error(`Cooldown active. Try again in ${Math.ceil(remaining / 60000)} min.`);
      }

      setLoading(true);
      setError(null);
      setTxHash(null);

      try {
        const hash = await simulateAndProve(
          aztecConfig.contracts.testToken,
          "faucet",
          [amount * 1e6], // 6 decimal USDC
          walletAddress,
        );
        localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
        setTxHash(hash);
        return hash;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [walletAddress, simulateAndProve],
  );

  return { request, loading, error, txHash, cooldownRemaining, maxAmount: MAX_AMOUNT };
}
