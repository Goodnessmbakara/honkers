use aztec::macros::aztec;

/// USDh (USD Honkers) -- testnet stablecoin for the Honkers prediction market.
///
/// Open faucet: anyone can mint up to 10,000 USDh per hour.
/// No L1 bridge -- testnet only.
#[aztec]
pub contract TestToken {
    use aztec::{
        macros::{functions::{external, initializer}, storage::storage},
        protocol::{address::AztecAddress, traits::ToField},
        state_vars::{Map, PublicImmutable, PublicMutable},
    };

    global MAX_FAUCET_AMOUNT: Field = 10000000000; // 10,000 USDh (6 decimals)
    global FAUCET_COOLDOWN: Field = 3600;           // 1 hour between mints

    #[storage]
    struct Storage<Context> {
        admin: PublicMutable<AztecAddress, Context>,
        name: PublicImmutable<Field, Context>,
        symbol: PublicImmutable<Field, Context>,
        decimals: PublicImmutable<Field, Context>,
        total_supply: PublicMutable<Field, Context>,
        balances: Map<AztecAddress, PublicMutable<Field, Context>, Context>,
        last_faucet: Map<Field, PublicMutable<Field, Context>, Context>,
    }

    #[initializer]
    #[external("public")]
    fn constructor(admin: AztecAddress, name: Field, symbol: Field) {
        self.storage.admin.write(admin);
        self.storage.name.initialize(name);
        self.storage.symbol.initialize(symbol);
        self.storage.decimals.initialize(6);
        self.storage.total_supply.write(0);
    }

    /// Public faucet -- anyone can call this once per hour to mint up to 10,000 USDh.
    #[external("public")]
    fn faucet(amount: Field) {
        assert(amount as u64 <= MAX_FAUCET_AMOUNT as u64, "Exceeds max faucet amount (10,000 USDh)");
        assert(amount as u64 > 0, "Amount must be positive");

        let sender = self.msg_sender();
        let key = sender.to_field();

        let last = self.storage.last_faucet.at(key).read();
        let now = self.context.timestamp() as Field;
        if last != 0 {
            assert(
                (now as u64 - last as u64) >= FAUCET_COOLDOWN as u64,
                "Faucet cooldown not expired (1 hour)",
            );
        }

        self.storage.last_faucet.at(key).write(now);

        let current = self.storage.balances.at(sender).read();
        self.storage.balances.at(sender).write(current + amount);
        self.storage.total_supply.write(self.storage.total_supply.read() + amount);
    }

    #[external("public")]
    fn admin_mint(to: AztecAddress, amount: Field) {
        let admin = self.storage.admin.read();
        assert(self.msg_sender() == admin, "Only admin can mint");

        let current = self.storage.balances.at(to).read();
        self.storage.balances.at(to).write(current + amount);
        self.storage.total_supply.write(self.storage.total_supply.read() + amount);
    }

    #[external("public")]
    fn transfer_public(to: AztecAddress, amount: Field) {
        let sender = self.msg_sender();
        let sender_balance = self.storage.balances.at(sender).read();
        assert(sender_balance as u64 >= amount as u64, "Insufficient balance");

        self.storage.balances.at(sender).write(sender_balance - amount);
        let recipient_balance = self.storage.balances.at(to).read();
        self.storage.balances.at(to).write(recipient_balance + amount);
    }

    #[external("utility")]
    unconstrained fn balance_of(owner: AztecAddress) -> pub Field {
        self.storage.balances.at(owner).read()
    }

    #[external("utility")]
    unconstrained fn total_supply() -> pub Field {
        self.storage.total_supply.read()
    }

    #[external("utility")]
    unconstrained fn get_name() -> pub Field {
        self.storage.name.read()
    }

    #[external("utility")]
    unconstrained fn get_symbol() -> pub Field {
        self.storage.symbol.read()
    }

    #[external("utility")]
    unconstrained fn get_decimals() -> pub Field {
        self.storage.decimals.read()
    }

    #[external("utility")]
    unconstrained fn get_admin() -> pub AztecAddress {
        self.storage.admin.read()
    }

    #[external("utility")]
    unconstrained fn last_faucet_time(owner: AztecAddress) -> pub Field {
        let key = owner.to_field();
        self.storage.last_faucet.at(key).read()
    }
}
