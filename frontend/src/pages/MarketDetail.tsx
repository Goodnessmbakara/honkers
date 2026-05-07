// ---------------------------------------------------------------------------
// SCR-MARKET-DETAIL (S03) — Odds, resolution criteria, creator, schedule,
// status badge, privacy caveat (FR-M-2 through FR-M-5)
// ---------------------------------------------------------------------------

import { useParams, Link } from "react-router-dom";
import { useMarketDetail } from "../hooks/useMarkets";
import { MarketStatusBadge } from "../components/market/MarketStatusBadge";
import { OddsDisplay } from "../components/market/OddsDisplay";
import { Countdown } from "../components/market/Countdown";
import { CreatorLine } from "../components/market/CreatorLine";
import { PrivacyCallout } from "../components/safety/PrivacyCallout";

export function MarketDetail() {
  const { id } = useParams<{ id: string }>();
  const marketId = id ? Number(id) : null;
  const { market, loading, error } = useMarketDetail(marketId);

  if (loading) {
    return (
      <div className="page">
        <div className="skeleton" style={{ width: "60%", height: 28, marginBottom: "var(--space-4)" }} />
        <div className="skeleton" style={{ width: "100%", height: 200 }} />
      </div>
    );
  }

  if (error || !market) {
    return (
      <div className="page">
        <h2>Market not found</h2>
        <p style={{ color: "var(--text-muted)" }}>{error ?? "This market does not exist."}</p>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
        <MarketStatusBadge status={market.status} />
        <Countdown targetUnix={market.endDate} label="Ends" />
      </div>

      <h1 style={{ marginBottom: "var(--space-4)" }}>
        {market.question ?? `Market #${market.marketId}`}
      </h1>

      {/* Odds */}
      <div className="card" style={{ marginBottom: "var(--space-4)" }}>
        <OddsDisplay yesPrice={market.yesPrice} noPrice={market.noPrice} />
      </div>

      {/* Trade CTA */}
      {market.status === "active" && (
        <Link
          to={`/trade/${market.marketId}`}
          className="btn-primary"
          style={{ display: "inline-flex", marginBottom: "var(--space-6)", textDecoration: "none" }}
        >
          Trade this market
        </Link>
      )}

      {/* Details grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--space-4)",
          marginBottom: "var(--space-6)",
        }}
      >
        <div className="card">
          <h3 style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "var(--space-2)" }}>
            Resolution criteria
          </h3>
          <p style={{ fontSize: "0.875rem" }}>{market.criteria ?? "—"}</p>
        </div>
        <div className="card">
          <h3 style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "var(--space-2)" }}>
            Source
          </h3>
          <p style={{ fontSize: "0.875rem" }}>{market.source ?? "—"}</p>
        </div>
        <div className="card">
          <h3 style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "var(--space-2)" }}>
            Creator
          </h3>
          <CreatorLine address={market.creator} />
        </div>
        <div className="card">
          <h3 style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "var(--space-2)" }}>
            Liquidity
          </h3>
          <span className="mono">{(market.liquidity / 1e6).toFixed(2)} USDh</span>
        </div>
      </div>

      {/* Resolution status */}
      {market.resolution && (
        <div className="card" style={{ marginBottom: "var(--space-6)" }}>
          <h3 style={{ marginBottom: "var(--space-3)" }}>Resolution</h3>
          <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            State: <strong>{market.resolution.state}</strong>
            {market.resolution.outcome !== null && (
              <> — Outcome: <strong>{market.resolution.outcome === 1 ? "YES" : "NO"}</strong></>
            )}
          </p>
          {market.resolution.challengeDeadline && (
            <Countdown targetUnix={market.resolution.challengeDeadline} label="Challenge window" />
          )}
        </div>
      )}

      <PrivacyCallout context="trade" />
    </div>
  );
}
