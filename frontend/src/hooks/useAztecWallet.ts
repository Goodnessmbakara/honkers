// ---------------------------------------------------------------------------
// useAztecWallet — Singleton BrowserEmbeddedWallet context for Aztec v4.1.3
//
// Creates a client-side embedded wallet that runs PXE in the browser.
// All contract interactions (simulate, prove, send) happen locally.
// ---------------------------------------------------------------------------

import { createContext, useContext } from "react";
import type { EmbeddedWallet } from "@aztec/wallets/embedded";

export interface AztecWalletContext {
  wallet: EmbeddedWallet | null;
  loading: boolean;
  error: string | null;
}

export const AztecWalletCtx = createContext<AztecWalletContext>({
  wallet: null,
  loading: true,
  error: null,
});

export function useAztecWallet() {
  return useContext(AztecWalletCtx);
}

let walletPromise: Promise<EmbeddedWallet> | null = null;

/**
 * Lazily initialize the BrowserEmbeddedWallet singleton.
 * Returns a cached promise so multiple callers share the same instance.
 */
export async function getOrCreateWallet(nodeUrl: string): Promise<EmbeddedWallet> {
  if (!walletPromise) {
    walletPromise = (async () => {
      const { EmbeddedWallet } = await import("@aztec/wallets/embedded");
      return EmbeddedWallet.create(nodeUrl, { ephemeral: false });
    })();
  }
  return walletPromise;
}
