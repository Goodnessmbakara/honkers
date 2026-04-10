use dep::aztec::macros::aztec;

/// Oracle — market resolution contract.
///
/// Phase 1 trust model:
///   - Admin EOA resolves markets (multi-sig prep for Phase 2).
///   - 24-hour challenge window before settlement finalises.
///   - Anyone can dispute within the window by posting a bond.
///   - If no dispute after 24h, anyone can call finalise_resolution().
///
/// Expiry flow:
///   - After market end_date, a 72-hour grace period begins.
///   - If no resolution within the grace period, the market becomes void-eligible.
///   - Keeper bot or anyone can call void_market() after grace expiry.
///
/// Resolution states:
///   0 = unresolved, 1 = proposed (in challenge window), 2 = finalised, 3 = disputed, 4 = voided
#[aztec]
contract Oracle {
    use dep::aztec::prelude::{AztecAddress, Map, PublicMutable, SharedImmutable};
    use dep::aztec::macros::{functions::{initializer, public}, storage::storage};

    /// Challenge window: 24 hours in seconds.
    global CHALLENGE_WINDOW: Field = 86400;
    /// Grace period after market end_date: 72 hours in seconds.
    global GRACE_PERIOD: Field = 259200;

    /// Resolution state constants.
    global STATE_UNRESOLVED: Field = 0;
    global STATE_PROPOSED: Field = 1;
    global STATE_FINALISED: Field = 2;
    global STATE_DISPUTED: Field = 3;
    global STATE_VOIDED: Field = 4;

    #[storage]
    struct Storage {
        /// Admin address — single EOA for Phase 1.
        admin: PublicMutable<AztecAddress>,
        /// AMM contract address (to halt trading on resolution).
        amm: SharedImmutable<AztecAddress>,
        /// Per-market resolution state.
        resolution_state: Map<Field, PublicMutable<Field>>,
        /// Proposed outcome per market (1 = YES, 0 = NO). Only valid when state >= PROPOSED.
        proposed_outcome: Map<Field, PublicMutable<Field>>,
        /// Timestamp when resolution was proposed. Used for challenge window.
        proposed_at: Map<Field, PublicMutable<Field>>,
        /// Market end dates (copied from AMM/Factory at creation). Key: market_id.
        end_dates: Map<Field, PublicMutable<Field>>,
        /// Dispute bond amount deposited (per market).
        dispute_bond: Map<Field, PublicMutable<Field>>,
        /// Disputer address (per market).
        disputer: Map<Field, PublicMutable<AztecAddress>>,
    }

    // -----------------------------------------------------------------------
    // Initialiser
    // -----------------------------------------------------------------------

    #[initializer]
    #[public]
    fn constructor(admin: AztecAddress, amm: AztecAddress) {
        storage.admin.write(admin);
        storage.amm.initialize(amm);
    }

    // -----------------------------------------------------------------------
    // Market registration — called by MarketFactory
    // -----------------------------------------------------------------------

    /// Register a market's end date for grace period tracking.
    #[public]
    fn register_market(market_id: Field, end_date: Field) {
        let state = storage.resolution_state.at(market_id).read();
        assert(state == 0, "Market already registered");
        storage.end_dates.at(market_id).write(end_date);
        storage.resolution_state.at(market_id).write(STATE_UNRESOLVED);
    }

    // -----------------------------------------------------------------------
    // Resolution flow
    // -----------------------------------------------------------------------

    /// STEP 1: Admin proposes a resolution outcome. Starts the 24h challenge window.
    #[public]
    fn propose_resolution(market_id: Field, outcome: Field) {
        let admin = storage.admin.read();
        assert(context.msg_sender() == admin, "Only admin can propose resolution");

        let state = storage.resolution_state.at(market_id).read();
        assert(state == STATE_UNRESOLVED, "Market not in unresolved state");

        assert((outcome == 0) | (outcome == 1), "Outcome must be 0 (NO) or 1 (YES)");

        storage.proposed_outcome.at(market_id).write(outcome);
        storage.proposed_at.at(market_id).write(context.timestamp());
        storage.resolution_state.at(market_id).write(STATE_PROPOSED);
    }

    /// STEP 2a: Anyone can dispute within the 24h challenge window by posting a bond.
    #[public]
    fn dispute_resolution(market_id: Field, bond_amount: Field) {
        let state = storage.resolution_state.at(market_id).read();
        assert(state == STATE_PROPOSED, "Market not in proposed state");

        let proposed_at = storage.proposed_at.at(market_id).read();
        let now = context.timestamp();
        assert(
            (now - proposed_at) as u64 < CHALLENGE_WINDOW as u64,
            "Challenge window has expired",
        );

        assert(bond_amount as u64 > 0, "Bond must be positive");

        storage.dispute_bond.at(market_id).write(bond_amount);
        storage.disputer.at(market_id).write(context.msg_sender());
        storage.resolution_state.at(market_id).write(STATE_DISPUTED);
    }

    /// STEP 2b: Finalise resolution after the 24h challenge window with no dispute.
    /// Callable by anyone.
    #[public]
    fn finalise_resolution(market_id: Field) {
        let state = storage.resolution_state.at(market_id).read();
        assert(state == STATE_PROPOSED, "Market not in proposed state");

        let proposed_at = storage.proposed_at.at(market_id).read();
        let now = context.timestamp();
        assert(
            (now - proposed_at) as u64 >= CHALLENGE_WINDOW as u64,
            "Challenge window still active",
        );

        storage.resolution_state.at(market_id).write(STATE_FINALISED);
    }

    /// Admin re-proposes after a dispute is handled (off-chain arbitration for Phase 1).
    #[public]
    fn resolve_dispute(market_id: Field, new_outcome: Field) {
        let admin = storage.admin.read();
        assert(context.msg_sender() == admin, "Only admin can resolve disputes");

        let state = storage.resolution_state.at(market_id).read();
        assert(state == STATE_DISPUTED, "Market not in disputed state");

        assert((new_outcome == 0) | (new_outcome == 1), "Outcome must be 0 or 1");

        storage.proposed_outcome.at(market_id).write(new_outcome);
        storage.proposed_at.at(market_id).write(context.timestamp());
        storage.resolution_state.at(market_id).write(STATE_PROPOSED);
    }

    // -----------------------------------------------------------------------
    // Auto-void — callable by keeper bot or anyone after grace period
    // -----------------------------------------------------------------------

    /// Void a market if it's past end_date + 72h grace period with no resolution.
    #[public]
    fn void_market(market_id: Field) {
        let state = storage.resolution_state.at(market_id).read();
        assert(state == STATE_UNRESOLVED, "Market already resolved or voided");

        let end_date = storage.end_dates.at(market_id).read();
        let now = context.timestamp();
        let grace_expiry = end_date + GRACE_PERIOD;

        assert(now as u64 >= grace_expiry as u64, "Grace period has not expired");

        storage.resolution_state.at(market_id).write(STATE_VOIDED);
    }

    // -----------------------------------------------------------------------
    // View helpers (unconstrained)
    // -----------------------------------------------------------------------

    unconstrained fn get_resolution_state(market_id: Field) -> pub Field {
        storage.resolution_state.at(market_id).read()
    }

    unconstrained fn get_proposed_outcome(market_id: Field) -> pub Field {
        storage.proposed_outcome.at(market_id).read()
    }

    unconstrained fn get_proposed_at(market_id: Field) -> pub Field {
        storage.proposed_at.at(market_id).read()
    }

    unconstrained fn get_end_date(market_id: Field) -> pub Field {
        storage.end_dates.at(market_id).read()
    }

    unconstrained fn get_dispute_info(market_id: Field) -> pub (Field, AztecAddress) {
        (
            storage.dispute_bond.at(market_id).read(),
            storage.disputer.at(market_id).read(),
        )
    }

    unconstrained fn get_admin() -> pub AztecAddress {
        storage.admin.read()
    }

    /// Check whether a market is past its grace period and eligible for voiding.
    unconstrained fn is_void_eligible(market_id: Field, current_timestamp: Field) -> pub bool {
        let state = storage.resolution_state.at(market_id).read();
        let end_date = storage.end_dates.at(market_id).read();
        let grace_expiry = end_date + GRACE_PERIOD;
        (state == STATE_UNRESOLVED) & (current_timestamp as u64 >= grace_expiry as u64)
    }

    /// Seconds remaining in the challenge window. Returns 0 if expired.
    unconstrained fn challenge_seconds_remaining(
        market_id: Field,
        current_timestamp: Field,
    ) -> pub Field {
        let state = storage.resolution_state.at(market_id).read();
        if state != STATE_PROPOSED {
            0
        } else {
            let proposed_at = storage.proposed_at.at(market_id).read();
            let deadline = proposed_at + CHALLENGE_WINDOW;
            if current_timestamp as u64 >= deadline as u64 {
                0
            } else {
                deadline - current_timestamp
            }
        }
    }
}
