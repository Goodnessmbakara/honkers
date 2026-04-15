// ---------------------------------------------------------------------------
// SCR-FAUCET (S07) — Request testnet USDC tokens with fair-use rules
// (FR-F-1, FR-F-2)
// ---------------------------------------------------------------------------

import { useState } from "react";
import { Droplets } from "lucide-react";
import { useWallet } from "../hooks/useWallet";
import { useFaucet } from "../hooks/useFaucet";

export function Faucet() {
  const { address } = useWallet();
  const { request, loading, error, txHash, maxAmount } = useFaucet(address);
  const [amount, setAmount] = useState("10");

  return (
    <div className="page" style={{ maxWidth: 480, margin: "0 auto" }}>
      <h1 style={{ marginBottom: "var(--space-2)" }}>Testnet faucet</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-6)", fontSize: "0.875rem" }}>
        Request up to {maxAmount} testnet USDC. 1h cooldown between requests.
      </p>

      <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
        <input
          type="number"
          min="1"
          max={maxAmount}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ flex: 1 }}
        />
        <button
          className="btn-primary"
          disabled={loading}
          onClick={() => request(Number(amount))}
        >
          <Droplets size={16} />
          {loading ? "Requesting…" : "Request USDC"}
        </button>
      </div>

      {error && <p style={{ color: "var(--negative)", fontSize: "0.875rem" }}>{error}</p>}
      {txHash && (
        <p style={{ color: "var(--positive)", fontSize: "0.875rem" }}>
          Tokens sent. TX: <span className="mono">{txHash.slice(0, 12)}…</span>
        </p>
      )}
    </div>
  );
}
