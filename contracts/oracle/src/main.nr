use aztec::macros::aztec;

/// Oracle -- market resolution contract.
#[aztec]
pub contract Oracle {
    use aztec::{
        macros::{functions::{external, initializer}, storage::storage},
        protocol::address::AztecAddress,
        state_vars::{Map, PublicImmutable, PublicMutable},
    };

    global CHALLENGE_WINDOW: Field = 86400;
    global GRACE_PERIOD: Field = 259200;

    global STATE_UNRESOLVED: Field = 0;
    global STATE_PROPOSED: Field = 1;
    global STATE_FINALISED: Field = 2;
    global STATE_DISPUTED: Field = 3;
    global STATE_VOIDED: Field = 4;

    #[storage]
    struct Storage<Context> {
        admin: PublicMutable<AztecAddress, Context>,
        amm: PublicImmutable<AztecAddress, Context>,
        resolution_state: Map<Field, PublicMutable<Field, Context>, Context>,
        proposed_outcome: Map<Field, PublicMutable<Field, Context>, Context>,
        proposed_at: Map<Field, PublicMutable<Field, Context>, Context>,
        end_dates: Map<Field, PublicMutable<Field, Context>, Context>,
        dispute_bond: Map<Field, PublicMutable<Field, Context>, Context>,
        disputer: Map<Field, PublicMutable<AztecAddress, Context>, Context>,
    }

    #[initializer]
    #[external("public")]
    fn constructor(admin: AztecAddress, amm: AztecAddress) {
        self.storage.admin.write(admin);
        self.storage.amm.initialize(amm);
    }

    #[external("public")]
    fn register_market(market_id: Field, end_date: Field) {
        let state = self.storage.resolution_state.at(market_id).read();
        assert(state == 0, "Market already registered");
        self.storage.end_dates.at(market_id).write(end_date);
        self.storage.resolution_state.at(market_id).write(STATE_UNRESOLVED);
    }

    #[external("public")]
    fn propose_resolution(market_id: Field, outcome: Field) {
        let admin = self.storage.admin.read();
        assert(self.msg_sender() == admin, "Only admin can propose resolution");

        let state = self.storage.resolution_state.at(market_id).read();
        assert(state == STATE_UNRESOLVED, "Market not in unresolved state");
        assert((outcome == 0) | (outcome == 1), "Outcome must be 0 (NO) or 1 (YES)");

        self.storage.proposed_outcome.at(market_id).write(outcome);
        self.storage.proposed_at.at(market_id).write(self.context.timestamp() as Field);
        self.storage.resolution_state.at(market_id).write(STATE_PROPOSED);
    }

    #[external("public")]
    fn dispute_resolution(market_id: Field, bond_amount: Field) {
        let state = self.storage.resolution_state.at(market_id).read();
        assert(state == STATE_PROPOSED, "Market not in proposed state");

        let proposed_at = self.storage.proposed_at.at(market_id).read();
        let now = self.context.timestamp() as Field;
        assert(
            (now as u64 - proposed_at as u64) < CHALLENGE_WINDOW as u64,
            "Challenge window has expired",
        );

        assert(bond_amount as u64 > 0, "Bond must be positive");

        self.storage.dispute_bond.at(market_id).write(bond_amount);
        self.storage.disputer.at(market_id).write(self.msg_sender());
        self.storage.resolution_state.at(market_id).write(STATE_DISPUTED);
    }

    #[external("public")]
    fn finalise_resolution(market_id: Field) {
        let state = self.storage.resolution_state.at(market_id).read();
        assert(state == STATE_PROPOSED, "Market not in proposed state");

        let proposed_at = self.storage.proposed_at.at(market_id).read();
        let now = self.context.timestamp() as Field;
        assert(
            (now as u64 - proposed_at as u64) >= CHALLENGE_WINDOW as u64,
            "Challenge window still active",
        );

        self.storage.resolution_state.at(market_id).write(STATE_FINALISED);
    }

    #[external("public")]
    fn resolve_dispute(market_id: Field, new_outcome: Field) {
        let admin = self.storage.admin.read();
        assert(self.msg_sender() == admin, "Only admin can resolve disputes");

        let state = self.storage.resolution_state.at(market_id).read();
        assert(state == STATE_DISPUTED, "Market not in disputed state");
        assert((new_outcome == 0) | (new_outcome == 1), "Outcome must be 0 or 1");

        self.storage.proposed_outcome.at(market_id).write(new_outcome);
        self.storage.proposed_at.at(market_id).write(self.context.timestamp() as Field);
        self.storage.resolution_state.at(market_id).write(STATE_PROPOSED);
    }

    #[external("public")]
    fn void_market(market_id: Field) {
        let state = self.storage.resolution_state.at(market_id).read();
        assert(state == STATE_UNRESOLVED, "Market already resolved or voided");

        let end_date = self.storage.end_dates.at(market_id).read();
        let now = self.context.timestamp() as Field;
        let grace_expiry = end_date + GRACE_PERIOD;

        assert(now as u64 >= grace_expiry as u64, "Grace period has not expired");

        self.storage.resolution_state.at(market_id).write(STATE_VOIDED);
    }

    #[external("utility")]
    unconstrained fn get_resolution_state(market_id: Field) -> pub Field {
        self.storage.resolution_state.at(market_id).read()
    }

    #[external("utility")]
    unconstrained fn get_proposed_outcome(market_id: Field) -> pub Field {
        self.storage.proposed_outcome.at(market_id).read()
    }

    #[external("utility")]
    unconstrained fn get_proposed_at(market_id: Field) -> pub Field {
        self.storage.proposed_at.at(market_id).read()
    }

    #[external("utility")]
    unconstrained fn get_end_date(market_id: Field) -> pub Field {
        self.storage.end_dates.at(market_id).read()
    }

    #[external("utility")]
    unconstrained fn get_dispute_info(market_id: Field) -> pub (Field, AztecAddress) {
        (
            self.storage.dispute_bond.at(market_id).read(),
            self.storage.disputer.at(market_id).read(),
        )
    }

    #[external("utility")]
    unconstrained fn get_admin() -> pub AztecAddress {
        self.storage.admin.read()
    }

    #[external("utility")]
    unconstrained fn is_void_eligible(market_id: Field, current_timestamp: Field) -> pub bool {
        let state = self.storage.resolution_state.at(market_id).read();
        let end_date = self.storage.end_dates.at(market_id).read();
        let grace_expiry = end_date + GRACE_PERIOD;
        (state == STATE_UNRESOLVED) & (current_timestamp as u64 >= grace_expiry as u64)
    }

    #[external("utility")]
    unconstrained fn challenge_seconds_remaining(
        market_id: Field,
        current_timestamp: Field,
    ) -> pub Field {
        let state = self.storage.resolution_state.at(market_id).read();
        if state != STATE_PROPOSED {
            0
        } else {
            let proposed_at = self.storage.proposed_at.at(market_id).read();
            let deadline = proposed_at + CHALLENGE_WINDOW;
            if current_timestamp as u64 >= deadline as u64 {
                0
            } else {
                deadline - current_timestamp
            }
        }
    }
}
