# Honkers — Handoff Document

Status snapshot for co-contributors picking up the project.
Last updated: 2026-04-14

---

## What's Done

### Contracts (Phase 1 — complete)
- **All 5 contracts ported** from Aztec v0.75.0 to v4.1.3 and compile clean
- **Two-phase initialization** on AMM, Oracle, PrivateVault, MarketFactory to break circular deployment dependency (PublicImmutable changed to PublicMutable + one-time `set_dependencies()`)
- **TestToken** unchanged (no circular deps)
- **Codegen regenerated** via `aztec codegen` — TypeScript wrappers in `tests/integration/src/artifacts/`
- **Deploy script** at `tests/integration/src/deploy.ts` — deploys all 5 contracts + wires dependencies + writes `.env` files

### Frontend Infrastructure
- **In-browser PXE** via `@aztec/pxe/client/bundle` (WASM + IndexedDB `pxe/aztec-pxe-honkers`)
- **MinimalWallet** bridge (`BaseWallet` subclass) for `AccountManager`
- **Vite config** — WASM exclusions, CJS includes, node shims, COOP/COEP headers, `/rpc` proxy
- **Wallet connect flow** — `useWallet` hook with Schnorr account creation via `AccountManager`
- **Auto-reconnect** — `useWallet` re-registers the account with MinimalWallet on page reload when PXE is ready + stored credentials exist (no longer just restores address string)
- **Sandbox restart detection** — `useAztecWallet` tracks the L1 rollup address; automatically nukes stale IndexedDB + clears wallet credentials when the sandbox rolls to a new rollup address
- **Reset PXE button** — enumerates all IndexedDB databases matching `aztec` or `pxe` and deletes them all
- **Export backup** — dumps all Aztec/PXE IndexedDB databases + `honkers:*` localStorage keys to a JSON download
- **On-chain market fallback** — `useMarkets` tries the indexer API first; on failure falls back to reading `MarketFactory.get_next_market_id()` + `get_market_info(id)` directly via simulate calls
- **usePXE bug fixed** — was reading wallet from wrong context property

### Market Creation Script
- `tests/integration/src/create-market.ts` — standalone Node.js script
- Uses server-side PXE (`@aztec/pxe/server`) with `AdminWallet`
- Whitelists admin → hashes question/criteria/source (SHA-256, truncated to 31 bytes for field) → `MarketFactory.create_market()` → `Oracle.register_market()`
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

## Known Bugs (Open)

### B1 — Faucet fails: "Assertion failed: Failed to get a note 'self.is_some()'"
- **Root cause**: The user's Schnorr account contract is **registered in PXE but not deployed on-chain**. In Aztec v4, all `.send()` transactions — even for `#[external("public")]` functions like `faucet` — route through the account contract's entrypoint. The entrypoint tries to read its signing-key note, which doesn't exist if the contract isn't deployed.
- **Why deployment doesn't happen**: `useWallet.ts` has deployment logic (`hasInitializer()` → `getDeployMethod()` → `send().wait()`), but the console logs show no "Deploying account contract..." message. The `hasInitializer()` check or `getContractInstance()` lookup may be incorrectly skipping deployment. Additionally, after a sandbox restart + DB nuke, the wallet generates a new random secret (old one cleared), so the account contract address changes and is definitely undeployed.
- **Where to fix**: `frontend/src/hooks/useWallet.ts` lines 96-106 — the account deployment block. Investigate whether `hasInitializer()` returns `false` for `SchnorrAccountContract` or whether `getContractInstance()` is returning a stale result.
- **Second error on retry**: "Failed to execute 'get' on 'IDBObjectStore': The transaction has finished" — This is an IndexedDB transaction lifetime issue in the PXE's kv-store. May be related to the stale DB nuke running during PXE init; the store reference becomes invalid. Needs investigation.

### B2 — Markets page: "Cannot read properties of undefined (reading 'toString')"
- **Root cause**: The on-chain fallback in `useMarkets.ts` calls `Contract.at(factoryAddr, artifact, wallet)` then `contract.methods.get_market_info(id).simulate()`. The returned tuple destructures `creator` and calls `.toString()` on it. If the MarketFactory contract address in `.env` is stale (from a previous sandbox session), the simulate call returns `undefined` results.
- **When it happens**: After any sandbox restart, the contract addresses in `frontend/.env` no longer exist on-chain. The `.env` must be refreshed by rerunning `npx tsx src/deploy.ts`.
- **Where to fix**: `frontend/src/hooks/useMarkets.ts` `fetchFromChain()` — needs null-guarding on the simulate result. Also the deploy script should be re-run after every sandbox restart.

### B3 — Wallet `connect()` fires multiple times
- Console shows `[useWallet] Registering account ...` and `Connected:` logged 2-3 times per page load. This is React StrictMode double-invoking effects. Harmless but noisy — could add a guard ref to deduplicate.

### B4 — Indexer not running
- All indexer fetches fail with `ERR_CONNECTION_REFUSED` to `localhost:3001`. The indexer requires PostgreSQL (`honkers-postgres` Docker container) and has never been started in this dev session. The on-chain fallback was added to compensate, but the indexer is needed for market detail, price history, and full-text search.

---

## What's Left (by priority)

### P0 — Fix account contract deployment (blocks all transactions)
- Debug why `useWallet.ts` skips account contract deployment (see B1 above)
- The Schnorr account contract must be deployed on-chain before any `.send()` call works
- After fixing, re-test: faucet mint, market creation from frontend, trade placement
- **Owner**: Anyone working on the frontend

### P0 — Redeploy contracts after sandbox restart
- Sandbox state is ephemeral — every restart requires `cd tests/integration && npx tsx src/deploy.ts`
- This updates `frontend/.env` with fresh contract addresses
- Then re-create the test market: `npx tsx src/create-market.ts`
- **Owner**: Anyone starting a dev session

### P1 — Start indexer service
- `cd indexer && pnpm dev` (requires `docker start honkers-postgres` first)
- Verify `/api/markets` returns data
- The on-chain fallback works for basic market listing but doesn't support detail views, price history, or search
- **Owner**: Backend developer

### P1 — Wire remaining frontend flows
- **Trade flow**: `useTrade` hook → AMM contract calls (`buy_outcome` / `sell_outcome`)
- **Portfolio view**: Currently returns `[]` — needs contract view function calls for user positions
- **Market detail page**: `useMarketDetail` only reads from indexer — needs on-chain fallback or indexer
- **Owner**: Frontend developer

### P2 — Integration hardening
- Uncomment stubs in `tests/integration/`
- Start keeper: `cd keeper && pnpm dev`
- E2E tests with Playwright (`tests/e2e/`)
- **Owner**: QA / full-stack

### P3 — Polish
- Docker Compose end to end (sandbox + postgres + indexer + keeper + frontend)
- Error handling for edge cases (insufficient balance, market closed, etc.)
- Import backup feature (Backup.tsx — currently placeholder)
- Publish aztec-connect SDK to npm
- **Owner**: DevOps / full-stack

---

## How to Resume Development

```bash
# 1. Start sandbox (if not running)
aztec start --sandbox

# 2. Start Postgres (if not running)
docker start honkers-postgres

# 3. Deploy contracts (REQUIRED after every sandbox restart)
cd tests/integration && npx tsx src/deploy.ts && cd ../..

# 4. Create test market
cd tests/integration && npx tsx src/create-market.ts && cd ../..

# 5. Run DB migration (if using indexer)
cd indexer && DATABASE_URL="postgresql://honkers:honkers@localhost:5432/honkers" npx tsx src/db/migrate.ts && cd ..

# 6. Start frontend
cd frontend && pnpm dev

# 7. If you see "block hash not found" errors after sandbox restart:
#    - The rollup detection should auto-clear stale data on page reload
#    - If it doesn't, click the "Reset PXE" button in the wallet UI
#    - Or run in browser console: indexedDB.deleteDatabase("pxe/aztec-pxe-honkers")
```

### Environment
- **Aztec**: v4.1.3 sandbox on port 8080
- **Vite**: dev server on port 5173, proxies `/rpc` → `localhost:8080`
- **PostgreSQL**: `honkers-postgres` Docker container on port 5432
- **Indexer**: port 3001 (not currently running)
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

---

## File Map

| Path | Purpose |
|------|---------|
| `contracts/*/src/main.nr` | Noir contract source (5 contracts) |
| `tests/integration/src/deploy.ts` | Programmatic deploy script |
| `tests/integration/src/create-market.ts` | Market creation script |
| `tests/integration/src/artifacts/` | Generated TypeScript wrappers |
| `frontend/src/hooks/useAztecWallet.ts` | PXE singleton + rollup detection + stale DB cleanup |
| `frontend/src/hooks/useWallet.ts` | Schnorr account connect/disconnect + auto-reconnect |
| `frontend/src/hooks/usePXE.ts` | Contract interaction (`simulateAndProve`) |
| `frontend/src/hooks/useMarkets.ts` | Market fetching with on-chain fallback |
| `frontend/src/hooks/useFaucet.ts` | Testnet USDC faucet (calls TestToken.faucet) |
| `frontend/src/utils/MinimalWallet.ts` | BaseWallet bridge for AccountManager |
| `frontend/src/components/wallet/WalletConnect.tsx` | Wallet UI + Reset PXE |
| `frontend/src/components/AztecProvider.tsx` | PXE context provider |
| `frontend/src/pages/Backup.tsx` | Export/import encrypted note backup |
| `frontend/src/config/contractArtifacts.ts` | Contract address → artifact registry |
| `frontend/src/config/aztec.ts` | Config from env vars |
| `frontend/vite.config.ts` | WASM/polyfill/proxy config |
| `frontend/.env` | Contract addresses + RPC/indexer URLs |
| `indexer/src/db/schema.sql` | Database DDL |
| `keeper/src/` | Auto-void bot + health monitoring |
| `aztec-connect/` | Reusable wallet SDK |
| `SETUP.md` | Setup guide (updated for v4.1.3) |
| `AZTEC_WALLET_CONNECT_GUIDE.md` | In-browser PXE guide |
