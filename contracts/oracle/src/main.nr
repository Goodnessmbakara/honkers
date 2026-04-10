// Oracle — market resolution contract
// Phase 1: admin EOA resolves markets (multi-sig prep for Phase 2)
// Time-locked resolution: 24h challenge window before settlement finalises
// dispute() — anyone can dispute within window by posting a bond
// finalise_resolution() — callable after challenge window expires with no dispute
// Expiry grace period: 72h after end_date, then auto-void eligible
