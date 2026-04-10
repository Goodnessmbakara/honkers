// ---------------------------------------------------------------------------
// CMP-POSITION-LIST — Local share notes aggregated by market
// ---------------------------------------------------------------------------

import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { Position } from "../../types";

export function PositionList({ positions }: { positions: Position[] }) {
  if (positions.length === 0) {
    return <p style={{ color: "var(--text-muted)" }}>No open positions.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      {positions.map((p, i) => (
        <Link
          key={`${p.marketId}-${p.side}-${i}`}
          to={`/markets/${p.marketId}`}
          className="card card-interactive"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            textDecoration: "none",
            color: "inherit",
            padding: "var(--space-3) var(--space-5)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            {p.side === "yes" ? (
              <TrendingUp size={16} style={{ color: "var(--positive)" }} />
            ) : (
              <TrendingDown size={16} style={{ color: "var(--negative)" }} />
            )}
            <span>Market #{p.marketId}</span>
            <span
              className="badge"
              style={{
                background: p.side === "yes" ? "rgba(0,196,120,0.12)" : "rgba(229,72,77,0.12)",
                color: p.side === "yes" ? "var(--positive)" : "var(--negative)",
              }}
            >
              {p.side.toUpperCase()}
            </span>
          </div>
          <span className="mono">{p.amount}</span>
        </Link>
      ))}
    </div>
  );
}
