use aztec::macros::aztec;

/// AMM -- Constant Product Market Maker (x*y=k) for Phase 1.
#[aztec]
pub contract AMM {
    use aztec::{
        macros::{functions::{external, initializer}, storage::storage},
        protocol::address::AztecAddress,
        state_vars::{Map, PublicImmutable, PublicMutable},
    };

    global SCALE: Field = 1000000;

    #[storage]
    struct Storage<Context> {
        admin: PublicMutable<AztecAddress, Context>,
        vault: PublicImmutable<AztecAddress, Context>,
        oracle: PublicImmutable<AztecAddress, Context>,
        reserve_yes: Map<Field, PublicMutable<Field, Context>, Context>,
        reserve_no: Map<Field, PublicMutable<Field, Context>, Context>,
        invariant_k: Map<Field, PublicMutable<Field, Context>, Context>,
        end_dates: Map<Field, PublicMutable<Field, Context>, Context>,
        halted: Map<Field, PublicMutable<Field, Context>, Context>,
    }

    #[initializer]
    #[external("public")]
    fn constructor(admin: AztecAddress, vault: AztecAddress, oracle: AztecAddress) {
        self.storage.admin.write(admin);
        self.storage.vault.initialize(vault);
        self.storage.oracle.initialize(oracle);
    }

    #[external("public")]
    fn initialize_market(market_id: Field, initial_liquidity: Field, end_date: Field) {
        let existing = self.storage.invariant_k.at(market_id).read();
        assert(existing == 0, "Market already initialised");

        let half = (initial_liquidity as u64 / 2) as Field;
        assert(half != 0, "Liquidity too low");

        self.storage.reserve_yes.at(market_id).write(half);
        self.storage.reserve_no.at(market_id).write(half);
        self.storage.invariant_k.at(market_id).write(half * half);
        self.storage.end_dates.at(market_id).write(end_date);
        self.storage.halted.at(market_id).write(0);
    }

    #[external("public")]
    fn swap(market_id: Field, side: Field, amount_in: Field) -> Field {
        assert(self.storage.halted.at(market_id).read() == 0, "Market is halted");

        let end_date = self.storage.end_dates.at(market_id).read();
        assert((self.context.timestamp() as u64) <= end_date as u64, "Market has expired");

        let reserve_yes = self.storage.reserve_yes.at(market_id).read();
        let reserve_no = self.storage.reserve_no.at(market_id).read();
        let k = self.storage.invariant_k.at(market_id).read();

        assert(k != 0, "Market not initialised");

        let (reserve_in, reserve_out) = if side == 1 {
            (reserve_no, reserve_yes)
        } else {
            (reserve_yes, reserve_no)
        };

        let new_reserve_in = reserve_in + amount_in;
        let new_reserve_out = (k as u64 / new_reserve_in as u64) as Field;
        let shares_out = reserve_out - new_reserve_out;

        assert(shares_out as u64 > 0, "Trade too small");

        if side == 1 {
            self.storage.reserve_no.at(market_id).write(new_reserve_in);
            self.storage.reserve_yes.at(market_id).write(new_reserve_out);
        } else {
            self.storage.reserve_yes.at(market_id).write(new_reserve_in);
            self.storage.reserve_no.at(market_id).write(new_reserve_out);
        }

        shares_out
    }

    #[external("public")]
    fn halt_market(market_id: Field) {
        let admin = self.storage.admin.read();
        assert(self.msg_sender() == admin, "Only admin can halt");
        self.storage.halted.at(market_id).write(1);
    }

    #[external("utility")]
    unconstrained fn get_price_yes(market_id: Field) -> pub Field {
        let ry = self.storage.reserve_yes.at(market_id).read();
        let rn = self.storage.reserve_no.at(market_id).read();
        if (ry + rn) == 0 {
            0
        } else {
            ((rn as u64 * SCALE as u64) / (ry as u64 + rn as u64)) as Field
        }
    }

    #[external("utility")]
    unconstrained fn get_price_no(market_id: Field) -> pub Field {
        let ry = self.storage.reserve_yes.at(market_id).read();
        let rn = self.storage.reserve_no.at(market_id).read();
        if (ry + rn) == 0 {
            0
        } else {
            ((ry as u64 * SCALE as u64) / (ry as u64 + rn as u64)) as Field
        }
    }

    #[external("utility")]
    unconstrained fn get_reserves(market_id: Field) -> pub (Field, Field) {
        (
            self.storage.reserve_yes.at(market_id).read(),
            self.storage.reserve_no.at(market_id).read(),
        )
    }

    #[external("utility")]
    unconstrained fn is_halted(market_id: Field) -> pub Field {
        self.storage.halted.at(market_id).read()
    }
}
