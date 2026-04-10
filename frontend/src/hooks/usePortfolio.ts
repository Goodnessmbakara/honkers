// ---------------------------------------------------------------------------
// usePortfolio — private USDC balance + positions from PXE, auto-claim logic
// (FR-P-1 through FR-P-4)
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from "react";
import type { Position, WinningClaim } from "../types";
import { aztecConfig } from "../config/aztec";
import { usePXE } from "./usePXE";

export function usePortfolio(walletAddress: string | null) {
  const { getPrivateNotes, simulateAndProve } = usePXE();
  const [balance, setBalance] = useState<number>(0);
  const [positions, setPositions] = useState<Position[]>([]);
  const [winnings, setWinnings] = useState<WinningClaim[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      // Fetch collateral notes for USDC balance
      const collateralNotes = await getPrivateNotes(walletAddress, aztecConfig.contracts.privateVault);
      const totalBalance = (collateralNotes as Array<{ amount: number }>).reduce(
        (sum, n) => sum + (n.amount ?? 0),
        0,
      );
      setBalance(totalBalance);

      // Fetch share notes for positions
      const shareNotes = await getPrivateNotes(walletAddress, aztecConfig.contracts.amm);
      const pos: Position[] = (shareNotes as Array<{ market_id: number; side: number; amount: number; entry_price: number }>).map((n) => ({
        marketId: n.market_id,
        side: n.side === 1 ? "yes" : "no",
        amount: n.amount,
        entryPrice: n.entry_price,
      }));
      setPositions(pos);

      // Fetch winning notes
      const winNotes = await getPrivateNotes(walletAddress, aztecConfig.contracts.privateVault);
      const wins: WinningClaim[] = (winNotes as Array<{ market_id: number; amount: number; resolved_at: number }>)
        .filter((n) => n.resolved_at > 0)
        .map((n) => ({
          marketId: n.market_id,
          amount: n.amount,
          resolvedAt: n.resolved_at,
          claimed: false,
        }));
      setWinnings(wins);
    } catch (err) {
      console.error("[usePortfolio]", err);
    } finally {
      setLoading(false);
    }
  }, [walletAddress, getPrivateNotes]);

  useEffect(() => { refresh(); }, [refresh]);

  const claimWinnings = useCallback(
    async (marketId: number) => {
      if (!walletAddress) throw new Error("Not connected");
      return simulateAndProve(
        aztecConfig.contracts.privateVault,
        "claim_winnings",
        [marketId],
        walletAddress,
      );
    },
    [walletAddress, simulateAndProve],
  );

  return { balance, positions, winnings, loading, refresh, claimWinnings };
}
