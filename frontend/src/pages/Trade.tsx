// ---------------------------------------------------------------------------
// SCR-TRADE (S04) — Side selector, size input, estimated cost, slippage,
// fee=0, proof UX (FR-T-1 through FR-T-5)
// ---------------------------------------------------------------------------

import { useParams } from "react-router-dom";
import { useMarketDetail } from "../hooks/useMarkets";
import { useTrade } from "../hooks/useTrade";
import { useWallet } from "../hooks/useWallet";
import { usePortfolio } from "../hooks/usePortfolio";
import { TradeForm } from "../components/trading/TradeForm";
import { ProofProgress } from "../components/trading/ProofProgress";
import { TxStatus } from "../components/trading/TxStatus";
import { OddsDisplay } from "../components/market/OddsDisplay";
import { PrivacyCallout } from "../components/safety/PrivacyCallout";
import { WalletConnect } from "../components/wallet/WalletConnect";

export function Trade() {
  const { id } = useParams<{ id: string }>();
  const marketId = id ? Number(id) : null;
  const { market, loading, error: marketError } = useMarketDetail(marketId);
  const { connected, address } = useWallet();
  const { balance } = usePortfolio(address);
  const { step, elapsed, txHash, txHashes, error, execute, cancel, reset } = useTrade();

  if (loading) {
    return (
      <div className="page">
        <div className="skeleton" style={{ width: "60%", height: 28, marginBottom: "var(--space-4)" }} />
        <div className="skeleton" style={{ width: "100%", height: 300 }} />
      </div>
    );
  }

  if (!market) {
    return (
      <div className="page">
        <h2>Market not found</h2>
        <p style={{ color: "var(--text-muted)" }}>{marketError ?? "Could not load this market."}</p>
      </div>
    );
  }

  if (market.status !== "active") {
    return (
      <div className="page">
        <h2>Market is not active</h2>
        <p style={{ color: "var(--text-muted)" }}>This market is {market.status} and cannot be traded.</p>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 480, margin: "0 auto" }}>
      <h2 style={{ marginBottom: "var(--space-4)" }}>
        {market.question ?? `Market #${market.marketId}`}
      </h2>

      <div style={{ marginBottom: "var(--space-4)" }}>
        <OddsDisplay yesPrice={market.yesPrice} noPrice={market.noPrice} />
      </div>

      {/* Proof in progress */}
      {step && step !== "confirmed" && step !== "failed" && (
        <ProofProgress step={step} elapsed={elapsed} onCancel={cancel} />
      )}

      {/* TX result */}
      {(step === "confirmed" || step === "failed") && (
        <div style={{ marginBottom: "var(--space-4)" }}>
          <TxStatus
            status={step === "confirmed" ? "confirmed" : "failed"}
            txHash={txHash}
            txHashes={
              txHashes
                ? [
                    { label: "Deposit", hash: txHashes[0] },
                    { label: "Buy shares", hash: txHashes[1] },
                  ]
                : undefined
            }
            error={error}
            onRetry={reset}
          />
        </div>
      )}

      {/* Trade form — only when idle */}
      {!step && (
        <>
          {!connected ? (
            <div style={{ textAlign: "center", padding: "var(--space-8) 0" }}>
              <p style={{ color: "var(--text-muted)", marginBottom: "var(--space-4)" }}>
                Connect your wallet to trade.
              </p>
              <WalletConnect />
            </div>
          ) : (
            <TradeForm
              yesPrice={market.yesPrice}
              noPrice={market.noPrice}
              maxBalance={balance}
              onSubmit={(side, amount) => {
                if (!address) return;
                execute({ marketId: market.marketId, side, amount, maxSlippage: 500 }, address);
              }}
            />
          )}
        </>
      )}

      <div style={{ marginTop: "var(--space-6)" }}>
        <PrivacyCallout context="trade" />
      </div>
    </div>
  );
}
