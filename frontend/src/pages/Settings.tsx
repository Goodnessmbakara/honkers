// ---------------------------------------------------------------------------
// SCR-SETTINGS (S11) — RPC URL config, backup options, advanced settings
// (FR-B-*, EI-3)
// ---------------------------------------------------------------------------

import { useState } from "react";
import { Link } from "react-router-dom";
import { aztecConfig, type AztecEnvMode } from "../config/aztec";
import { NetworkStatus } from "../components/wallet/NetworkStatus";
import { useWalletContext } from "../contexts/WalletContext";

export function Settings() {
  const [pxeUrl, setPxeUrl] = useState(() => aztecConfig.pxeUrl);
  const [envMode, setEnvMode] = useState<AztecEnvMode>(() => aztecConfig.envMode);
  const [saved, setSaved] = useState(false);
  const { connectTimeline, clearConnectTimeline } = useWalletContext();

  const handleSave = () => {
    aztecConfig.setEnvMode(envMode);
    aztecConfig.setPxeUrl(pxeUrl || null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    aztecConfig.clearEnvMode();
    setEnvMode(aztecConfig.envMode);
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
        <div style={{ marginBottom: "var(--space-3)" }}>
          <label style={{ display: "block", fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: "var(--space-1)" }}>
            Network mode
          </label>
          <select value={envMode} onChange={(e) => setEnvMode(e.target.value as AztecEnvMode)} style={{ minWidth: 220 }}>
            <option value="local">local</option>
            <option value="testnet">testnet</option>
            <option value="mainnet">mainnet</option>
          </select>
        </div>
        <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: "var(--space-3)" }}>
          Override the default Aztec PXE URL. Leave empty to use platform default.
        </p>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <input
            type="url"
            placeholder="https://rpc.testnet.aztec-labs.com"
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

      <div className="card" style={{ marginTop: "var(--space-4)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
          <h3 style={{ margin: 0 }}>Connection diagnostics</h3>
          <button className="btn-ghost" onClick={clearConnectTimeline} disabled={connectTimeline.length === 0}>
            Clear
          </button>
        </div>
        {connectTimeline.length === 0 ? (
          <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", margin: 0 }}>
            No connection attempts recorded yet.
          </p>
        ) : (
          <div style={{ display: "grid", gap: "var(--space-2)", maxHeight: 260, overflow: "auto" }}>
            {[...connectTimeline].reverse().map((entry, idx) => (
              <div
                key={`${entry.at}-${entry.stage}-${idx}`}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: "8px 10px",
                  fontSize: "0.75rem",
                  background: "var(--surface)",
                }}
              >
                <div className="mono" style={{ color: "var(--text-muted)", marginBottom: 2 }}>
                  {new Date(entry.at).toLocaleString()}
                </div>
                <div style={{ color: "var(--text-primary)" }}>
                  {entry.stage}
                  {entry.detail ? ` — ${entry.detail}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
