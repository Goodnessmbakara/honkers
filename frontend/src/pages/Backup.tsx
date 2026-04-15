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

export function Backup() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  const handleExport = async () => {
    try {
      setStatus("Exporting…");
      const dbs = await indexedDB.databases();
      const aztecDbs = dbs.filter((db) => db.name?.includes("aztec") || db.name?.startsWith("pxe"));
      if (aztecDbs.length === 0) {
        setStatus("No Aztec databases found in IndexedDB.");
        return;
      }

      const backup: Record<string, Record<string, unknown[]>> = {};

      for (const dbInfo of aztecDbs) {
        const dbName = dbInfo.name!;
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const req = indexedDB.open(dbName);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });

        const stores: Record<string, unknown[]> = {};
        const storeNames = Array.from(db.objectStoreNames);

        for (const storeName of storeNames) {
          const tx = db.transaction(storeName, "readonly");
          const store = tx.objectStore(storeName);
          const records = await new Promise<unknown[]>((resolve, reject) => {
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });
          stores[storeName] = records;
        }

        backup[dbName] = stores;
        db.close();
      }

      // Also export wallet localStorage keys
      const lsBackup: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)!;
        if (key.startsWith("honkers:")) {
          lsBackup[key] = localStorage.getItem(key)!;
        }
      }

      const payload = { version: 1, exportedAt: new Date().toISOString(), indexedDB: backup, localStorage: lsBackup };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `honkers-backup-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus("Backup exported successfully.");
    } catch (err) {
      setStatus(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus(
      "Import is not yet supported in v4.1.3. " +
      "Notes are managed by the local embedded wallet."
    );
  };

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
