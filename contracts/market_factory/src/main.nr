use aztec::macros::aztec;

/// MarketFactory -- market creation (bond + schedule checks; optional admin whitelist storage kept for compatibility).
#[aztec]
pub contract MarketFactory {
    use aztec::{
        macros::{functions::{external, initializer}, storage::storage},
        protocol::{address::AztecAddress, traits::{Serialize, ToField}},
        state_vars::{Map, PublicMutable},
    };

    // ---------------------------------------------------------------------------
    // Public event emitted on every create_market call.
    // Frontend reads this via node_getPublicLogs to display question text.
    //
    // Text fields are pre-packed by the caller: each Field holds up to 31 UTF-8
    // bytes, big-endian. question uses 3 fields (93 bytes), criteria 2 (62 bytes),
    // source 2 (62 bytes). Empty trailing fields are zero.
    // ---------------------------------------------------------------------------
    #[abi(events)]
    #[derive(Serialize)]
    struct MarketCreated {
        market_id: Field,
        question_0: Field,
        question_1: Field,
        question_2: Field,
        criteria_0: Field,
        criteria_1: Field,
        source_0: Field,
        source_1: Field,
        end_date: Field,
        creator: Field,
    }

    #[storage]
    struct Storage<Context> {
        admin: PublicMutable<AztecAddress, Context>,
        amm: PublicMutable<AztecAddress, Context>,
        oracle: PublicMutable<AztecAddress, Context>,
        token: PublicMutable<AztecAddress, Context>,
        deps_set: PublicMutable<Field, Context>,
        next_market_id: PublicMutable<Field, Context>,
        whitelist: Map<Field, PublicMutable<Field, Context>, Context>,
        market_question_hash: Map<Field, PublicMutable<Field, Context>, Context>,
        market_criteria_hash: Map<Field, PublicMutable<Field, Context>, Context>,
        market_source_hash: Map<Field, PublicMutable<Field, Context>, Context>,
        market_creator: Map<Field, PublicMutable<AztecAddress, Context>, Context>,
        market_end_date: Map<Field, PublicMutable<Field, Context>, Context>,
        market_bond: Map<Field, PublicMutable<Field, Context>, Context>,
    }

    #[initializer]
    #[external("public")]
    fn constructor(admin: AztecAddress) {
        self.storage.admin.write(admin);
        self.storage.next_market_id.write(1);
        self.storage.deps_set.write(0);
    }

    #[external("public")]
    fn set_dependencies(amm: AztecAddress, oracle: AztecAddress, token: AztecAddress) {
        let admin = self.storage.admin.read();
        assert(self.msg_sender() == admin, "Only admin can set dependencies");
        assert(self.storage.deps_set.read() == 0, "Dependencies already set");
        self.storage.amm.write(amm);
        self.storage.oracle.write(oracle);
        self.storage.token.write(token);
        self.storage.deps_set.write(1);
    }

    #[external("public")]
    fn add_to_whitelist(creator: AztecAddress) {
        let admin = self.storage.admin.read();
        assert(self.msg_sender() == admin, "Only admin can manage whitelist");
        let key = creator.to_field();
        self.storage.whitelist.at(key).write(1);
    }

    #[external("public")]
    fn remove_from_whitelist(creator: AztecAddress) {
        let admin = self.storage.admin.read();
        assert(self.msg_sender() == admin, "Only admin can manage whitelist");
        let key = creator.to_field();
        self.storage.whitelist.at(key).write(0);
    }

    // ---------------------------------------------------------------------------
    // create_market
    //
    // Hash params (question_hash etc.) are SHA-256 truncated to 31 bytes,
    // computed client-side and stored on-chain for integrity.
    //
    // Text params (question_0..2, criteria_0..1, source_0..1) are the raw UTF-8
    // bytes packed into Fields (31 bytes each, big-endian). They are NOT stored
    // on-chain - only emitted as a public log so the frontend can read them back.
    // Unused trailing bytes in each Field should be zero-padded by the caller.
    // ---------------------------------------------------------------------------
    #[external("public")]
    fn create_market(
        question_hash: Field,
        criteria_hash: Field,
        source_hash: Field,
        end_date: Field,
        bond_amount: Field,
        question_0: Field,
        question_1: Field,
        question_2: Field,
        criteria_0: Field,
        criteria_1: Field,
        source_0: Field,
        source_1: Field,
    ) -> Field {
        let creator = self.msg_sender();

        assert(bond_amount as u64 > 0, "Bond must be positive");
        assert(end_date as u64 > self.context.timestamp(), "End date must be in the future");

        let market_id = self.storage.next_market_id.read();
        self.storage.next_market_id.write(market_id + 1);

        self.storage.market_question_hash.at(market_id).write(question_hash);
        self.storage.market_criteria_hash.at(market_id).write(criteria_hash);
        self.storage.market_source_hash.at(market_id).write(source_hash);
        self.storage.market_creator.at(market_id).write(creator);
        self.storage.market_end_date.at(market_id).write(end_date);
        self.storage.market_bond.at(market_id).write(bond_amount);

        self.context.emit_public_log(MarketCreated {
            market_id,
            question_0,
            question_1,
            question_2,
            criteria_0,
            criteria_1,
            source_0,
            source_1,
            end_date,
            creator: creator.to_field(),
        });

        market_id
    }

    #[external("utility")]
    unconstrained fn get_next_market_id() -> pub Field {
        self.storage.next_market_id.read()
    }

    #[external("utility")]
    unconstrained fn is_whitelisted(creator: AztecAddress) -> pub Field {
        let key = creator.to_field();
        self.storage.whitelist.at(key).read()
    }

    #[external("utility")]
    unconstrained fn get_market_info(
        market_id: Field,
    ) -> pub (Field, Field, Field, AztecAddress, Field, Field) {
        (
            self.storage.market_question_hash.at(market_id).read(),
            self.storage.market_criteria_hash.at(market_id).read(),
            self.storage.market_source_hash.at(market_id).read(),
            self.storage.market_creator.at(market_id).read(),
            self.storage.market_end_date.at(market_id).read(),
            self.storage.market_bond.at(market_id).read(),
        )
    }

    #[external("utility")]
    unconstrained fn get_admin() -> pub AztecAddress {
        self.storage.admin.read()
    }
}
