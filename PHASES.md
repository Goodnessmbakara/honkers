# Honkers — Phased Rollout Plan

Derived from `SRS.md` and `ideation.md`. Each phase builds on the previous one.

---

## Phase 1 — Testnet MVP

**Goal:** Functional prediction market on Aztec testnet with core trading loop, manual operations, and privacy fundamentals proven out.

### 1.1 Wallet & Session
- [ ] FR-W-1 — Aztec wallet connect, show address and sync status
- [ ] FR-W-2 — Wrong network / incompatible PXE detection with recovery steps
- [ ] FR-W-3 — Disconnect clears UI state; document PXE note behavior

### 1.2 Markets Discovery & Detail
- [ ] FR-M-1 — Market list from indexer (question, status, end time, implied odds, volume)
- [ ] FR-M-2 — Market detail view (resolution criteria, source, creator, schedule, status badge)
- [ ] FR-M-3 — Trading disabled display when `now > end_date`
- [ ] FR-M-4 — Resolution pending + countdown to auto-void after 72h grace
- [ ] FR-M-5 — Privacy caveat for AMM price impact leakage

### 1.3 Trading (Zero Fees)
- [ ] FR-T-1 — Trade form: side (YES/NO), size, estimated cost, slippage warning, fee = 0
- [ ] FR-T-2 — Local proof generation with progress UI (non-blocking)
- [ ] FR-T-3 — Proof failure: error + retry + hint to reduce size
- [ ] FR-T-4 — Chain revert: error message + return to form with prefilled values
- [ ] FR-T-5 — Market resolves during in-flight trade: cancellation + collateral safety message

### 1.4 Portfolio & Winnings
- [ ] FR-P-1 — Portfolio: private USDC balance + positions from PXE (no server aggregation)
- [ ] FR-P-2 — Winnings list: resolved markets with pending/claimed WinningNotes, merged with indexer question text
- [ ] FR-P-3 — Auto-claim: PXE scans resolution events, queues claim txs on session start
- [ ] FR-P-4 — Manual claim button as fallback
- [ ] FR-P-4 — Platform charge of 3% automatically charged

### 1.5 Faucet (Testnet Tokens)
- [ ] FR-F-1 — Authenticated testnet USDC faucet (fair-use rules)
- [ ] FR-F-2 — Sponsored FPC on local/devnet to reduce fee friction

### 1.6 Market Creation (Whitelisted)
- [ ] FR-C-1 — Only whitelisted creators see Create Market; others see explanation
- [ ] FR-C-2 — Form: question, resolution criteria, end date, resolution source, bond amount
- [ ] FR-C-3 — Creation + liquidity bond tx; success with market ID + link

### 1.7 Backup & Recovery
- [ ] FR-B-1 — Export encrypted note backup file
- [ ] FR-B-2 — Import backup to restore PXE notes
- [ ] FR-B-3 — Persistent banner until user acknowledges backup or exports

### 1.8 Legal & Compliance UI
- [ ] FR-L-1 — ToS and Risk pages linked from footer and before first trade
- [ ] FR-L-2 — Privacy model page: L1 visibility, AMM leakage, metadata
- [ ] FR-L-3 — Geo-block screen for blocked jurisdictions

### 1.9 Admin Console
- [ ] FR-A-1 — View markets needing resolution / in grace / void-eligible
- [ ] FR-A-2 — Resolution workflow (export payload for L1 Gnosis Safe or L2 AuthWit multi-sig + status tracking)
- [ ] FR-A-3 — Dispute window status per market
- [ ] FR-A-4 — Emergency pause / migration messaging
- [ ] FR-A-5 — Curated resolution input (internal DB/CSV, no Polymarket API)

### 1.10 Smart Contracts
- [ ] PrivateVault with CollateralNote, ShareNote, WinningNote schemas
- [ ] Nullifier-based double-spend prevention
- [ ] CPMM AMM (x*y=k) with documented limitations
- [ ] Oracle contract: admin EOA for testnet (multi-sig prep)
- [ ] Emergency pause + migration escape hatch (multi-sig callable)
- [ ] Trading halt at market end_date
- [ ] Expiry grace period (72h) + auto-void
- [ ] Time-locked resolution with 24–48h challenge window

### 1.11 Indexer & Backend
- [ ] PostgreSQL + custom Node.js indexer for Aztec public events
- [ ] REST/GraphQL API: markets list, detail, resolution status, questionText by marketId
- [ ] No plaintext private notes transmitted to servers

### 1.12 Keeper Bot
- [ ] pollMarketExpiry() — check for unresolved markets past end_date
- [ ] triggerAutoVoid() — void markets past grace period
- [ ] monitorHealth() — alert on failure (Slack/PagerDuty)
- [ ] Hosted on Railway/Fly.io with auto-restart

### 1.13 Frontend & Hosting
- [ ] Vite + React SPA (client-side only for private data)
- [ ] Deploy to Vercel with edge middleware for geo-blocking
- [ ] Sentry error tracking (no PII in logs)
- [ ] Configurable Aztec RPC URL (default proxy + user override)

### 1.14 Testing
- [ ] Noir unit tests (`nargo test`) for AMM math, note hashing, nullifiers
- [ ] Contract integration tests in Aztec Sandbox
- [ ] E2E tests: faucet → trade → resolve → claim
- [ ] Frontend E2E with Cypress or Playwright
- [ ] Fuzzing for AMM and vault invariants

### 1.15 Infrastructure & Ops
- [ ] Pin Aztec toolchain (aztec-up version, @aztec/aztec.js semver, Noir compiler version)
- [ ] Assign Aztec version owner for upstream breaking-change tracking
- [ ] Testnet keys setup (admin multi-sig, hardware wallets)
- [ ] Monitoring: BetterStack/UptimeRobot, Sentry, Logtail

### 1.16 Deployment
- [ ] Local sandbox testing (all contracts + keeper)
- [ ] Internal testnet deployment
- [ ] Smoke testing: full user flow
- [ ] Invite-only beta with trusted testers
- [ ] Public testnet launch with 20+ seeded markets

---

## Phase 2 — Mainnet Preparation

**Goal:** L1 bridge, fees, permissionless creation, LMSR evaluation, audit, and hardened operations.

### 2.1 L1 Deposit (Portal Flow)
- [ ] FR-D-1 — Deposit wizard: explain L1 leaks (EOA, amount, time) + depositSecret backup
- [ ] FR-D-2 — Steps: generate secret/hash → L1 approve + depositToAztecPrivate → L2 private claim → success
- [ ] FR-D-3 — Max deposit cap enforcement
- [ ] EI-2 — Ethereum wallet integration (MetaMask) for approve + deposit
- [ ] EI-4 — OFAC/sanctions check hook at deposit (pass/fail before L1 tx)

### 2.2 Withdraw (L2→L1)
- [ ] FR-X-1 — Warn that L1 recipient and amount are public on exit
- [ ] FR-X-2 — Private burn + L1 message flow with progress UI

### 2.3 Fee Structure
- [ ] AMM trading fee (0.3% per swap) credited to LPs
- [ ] Fee breakdown display in trade form (CMP-FEE-LINE)
- [ ] Fee settings preferences screen (SCR-FEE-SETTINGS)

### 2.4 Market Creation (Permissionless)
- [ ] FR-C-4 — Bond-based open creation without whitelist
- [ ] Bond calibration and forfeiture on void
- [ ] Community market submission form (SCR-COMMUNITY-PROPOSE)

### 2.5 AMM Upgrade Evaluation
- [ ] Benchmark LMSR implementation complexity in Noir
- [ ] If feasible: implement LMSR with `b` parameter tuning
- [ ] If constraints too heavy: evaluate recursive proof verification for LMSR pricing
- [ ] FR-T-6 — Chunked trade UX (stepper N of M) if single-tx proofs fail p95 targets

### 2.6 Oracle Upgrade
- [ ] Multi-sig resolver (3-of-5) replacing single admin EOA
- [ ] Commit-reveal for oracle resolution
- [ ] Multiple source aggregation for market data (Polymarket, Manifold, Metaculus) with legal review

### 2.7 Privacy Improvements
- [ ] FR-B-4 — Encrypted remote note sync (E2E encrypt before upload)
- [ ] Investigate deterministic note derivation from account key (track Aztec SDK roadmap; current recovery uses PXE re-registration + trial-decryption from on-chain logs)
- [ ] Batch execution with delayed price update to reduce AMM leakage
- [ ] Commit-reveal scheme for trades evaluation
- [ ] Non-logging RPC proxy as default + custom RPC option

### 2.8 Compliance & Legal
- [ ] Engage crypto-specialized legal firm for legal opinion
- [ ] Identify top 5 restricted jurisdictions; implement IP-based blocking
- [ ] Wallet address check against OFAC/sanctioned address lists at deposit
- [ ] Draft and publish ToS and risk disclosures
- [ ] Consider legal entity structure (offshore or Swiss Foundation)

### 2.9 Audit
- [ ] Internal security review + Aztec community review
- [ ] Full audit by Spearbit or Trail of Bits (budget: $80k–$150k)
- [ ] All critical findings fixed before mainnet deploy
- [ ] Audit report published publicly

### 2.10 Infrastructure Hardening
- [ ] Evaluate The Graph Protocol for Aztec subgraph (if ready)
- [ ] LP incentive programme design
- [ ] Use native contract upgrade mechanism (`ContractInstanceRegistry.update()` with `DelayedPublicMutable`) — no proxy pattern needed
- [ ] User-paid fee path (replace sponsored FPC for mainnet)

---

## Phase 3 — Decentralized Operations

**Goal:** Decentralized oracle, advanced privacy, governance, and ecosystem maturity.

### 3.1 UMA Optimistic Oracle
- [ ] Deploy L1 `OracleRelay.sol` integrating with UMA `OptimisticOracleV3` on Ethereum
- [ ] Bridge resolution results to Aztec L2 via canonical L1↔L2 portal messages
- [ ] L2 `Oracle.nr` consumes cross-chain messages to finalise market resolution
- [ ] Dispute flow: L2→L1 message triggers UMA dispute process, result bridged back
- [ ] Fully decentralized arbitration via UMA token holders

### 3.2 Advanced Auto-Claim
- [ ] Pre-authorized claim proof (delegated claim via keeper)
- [ ] Research Aztec note delegation maturity

### 3.3 Governance
- [ ] Dormancy sweep policy (1-year) for unclaimed winnings → DAO treasury
- [ ] Governance framework for protocol decisions

### 3.4 Decentralized Infrastructure
- [ ] Sequencer/prover node operation (match Aztec roadmap)
- [ ] Decentralized indexing (The Graph if Aztec-compatible)

---

## Phase Summary

| Phase | Focus | Key Deliverables |
|-------|-------|-----------------|
| **Phase 1** | Testnet MVP | Core trading loop, wallet, faucet, manual ops, privacy fundamentals, admin console |
| **Phase 2** | Mainnet Prep | L1 bridge, fees, permissionless creation, LMSR eval, audit, compliance |
| **Phase 3** | Decentralization | UMA oracle, delegated claims, governance, decentralized infra |

---

## Success Metrics (Phase 1 Targets)

| Metric | Target |
|--------|--------|
| Unique traders (30 days) | 200+ |
| Total trading volume (testnet) | Equivalent of 100k+ USDC |
| Average trade completion rate | >80% |
| Markets resolved correctly | 100% |
| Avg ZK proof time (p50) | < 20 seconds |
| Note recovery incidents | 0 unresolved |
| Critical/high bug reports | 0 unresolved within 48h |
| User retention (D7) | >40% |

---

*Derived from SRS v1.0 and ideation.md v1.2 — April 9, 2026*
