// ---------------------------------------------------------------------------
// SCR-TOS (S14) — Terms of Service (FR-L-1)
// ---------------------------------------------------------------------------

export function Terms() {
  return (
    <div className="page" style={{ maxWidth: 640, margin: "0 auto" }}>
      <h1 style={{ marginBottom: "var(--space-6)" }}>Terms of service</h1>
      <div style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.6, display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <p>Last updated: April 2026</p>
        <p>
          Honkers is a testnet-only prediction market protocol. No real funds are at risk.
          By using this application, you agree to the following terms.
        </p>
        <h2 style={{ color: "var(--text-primary)" }}>1. Testnet disclaimer</h2>
        <p>
          All tokens (USDC) on this platform are testnet tokens with no monetary value.
          This is experimental software provided as-is with no warranty.
        </p>
        <h2 style={{ color: "var(--text-primary)" }}>2. Eligibility</h2>
        <p>
          You must not access this platform from a restricted jurisdiction.
          Anyone may propose a market subject to the posted bond and protocol rules; invalid markets may be voided per resolution policy.
        </p>
        <h2 style={{ color: "var(--text-primary)" }}>3. Risks</h2>
        <p>
          Smart contracts may contain bugs. Proofs may fail. Browser data loss
          without a backup results in permanent loss of private notes.
        </p>
        <h2 style={{ color: "var(--text-primary)" }}>4. Limitation of liability</h2>
        <p>
          Honkers contributors are not liable for any loss arising from the use
          of this protocol.
        </p>
      </div>
    </div>
  );
}
