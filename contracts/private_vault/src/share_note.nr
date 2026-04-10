use dep::aztec::prelude::{AztecAddress, NoteHeader, NoteInterface, PrivateContext};
use dep::aztec::macros::notes::note;
use dep::aztec::protocol_types::traits::{Deserialize, Serialize};

/// YES/NO outcome shares for a specific market.
/// `side`: 1 = YES, 0 = NO (Field used instead of bool for circuit efficiency).
/// `entry_price`: price paid per share at trade time (fixed-point 1e6).
#[note]
pub struct ShareNote {
    owner: AztecAddress,
    market_id: Field,
    side: Field,
    amount: Field,
    entry_price: Field,
}

impl ShareNote {
    pub fn new(
        owner: AztecAddress,
        market_id: Field,
        side: Field,
        amount: Field,
        entry_price: Field,
    ) -> Self {
        ShareNote { owner, market_id, side, amount, entry_price, header: NoteHeader::empty() }
    }

    pub fn get_owner(self) -> AztecAddress {
        self.owner
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
