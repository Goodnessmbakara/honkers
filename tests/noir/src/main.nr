/// Honkers — Noir unit tests
///
/// Pure arithmetic tests for AMM math, fee calculation, and price functions.
/// These do not require the Aztec Sandbox — run with:
///
///   nargo test
///
/// All amounts use 1e6 fixed-point scaling (USDC 6 decimals).
/// e.g. 100 USDC = 100_000_000.

// ---------------------------------------------------------------------------
// Constants (mirror contracts/amm/src/main.nr)
// ---------------------------------------------------------------------------

/// Fixed-point scale factor.
global SCALE: Field = 1_000_000;

/// Platform fee: 3 / 100.
global FEE_NUMERATOR: Field = 3;
global FEE_DENOMINATOR: Field = 100;

/// Side constants.
global SIDE_YES: Field = 1;
global SIDE_NO: Field = 0;

// ---------------------------------------------------------------------------
// Pure math helpers (mirrors contract logic — tested independently)
// ---------------------------------------------------------------------------

/// CPMM swap output.
/// shares_out = reserve_out - (k / (reserve_in + amount_in))
fn cpmm_shares_out(reserve_in: Field, reserve_out: Field, k: Field, amount_in: Field) -> Field {
    let new_reserve_in = reserve_in + amount_in;
    let new_reserve_out = k / new_reserve_in;
    reserve_out - new_reserve_out
}

/// Updated reserve after a buy-YES swap.
/// Returns (new_reserve_yes, new_reserve_no).
fn cpmm_buy_yes(reserve_yes: Field, reserve_no: Field, amount_in: Field) -> (Field, Field) {
    let k = reserve_yes * reserve_no;
    let new_no = reserve_no + amount_in;
    let new_yes = k / new_no;
    (new_yes, new_no)
}

/// Updated reserve after a buy-NO swap.
fn cpmm_buy_no(reserve_yes: Field, reserve_no: Field, amount_in: Field) -> (Field, Field) {
    let k = reserve_yes * reserve_no;
    let new_yes = reserve_yes + amount_in;
    let new_no = k / new_yes;
    (new_yes, new_no)
}

/// Implied P(YES) = reserve_no / (reserve_yes + reserve_no) * SCALE.
fn price_yes(reserve_yes: Field, reserve_no: Field) -> Field {
    (reserve_no * SCALE) / (reserve_yes + reserve_no)
}

/// Implied P(NO) = reserve_yes / (reserve_yes + reserve_no) * SCALE.
fn price_no(reserve_yes: Field, reserve_no: Field) -> Field {
    (reserve_yes * SCALE) / (reserve_yes + reserve_no)
}

/// Platform fee deducted from gross winnings.
/// fee = amount * FEE_NUMERATOR / FEE_DENOMINATOR
fn platform_fee(amount: Field) -> Field {
    (amount * FEE_NUMERATOR) / FEE_DENOMINATOR
}

/// Net winnings after platform fee.
fn net_winnings(gross: Field) -> Field {
    gross - platform_fee(gross)
}

fn main() {}

// ---------------------------------------------------------------------------
// AMM — initialisation
// ---------------------------------------------------------------------------

/// A market initialised with 1000 USDC bond gets 500 / 500 reserves and k = 250_000.
#[test]
fn test_cpmm_initial_50_50() {
    let bond: Field = 1_000_000_000; // 1000 USDC
    let half = bond / 2;
    let k = half * half;
    assert(half == 500_000_000);
    assert(k == 250_000_000_000_000_000);
}

// ---------------------------------------------------------------------------
// AMM — price at 50/50
// ---------------------------------------------------------------------------

/// At 50/50 reserves, P(YES) = P(NO) = 0.5 (500_000 in 1e6 scale).
#[test]
fn test_price_at_50_50() {
    let ry: Field = 500_000_000;
    let rn: Field = 500_000_000;
    let p_yes = price_yes(ry, rn);
    let p_no = price_no(ry, rn);
    // Both should be exactly 500_000 (0.5 in 1e6 scale)
    assert(p_yes == 500_000);
    assert(p_no == 500_000);
}

/// P(YES) + P(NO) = SCALE (probabilities sum to 1).
#[test]
fn test_price_sum_equals_scale() {
    let ry: Field = 300_000_000;
    let rn: Field = 700_000_000;
    let p_yes = price_yes(ry, rn);
    let p_no = price_no(ry, rn);
    assert(p_yes + p_no == SCALE);
}

/// When reserve_no > reserve_yes, P(YES) > 0.5.
#[test]
fn test_price_yes_when_skewed() {
    // More NO reserve means YES is "cheap" to buy → but P(YES) = rn / (ry+rn)
    // If rn = 700, ry = 300: P(YES) = 700/1000 = 0.7
    let ry: Field = 300_000_000;
    let rn: Field = 700_000_000;
    let p_yes = price_yes(ry, rn);
    assert(p_yes == 700_000); // 0.7 in 1e6 scale
}

// ---------------------------------------------------------------------------
// AMM — swap / trade math
// ---------------------------------------------------------------------------

/// Buying YES shares reduces reserve_yes and increases reserve_no.
/// The invariant k must be preserved (within integer division rounding).
#[test]
fn test_buy_yes_updates_reserves_correctly() {
    let ry: Field = 500_000_000;
    let rn: Field = 500_000_000;
    let k_before = ry * rn;
    let amount_in: Field = 10_000_000; // 10 USDC

    let (new_ry, new_rn) = cpmm_buy_yes(ry, rn, amount_in);

    // reserve_no increased by amount_in
    assert(new_rn == 510_000_000);
    // reserve_yes decreased
    assert(new_ry as u64 < ry as u64);
    // k preserved (within integer rounding)
    let k_after = new_ry * new_rn;
    // k_after may be slightly less than k_before due to integer division truncation
    assert(k_after as u64 <= k_before as u64);
    assert(k_before as u64 - k_after as u64 < 1_000_000); // rounding < 1 USDC
}

/// Buying NO shares reduces reserve_no and increases reserve_yes.
#[test]
fn test_buy_no_updates_reserves_correctly() {
    let ry: Field = 500_000_000;
    let rn: Field = 500_000_000;
    let amount_in: Field = 10_000_000; // 10 USDC

    let (new_ry, new_rn) = cpmm_buy_no(ry, rn, amount_in);

    assert(new_ry == 510_000_000);
    assert(new_rn as u64 < rn as u64);
}

/// shares_out is positive for a valid trade.
#[test]
fn test_cpmm_shares_out_positive() {
    let ry: Field = 500_000_000;
    let rn: Field = 500_000_000;
    let k = ry * rn;
    let amount_in: Field = 10_000_000;

    // buying YES: reserve_in = rn, reserve_out = ry
    let shares = cpmm_shares_out(rn, ry, k, amount_in);
    assert(shares as u64 > 0);
}

/// Larger trades produce more shares (monotonic output).
#[test]
fn test_larger_trade_gives_more_shares() {
    let ry: Field = 500_000_000;
    let rn: Field = 500_000_000;
    let k = ry * rn;

    let small = cpmm_shares_out(rn, ry, k, 5_000_000);  // 5 USDC
    let large = cpmm_shares_out(rn, ry, k, 50_000_000); // 50 USDC
    assert(large as u64 > small as u64);
}

/// After a buy, the new price of the bought side should increase (slippage).
#[test]
fn test_buy_yes_increases_yes_price() {
    let ry: Field = 500_000_000;
    let rn: Field = 500_000_000;

    let p_yes_before = price_yes(ry, rn); // 500_000
    let (new_ry, new_rn) = cpmm_buy_yes(ry, rn, 50_000_000); // buy YES with 50 USDC
    let p_yes_after = price_yes(new_ry, new_rn);

    assert(p_yes_after as u64 > p_yes_before as u64);
}

// ---------------------------------------------------------------------------
// AMM — edge cases
// ---------------------------------------------------------------------------

/// Price calculation is stable at extreme reserves (market strongly skewed).
#[test]
fn test_price_at_extreme_reserves() {
    // Market strongly skewed toward YES (90/10 split)
    let ry: Field = 900_000_000;
    let rn: Field = 100_000_000;
    let p_yes = price_yes(ry, rn);
    let p_no = price_no(ry, rn);
    assert(p_yes == 100_000); // ~0.1 — YES is cheap when it's highly likely? No wait.
    // P(YES) = rn / (ry + rn) = 100 / 1000 = 0.1
    // This means: YES is at 10 cents (unlikely), NO is at 90 cents (likely)
    assert(p_no == 900_000);
    assert(p_yes + p_no == SCALE);
}

// ---------------------------------------------------------------------------
// Fee calculation
// ---------------------------------------------------------------------------

/// Platform fee is exactly 3% of gross winnings.
#[test]
fn test_platform_fee_three_percent() {
    let gross: Field = 100_000_000; // 100 USDC
    let fee = platform_fee(gross);
    assert(fee == 3_000_000); // 3 USDC
}

/// Net winnings = gross - fee.
#[test]
fn test_net_winnings_after_fee() {
    let gross: Field = 100_000_000; // 100 USDC
    let net = net_winnings(gross);
    assert(net == 97_000_000); // 97 USDC
}

/// Fee rounds down (protects protocol — never charges more than 3%).
#[test]
fn test_fee_floor_division() {
    // Gross not divisible by 100 — fee should floor
    let gross: Field = 100_000_001;
    let fee = platform_fee(gross);
    let expected_floor = (100_000_001 * 3) / 100;
    assert(fee == expected_floor);
    // Net + fee <= gross (no overcharge)
    assert(net_winnings(gross) + fee == gross);
}

/// Zero winnings → zero fee.
#[test]
fn test_zero_gross_zero_fee() {
    let gross: Field = 0;
    let fee = platform_fee(gross);
    assert(fee == 0);
    assert(net_winnings(gross) == 0);
}

// ---------------------------------------------------------------------------
// Fixed-point arithmetic
// ---------------------------------------------------------------------------

/// SCALE is 1_000_000 (matches USDC 6 decimal places).
#[test]
fn test_scale_constant() {
    assert(SCALE == 1_000_000);
}

/// Prices in 1e6 scale: 500_000 represents 50%.
#[test]
fn test_fixed_point_price_interpretation() {
    let p: Field = 500_000; // 0.5 in 1e6 scale
    // Recover as percentage: p * 100 / SCALE = 50
    let pct = (p * 100) / SCALE;
    assert(pct == 50);
}
