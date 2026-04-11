// ---------------------------------------------------------------------------
// AztecProvider — initializes the in-browser PXE and exposes it via context
// ---------------------------------------------------------------------------

import { useEffect, useState, type ReactNode } from "react";
import { aztecConfig } from "../config/aztec";
import {
  AztecWalletCtx,
  getOrCreatePXE,
  type AztecWalletContext,
} from "../hooks/useAztecWallet";

export function AztecProvider({ children }: { children: ReactNode }) {
  const [ctx, setCtx] = useState<AztecWalletContext>({
    pxeInstance: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    // Warn early if cross-origin isolation is missing — SharedArrayBuffer
    // (required for Barretenberg WASM threading) will be unavailable.
    if (typeof window !== "undefined" && !window.crossOriginIsolated) {
      console.warn(
        "[AztecProvider] window.crossOriginIsolated is false — " +
          "SharedArrayBuffer unavailable. Check COOP/COEP headers."
      );
    }

    getOrCreatePXE(aztecConfig.pxeUrl)
      .then((instance) => {
        if (!cancelled)
          setCtx({ pxeInstance: instance, loading: false, error: null });
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[AztecProvider] Failed to create PXE:", msg);
        if (!cancelled)
          setCtx({ pxeInstance: null, loading: false, error: msg });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AztecWalletCtx.Provider value={ctx}>
      {children}
    </AztecWalletCtx.Provider>
  );
}
