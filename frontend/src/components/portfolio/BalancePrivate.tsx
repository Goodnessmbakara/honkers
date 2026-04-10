// ---------------------------------------------------------------------------
// CMP-BALANCE-PRIVATE — Private USDC balance from PXE
// ---------------------------------------------------------------------------

export function BalancePrivate({ amount, loading }: { amount: number; loading?: boolean }) {
  if (loading) {
    return <div className="skeleton" style={{ width: 120, height: 32 }} />;
  }

  const formatted = (amount / 1e6).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div>
      <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Private balance</span>
      <div style={{ fontSize: "2rem", fontFamily: "var(--font-display)", fontWeight: 700 }}>
        {formatted} <span style={{ fontSize: "1rem", color: "var(--text-secondary)" }}>USDC</span>
      </div>
    </div>
  );
}
