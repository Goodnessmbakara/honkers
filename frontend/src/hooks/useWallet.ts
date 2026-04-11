// ---------------------------------------------------------------------------
// useWallet — Aztec wallet connect/disconnect, address display, sync status
// (FR-W-1, FR-W-3)
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from "react";
import type { WalletState } from "../types";
import { aztecConfig } from "../config/aztec";

const STORAGE_KEY = "honkers:wallet-address";

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    connected: false,
    address: null,
    syncing: false,
  });

  // Restore previous session
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setState({ connected: true, address: saved, syncing: false });
    }
  }, []);

  const connect = useCallback(async () => {
    setState((s) => ({ ...s, syncing: true }));
    try {
      const res = await fetch(aztecConfig.pxeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "node_getAccounts",
          params: [],
        }),
      });
      const json = await res.json();
      const accounts: string[] = json.result ?? [];
      if (accounts.length === 0) {
        throw new Error("No accounts registered in PXE. Create an account first.");
      }
      const address = accounts[0];
      localStorage.setItem(STORAGE_KEY, address);
      setState({ connected: true, address, syncing: false });
    } catch (err) {
      console.error("[useWallet] connect failed:", err);
      setState({ connected: false, address: null, syncing: false });
      throw err;
    }
  }, []);

  const disconnect = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState({ connected: false, address: null, syncing: false });
  }, []);

  return { ...state, connect, disconnect };
}
