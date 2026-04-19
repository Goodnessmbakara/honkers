# Honkers — Handoff Document

Status snapshot for co-contributors picking up the project.
Last updated: 2026-04-19

---

## Current working status

- **Create market** — `MarketFactory.create_market` enforces **bond > 0** and **end date in the future** only; the **whitelist gate is removed** in source (see *What's Done → Contracts*). **Redeploy** with `tests/integration/src/deploy.ts` so sandbox bytecode matches; an older deployment can still revert with "Creator not whitelisted" until replaced.
- **Faucet** — TestToken mint from the Faucet page works for connected wallets.
- **Wallet connect** — Account deploy via Sponsored FPC on first connect; auto-reconnect; stale PXE recovery on sandbox restart.
- **After deploy:** run `npx tsx src/create-market.ts` to seed a market; `/create` in the app uses hashed fields + five `Fr` args (`CreateMarket.tsx`).

---

## What's Done

### Contracts (Phase 1 — complete)
- **All 5 contracts ported** from Aztec v0.75.0 to v4.1.3 and compile clean
- **MarketFactory — open creation (2026-04-17)** — `create_market` no longer checks the whitelist map. Any address can create markets subject to **positive bond** and **end date in the future**. The `whitelist` storage map and `add_to_whitelist` / `remove_from_whitelist` / `is_whitelisted` methods remain for ABI compatibility but **do not gate** creation. Aligns product with SRS **FR-C-4** (bond-based open creation); original P1 whitelist was quality/spam control only (see `ideation.md`, `SRS.md`, `PHASES.md`).
- **Two-phase initialization** on AMM, Oracle, PrivateVault, MarketFactory to break circular deployment dependency (PublicImmutable changed to PublicMutable + one-time `set_dependencies()`)
- **TestToken** unchanged (no circular deps)
- **Codegen regenerated** via `aztec codegen` — TypeScript wrappers in `tests/integration/src/artifacts/`
- **Deploy script** at `tests/integration/src/deploy.ts` — deploys all 5 contracts + wires dependencies + writes `.env` files

### Frontend Infrastructure
- **In-browser PXE** via `@aztec/pxe/client/bundle` (WASM + IndexedDB `pxe/aztec-pxe-honkers`)
- **MinimalWallet** bridge (`BaseWallet` subclass) for `AccountManager`
- **Vite config** — WASM exclusions, CJS includes, node shims, COOP/COEP headers, `/rpc` proxy
- **Global wallet context** — `WalletProvider` in `contexts/WalletContext.tsx` centralizes wallet state (connected, address, syncing, connect/disconnect). All components share a single source of truth via `useWalletContext()`. The old `useWallet()` hook is a thin re-export for backward compatibility.
- **Protected routes** — `ProtectedRoute` component gates wallet-required pages (portfolio, winnings, faucet, create, backup, admin) at the routing level. Shows a "Wallet required" prompt with connect button instead of per-page inline guards.
- **Account contract deployment fixed** — The Schnorr account contract is now always deployed on-chain during connect. Previous bug: `pxe.getContractInstance()` returned locally-registered (not on-chain deployed) contracts, so deployment was always skipped.
- **Auto-reconnect** — `WalletProvider` re-registers the account on page reload when PXE is ready + stored credentials exist
- **StrictMode guard** — `connectingRef` prevents React StrictMode from firing connect() multiple times
- **Sandbox restart detection** — `useAztecWallet` tracks the L1 rollup address; automatically nukes stale IndexedDB + clears wallet credentials when the sandbox rolls to a new rollup address
- **Reset PXE button** — enumerates all IndexedDB databases matching `aztec` or `pxe` and deletes them all
- **Export backup** — dumps all Aztec/PXE IndexedDB databases + `honkers:*` localStorage keys to a JSON download
- **On-chain market fallback** — `useMarkets` tries the indexer API first; on failure falls back to reading `MarketFactory.get_next_market_id()` + `get_market_info(id)` directly via simulate calls. Null-guarded against stale contract addresses. Indexer list responses use `{ markets }`; the hook also accepts `data` for compatibility.
- **Trade flow** — `useTrade` runs `deposit_collateral` then `buy_shares` with five arguments. AMM `get_price_yes` / `get_price_no` (simulate) supplies `price_per_share`; `maxSlippage` is basis points applied to minimum `shares_out`. Two transactions (two proof cycles). **Proof UI** shows **(1/2) Deposit** vs **(2/2) Buy shares** in `ProofProgress`.
- **Market detail & charts (indexer + chain)** — `useMarketDetail` / `useMarketPrices` hit the indexer first; on **404** or **fetch error** they fall back to **AMM** + **MarketFactory** simulates (`get_market_info`, `get_price_yes` / `get_price_no`, `get_reserves`) when the wallet is connected. API bodies are **normalized** (indexer camelCase, optional `{ data }` wrapper). `Trade` distinguishes loading vs missing market.
- **Portfolio** — `usePXE.getPrivateNotes` uses `pxe.debug.getNotes` (PrivateVault slots 8=collateral, 9=shares, 10=winnings). `claim_winnings` passes `fee_recipient` from `VITE_FEE_RECIPIENT_ADDRESS` or falls back to `get_admin()`.

### Indexer (public state)
- **`node_getPublicStorageAt` + Poseidon2 map slots** — `@aztec/foundation` `poseidon2Hash([base_slot, market_id])` per codegen storage layouts (`tests/integration/src/artifacts/*`). `next_market_id` uses scalar slot **6** (not 8).
- **`indexer/src/indexer/mapSlot.ts`** — shared `deriveMapSlot`; **`eventListener.ts`** upserts markets, updates oracle `resolutions`, appends `amm_snapshots`.

### Market Creation Script
- `tests/integration/src/create-market.ts` — standalone Node.js script
- Uses server-side PXE (`@aztec/pxe/server`) with `AdminWallet`
- Hashes question/criteria/source (SHA-256, truncated to 31 bytes for field) → `MarketFactory.create_market()` → `Oracle.register_market()` (no whitelist step)
- `tests/integration/src/whitelist.ts` — optional; calls `add_to_whitelist` if you still want to record flags on-chain (not required for creation)
- `tests/integration/src/redeploy-factory.ts` — helper when only MarketFactory bytecode changes (use full `deploy.ts` for greenfield)
- Successfully created test market: "Will Bola Ahmed Tinubu win the 2027 Nigerian Presidential Election?" (hash `0x00a22e5706261089c02407859a5b71b7ff4d95c89d0da2479cfa89d1fc9895be`)

### Deployment
- Contracts deploy successfully to sandbox via `npx tsx src/deploy.ts`
- `.env` files auto-generated for both root and `frontend/`
- Database schema migration works (`indexer/src/db/migrate.ts`)

### Documentation
- SETUP.md updated for v4.1.3 (deploy instructions, env vars, troubleshooting, changelog)
- AZTEC_WALLET_CONNECT_GUIDE.md — comprehensive guide for in-browser PXE + wallet

### Reusable SDK (aztec-connect/)
- Standalone package at root with three entry points:
  - Core: `getOrCreatePXE()`, `connectAccount()`, `MinimalWallet`
  - React: `AztecConnectProvider`, `useAccount()`, `useAztecConnect()`
  - Vite: `aztecVitePlugin()` — one-line Vite config for Aztec
- TypeScript compiles clean

---

## Known Bugs

### Fixed (this session — 2026-04-15)

- **B1 — Account contract not deployed**: Root cause was `pxe.getContractInstance()` returning locally-registered contracts, making the deployment check always skip. Fix: always attempt `deployMethod.send({ from })`, catch "already deployed" gracefully.
- **B2 — Markets page toString crash**: Null-guarded the `simulate()` result in `useMarkets.ts` `fetchFromChain()`. Skips markets with incomplete data instead of crashing.
- **B3 — Wallet connect fires multiple times**: Added `connectingRef` guard ref to prevent React StrictMode double-invocation.
- **Unused variable warnings**: Removed unused `PXE_DB_NAME` from WalletConnect.tsx, unused `pxe` destructuring from useWallet.ts.

### Open

- **B5 — Second error on retry (IndexedDB)**: "Failed to execute 'get' on 'IDBObjectStore': The transaction has finished" — IndexedDB transaction lifetime issue in PXE's kv-store. May surface after stale DB nuke during PXE init. Needs investigation.

### Fixed (2026-04-17)

- **B4 — Indexer public map reads**: Addressed by Poseidon2-derived map slots + `node_getPublicStorageAt` for MarketFactory, Oracle, and AMM (see `indexer/src/indexer/eventListener.ts`, `mapSlot.ts`). Re-verify against a live sandbox after deploy.

### Not Yet Tested (2026-04-15 changes)

> **Important**: The B1/B2/B3 fixes and the global auth refactor (WalletProvider, ProtectedRoute) compile clean (zero TS errors) but have **not been end-to-end tested** in a running sandbox session yet. The sandbox was not running with deployed contracts during this session. Testing needed:
> - Wallet connect → account contract deployment succeeds
> - Faucet mint works after account deployment
> - Protected routes gate correctly (show "Wallet required" when disconnected)
> - Markets page loads from on-chain fallback with deployed contracts
> - Auto-reconnect on page reload works

---

## What's Left (by priority)

### P0 / P1 — Operational verification (automated + manual)

**Problem (first principles):** Sandbox state resets, deploy writes new addresses, and three moving parts (node, Postgres+indexer, frontend env) must line up. Browser-only flows cannot be scripted without a dedicated E2E harness.

**Automated stack check (run after sandbox + indexer are up):**

```bash
# From repo root
pnpm verify:stack
# → node scripts/verify-dev-stack.mjs
#    • JSON-RPC node_getNodeInfo @ AZTEC_RPC_URL (default http://localhost:8080)
#    • GET /health + GET /api/markets @ INDEXER_URL (default http://localhost:3001)
#    • Warns if frontend/.env lacks contract addresses (deploy not run)
```

**P0 — Redeploy contracts (sandbox restart or MarketFactory change)**

1. Start sandbox (`aztec start --sandbox` or your Docker compose Aztec service).
2. `cd tests/integration && pnpm exec tsx src/deploy.ts` — refreshes root + `frontend/.env` addresses.
3. After **MarketFactory** source changes, full deploy (or `src/redeploy-factory.ts` if you only replace factory bytecode); otherwise UI may still hit old logic (e.g. whitelist).
4. Seed market: `pnpm exec tsx src/create-market.ts` (no whitelist step).
5. Re-run `pnpm verify:stack` — should report `frontend/.env` OK.

**P0 — Manual E2E (B1 account deploy + auth refactor — not covered by verify:stack)**

| Step | Pass criteria |
|------|----------------|
| Connect | Account contract deploys (Sponsored FPC); address shows in UI |
| Faucet | Mint succeeds for connected wallet |
| Markets / Trade / Portfolio | Pages load; trade uses two-step proof UX |
| ProtectedRoute | Disconnect → visit `/portfolio` (or other gated route) → “Wallet required” + connect affordance |
| Reload | Auto-reconnect when PXE + stored credentials present |

**P1 — Indexer + DB (same session)**

1. `docker start honkers-postgres` (or equivalent) — DB up.
2. `cd indexer && DATABASE_URL=… pnpm db:migrate` if schema not applied.
3. Set `MARKET_FACTORY_ADDRESS`, `AMM_ADDRESS`, `ORACLE_ADDRESS`, `TEST_TOKEN_ADDRESS` in indexer env (match `frontend/.env` after deploy).
4. `cd indexer && pnpm dev` — event listener + API.
5. `pnpm verify:stack` — confirms `/api/markets` returns JSON; if markets exist but `questionText` still looks like a placeholder, run a poll cycle or `POST /api/markets/:id/metadata`.

**Owner:** Anyone starting a dev session; run `pnpm verify:stack` before reporting “stack is up.”

### P1 — Remaining frontend / product gaps
- **Human-readable copy**: on-chain fallback still only resolves question text via `KNOWN_QUESTIONS` in `useMarkets.ts` (hash → string). For arbitrary creator markets, use indexer **`POST /api/markets/:id/metadata`** (or DB `market_metadata`) so list/detail show real questions/criteria/source when the indexer is up.
- **Optional**: batch deposit+buy into one user-facing stepper with explicit “tx 1 / tx 2” receipts (still two proofs on-chain).
- **Owner**: Frontend developer

### P2 — Integration hardening
- **Keeper**: `cd keeper && pnpm dev` — wire env to sandbox + DB for auto-void / health (see `keeper/README` if present).
- **Playwright** (`tests/e2e/`): specs expect **`data-testid`** hooks (`connect-wallet`, `market-card`, …) that are **not yet wired** in React — add testids or trim specs to match current routes (`/trade/:id` vs inline trade).
- **Contract integration tests**: `tests/integration/src/e2e.test.ts` — run against live sandbox when available (`pnpm test` in `tests/integration`).
- **Owner**: QA / full-stack

### P3 — Polish
- Docker Compose end to end (sandbox + postgres + indexer + keeper + frontend)
- Error handling for edge cases (insufficient balance, market closed, etc.)
- Import backup feature (Backup.tsx — currently placeholder)
- Publish aztec-connect SDK to npm
- **Owner**: DevOps / full-stack

---

## How to Resume Development

### Prerequisites (local PC — first time only)

Install before cloning if not already present:

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20 LTS | https://nodejs.org or `nvm install 20` |
| pnpm | 10 | `npm install -g pnpm@10` |
| Docker Desktop | latest | https://docs.docker.com/get-docker/ |
| Git | any | https://git-scm.com |

```bash
# Clone
git clone https://github.com/Goodnessmbakara/honkers.git
cd honkers

# Install all workspace dependencies
pnpm install          # root
cd tests/integration && pnpm install && cd ../..
cd frontend && pnpm install && cd ..
cd indexer && pnpm install && cd ..
```

### Running the stack (Docker — recommended for all environments)

```bash
# 1. Start all services (ethereum, sandbox, postgres, indexer, keeper, frontend)
docker compose up -d

# 2. Wait for sandbox to be healthy (~60s), then deploy contracts
#    Watch progress: docker compose logs -f sandbox
cd tests/integration && npx tsx src/deploy.ts && cd ../..

# 3. Seed a test market
cd tests/integration && npx tsx src/create-market.ts && cd ../..

# 4. Rebuild frontend with the new contract addresses written to frontend/.env
docker compose up -d --build frontend

# 5. Open in browser
#    Local PC:   http://localhost:5173
#    GitHub Codespace: use the forwarded port URL shown in VS Code "Ports" panel
#
#    - Connect wallet (Sponsored FPC deploys account contract on first connect)
#    - Use faucet to mint test tokens
#    - Markets page shows the Bitcoin market via on-chain fallback
```

> **Note for Codespace users only:** The browser cannot reach `localhost:8080` or
> `localhost:3001` directly. The Vite dev server already proxies both via `/rpc`
> and `/api`. On a local PC with Docker Desktop, `localhost` works fine.

### Every time the sandbox restarts (volumes removed or `docker compose down -v`)

Contracts are wiped on restart. Repeat steps 2–4:

```bash
cd tests/integration && npx tsx src/deploy.ts && cd ../..
cd tests/integration && npx tsx src/create-market.ts && cd ../..
docker compose up -d --build frontend
```

Then **clear browser site data** for `localhost:5173` (or open incognito) to flush the stale PXE IndexedDB.

### Running without Docker (local PC only)

```bash
# Terminal 1 — Aztec sandbox
npx @aztec/aztec@0.84.0 start --sandbox

# Terminal 2 — PostgreSQL
docker run -d --name honkers-pg -e POSTGRES_USER=honkers   -e POSTGRES_PASSWORD=honkers -e POSTGRES_DB=honkers   -p 5432:5432 postgres:16-alpine

# Terminal 3 — Deploy contracts + seed market
cd tests/integration
npx tsx src/deploy.ts
npx tsx src/create-market.ts
cd ../..

# Terminal 4 — Indexer
cd indexer
DATABASE_URL="postgresql://honkers:honkers@localhost:5432/honkers" AZTEC_RPC_URL="http://localhost:8080" npx tsx src/db/migrate.ts
DATABASE_URL="postgresql://honkers:honkers@localhost:5432/honkers" pnpm dev
cd ..

# Terminal 5 — Frontend
cd frontend && pnpm dev
# Open http://localhost:5173
```

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| `MarketFactory not found on-chain` | Sandbox restarted — run deploy + create-market + rebuild frontend (steps 2–4) |
| `block hash not found` / blank Markets | Clear browser site data for `localhost:5173` or open incognito |
| Markets page empty (wallet connected) | Contract addresses in `frontend/.env` are stale — rebuild frontend after deploy |
| `ERR_CONNECTION_REFUSED` to `localhost:3001` | Only in Codespace — `/api` Vite proxy handles this (already wired) |
| `Cannot read properties of undefined (toString)` | Fixed in `useMarkets.ts` — pull latest and rebuild frontend |
| Docker build fails on first run | Run `pnpm install` in `frontend/` and `tests/integration/` first |


### Environment
- **Aztec**: v4.1.3 sandbox on port 8080
- **Vite**: dev server on port 5173, proxies `/rpc` → `localhost:8080`
- **PostgreSQL**: `honkers-postgres` Docker container on port 5432
- **Indexer**: port 3001 (`INDEXER_PORT`). Optional env: `MARKET_FACTORY_ADDRESS`, `AMM_ADDRESS`, `ORACLE_ADDRESS`, `TEST_TOKEN_ADDRESS`, `AZTEC_RPC_URL` (default `http://localhost:8080`)
- **Frontend**: optional `VITE_FEE_RECIPIENT_ADDRESS` for `claim_winnings` (else vault `get_admin()` via simulate)
- **Admin secret**: `0x2153536ff6628eee01cf4024889ff977a18d9fa61d0e414422f7681cf085c281`
- **Admin address**: `0x0a60414ee907527880b7a53d4dacdeb9ef768bb98d9d8d1e7200725c13763331`

---

## Key Architecture Decisions

1. **Two-phase init** — `set_dependencies()` instead of constructor args for circular deps
2. **In-browser PXE** — v4.1.3 moved PXE client-side. Private keys never leave the browser
3. **Vite proxy** — `/rpc` to `localhost:8080` avoids CORS
4. **MinimalWallet** — BaseWallet subclass bridges PXE to Wallet for AccountManager
5. **`aztec codegen`** not `@aztec/builder` — builder was removed in v4.x
6. **Rollup address tracking** — Detects sandbox restarts and auto-clears stale PXE IndexedDB
7. **On-chain fallback** — Markets page reads MarketFactory directly when indexer is offline
8. **Global wallet context** — `WalletProvider` centralizes auth state; `ProtectedRoute` gates pages at the routing level instead of inline guards in each page
9. **Indexer map slots** — `poseidon2([base_slot, market_id])` matches Aztec public map layout; base slots taken from codegen `ContractStorageLayout`
10. **Open market creation** — Bond + schedule checks on-chain; no creator whitelist (see contracts section above)

---

## File Map

| Path | Purpose |
|------|---------|
| `contracts/*/src/main.nr` | Noir contract source (5 contracts) |
| `tests/integration/src/deploy.ts` | Programmatic deploy script |
| `tests/integration/src/create-market.ts` | Market creation script |
| `tests/integration/src/artifacts/` | Generated TypeScript wrappers |
| `frontend/src/contexts/WalletContext.tsx` | **Global wallet state provider + `useWalletContext()` hook** |
| `frontend/src/components/auth/ProtectedRoute.tsx` | **Route-level auth gate for wallet-required pages** |
| `frontend/src/hooks/useAztecWallet.ts` | PXE singleton + rollup detection + stale DB cleanup |
| `frontend/src/hooks/useWallet.ts` | Re-exports `useWalletContext()` for backward compat |
| `frontend/src/hooks/usePXE.ts` | `simulateAndProve`, `simulateView`, `getPrivateNotes` (PXE `debug.getNotes`) |
| `frontend/src/hooks/useTrade.ts` | Deposit + `buy_shares` (AMM-priced) |
| `frontend/src/hooks/usePortfolio.ts` | Vault note slots 8/9/10, `claim_winnings` with fee recipient |
| `frontend/src/hooks/useMarkets.ts` | Indexer + on-chain list/detail/prices; API normalize; `KNOWN_QUESTIONS` for hash→text |
| `frontend/src/utils/aztecSimulate.ts` | `unwrapSimulate`, `fieldLikeToBigInt`, AMM price scale helpers |
| `frontend/src/hooks/useFaucet.ts` | Testnet USDC faucet (calls TestToken.faucet) |
| `frontend/src/utils/MinimalWallet.ts` | BaseWallet bridge for AccountManager |
| `frontend/src/admin/AdminHome.tsx` | Admin stats + market table (whitelist UI removed) |
| `frontend/src/components/wallet/WalletConnect.tsx` | Wallet UI + Reset PXE |
| `frontend/src/components/AztecProvider.tsx` | PXE context provider |
| `frontend/src/pages/Backup.tsx` | Export/import encrypted note backup |
| `frontend/src/config/contractArtifacts.ts` | Contract address → artifact registry |
| `frontend/src/config/aztec.ts` | Config from env vars |
| `frontend/src/App.tsx` | Root routing with WalletProvider + ProtectedRoute |
| `frontend/vite.config.ts` | WASM/polyfill/proxy config |
| `frontend/.env` | Contract addresses + RPC/indexer URLs |
| `indexer/src/db/schema.sql` | Database DDL |
| `indexer/src/indexer/mapSlot.ts` | Poseidon2 map slot derivation |
| `indexer/src/indexer/eventListener.ts` | Poll + index factory/oracle/AMM public state |
| `keeper/src/` | Auto-void bot + health monitoring |
| `aztec-connect/` | Reusable wallet SDK |
| `SETUP.md` | Setup guide (updated for v4.1.3) |
| `AZTEC_WALLET_CONNECT_GUIDE.md` | In-browser PXE guide |
| `scripts/verify-dev-stack.mjs` | `pnpm verify:stack` — Aztec + indexer + `.env` smoke check |
| `scripts/README.md` | Short script index |
