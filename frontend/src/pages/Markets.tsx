// ---------------------------------------------------------------------------
// SCR-MARKETS (S02) — Indexer-driven grid/list: question, status, end time,
// implied odds, volume (FR-M-1)
// ---------------------------------------------------------------------------

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlusCircle } from "lucide-react";
import { useMarkets } from "../hooks/useMarkets";
import { MarketCard, MarketCardSkeleton } from "../components/market/MarketCard";
import type { MarketStatus } from "../types";

const statusFilters: { label: string; value: MarketStatus | "" }[] = [
  { label: "All", value: "" },
  { label: "Open", value: "active" },
  { label: "Resolving", value: "resolving" },
  { label: "Resolved", value: "resolved" },
  { label: "Voided", value: "voided" },
];

export function Markets() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<MarketStatus | "">("");
  const [page, setPage] = useState(1);
  const { markets, total, loading, error } = useMarkets({
    status: status || undefined,
    page,
    limit: 12,
  });

  const totalPages = Math.ceil(total / 12);

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-6)" }}>
        <h1>Markets</h1>
        <button
          className="btn-primary"
          onClick={() => navigate("/create")}
          style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}
        >
          <PlusCircle size={16} />
          Create market
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-6)" }}>
        {statusFilters.map((f) => (
          <button
            key={f.value}
            className={status === f.value ? "btn-primary" : "btn-ghost"}
            style={{ fontSize: "0.8125rem", height: 32, padding: "0 var(--space-3)" }}
            onClick={() => { setStatus(f.value); setPage(1); }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <p style={{ color: "var(--negative)", marginBottom: "var(--space-4)" }}>
          Failed to load markets: {error}
        </p>
      )}

      {/* Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "var(--space-4)",
        }}
      >
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <MarketCardSkeleton key={i} />)
          : markets?.map((m) => <MarketCard key={m.marketId} market={m} />)}
      </div>

      {(markets?.length ?? 0) === 0 && !loading && (
        <div style={{ textAlign: "center", padding: "var(--space-16) 0" }}>
          <p style={{ color: "var(--text-muted)", marginBottom: "var(--space-4)" }}>
            No markets found.
          </p>
          <button
            className="btn-primary"
            onClick={() => navigate("/create")}
            style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}
          >
            <PlusCircle size={16} />
            Create the first market
          </button>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: "var(--space-2)", marginTop: "var(--space-6)" }}>
          <button className="btn-secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span style={{ lineHeight: "40px", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            {page} / {totalPages}
          </span>
          <button className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}
