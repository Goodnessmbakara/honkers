// ---------------------------------------------------------------------------
// CMP-WALLET-CONNECT — Connect/disconnect Aztec wallet, show address + sync
// ---------------------------------------------------------------------------

import { Wallet, LogOut, WifiOff, RotateCcw, Copy, Check, Shield, Download, ChevronDown } from "lucide-react";
import { useWalletContext } from "../../contexts/WalletContext";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

export function WalletConnect() {
  const { connected, address, syncing, connect, disconnect, walletLoading, walletError } = useWalletContext();
  const [resetting, setResetting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close dropdown on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const copyAddress = useCallback(async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [address]);

  const resetPXE = useCallback(async () => {
    if (!confirm("This clears cached PXE data and reloads the page. Continue?")) return;
    setResetting(true);
    setMenuOpen(false);
    try {
      const dbs = await indexedDB.databases();
      const toDelete = dbs.filter((db) => db.name?.includes("aztec") || db.name?.startsWith("pxe"));
      await Promise.all(
        toDelete.map(
          (db) =>
            new Promise<void>((resolve) => {
              const req = indexedDB.deleteDatabase(db.name!);
              req.onsuccess = () => resolve();
              req.onerror = () => resolve();
              req.onblocked = () => resolve();
            }),
        ),
      );
      localStorage.removeItem("honkers:wallet-address");
      localStorage.removeItem("honkers:wallet-secret");
      window.location.reload();
    } catch (err) {
      console.error("[WalletConnect] Reset failed:", err);
      setResetting(false);
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    setMenuOpen(false);
    disconnect();
  }, [disconnect]);

  const handleNavigate = useCallback((path: string) => {
    setMenuOpen(false);
    navigate(path);
  }, [navigate]);

  if (connected && address) {
    const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
    return (
      <div ref={menuRef} style={{ position: "relative" }}>
        {/* Wallet pill button */}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            padding: "6px 12px",
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-full)",
            cursor: "pointer",
            transition: "border-color 150ms ease",
            borderColor: menuOpen ? "var(--accent)" : "var(--border)",
          }}
        >
          <div style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "var(--positive)",
            flexShrink: 0,
          }} />
          <span className="mono" style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>
            {short}
          </span>
          <ChevronDown
            size={14}
            style={{
              color: "var(--text-muted)",
              transition: "transform 150ms ease",
              transform: menuOpen ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
        </button>

        {/* Dropdown menu */}
        {menuOpen && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              width: 260,
              background: "var(--surface-raised)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
              zIndex: 100,
              overflow: "hidden",
            }}
          >
            {/* Address section */}
            <div style={{ padding: "var(--space-4)", borderBottom: "1px solid var(--border)" }}>
              <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginBottom: "var(--space-1)" }}>
                Connected wallet
              </div>
              <button
                onClick={copyAddress}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  width: "100%",
                  padding: "6px 8px",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  cursor: "pointer",
                  transition: "border-color 150ms ease",
                }}
                title="Copy full address"
              >
                <span className="mono" style={{
                  color: "var(--text-secondary)",
                  fontSize: "0.6875rem",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                  textAlign: "left",
                }}>
                  {address}
                </span>
                {copied
                  ? <Check size={12} style={{ color: "var(--positive)", flexShrink: 0 }} />
                  : <Copy size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                }
              </button>
            </div>

            {/* Menu items */}
            <div style={{ padding: "var(--space-2)" }}>
              <MenuItem
                icon={<Shield size={14} />}
                label="Backup wallet"
                onClick={() => handleNavigate("/backup")}
              />
              <MenuItem
                icon={<Download size={14} />}
                label="Faucet"
                onClick={() => handleNavigate("/faucet")}
              />
              <MenuItem
                icon={<RotateCcw size={14} />}
                label="Reset PXE data"
                onClick={resetPXE}
                disabled={resetting}
                muted
              />
              <div style={{ height: 1, background: "var(--border)", margin: "var(--space-1) var(--space-2)" }} />
              <MenuItem
                icon={<LogOut size={14} />}
                label="Disconnect"
                onClick={handleDisconnect}
                destructive
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  if (walletError) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        <button className="btn-secondary" disabled title={walletError} style={{ opacity: 0.6 }}>
          <WifiOff size={16} />
          PXE offline
        </button>
        <button
          className="btn-ghost"
          onClick={resetPXE}
          disabled={resetting}
          title="Reset PXE"
          style={{ opacity: 0.6 }}
        >
          <RotateCcw size={14} />
        </button>
      </div>
    );
  }

  return (
    <button className="btn-primary" onClick={connect} disabled={syncing || walletLoading}>
      <Wallet size={16} />
      {walletLoading ? "Initializing…" : syncing ? "Connecting…" : "Connect wallet"}
    </button>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  disabled,
  destructive,
  muted,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  muted?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        width: "100%",
        padding: "8px var(--space-3)",
        background: "transparent",
        border: "none",
        borderRadius: "var(--radius-md)",
        cursor: disabled ? "not-allowed" : "pointer",
        color: destructive ? "var(--negative)" : muted ? "var(--text-muted)" : "var(--text-secondary)",
        fontSize: "0.8125rem",
        opacity: disabled ? 0.5 : 1,
        transition: "background 150ms ease",
        textAlign: "left",
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = "var(--surface)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      {icon}
      {label}
    </button>
  );
}
