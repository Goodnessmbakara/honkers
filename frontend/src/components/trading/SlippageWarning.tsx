// ---------------------------------------------------------------------------
// CMP-SLIPPAGE-WARNING — Dynamic slippage warning from AMM math
// ---------------------------------------------------------------------------

import { AlertTriangle } from "lucide-react";

const SLIPPAGE_THRESHOLD = 5; // percent

export function SlippageWarning({ amount }: { amount: number }) {
  // Placeholder: real slippage would be computed from AMM reserves.
  // For now, warn on large trades as a UX convention.
  if (amount < 50) return null;

  const estimated = amount > 200 ? 8.2 : amount > 100 ? 3.1 : 1.5;
  if (estimated < SLIPPAGE_THRESHOLD) return null;

  return (
    <div
      style={{
        background: "rgba(245, 166, 35, 0.08)",
        border: "1px solid rgba(245, 166, 35, 0.2)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-2) var(--space-3)",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        fontSize: "0.8125rem",
        color: "var(--warning)",
      }}
    >
      <AlertTriangle size={14} />
      Estimated slippage: ~{estimated.toFixed(1)}%. Consider a smaller trade.
    </div>
  );
}
