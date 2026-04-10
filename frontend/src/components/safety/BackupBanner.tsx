// ---------------------------------------------------------------------------
// CMP-BACKUP-BANNER — Persistent until user acknowledges backup or exports
// (FR-B-3)
// ---------------------------------------------------------------------------

import { useState } from "react";
import { Download, X } from "lucide-react";
import { Link } from "react-router-dom";

const DISMISSED_KEY = "honkers:backup-dismissed";

export function BackupBanner() {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === "1",
  );

  if (dismissed) return null;

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
          <Download size={14} />
          Back up your notes. Without a backup, lost browser data means lost funds.
          <Link to="/backup" style={{ color: "var(--accent)", marginLeft: "var(--space-2)" }}>Back up now</Link>
        </span>
        <button className="btn-ghost" onClick={dismiss} title="Dismiss">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
