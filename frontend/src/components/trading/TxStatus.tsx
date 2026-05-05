// ---------------------------------------------------------------------------
// CMP-TX-STATUS — Transaction status: submitted / included / failed
// (FR-T-4, FR-T-5)
// ---------------------------------------------------------------------------

import { CircleCheck, CircleX, Loader } from "lucide-react";

type Status = "pending" | "confirmed" | "failed";

interface Props {
  status: Status;
  txHash?: string | null;
  /** Multiple tx hashes (e.g. deposit + buy) with optional labels */
  txHashes?: { label: string; hash: string }[];
  error?: string | null;
  onRetry?: () => void;
}

function shorten(h: string) {
  if (h.length <= 18) return h;
  return `${h.slice(0, 10)}…${h.slice(-8)}`;
}

export function TxStatus({ status, txHash, txHashes, error, onRetry }: Props) {
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
        {txHashes && txHashes.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", marginTop: "var(--space-1)" }}>
            {txHashes.map((t) => (
              <span key={t.label} className="mono" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                {t.label}:{" "}
                <a href={`https://testnet.aztecscan.xyz/tx-effects/${t.hash}`} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>
                  {shorten(t.hash)}
                </a>
              </span>
            ))}
          </div>
        ) : null}
        {txHash && !txHashes?.length ? (
          <a href={`https://testnet.aztecscan.xyz/tx-effects/${txHash}`} target="_blank" rel="noopener noreferrer" className="mono" style={{ fontSize: "0.75rem", color: "var(--text-muted)", textDecoration: "underline" }}>
            {shorten(txHash)}
          </a>
        ) : null}
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
