// ---------------------------------------------------------------------------
// CMP-PENDING-CLAIM-BANNER — Aggregate pending auto-claim status
// ---------------------------------------------------------------------------

import { CircleCheck } from "lucide-react";
import type { WinningClaim } from "../../types";

export function PendingClaimBanner({ winnings }: { winnings: WinningClaim[] }) {
  const unclaimed = winnings.filter((w) => !w.claimed);
  if (unclaimed.length === 0) return null;

  const total = unclaimed.reduce((sum, w) => sum + w.amount, 0) / 1e6;

  return (
    <div
      style={{
        background: "rgba(0, 196, 120, 0.08)",
        border: "1px solid rgba(0, 196, 120, 0.2)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-3) var(--space-5)",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        marginBottom: "var(--space-4)",
      }}
    >
      <CircleCheck size={16} style={{ color: "var(--positive)" }} />
      <span style={{ color: "var(--positive)", fontWeight: 500, fontSize: "0.875rem" }}>
        {unclaimed.length} winning{unclaimed.length > 1 ? "s" : ""} ready to claim — {total.toFixed(2)} USDh
      </span>
    </div>
  );
}
