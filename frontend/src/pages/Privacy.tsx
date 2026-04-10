// ---------------------------------------------------------------------------
// SCR-PRIVACY (S13) — Honest privacy model disclosure: L1 visibility, AMM
// leakage, metadata (FR-L-2)
// ---------------------------------------------------------------------------

export function Privacy() {
  return (
    <div className="page" style={{ maxWidth: 640, margin: "0 auto" }}>
      <h1 style={{ marginBottom: "var(--space-6)" }}>Privacy model</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.6 }}>
        <section>
          <h2 style={{ color: "var(--text-primary)", marginBottom: "var(--space-3)" }}>What is private</h2>
          <ul style={{ paddingLeft: "var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <li>Your individual positions are stored as private notes on Aztec, invisible to other users and the indexer.</li>
            <li>Trade amounts and directions are hidden inside zero-knowledge proofs.</li>
            <li>Your Aztec address is not linked to your L1 address on-chain.</li>
          </ul>
        </section>

        <section>
          <h2 style={{ color: "var(--text-primary)", marginBottom: "var(--space-3)" }}>What is public</h2>
          <ul style={{ paddingLeft: "var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <li>AMM state (reserves, prices) is public. Large trades visibly move the price.</li>
            <li>L1 bridge deposits—your Ethereum address and deposit amount are visible on L1.</li>
            <li>Market creation metadata (question, criteria, end date) is public by design.</li>
            <li>Resolution proposals and outcomes are public.</li>
          </ul>
        </section>

        <section>
          <h2 style={{ color: "var(--text-primary)", marginBottom: "var(--space-3)" }}>Metadata risks</h2>
          <p>
            Timing analysis may correlate L1 deposits with subsequent Aztec activity.
            IP addresses are visible to the PXE/RPC operator unless you use a VPN or Tor.
            Honkers operates a non-logging proxy by default, but this is a trust assumption.
          </p>
        </section>
      </div>
    </div>
  );
}
