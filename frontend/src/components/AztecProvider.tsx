// ---------------------------------------------------------------------------
// AztecProvider — initializes the BrowserEmbeddedWallet and provides it via context
// ---------------------------------------------------------------------------

import { useEffect, useState, type ReactNode } from "react";
import { aztecConfig } from "../config/aztec";
import {
  AztecWalletCtx,
  getOrCreateWallet,
  type AztecWalletContext,
} from "../hooks/useAztecWallet";
import type { EmbeddedWallet } from "@aztec/wallets/embedded";

export function AztecProvider({ children }: { children: ReactNode }) {
  const [ctx, setCtx] = useState<AztecWalletContext>({
    wallet: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    getOrCreateWallet(aztecConfig.pxeUrl)
      .then((w: EmbeddedWallet) => {
        if (!cancelled) setCtx({ wallet: w, loading: false, error: null });
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[AztecProvider] Failed to create wallet:", msg);
        if (!cancelled) setCtx({ wallet: null, loading: false, error: msg });
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <AztecWalletCtx.Provider value={ctx}>
      {children}
    </AztecWalletCtx.Provider>
  );
}
