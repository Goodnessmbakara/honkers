// ---------------------------------------------------------------------------
// WalletContext — Multi-wallet provider using @aztec/wallet-sdk WalletManager.
//
// Replaces the embedded in-browser PXE approach with the official Aztec
// extension-wallet discovery protocol. Any compliant Aztec wallet extension
// (Azguard, Obsidion, …) is discovered automatically.
//
// Connection flow:
//   1. User clicks "Connect Wallet" → openPicker()
//   2. WalletManager broadcasts discovery message → extensions respond
//   3. User picks a wallet from the modal → connectToProvider(provider)
//   4. ECDH key exchange → encrypted channel → wallet.getAccounts()[0]
//   5. wallet satisfies the full Aztec.js Wallet interface
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
import type { Wallet } from "@aztec/aztec.js/wallet";
import type { AztecNode } from "@aztec/aztec.js/node";
import { WalletManager, type WalletProvider } from "@aztec/wallet-sdk/manager";
import { Fr } from "@aztec/aztec.js/fields";
import { aztecConfig } from "../config/aztec";
import type { WalletConnectStage, WalletConnectTimelineEntry, WalletState } from "../types";
import { getOrCreateEmbeddedPXE, resetEmbeddedPXEState } from "../utils/embeddedPXE";
import { loadDecryptedSecretHex, persistEncryptedSecret } from "../utils/browserSecretVault";
import { AzguardWallet, asWallet } from "../utils/azguardWallet";

// ---------------------------------------------------------------------------
// Lazy singleton Aztec node (thin JSON-RPC client, no PXE)
// ---------------------------------------------------------------------------
let _aztecNode: AztecNode | null = null;

async function getAztecNode(): Promise<AztecNode> {
  if (_aztecNode) return _aztecNode;
  const { createAztecNodeClient } = await import("@aztec/aztec.js/node");
  _aztecNode = createAztecNodeClient(aztecConfig.pxeUrl);
  return _aztecNode;
}

// ---------------------------------------------------------------------------
// Wallet manager singleton
// ---------------------------------------------------------------------------
const walletManager = WalletManager.configure({ extensions: { enabled: true } });

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------
const STORAGE_KEY = "honkers:wallet-address";
const WALLET_TYPE_KEY = "honkers:wallet-type"; // "azguard" | "embedded" | "sdk:<providerName>"
const CONNECT_TIMELINE_KEY = "honkers:connect-timeline";
const CONNECT_TIMELINE_LIMIT = 40;

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------
interface WalletContextValue extends WalletState {
  wallet: Wallet | null;
  aztecNode: AztecNode | null;
  walletError: string | null;
  connectStage: WalletConnectStage;
  connectDetail: string | null;
  connectTimeline: WalletConnectTimelineEntry[];
  clearConnectTimeline: () => void;

  // Picker
  pickerOpen: boolean;
  openPicker: () => void;
  closePicker: () => void;
  discoveredProviders: WalletProvider[];
  discoverStatus: "idle" | "discovering" | "done";
  connectToProvider: (provider: WalletProvider) => Promise<void>;
  connectWithEmbeddedPXE: () => Promise<void>;

  // Wallet type — "azguard" | "embedded" | "sdk:..." | null
  walletType: string | null;

  // Legacy compat
  connect: () => Promise<void>;
  disconnect: () => void;
  walletLoading: boolean;
}

const WalletCtx = createContext<WalletContextValue>({
  connected: false,
  address: null,
  syncing: false,
  wallet: null,
  aztecNode: null,
  walletError: null,
  connectStage: "idle",
  connectDetail: null,
  connectTimeline: [],
  clearConnectTimeline: () => {},
  pickerOpen: false,
  openPicker: () => {},
  closePicker: () => {},
  discoveredProviders: [],
  discoverStatus: "idle",
  connectToProvider: async () => {},
  connectWithEmbeddedPXE: async () => {},
  walletType: null,
  connect: async () => {},
  disconnect: () => {},
  walletLoading: false,
});

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>({
    connected: false,
    address: null,
    syncing: false,
  });
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [aztecNode, setAztecNode] = useState<AztecNode | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<string | null>(() => localStorage.getItem(WALLET_TYPE_KEY));

  // Picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [discoveredProviders, setDiscoveredProviders] = useState<WalletProvider[]>([]);
  const [discoverStatus, setDiscoverStatus] = useState<"idle" | "discovering" | "done">("idle");
  const discoveryRef = useRef<{ cancel: () => void } | null>(null);
  const activeProviderRef = useRef<WalletProvider | null>(null);

  // Timeline
  const [connectStage, setConnectStage] = useState<WalletConnectStage>("idle");
  const [connectDetail, setConnectDetail] = useState<string | null>(null);
  const [connectTimeline, setConnectTimeline] = useState<WalletConnectTimelineEntry[]>(() => {
    try {
      const raw = localStorage.getItem(CONNECT_TIMELINE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as WalletConnectTimelineEntry[];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  });

  const pushTimeline = useCallback((stage: WalletConnectStage, detail: string | null) => {
    const entry: WalletConnectTimelineEntry = { at: new Date().toISOString(), stage, detail };
    setConnectTimeline((prev) => {
      const next = [...prev, entry].slice(-CONNECT_TIMELINE_LIMIT);
      localStorage.setItem(CONNECT_TIMELINE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const setStatus = useCallback(
    (stage: WalletConnectStage, detail: string | null) => {
      setConnectStage(stage);
      setConnectDetail(detail);
      pushTimeline(stage, detail);
    },
    [pushTimeline],
  );

  // ---------------------------------------------------------------------------
  // Discovery — start when picker opens, cancel when it closes
  // ---------------------------------------------------------------------------
  const startDiscovery = useCallback(async () => {
    setDiscoveredProviders([]);
    setDiscoverStatus("discovering");

    let chainInfo;
    try {
      const node = await getAztecNode();
      const nodeInfo = await node.getNodeInfo();
      chainInfo = {
        chainId: new Fr(BigInt(nodeInfo.l1ChainId)),
        version: new Fr(BigInt(nodeInfo.rollupVersion)),
      };
    } catch {
      // Fall back to env-based chain info if node unreachable
      const envChainId = aztecConfig.envMode === "testnet" ? 11155111 : 31337;
      chainInfo = { chainId: new Fr(BigInt(envChainId)), version: new Fr(1n) };
    }

    const session = walletManager.getAvailableWallets({
      chainInfo,
      appId: "honkers-dapp",
      timeout: 20_000, // 20 seconds — enough for user to switch to extension
      onWalletDiscovered: (provider) => {
        setDiscoveredProviders((prev) =>
          prev.some((p) => p.id === provider.id) ? prev : [...prev, provider]
        );
      },
    });

    discoveryRef.current = session;

    session.done.then(() => {
      setDiscoverStatus("done");
      discoveryRef.current = null;
    });
  }, []);

  const openPicker = useCallback(() => {
    setPickerOpen(true);
    setWalletError(null);
    startDiscovery();
  }, [startDiscovery]);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    discoveryRef.current?.cancel();
    discoveryRef.current = null;
    setDiscoverStatus("idle");
    setDiscoveredProviders([]);
  }, []);

  // Close picker automatically when wallet connects
  useEffect(() => {
    if (state.connected) {
      setPickerOpen(false);
      setDiscoverStatus("idle");
      discoveryRef.current?.cancel();
      discoveryRef.current = null;
    }
  }, [state.connected]);

  // ---------------------------------------------------------------------------
  // Connect via embedded in-browser PXE (no extension required)
  // ---------------------------------------------------------------------------
  const connectWithEmbeddedPXE = useCallback(async () => {
    setState((s) => ({ ...s, syncing: true }));
    setStatus("creating_account", "Starting in-browser PXE…");
    setWalletError(null);

    try {
      const { wallet: minimalWallet, aztecNode: node } = await getOrCreateEmbeddedPXE(aztecConfig.pxeUrl);

      setStatus("registering_account", "Setting up account…");

      const { Fr: FrCls } = await import("@aztec/aztec.js/fields");
      const { AccountManager } = await import("@aztec/aztec.js/wallet");
      const { SchnorrAccountContract } = await import("@aztec/accounts/schnorr");
      const { deriveSigningKey } = await import("@aztec/stdlib/keys");

      let secretHex = await loadDecryptedSecretHex();
      let secret: typeof FrCls.prototype;
      if (secretHex) {
        secret = FrCls.fromHexString(secretHex);
      } else {
        secret = FrCls.random();
        secretHex = secret.toString();
        await persistEncryptedSecret(secretHex);
      }

      const signingKey = deriveSigningKey(secret);
      const accountContract = new SchnorrAccountContract(signingKey);
      const accountManager = await AccountManager.create(minimalWallet, secret, accountContract, FrCls.ZERO);
      const account = await accountManager.getAccount();
      const instance = accountManager.getInstance();
      const artifact = await accountManager.getAccountContract().getContractArtifact();

      await (minimalWallet as unknown as { registerContract: (...a: unknown[]) => Promise<void> }).registerContract(
        instance, artifact, accountManager.getSecretKey()
      );
      minimalWallet.addAccount(account);

      if (await accountManager.hasInitializer()) {
        setStatus("checking_deployment", "Deploying account contract…");
        try {
          const { SponsoredFPCContractArtifact } = await import("@aztec/noir-contracts.js/SponsoredFPC");
          const { getContractInstanceFromInstantiationParams } = await import("@aztec/stdlib/contract");
          const { SponsoredFeePaymentMethod } = await import("@aztec/aztec.js/fee");
          const fpcInstance = await getContractInstanceFromInstantiationParams(SponsoredFPCContractArtifact, { salt: FrCls.ZERO });
          await (minimalWallet as unknown as { registerContract: (...a: unknown[]) => Promise<void> }).registerContract(fpcInstance, SponsoredFPCContractArtifact);
          const paymentMethod = new SponsoredFeePaymentMethod(fpcInstance.address);
          const deployMethod = await accountManager.getDeployMethod();
          await deployMethod.send({ from: instance.address, fee: { paymentMethod } });
          console.log("[WalletContext] Account contract deployed.");
        } catch (deployErr) {
          const msg = deployErr instanceof Error ? deployErr.message : String(deployErr);
          // "self.is_some()" / "Failed to get a note" means the contract is already
          // deployed but the fresh PXE hasn't synced the signing key note yet —
          // treat this the same as "already deployed" and continue.
          const isAlreadyDeployed =
            msg.includes("already deployed") ||
            msg.includes("DUPLICATE_NULLIFIER") ||
            msg.includes("exists");
          // "self.is_some" / "Failed to get a note" during deployment means the account
          // secret is wrong — a new random secret was generated for an address that was
          // never deployed. Reset everything and retry with a clean slate.
          const isBadSecret =
            msg.includes("self.is_some") ||
            msg.includes("Failed to get a note");
          if (isBadSecret) {
            await resetEmbeddedPXEState();
            throw new Error("Account data was corrupt — storage has been cleared. Please reconnect.");
          }
          if (!isAlreadyDeployed) {
            throw deployErr;
          }
        }
      }

      const address = account.getAddress().toString();
      localStorage.setItem(STORAGE_KEY, address);
      localStorage.setItem(WALLET_TYPE_KEY, "embedded");
      setWalletType("embedded");
      setAztecNode(node);
      setWallet(minimalWallet as unknown as Wallet);
      setStatus("connected", "Connected via Browser PXE");
      setState({ connected: true, address, syncing: false });
      console.log(`[WalletContext] Browser PXE connected: ${address}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Auto-recover from stale IndexedDB on first attempt
      const isStale = (
        (msg.toLowerCase().includes("block hash") && msg.toLowerCase().includes("not found")) ||
        msg.toLowerCase().includes("existing nullifier") ||
        msg.toLowerCase().includes("invalid proof") ||
        msg.toLowerCase().includes("nullifier") ||
        msg.toLowerCase().includes("stale")
      );
      if (isStale && !sessionStorage.getItem("honkers:pxe-recovery")) {
        sessionStorage.setItem("honkers:pxe-recovery", "1");
        await resetEmbeddedPXEState();
        setState({ connected: false, address: null, syncing: false });
        return connectWithEmbeddedPXE();
      }
      sessionStorage.removeItem("honkers:pxe-recovery");
      console.error("[WalletContext] Browser PXE connect failed:", err);
      setStatus("failed", msg);
      setWalletError(msg);
      setState({ connected: false, address: null, syncing: false });
      throw err;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setStatus]);

  // ---------------------------------------------------------------------------
  // Connect to a specific provider
  // ---------------------------------------------------------------------------
  const connectToProvider = useCallback(
    async (provider: WalletProvider) => {
      setState((s) => ({ ...s, syncing: true }));
      setStatus("creating_account", `Connecting to ${provider.name}…`);
      setWalletError(null);

      try {
        let connectedWallet: Wallet;

        if (provider.name.toLowerCase().includes("azguard")) {
          // Azguard requires its own native permission flow — wallet-sdk ECDH
          // sessions carry no method-level permissions that Azguard's background
          // page requires. Use the inline AzguardWallet adapter instead.
          setStatus("registering_account", "Requesting Azguard permissions…");
          const azguardWallet = await AzguardWallet.connect("Honkers", "testnet");
          connectedWallet = asWallet(azguardWallet);

          azguardWallet.onDisconnected.addHandler(() => {
            console.warn("[WalletContext] Azguard disconnected.");
            disconnect();
          });
        } else {
          // Standard wallet-sdk ECDH channel (Obsidion, any RFC-compliant wallet)
          setStatus("registering_account", "Key exchange with wallet…");
          const pending = await provider.establishSecureChannel("honkers-dapp");
          setStatus("checking_deployment", "Finalizing secure channel…");
          connectedWallet = await pending.confirm();

          provider.onDisconnect(() => {
            console.warn("[WalletContext] Wallet disconnected unexpectedly.");
            disconnect();
          });
        }

        setStatus("connected", `Connected via ${provider.name}`);
        const accounts = await connectedWallet.getAccounts();
        if (accounts.length === 0) {
          throw new Error(`${provider.name} returned no accounts. Create an account in the wallet first.`);
        }

        // getAccounts() returns Aliased<AztecAddress>[] — address is on .item
        const firstAccount = accounts[0];
        const address =
          firstAccount && typeof firstAccount === "object" && "item" in firstAccount
            ? String((firstAccount as { item: { toString(): string } }).item)
            : String(firstAccount);

        localStorage.setItem(STORAGE_KEY, address);
        const wt = provider.name.toLowerCase().includes("azguard")
          ? "azguard"
          : `sdk:${provider.name}`;
        localStorage.setItem(WALLET_TYPE_KEY, wt);
        setWalletType(wt);
        const node = await getAztecNode();
        setAztecNode(node);
        setWallet(connectedWallet);
        activeProviderRef.current = provider;

        setState({ connected: true, address, syncing: false });
        console.log(`[WalletContext] Connected: ${address} via ${provider.name}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[WalletContext] connect failed:", err);
        setStatus("failed", msg);
        setWalletError(msg);
        setState({ connected: false, address: null, syncing: false });
        throw err;
      }
    },
    [setStatus], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ---------------------------------------------------------------------------
  // Disconnect
  // ---------------------------------------------------------------------------
  const disconnect = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(WALLET_TYPE_KEY);
    activeProviderRef.current?.disconnect().catch(() => {});
    activeProviderRef.current = null;
    setWallet(null);
    setAztecNode(null);
    setWalletType(null);
    setState({ connected: false, address: null, syncing: false });
    setConnectStage("idle");
    setConnectDetail(null);
    setWalletError(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Legacy compat: connect() opens picker
  // ---------------------------------------------------------------------------
  const connect = useCallback(async () => {
    openPicker();
  }, [openPicker]);

  const clearConnectTimeline = useCallback(() => {
    localStorage.removeItem(CONNECT_TIMELINE_KEY);
    setConnectTimeline([]);
  }, []);

  // ---------------------------------------------------------------------------
  // Auto-reconnect on page load — silently restore the previous session.
  //
  // Azguard won't show a permission popup if the dapp is already whitelisted.
  // Embedded PXE state lives in IndexedDB and survives refresh.
  // If reconnection fails, clear stored keys and show connect button normally.
  // ---------------------------------------------------------------------------
  const autoReconnectAttempted = useRef(false);

  useEffect(() => {
    if (autoReconnectAttempted.current) return;
    autoReconnectAttempted.current = true;

    const savedAddress = localStorage.getItem(STORAGE_KEY);
    const walletType = localStorage.getItem(WALLET_TYPE_KEY);
    if (!savedAddress || !walletType) return;

    (async () => {
      setState((s) => ({ ...s, syncing: true }));
      try {
        if (walletType === "azguard") {
          const azguardWallet = await AzguardWallet.connect("Honkers", "testnet");
          const connectedWallet = asWallet(azguardWallet);

          azguardWallet.onDisconnected.addHandler(() => {
            console.warn("[WalletContext] Azguard disconnected.");
            disconnect();
          });

          const accounts = await connectedWallet.getAccounts();
          if (accounts.length === 0) throw new Error("No accounts");

          const firstAccount = accounts[0];
          const address =
            firstAccount && typeof firstAccount === "object" && "item" in firstAccount
              ? String((firstAccount as { item: { toString(): string } }).item)
              : String(firstAccount);

          const node = await getAztecNode();
          setAztecNode(node);
          setWallet(connectedWallet);
          localStorage.setItem(STORAGE_KEY, address);
          setState({ connected: true, address, syncing: false });
          setConnectStage("connected");
          console.log("[WalletContext] Auto-reconnected via Azguard:", address);

        } else if (walletType === "embedded") {
          await connectWithEmbeddedPXE();

        } else {
          // sdk:<providerName> — can't silently reconnect without ECDH re-handshake;
          // clear and fall through to manual connect.
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(WALLET_TYPE_KEY);
          setState((s) => ({ ...s, syncing: false }));
        }
      } catch (err) {
        console.warn("[WalletContext] Auto-reconnect failed, clearing session:", err);
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(WALLET_TYPE_KEY);
        setWalletError(null);
        setState({ connected: false, address: null, syncing: false });
      }
    })();
  // connectWithEmbeddedPXE and disconnect are stable callbacks — intentionally
  // omitted from deps to run only once on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <WalletCtx.Provider
      value={{
        ...state,
        wallet,
        aztecNode,
        walletError,
        connectStage,
        connectDetail,
        connectTimeline,
        clearConnectTimeline,
        pickerOpen,
        openPicker,
        closePicker,
        discoveredProviders,
        discoverStatus,
        connectToProvider,
        connectWithEmbeddedPXE,
        walletType,
        connect,
        disconnect,
        walletLoading: false,
      }}
    >
      {children}
    </WalletCtx.Provider>
  );
}

export function useWalletContext() {
  return useContext(WalletCtx);
}
