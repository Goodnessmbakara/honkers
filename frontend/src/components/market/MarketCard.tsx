// ---------------------------------------------------------------------------
// CMP-MARKET-CARD — List item: title, odds bar, status badge, end time
// ---------------------------------------------------------------------------

import { Link } from "react-router-dom";
import type { Market } from "../../types";
import { MarketStatusBadge } from "./MarketStatusBadge";
import { Countdown } from "./Countdown";
import { OddsDisplay } from "./OddsDisplay";

interface Props {
  market: Market;
  yesPrice?: number;
  noPrice?: number;
}

export function MarketCard({ market, yesPrice = 0.5, noPrice = 0.5 }: Props) {
  return (
    <Link
      to={`/markets/${market.marketId}`}
      className="card card-interactive"
      style={{ display: "block", textDecoration: "none", color: "inherit" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
        <MarketStatusBadge status={market.status} />
        <Countdown targetUnix={market.endDate} />
      </div>
      <h3 style={{ fontSize: "1rem", lineHeight: 1.4, marginBottom: "var(--space-3)", color: "var(--text-primary)" }}>
        {market.question ?? `Market #${market.marketId}`}
      </h3>
      <OddsDisplay yesPrice={yesPrice} noPrice={noPrice} />
    </Link>
  );
}

export function MarketCardSkeleton() {
  return (
    <div className="card" style={{ minHeight: 140 }}>
      <div className="skeleton" style={{ width: 60, height: 20, marginBottom: "var(--space-3)" }} />
      <div className="skeleton" style={{ width: "80%", height: 18, marginBottom: "var(--space-2)" }} />
      <div className="skeleton" style={{ width: "60%", height: 18, marginBottom: "var(--space-4)" }} />
      <div className="skeleton" style={{ width: "100%", height: 6 }} />
    </div>
  );
}
