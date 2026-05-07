# Honkers — Smart Contract Security Audit

**Date:** 2026-05-04  
**Audited by:** Internal (AI-assisted deep research audit)  
**Aztec version:** 4.2.0  
**Network:** Testnet (Sepolia-backed)  
**Contracts audited:** AMM, Oracle, PrivateVault, MarketFactory, TestToken  
**Source location:** `contracts/*/src/main.nr`

---

## Overall Risk Rating

> **CRITICAL — Not Safe for Mainnet or Real-Value Deployment**

The contracts are a functional prototype suitable for closed testnet demonstration.  
They have fundamental economic security failures — not edge-case exploits — that make the core trading loop (deposit → buy → settle → claim) exploitable at every step.  
**Do not deploy to mainnet or handle real funds until all CRITICAL and HIGH issues are resolved.**

---

## Summary Table

| ID | Severity | Contract | Issue |
|----|----------|----------|-------|
| A-1 | Architecture | All | No public event emission — indexer deleted, frontend ready, contract emit pending |
| C-1 | FIXED | AMM + PrivateVault | AMM and Vault wired via _verify_swap enqueue pattern (2026-05-07) |
| C-2 | Critical | PrivateVault | `settle_winnings` never verifies Oracle outcome |
| C-3 | Critical | PrivateVault | `fee_recipient` is caller-supplied, not from storage |
| C-4 | Critical | PrivateVault | `refund_void_market` never checks Oracle void state |
| C-5 | Critical | AMM | `initialize_market` has no access control |
| C-6 | Critical | Oracle | `register_market` has no access control |
| C-7 | Critical | Oracle | Dispute bond is never collected — free infinite disputes |
| H-1 | High | PrivateVault | Emergency pause flag not checked in private functions |
| H-2 | High | AMM | Invariant `k` not updated after swaps — pricing drift |
| H-3 | High | AMM | Integer division truncation enables dust-drain attack |
| H-4 | High | AMM | Field→u64 cast silently truncates if `k > u64::MAX` |
| H-5 | High | MarketFactory | Whitelist storage exists but `create_market` never checks it |
| H-6 | High | PrivateVault | `shares_out` is caller-supplied, not verified against AMM |
| H-7 | High | Oracle | Dispute resolution resets timer — infinite grief loop |
| H-8 | High | TestToken | No overflow protection on mint accumulation |
| M-1 | Medium | PrivateVault | `deps_set` never asserted in private functions |
| M-2 | Medium | Oracle | Anyone can void a market after grace period |
| M-3 | Medium | AMM | Block timestamp is sequencer-influenced |
| M-4 | Medium | AMM | No slippage protection parameter in `swap()` |
| M-5 | Medium | MarketFactory | Bond amount stored but never collected |
| M-6 | Medium | Oracle | No end-date future validation on registration |
| M-7 | Medium | PrivateVault | Losing-side shares silently dropped in `settle_winnings` |
| M-8 | Medium | All | Single admin with no transfer mechanism |
| L-1 | Low | AMM | `side` param accepts any value beyond 0/1 |
| L-2 | Low | Oracle | Challenge/grace windows are hardcoded constants |
| L-3 | Low | TestToken | Faucet rate limit trivially bypassed via Sybil |
| L-4 | Low | MarketFactory | `next_market_id` read ordering in same-block concurrent calls |
| L-5 | Low | PrivateVault | Monetary values stored as `Field`, not semantic uint types |

---

## Critical Findings

### C-1 — AMM and PrivateVault Are Economically Disconnected

**Files:** `contracts/amm/src/main.nr` (`swap()`), `contracts/private_vault/src/main.nr` (`buy_shares()`)

`PrivateVault.buy_shares()` accepts `shares_out` and `price_per_share` as **caller-supplied parameters** and never calls `AMM.swap()` to compute what the actual output should be. The AMM's `swap()` is a pure arithmetic function that also never moves any tokens.

**Impact:** Any user can call `buy_shares(market_id, side, collateral=1, shares_out=1_000_000, price_per_share=1)` and receive a note for 1 million shares in exchange for 1 unit of collateral. The AMM reserves are never updated, so there is no price impact.

**Attack:** Call `buy_shares` with arbitrarily inflated `shares_out`. Win the market. Drain the vault.

**Fix required:** `buy_shares` must call `AMM.swap(market_id, side, collateral_amount)` and use the returned `shares_out` value, rejecting the caller-supplied one.

---

### C-2 — `settle_winnings` Never Verifies Oracle Outcome

**File:** `contracts/private_vault/src/main.nr` (`settle_winnings()`)

`settle_winnings(market_id, winning_side, block_number)` accepts all three arguments from the caller. It never calls the Oracle to verify that:
1. The market is in `STATE_FINALISED`
2. The `winning_side` argument matches the Oracle's recorded outcome

**Impact:** Any user can call `settle_winnings(id, side_they_hold, 0)` on any market at any time — before resolution, during voting, or on non-existent markets — and convert their notes to WinningNotes.

**Attack:** Hold NO-side shares. Call `settle_winnings(id, 0, 0)` before the market resolves. Call `claim_winnings`. Full vault drain.

**Fix required:** `settle_winnings` must call `Oracle.get_market_state(market_id)` and assert `state == STATE_FINALISED` and `proposed_outcome == winning_side`.

---

### C-3 — `claim_winnings` Fee Recipient is Caller-Supplied

**File:** `contracts/private_vault/src/main.nr` (`claim_winnings()`)

The `fee_recipient` parameter is supplied by the caller and routed to receive the platform fee cut. `self.storage.fee_recipient` is populated by the constructor but never read in this function.

**Impact:** Any caller can redirect platform fees to themselves by passing their own address as `fee_recipient`. The legitimate fee recipient receives nothing.

**Fix required:** Remove the `fee_recipient` parameter. Read `self.storage.fee_recipient.read()` inside the function.

---

### C-4 — `refund_void_market` Never Checks Oracle Void State

**File:** `contracts/private_vault/src/main.nr` (`refund_void_market()`)

`refund_void_market()` has no call to the Oracle to verify the market is in `STATE_VOIDED`. Any user can call this on any active, finalized, or even non-existent market to reclaim their collateral at their recorded `entry_price`.

**Impact:** Users can refund shares from active markets before resolution, breaking market integrity. Combined with C-2 (no oracle check in `settle_winnings`), an attacker could refund then also settle the same position.

**Fix required:** Call `Oracle.get_market_state(market_id)` and assert `state == STATE_VOIDED` before processing refunds.

---

### C-5 — `AMM.initialize_market` Has No Access Control

**File:** `contracts/amm/src/main.nr` (`initialize_market()`)

No authentication check. Any address can call `initialize_market(market_id, initial_liquidity, end_date)`.

**Impact:**
- Attacker front-runs the MarketFactory to poison market parameters with wrong `end_date`
- Attacker occupies `market_id = 0` (sentinel used by uninitialised state)
- Attacker initializes with `initial_liquidity = 2` to anchor an extreme price

**Fix required:** Assert `context.msg_sender() == self.storage.amm_address.read()` or require call to come only from MarketFactory. Alternatively, check `self.storage.reserves_yes.at(market_id).read() == 0` guard.

---

### C-6 — `Oracle.register_market` Has No Access Control

**File:** `contracts/oracle/src/main.nr` (`register_market()`)

No authentication check. Any address can register arbitrary `(market_id, end_date)` pairs.

**Impact:** Attacker registers a market in the Oracle with a manipulated `end_date` before MarketFactory does, creating a permanent split between Oracle and AMM parameters. This enables timing attacks (trade after AMM considers market expired, before Oracle does).

**Fix required:** Assert caller is the authorized MarketFactory address: `assert(context.msg_sender() == self.storage.factory.read())`.

---

### C-7 — Dispute Bond Is Never Collected

**File:** `contracts/oracle/src/main.nr` (`dispute_resolution()`)

`dispute_resolution()` stores a `bond_amount` field but never transfers any tokens from the disputer. Bonds are fictional — any user can dispute any resolution for free, infinitely.

**Impact:** Every legitimate resolution can be disputed endlessly at zero cost. Combined with H-7 (dispute resets the challenge timer), markets can be kept permanently in `STATE_DISPUTED`, blocking finalization forever.

**Fix required:** Require and transfer an actual token bond (`TestToken.transfer(disputer → vault, bond_amount)`) before accepting the dispute. Slash the bond on failed disputes; return it on successful ones.

---

## High Findings

### H-1 — Emergency Pause Not Enforced in Private Functions

**File:** `contracts/private_vault/src/main.nr`

`emergency_pause()` and `unpause()` write to `self.storage.paused`. None of the private functions (`deposit_collateral`, `withdraw_collateral`, `buy_shares`, `settle_winnings`, `claim_winnings`, `refund_void_market`) read or assert on the paused flag.

**Fix:** Add `assert(!self.storage.paused.read(), "Contract is paused")` at the top of each private state-changing function.

---

### H-2 — AMM Invariant `k` Not Maintained After Swaps

**File:** `contracts/amm/src/main.nr` (`swap()`)

After each swap, `new_reserve_yes * new_reserve_no != k` due to integer division truncation. Subsequent swaps use the stale `k`, causing cumulative pricing drift.

**Example:** `k=10000`, reserves `(100, 100)`. Swap `amount_in=1`: `new_reserve_out = 10000/101 = 99`. New product: `101 * 99 = 9999 ≠ 10000`. Over many swaps the AMM bleeds value.

**Fix:** After each swap, recompute and store `new_k = new_reserve_yes * new_reserve_no`.

---

### H-3 — Integer Division Enables Precision-Drain Attack

**File:** `contracts/amm/src/main.nr` (`swap()` line 79)

As reserves become unbalanced (worsened by H-2), an attacker can craft inputs that extract `shares_out = 1` while paying `amount_in = 1` at an exploitable exchange ratio. The `shares_out > 0` assertion prevents zero-output trades but not unprofitable-ratio trades.

**Fix:** Implement minimum output protection (`min_shares_out` parameter) and rebalance `k` after each swap (H-2 fix).

---

### H-4 — Field→u64 Cast Silently Truncates Large `k`

**File:** `contracts/amm/src/main.nr` (`swap()` line 79)

`k` is stored as `half * half` in Field arithmetic (~254-bit prime). On line 79: `let new_reserve_out = (k as u64 / new_reserve_in as u64)`. If `k > u64::MAX` (possible with large `initial_liquidity`), `k as u64` silently wraps, producing wildly wrong `new_reserve_out`.

**Fix:** Either enforce `initial_liquidity <= sqrt(u64::MAX / 2)` in `initialize_market`, or perform the division entirely in Field arithmetic with a bounds check before casting.

---

### H-5 — Whitelist in MarketFactory Is Dead Code

**File:** `contracts/market_factory/src/main.nr` (`create_market()`)

The `whitelist` map and `add_to_whitelist`/`remove_from_whitelist` functions exist but `create_market()` never reads the whitelist. The `admin_only_create` flag exists but is not enforced.

**Fix:** Either enforce the whitelist check in `create_market()` or remove the dead storage/functions to reduce attack surface.

---

### H-6 — `buy_shares` Accepts Caller-Supplied `shares_out`

**File:** `contracts/private_vault/src/main.nr` (`buy_shares()`)

See C-1 for full details. This is the direct enabler of the share inflation attack.

---

### H-7 — Dispute Resolution Resets Timer — Infinite Grief Loop

**File:** `contracts/oracle/src/main.nr` (`resolve_dispute()`)

When the admin resolves a dispute, `proposed_at` resets to `now` and state reverts to `STATE_PROPOSED`. The full `CHALLENGE_WINDOW` (24h) restarts. Since disputes are free (C-7), anyone can immediately re-dispute. There is no limit on dispute count, no escalating bond, and no third-party arbiter.

**Fix:** Implement escalating bond requirements for repeat disputes on the same market, a maximum dispute count, or a third-party arbitration mechanism.

---

### H-8 — No Overflow Protection on Token Mint

**File:** `contracts/test_token/src/main.nr` (`faucet()`, `admin_mint()`)

Balance updates use Field arithmetic with no overflow check. Acceptable for testnet given the ~254-bit field size, but should use checked arithmetic (`u128` with explicit overflow assertions) for any production token.

---

## Medium Findings

### M-1 — `deps_set` Not Asserted in Private Functions

Private functions do not assert `deps_set == 1` before executing. This allows operations against uninitialized zero addresses if called before `set_dependencies`.

### M-2 — Anyone Can Void a Market After Grace Period

`Oracle.void_market()` has no authentication. After `GRACE_PERIOD` (3 days past `end_date`), any address can void any unresolved market, which may be used to grief a legitimate late-resolution.

### M-3 — Block Timestamp is Sequencer-Influenced

`context.timestamp()` in public functions is controlled by the sequencer within an allowed drift range. Market expiry comparisons using this timestamp can be marginally manipulated.

### M-4 — No Slippage Protection in `swap()`

`AMM.swap()` has no `min_shares_out` parameter. Users cannot specify acceptable slippage bounds at the protocol level.

### M-5 — Market Creation Bond Never Collected

`MarketFactory.create_market()` requires `bond_amount > 0` but never transfers tokens from the creator. The "bond" is a stored number only.

### M-6 — No Future End Date Validation in Oracle

`Oracle.register_market()` does not assert `end_date > context.timestamp()`. A market can be registered with `end_date = 0`, making it immediately void-eligible.

### M-7 — Losing-Side Shares Silently Discarded in `settle_winnings`

When `settle_winnings` encounters notes from the losing side, they are consumed without creating a refund or emitting an event. Users on the losing side lose their notes with no record. If `settle_winnings` is called on an unresolved market (enabled by C-2), users permanently lose their shares.

### M-8 — Single Admin, No Transfer Mechanism

All five contracts have a single `admin` address set at construction with no `transfer_admin()` / `accept_admin()` pattern. Loss of the admin key permanently bricks: dispute resolution, emergency pause lift, whitelist management, and contract upgrades.

**Recommended fix:** Two-step admin transfer (propose + accept) or a multi-sig arrangement.

---

## Low / Informational

### L-1 — `side` Parameter Not Range-Validated in AMM

Any value other than `0` or `1` silently routes to the `else` branch (treated as YES). Should assert `(side == 0) | (side == 1)`.

### L-2 — Challenge/Grace Windows Are Hardcoded

`CHALLENGE_WINDOW` (86400s) and `GRACE_PERIOD` (259200s) are compile-time constants with no admin override. Cannot be adjusted without redeployment.

### L-3 — Faucet Cooldown Trivially Bypassed via Sybil

Rate limiting is per-address. Creating N addresses defeats it entirely. Acceptable for testnet only.

### L-4 — `next_market_id` Read Ordering in Same-Block Calls

Two `create_market` calls in the same block both read `next_market_id` before either increments it. The Aztec sequencer serializes public function execution so this is not currently exploitable, but should be noted for any future parallel execution model.

### L-5 — Monetary Values Stored as Untyped `Field`

All amounts use `Field` rather than `u64` / `u128`. Casting between `Field` and `u64` without bounds checks is the root of H-4. Using semantic types would prevent this class of bug.

---

## Architecture Finding

### A-1 — No Public Event Emission — All Contracts

**Severity:** Architecture (required before mainnet)  
**Affects:** MarketFactory, AMM, Oracle, PrivateVault, TestToken  
**Status:** Resolved for MarketFactory (2026-05-06). Indexer deleted. `MarketFactory.create_market` now emits `MarketCreated` public log with packed question/criteria/source Fields. Frontend reads via `node_getPublicLogs`. Remaining contracts (AMM, Oracle, PrivateVault) still emit no logs — add before mainnet.

None of the five contracts call `emit_public_log()` for any state-changing action.

**Current state (2026-05-05):**
- The Express+Postgres indexer has been **deleted**. All market data comes from direct RPC reads.
- `frontend/src/hooks/useMarkets.ts` already calls `node_getPublicLogs({ contractAddress: factory })` and parses the expected field layout. It returns empty until the contract emits.
- `keeper/src/utils/chainReader.ts` reads market list via `node_getPublicStorageAt` slot polling — works but is sensitive to layout changes.
- **Remaining gap:** `MarketFactory.create_market` does not yet emit a public log. Markets show "Market #N" fallback — no question text visible.

**Required fix for MarketFactory (next deployment):**

Add to `create_market()` in `contracts/market_factory/src/main.nr`:
```rust
use aztec::oracle::avm::emit_public_log;

// Pack question/criteria/source strings into Fields (31 bytes each)
// then emit. Frontend expects this layout:
// [market_id, q_field_0, q_field_1, c_field_0, c_field_1, s_field_0, s_field_1]
emit_public_log([
    market_id,
    question_field_0, question_field_1,
    criteria_field_0, criteria_field_1,
    source_field_0,   source_field_1,
]);
```

The `create_market` function currently receives hashes — it needs to also accept the plaintext strings (or packed Field arrays) so it can emit them. The contract call from `CreateMarket.tsx` would need updating accordingly.

**Full event table for all contracts (implement before mainnet):**

| Contract | Function | Event to emit |
|----------|----------|---------------|
| MarketFactory | `create_market` | `[market_id, q0, q1, c0, c1, s0, s1]` — **NEXT** |
| AMM | `initialize_market` | `[market_id, reserve_yes, reserve_no]` |
| AMM | `swap` | `[market_id, side, amount_in, shares_out]` |
| Oracle | `register_market` | `[market_id, end_date]` |
| Oracle | `propose_resolution` | `[market_id, outcome]` |
| Oracle | `finalise_resolution` | `[market_id]` |
| Oracle | `void_market` | `[market_id]` |
| PrivateVault | `emergency_pause` / `unpause` | `[paused_flag]` |

**Priority:** MarketFactory emission is P0 — blocks question text display. Others are P2.

---

## Priority Fix Order

For any deployment with real value or open public access, fix in this order:

1. **C-2** — Add Oracle verification to `settle_winnings` (stops immediate fund drain)
2. **C-1 / H-6** — Connect `buy_shares` to `AMM.swap()` (fixes share inflation)
3. **C-7** — Enforce actual bond collection in `dispute_resolution`
4. **C-3** — Remove caller-supplied `fee_recipient`
5. **C-4** — Add Oracle void check in `refund_void_market`
6. **C-5 / C-6** — Add access control to `initialize_market` and `register_market`
7. **H-1** — Enforce pause flag in all private functions
8. **H-2 / H-3** — Fix AMM `k` invariant maintenance
9. **M-8** — Implement two-step admin transfer
10. **A-1** — Add `emit_public_log` to all state-changing functions in all contracts

---

## Testnet Status Note

As of 2026-05-04, all contracts are deployed on the **Aztec testnet** (Sepolia) for demonstration purposes only, with no real funds at risk. The known issues above are accepted for this testnet phase. They must be resolved before any mainnet or real-value deployment.

No external audit has been conducted. This document reflects an internal AI-assisted analysis.

---

## Deployed Contract Addresses (Testnet — 2026-05-04)

| Contract | Address |
|----------|---------|
| Admin | `0x1092539b9d20142398c8a8f3e9b0462f1d38cddd587c94b7bc80ff47e6a0b51a` |
| USDh (TestToken) | `0x14913c13aa09a37f18290ffe69a6c9b6a49cebd7e94b909f6c38a8324d2d11c3` |
| AMM | `0x21433bf88a25713b60d566d37050bb4777ddb3668b1126e4f7518c9513dddbd5` |
| Oracle | `0x29e13066f73f7da9fbdbf3ac0870607a2bc21bcf00bd20cec35d141f025a2c92` |
| PrivateVault | `0x0a692389720e019c4ca912c9a7fec6e4176fe933392452278fd8aeb924d31ae3` |
| MarketFactory | `0x006e177296bd3d9d280c333336f5d9eff5333a621fa12887bdb3e22518d55056` |
| SponsoredFPC | `0x254082b62f9108d044b8998f212bb145619d91bfcd049461d74babb840181257` |
