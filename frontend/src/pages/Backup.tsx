// ---------------------------------------------------------------------------
// SCR-BACKUP (S12) — Export/import encrypted note backup file
// (FR-B-1, FR-B-2, FR-B-3)
// ---------------------------------------------------------------------------

import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { usePXE } from "../hooks/usePXE";
import { useWallet } from "../hooks/useWallet";

export function Backup() {
  const { connected, address } = useWallet();
  const { rpc } = usePXE();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  const handleExport = async () => {
    if (!address) return;
    setStatus("Exporting…");
    try {
      const notes = await rpc("pxe_getNotes", [{ owner: address }]);
      const blob = new Blob([JSON.stringify(notes, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `honkers-backup-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus("Backup exported successfully.");
    } catch (err) {
      setStatus(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("Importing…");
    try {
      const text = await file.text();
      const notes = JSON.parse(text);
      await rpc("pxe_addNotes", [notes]);
      setStatus(`Imported ${Array.isArray(notes) ? notes.length : 0} notes.`);
    } catch (err) {
      setStatus(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    }
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
