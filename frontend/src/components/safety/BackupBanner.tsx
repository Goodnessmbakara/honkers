// ---------------------------------------------------------------------------
// CMP-BACKUP-BANNER — Persistent until user acknowledges backup or exports
// (FR-B-3)
//
// Notes CAN be recovered from the chain using your secret key, so this banner
// encourages saving the secret key rather than implying permanent data loss.
// ---------------------------------------------------------------------------

import { useState } from "react";
import { KeyRound, X } from "lucide-react";
import { Link } from "react-router-dom";

const DISMISSED_KEY = "honkers:backup-dismissed";
const SECRET_KEY = "honkers:wallet-secret";

export function BackupBanner() {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === "1",
  );

  // Only show if the user has a wallet secret (i.e. has connected before)
  const hasSecret = !!localStorage.getItem(SECRET_KEY);
  if (dismissed || !hasSecret) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  };

  return (
    <div
      style={{
        background: "rgba(245, 166, 35, 0.08)",
        borderBottom: "1px solid rgba(245, 166, 35, 0.2)",
        padding: "var(--space-2) 0",
        fontSize: "0.8125rem",
      }}
    >
      <div
        className="container"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
      >
        <span style={{ color: "var(--warning)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <KeyRound size={14} />
          Save your secret key to recover your wallet on any device.
          <Link to="/backup" style={{ color: "var(--accent)", marginLeft: "var(--space-2)" }}>View backup</Link>
        </span>
        <button className="btn-ghost" onClick={dismiss} title="Dismiss">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
