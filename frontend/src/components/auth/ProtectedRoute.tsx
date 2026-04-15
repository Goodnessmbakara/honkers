// ---------------------------------------------------------------------------
// ProtectedRoute — Route-level auth gate
//
// Wraps child routes via <Outlet />. If the wallet is not connected, renders
// a prompt to connect instead of the page content.
// ---------------------------------------------------------------------------

import { Outlet } from "react-router-dom";
import { useWalletContext } from "../../contexts/WalletContext";
import { WalletConnect } from "../wallet/WalletConnect";
import { Wallet } from "lucide-react";

export function ProtectedRoute() {
  const { connected, walletLoading, syncing } = useWalletContext();

  if (walletLoading || syncing) {
    return (
      <div className="page" style={{ textAlign: "center", paddingTop: "var(--space-12)" }}>
        <p style={{ color: "var(--text-muted)" }}>Connecting wallet...</p>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="page" style={{ textAlign: "center", paddingTop: "var(--space-12)" }}>
        <Wallet size={32} style={{ color: "var(--text-muted)", marginBottom: "var(--space-4)" }} />
        <h2 style={{ marginBottom: "var(--space-3)" }}>Wallet required</h2>
        <p style={{ color: "var(--text-muted)", marginBottom: "var(--space-6)" }}>
          Connect your wallet to access this page.
        </p>
        <WalletConnect />
      </div>
    );
  }

  return <Outlet />;
}
