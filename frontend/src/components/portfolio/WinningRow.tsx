// ---------------------------------------------------------------------------
// CMP-WINNING-ROW — Amount, question, date, claim CTA, 3% fee display
// ---------------------------------------------------------------------------

import { CircleCheck } from "lucide-react";
import type { WinningClaim } from "../../types";

const FEE_RATE = 0.03;

interface Props {
  winning: WinningClaim;
  onClaim: (marketId: number) => void;
  claiming?: boolean;
}

export function WinningRow({ winning, onClaim, claiming }: Props) {
  const gross = winning.amount / 1e6;
  const fee = gross * FEE_RATE;
  const net = gross - fee;
  const date = new Date(winning.resolvedAt * 1000).toLocaleDateString();

  return (
    <div
      className="card"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "var(--space-3) var(--space-5)",
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <CircleCheck size={16} style={{ color: "var(--positive)" }} />
          <span>Market #{winning.marketId}</span>
        </div>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          Resolved {date}
        </span>
      </div>

      <div style={{ textAlign: "right" }}>
        <div className="mono" style={{ color: "var(--positive)" }}>
          +{net.toFixed(2)} USDh
        </div>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          {fee.toFixed(2)} fee (3%)
        </span>
      </div>

      {!winning.claimed && (
        <button
          className="btn-primary"
          onClick={() => onClaim(winning.marketId)}
          disabled={claiming}
          style={{ marginLeft: "var(--space-4)" }}
        >
          {claiming ? "Claiming…" : "Claim"}
        </button>
      )}
    </div>
  );
}
