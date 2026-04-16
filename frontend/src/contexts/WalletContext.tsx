// ---------------------------------------------------------------------------
// WalletContext — Global wallet state provider
//
// Centralizes wallet connection state so it's computed once and shared across
// all components via context, instead of each component independently calling
// useWallet() and deriving its own state.
// ---------------------------------------------------------------------------

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { WalletState } from "../types";
import { useAztecWallet, resetPXEState } from "../hooks/useAztecWallet";
import { Fr } from "@aztec/aztec.js/fields";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { AccountManager } from "@aztec/aztec.js/wallet";
import { SchnorrAccountContract } from "@aztec/accounts/schnorr";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee";
import { deriveSigningKey } from "@aztec/stdlib/keys";
import { getContractInstanceFromInstantiationParams } from "@aztec/stdlib/contract";

const STORAGE_KEY = "honkers:wallet-address";
const SECRET_KEY = "honkers:wallet-secret";

/** Detect stale PXE errors that require IndexedDB reset */
function isStaleNoteError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("Failed to get a note") ||
    msg.includes("Block hash not found") ||
    msg.includes("self.is_some()")
  );
}

interface WalletContextValue extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
  walletLoading: boolean;
  walletError: string | null;
}

const WalletCtx = createContext<WalletContextValue>({
  connected: false,
  address: null,
  syncing: false,
  connect: async () => {},
  disconnect: () => {},
  walletLoading: false,
  walletError: null,
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const { pxeInstance, loading: walletLoading, error: walletError } = useAztecWallet();
  const [state, setState] = useState<WalletState>({
    connected: false,
    address: null,
    syncing: false,
  });

  const connectingRef = useRef(false);

  const connect = useCallback(async () => {
    if (!pxeInstance) {
      console.error("[WalletProvider] Cannot connect: PXE not initialized.");
      return;
    }

    const { wallet: minimalWallet } = pxeInstance;
    setState((s) => ({ ...s, syncing: true }));

    try {
      let secret: Fr;
      const savedSecret = localStorage.getItem(SECRET_KEY);
      if (savedSecret) {
        secret = Fr.fromHexString(savedSecret);
      } else {
        secret = Fr.random();
        localStorage.setItem(SECRET_KEY, secret.toString());
      }

      const signingKey = deriveSigningKey(secret);
      const accountContract = new SchnorrAccountContract(signingKey);
      const salt = Fr.ZERO;

      const accountManager = await AccountManager.create(
        minimalWallet,
        secret,
        accountContract,
        salt,
      );

      const account = await accountManager.getAccount();
      const instance = accountManager.getInstance();
      const artifact = await accountManager.getAccountContract().getContractArtifact();

      console.log(`[WalletProvider] Registering account ${account.getAddress()}...`);
      await minimalWallet.registerContract(instance, artifact, accountManager.getSecretKey());
      minimalWallet.addAccount(account);

      if (await accountManager.hasInitializer()) {
        try {
          console.log("[WalletProvider] Deploying account contract...");

          // Set up Sponsored FPC — pays fees unconditionally on sandbox/devnet.
          // The SponsoredFPC is a canonical contract deployed at a deterministic
          // address derived from its artifact + salt=0.
          const { SponsoredFPCContractArtifact } = await import("@aztec/noir-contracts.js/SponsoredFPC");
          const sponsoredFPCInstance = await getContractInstanceFromInstantiationParams(
            SponsoredFPCContractArtifact,
            { salt: Fr.ZERO },
          );
          await minimalWallet.registerContract(sponsoredFPCInstance, SponsoredFPCContractArtifact);
          const paymentMethod = new SponsoredFeePaymentMethod(sponsoredFPCInstance.address);
          console.log(`[WalletProvider] Sponsored FPC registered @ ${sponsoredFPCInstance.address}`);

          const deployMethod = await accountManager.getDeployMethod();
          // Use AztecAddress.ZERO (self-deployment mode) so the constructor runs
          // BEFORE the entrypoint, and pass the Sponsored FPC as fee payer so the
          // new account doesn't need pre-existing Fee Juice balance.
          await deployMethod.send({
            from: AztecAddress.ZERO,
            fee: { paymentMethod },
          });
          console.log("[WalletProvider] Account contract deployed.");
        } catch (deployErr: unknown) {
          const msg = deployErr instanceof Error ? deployErr.message : String(deployErr);
          if (msg.includes("already deployed") || msg.includes("DUPLICATE_NULLIFIER") || msg.includes("exists")) {
            console.log("[WalletProvider] Account contract already deployed, skipping.");
          } else {
            throw deployErr;
          }
        }
      }

      const address = account.getAddress().toString();
      localStorage.setItem(STORAGE_KEY, address);
      setState({ connected: true, address, syncing: false });
      console.log(`[WalletProvider] Connected: ${address}`);
    } catch (err) {
      // Auto-recover from stale IndexedDB errors: clear data and reload ONCE.
      // Use a sessionStorage flag to prevent infinite reload loops.
      if (isStaleNoteError(err) && !sessionStorage.getItem("honkers:recovery-attempted")) {
        console.warn("[WalletProvider] Stale PXE data detected. Clearing IndexedDB and reloading...");
        sessionStorage.setItem("honkers:recovery-attempted", "1");
        await resetPXEState();
        setState({ connected: false, address: null, syncing: false });
        window.location.reload();
        return;
      }
      // Clear recovery flag on non-stale errors or after retry
      sessionStorage.removeItem("honkers:recovery-attempted");
      console.error("[WalletProvider] connect failed:", err);
      setState({ connected: false, address: null, syncing: false });
    }
  }, [pxeInstance]);

  const disconnect = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState({ connected: false, address: null, syncing: false });
  }, []);

  // Auto-reconnect on PXE ready
  useEffect(() => {
    const savedSecret = localStorage.getItem(SECRET_KEY);
    const savedAddress = localStorage.getItem(STORAGE_KEY);
    if (savedSecret && savedAddress && pxeInstance && !state.syncing && !connectingRef.current) {
      connectingRef.current = true;
      setState((s) => (s.address === savedAddress ? s : { connected: true, address: savedAddress, syncing: true }));
      connect()
        .catch((err) => {
          console.error("[WalletProvider] Auto-reconnect failed:", err);
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(SECRET_KEY);
          setState({ connected: false, address: null, syncing: false });
        })
        .finally(() => { connectingRef.current = false; });
    } else if (savedAddress && !pxeInstance) {
      setState((s) => (s.address === savedAddress ? s : { connected: true, address: savedAddress, syncing: false }));
    }
  }, [pxeInstance]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <WalletCtx.Provider value={{ ...state, connect, disconnect, walletLoading, walletError }}>
      {children}
    </WalletCtx.Provider>
  );
}

export function useWalletContext() {
  return useContext(WalletCtx);
}
