use dep::aztec::macros::aztec;

/// MarketFactory — market creation with whitelist gating (Phase 1).
///
/// Flow:
///   1. Whitelisted creator calls create_market() with metadata + liquidity bond.
///   2. Factory assigns a market_id (monotonic counter).
///   3. Factory initialises the AMM pool at 50/50 odds with the bond.
///   4. Factory registers the market in the Oracle for resolution tracking.
///   5. Emits public event (via public state writes) for the indexer to pick up.
///
/// Phase 2: bond-based open creation without whitelist (FR-C-4).
#[aztec]
contract MarketFactory {
    use dep::aztec::prelude::{AztecAddress, Map, PublicMutable, SharedImmutable};
    use dep::aztec::macros::{functions::{initializer, public}, storage::storage};

    #[storage]
    struct Storage {
        /// Admin address — manages the whitelist.
        admin: PublicMutable<AztecAddress>,
        /// AMM contract address.
        amm: SharedImmutable<AztecAddress>,
        /// Oracle contract address.
        oracle: SharedImmutable<AztecAddress>,
        /// Token contract address (for bond transfers).
        token: SharedImmutable<AztecAddress>,
        /// Monotonic market ID counter. Next market gets this ID.
        next_market_id: PublicMutable<Field>,
        /// Whitelist: 1 = allowed, 0 = not allowed. Key: creator address hash.
        whitelist: Map<Field, PublicMutable<Field>>,
        /// Market metadata stored publicly for indexer consumption.
        /// question_hash: hash of the market question string.
        market_question_hash: Map<Field, PublicMutable<Field>>,
        /// criteria_hash: hash of the resolution criteria string.
        market_criteria_hash: Map<Field, PublicMutable<Field>>,
        /// resolution_source_hash: hash of the resolution source URL/string.
        market_source_hash: Map<Field, PublicMutable<Field>>,
        /// Market creator address (public for accountability).
        market_creator: Map<Field, PublicMutable<AztecAddress>>,
        /// Market end date (timestamp).
        market_end_date: Map<Field, PublicMutable<Field>>,
        /// Bond amount deposited per market.
        market_bond: Map<Field, PublicMutable<Field>>,
    }

    // -----------------------------------------------------------------------
    // Initialiser
    // -----------------------------------------------------------------------

    #[initializer]
    #[public]
    fn constructor(admin: AztecAddress, amm: AztecAddress, oracle: AztecAddress, token: AztecAddress) {
        storage.admin.write(admin);
        storage.amm.initialize(amm);
        storage.oracle.initialize(oracle);
        storage.token.initialize(token);
        storage.next_market_id.write(1);
    }

    // -----------------------------------------------------------------------
    // Whitelist management
    // -----------------------------------------------------------------------

    /// Add a creator address to the whitelist.
    #[public]
    fn add_to_whitelist(creator: AztecAddress) {
        let admin = storage.admin.read();
        assert(context.msg_sender() == admin, "Only admin can manage whitelist");

        let key = creator.to_field();
        storage.whitelist.at(key).write(1);
    }

    /// Remove a creator address from the whitelist.
    #[public]
    fn remove_from_whitelist(creator: AztecAddress) {
        let admin = storage.admin.read();
        assert(context.msg_sender() == admin, "Only admin can manage whitelist");

        let key = creator.to_field();
        storage.whitelist.at(key).write(0);
    }

    // -----------------------------------------------------------------------
    // Market creation
    // -----------------------------------------------------------------------

    /// Create a new prediction market.
    ///
    /// Parameters:
    ///   - question_hash: poseidon hash of the question string (stored off-chain in indexer)
    ///   - criteria_hash: poseidon hash of the resolution criteria
    ///   - source_hash: poseidon hash of the resolution source
    ///   - end_date: timestamp after which trading halts
    ///   - bond_amount: USDC liquidity bond to seed the AMM
    ///
    /// Returns the assigned market_id.
    #[public]
    fn create_market(
        question_hash: Field,
        criteria_hash: Field,
        source_hash: Field,
        end_date: Field,
        bond_amount: Field,
    ) -> Field {
        let creator = context.msg_sender();

        // Phase 1: whitelist enforcement
        let key = creator.to_field();
        let is_whitelisted = storage.whitelist.at(key).read();
        assert(is_whitelisted == 1, "Creator not whitelisted");

        assert(bond_amount as u64 > 0, "Bond must be positive");
        assert(end_date as u64 > context.timestamp() as u64, "End date must be in the future");

        // Assign market ID
        let market_id = storage.next_market_id.read();
        storage.next_market_id.write(market_id + 1);

        // Store market metadata publicly (indexer reads these events)
        storage.market_question_hash.at(market_id).write(question_hash);
        storage.market_criteria_hash.at(market_id).write(criteria_hash);
        storage.market_source_hash.at(market_id).write(source_hash);
        storage.market_creator.at(market_id).write(creator);
        storage.market_end_date.at(market_id).write(end_date);
        storage.market_bond.at(market_id).write(bond_amount);

        // TODO: Cross-contract calls to AMM.initialize_market and Oracle.register_market
        // These require the contract call interface to be wired up during deployment.
        // AMM::at(storage.amm.read()).initialize_market(market_id, bond_amount, end_date);
        // Oracle::at(storage.oracle.read()).register_market(market_id, end_date);

        market_id
    }

    // -----------------------------------------------------------------------
    // View helpers (unconstrained)
    // -----------------------------------------------------------------------

    unconstrained fn get_next_market_id() -> pub Field {
        storage.next_market_id.read()
    }

    unconstrained fn is_whitelisted(creator: AztecAddress) -> pub Field {
        let key = creator.to_field();
        storage.whitelist.at(key).read()
    }

    unconstrained fn get_market_info(
        market_id: Field,
    ) -> pub (Field, Field, Field, AztecAddress, Field, Field) {
        (
            storage.market_question_hash.at(market_id).read(),
            storage.market_criteria_hash.at(market_id).read(),
            storage.market_source_hash.at(market_id).read(),
            storage.market_creator.at(market_id).read(),
            storage.market_end_date.at(market_id).read(),
            storage.market_bond.at(market_id).read(),
        )
    }

    unconstrained fn get_admin() -> pub AztecAddress {
        storage.admin.read()
    }
}
