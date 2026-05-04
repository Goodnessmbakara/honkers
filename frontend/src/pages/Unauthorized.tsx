// ---------------------------------------------------------------------------
// Unauthorized — non-admin tried to open admin-only routes
// ---------------------------------------------------------------------------

import { Link } from "react-router-dom";
import { ShieldOff } from "lucide-react";

export function Unauthorized() {
  return (
    <div className="page" style={{ maxWidth: 480, margin: "0 auto", textAlign: "center", padding: "var(--space-12) 0" }}>
      <ShieldOff size={48} style={{ color: "var(--text-muted)", marginBottom: "var(--space-4)" }} />
      <h1 style={{ marginBottom: "var(--space-2)" }}>Unauthorized</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-6)" }}>
        This area is restricted to configured admin wallets. If you need access, contact the team.
      </p>
      <Link className="btn-primary" to="/">
        Back home
      </Link>
    </div>
  );
}
