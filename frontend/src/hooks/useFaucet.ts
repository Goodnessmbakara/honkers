// ---------------------------------------------------------------------------
// useFaucet — testnet USDh faucet request with fair-use enforcement (FR-F-1)
// ---------------------------------------------------------------------------

import { useCallback, useState } from "react";
import { aztecConfig } from "../config/aztec";
import { usePXE } from "./usePXE";

const MAX_AMOUNT = 10000; // testnet USDh
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
      setError(null);
      setTxHash(null);

      if (!walletAddress) {
        setError("Connect your wallet first.");
        return;
      }
      if (amount <= 0 || amount > MAX_AMOUNT) {
        setError(`Amount must be 1–${MAX_AMOUNT}`);
        return;
      }

      const remaining = cooldownRemaining();
      if (remaining > 0) {
        setError(`Cooldown active. Try again in ${Math.ceil(remaining / 60000)} min.`);
        return;
      }

      setLoading(true);

      try {
        const hash = await simulateAndProve(
          aztecConfig.contracts.usdh,
          "faucet",
          [BigInt(Math.floor(amount * 1e6))],
          walletAddress,
        );
        localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
        setTxHash(hash as string);
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
