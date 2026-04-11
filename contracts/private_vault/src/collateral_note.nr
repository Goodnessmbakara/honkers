use aztec::macros::notes::note;
use aztec::protocol::traits::Packable;

/// Private USDC collateral held by a user.
#[derive(Eq, Packable)]
#[note]
pub struct CollateralNote {
    amount: Field,
}

impl CollateralNote {
    pub fn new(amount: Field) -> Self {
        CollateralNote { amount }
    }

    pub fn get_amount(self) -> Field {
        self.amount
    }
}
