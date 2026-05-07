// ---------------------------------------------------------------------------
// CMP-TRADE-FORM — Side selector (YES/NO), size input, estimated cost,
// validation
// ---------------------------------------------------------------------------

import { useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { TradeSide } from "../../types";
import { SlippageWarning } from "./SlippageWarning";
import { FeeLine } from "./FeeLine";

interface Props {
  yesPrice: number;
  noPrice: number;
  maxBalance: number;
  onSubmit: (side: TradeSide, amount: number) => void;
  onFaucet?: () => void;
  faucetLoading?: boolean;
  faucetError?: string | null;
  disabled?: boolean;
}

export function TradeForm({ yesPrice, noPrice, maxBalance, onSubmit, onFaucet, faucetLoading, faucetError, disabled }: Props) {
  const [side, setSide] = useState<TradeSide>("yes");
  const [amount, setAmount] = useState("");
  const parsedAmount = Number(amount) || 0;
  const price = side === "yes" ? yesPrice : noPrice;
  const estimatedShares = parsedAmount > 0 && price > 0 ? parsedAmount / price : 0;
  const isValid = parsedAmount > 0 && parsedAmount <= maxBalance;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {/* Side selector */}
      <div style={{ display: "flex", gap: "var(--space-2)" }}>
        <button
          className={side === "yes" ? "btn-primary" : "btn-secondary"}
          style={{
            flex: 1,
            background: side === "yes" ? "var(--positive)" : undefined,
            color: side === "yes" ? "var(--bg)" : undefined,
          }}
          onClick={() => setSide("yes")}
        >
          <TrendingUp size={16} /> YES {Math.round(yesPrice * 100)}%
        </button>
        <button
          className={side === "no" ? "btn-primary" : "btn-secondary"}
          style={{
            flex: 1,
            background: side === "no" ? "var(--negative)" : undefined,
            color: side === "no" ? "var(--bg)" : undefined,
          }}
          onClick={() => setSide("no")}
        >
          <TrendingDown size={16} /> NO {Math.round(noPrice * 100)}%
        </button>
      </div>

      {/* Amount input */}
      <div>
        <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "var(--space-1)", display: "block" }}>
          Amount (USDh)
        </label>
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ width: "100%" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--space-1)", fontSize: "0.75rem", color: "var(--text-muted)" }}>
          <span>Balance: {(maxBalance / 1e6).toFixed(2)}</span>
          <button className="btn-ghost" style={{ fontSize: "0.75rem" }} onClick={() => setAmount(String(maxBalance / 1e6))}>
            Max
          </button>
        </div>
        {maxBalance === 0 && onFaucet && (
          <div>
            <button
              className="btn-ghost"
              style={{ fontSize: "0.75rem", color: "var(--accent)", marginTop: "var(--space-1)", padding: 0, textAlign: "left" }}
              onClick={onFaucet}
              disabled={faucetLoading}
            >
              {faucetLoading ? "Requesting 10,000 USDh…" : "⚡ Get test USDh"}
            </button>
            {faucetError && (
              <p style={{ fontSize: "0.75rem", color: "var(--negative)", marginTop: "var(--space-1)" }}>
                {faucetError}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Estimated shares */}
      {parsedAmount > 0 && (
        <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
          ≈ {estimatedShares.toFixed(2)} shares @ {(price * 100).toFixed(1)}%
        </div>
      )}

      <SlippageWarning amount={parsedAmount} />
      <FeeLine />

      <button
        className="btn-primary"
        style={{
          width: "100%",
          background: side === "yes" ? "var(--positive)" : "var(--negative)",
        }}
        disabled={!isValid || disabled}
        onClick={() => onSubmit(side, parsedAmount * 1e6)}
      >
        {side === "yes" ? "Buy YES" : "Buy NO"}
      </button>
    </div>
  );
}
