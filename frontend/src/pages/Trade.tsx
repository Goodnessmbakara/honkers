// ---------------------------------------------------------------------------
// SCR-TRADE (S04) — Side selector, size input, estimated cost, slippage,
// fee=0, proof UX (FR-T-1 through FR-T-5)
// ---------------------------------------------------------------------------

import { useParams } from "react-router-dom";
import { useMarketDetail } from "../hooks/useMarkets";
import { useTrade } from "../hooks/useTrade";
import { useWallet } from "../hooks/useWallet";
import { usePortfolio } from "../hooks/usePortfolio";
import { useFaucet } from "../hooks/useFaucet";
import { TradeForm } from "../components/trading/TradeForm";
import { ProofProgress } from "../components/trading/ProofProgress";
import { TxStatus } from "../components/trading/TxStatus";
import { OddsDisplay } from "../components/market/OddsDisplay";
import { PrivacyCallout } from "../components/safety/PrivacyCallout";
import { WalletConnect } from "../components/wallet/WalletConnect";
import { useWalletContext } from "../contexts/WalletContext";

export function Trade() {
  const { id } = useParams<{ id: string }>();
  const marketId = id ? Number(id) : null;
  const { market, loading, error: marketError } = useMarketDetail(marketId);
  const { connected, address } = useWallet();
  const { walletType, connectWithEmbeddedPXE, disconnect } = useWalletContext();
  const isAzguard = walletType === "azguard";
  const { balance } = usePortfolio(address);
  const { step, elapsed, txHash, txHashes, error, execute, cancel, reset } = useTrade();
  const { request: requestFaucet, loading: faucetLoading, error: faucetError } = useFaucet(address);

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

      {/* Azguard incompatibility warning */}
      {isAzguard && connected && (
        <div style={{
          marginBottom: "var(--space-4)",
          padding: "var(--space-3) var(--space-4)",
          background: "rgba(234,179,8,0.08)",
          border: "1px solid rgba(234,179,8,0.3)",
          borderRadius: "var(--radius-md)",
          fontSize: "0.8125rem",
          color: "var(--text-primary)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-2)",
        }}>
          <div style={{ fontWeight: 600, color: "#ca8a04" }}>
            Azguard does not support private transactions yet
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
            Trading requires Browser Wallet (in-app PXE). Switch wallets to continue.
          </div>
          <button
            onClick={async () => { disconnect(); await connectWithEmbeddedPXE(); }}
            style={{
              alignSelf: "flex-start",
              padding: "5px 14px",
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--radius-full)",
              cursor: "pointer",
              fontSize: "0.75rem",
              fontWeight: 600,
            }}
          >
            Switch to Browser Wallet
          </button>
        </div>
      )}

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
              onFaucet={() => void requestFaucet(10000)}
              faucetError={faucetError}
              faucetLoading={faucetLoading}
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
