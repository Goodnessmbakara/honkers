// ---------------------------------------------------------------------------
// SCR-RISK (S15) — Risk disclosure (FR-L-1)
// ---------------------------------------------------------------------------

export function Risk() {
  return (
    <div className="page" style={{ maxWidth: 640, margin: "0 auto" }}>
      <h1 style={{ marginBottom: "var(--space-6)" }}>Risk disclosure</h1>
      <div style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.6, display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <p>
          Prediction markets carry inherent risks. Even on testnet, understanding
          these risks helps you evaluate the protocol.
        </p>
        <h2 style={{ color: "var(--text-primary)" }}>Smart contract risk</h2>
        <p>
          Contracts have not been formally audited. Bugs may cause loss of testnet
          tokens or incorrect market resolution.
        </p>
        <h2 style={{ color: "var(--text-primary)" }}>Oracle risk</h2>
        <p>
          Phase 1 uses a single admin EOA for resolution. This is a centralisation
          risk mitigated by the 24h challenge window and 72h auto-void.
        </p>
        <h2 style={{ color: "var(--text-primary)" }}>Privacy limitations</h2>
        <p>
          AMM price movements are public and may leak aggregate trading information.
          L1 bridge activity is visible on Ethereum. See the privacy model page for details.
        </p>
        <h2 style={{ color: "var(--text-primary)" }}>Data loss</h2>
        <p>
          Private notes are stored locally. Clearing browser data without a backup
          results in permanent loss of positions and balances.
        </p>
      </div>
    </div>
  );
}
