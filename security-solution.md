# Honkers - Security Solutions

This document outlines the proposed solutions to the smart contract vulnerabilities identified in `SECURITY.md`. Given the architecture of Aztec Network, some of these solutions involve deep design choices regarding how private state interacts with public state.

## Critical Issues

### C-1: AMM and PrivateVault Are Economically Disconnected
- **Vulnerability:** `PrivateVault.buy_shares()` is private and accepts a caller-supplied `shares_out` value without verifying it against the AMM's pricing logic. 
- **Aztec Context:** `buy_shares` is a `#[external("private")]` function while `AMM.swap()` is `#[external("public")]`. In Aztec, private functions execute locally and *enqueue* public functions for the sequencer. Therefore, a private function **cannot receive a return value** from a public function in the same transaction.
- **Proposed Solution (Requires clarification):**
  We must decouple the trade into a predictable pattern for Aztec. Two main approaches:
  1. **Two-step transaction:**
     - First, a user burns private tokens to "unshield" them into public collateral on the AMM, perform the public `swap` function.
     - The AMM generates a public claim record (e.g., `shares_out` assigned to the user anonymously).
     - Second, the user calls a private `claim_shares` function to convert that public record into purely private `ShareNotes`.
  2. **Orgnial Pattern adjustment (Slippage bounds + Enqueue):**
     - Pass `min_shares_out` alongside the required `shares_out`.
     - The private function emits the notes for `shares_out`.
     - The private function enqueues the `AMM.swap` public call, passing `shares_out`. 
     - The `AMM.swap` executes publicly. If the AMM state can't satisfy `shares_out` for the given `collateral_amount` (due to price movement), the *entire transaction* (including the private phase) reverts at the sequencer level.

### C-2: `settle_winnings` Never Verifies Oracle Outcome
- **Vulnerability:** The function is completely detached from the Oracle's resolution. 
- **Proposed Solution:** Similar to C-1, since `settle_winnings` creates private notes and the Oracle state is public, we must enqueue a public verification function.
  - The private function creates the `WinningNote` but enqueues a public call to `Oracle.assert_outcome(market_id, winning_side)`.
  - If the Oracle state does not match the asserted outcome, the sequencer drops the transaction, throwing out the locally created `WinningNote`.

### C-3: `claim_winnings` Fee Recipient is Caller-Supplied
- **Vulnerability:** A parameter allows malicious actors to redirect the platform fee.
- **Proposed Solution:** 
  - Remove the `fee_recipient` parameter from the function signature.
  - Read `self.storage.fee_recipient.read()` directly. 
  *(Note: if this is a private function, the `fee_recipient` address might need to be set immutably at deployment, or verified via public enqueue call).*

### C-4: `refund_void_market` Never Checks Oracle Void State
- **Vulnerability:** Users can refund arbitrarily.
- **Proposed Solution:** Like C-2, enqueue a public call: `Oracle.assert_voided(market_id)`. Reverts the refund at sequence-time if not voided.

### C-5 & C-6: Access Control Missing on AMM `initialize_market` and Oracle `register_market`
- **Vulnerability:** Anyone can manipulate initial states.
- **Proposed Solution:** 
  - Add an authorization check.
  - Require `assert(self.context.msg_sender() == self.storage.factory.read(), "Unauthorized")` in the public functions.

### C-7: Dispute Bond Is Never Collected
- **Vulnerability:** Unbounded free disputes on the Oracle.
- **Proposed Solution:** 
  - Call `TestToken.transfer_public` inside `dispute_resolution` to pull tokens from the disputer into the Oracle, asserting the transfer succeeds. Update Oracle storage to track the bonded amount for returned slashes.

## High Issues

### H-1: Emergency Pause Not Enforced in Private Functions
- **Proposed Solution:** Aztec private functions cannot read public state synchronously. To enforce a pause in private, the pause flag must be read via `context.call_public_function_with_return_validation()` or the transaction must enqueue a public `assert_not_paused()` hook that reverts the transaction at sequence time.

### H-2, H-3, H-4: AMM Pricing Mathematics and Overflow
- **Proposed Solution:** Rewrite the AMM math in `swap()`. Ensure invariant $k$ is perfectly maintained by recalculating: `new_k = new_reserve_yes * new_reserve_no`. Switch divisions to check for `min_shares_out` constraints, explicitly avoiding precision loss vectors.

### H-8: No Overflow Protection on Mint
- **Proposed Solution:** For testnet token, switch unchecked Field accumulations to `SafeU120` or similar checked math library constructs available in Noir.
