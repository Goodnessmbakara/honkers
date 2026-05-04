// ---------------------------------------------------------------------------
// WalletPickerModal — RainbowKit-style wallet selector for Aztec extensions.
//
// Uses @aztec/wallet-sdk WalletManager to discover installed extension wallets
// (Azguard, Obsidion, or any compliant Aztec wallet) via the official
// discovery protocol. Wallets appear as they respond — no polling needed.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";
import { X, Loader2, CheckCircle2, ExternalLink, WifiOff, Globe } from "lucide-react";
import { useWalletContext } from "../../contexts/WalletContext";
import type { WalletProvider } from "@aztec/wallet-sdk/manager";

// Known wallets shown as static cards — they light up when discovered
const KNOWN_WALLETS = [
  {
    id: "azguard",
    name: "Azguard",
    description: "Privacy-first browser wallet for Aztec",
    icon: "https://chromewebstore.google.com/detail/azguard-wallet/pliilpflcmabdiapdeihifihkbdfnbmn",
    installUrl:
      "https://chromewebstore.google.com/detail/azguard-wallet/pliilpflcmabdiapdeihifihkbdfnbmn",
    // Match discovered providers by name (case-insensitive)
    matchName: "azguard",
  },
  {
    id: "obsidion",
    name: "Obsidion",
    description: "Non-custodial Aztec wallet by Zpoken",
    icon: null,
    installUrl: "https://app.obsidion.xyz/",
    matchName: "obsidion",
  },
];

type DiscoverStatus = "idle" | "discovering" | "done";

export function WalletPickerModal() {
  const {
    pickerOpen,
    closePicker,
    discoveredProviders,
    discoverStatus,
    connectToProvider,
    connectWithEmbeddedPXE,
    walletError,
  } = useWalletContext();

  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [pxeConnecting, setPxeConnecting] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on overlay click
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) closePicker();
  };

  // Close on Escape
  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePicker();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [pickerOpen, closePicker]);

  // Clear connect error when picker re-opens
  useEffect(() => {
    if (pickerOpen) setConnectError(null);
  }, [pickerOpen]);

  if (!pickerOpen) return null;

  const findProvider = (matchName: string): WalletProvider | undefined =>
    discoveredProviders.find((p) =>
      p.name.toLowerCase().includes(matchName.toLowerCase())
    );

  const handleBrowserPXE = async () => {
    setPxeConnecting(true);
    setConnectError(null);
    try {
      await connectWithEmbeddedPXE();
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : String(err));
    } finally {
      setPxeConnecting(false);
    }
  };

  const handleConnect = async (provider: WalletProvider) => {
    setConnectingId(provider.id);
    setConnectError(null);
    try {
      await connectToProvider(provider);
      // Modal closes automatically via connected state change in WalletConnect
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : String(err));
      setConnectingId(null);
    }
  };

  // Any extra discovered wallets not in KNOWN_WALLETS list
  const unknownProviders = discoveredProviders.filter(
    (p) =>
      !KNOWN_WALLETS.some((kw) =>
        p.name.toLowerCase().includes(kw.matchName)
      )
  );

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-4)",
      }}
    >
      <div
        style={{
          background: "var(--surface-raised)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-xl)",
          width: "100%",
          maxWidth: 400,
          boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "var(--space-5) var(--space-5) var(--space-4)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: "1rem", color: "var(--text-primary)" }}>
              Connect Wallet
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
              Select an Aztec wallet to continue
            </div>
          </div>
          <button
            onClick={closePicker}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              padding: 4,
              borderRadius: "var(--radius-sm)",
              display: "flex",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Discovery status */}
        <DiscoveryBar status={discoverStatus} />

        {/* Wallet list */}
        <div style={{ padding: "var(--space-3)" }}>
          {KNOWN_WALLETS.map((kw) => {
            const provider = findProvider(kw.matchName);
            const isConnecting = connectingId === provider?.id;
            const isAvailable = !!provider;

            return (
              <WalletCard
                key={kw.id}
                name={kw.name}
                description={kw.description}
                status={
                  discoverStatus === "discovering" && !isAvailable
                    ? "searching"
                    : isAvailable
                    ? "available"
                    : "not-found"
                }
                installUrl={kw.installUrl}
                isConnecting={isConnecting}
                onConnect={provider ? () => handleConnect(provider) : undefined}
              />
            );
          })}

          {/* Unknown discovered wallets */}
          {unknownProviders.map((p) => (
            <WalletCard
              key={p.id}
              name={p.name}
              description={p.type === "extension" ? "Browser extension wallet" : "Web wallet"}
              status="available"
              isConnecting={connectingId === p.id}
              onConnect={() => handleConnect(p)}
            />
          ))}

          {/* Divider before browser fallback */}
          <div style={{ height: 1, background: "var(--border)", margin: "var(--space-2) 0" }} />

          {/* Browser embedded PXE — always available, no extension needed */}
          <BrowserPXECard isConnecting={pxeConnecting} onConnect={handleBrowserPXE} />
        </div>

        {/* Error display */}
        {(connectError || walletError) && (
          <div
            style={{
              margin: "0 var(--space-3) var(--space-3)",
              padding: "var(--space-3)",
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.25)",
              borderRadius: "var(--radius-md)",
              fontSize: "0.75rem",
              color: "var(--negative)",
              display: "flex",
              gap: "var(--space-2)",
            }}
          >
            <WifiOff size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{connectError ?? walletError}</span>
          </div>
        )}

        {/* Footer hint */}
        <div
          style={{
            padding: "var(--space-3) var(--space-5) var(--space-4)",
            borderTop: "1px solid var(--border)",
            fontSize: "0.6875rem",
            color: "var(--text-muted)",
            textAlign: "center",
          }}
        >
          New to Aztec?{" "}
          <a
            href="https://chromewebstore.google.com/detail/azguard-wallet/pliilpflcmabdiapdeihifihkbdfnbmn"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--accent)" }}
          >
            Install Azguard <ExternalLink size={10} style={{ display: "inline", verticalAlign: "middle" }} />
          </a>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DiscoveryBar({ status }: { status: DiscoverStatus }) {
  if (status === "idle") return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        padding: "var(--space-2) var(--space-5)",
        background: status === "discovering" ? "rgba(99,102,241,0.06)" : "transparent",
        fontSize: "0.6875rem",
        color: status === "discovering" ? "var(--accent)" : "var(--text-muted)",
        borderBottom: "1px solid var(--border)",
        minHeight: 32,
      }}
    >
      {status === "discovering" && (
        <Loader2 size={11} style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
      )}
      {status === "discovering"
        ? "Broadcasting discovery… approve in your wallet extension"
        : "Discovery complete"}
    </div>
  );
}

function BrowserPXECard({ isConnecting, onConnect }: { isConnecting: boolean; onConnect: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "var(--space-3)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border)",
        background: "var(--surface)",
        opacity: 0.85,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "var(--radius-md)",
          background: "var(--surface-raised)",
          border: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Globe size={18} style={{ color: "var(--text-muted)" }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, fontSize: "0.875rem", color: "var(--text-primary)" }}>
          Browser Wallet
        </div>
        <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: 1 }}>
          In-app PXE — no extension needed, slower proving
        </div>
      </div>
      <div style={{ flexShrink: 0 }}>
        {isConnecting ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.75rem", color: "var(--accent)" }}>
            <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
            <span>Loading</span>
          </div>
        ) : (
          <button
            onClick={onConnect}
            style={{
              padding: "5px 14px",
              background: "transparent",
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-full)",
              cursor: "pointer",
              fontSize: "0.75rem",
              fontWeight: 500,
            }}
          >
            Use
          </button>
        )}
      </div>
    </div>
  );
}

type WalletStatus = "searching" | "available" | "not-found";

function WalletCard({
  name,
  description,
  status,
  installUrl,
  isConnecting,
  onConnect,
}: {
  name: string;
  description: string;
  status: WalletStatus;
  installUrl?: string;
  isConnecting: boolean;
  onConnect?: () => void;
}) {
  const isAvailable = status === "available";
  const isSearching = status === "searching";
  const notFound = status === "not-found";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "var(--space-3) var(--space-3)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border)",
        marginBottom: "var(--space-2)",
        background: isAvailable ? "var(--surface)" : "transparent",
        transition: "all 150ms ease",
        opacity: notFound ? 0.6 : 1,
      }}
    >
      {/* Icon placeholder */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "var(--radius-md)",
          background: "var(--surface-raised)",
          border: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.25rem",
          flexShrink: 0,
        }}
      >
        {name[0]}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, fontSize: "0.875rem", color: "var(--text-primary)" }}>
          {name}
        </div>
        <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: 1 }}>
          {description}
        </div>
      </div>

      {/* Status / Action */}
      <div style={{ flexShrink: 0 }}>
        {isConnecting ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.75rem", color: "var(--accent)" }}>
            <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
            <span>Connecting</span>
          </div>
        ) : isAvailable && onConnect ? (
          <button
            onClick={onConnect}
            style={{
              padding: "5px 14px",
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--radius-full)",
              cursor: "pointer",
              fontSize: "0.75rem",
              fontWeight: 500,
            }}
          >
            Connect
          </button>
        ) : isSearching ? (
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.6875rem", color: "var(--text-muted)" }}>
            <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />
            <span>Searching</span>
          </div>
        ) : notFound && installUrl ? (
          <a
            href={installUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: "5px 12px",
              background: "transparent",
              color: "var(--text-muted)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-full)",
              cursor: "pointer",
              fontSize: "0.75rem",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            Install
            <ExternalLink size={10} />
          </a>
        ) : isAvailable ? (
          <CheckCircle2 size={16} style={{ color: "var(--positive)" }} />
        ) : null}
      </div>
    </div>
  );
}
