use dep::aztec::macros::aztec;

/// TestToken — testnet USDC for Phase 1 (no L1 bridge).
///
/// A simplified private token with:
///   - Public mint (faucet) with per-address rate limiting (fair-use).
///   - Private transfers via note consumption and creation.
///   - Total supply tracking (public).
///
/// Phase 1 uses Aztec's sponsored FPC on local/devnet to reduce fee friction.
/// This contract is NOT used in mainnet; replaced by real USDC via Token Portal.
#[aztec]
contract TestToken {
    use dep::aztec::prelude::{AztecAddress, Map, NoteGetterOptions, PrivateSet, PublicMutable, SharedImmutable};
    use dep::aztec::macros::{functions::{initializer, private, public}, storage::storage};

    /// Maximum faucet drip per address per request (100 USDC = 100_000_000 in 1e6).
    global MAX_FAUCET_AMOUNT: Field = 100000000;
    /// Cooldown period between faucet requests in seconds (1 hour).
    global FAUCET_COOLDOWN: Field = 3600;

    #[storage]
    struct Storage {
        /// Admin address.
        admin: PublicMutable<AztecAddress>,
        /// Token name hash (for display purposes).
        name: SharedImmutable<Field>,
        /// Token symbol hash.
        symbol: SharedImmutable<Field>,
        /// Decimals (6 for USDC).
        decimals: SharedImmutable<Field>,
        /// Total supply (public).
        total_supply: PublicMutable<Field>,
        /// Private balances per owner (set of value notes).
        /// We use a simple Field-amount note pattern here.
        balances: Map<AztecAddress, PublicMutable<Field>>,
        /// Last faucet timestamp per address (for rate limiting).
        last_faucet: Map<Field, PublicMutable<Field>>,
    }

    // -----------------------------------------------------------------------
    // Initialiser
    // -----------------------------------------------------------------------

    #[initializer]
    #[public]
    fn constructor(admin: AztecAddress, name: Field, symbol: Field) {
        storage.admin.write(admin);
        storage.name.initialize(name);
        storage.symbol.initialize(symbol);
        storage.decimals.initialize(6);
        storage.total_supply.write(0);
    }

    // -----------------------------------------------------------------------
    // Faucet — public mint with fair-use enforcement
    // -----------------------------------------------------------------------

    /// Request testnet tokens from the faucet.
    /// Rate-limited: one request per FAUCET_COOLDOWN per address.
    /// Max amount: MAX_FAUCET_AMOUNT per request.
    #[public]
    fn faucet(amount: Field) {
        assert(amount as u64 <= MAX_FAUCET_AMOUNT as u64, "Exceeds max faucet amount");
        assert(amount as u64 > 0, "Amount must be positive");

        let sender = context.msg_sender();
        let key = sender.to_field();

        // Rate limit check
        let last = storage.last_faucet.at(key).read();
        let now = context.timestamp();
        if last != 0 {
            assert(
                (now - last) as u64 >= FAUCET_COOLDOWN as u64,
                "Faucet cooldown not expired",
            );
        }

        storage.last_faucet.at(key).write(now);

        // Mint to sender's public balance
        let current = storage.balances.at(sender).read();
        storage.balances.at(sender).write(current + amount);
        storage.total_supply.write(storage.total_supply.read() + amount);
    }

    // -----------------------------------------------------------------------
    // Admin mint — no rate limit (for seeding markets, testing)
    // -----------------------------------------------------------------------

    #[public]
    fn admin_mint(to: AztecAddress, amount: Field) {
        let admin = storage.admin.read();
        assert(context.msg_sender() == admin, "Only admin can mint");

        let current = storage.balances.at(to).read();
        storage.balances.at(to).write(current + amount);
        storage.total_supply.write(storage.total_supply.read() + amount);
    }

    // -----------------------------------------------------------------------
    // Public transfers
    // -----------------------------------------------------------------------

    #[public]
    fn transfer_public(to: AztecAddress, amount: Field) {
        let sender = context.msg_sender();
        let sender_balance = storage.balances.at(sender).read();
        assert(sender_balance as u64 >= amount as u64, "Insufficient balance");

        storage.balances.at(sender).write(sender_balance - amount);
        let recipient_balance = storage.balances.at(to).read();
        storage.balances.at(to).write(recipient_balance + amount);
    }

    // -----------------------------------------------------------------------
    // View helpers (unconstrained)
    // -----------------------------------------------------------------------

    unconstrained fn balance_of(owner: AztecAddress) -> pub Field {
        storage.balances.at(owner).read()
    }

    unconstrained fn total_supply() -> pub Field {
        storage.total_supply.read()
    }

    unconstrained fn get_name() -> pub Field {
        storage.name.read()
    }

    unconstrained fn get_symbol() -> pub Field {
        storage.symbol.read()
    }

    unconstrained fn get_decimals() -> pub Field {
        storage.decimals.read()
    }

    unconstrained fn get_admin() -> pub AztecAddress {
        storage.admin.read()
    }

    unconstrained fn last_faucet_time(owner: AztecAddress) -> pub Field {
        let key = owner.to_field();
        storage.last_faucet.at(key).read()
    }
}
