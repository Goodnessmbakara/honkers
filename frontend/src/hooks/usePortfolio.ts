// ---------------------------------------------------------------------------
// usePortfolio — USDh public balance + private positions from PXE
// (FR-P-1 through FR-P-4)
//
// USDh balance is PUBLIC storage — read via balance_of utility call.
// PrivateVault PrivateSet storage slots (codegen): collateral=8, shares=9, winnings=10.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from "react";
import type { Position, WinningClaim } from "../types";
import { aztecConfig } from "../config/aztec";
import { usePXE } from "./usePXE";
import { Fr } from "@aztec/aztec.js/fields";

const USDH_BALANCES_SLOT = 9n; // balances: Map<AztecAddress, PublicMutable<Field>> base slot (verified on-chain)
const ZERO_HEX = "0x0000000000000000000000000000000000000000000000000000000000000000";

/** Read USDh public balance directly from chain storage — no wallet needed. */
async function fetchPublicBalance(ownerAddress: string): Promise<number> {
  const usdhAddr = aztecConfig.contracts.usdh;
  if (!usdhAddr || !ownerAddress) return 0;
  try {
    const { deriveStorageSlotInMap } = await import("@aztec/stdlib/hash");
    const { Fr } = await import("@aztec/aztec.js/fields");
    const { AztecAddress } = await import("@aztec/aztec.js/addresses");
    const ownerField = AztecAddress.fromString(ownerAddress).toField();
    const slot = await deriveStorageSlotInMap(new Fr(USDH_BALANCES_SLOT), { toField: () => ownerField });

    const res = await fetch(aztecConfig.pxeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "node_getPublicStorageAt",
        params: ["latest", usdhAddr, slot.toString()],
      }),
    });
    const json = (await res.json()) as { result?: string };
    const raw = json.result;
    if (!raw || raw === ZERO_HEX || raw === "0x0") return 0;
    return Number(BigInt(raw));
  } catch {
    return 0;
  }
}

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
      // USDh is a public token — read balance from chain storage directly
      const publicBalance = await fetchPublicBalance(walletAddress);
      // Also check collateral notes in PrivateVault (deposited-but-not-traded funds)
      const collateralNotes = await getPrivateNotes(walletAddress, vault, VAULT_COLLATERAL_SLOT);
      const vaultBalance = collateralNotes.reduce((sum, n) => sum + Number(n.items[0] ?? 0n), 0);
      setBalance(publicBalance + vaultBalance);

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
