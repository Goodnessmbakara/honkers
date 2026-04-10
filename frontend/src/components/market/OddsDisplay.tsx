// ---------------------------------------------------------------------------
// CMP-ODDS-DISPLAY — YES/NO prices from public AMM state
// ---------------------------------------------------------------------------

export function OddsDisplay({ yesPrice, noPrice }: { yesPrice: number; noPrice: number }) {
  const yesPct = Math.round(yesPrice * 100);
  const noPct = Math.round(noPrice * 100);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
      <span style={{ color: "var(--positive)", fontWeight: 500 }}>
        YES {yesPct}¢
      </span>
      <div
        style={{
          flex: 1,
          height: 6,
          borderRadius: "var(--radius-sm)",
          overflow: "hidden",
          display: "flex",
        }}
      >
        <div style={{ width: `${yesPct}%`, background: "var(--positive)" }} />
        <div style={{ width: `${noPct}%`, background: "var(--negative)" }} />
      </div>
      <span style={{ color: "var(--negative)", fontWeight: 500 }}>
        NO {noPct}¢
      </span>
    </div>
  );
}
