// ---------------------------------------------------------------------------
// SCR-BACKUP (S12) — Export/import encrypted note backup file
// (FR-B-1, FR-B-2, FR-B-3)
//
// v4.1.3: Notes live in the browser-local IndexedDB managed by the
// BrowserEmbeddedWallet.  For now, export/import is a placeholder;
// the wallet's IndexedDB persistence keeps notes across sessions.
// ---------------------------------------------------------------------------

import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { useWallet } from "../hooks/useWallet";

export function Backup() {
  const { connected } = useWallet();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  const handleExport = async () => {
    setStatus(
      "Notes are stored in your browser's IndexedDB. " +
      "Use your browser's DevTools → Application → IndexedDB to back up the database. " +
      "Full SDK-level export support is planned."
    );
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus(
      "Import is not yet supported in v4.1.3. " +
      "Notes are managed by the local embedded wallet."
    );
  };

  if (!connected) {
    return (
      <div className="page" style={{ textAlign: "center" }}>
        <h2>Backup</h2>
        <p style={{ color: "var(--text-muted)" }}>Connect your wallet to manage backups.</p>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 480, margin: "0 auto" }}>
      <h1 style={{ marginBottom: "var(--space-2)" }}>Backup &amp; restore</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-6)", fontSize: "0.875rem" }}>
        Back up your notes. Without a backup, lost browser data means lost funds.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <button className="btn-primary" onClick={handleExport}>
          <Download size={16} /> Export backup
        </button>

        <button className="btn-secondary" onClick={() => fileRef.current?.click()}>
          <Upload size={16} /> Import backup
        </button>
        <input ref={fileRef} type="file" accept=".json" onChange={handleImport} style={{ display: "none" }} />
      </div>

      {status && (
        <p style={{ marginTop: "var(--space-4)", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
          {status}
        </p>
      )}
    </div>
  );
}
