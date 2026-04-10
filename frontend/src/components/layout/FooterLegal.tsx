// ---------------------------------------------------------------------------
// CMP-FOOTER-LEGAL — ToS, Privacy, Risk links
// ---------------------------------------------------------------------------

import { Link } from "react-router-dom";

export function FooterLegal() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--border)",
        padding: "var(--space-6) 0",
        marginTop: "var(--space-10)",
      }}
    >
      <div
        className="container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: "0.75rem",
          color: "var(--text-muted)",
        }}
      >
        <span>© {new Date().getFullYear()} Honkers. Testnet only — no real funds.</span>
        <nav style={{ display: "flex", gap: "var(--space-4)" }}>
          <Link to="/terms" style={{ color: "var(--text-muted)" }}>Terms</Link>
          <Link to="/privacy" style={{ color: "var(--text-muted)" }}>Privacy</Link>
          <Link to="/risk" style={{ color: "var(--text-muted)" }}>Risk</Link>
        </nav>
      </div>
    </footer>
  );
}
