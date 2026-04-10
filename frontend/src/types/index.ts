// ---------------------------------------------------------------------------
// Shared TypeScript types for the frontend
// ---------------------------------------------------------------------------

// ── Market ──────────────────────────────────────────────────────────────────

export type MarketStatus = "active" | "halted" | "resolving" | "resolved" | "voided";

export interface Market {
  marketId: number;
  questionHash: string;
  criteriaHash: string;
  sourceHash: string;
  creator: string;
  endDate: number; // unix seconds
  bond: number;
  status: MarketStatus;
  createdAt: string;
}

export interface MarketDetail extends Market {
  question?: string;
  criteria?: string;
  source?: string;
  resolution?: ResolutionStatus | null;
  yesPrice: number;
  noPrice: number;
  liquidity: number;
}

// ── Resolution ──────────────────────────────────────────────────────────────

export type ResolutionState = "none" | "proposed" | "disputed" | "finalised" | "voided";

export interface ResolutionStatus {
  marketId: number;
  state: ResolutionState;
  outcome: number | null; // 1 = YES, 0 = NO
  proposedAt: number | null;
  challengeDeadline: number | null;
  isVoidEligible: boolean;
}

// ── AMM / Pricing ───────────────────────────────────────────────────────────

export interface PricePoint {
  timestamp: string;
  yesPrice: number;
  noPrice: number;
  liquidity: number;
}

// ── Portfolio (private, from PXE) ───────────────────────────────────────────

export interface Position {
  marketId: number;
  side: "yes" | "no";
  amount: number;
  entryPrice: number;
}

export interface WinningClaim {
  marketId: number;
  amount: number;
  resolvedAt: number;
  claimed: boolean;
}

// ── API responses ───────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  pagination?: {
    total: number;
    page: number;
    limit: number;
  };
}

// ── Wallet ──────────────────────────────────────────────────────────────────

export interface WalletState {
  connected: boolean;
  address: string | null;
  syncing: boolean;
}

// ── Toast ───────────────────────────────────────────────────────────────────

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  persistent?: boolean;
}

// ── Trade ───────────────────────────────────────────────────────────────────

export type TradeSide = "yes" | "no";

export type ProofStep = "witness" | "proving" | "submitting" | "confirmed" | "failed";

export interface TradeParams {
  marketId: number;
  side: TradeSide;
  amount: number;
  maxSlippage: number;
}
