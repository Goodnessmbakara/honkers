// ---------------------------------------------------------------------------
// CMP-TX-STATUS — Transaction status: submitted / included / failed
// (FR-T-4, FR-T-5)
// ---------------------------------------------------------------------------

import { CircleCheck, CircleX, Loader } from "lucide-react";

type Status = "pending" | "confirmed" | "failed";

interface Props {
  status: Status;
  txHash?: string | null;
  error?: string | null;
  onRetry?: () => void;
}

export function TxStatus({ status, txHash, error, onRetry }: Props) {
  return (
    <div
      className="card"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "var(--space-4) var(--space-5)",
      }}
    >
      {status === "pending" && <Loader size={20} style={{ color: "var(--accent)", animation: "spin 1.5s linear infinite" }} />}
      {status === "confirmed" && <CircleCheck size={20} style={{ color: "var(--positive)" }} />}
      {status === "failed" && <CircleX size={20} style={{ color: "var(--negative)" }} />}

      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500 }}>
          {status === "pending" && "Transaction submitted"}
          {status === "confirmed" && "Transaction confirmed"}
          {status === "failed" && "Transaction failed"}
        </div>
        {txHash && (
          <span className="mono" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            {txHash.slice(0, 10)}…{txHash.slice(-8)}
          </span>
        )}
        {error && (
          <span style={{ fontSize: "0.8125rem", color: "var(--negative)" }}>{error}</span>
        )}
      </div>

      {status === "failed" && onRetry && (
        <button className="btn-secondary" onClick={onRetry}>Retry</button>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
