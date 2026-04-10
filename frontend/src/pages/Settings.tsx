// ---------------------------------------------------------------------------
// SCR-SETTINGS (S11) — RPC URL config, backup options, advanced settings
// (FR-B-*, EI-3)
// ---------------------------------------------------------------------------

import { useState } from "react";
import { Link } from "react-router-dom";
import { aztecConfig } from "../config/aztec";
import { NetworkStatus } from "../components/wallet/NetworkStatus";

export function Settings() {
  const [pxeUrl, setPxeUrl] = useState(() => aztecConfig.pxeUrl);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    aztecConfig.setPxeUrl(pxeUrl || null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    aztecConfig.setPxeUrl(null);
    setPxeUrl(aztecConfig.pxeUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="page" style={{ maxWidth: 560, margin: "0 auto" }}>
      <h1 style={{ marginBottom: "var(--space-6)" }}>Settings</h1>

      {/* Network status */}
      <div className="card" style={{ marginBottom: "var(--space-4)" }}>
        <h3 style={{ marginBottom: "var(--space-3)" }}>Network</h3>
        <NetworkStatus />
      </div>

      {/* PXE URL */}
      <div className="card" style={{ marginBottom: "var(--space-4)" }}>
        <h3 style={{ marginBottom: "var(--space-3)" }}>PXE endpoint</h3>
        <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: "var(--space-3)" }}>
          Override the default Aztec PXE URL. Leave empty to use platform default.
        </p>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <input
            type="url"
            placeholder="http://localhost:8080"
            value={pxeUrl}
            onChange={(e) => setPxeUrl(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="btn-primary" onClick={handleSave}>Save</button>
          <button className="btn-ghost" onClick={handleReset}>Reset</button>
        </div>
        {saved && <p style={{ color: "var(--positive)", fontSize: "0.75rem", marginTop: "var(--space-2)" }}>Saved.</p>}
      </div>

      {/* Backup shortcut */}
      <div className="card">
        <h3 style={{ marginBottom: "var(--space-3)" }}>Data</h3>
        <Link to="/backup" className="btn-secondary" style={{ textDecoration: "none" }}>
          Manage backups
        </Link>
      </div>
    </div>
  );
}
