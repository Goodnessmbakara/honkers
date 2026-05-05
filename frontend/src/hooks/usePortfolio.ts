// ---------------------------------------------------------------------------
// usePortfolio — private USDC balance + positions from PXE, auto-claim logic
// (FR-P-1 through FR-P-4)
//
// PrivateVault PrivateSet storage slots (codegen): collateral=8, shares=9, winnings=10.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from "react";
import type { Position, WinningClaim } from "../types";
import { aztecConfig } from "../config/aztec";
import { usePXE } from "./usePXE";
import { Fr } from "@aztec/aztec.js/fields";

const VAULT_COLLATERAL_SLOT = 8;
const VAULT_SHARES_SLOT = 9;
const VAULT_WINNINGS_SLOT = 10;

export function usePortfolio(walletAddress: string | null) {
  const { getPrivateNotes, simulateAndProve } = usePXE();
  const [balance, setBalance] = useState<number>(0);
  const [positions, setPositions] = useState<Position[]>([]);
  const [winnings, setWinnings] = useState<WinningClaim[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!walletAddress) return;
    const vault = aztecConfig.contracts.privateVault;
    if (!vault) return;

    setLoading(true);
    try {
      const collateralNotes = await getPrivateNotes(walletAddress, vault, VAULT_COLLATERAL_SLOT);
      const totalBalance = collateralNotes.reduce((sum, n) => sum + Number(n.items[0] ?? 0n), 0);
      setBalance(totalBalance);

      const shareNotes = await getPrivateNotes(walletAddress, vault, VAULT_SHARES_SLOT);
      const pos: Position[] = shareNotes
        .filter((n) => n.items.length >= 4)
        .map((n) => ({
          marketId: Number(n.items[0]),
          side: n.items[1] === 1n ? "yes" : "no",
          amount: Number(n.items[2]),
          entryPrice: Number(n.items[3]),
        }));
      setPositions(pos);

      const winNotes = await getPrivateNotes(walletAddress, vault, VAULT_WINNINGS_SLOT);
      const wins: WinningClaim[] = winNotes
        .filter((n) => n.items.length >= 3 && (n.items[2] ?? 0n) > 0n)
        .map((n) => ({
          marketId: Number(n.items[0]),
          amount: Number(n.items[1]),
          resolvedAt: Number(n.items[2]),
          claimed: false,
        }));
      setWinnings(wins);
    } catch (err) {
      console.error("[usePortfolio]", err);
    } finally {
      setLoading(false);
    }
  }, [walletAddress, getPrivateNotes]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const claimWinnings = useCallback(
    async (marketId: number) => {
      if (!walletAddress) throw new Error("Not connected");
      return simulateAndProve(
        aztecConfig.contracts.privateVault,
        "claim_winnings",
        [new Fr(marketId)],
        walletAddress,
      );
    },
    [walletAddress, simulateAndProve],
  );

  return { balance, positions, winnings, loading, refresh, claimWinnings };
}
