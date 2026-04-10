// ---------------------------------------------------------------------------
// SCR-ADMIN-HOME (S19) — Admin dashboard: ops overview, markets needing
// attention (FR-A-1)
// ---------------------------------------------------------------------------

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMarkets } from "../hooks/useMarkets";
import { AdminMarketTable } from "../components/admin/AdminMarketTable";
import { Shield } from "lucide-react";

export function AdminHome() {
  const { markets, loading } = useMarkets();
  const navigate = useNavigate();
  const [_filter] = useState("all");

  return (
    <div className="page">
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-6)" }}>
        <Shield size={20} style={{ color: "var(--accent)" }} />
        <h1>Admin</h1>
      </div>

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
