// ---------------------------------------------------------------------------
// @honkers/aztec-connect/react — React context + hooks
// ---------------------------------------------------------------------------

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  getOrCreatePXE,
  connectAccount,
  type AztecInstance,
  type CreatePXEOptions,
  type ConnectOptions,
} from "../core";
import { Fr } from "@aztec/aztec.js/fields";
import {
  loadDecryptedSecretHex,
  migrateLegacyPlaintextIfPresent,
  persistEncryptedSecret,
} from "../utils/browserSecretVault";

// ── Context ─────────────────────────────────────────────────────────────────

interface AztecConnectState {
  instance: AztecInstance | null;
  loading: boolean;
  error: string | null;
}

const AztecConnectCtx = createContext<AztecConnectState>({
  instance: null,
  loading: true,
  error: null,
});

// ── Provider ────────────────────────────────────────────────────────────────

export interface AztecConnectProviderProps {
  /** JSON-RPC URL of the Aztec L2 node. Use "/rpc" with a Vite proxy. */
  nodeUrl: string;
  /** Optional PXE creation options */
  pxeOptions?: CreatePXEOptions;
  children: ReactNode;
}

/**
 * Initializes the in-browser PXE and provides it to all children via context.
 *
 * @example
 * ```tsx
 * import { AztecConnectProvider } from "@honkers/aztec-connect/react";
 *
 * function App() {
 *   return (
 *     <AztecConnectProvider nodeUrl="/rpc">
 *       <MyApp />
 *     </AztecConnectProvider>
 *   );
 * }
 * ```
 */
export function AztecConnectProvider({ nodeUrl, pxeOptions, children }: AztecConnectProviderProps) {
  const [state, setState] = useState<AztecConnectState>({
    instance: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    if (typeof window !== "undefined" && !window.crossOriginIsolated) {
      console.warn(
        "[aztec-connect] window.crossOriginIsolated is false — " +
        "SharedArrayBuffer unavailable. Check COOP/COEP headers.",
      );
    }

    getOrCreatePXE(nodeUrl, pxeOptions)
      .then((instance) => {
        if (!cancelled) setState({ instance, loading: false, error: null });
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[aztec-connect] PXE init failed:", msg);
        if (!cancelled) setState({ instance: null, loading: false, error: msg });
      });

    return () => { cancelled = true; };
  }, [nodeUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AztecConnectCtx.Provider value={state}>
      {children}
    </AztecConnectCtx.Provider>
  );
}

// ── Hooks ───────────────────────────────────────────────────────────────────

/** Access the PXE instance. Returns loading/error state while initializing. */
export function useAztecConnect() {
  return useContext(AztecConnectCtx);
}

// ── useAccount ──────────────────────────────────────────────────────────────

interface AccountState {
  connected: boolean;
  address: string | null;
  syncing: boolean;
}

const ADDR_KEY = "aztec-connect:address";

/**
 * Manage Schnorr account connection lifecycle.
 *
 * @example
 * ```tsx
 * import { useAccount } from "@honkers/aztec-connect/react";
 *
 * function WalletButton() {
 *   const { connected, address, syncing, connect, disconnect } = useAccount();
 *   if (syncing) return <span>Connecting…</span>;
 *   if (connected) return <button onClick={disconnect}>{address?.slice(0,10)}…</button>;
 *   return <button onClick={connect}>Connect</button>;
 * }
 * ```
 */
export function useAccount(opts?: ConnectOptions) {
  const { instance, loading, error } = useAztecConnect();
  const [state, setState] = useState<AccountState>({
    connected: false,
    address: null,
    syncing: false,
  });

  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });

  useEffect(() => {
    migrateLegacyPlaintextIfPresent().catch(() => {});
  }, []);

  // Restore previous session (view-only until connect() re-registers)
  useEffect(() => {
    const saved = localStorage.getItem(ADDR_KEY);
    if (saved) setState({ connected: true, address: saved, syncing: false });
  }, []);

  const connect = useCallback(async () => {
    if (!instance) {
      console.error("[aztec-connect] Cannot connect: PXE not initialized.");
      return;
    }
    setState((s) => ({ ...s, syncing: true }));

    try {
      let secret: Fr;
      const savedHex = await loadDecryptedSecretHex();
      if (savedHex) {
        secret = Fr.fromHexString(savedHex);
      } else {
        secret = Fr.random();
        await persistEncryptedSecret(secret.toString());
      }

      const result = await connectAccount(instance, secret, optsRef.current ?? {});

      localStorage.setItem(ADDR_KEY, result.address);
      setState({ connected: true, address: result.address, syncing: false });
    } catch (err) {
      console.error("[aztec-connect] connect failed:", err);
      setState({ connected: false, address: null, syncing: false });
      throw err;
    }
  }, [instance]);

  const disconnect = useCallback(() => {
    localStorage.removeItem(ADDR_KEY);
    setState({ connected: false, address: null, syncing: false });
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    /** True while PXE is initializing (before connect is possible) */
    pxeLoading: loading,
    /** PXE init error, if any */
    pxeError: error,
  };
}

export { AztecConnectCtx };
