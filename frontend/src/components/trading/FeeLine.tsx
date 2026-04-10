// ---------------------------------------------------------------------------
// CMP-FEE-LINE — Phase 1: shows "Fee: 0"; prepped for Phase 2 breakdown
// ---------------------------------------------------------------------------

export function FeeLine() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: "0.8125rem",
        color: "var(--text-muted)",
      }}
    >
      <span>Trading fee</span>
      <span>0 (Phase 1)</span>
    </div>
  );
}
