# Honkers Security Solutions v2

Date: 2026-05-06
Scope: smart contract fixes for findings in SECURITY.md, aligned to Aztec v4.2.0 contract behavior.

## 1) Reviewed files & resources

- Contract sources under contracts/:
  - contracts/private_vault/src/main.nr
  - contracts/amm/src/main.nr
  - contracts/oracle/src/main.nr
  - contracts/market_factory/src/main.nr
  - contracts/test_token/src/main.nr
- Project guidance and requirements:
  - SECURITY.md
  - HANDOFF.md
  - SRS.md
  - PHASES.md
  - security-solution.md (existing draft)
- Aztec docs and reference implementations (aztec-packages):
  - call types and async private->public semantics
  - calling contracts patterns (self.call / self.view / self.enqueue)
  - events and public logs
  - token and authwit patterns used in official contracts/tests
  - DelayedPublicMutable for private-readable public authorization state

## 2) Important Aztec constraints that drive the solution

These constraints determine the "best" fix architecture:

1. Private functions can enqueue public calls, but cannot use their return values synchronously.
2. Public functions can call/view other public functions and consume return values.
3. If an enqueued public call reverts, the full transaction reverts (including private side effects).
4. Auth for delegated calls should use AuthWit/authorize_once patterns, not ad-hoc signatures.
5. For indexability, emit public events/logs in all state-changing public flows.

Consequence for Honkers: do not build core pricing/trade correctness on private code that expects real-time public AMM return values.

## 3) Current status vs SECURITY.md

SECURITY.md is directionally correct but partially stale relative to current source.

Version note:

- Frontend and integration tests are pinned to Aztec 4.2.0, while aztec-connect peerDependencies still reference 4.1.3.
- Before contract refactors, align package versions to a single Aztec minor to avoid API drift in tooling and client behavior.

- C-3 fee recipient hijack: currently fixed in code (claim_winnings reads storage fee_recipient).
- C-5 AMM initialize access control: currently admin-gated in code.
- C-6 Oracle register access control: currently admin-gated in code.
- Most core economic issues remain open (C-1, C-2, C-4, C-7, H-1, H-2/H-3/H-4, etc.).

Recommendation: keep SECURITY.md as historical audit artifact, and track current remediation state in this file going forward.

## 4) Best-solution architecture (recommended)

### 4.1 Move price-critical settlement logic to public execution

The safest Aztec-compatible model for Honkers is:

1. Public swap computes canonical shares_out and updates reserves.
2. Public contract records a claimable entitlement/receipt for the trader.
3. Private function consumes entitlement and mints private ShareNote (or private token position).

This avoids trusting caller-supplied shares_out and avoids impossible private-time dependence on public return data.

### 4.2 Standardize collateral/share accounting on Aztec token patterns

Current custom collateral/share notes are flexible but are the root of accounting disconnects.

Best upgrade path:

1. Replace TestToken with standard Aztec token-contract style interfaces (u128 amounts, authwit-aware transfer_in_public/transfer_to_public flows).
2. Treat YES and NO shares as tokenized positions (private balance support via standard transfer patterns), or keep custom notes but only mint from verified public receipts.
3. Route all bond/fee transfers through real token transfers, never stored scalar placeholders.

## 5) Issue-by-issue solutions

### A-1 No public event emission

Fix:

1. Emit public logs/events from every state-changing public function.
2. For MarketFactory create_market, emit market metadata fields in the exact layout expected by frontend parsing.
3. Add event schema comments and decoding tests in integration suite.

Priority: P0 for MarketFactory, P2 for the rest.

---

### C-1 AMM and PrivateVault economically disconnected

Problem:

- buy_shares is private and mints notes from caller-supplied shares_out.

Best fix:

1. Introduce a public trade entrypoint that performs canonical AMM math and reserve updates.
2. Persist trade receipt keyed by (user, market_id, nonce) -> shares_out, side, spent_collateral.
3. Make private claim_shares consume that receipt and mint private shares.
4. Remove shares_out and price_per_share as trusted user inputs from private buy path.

Alternative minimal interim (acceptable only for testnet hardening):

1. Keep private buy flow but enqueue a public verifier that recomputes and asserts shares_out against AMM state snapshot assumptions.
2. This is weaker than full redesign and still has race/UX complexity.

Priority: P0.

---

### C-2 settle_winnings does not verify Oracle outcome

Problem:

- Caller can choose winning_side with no oracle gate.

Best fix:

1. Require oracle state proof before any winnings minting.
2. Either:
   - move settlement to public function that reads oracle state directly, then issue receipt for private claim, or
   - keep private settle but enqueue Oracle.assert_finalized_outcome(market_id, side) and remove unsafe args (e.g., caller block_number input).
3. Ensure settlement is single-use per position to prevent replay.

Priority: P0.

---

### C-3 fee recipient caller-supplied

Status:

- Already fixed in current code (reads storage fee_recipient).

Additional hardening:

1. Add unit/integration test asserting caller cannot redirect fees.
2. Add two-step fee_recipient update (propose/accept) or timelock.

Priority: done + tests.

---

### C-4 refund_void_market missing oracle void check

Best fix:

1. Gate refund by oracle state == VOIDED.
2. Use same pattern as C-2:
   - public refund function with direct oracle read, or
   - private refund that enqueues Oracle.assert_voided(market_id).
3. Mark refunded positions consumed to prevent double-refund + settle combinations.

Priority: P0.

---

### C-5 AMM initialize_market access control

Status:

- Admin check exists now.

Best final fix:

1. Narrow auth from generic admin to explicit factory role/address.
2. Set role once and lock (or use two-step change).
3. Enforce market_id > 0 and market not already initialized.

Priority: medium (hardening).

---

### C-6 Oracle register_market access control

Status:

- Admin check exists now.

Best final fix:

1. Narrow auth to factory role.
2. Validate end_date > now at registration.
3. Assert one source of truth for end_date consistency with AMM/Factory.

Priority: medium (hardening).

---

### C-7 Dispute bond never collected

Problem:

- Stored number only, no token transfer.

Best fix:

1. Require real bond transfer at dispute time using token transfer primitives.
2. Track bond escrow per market and disputer.
3. Define slash/refund outcome rules in code.
4. Couple with H-7 controls (max rounds/escalating bond).

Priority: P0.

---

### H-1 pause not enforced in private functions

Best fix:

1. Add public assert_not_paused() gate and enqueue it from each private mutator, or
2. Migrate pause state to DelayedPublicMutable if private-time reads are needed with explicit delay semantics.

Recommendation:

- For immediate emergency stop semantics, use enqueued public assert_not_paused.

Priority: high.

---

### H-2/H-3/H-4 AMM math and type safety

Best fix:

1. Stop using unchecked Field->u64 casts for financial math.
2. Use u128 for reserves/amounts, with checked add/sub/mul/div and explicit bounds.
3. Remove stored k or recompute deterministically from reserves each swap.
4. Add min_shares_out slippage guard to swap.
5. Validate side in {0,1}.

Priority: high.

---

### H-5 MarketFactory whitelist dead code

Given open-creation direction in HANDOFF/PHASES:

1. Remove whitelist storage/functions entirely.
2. Keep bond + schedule checks and enforce real bond transfer.

Priority: medium.

---

### H-6 caller-supplied shares_out

This is the implementation symptom of C-1.

Fix:

- Eliminate caller authority over shares_out; compute canonically in public swap path.

Priority: bundled with C-1.

---

### H-7 dispute loop griefing

Best fix:

1. Add max_dispute_rounds per market.
2. Add escalating bond schedule per round.
3. Optionally add final arbiter route after max rounds.
4. Prevent immediate timer reset grief without additional cost.

Priority: high.

---

### H-8 token overflow assumptions

Best fix:

1. Use u128 token accounting APIs with checked arithmetic.
2. Prefer audited Aztec token patterns over custom Field arithmetic.

Priority: high if real-value path; medium for testnet.

---

### M-1 deps_set not asserted in private

Best fix:

1. Add readiness guard callable from private path (enqueued public assert_dependencies_set).
2. Fail fast on uninitialized dependencies.

---

### M-2 anyone can void market

Decision point:

1. Keep permissionless void after grace (decentralized liveness), or
2. Restrict void to resolver/admin and add keeper fallback.

Recommendation:

- Keep permissionless void, but emit explicit event and add late-resolution policy to reduce grief ambiguity.

---

### M-3 sequencer timestamp influence

Fix:

1. Add safety buffers around boundary checks.
2. Avoid exact second equality assumptions in expiry logic.

---

### M-4 no slippage in swap

Fix:

- Add min_shares_out (or max_collateral_in for exact-out paths) and assert in public swap.

---

### M-5 creation bond not collected

Fix:

- Transfer and escrow real token bond at market creation, not just store numeric metadata.

---

### M-6 oracle registration lacks future-date check

Fix:

- assert(end_date > now) in register_market.

---

### M-7 losing shares silently dropped

Fix:

1. Ensure settlement can only occur in finalized/voided valid states.
2. Emit settlement accounting event/logs so note consumption is auditable.

---

### M-8 single admin no transfer mechanism

Fix:

1. Add two-step admin transfer (propose_admin, accept_admin).
2. Prefer multisig/admin-account contract for production.
3. Add role separation: factory admin, oracle resolver admin, pause guardian.

---

### L-1/L-2/L-3/L-4/L-5 low severity

Fix package:

1. Validate side domain.
2. Move windows to configurable storage with governance constraints.
3. Keep faucet sybil caveat documented for testnet.
4. Document sequencer serialization assumptions.
5. Replace broad Field monetary types with u128 semantics.

## 6) Delivery roadmap

### Phase A (must-do before any real value)

1. C-2 oracle-gated settlement.
2. C-1/H-6 canonical public swap + receipt-based private share mint.
3. C-7 real dispute bond collection.
4. C-4 oracle-gated refunds.
5. H-1 pause enforcement in private flows.
6. H-2/H-3/H-4 AMM math/type refactor + slippage.

### Phase B (stabilization)

1. Role hardening for C-5/C-6.
2. M-5 bond collection in MarketFactory.
3. M-8 admin transfer and role split.
4. A-1 comprehensive event emission.

### Phase C (production readiness)

1. Replace/upgrade TestToken interfaces to standard authwit-aware token patterns.
2. Full invariant/fuzz testing for AMM and vault flows.
3. External audit with focused review on private/public sequencing assumptions.

## 7) Testing requirements to close the findings

Minimum test matrix:

1. Attack regression tests for each C finding (expected revert).
2. Invariant tests:
   - reserve conservation and monotonic constraints under swaps
   - no double settle/refund/claim
   - escrow balances match liability totals
3. Auth tests:
   - unauthorized market init/register/dispute paths fail
   - authwit paths succeed only for designated caller
4. Event/log tests:
   - all critical state transitions emit expected logs
5. Timestamp boundary tests around end_date/challenge/grace edges.

## 8) Immediate actionable changes in this repo

If we start implementation now, first PR should target:

1. Add oracle assertion gates for settle_winnings and refund_void_market.
2. Add pause assertions via enqueued public guard.
3. Add min_shares_out and side validation in AMM.swap.
4. Add end_date > now validation in Oracle.register_market.
5. Add two-step admin transfer scaffold on AMM/Oracle/PrivateVault/MarketFactory/TestToken.

Second PR should do the larger architectural move:

1. Replace private trusted shares_out flow with public canonical swap + claim receipt model.
2. Implement real token escrow for dispute and market-creation bonds.

## 9) Aztec references used

1. Call-type semantics (private->public enqueue and async/no return):
   - https://github.com/AztecProtocol/aztec-packages/blob/main/docs/developer_versioned_docs/version-v4.2.0/docs/foundational-topics/call_types.md
2. Contract calling patterns (self.call, self.view, self.enqueue):
   - https://github.com/AztecProtocol/aztec-packages/blob/main/docs/developer_versioned_docs/version-v4.2.0/docs/aztec-nr/framework-description/calling_contracts.md
3. Events and public logs:
   - https://github.com/AztecProtocol/aztec-packages/blob/main/docs/developer_versioned_docs/version-v4.2.0/docs/aztec-nr/framework-description/events_and_logs.md
4. DelayedPublicMutable state variable behavior:
   - https://github.com/AztecProtocol/aztec-packages/blob/main/docs/developer_versioned_docs/version-v4.2.0/docs/aztec-nr/framework-description/state_variables.md
5. AuthWit helpers in Aztec.nr:
   - https://github.com/AztecProtocol/aztec-packages/blob/main/noir-projects/aztec-nr/aztec/src/authwit/auth.nr
6. AuthWit example usage in Aztec.js:
   - https://github.com/AztecProtocol/aztec-packages/blob/main/docs/examples/ts/aztecjs_authwit/index.ts
7. Official token contract patterns (public/private transfer and authwit-aware flow):
   - https://github.com/AztecProtocol/aztec-packages/blob/main/noir-projects/noir-contracts/contracts/app/token_contract/src/main.nr

---

This file is intended to be the living remediation tracker replacing ad-hoc notes in security-solution.md.
