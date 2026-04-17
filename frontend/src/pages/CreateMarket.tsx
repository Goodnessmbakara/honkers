// ---------------------------------------------------------------------------
// SCR-CREATE-MARKET (S10) — Whitelist-gated form: question, criteria, end date,
// source, bond (FR-C-1 through FR-C-3)
// ---------------------------------------------------------------------------

import { useState } from "react";
import { useWallet } from "../hooks/useWallet";
import { usePXE } from "../hooks/usePXE";
import { aztecConfig } from "../config/aztec";
import { PrivacyCallout } from "../components/safety/PrivacyCallout";
import { Fr } from "@aztec/aztec.js/fields";

export function CreateMarket() {
  const { address } = useWallet();
  const { simulateAndProve } = usePXE();
  const [question, setQuestion] = useState("");
  const [criteria, setCriteria] = useState("");
  const [source, setSource] = useState("");
  const [endDate, setEndDate] = useState("");
  const [bond, setBond] = useState("10");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Hash a UTF-8 string into a field element using SHA-256 truncated to 31 bytes */
  const hashToField = async (text: string): Promise<bigint> => {
    const encoded = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
    // Truncate to 31 bytes to fit in a Noir field (< 2^254)
    const bytes = new Uint8Array(hashBuffer).slice(0, 31);
    let value = 0n;
    for (const b of bytes) {
      value = (value << 8n) | BigInt(b);
    }
    return value;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const [questionHash, criteriaHash, sourceHash] = await Promise.all([
        hashToField(question),
        hashToField(criteria),
        hashToField(source),
      ]);
      const endUnix = Math.floor(new Date(endDate).getTime() / 1000);
      const bondAmount = Math.floor(Number(bond) * 1e6); // 6 decimal USDC

      const txHash = await simulateAndProve(
        aztecConfig.contracts.marketFactory,
        "create_market",
        [
          new Fr(questionHash),
          new Fr(criteriaHash),
          new Fr(sourceHash),
          new Fr(BigInt(endUnix)),
          new Fr(BigInt(bondAmount)),
        ],
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

        <div>
          <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: "var(--space-1)" }}>
            Bond amount (USDC)
          </label>
          <input
            type="number"
            min="1"
            step="1"
            placeholder="10"
            value={bond}
            onChange={(e) => setBond(e.target.value)}
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
