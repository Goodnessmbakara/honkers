use dep::aztec::prelude::{AztecAddress, NoteHeader, NoteInterface, PrivateContext};
use dep::aztec::macros::notes::note;
use dep::aztec::protocol_types::traits::{Deserialize, Serialize};

/// Claimable USDC winnings from a resolved market.
/// `amount` is net winnings BEFORE the 3% platform fee.
/// `resolved_at` is the L2 block number at resolution time.
/// Market question text is stored off-chain in the indexer DB, looked up by market_id.
#[note]
pub struct WinningNote {
    owner: AztecAddress,
    market_id: Field,
    amount: Field,
    resolved_at: Field,
}

impl WinningNote {
    pub fn new(
        owner: AztecAddress,
        market_id: Field,
        amount: Field,
        resolved_at: Field,
    ) -> Self {
        WinningNote { owner, market_id, amount, resolved_at, header: NoteHeader::empty() }
    }

    pub fn get_owner(self) -> AztecAddress {
        self.owner
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
