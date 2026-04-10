// ---------------------------------------------------------------------------
// SCR-LANDING (S01) — Value prop, CTA connect wallet, links to legal/privacy
// ---------------------------------------------------------------------------

import { Link } from "react-router-dom";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { WalletConnect } from "../components/wallet/WalletConnect";

export function Landing() {
  return (
    <div
      className="page"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        minHeight: "70vh",
        gap: "var(--space-8)",
      }}
    >
      {/* Wordmark */}
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 900,
          fontSize: "2.5rem",
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
        }}
      >
        honkers
      </h1>

      {/* Tagline */}
      <p
        style={{
          fontSize: "1.25rem",
          color: "var(--text-secondary)",
          maxWidth: 480,
        }}
      >
        Trade predictions. Keep your positions private.
      </p>

      {/* Privacy note */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          color: "var(--text-muted)",
          fontSize: "0.875rem",
        }}
      >
        <ShieldCheck size={16} style={{ color: "var(--accent)" }} />
        Built on Aztec — private by default
      </div>

      {/* CTA */}
      <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
        <WalletConnect />
        <Link to="/markets" className="btn-secondary" style={{ textDecoration: "none" }}>
          Browse markets <ArrowRight size={16} />
        </Link>
      </div>

      {/* Legal links */}
      <div style={{ display: "flex", gap: "var(--space-4)", fontSize: "0.75rem", color: "var(--text-muted)" }}>
        <Link to="/terms" style={{ color: "var(--text-muted)" }}>Terms of service</Link>
        <Link to="/privacy" style={{ color: "var(--text-muted)" }}>Privacy model</Link>
        <Link to="/risk" style={{ color: "var(--text-muted)" }}>Risk disclosure</Link>
      </div>
    </div>
  );
}
