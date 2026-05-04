// ---------------------------------------------------------------------------
// SCR-NETWORK-ERROR (S17) — Wrong network / incompatible PXE detection +
// recovery steps (FR-W-2)
// ---------------------------------------------------------------------------

import { Link } from "react-router-dom";

export function NetworkError() {
  return (
    <div
      className="page"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        textAlign: "center",
      }}
    >
      <h1 style={{ marginBottom: "var(--space-4)" }}>Network error</h1>
      <p style={{ color: "var(--text-secondary)", maxWidth: 480, marginBottom: "var(--space-6)" }}>
        Unable to connect to Aztec testnet RPC. Check your internet connection
        or update the RPC URL in settings.
      </p>
      <div style={{ display: "flex", gap: "var(--space-3)" }}>
        <button className="btn-primary" onClick={() => window.location.reload()}>
          Retry
        </button>
        <Link to="/settings" className="btn-secondary" style={{ textDecoration: "none" }}>
          Settings
        </Link>
      </div>
    </div>
  );
}
