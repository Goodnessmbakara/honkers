// ---------------------------------------------------------------------------
// CMP-ADMIN-MARKET-TABLE — Markets table with filters by resolution state
// (FR-A-1)
// ---------------------------------------------------------------------------

import { useState } from "react";
import type { Market, MarketStatus } from "../../types";
import { MarketStatusBadge } from "../market/MarketStatusBadge";
import { Countdown } from "../market/Countdown";

const filters: { label: string; value: MarketStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Resolving", value: "resolving" },
  { label: "Halted", value: "halted" },
  { label: "Resolved", value: "resolved" },
  { label: "Voided", value: "voided" },
];

interface Props {
  markets: Market[];
  onSelect: (marketId: number) => void;
}

export function AdminMarketTable({ markets, onSelect }: Props) {
  const [filter, setFilter] = useState<MarketStatus | "all">("all");

  const filtered = filter === "all" ? markets : markets.filter((m) => m.status === filter);

  return (
    <div>
      {/* Filter tabs */}
      <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
        {filters.map((f) => (
          <button
            key={f.value}
            className={filter === f.value ? "btn-primary" : "btn-ghost"}
            style={{ fontSize: "0.75rem", height: 32, padding: "0 var(--space-3)" }}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-muted)", textAlign: "left" }}>
            <th style={{ padding: "var(--space-2) var(--space-3)" }}>ID</th>
            <th style={{ padding: "var(--space-2) var(--space-3)" }}>Status</th>
            <th style={{ padding: "var(--space-2) var(--space-3)" }}>End date</th>
            <th style={{ padding: "var(--space-2) var(--space-3)" }}>Creator</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((m) => (
            <tr
              key={m.marketId}
              onClick={() => onSelect(m.marketId)}
              style={{
                borderBottom: "1px solid var(--border)",
                cursor: "pointer",
                transition: "background var(--duration-fast) ease-out",
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = "var(--surface-raised)")}
              onMouseOut={(e) => (e.currentTarget.style.background = "")}
            >
              <td style={{ padding: "var(--space-2) var(--space-3)" }} className="mono">
                #{m.marketId}
              </td>
              <td style={{ padding: "var(--space-2) var(--space-3)" }}>
                <MarketStatusBadge status={m.status} />
              </td>
              <td style={{ padding: "var(--space-2) var(--space-3)" }}>
                <Countdown targetUnix={m.endDate} />
              </td>
              <td style={{ padding: "var(--space-2) var(--space-3)" }} className="mono">
                {m.creator.slice(0, 8)}…
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {filtered.length === 0 && (
        <p style={{ color: "var(--text-muted)", padding: "var(--space-6)", textAlign: "center" }}>
          No markets match this filter.
        </p>
      )}
    </div>
  );
}
