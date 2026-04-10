// ---------------------------------------------------------------------------
// CMP-PRIVACY-CALLOUT — Short AMM price impact + L1 leakage disclosure
// ---------------------------------------------------------------------------

import { ShieldCheck } from "lucide-react";

export function PrivacyCallout({ context }: { context?: "deposit" | "trade" | "general" }) {
  const messages: Record<string, string> = {
    deposit:
      "Your L1 address and deposit amount are visible on Ethereum. Your Aztec recipient is hidden.",
    trade:
      "Positions are hidden in private notes. AMM price changes are public and may reveal aggregate trading activity.",
    general:
      "Honkers uses Aztec private notes. Individual positions are hidden, but AMM state is public.",
  };

  return (
    <div
      style={{
        background: "rgba(59, 130, 246, 0.08)",
        border: "1px solid rgba(59, 130, 246, 0.15)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-3) var(--space-4)",
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--space-3)",
        fontSize: "0.8125rem",
        color: "var(--text-secondary)",
      }}
    >
      <ShieldCheck size={16} style={{ color: "var(--info)", flexShrink: 0, marginTop: 2 }} />
      <span>{messages[context ?? "general"]}</span>
    </div>
  );
}
