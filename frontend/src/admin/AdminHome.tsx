// ---------------------------------------------------------------------------
// SCR-ADMIN-HOME (S19) — Admin dashboard: ops overview, markets needing
// attention (FR-A-1)
// ---------------------------------------------------------------------------

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMarkets } from "../hooks/useMarkets";
import { AdminMarketTable } from "../components/admin/AdminMarketTable";
import { Shield } from "lucide-react";
import { getAdminAddresses } from "../utils/adminAuth";

export function AdminHome() {
  const { markets, loading } = useMarkets();
  const navigate = useNavigate();
  const [_filter] = useState("all");
  const adminConfigured = getAdminAddresses().length > 0;

  return (
    <div className="page">
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-6)" }}>
        <Shield size={20} style={{ color: "var(--accent)" }} />
        <h1>Admin</h1>
      </div>

      {!adminConfigured ? (
        <p
          style={{
            fontSize: "0.875rem",
            color: "var(--warning)",
            marginBottom: "var(--space-4)",
            padding: "var(--space-3)",
            border: "1px solid var(--border)",
            borderRadius: 8,
          }}
        >
          Set <code className="mono">VITE_ADMIN_ADDRESSES</code> (comma-separated Aztec addresses) in{" "}
          <code className="mono">frontend/.env</code> so only designated wallets can open admin routes in production.
        </p>
      ) : null}

      {/* Stats row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "var(--space-4)",
          marginBottom: "var(--space-6)",
        }}
      >
        {([
          { label: "Total markets", value: markets.length },
          { label: "Active", value: markets.filter((m) => m.status === "active").length },
          { label: "Resolving", value: markets.filter((m) => m.status === "resolving").length },
          { label: "Halted", value: markets.filter((m) => m.status === "halted").length },
        ] as const).map((s) => (
          <div key={s.label} className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "1.5rem", fontFamily: "var(--font-display)", fontWeight: 700 }}>
              {loading ? "—" : s.value}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <AdminMarketTable
        markets={markets}
        onSelect={(id) => navigate(`/admin/market/${id}`)}
      />
    </div>
  );
}
