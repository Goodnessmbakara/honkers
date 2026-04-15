# Honkers — Handoff Document

> Last updated: April 11, 2026
> Branch: `main`
> Aztec SDK: v4.1.3 | Noir: v0.35.0+ | Nargo: v0.75.0

---

## Project Summary

Honkers is a **private prediction market** built on Aztec Network. Users trade YES/NO outcome shares via a constant-product AMM, with positions kept private through Aztec's zero-knowledge execution layer. The platform runs PXE (Private Execution Environment) entirely in the browser — no server ever sees private notes or balances.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Browser                                                  │
│  ┌──────────┐  ┌──────────┐  ┌─────────────────────────┐ │
│  │ React UI │─▶│useWallet │─▶│ PXE (WASM, IndexedDB)   │ │
│  │ (Vite)   │  │useTrade  │  │ AccountManager + Schnorr │ │
│  └──────────┘  └──────────┘  └───────────┬─────────────┘ │
└──────────────────────────────────────────┼────────────────┘
                                           │ JSON-RPC (via /rpc proxy)
                              ┌────────────▼────────────┐
                              │  Aztec Sandbox (L2)      │
                              │  localhost:8080           │
                              └────────────┬────────────┘
                                           │
┌──────────────────────────────────────────┼────────────────┐
│  Backend services                        │                 │
│  ┌───────────┐  ┌───────────┐  ┌────────▼──────┐         │
│  │  Keeper   │  │  Indexer  │  │  PostgreSQL   │         │
│  │  (cron)   │  │  (poll)   │──│  (honkers db) │         │
│  └───────────┘  └───────────┘  └───────────────┘         │
└───────────────────────────────────────────────────────────┘
```

---

## What's Been Built (Completed Work)

### Smart Contracts (5 Noir contracts — all compile)
| Contract | Purpose | Status |
|----------|---------|--------|
| **PrivateVault** | CollateralNote, ShareNote, WinningNote schemas; 3% platform fee | Core logic done |
| **AMM** | CPMM (x*y=k), public reserves, market init/halt | Core logic done |
| **Oracle** | Propose → Dispute → Finalise lifecycle, 24h challenge window, 72h grace, auto-void | Core logic done |
| **MarketFactory** | Market creation, creator whitelist, bond tracking | Core logic done |
| **TestToken** | Testnet USDC mock, faucet with 1h cooldown, 100 USDC max drip | Core logic done |

### Frontend (Vite + React 19)
- **Wallet connection**: In-browser PXE via `createPXE` from `@aztec/pxe/client/bundle`, IndexedDB persistence, `MinimalWallet` bridge, `AccountManager` + `SchnorrAccountContract` for account creation
- **Vite config**: Full WASM compatibility — `optimizeDeps.exclude` for `@aztec/*`, COOP/COEP headers for SharedArrayBuffer, Node.js builtin shims, `/rpc` proxy to sandbox
- **Pages scaffolded**: Landing, Markets, Trade, Portfolio, Winnings, CreateMarket, Admin, Faucet, Terms, Risk, Privacy, GeoBlocked (15+ routes)
- **Component structure**: Organized by domain — wallet, trading, portfolio, admin, safety
- **Hooks**: `useWallet`, `useTrade`, `useFaucet`, `useAztecWallet`
- **Favicon and meta tags** configured

### Indexer (Node.js + Express + PostgreSQL)
- Express server with CORS, helmet, health endpoints
- PostgreSQL schema: `markets`, `resolutions`, `amm_snapshots` tables
- Event listener structure polling Aztec L2 blocks
- REST API: `/api/markets`, `/api/resolution`

### Keeper Bot (Node.js)
- Job orchestration: `pollMarketExpiry`, `triggerAutoVoid`, `monitorHealth`
- Slack webhook + PagerDuty alerting (optional)

### Infrastructure
- **Docker Compose**: Full local stack — Aztec Sandbox, PostgreSQL, Indexer, Keeper, Frontend with health checks and dependency ordering
- **Dockerfiles**: Frontend, Indexer, Keeper
- **SETUP.md**: Complete setup guide with Docker Compose quick-start and manual setup paths

### Documentation
- `PHASES.md` — 3-phase rollout roadmap
- `SRS.md` — Software requirements specification
- `ideation.md` — Design decisions and trade-offs
- `AZTEC_WALLET_CONNECT_GUIDE.md` — Browser wallet integration reference
- `SETUP.md` — Development environment setup

### Testing (partial)
- Noir unit tests (`nargo test`) for AMM math, note hashing — passing
- Integration test scaffold in `tests/integration/` — placeholder, ready for implementation
- E2E test scaffold in `tests/e2e/` — Playwright specs outlined

---

## What's NOT Done Yet (Next Steps)

### Priority 1 — Complete the Trading Loop (Critical Path)

These items complete the minimum viable user flow: **connect → fund → trade → resolve → claim**.

1. **Contract deployment script**
   - Write a deployment script that deploys all 5 contracts to the sandbox in order (TestToken → PrivateVault → AMM → Oracle → MarketFactory)
   - Populate `frontend/.env` with deployed contract addresses
   - Location: needs new file, e.g. `scripts/deploy.ts`

2. **Contract integration tests**
   - Implement the E2E test in `tests/integration/src/e2e.test.ts`
   - Cover: deploy → create market → trade YES → trade NO → resolve → claim winnings
   - This will surface any contract bugs before frontend integration

3. **Frontend ↔ Contract integration**
   - Wire `useTrade` hook to actually call AMM contract methods (currently structural/stubbed)
   - Wire `useFaucet` hook to call TestToken faucet
   - Wire portfolio page to read PXE notes (ShareNote, WinningNote)
   - Wire market list to fetch from indexer API + merge with on-chain state

4. **Indexer event parsing**
   - Complete `eventListener.ts` TODOs: map storage slot derivation for MarketFactory, Oracle, AMM
   - Implement volume aggregation from trade events (currently returns null)

5. **Proof generation UX**
   - FR-T-2: Progress indicator during local ZK proof generation
   - FR-T-3: Error handling and retry for proof failures

### Priority 2 — Polish for Internal Testing

6. **Wrong network detection** (FR-W-2)
   - Detect incompatible PXE or wrong sandbox URL, show recovery steps

7. **Market detail view** (FR-M-2)
   - Resolution criteria, source, creator info, schedule, status badge

8. **Trading disabled state** (FR-M-3)
   - Disable trade form when `now > end_date`

9. **Backup & recovery** (FR-B-1, FR-B-2, FR-B-3)
   - Export/import encrypted PXE note backup
   - Persistent banner until user acknowledges

10. **Admin console** (FR-A-1 through FR-A-5)
    - Resolution workflow, dispute window status, emergency pause

### Priority 3 — Beta Launch Readiness

11. **Sentry error tracking** — integrate, ensure no PII in logs
12. **Geo-blocking** — Vercel edge middleware for restricted jurisdictions
13. **Monitoring** — BetterStack/UptimeRobot for keeper and indexer health
14. **Seeded markets** — Create 20+ markets for public testnet launch
15. **Frontend E2E tests** — Playwright browser tests for critical flows

---

## Key Technical Decisions & Context

### Why in-browser PXE instead of remote PXE?
Privacy. The PXE holds decrypted notes and private state. Running it in-browser means no server ever sees user positions or balances. Trade-off: heavier client load (WASM compilation, IndexedDB).

### Why CPMM instead of LMSR?
Simpler Noir implementation, well-understood math. LMSR evaluation deferred to Phase 2 — exponential arithmetic in Noir circuits is expensive and may require recursive proof verification.

### Why Vite needs so much config?
Aztec SDK uses WASM (`@aztec/bb.js`, `@aztec/noir-acvm_js`), SharedArrayBuffer (Barretenberg threading), and Node.js built-ins. Each requires specific Vite handling. The `AZTEC_WALLET_CONNECT_GUIDE.md` documents all the gotchas.

### Secret key storage
Currently localStorage (acceptable for testnet). Production requires encrypted storage or KDF-derived keys from a user passphrase. Tracked for Phase 2.

### Account model
One Schnorr account per secret, fixed salt (`Fr.ZERO`). Multi-account support (random salt per account) is straightforward but not yet exposed in UI.

---

## File Map (Key Files)

```
contracts/
  private_vault/src/main.nr    — PrivateVault contract
  amm/src/main.nr              — CPMM AMM
  oracle/src/main.nr           — Resolution oracle
  market_factory/src/main.nr   — Market creation
  test_token/src/main.nr       — Testnet USDC faucet

frontend/
  src/config/aztec.ts           — PXE URL + contract addresses
  src/hooks/useAztecWallet.ts   — PXE singleton + context
  src/hooks/useWallet.ts        — Connect/disconnect flow
  src/hooks/useTrade.ts         — Trade execution (needs wiring)
  src/hooks/useFaucet.ts        — Faucet interaction (needs wiring)
  src/utils/MinimalWallet.ts    — PXE-to-Wallet bridge
  src/components/AztecProvider.tsx — Root provider
  src/components/wallet/WalletConnect.tsx — Connect button
  vite.config.ts                — WASM/polyfill/proxy config

indexer/
  src/eventListener.ts          — Block polling + event indexing
  src/db/schema.sql             — PostgreSQL schema
  src/api/                      — REST endpoints

keeper/
  src/jobs/                     — Cron jobs (expiry, void, health)

tests/
  noir/src/main.nr              — Noir unit tests
  integration/src/e2e.test.ts   — Integration tests (placeholder)
  e2e/specs/                    — Playwright specs

docker-compose.yml              — Full local dev stack
PHASES.md                       — Roadmap with checkboxes
SETUP.md                        — Dev environment guide
SRS.md                          — Requirements spec
```

---

## How to Run Locally

```bash
# Start everything
docker compose up -d

# Or manually:
# Terminal 1: Aztec Sandbox
docker run --rm -p 8080:8080 aztecprotocol/aztec:4.1.3 start --sandbox

# Terminal 2: PostgreSQL
docker run -d --name honkers-pg -e POSTGRES_USER=honkers -e POSTGRES_PASSWORD=honkers -e POSTGRES_DB=honkers -p 5432:5432 postgres:16

# Terminal 3: Frontend
cd frontend && pnpm install && pnpm dev
# Opens at http://localhost:5173
```

See `SETUP.md` for full details including contract deployment and environment variables.

---

## Known Issues & Risks

| Issue | Impact | Mitigation |
|-------|--------|------------|
| PXE init is slow (~10-30s) on first load | Poor UX on first visit | Loading indicator implemented; WASM caching helps on reload |
| localStorage secret storage is insecure | Testnet only acceptable | Phase 2: encrypted storage or KDF-derived keys |
| Indexer event parsing incomplete | Markets list won't populate | Priority 1 item — complete storage slot derivation |
| No deployment script yet | Manual contract deployment required | Priority 1 item — write `scripts/deploy.ts` |
| Aztec v4.1.3 may have breaking changes from upstream | SDK churn | Version pinned; assigned owner for tracking upstream changes |

---

## Phase Status

**Currently in: Phase 1 — Testnet MVP**

See `PHASES.md` for the full checklist with current completion status marked.

Phase 2 (Mainnet Prep) and Phase 3 (Decentralization) are planned but not started.

---

*This document should be updated as work progresses. The authoritative task list is in `PHASES.md`.*
