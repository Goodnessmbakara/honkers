# Honkers — Handoff Document

Status snapshot for co-contributors picking up the project.

---

## What's Done

### Contracts (Phase 1 — complete)
- **All 5 contracts ported** from Aztec v0.75.0 to v4.1.3 and compile clean
- **Two-phase initialization** on AMM, Oracle, PrivateVault, MarketFactory to break circular deployment dependency (PublicImmutable changed to PublicMutable + one-time set_dependencies())
- **TestToken** unchanged (no circular deps)
- **Codegen regenerated** via aztec codegen — TypeScript wrappers in tests/integration/src/artifacts/
- **Deploy script** at tests/integration/src/deploy.ts — deploys all 5 contracts + wires dependencies + writes .env files

### Frontend Infrastructure
- **In-browser PXE** via @aztec/pxe/client/bundle (WASM + IndexedDB)
- **MinimalWallet** bridge (BaseWallet subclass) for AccountManager
- **Vite config** — WASM exclusions, CJS includes, node shims, COOP/COEP headers, /rpc proxy
- **Wallet connect flow** — useWallet hook with Schnorr account creation via AccountManager
- **Reset PXE button** — clears stale IndexedDB after sandbox restarts
- **usePXE bug fixed** — was reading wallet from wrong context property

### Deployment
- Contracts deploy successfully to sandbox via npx tsx src/deploy.ts
- .env files auto-generated for both root and frontend/
- Database schema migration works (indexer/src/db/migrate.ts)

### Documentation
- SETUP.md updated for v4.1.3 (deploy instructions, env vars, troubleshooting, changelog)
- AZTEC_WALLET_CONNECT_GUIDE.md — comprehensive guide for in-browser PXE + wallet

### Reusable SDK (aztec-connect/)
- Standalone package at root with three entry points:
  - Core: getOrCreatePXE(), connectAccount(), MinimalWallet
  - React: AztecConnectProvider, useAccount(), useAztecConnect()
  - Vite: aztecVitePlugin() — one-line Vite config for Aztec
- TypeScript compiles clean

---

## What's Left (by priority)

### P0 — Blocks demo
- Frontend smoke test — Open localhost:5173, connect wallet, try faucet
- Fix any runtime errors — WASM loading, env vars, proxy issues

### P1 — Required for functional demo
- Start indexer service — cd indexer && pnpm dev (requires Postgres)
- Wire frontend contract calls — Verify useTrade, useMarkets hooks
- Whitelist a market creator — Call market_factory.add_to_whitelist(address)
- Create a test market — Via MarketFactory
- Faucet UX — Test mint flow end to end

### P2 — Integration hardening
- Integration tests — Uncomment stubs in tests/integration/
- Start keeper — cd keeper && pnpm dev
- Portfolio view — Currently returns [] — needs contract view function calls
- E2E tests — tests/e2e/ with Playwright

### P3 — Polish
- Docker Compose end to end
- Error handling / edge cases
- Publish aztec-connect SDK

---

## How to Resume Development

```bash
# 1. Start sandbox
aztec start --local-network

# 2. Start Postgres
docker start honkers-postgres

# 3. Deploy contracts (sandbox state is ephemeral)
cd tests/integration && npx tsx src/deploy.ts && cd ../..

# 4. Run DB migration
cd indexer && DATABASE_URL="postgresql://honkers:honkers@localhost:5432/honkers" npx tsx src/db/migrate.ts && cd ..

# 5. Start frontend
cd frontend && pnpm dev

# 6. Clear browser PXE if you see "block hash not found" errors
# Browser console: indexedDB.deleteDatabase("aztec-pxe-honkers")
# Or use the Reset PXE button in the wallet connect area
```

---

## Key Architecture Decisions

1. **Two-phase init** — set_dependencies() instead of constructor args for circular deps
2. **In-browser PXE** — v4.1.3 moved PXE client-side. Private keys never leave the browser
3. **Vite proxy** — /rpc to localhost:8080 avoids CORS
4. **MinimalWallet** — BaseWallet subclass bridges PXE to Wallet for AccountManager
5. **aztec codegen** not @aztec/builder — builder was removed in v4.x

---

## File Map

- contracts/*/src/main.nr — Noir contract source (5 contracts)
- tests/integration/src/deploy.ts — Programmatic deploy script
- tests/integration/src/artifacts/ — Generated TypeScript wrappers
- frontend/src/hooks/useAztecWallet.ts — PXE singleton + MinimalWallet
- frontend/src/hooks/useWallet.ts — Schnorr account connect/disconnect
- frontend/src/hooks/usePXE.ts — Contract interaction (simulateAndProve)
- frontend/src/components/wallet/WalletConnect.tsx — Wallet UI + Reset PXE
- frontend/src/components/AztecProvider.tsx — PXE context provider
- frontend/vite.config.ts — WASM/polyfill/proxy config
- indexer/src/db/schema.sql — Database DDL
- keeper/src/ — Auto-void bot + health monitoring
- aztec-connect/ — Reusable wallet SDK
- SETUP.md — Setup guide (updated for v4.1.3)
- AZTEC_WALLET_CONNECT_GUIDE.md — In-browser PXE guide
