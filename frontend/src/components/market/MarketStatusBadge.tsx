// ---------------------------------------------------------------------------
// CMP-MARKET-STATUS-BADGE — Open / Halted / Resolving / Resolved / Void
// ---------------------------------------------------------------------------

import type { MarketStatus } from "../../types";

const styles: Record<MarketStatus, { bg: string; color: string }> = {
  active: { bg: "rgba(0, 209, 198, 0.12)", color: "var(--accent)" },
  resolved: { bg: "rgba(0, 196, 120, 0.12)", color: "var(--positive)" },
  voided: { bg: "rgba(245, 166, 35, 0.12)", color: "var(--warning)" },
  halted: { bg: "rgba(229, 72, 77, 0.12)", color: "var(--negative)" },
  resolving: { bg: "rgba(59, 130, 246, 0.12)", color: "var(--info)" },
};

const labels: Record<MarketStatus, string> = {
  active: "OPEN",
  resolved: "RESOLVED",
  voided: "VOID",
  halted: "HALTED",
  resolving: "RESOLVING",
};

export function MarketStatusBadge({ status }: { status: MarketStatus }) {
  const s = styles[status];
  return (
    <span
      className="badge"
      style={{ background: s.bg, color: s.color }}
    >
      {labels[status]}
    </span>
  );
}
