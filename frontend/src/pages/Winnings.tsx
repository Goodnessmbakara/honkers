// ---------------------------------------------------------------------------
// SCR-WINNINGS (S06) — Pending/claimed winnings + claim actions, 3% platform
// fee shown (FR-P-2 through FR-P-4)
// ---------------------------------------------------------------------------

import { useState } from "react";
import { useWallet } from "../hooks/useWallet";
import { usePortfolio } from "../hooks/usePortfolio";
import { WinningRow } from "../components/portfolio/WinningRow";

export function Winnings() {
  const { connected, address } = useWallet();
  const { winnings, claimWinnings, refresh } = usePortfolio(address);
  const [claimingId, setClaimingId] = useState<number | null>(null);

  if (!connected) {
    return (
      <div className="page" style={{ textAlign: "center" }}>
        <h2>Winnings</h2>
        <p style={{ color: "var(--text-muted)" }}>Connect your wallet to view winnings.</p>
      </div>
    );
  }

  const handleClaim = async (marketId: number) => {
    setClaimingId(marketId);
    try {
      await claimWinnings(marketId);
      await refresh();
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <div className="page">
      <h1 style={{ marginBottom: "var(--space-6)" }}>Winnings</h1>

      <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-4)", fontSize: "0.875rem" }}>
        A 3% platform fee is deducted from winnings on claim.
      </p>

      {winnings.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>No winnings yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {winnings.map((w) => (
            <WinningRow
              key={w.marketId}
              winning={w}
              onClaim={handleClaim}
              claiming={claimingId === w.marketId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
