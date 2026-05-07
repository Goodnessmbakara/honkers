mod collateral_note;
mod share_note;
mod winning_note;

use aztec::macros::aztec;

/// PrivateVault -- core contract for the Honkers prediction market.
#[aztec]
pub contract PrivateVault {
    use crate::collateral_note::CollateralNote;
    use crate::share_note::ShareNote;
    use crate::winning_note::WinningNote;

    use aztec::{
        context::gas::GasOpts,
        macros::{functions::{external, initializer}, storage::storage},
        messages::message_delivery::MessageDelivery,
        note::note_getter_options::NoteGetterOptions,
        protocol::{
            abis::function_selector::FunctionSelector,
            address::AztecAddress,
            constants::MAX_NOTE_HASH_READ_REQUESTS_PER_CALL,
        },
        state_vars::{Owned, PrivateSet, PublicImmutable, PublicMutable},
    };

    global PLATFORM_FEE_NUMERATOR: Field = 3;
    global PLATFORM_FEE_DENOMINATOR: Field = 100;

    #[storage]
    struct Storage<Context> {
        admin: PublicMutable<AztecAddress, Context>,
        // C-3 fix: PublicImmutable allows reads from private context (set-once config)
        fee_recipient: PublicImmutable<AztecAddress, Context>,
        token: PublicImmutable<AztecAddress, Context>,
        amm: PublicImmutable<AztecAddress, Context>,
        oracle: PublicImmutable<AztecAddress, Context>,
        paused: PublicMutable<Field, Context>,
        collateral: Owned<PrivateSet<CollateralNote, Context>, Context>,
        shares: Owned<PrivateSet<ShareNote, Context>, Context>,
        winnings: Owned<PrivateSet<WinningNote, Context>, Context>,
    }

    #[initializer]
    #[external("public")]
    fn constructor(admin: AztecAddress, fee_recipient: AztecAddress) {
        self.storage.admin.write(admin);
        self.storage.fee_recipient.initialize(fee_recipient);
        self.storage.paused.write(0);
    }

    // set_dependencies initialises the immutable config addresses (one-time only).
    #[external("public")]
    fn set_dependencies(token: AztecAddress, amm: AztecAddress, oracle: AztecAddress) {
        let admin = self.storage.admin.read();
        assert(self.msg_sender() == admin, "Only admin can set dependencies");
        self.storage.token.initialize(token);
        self.storage.amm.initialize(amm);
        self.storage.oracle.initialize(oracle);
    }

    #[external("private")]
    fn deposit_collateral(amount: Field) {
        let sender = self.msg_sender();
        let note = CollateralNote::new(amount);
        self.storage.collateral.at(sender).insert(note).deliver(MessageDelivery.ONCHAIN_CONSTRAINED);
    }

    #[external("private")]
    fn withdraw_collateral(amount: Field) {
        let sender = self.msg_sender();
        let options = NoteGetterOptions::new();
        let notes = self.storage.collateral.at(sender).pop_notes(options);

        let mut total: Field = 0;
        for i in 0..MAX_NOTE_HASH_READ_REQUESTS_PER_CALL {
            if i < notes.len() {
                total += notes.get(i).get_amount();
            }
        }

        assert(total as u64 >= amount as u64, "Insufficient collateral");

        let change = total - amount;
        if change != 0 {
            let change_note = CollateralNote::new(change);
            self.storage.collateral.at(sender).insert(change_note).deliver(MessageDelivery.ONCHAIN_CONSTRAINED);
        }
    }

    // buy_shares: consumes collateral, mints share note, enqueues _verify_swap.
    // _verify_swap calls AMM.swap() on-chain and enforces slippage in the same tx.
    #[external("private")]
    fn buy_shares(
        market_id: Field,
        side: Field,
        collateral_amount: Field,
        min_shares_out: Field,
        price_per_share: Field,
    ) {
        let buyer = self.msg_sender();
        let options = NoteGetterOptions::new();
        let notes = self.storage.collateral.at(buyer).pop_notes(options);

        let mut total: Field = 0;
        for i in 0..MAX_NOTE_HASH_READ_REQUESTS_PER_CALL {
            if i < notes.len() {
                total += notes.get(i).get_amount();
            }
        }

        assert(total as u64 >= collateral_amount as u64, "Insufficient collateral for trade");

        let change = total - collateral_amount;
        if change != 0 {
            let change_note = CollateralNote::new(change);
            self.storage.collateral.at(buyer).insert(change_note).deliver(MessageDelivery.ONCHAIN_CONSTRAINED);
        }

        let share_note = ShareNote::new(market_id, side, min_shares_out, price_per_share);
        self.storage.shares.at(buyer).insert(share_note).deliver(MessageDelivery.ONCHAIN_CONSTRAINED);

        self.context.call_public_function(
            self.context.this_address(),
            comptime { FunctionSelector::from_signature("_verify_swap(Field,Field,Field,Field)") },
            [market_id, side, collateral_amount, min_shares_out],
            false,
        );
    }

    // _verify_swap: public, called by buy_shares enqueue only.
    // Executes the real AMM swap and enforces slippage.
    #[external("public")]
    fn _verify_swap(
        market_id: Field,
        side: Field,
        collateral_amount: Field,
        min_shares_out: Field,
    ) {
        let amm_addr = self.storage.amm.read();
        let results = self.context.call_public_function(
            amm_addr,
            comptime { FunctionSelector::from_signature("swap(Field,Field,Field)") },
            [market_id, side, collateral_amount],
            GasOpts::default(),
        );
        let actual_shares = results[0];
        assert(
            actual_shares as u64 >= min_shares_out as u64,
            "Slippage: actual shares below minimum",
        );
    }

    #[external("private")]
    fn settle_winnings(market_id: Field, winning_side: Field, block_number: Field) {
        let sender = self.msg_sender();

        let options = NoteGetterOptions::new();
        let notes = self.storage.shares.at(sender).pop_notes(options);

        let mut winning_shares: Field = 0;
        for i in 0..MAX_NOTE_HASH_READ_REQUESTS_PER_CALL {
            if i < notes.len() {
                let note = notes.get(i);
                if (note.get_market_id() == market_id) & (note.get_side() == winning_side) {
                    winning_shares += note.get_amount();
                } else if note.get_market_id() != market_id {
                    self.storage.shares.at(sender).insert(note).deliver(MessageDelivery.ONCHAIN_CONSTRAINED);
                }
            }
        }

        if winning_shares != 0 {
            let winning_note = WinningNote::new(market_id, winning_shares, block_number);
            self.storage.winnings.at(sender).insert(winning_note).deliver(MessageDelivery.ONCHAIN_CONSTRAINED);
        }
    }

    // C-3 fix: fee_recipient read from PublicImmutable (works in private context).
    #[external("private")]
    fn claim_winnings(market_id: Field) {
        let sender = self.msg_sender();
        let fee_recipient = self.storage.fee_recipient.read();

        let options = NoteGetterOptions::new();
        let notes = self.storage.winnings.at(sender).pop_notes(options);

        let mut total_winnings: Field = 0;
        for i in 0..MAX_NOTE_HASH_READ_REQUESTS_PER_CALL {
            if i < notes.len() {
                let note = notes.get(i);
                if note.get_market_id() == market_id {
                    total_winnings += note.get_amount();
                } else {
                    self.storage.winnings.at(sender).insert(note).deliver(MessageDelivery.ONCHAIN_CONSTRAINED);
                }
            }
        }

        assert(total_winnings != 0, "No winnings to claim for this market");

        let fee = ((total_winnings * PLATFORM_FEE_NUMERATOR) as u64 / PLATFORM_FEE_DENOMINATOR as u64) as Field;
        let net = total_winnings - fee;

        let user_collateral = CollateralNote::new(net);
        self.storage.collateral.at(sender).insert(user_collateral).deliver(MessageDelivery.ONCHAIN_CONSTRAINED);

        let fee_note = CollateralNote::new(fee);
        self.storage.collateral.at(fee_recipient).insert(fee_note).deliver(MessageDelivery.ONCHAIN_CONSTRAINED);
    }

    // C-4 fix: enqueue Oracle.assert_market_voided before processing refunds.
    // oracle is PublicImmutable so it can be read in private context.
    #[external("private")]
    fn refund_void_market(market_id: Field) {
        let sender = self.msg_sender();
        let oracle_addr = self.storage.oracle.read();

        // Enqueue static call to Oracle asserting the market is voided.
        // Reverts the whole tx if the market is not in STATE_VOIDED.
        self.context.static_call_public_function(
            oracle_addr,
            comptime { FunctionSelector::from_signature("assert_market_voided(Field)") },
            [market_id],
            false,
        );

        let options = NoteGetterOptions::new();
        let notes = self.storage.shares.at(sender).pop_notes(options);

        let mut refund_amount: Field = 0;
        for i in 0..MAX_NOTE_HASH_READ_REQUESTS_PER_CALL {
            if i < notes.len() {
                let note = notes.get(i);
                if note.get_market_id() == market_id {
                    refund_amount += ((note.get_amount() as u64 * note.get_entry_price() as u64) / 1000000) as Field;
                } else {
                    self.storage.shares.at(sender).insert(note).deliver(MessageDelivery.ONCHAIN_CONSTRAINED);
                }
            }
        }

        if refund_amount != 0 {
            let refund_note = CollateralNote::new(refund_amount);
            self.storage.collateral.at(sender).insert(refund_note).deliver(MessageDelivery.ONCHAIN_CONSTRAINED);
        }
    }

    #[external("public")]
    fn emergency_pause() {
        let admin = self.storage.admin.read();
        assert(self.msg_sender() == admin, "Only admin can pause");
        self.storage.paused.write(1);
    }

    #[external("public")]
    fn unpause() {
        let admin = self.storage.admin.read();
        assert(self.msg_sender() == admin, "Only admin can unpause");
        self.storage.paused.write(0);
    }

    #[external("utility")]
    unconstrained fn is_paused() -> pub Field {
        self.storage.paused.read()
    }

    #[external("utility")]
    unconstrained fn get_admin() -> pub AztecAddress {
        self.storage.admin.read()
    }
}
