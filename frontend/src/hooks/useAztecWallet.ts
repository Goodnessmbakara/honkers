// ---------------------------------------------------------------------------
// useAztecWallet — compatibility shim for consumers that previously
// destructured pxeInstance from this hook.
//
// The embedded PXE singleton has been replaced by the official
// @aztec/wallet-sdk WalletManager extension discovery protocol.
// New code should use useWalletContext() directly.
// ---------------------------------------------------------------------------

import { useWalletContext } from "../contexts/WalletContext";

export function useAztecWallet() {
  const { wallet, aztecNode, walletError } = useWalletContext();
  return {
    // Legacy shape — pxeInstance.wallet and pxeInstance.aztecNode
    pxeInstance: wallet && aztecNode
      ? { wallet, aztecNode, pxe: wallet as never }
      : null,
    loading: false,
    error: walletError,
  };
}

// Kept for any external consumers that imported this
export type { AztecNode } from "@aztec/aztec.js/node";
