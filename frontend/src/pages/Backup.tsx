// ---------------------------------------------------------------------------
// SCR-BACKUP (S12) — Secret key backup + optional IndexedDB export
//
// v4.1.3: Notes are stored encrypted on-chain and can be recovered by PXE
// using your secret key. The primary backup is your secret key. The IndexedDB
// export is a convenience for faster restore (avoids full chain re-sync).
// ---------------------------------------------------------------------------

import { useCallback, useRef, useState } from "react";
import { Copy, Check, Download, Upload, KeyRound, Database, ShieldAlert, Info } from "lucide-react";

const SECRET_KEY = "honkers:wallet-secret";

export function Backup() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);

  const secret = localStorage.getItem(SECRET_KEY);

  const copySecret = useCallback(async () => {
    if (!secret) return;
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [secret]);

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

    try {
      setStatus("Importing…");
      const text = await file.text();
      const payload = JSON.parse(text);

      if (payload.version !== 1 || !payload.localStorage) {
        setStatus("Invalid backup file format.");
        return;
      }

      // Restore localStorage keys
      if (payload.localStorage) {
        for (const [key, value] of Object.entries(payload.localStorage)) {
          if (key.startsWith("honkers:")) {
            localStorage.setItem(key, value as string);
          }
        }
      }

      setStatus(
        "Wallet credentials restored. Reload the page to reconnect with your restored key."
      );
    } catch (err) {
      setStatus(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="page" style={{ maxWidth: 520, margin: "0 auto" }}>
      <h1 style={{ marginBottom: "var(--space-2)" }}>Backup &amp; recovery</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-6)", fontSize: "0.875rem" }}>
        Your private notes are encrypted on-chain. With your secret key, you can
        recover your wallet and notes on any device.
      </p>

      {/* ── Secret key section ────────────────────────────────────────── */}
      <div
        style={{
          background: "var(--surface-raised)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "var(--space-4)",
          marginBottom: "var(--space-4)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
          <KeyRound size={16} style={{ color: "var(--accent)" }} />
          <h3 style={{ margin: 0, fontSize: "0.9375rem" }}>Secret key</h3>
        </div>

        {secret ? (
          <>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.8125rem", marginBottom: "var(--space-3)" }}>
              This key controls your wallet. Save it somewhere secure — anyone
              with this key can access your funds.
            </p>

            {showSecret ? (
              <div style={{ marginBottom: "var(--space-3)" }}>
                <code
                  className="mono"
                  style={{
                    display: "block",
                    background: "var(--surface)",
                    padding: "var(--space-3)",
                    borderRadius: 6,
                    fontSize: "0.75rem",
                    wordBreak: "break-all",
                    userSelect: "all",
                    border: "1px solid var(--border)",
                  }}
                >
                  {secret}
                </code>
              </div>
            ) : null}

            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <button
                className="btn-secondary"
                onClick={() => setShowSecret((s) => !s)}
                style={{ fontSize: "0.8125rem" }}
              >
                <ShieldAlert size={14} />
                {showSecret ? "Hide" : "Reveal"} key
              </button>
              <button
                className="btn-secondary"
                onClick={copySecret}
                style={{ fontSize: "0.8125rem" }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </>
        ) : (
          <p style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>
            No wallet connected. Connect your wallet to see your secret key.
          </p>
        )}
      </div>

      {/* ── How recovery works ────────────────────────────────────────── */}
      <div
        style={{
          background: "var(--surface-raised)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "var(--space-4)",
          marginBottom: "var(--space-4)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
          <Info size={16} style={{ color: "var(--text-secondary)" }} />
          <h3 style={{ margin: 0, fontSize: "0.9375rem" }}>How recovery works</h3>
        </div>
        <ul style={{ color: "var(--text-secondary)", fontSize: "0.8125rem", margin: 0, paddingLeft: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <li>Your notes (balances, positions) are stored <strong>encrypted on the Aztec chain</strong></li>
          <li>Your browser keeps a decrypted cache in IndexedDB for fast access</li>
          <li>If you clear browser data, your wallet <strong>re-syncs from the chain</strong> automatically using your secret key</li>
          <li>The secret key is the only thing you truly need to back up</li>
        </ul>
      </div>

      {/* ── Advanced: IndexedDB export/import ─────────────────────────── */}
      <div
        style={{
          background: "var(--surface-raised)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "var(--space-4)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
          <Database size={16} style={{ color: "var(--text-secondary)" }} />
          <h3 style={{ margin: 0, fontSize: "0.9375rem" }}>Advanced: local cache</h3>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.8125rem", marginBottom: "var(--space-3)" }}>
          Export the browser's PXE cache for faster restore (avoids re-syncing from chain).
          This is optional — your notes can always be recovered from the chain.
        </p>

        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <button className="btn-secondary" onClick={handleExport} style={{ fontSize: "0.8125rem" }}>
            <Download size={14} /> Export cache
          </button>
          <button className="btn-secondary" onClick={() => fileRef.current?.click()} style={{ fontSize: "0.8125rem" }}>
            <Upload size={14} /> Import backup
          </button>
          <input ref={fileRef} type="file" accept=".json" onChange={handleImport} style={{ display: "none" }} />
        </div>
      </div>

      {status && (
        <p style={{ marginTop: "var(--space-4)", fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
          {status}
        </p>
      )}
    </div>
  );
}
