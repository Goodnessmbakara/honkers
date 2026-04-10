// MarketFactory — market creation with whitelist gating (Phase 1)
// Only whitelisted creators can call create_market()
// Form: question hash, resolution criteria hash, end_date, resolution_source, bond_amount
// Creator deposits liquidity bond to seed AMM at 50/50
// Emits public event for indexer to pick up market metadata
// Phase 2: bond-based open creation without whitelist
