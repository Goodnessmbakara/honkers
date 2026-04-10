// ---------------------------------------------------------------------------
// SCR-ADMIN-MARKET (S20) — Admin market ops: resolution, dispute window, void,
// emergency pause (FR-A-2 through FR-A-5)
// ---------------------------------------------------------------------------

import { useParams, Link } from "react-router-dom";
import { useMarketDetail } from "../hooks/useMarkets";
import { usePXE } from "../hooks/usePXE";
import { useWallet } from "../hooks/useWallet";
import { aztecConfig } from "../config/aztec";
import { AdminResolutionAction } from "../components/admin/AdminResolutionAction";
import { MarketStatusBadge } from "../components/market/MarketStatusBadge";
import { Countdown } from "../components/market/Countdown";
import { ArrowLeft } from "lucide-react";

export function AdminMarket() {
  const { id } = useParams<{ id: string }>();
  const marketId = id ? Number(id) : null;
  const { market, loading } = useMarketDetail(marketId);
  const { simulateAndProve } = usePXE();
  const { address } = useWallet();

  if (loading || !market) {
    return (
      <div className="page">
        <div className="skeleton" style={{ width: "40%", height: 28, marginBottom: "var(--space-4)" }} />
        <div className="skeleton" style={{ width: "100%", height: 200 }} />
      </div>
    );
  }

  const handlePropose = async (_marketId: number, outcome: number) => {
    if (!address) return;
    await simulateAndProve(
      aztecConfig.contracts.oracle,
      "propose_resolution",
      [_marketId, outcome],
      address,
    );
  };

  const handleVoid = async (_marketId: number) => {
    if (!address) return;
    await simulateAndProve(
      aztecConfig.contracts.oracle,
      "void_market",
      [_marketId],
      address,
    );
  };

  return (
    <div className="page" style={{ maxWidth: 640, margin: "0 auto" }}>
      <Link
        to="/admin"
        className="btn-ghost"
        style={{ marginBottom: "var(--space-4)", display: "inline-flex", textDecoration: "none" }}
      >
        <ArrowLeft size={16} /> Back to admin
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
        <h1>Market #{market.marketId}</h1>
        <MarketStatusBadge status={market.status} />
      </div>

      <div className="card" style={{ marginBottom: "var(--space-4)" }}>
        <h3 style={{ marginBottom: "var(--space-2)" }}>{market.question ?? "Untitled"}</h3>
        <Countdown targetUnix={market.endDate} label="End date" />
        <div style={{ marginTop: "var(--space-2)", fontSize: "0.8125rem", color: "var(--text-muted)" }}>
          Creator: <span className="mono">{market.creator}</span>
        </div>
      </div>

      <AdminResolutionAction
        marketId={market.marketId}
        resolution={market.resolution ?? null}
        onPropose={handlePropose}
        onVoid={handleVoid}
      />
    </div>
  );
}
