// ---------------------------------------------------------------------------
// SCR-GEO-BLOCK (S16) — Jurisdiction blocked screen (FR-L-3)
// ---------------------------------------------------------------------------

export function GeoBlocked() {
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
      <h1 style={{ marginBottom: "var(--space-4)" }}>Access restricted</h1>
      <p style={{ color: "var(--text-secondary)", maxWidth: 480 }}>
        Honkers is not available in your jurisdiction. If you believe this is
        an error, please contact the team.
      </p>
    </div>
  );
}
