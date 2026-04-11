use aztec::macros::notes::note;
use aztec::protocol::traits::Packable;

/// Claimable USDC winnings from a resolved market.
#[derive(Eq, Packable)]
#[note]
pub struct WinningNote {
    market_id: Field,
    amount: Field,
    resolved_at: Field,
}

impl WinningNote {
    pub fn new(
        market_id: Field,
        amount: Field,
        resolved_at: Field,
    ) -> Self {
        WinningNote { market_id, amount, resolved_at }
    }

    pub fn get_market_id(self) -> Field {
        self.market_id
    }

    pub fn get_amount(self) -> Field {
        self.amount
    }

    pub fn get_resolved_at(self) -> Field {
        self.resolved_at
    }
}
