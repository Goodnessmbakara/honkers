// ---------------------------------------------------------------------------
// CMP-ADMIN-RESOLUTION-ACTION — Resolution workflow trigger / tx builder
// (FR-A-2, FR-A-5)
// ---------------------------------------------------------------------------

import { useState } from "react";
import type { ResolutionStatus } from "../../types";

interface Props {
  marketId: number;
  resolution: ResolutionStatus | null;
  onPropose: (marketId: number, outcome: number) => Promise<void>;
  onVoid: (marketId: number) => Promise<void>;
}

export function AdminResolutionAction({ marketId, resolution, onPropose, onVoid }: Props) {
  const [outcome, setOutcome] = useState<number>(1);
  const [loading, setLoading] = useState(false);

  const handlePropose = async () => {
    setLoading(true);
    try { await onPropose(marketId, outcome); } finally { setLoading(false); }
  };

  const handleVoid = async () => {
    setLoading(true);
    try { await onVoid(marketId); } finally { setLoading(false); }
  };

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <h3>Resolution actions</h3>

      {/* Current state */}
      <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
        State: <strong>{resolution?.state ?? "none"}</strong>
        {resolution?.challengeDeadline && (
          <> — Challenge deadline: {new Date(resolution.challengeDeadline * 1000).toLocaleString()}</>
        )}
      </div>

      {/* Propose resolution */}
      {(!resolution || resolution.state === "none") && (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <select
            value={outcome}
            onChange={(e) => setOutcome(Number(e.target.value))}
            style={{ width: 120 }}
          >
            <option value={1}>YES</option>
            <option value={0}>NO</option>
          </select>
          <button className="btn-primary" onClick={handlePropose} disabled={loading}>
            {loading ? "Submitting…" : "Propose resolution"}
          </button>
        </div>
      )}

      {/* Void market */}
      {resolution?.isVoidEligible && (
        <button className="btn-destructive" onClick={handleVoid} disabled={loading}>
          {loading ? "Voiding…" : "Void market"}
        </button>
      )}
    </div>
  );
}
