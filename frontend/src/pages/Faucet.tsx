// ---------------------------------------------------------------------------
// SCR-FAUCET (S07) — Request testnet USDh tokens with fair-use rules
// ---------------------------------------------------------------------------

import { useState } from "react";
import { Droplets } from "lucide-react";
import { useWallet } from "../hooks/useWallet";
import { useFaucet } from "../hooks/useFaucet";
import { WalletConnect } from "../components/wallet/WalletConnect";

export function Faucet() {
  const { address, connected } = useWallet();
  const { request, loading, error, txHash, maxAmount } = useFaucet(address);
  const [amount, setAmount] = useState("10000");

  return (
    <div className="page" style={{ maxWidth: 480, margin: "0 auto" }}>
      <h1 style={{ marginBottom: "var(--space-2)" }}>Testnet faucet</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-6)", fontSize: "0.875rem" }}>
        Mint up to {maxAmount} USDh to your wallet. 1h cooldown between requests.
      </p>

      {!connected ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--space-3)" }}>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>Connect your wallet to request tokens.</p>
          <WalletConnect />
        </div>
      ) : (
        <>
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
              onClick={() => void request(Number(amount))}
            >
              <Droplets size={16} />
              {loading ? "Requesting…" : "Request USDh"}
            </button>
          </div>

          {error && (
            <p style={{ color: "var(--negative)", fontSize: "0.875rem", marginBottom: "var(--space-2)" }}>
              {error}
            </p>
          )}
          {txHash && (
            <p style={{ color: "var(--positive)", fontSize: "0.875rem" }}>
              ✓ {Number(amount).toLocaleString()} USDh minted. TX:{" "}
              <a
                href={`https://testnet.aztecscan.xyz/tx-effects/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--positive)", textDecoration: "underline" }}
              >
                {txHash.slice(0, 16)}…
              </a>
            </p>
          )}
        </>
      )}
    </div>
  );
}
