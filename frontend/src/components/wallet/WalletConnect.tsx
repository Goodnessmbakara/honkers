// ---------------------------------------------------------------------------
// CMP-WALLET-CONNECT — Connect/disconnect Aztec wallet, show address + sync
// ---------------------------------------------------------------------------

import { Wallet, LogOut, WifiOff } from "lucide-react";
import { useWallet } from "../../hooks/useWallet";

export function WalletConnect() {
  const { connected, address, syncing, connect, disconnect, walletLoading, walletError } = useWallet();

  if (connected && address) {
    const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        <span className="mono" style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>
          {short}
        </span>
        <button className="btn-ghost" onClick={disconnect} title="Disconnect">
          <LogOut size={16} />
        </button>
      </div>
    );
  }

  if (walletError) {
    return (
      <button className="btn-secondary" disabled title={walletError} style={{ opacity: 0.6 }}>
        <WifiOff size={16} />
        PXE offline
      </button>
    );
  }

  return (
    <button className="btn-primary" onClick={connect} disabled={syncing || walletLoading}>
      <Wallet size={16} />
      {walletLoading ? "Initializing…" : syncing ? "Connecting…" : "Connect wallet"}
    </button>
  );
}
