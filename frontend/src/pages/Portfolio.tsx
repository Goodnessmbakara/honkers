// ---------------------------------------------------------------------------
// SCR-PORTFOLIO (S05) — Private USDC balance + positions summary from PXE
// (FR-P-1)
// ---------------------------------------------------------------------------

import { Link } from "react-router-dom";
import { useWallet } from "../hooks/useWallet";
import { usePortfolio } from "../hooks/usePortfolio";
import { BalancePrivate } from "../components/portfolio/BalancePrivate";
import { PendingClaimBanner } from "../components/portfolio/PendingClaimBanner";
import { PositionList } from "../components/portfolio/PositionList";

export function Portfolio() {
  const { connected, address } = useWallet();
  const { balance, positions, winnings, loading } = usePortfolio(address);

  if (!connected) {
    return (
      <div className="page" style={{ textAlign: "center" }}>
        <h2 style={{ marginBottom: "var(--space-4)" }}>Portfolio</h2>
        <p style={{ color: "var(--text-muted)" }}>Connect your wallet to view your portfolio.</p>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 style={{ marginBottom: "var(--space-6)" }}>Portfolio</h1>

      <BalancePrivate amount={balance} loading={loading} />

      <PendingClaimBanner winnings={winnings} />

      {winnings.filter((w) => !w.claimed).length > 0 && (
        <Link
          to="/winnings"
          className="btn-primary"
          style={{ display: "inline-flex", margin: "var(--space-4) 0", textDecoration: "none" }}
        >
          View winnings
        </Link>
      )}

      <h2 style={{ marginTop: "var(--space-8)", marginBottom: "var(--space-4)" }}>Open positions</h2>
      <PositionList positions={positions} />
    </div>
  );
}
