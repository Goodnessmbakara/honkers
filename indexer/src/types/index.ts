// ---------------------------------------------------------------------------
// Shared TypeScript types for the Honkers indexer.
// Maps to the PostgreSQL schema and the contract public state.
// No private note types here — those live only in PXE (COM-2).
// ---------------------------------------------------------------------------

/** Market status derived from oracle resolution state + timestamps. */
export enum MarketStatus {
  Open = "open",
  Halted = "halted",
  ResolutionProposed = "resolution_proposed",
  Disputed = "disputed",
  Resolved = "resolved",
  Voided = "voided",
}

/** Row in the `markets` table. */
export interface Market {
  id: number;
  marketId: string; // on-chain Field as hex string
  questionHash: string;
  questionText: string | null; // stored off-chain, manually populated
  criteriaHash: string;
  criteriaText: string | null;
  sourceHash: string;
  sourceText: string | null;
  creator: string; // AztecAddress hex
  endDate: Date;
  bondAmount: string; // bigint as string
  status: MarketStatus;
  createdAt: Date;
  updatedAt: Date;
}

/** Row in the `resolutions` table. */
export interface Resolution {
  id: number;
  marketId: string;
  proposedOutcome: number | null; // 1 = YES, 0 = NO
  proposedAt: Date | null;
  finalisedAt: Date | null;
  state: ResolutionState;
  disputeBond: string | null;
  disputer: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export enum ResolutionState {
  Unresolved = 0,
  Proposed = 1,
  Finalised = 2,
  Disputed = 3,
  Voided = 4,
}

/** Row in the `amm_snapshots` table — periodic price/reserve snapshots. */
export interface AmmSnapshot {
  id: number;
  marketId: string;
  reserveYes: string;
  reserveNo: string;
  priceYes: number; // 0..1 decimal
  priceNo: number;
  blockNumber: number;
  capturedAt: Date;
}

/** Row in the `indexed_events` watermark table. */
export interface IndexerState {
  key: string;
  value: string;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// API response shapes
// ---------------------------------------------------------------------------

export interface MarketListItem {
  marketId: string;
  questionText: string | null;
  status: MarketStatus;
  endDate: string; // ISO 8601
  priceYes: number | null;
  priceNo: number | null;
  volume: string | null;
  creator: string;
}

export interface MarketDetail extends MarketListItem {
  criteriaText: string | null;
  sourceText: string | null;
  bondAmount: string;
  resolution: Resolution | null;
  createdAt: string;
}

export interface ResolutionStatus {
  marketId: string;
  state: ResolutionState;
  proposedOutcome: number | null;
  proposedAt: string | null;
  finalisedAt: string | null;
  challengeSecondsRemaining: number | null;
  graceExpiresAt: string | null;
  isVoidEligible: boolean;
}
