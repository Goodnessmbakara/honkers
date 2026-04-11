// ---------------------------------------------------------------------------
// useWallet — Aztec wallet connect/disconnect, address display, sync status
//
// v4.1.3: Uses the modern AccountManager + SchnorrAccount pattern.
// Connects to the in-browser PXE and creates/loads a Schnorr account.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from "react";
import type { WalletState } from "../types";
import { useAztecWallet } from "./useAztecWallet";
import { Fr } from "@aztec/aztec.js/fields";
import { AccountManager } from "@aztec/aztec.js/wallet";
import { SchnorrAccountContract } from "@aztec/accounts/schnorr";
import { deriveSigningKey } from "@aztec/stdlib/keys";

const STORAGE_KEY = "honkers:wallet-address";
const SECRET_KEY = "honkers:wallet-secret";

export function useWallet() {
  const { pxeInstance, loading: walletLoading, error: walletError } = useAztecWallet();
  const [state, setState] = useState<WalletState>({
    connected: false,
    address: null,
    syncing: false,
  });

  // Restore previous session view-only state (until connect is called)
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setState({ connected: true, address: saved, syncing: false });
    }
  }, []);

  const connect = useCallback(async () => {
    if (!pxeInstance) {
      console.error("[useWallet] Cannot connect: PXE not initialized.");
      return;
    }

    const { pxe, wallet: minimalWallet } = pxeInstance;
    setState((s) => ({ ...s, syncing: true }));

    try {
      // 1. Get or generate the account secret
      let secret: Fr;
      const savedSecret = localStorage.getItem(SECRET_KEY);
      if (savedSecret) {
        secret = Fr.fromHexString(savedSecret);
      } else {
        secret = Fr.random();
        localStorage.setItem(SECRET_KEY, secret.toString());
      }

      // 2. Setup Schnorr Account
      // In Aztec v4, we use AccountManager to coordinate the account contract deployment & registration.
      const signingKey = deriveSigningKey(secret);
      const accountContract = new SchnorrAccountContract(signingKey);
      
      // Use a fixed salt for now (or random if we want multiple accounts per secret)
      const salt = Fr.ZERO; 
      
      const accountManager = await AccountManager.create(
        minimalWallet,
        secret,
        accountContract,
        salt
      );

      // 3. Register the account with the PXE/Wallet
      // This is necessary so the PXE knows to start tracking notes for this address.
      const account = await accountManager.getAccount();
      const instance = accountManager.getInstance();
      const artifact = await accountManager.getAccountContract().getContractArtifact();
      
      console.log(`[useWallet] Registering account ${account.getAddress()}...`);
      await minimalWallet.registerContract(instance, artifact, accountManager.getSecretKey());
      minimalWallet.addAccount(account);

      // 4. Deploy the account contract if needed
      // For the dev sandbox, we usually need to deploy the contract if it hasn't been used before.
      if (await accountManager.hasInitializer()) {
        const isDeployed = await pxe.getContractInstance(account.getAddress());
        if (!isDeployed) {
          console.log("[useWallet] Deploying account contract...");
          const deployMethod = await accountManager.getDeployMethod();
          await deployMethod.send().wait();
          console.log("[useWallet] Account contract deployed.");
        }
      }

      const address = account.getAddress().toString();
      localStorage.setItem(STORAGE_KEY, address);
      setState({ connected: true, address, syncing: false });
      
      console.log(`[useWallet] Connected: ${address}`);
    } catch (err) {
      console.error("[useWallet] connect failed:", err);
      setState({ connected: false, address: null, syncing: false });
      throw err;
    }
  }, [pxeInstance]);

  const disconnect = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState({ connected: false, address: null, syncing: false });
  }, []);

  return { ...state, connect, disconnect, walletLoading, walletError };
}
