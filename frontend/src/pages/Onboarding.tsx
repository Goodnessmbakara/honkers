// ---------------------------------------------------------------------------
// Testnet onboarding checklist — connect, backup, faucet, first trade
// ---------------------------------------------------------------------------

import { Link } from "react-router-dom";
import { CheckCircle2, Circle } from "lucide-react";
import { useWallet } from "../hooks/useWallet";
import { hasStoredWalletSecret } from "../utils/browserSecretVault";

export function Onboarding() {
  const { connected, address } = useWallet();
  const hasSecret = typeof window !== "undefined" && hasStoredWalletSecret();
  const dismissedBackup = localStorage.getItem("honkers:backup-dismissed") === "1";

  const steps = [
    { id: "connect", label: "Connect wallet", done: connected && !!address },
    { id: "backup", label: "Save secret key (Backup)", done: hasSecret && dismissedBackup },
    { id: "faucet", label: "Get test USDC (Faucet)", done: false },
    { id: "trade", label: "Open a market and trade", done: false },
  ];

  return (
    <div className="page" style={{ maxWidth: 560, margin: "0 auto" }}>
      <h1 style={{ marginBottom: "var(--space-2)" }}>Testnet setup</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-6)", fontSize: "0.875rem" }}>
        Complete these steps once to use Honkers on Aztec public testnet.
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {steps.map((s) => (
          <li
            key={s.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              padding: "var(--space-4)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              background: "var(--surface-raised)",
            }}
          >
            {s.done ? (
              <CheckCircle2 size={22} style={{ color: "var(--positive)", flexShrink: 0 }} />
            ) : (
              <Circle size={22} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            )}
            <span style={{ flex: 1 }}>{s.label}</span>
            {s.id === "backup" && (
              <Link className="btn-secondary" to="/backup" style={{ fontSize: "0.8125rem" }}>
                Backup
              </Link>
            )}
            {s.id === "faucet" && (
              <Link className="btn-secondary" to="/faucet" style={{ fontSize: "0.8125rem" }}>
                Faucet
              </Link>
            )}
            {s.id === "trade" && (
              <Link className="btn-secondary" to="/markets" style={{ fontSize: "0.8125rem" }}>
                Markets
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
