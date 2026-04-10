// ---------------------------------------------------------------------------
// SCR-CREATE-MARKET (S10) — Whitelist-gated form: question, criteria, end date,
// source, bond (FR-C-1 through FR-C-3)
// ---------------------------------------------------------------------------

import { useState } from "react";
import { useWallet } from "../hooks/useWallet";
import { usePXE } from "../hooks/usePXE";
import { aztecConfig } from "../config/aztec";
import { PrivacyCallout } from "../components/safety/PrivacyCallout";

export function CreateMarket() {
  const { connected, address } = useWallet();
  const { simulateAndProve } = usePXE();
  const [question, setQuestion] = useState("");
  const [criteria, setCriteria] = useState("");
  const [source, setSource] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!connected) {
    return (
      <div className="page" style={{ textAlign: "center" }}>
        <h2>Create market</h2>
        <p style={{ color: "var(--text-muted)" }}>Connect your wallet to create a market. Whitelist required.</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const endUnix = Math.floor(new Date(endDate).getTime() / 1000);
      const txHash = await simulateAndProve(
        aztecConfig.contracts.marketFactory,
        "create_market",
        [question, criteria, source, endUnix],
        address,
      );
      setResult(`Market created. TX: ${txHash}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page" style={{ maxWidth: 560, margin: "0 auto" }}>
      <h1 style={{ marginBottom: "var(--space-6)" }}>Create market</h1>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div>
          <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: "var(--space-1)" }}>
            Question
          </label>
          <input
            type="text"
            placeholder="Will X happen before Y?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            required
            style={{ width: "100%" }}
          />
        </div>

        <div>
          <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: "var(--space-1)" }}>
            Resolution criteria
          </label>
          <textarea
            placeholder="Resolves YES if…"
            value={criteria}
            onChange={(e) => setCriteria(e.target.value)}
            required
            rows={3}
            style={{ width: "100%", height: "auto", resize: "vertical" }}
          />
        </div>

        <div>
          <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: "var(--space-1)" }}>
            Resolution source
          </label>
          <input
            type="url"
            placeholder="https://…"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            required
            style={{ width: "100%" }}
          />
        </div>

        <div>
          <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: "var(--space-1)" }}>
            End date
          </label>
          <input
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
            style={{ width: "100%" }}
          />
        </div>

        <button className="btn-primary" type="submit" disabled={loading} style={{ width: "100%" }}>
          {loading ? "Creating…" : "Create market"}
        </button>
      </form>

      {error && <p style={{ color: "var(--negative)", marginTop: "var(--space-4)", fontSize: "0.875rem" }}>{error}</p>}
      {result && <p style={{ color: "var(--positive)", marginTop: "var(--space-4)", fontSize: "0.875rem" }}>{result}</p>}

      <div style={{ marginTop: "var(--space-6)" }}>
        <PrivacyCallout context="general" />
      </div>
    </div>
  );
}
