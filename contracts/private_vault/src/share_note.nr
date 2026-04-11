use aztec::macros::notes::note;
use aztec::protocol::traits::Packable;

/// YES/NO outcome shares for a specific market.
#[derive(Eq, Packable)]
#[note]
pub struct ShareNote {
    market_id: Field,
    side: Field,
    amount: Field,
    entry_price: Field,
}

impl ShareNote {
    pub fn new(
        market_id: Field,
        side: Field,
        amount: Field,
        entry_price: Field,
    ) -> Self {
        ShareNote { market_id, side, amount, entry_price }
    }

    pub fn get_market_id(self) -> Field {
        self.market_id
    }

    pub fn get_side(self) -> Field {
        self.side
    }

    pub fn get_amount(self) -> Field {
        self.amount
    }

    pub fn get_entry_price(self) -> Field {
        self.entry_price
    }
}
