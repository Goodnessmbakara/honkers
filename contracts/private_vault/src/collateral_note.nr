use dep::aztec::prelude::{AztecAddress, NoteHeader, NoteInterface, PrivateContext};
use dep::aztec::macros::notes::note;
use dep::aztec::protocol_types::traits::{Deserialize, Serialize};

/// Private USDC collateral held by a user.
/// Represents deposited funds available for trading.
/// Amount uses Field with 1e6 scaling (USDC 6 decimals).
#[note]
pub struct CollateralNote {
    owner: AztecAddress,
    amount: Field,
}

impl CollateralNote {
    pub fn new(owner: AztecAddress, amount: Field) -> Self {
        CollateralNote { owner, amount, header: NoteHeader::empty() }
    }

    pub fn get_owner(self) -> AztecAddress {
        self.owner
    }

    pub fn get_amount(self) -> Field {
        self.amount
    }
}
