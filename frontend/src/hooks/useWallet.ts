// ---------------------------------------------------------------------------
// useWallet — Aztec wallet connect/disconnect, address display, sync status
// (FR-W-1, FR-W-3)
//
// v4.1.3: Uses BrowserEmbeddedWallet running client-side.
// On "connect", checks for existing accounts in the local wallet.
// If none exist, creates a new Schnorr account and deploys it.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from "react";
import type { WalletState } from "../types";
import { useAztecWallet } from "./useAztecWallet";
import { Fr } from "@aztec/aztec.js/fields";

const STORAGE_KEY = "honkers:wallet-address";
const SECRET_KEY = "honkers:wallet-secret";

export function useWallet() {
  const { wallet, loading: walletLoading, error: walletError } = useAztecWallet();
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
    if (!wallet) throw new Error("Wallet not initialized yet");
    setState((s) => ({ ...s, syncing: true }));
    try {
      // Check for existing accounts in the local embedded wallet
      const accounts = await wallet.getAccounts();
      let address: string;

      if (accounts.length > 0) {
        address = accounts[0]!.item.toString();
      } else {
        // No accounts — create a new Schnorr account
        // Generate and persist a secret so the account survives page reloads
        let secret: Fr;
        const savedSecret = localStorage.getItem(SECRET_KEY);
        if (savedSecret) {
          secret = Fr.fromHexString(savedSecret);
        } else {
          secret = Fr.random();
          localStorage.setItem(SECRET_KEY, secret.toString());
        }

        const salt = Fr.random();
        const accountManager = await wallet.createSchnorrAccount(secret, salt);

        // Deploy the account contract on-chain
        if (await accountManager.hasInitializer()) {
          const deployMethod = await accountManager.getDeployMethod();
          await deployMethod.send({ from: accountManager.address });
        }

        address = accountManager.address.toString();
      }

      localStorage.setItem(STORAGE_KEY, address);
      setState({ connected: true, address, syncing: false });
    } catch (err) {
      console.error("[useWallet] connect failed:", err);
      setState({ connected: false, address: null, syncing: false });
      throw err;
    }
  }, [wallet]);

  const disconnect = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState({ connected: false, address: null, syncing: false });
  }, []);

  return { ...state, connect, disconnect, walletLoading, walletError };
}
