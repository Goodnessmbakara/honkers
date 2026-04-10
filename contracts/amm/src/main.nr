use dep::aztec::macros::aztec;

/// AMM — Constant Product Market Maker (x*y=k) for Phase 1.
///
/// Public state holds YES/NO token reserves per market.
/// Trading flow: private collateral input → public AMM state update → private share output.
/// Trading halts at market end_date (enforced by the contract).
///
/// Phase 1: zero trading fees. Phase 2: 0.3% fee credited to LPs.
///
/// Known limitations (documented, accepted for Phase 1):
///   - Cannot reach exactly 0 or 1 odds
///   - Large slippage at extreme probabilities
///   - Price impact from private trades is observable (AMM leakage caveat)
///   - LP impermanent loss on resolution
#[aztec]
contract AMM {
    use dep::aztec::prelude::{AztecAddress, Map, PublicMutable, SharedImmutable};
    use dep::aztec::macros::{functions::{initializer, internal, private, public}, storage::storage};

    /// Scaling factor for fixed-point arithmetic (USDC 6 decimals).
    global SCALE: Field = 1000000;

    #[storage]
    struct Storage {
        /// Admin address for emergency operations.
        admin: PublicMutable<AztecAddress>,
        /// PrivateVault contract address.
        vault: SharedImmutable<AztecAddress>,
        /// Oracle contract address (to check market status).
        oracle: SharedImmutable<AztecAddress>,
        /// YES token reserves per market. Key: market_id.
        reserve_yes: Map<Field, PublicMutable<Field>>,
        /// NO token reserves per market. Key: market_id.
        reserve_no: Map<Field, PublicMutable<Field>>,
        /// Invariant k = reserve_yes * reserve_no per market.
        invariant_k: Map<Field, PublicMutable<Field>>,
        /// Market end timestamps. Key: market_id. Trading blocked when block.timestamp > end_date.
        end_dates: Map<Field, PublicMutable<Field>>,
        /// Whether the market is halted (1 = halted, 0 = active). Key: market_id.
        halted: Map<Field, PublicMutable<Field>>,
    }

    // -----------------------------------------------------------------------
    // Initialiser
    // -----------------------------------------------------------------------

    #[initializer]
    #[public]
    fn constructor(admin: AztecAddress, vault: AztecAddress, oracle: AztecAddress) {
        storage.admin.write(admin);
        storage.vault.initialize(vault);
        storage.oracle.initialize(oracle);
    }

    // -----------------------------------------------------------------------
    // Market initialisation — called by MarketFactory on creation
    // -----------------------------------------------------------------------

    /// Initialise a market's AMM pool with equal YES/NO reserves (50/50 odds).
    /// `initial_liquidity` is the total USDC bond; split equally.
    #[public]
    fn initialize_market(market_id: Field, initial_liquidity: Field, end_date: Field) {
        let existing = storage.invariant_k.at(market_id).read();
        assert(existing == 0, "Market already initialised");

        let half = initial_liquidity / 2;
        assert(half != 0, "Liquidity too low");

        storage.reserve_yes.at(market_id).write(half);
        storage.reserve_no.at(market_id).write(half);
        storage.invariant_k.at(market_id).write(half * half);
        storage.end_dates.at(market_id).write(end_date);
        storage.halted.at(market_id).write(0);
    }

    // -----------------------------------------------------------------------
    // Trading — public state transitions
    // -----------------------------------------------------------------------

    /// Buy YES or NO shares. Side: 1 = YES, 0 = NO.
    /// Returns the number of shares the buyer receives.
    /// CPMM formula: shares_out = reserve_out - (k / (reserve_in + amount_in))
    #[public]
    fn swap(market_id: Field, side: Field, amount_in: Field) -> Field {
        assert(storage.halted.at(market_id).read() == 0, "Market is halted");

        let reserve_yes = storage.reserve_yes.at(market_id).read();
        let reserve_no = storage.reserve_no.at(market_id).read();
        let k = storage.invariant_k.at(market_id).read();

        assert(k != 0, "Market not initialised");

        let (reserve_in, reserve_out) = if side == 1 {
            (reserve_no, reserve_yes)
        } else {
            (reserve_yes, reserve_no)
        };

        let new_reserve_in = reserve_in + amount_in;
        // k / new_reserve_in (integer division)
        let new_reserve_out = k / new_reserve_in;
        let shares_out = reserve_out - new_reserve_out;

        assert(shares_out as u64 > 0, "Trade too small");

        // Update reserves
        if side == 1 {
            storage.reserve_no.at(market_id).write(new_reserve_in);
            storage.reserve_yes.at(market_id).write(new_reserve_out);
        } else {
            storage.reserve_yes.at(market_id).write(new_reserve_in);
            storage.reserve_no.at(market_id).write(new_reserve_out);
        }

        shares_out
    }

    // -----------------------------------------------------------------------
    // Trading halt
    // -----------------------------------------------------------------------

    /// Halt trading for a market (called at end_date or by admin).
    #[public]
    fn halt_market(market_id: Field) {
        let admin = storage.admin.read();
        assert(context.msg_sender() == admin, "Only admin can halt");
        storage.halted.at(market_id).write(1);
    }

    // -----------------------------------------------------------------------
    // Price queries (unconstrained — read-only helpers)
    // -----------------------------------------------------------------------

    /// Get implied probability of YES outcome.
    /// P(yes) = reserve_no / (reserve_yes + reserve_no)
    unconstrained fn get_price_yes(market_id: Field) -> pub Field {
        let ry = storage.reserve_yes.at(market_id).read();
        let rn = storage.reserve_no.at(market_id).read();
        if (ry + rn) == 0 {
            0
        } else {
            (rn * SCALE) / (ry + rn)
        }
    }

    /// Get implied probability of NO outcome.
    unconstrained fn get_price_no(market_id: Field) -> pub Field {
        let ry = storage.reserve_yes.at(market_id).read();
        let rn = storage.reserve_no.at(market_id).read();
        if (ry + rn) == 0 {
            0
        } else {
            (ry * SCALE) / (ry + rn)
        }
    }

    unconstrained fn get_reserves(market_id: Field) -> pub (Field, Field) {
        (
            storage.reserve_yes.at(market_id).read(),
            storage.reserve_no.at(market_id).read(),
        )
    }

    unconstrained fn is_halted(market_id: Field) -> pub Field {
        storage.halted.at(market_id).read()
    }
}
