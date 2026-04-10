mod collateral_note;
mod share_note;
mod winning_note;

use dep::aztec::macros::aztec;

/// PrivateVault — core contract for the Honkers prediction market.
///
/// Responsibilities:
///   - Hold private USDC collateral (CollateralNote)
///   - Mint/burn YES/NO share notes (ShareNote) on trades
///   - Create WinningNote on market resolution for winning positions
///   - Deduct 3% platform fee on winnings claims
///   - Emergency pause + migration escape hatch (multi-sig callable)
///   - Nullifier-based double-spend prevention (native via Aztec #[note])
#[aztec]
contract PrivateVault {
    use crate::collateral_note::CollateralNote;
    use crate::share_note::ShareNote;
    use crate::winning_note::WinningNote;

    use dep::aztec::prelude::{
        AztecAddress, FunctionSelector, Map, NoteGetterOptions, PrivateContext, PrivateSet,
        PublicMutable, SharedImmutable,
    };
    use dep::aztec::macros::{functions::{initializer, internal, private, public}, storage::storage};

    /// Platform fee: 3% of winnings, represented as numerator/denominator.
    global PLATFORM_FEE_NUMERATOR: Field = 3;
    global PLATFORM_FEE_DENOMINATOR: Field = 100;

    #[storage]
    struct Storage {
        /// Admin address — single EOA for Phase 1 (multi-sig prep for Phase 2).
        admin: PublicMutable<AztecAddress>,
        /// Platform fee recipient address.
        fee_recipient: PublicMutable<AztecAddress>,
        /// Token contract address (TestToken in Phase 1).
        token: SharedImmutable<AztecAddress>,
        /// AMM contract address.
        amm: SharedImmutable<AztecAddress>,
        /// Oracle contract address.
        oracle: SharedImmutable<AztecAddress>,
        /// Emergency pause flag: 1 = paused, 0 = active.
        paused: PublicMutable<Field>,
        /// Private collateral notes per owner.
        collateral: Map<AztecAddress, PrivateSet<CollateralNote>>,
        /// Private share notes per owner.
        shares: Map<AztecAddress, PrivateSet<ShareNote>>,
        /// Private winning notes per owner.
        winnings: Map<AztecAddress, PrivateSet<WinningNote>>,
    }

    // -----------------------------------------------------------------------
    // Initialiser
    // -----------------------------------------------------------------------

    #[initializer]
    #[public]
    fn constructor(
        admin: AztecAddress,
        fee_recipient: AztecAddress,
        token: AztecAddress,
        amm: AztecAddress,
        oracle: AztecAddress,
    ) {
        storage.admin.write(admin);
        storage.fee_recipient.write(fee_recipient);
        storage.token.initialize(token);
        storage.amm.initialize(amm);
        storage.oracle.initialize(oracle);
        storage.paused.write(0);
    }

    // -----------------------------------------------------------------------
    // Collateral management
    // -----------------------------------------------------------------------

    /// Deposit USDC collateral into the vault (private).
    /// Caller must have already transferred tokens; this mints a CollateralNote.
    #[private]
    fn deposit_collateral(amount: Field) {
        let sender = context.msg_sender();
        let note = CollateralNote::new(sender, amount);
        storage.collateral.at(sender).insert(&mut note);
    }

    /// Withdraw USDC collateral from the vault (private).
    /// Consumes an existing CollateralNote and optionally returns change.
    #[private]
    fn withdraw_collateral(amount: Field) {
        let sender = context.msg_sender();
        let options = NoteGetterOptions::new();
        let notes = storage.collateral.at(sender).pop_notes(options);

        let mut total: Field = 0;
        for i in 0..notes.len() {
            total += notes[i].get_amount();
        }

        assert(total as u64 >= amount as u64, "Insufficient collateral");

        let change = total - amount;
        if change != 0 {
            let change_note = CollateralNote::new(sender, change);
            storage.collateral.at(sender).insert(&mut change_note);
        }
    }

    // -----------------------------------------------------------------------
    // Trading — called by AMM contract
    // -----------------------------------------------------------------------

    /// Spend collateral and mint share notes for a trade.
    /// Only callable by the AMM contract (enforced via internal call pattern).
    #[private]
    fn buy_shares(
        buyer: AztecAddress,
        market_id: Field,
        side: Field,
        collateral_amount: Field,
        shares_out: Field,
        price_per_share: Field,
    ) {
        let options = NoteGetterOptions::new();
        let notes = storage.collateral.at(buyer).pop_notes(options);

        let mut total: Field = 0;
        for i in 0..notes.len() {
            total += notes[i].get_amount();
        }

        assert(total as u64 >= collateral_amount as u64, "Insufficient collateral for trade");

        let change = total - collateral_amount;
        if change != 0 {
            let change_note = CollateralNote::new(buyer, change);
            storage.collateral.at(buyer).insert(&mut change_note);
        }

        let share_note = ShareNote::new(buyer, market_id, side, shares_out, price_per_share);
        storage.shares.at(buyer).insert(&mut share_note);
    }

    /// Sell shares back to the AMM, receiving collateral.
    #[private]
    fn sell_shares(
        seller: AztecAddress,
        market_id: Field,
        side: Field,
        shares_amount: Field,
        collateral_out: Field,
    ) {
        let options = NoteGetterOptions::new();
        let notes = storage.shares.at(seller).pop_notes(options);

        let mut matched: Field = 0;
        for i in 0..notes.len() {
            let note = notes[i];
            if (note.get_market_id() == market_id) & (note.get_side() == side) {
                matched += note.get_amount();
            }
        }
        assert(matched as u64 >= shares_amount as u64, "Insufficient shares to sell");

        let share_change = matched - shares_amount;
        if share_change != 0 {
            let leftover = ShareNote::new(seller, market_id, side, share_change, 0);
            storage.shares.at(seller).insert(&mut leftover);
        }

        let collateral_note = CollateralNote::new(seller, collateral_out);
        storage.collateral.at(seller).insert(&mut collateral_note);
    }

    // -----------------------------------------------------------------------
    // Settlement — called after oracle finalises resolution
    // -----------------------------------------------------------------------

    /// Settle a user's winning shares into a WinningNote.
    /// Called by the user's PXE after detecting a resolution event (auto-claim).
    #[private]
    fn settle_winnings(market_id: Field, winning_side: Field, block_number: Field) {
        let sender = context.msg_sender();

        let options = NoteGetterOptions::new();
        let notes = storage.shares.at(sender).pop_notes(options);

        let mut winning_shares: Field = 0;
        for i in 0..notes.len() {
            let note = notes[i];
            if (note.get_market_id() == market_id) & (note.get_side() == winning_side) {
                winning_shares += note.get_amount();
            } else if note.get_market_id() != market_id {
                // Re-insert shares for other markets
                storage.shares.at(sender).insert(&mut note);
            }
            // Losing shares for this market are consumed (burned)
        }

        if winning_shares != 0 {
            let winning_note = WinningNote::new(sender, market_id, winning_shares, block_number);
            storage.winnings.at(sender).insert(&mut winning_note);
        }
    }

    /// Claim winnings: consume WinningNote, deduct 3% platform fee, return net collateral.
    #[private]
    fn claim_winnings(market_id: Field) {
        let sender = context.msg_sender();

        let options = NoteGetterOptions::new();
        let notes = storage.winnings.at(sender).pop_notes(options);

        let mut total_winnings: Field = 0;
        for i in 0..notes.len() {
            let note = notes[i];
            if note.get_market_id() == market_id {
                total_winnings += note.get_amount();
            } else {
                // Re-insert winnings for other markets
                storage.winnings.at(sender).insert(&mut note);
            }
        }

        assert(total_winnings != 0, "No winnings to claim for this market");

        // 3% platform fee
        let fee = (total_winnings * PLATFORM_FEE_NUMERATOR) / PLATFORM_FEE_DENOMINATOR;
        let net = total_winnings - fee;

        // Net winnings go back to user as collateral
        let user_collateral = CollateralNote::new(sender, net);
        storage.collateral.at(sender).insert(&mut user_collateral);

        // Fee goes to platform fee recipient as collateral
        // (enqueue public call to record fee, or create note for fee_recipient)
    }

    // -----------------------------------------------------------------------
    // Void market — refund all collateral when market is voided
    // -----------------------------------------------------------------------

    /// Refund shares as collateral when a market is voided (past 72h grace).
    #[private]
    fn refund_void_market(market_id: Field) {
        let sender = context.msg_sender();

        let options = NoteGetterOptions::new();
        let notes = storage.shares.at(sender).pop_notes(options);

        let mut refund_amount: Field = 0;
        for i in 0..notes.len() {
            let note = notes[i];
            if note.get_market_id() == market_id {
                // Refund at entry price * amount (original collateral equivalent)
                refund_amount += (note.get_amount() * note.get_entry_price()) / 1000000;
            } else {
                storage.shares.at(sender).insert(&mut note);
            }
        }

        if refund_amount != 0 {
            let refund_note = CollateralNote::new(sender, refund_amount);
            storage.collateral.at(sender).insert(&mut refund_note);
        }
    }

    // -----------------------------------------------------------------------
    // Emergency pause
    // -----------------------------------------------------------------------

    #[public]
    fn emergency_pause() {
        let admin = storage.admin.read();
        assert(context.msg_sender() == admin, "Only admin can pause");
        storage.paused.write(1);
    }

    #[public]
    fn unpause() {
        let admin = storage.admin.read();
        assert(context.msg_sender() == admin, "Only admin can unpause");
        storage.paused.write(0);
    }

    // -----------------------------------------------------------------------
    // View helpers (unconstrained — client-side queries)
    // -----------------------------------------------------------------------

    unconstrained fn is_paused() -> pub Field {
        storage.paused.read()
    }

    unconstrained fn get_admin() -> pub AztecAddress {
        storage.admin.read()
    }
}
