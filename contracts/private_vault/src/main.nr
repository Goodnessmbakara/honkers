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
        state_vars::{Owned, PrivateSet, PublicMutable},
    };

    global PLATFORM_FEE_NUMERATOR: Field = 3;
    global PLATFORM_FEE_DENOMINATOR: Field = 100;

    #[storage]
    struct Storage<Context> {
        admin: PublicMutable<AztecAddress, Context>,
        fee_recipient: PublicMutable<AztecAddress, Context>,
        token: PublicMutable<AztecAddress, Context>,
        amm: PublicMutable<AztecAddress, Context>,
        oracle: PublicMutable<AztecAddress, Context>,
        deps_set: PublicMutable<Field, Context>,
        paused: PublicMutable<Field, Context>,
        collateral: Owned<PrivateSet<CollateralNote, Context>, Context>,
        shares: Owned<PrivateSet<ShareNote, Context>, Context>,
        winnings: Owned<PrivateSet<WinningNote, Context>, Context>,
    }

    #[initializer]
    #[external("public")]
    fn constructor(admin: AztecAddress, fee_recipient: AztecAddress) {
        self.storage.admin.write(admin);
        self.storage.fee_recipient.write(fee_recipient);
        self.storage.paused.write(0);
        self.storage.deps_set.write(0);
    }

    #[external("public")]
    fn set_dependencies(token: AztecAddress, amm: AztecAddress, oracle: AztecAddress) {
        let admin = self.storage.admin.read();
        assert(self.msg_sender() == admin, "Only admin can set dependencies");
        assert(self.storage.deps_set.read() == 0, "Dependencies already set");
        self.storage.token.write(token);
        self.storage.amm.write(amm);
        self.storage.oracle.write(oracle);
        self.storage.deps_set.write(1);
    }

    #[external("private")]
    fn deposit_collateral(amount: Field) {
        let sender = self.msg_sender();
        let note = CollateralNote::new(amount);
        self.storage.collateral.at(sender).insert(note).deliver(MessageDelivery.OFFCHAIN);
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
            self.storage.collateral.at(sender).insert(change_note).deliver(MessageDelivery.OFFCHAIN);
        }
    }

    // ---------------------------------------------------------------------------
    // buy_shares
    //
    // Private execution:
    //   1. Consume collateral notes, return change.
    //   2. Mint a share note with the caller-supplied shares_out.
    //   3. Enqueue _verify_swap (public) which calls AMM.swap() on-chain,
    //      verifies actual output >= min_shares_out, and updates AMM reserves.
    //
    // The share note is written with the caller's stated shares_out. If the
    // enqueued _verify_swap fails (slippage or AMM revert), the whole tx reverts
    // and the note is never inserted into the tree.
    //
    // price_per_share is kept for share note bookkeeping (refund calculations).
    // ---------------------------------------------------------------------------
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
            self.storage.collateral.at(buyer).insert(change_note).deliver(MessageDelivery.OFFCHAIN);
        }

        let share_note = ShareNote::new(market_id, side, min_shares_out, price_per_share);
        self.storage.shares.at(buyer).insert(share_note).deliver(MessageDelivery.OFFCHAIN);

        // Enqueue the public AMM swap + slippage verification.
        // Runs atomically in the same tx after private execution completes.
        // If AMM.swap() reverts or slippage fails, the entire tx reverts.
        self.context.call_public_function(
            self.context.this_address(),
            comptime { FunctionSelector::from_signature("_verify_swap(Field,Field,Field,Field)") },
            [market_id, side, collateral_amount, min_shares_out],
            false,
        );
    }

    // ---------------------------------------------------------------------------
    // _verify_swap (public, only callable from buy_shares via enqueue)
    //
    // Calls AMM.swap() cross-contract (public->public, return value available),
    // asserts actual shares >= min_shares_out, and lets the AMM update reserves.
    // If this reverts, the whole tx (including the private buy_shares) reverts.
    // ---------------------------------------------------------------------------
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
                    self.storage.shares.at(sender).insert(note).deliver(MessageDelivery.OFFCHAIN);
                }
            }
        }

        if winning_shares != 0 {
            let winning_note = WinningNote::new(market_id, winning_shares, block_number);
            self.storage.winnings.at(sender).insert(winning_note).deliver(MessageDelivery.OFFCHAIN);
        }
    }

    // fee_recipient passed by caller (C-3 known issue - not fixed yet)
    #[external("private")]
    fn claim_winnings(market_id: Field, fee_recipient: AztecAddress) {
        let sender = self.msg_sender();

        let options = NoteGetterOptions::new();
        let notes = self.storage.winnings.at(sender).pop_notes(options);

        let mut total_winnings: Field = 0;
        for i in 0..MAX_NOTE_HASH_READ_REQUESTS_PER_CALL {
            if i < notes.len() {
                let note = notes.get(i);
                if note.get_market_id() == market_id {
                    total_winnings += note.get_amount();
                } else {
                    self.storage.winnings.at(sender).insert(note).deliver(MessageDelivery.OFFCHAIN);
                }
            }
        }

        assert(total_winnings != 0, "No winnings to claim for this market");

        let fee = ((total_winnings * PLATFORM_FEE_NUMERATOR) as u64 / PLATFORM_FEE_DENOMINATOR as u64) as Field;
        let net = total_winnings - fee;

        let user_collateral = CollateralNote::new(net);
        self.storage.collateral.at(sender).insert(user_collateral).deliver(MessageDelivery.OFFCHAIN);

        let fee_note = CollateralNote::new(fee);
        self.storage.collateral.at(fee_recipient).insert(fee_note).deliver(MessageDelivery.OFFCHAIN);
    }

    #[external("private")]
    fn refund_void_market(market_id: Field) {
        let sender = self.msg_sender();

        let options = NoteGetterOptions::new();
        let notes = self.storage.shares.at(sender).pop_notes(options);

        let mut refund_amount: Field = 0;
        for i in 0..MAX_NOTE_HASH_READ_REQUESTS_PER_CALL {
            if i < notes.len() {
                let note = notes.get(i);
                if note.get_market_id() == market_id {
                    refund_amount += ((note.get_amount() as u64 * note.get_entry_price() as u64) / 1000000) as Field;
                } else {
                    self.storage.shares.at(sender).insert(note).deliver(MessageDelivery.OFFCHAIN);
                }
            }
        }

        if refund_amount != 0 {
            let refund_note = CollateralNote::new(refund_amount);
            self.storage.collateral.at(sender).insert(refund_note).deliver(MessageDelivery.OFFCHAIN);
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
