// ---------------------------------------------------------------------------
// CMP-WALLET-CONNECT — Connect/disconnect Aztec wallet, show address + sync
// ---------------------------------------------------------------------------

import { Wallet, LogOut, WifiOff, RotateCcw } from "lucide-react";
import { useWallet } from "../../hooks/useWallet";
import { useCallback, useState } from "react";

const PXE_DB_NAME = "aztec-pxe-honkers";

export function WalletConnect() {
  const { connected, address, syncing, connect, disconnect, walletLoading, walletError } = useWallet();
  const [resetting, setResetting] = useState(false);

  const resetPXE = useCallback(async () => {
    if (!confirm("This clears cached PXE data and reloads the page. Continue?")) return;
    setResetting(true);
    try {
      // Clear IndexedDB
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.deleteDatabase(PXE_DB_NAME);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        req.onblocked = () => resolve(); // still succeeds on next reload
      });
      // Clear wallet session
      localStorage.removeItem("honkers:wallet-address");
      localStorage.removeItem("honkers:wallet-secret");
      window.location.reload();
    } catch (err) {
      console.error("[WalletConnect] Reset failed:", err);
      setResetting(false);
    }
  }, []);

  if (connected && address) {
    const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        <span className="mono" style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>
          {short}
        </span>
        <button
          className="btn-ghost"
          onClick={resetPXE}
          disabled={resetting}
          title="Reset PXE — Clears cached blockchain data from the browser. Use this after restarting the Aztec sandbox, or if you see 'block hash not found' errors."
          style={{ opacity: 0.6 }}
        >
          <RotateCcw size={14} />
        </button>
        <button className="btn-ghost" onClick={disconnect} title="Disconnect">
          <LogOut size={16} />
        </button>
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
          title="Reset PXE — Clears cached blockchain data and retries connection. Use after sandbox restart."
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
