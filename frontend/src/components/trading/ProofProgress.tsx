// ---------------------------------------------------------------------------
// CMP-PROOF-PROGRESS — ZK proof generation steps, elapsed time, cancel/retry
// (FR-T-2, FR-T-3)
// ---------------------------------------------------------------------------

import { Loader } from "lucide-react";
import type { ProofStep } from "../../types";

const stepLabels: Record<ProofStep, string> = {
  witness: "Generating witness…",
  proving: "Computing proof…",
  submitting: "Submitting transaction…",
  confirmed: "Transaction confirmed",
  failed: "Proof generation failed",
};

interface Props {
  step: ProofStep;
  elapsed: number;
  onCancel?: () => void;
}

export function ProofProgress({ step, elapsed, onCancel }: Props) {
  const isActive = step === "witness" || step === "proving" || step === "submitting";
  const seconds = Math.floor(elapsed / 1000);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-4)",
        padding: "var(--space-8) 0",
      }}
    >
      {/* Progress ring */}
      {isActive && (
        <Loader
          size={48}
          style={{
            color: "var(--accent)",
            animation: "spin 1.5s linear infinite",
          }}
        />
      )}

      <span style={{ fontSize: "1rem", fontWeight: 500 }}>
        {stepLabels[step]}
      </span>

      {/* Elapsed time */}
      <span className="mono" style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
        {seconds}s elapsed
      </span>

      {/* Cancel */}
      {isActive && onCancel && (
        <button className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
