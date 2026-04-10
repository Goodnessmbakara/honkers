// ---------------------------------------------------------------------------
// SCR-MAINTENANCE (S21) — Protocol paused / emergency migration messaging
// (FR-A-4)
// ---------------------------------------------------------------------------

export function Maintenance() {
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
      <h1 style={{ marginBottom: "var(--space-4)" }}>Under maintenance</h1>
      <p style={{ color: "var(--text-secondary)", maxWidth: 480 }}>
        Honkers is currently paused for maintenance. Your funds and positions
        are safe. Check back shortly.
      </p>
    </div>
  );
}
