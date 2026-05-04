# Honkers — Handoff Document

Status snapshot for co-contributors picking up the project.
Last updated: 2026-05-04

---

## Current working status

- **Network:** Aztec **testnet** (`https://rpc.testnet.aztec-labs.com`, Sepolia-backed). All 5 contracts freshly deployed 2026-05-04 after testnet reset. Addresses in `.env` and `frontend/.env` are current.
- **Wallet:** **Azguard** Chrome extension wallet (replaces the old in-browser PXE). Users connect via Azguard; all signing and proving happens inside the extension. No WASM proving in the browser.
- **Deployment:** Contracts deploy to testnet via **`aztec-wallet` CLI** (native prover). The TypeScript `deploy.ts` script still exists but only works against a local sandbox with `proverEnabled = false` — it produces invalid proofs on testnet.
- **Create market** — `MarketFactory.create_market` enforces **bond > 0** and **end date in the future**. Whitelist gate removed from source.
- **Faucet** — TestToken mint from the Faucet page works for connected wallets. TestToken is our own deployed contract (no USDC/USDT exists on the Aztec testnet — see Why TestToken below).
- **Explorer:** Contracts visible at `https://testnet.aztecscan.xyz`. "Standard Contract Type: Not available" is cosmetic — our contracts have custom class IDs not in Aztec-Scan's standard registry.

---

## Contract Addresses (Testnet — 2026-05-04)

| Contract | Address |
|----------|---------|
| Admin | `0x1092539b9d20142398c8a8f3e9b0462f1d38cddd587c94b7bc80ff47e6a0b51a` |
| TestToken | `0x0e40029522ceec5c570abfc7b18aa49b5c6292f1a0d26164b7cb157df8bcd66a` |
| AMM | `0x215e27e2f7fa23f68490a4097470664cce3cb5c5873995eaed4c261af578fb48` |
| Oracle | `0x14d5dfe1305071d6fc77de04698d323a7347339a950fe8571f24b4003511f449` |
| PrivateVault | `0x11dd43c8764811ed0b87e36fce7aecb58e465bc10df55cd49e0ae9004c9b2c7c` |
| MarketFactory | `0x0cef835560bbd66a032be62676ee87aeb339ebc67b9d534a75a1612d2bf241e6` |
| SponsoredFPC | `0x254082b62f9108d044b8998f212bb145619d91bfcd049461d74babb840181257` |

Admin secret key: `0x2153536ff6628eee01cf4024889ff977a18d9fa61d0e414422f7681cf085c281`

---

## Why TestToken (Not USDC)?

There is no bridged USDC, USDT, or stablecoin on the Aztec testnet. Aztec Labs' own aztec-starter repo deploys a custom test token, and every project follows the same pattern. When Aztec mainnet launches, the right path is a TokenPortal bridge from Ethereum L1 USDC → Aztec L2, but that infrastructure does not exist on the current testnet. TestToken is correct and expected.

---

## Security Status

A full internal audit has been completed — see [`SECURITY.md`](./SECURITY.md).

**Short version:** The contracts are functional for closed testnet demos. They have critical security gaps (oracle verification missing from `settle_winnings`, AMM/Vault economically disconnected, free dispute bonds) that make them unsuitable for any real-value deployment. The core trading loop is exploitable at every step.

**No real funds should ever be deposited into the current contracts.**

Fix order before any real-value use: C-2 → C-1 → C-7 → C-3 → C-4 → C-5/C-6 (see SECURITY.md for details).

---

## What's Done

### Contracts (Phase 1 — complete)
- **All 5 contracts ported** from Aztec v0.75.0 to v4.2.0 and compile clean
- **MarketFactory — open creation** — `create_market` no longer checks the whitelist map. Any address can create markets subject to positive bond and end date in the future
- **Two-phase initialization** on AMM, Oracle, PrivateVault, MarketFactory to break circular deployment dependency (PublicImmutable → PublicMutable + one-time `set_dependencies()`)
- **TestToken** — custom faucet token (100 tokens/address/day rate limit)
- **Codegen regenerated** via `aztec codegen` — TypeScript wrappers in `tests/integration/src/artifacts/`

### Testnet Deployment (2026-05-04)
- **All 5 contracts deployed to testnet** via `aztec-wallet` CLI with native proving + SponsoredFPC payment
- **Deployment workflow confirmed:**
  1. Copy artifacts to `@`-free path (`/tmp/aztec-artifacts/`) — the CLI's `artifactPathParser` treats `@` as `pkg@contract` workspace syntax
  2. `aztec-wallet register-contract <fpc_address> /tmp/aztec-artifacts/SponsoredFPC.json --alias sponsoredfpc --salt 0`
  3. `aztec-wallet create-account --alias admin --secret-key <key> --payment method=fpc-sponsored,fpc=<fpc>`
  4. `aztec-wallet deploy <artifact.json> --from accounts:admin --payment method=fpc-sponsored,fpc=<fpc> --alias <name> --args <args>`
  5. `aztec-wallet send set_dependencies --from accounts:admin --contract-address contracts:<alias> --contract-artifact <artifact.json> --args <deps>`
- **Artifacts location:** `contracts/target/*.json` (built by `cd contracts && aztec build`)
- **CLI wallet DB:** `~/.aztec/wallet/` (persistent across sessions)

### Wallet — Azguard Extension (current)
- **Replaced in-browser PXE** with Azguard Chrome extension wallet
- `frontend/src/utils/azguardWallet.ts` — `AzguardWallet` class implementing the Aztec Wallet interface via `@azguardwallet/client`
- Strips `fee` from send opts before forwarding to Azguard (Azguard manages fees via its own UI)
- `asWallet(w: AzguardWallet): Wallet` cast for use in WalletContext
- No more WASM proving in browser — Azguard extension handles all proving (~30s per tx)
- `frontend/src/utils/ensureContractRegistered.ts` — registers contracts with Azguard PXE via `wallet.registerContract()` before simulate/send calls; checks `aztecNode.getContract(address)` (on-chain) rather than local PXE store to handle post-testnet-reset states

### Frontend Infrastructure
- **Vite config** — `/rpc` proxy → Aztec testnet RPC, `/api` proxy → indexer
- **Global wallet context** — `WalletContext.tsx` centralizes wallet state
- **Protected routes** — `AdminRoute` gates admin pages
- **ServiceHealthBanner** — uses direct RPC fetch (no embedded PXE dependency)
- **Trade flow** — `useTrade` runs `deposit_collateral` then `buy_shares`. Two transactions, two proof cycles. `ProofProgress` shows (1/2) / (2/2) UI
- **Portfolio** — `usePXE.getPrivateNotes` uses `pxe.debug.getNotes` (PrivateVault slots 8=collateral, 9=shares, 10=winnings)

### Indexer (public state)
- `node_getPublicStorageAt` + Poseidon2 map slots for MarketFactory, Oracle, AMM
- Docker Compose: `honkers-indexer` on port 3001, backed by `honkers-postgres` on port 5432
- Keeper bot in `keeper/` for auto-void and health monitoring

### Docker Compose (current)
- Services: postgres, indexer, keeper, frontend
- All `VITE_*` contract addresses flow from root `.env` into the frontend container
- Indexer and keeper point at testnet RPC (`https://rpc.testnet.aztec-labs.com`)
- Run: `docker compose up -d` (no Aztec sandbox needed — we're on testnet)

---

## Known Bugs

### Fixed (2026-05-04 — Testnet migration session)

- **B10 — `#stripFeePaymentMethod` missing from AzguardWallet**: The method body was absent, causing "Cannot read properties of undefined (reading 'paymentMethod')" crash when Azguard tried to process transaction opts. Fixed by adding the method body to `azguardWallet.ts`.
- **B11 — `AccountManager` wrong import path**: Was imported from `@aztec/aztec.js/account` (doesn't export it). Fixed to `@aztec/aztec.js/wallet`.
- **B12 — `NO_FROM` wrong import**: Was using `AztecAddress.ZERO` for signerless transactions. Fixed to import `NO_FROM` from `@aztec/aztec.js/account`.
- **B13 — `.send().wait()` wrong in 4.2.0**: In Aztec.js 4.2.0, `DeployMethod.send()` already waits by default and returns the mined contract directly. Removed the extra `.wait()` call and fixed result access from `result.contract.address` → `result.address`.
- **B14 — `pxe.getContractInstance` vs `aztecNode.getContract`**: The PXE version checks the local registered store (always finds it after register). The node version checks on-chain. Admin account deploy check now uses `aztecNode.getContract()`.
- **B15 — CLI `register-contract` fails for paths containing `@`**: The `artifactPathParser` treats any path with `@` as `pkg@contract` workspace syntax. pnpm store paths contain `@aztec+...@4.2.0`. Fix: copy artifacts to `/tmp/aztec-artifacts/` before passing to CLI.
- **B16 — `proverEnabled: false` produces invalid proofs on testnet**: TypeScript deploy script with embedded PXE can't submit real proofs to testnet. Resolution: use `aztec-wallet` CLI (defaults to native proving) for all testnet deployments.

### Fixed (2026-04-15 to 2026-04-27 — earlier sessions)

- **B1** — Account contract not deployed (pxe.getContractInstance vs on-chain check)
- **B2** — Markets page toString crash (null-guarded simulate results)
- **B3** — Wallet connect fires multiple times (connectingRef guard)
- **B4** — Indexer public map reads (Poseidon2 slots)
- **B5** — IndexedDB transaction lifetime issue on retry (open)
- **B6** — ERR_CONNECTION_REFUSED to localhost:3001 in Codespace (Vite /api proxy)
- **B7** — simulate() crash on unregistered contracts (pre-registration fix)
- **B8** — fieldLikeToBigInt not applied to simulate tuple fields
- **B9** — create-market.ts used outdated question text

### Open

- **B5** — "Failed to execute 'get' on IDBObjectStore: The transaction has finished" on retry after stale DB nuke — intermittent, needs investigation.
- **B17** — Admin account shows "NOT FOUND" on `node_getContract` RPC — account contracts may be indexed differently than regular contracts. Functional but cosmetically confusing. Needs verification.

---

## What's Left (by priority)

### P0 — Seed a test market on testnet

```bash
cd tests/integration
AZTEC_RPC_URL=https://rpc.testnet.aztec-labs.com npx tsx src/create-market.ts
```

This requires the admin account to be registered in the CLI wallet (already done as of 2026-05-04 session).

### P0 — End-to-end smoke test with Azguard

| Step | Expected |
|------|----------|
| Install Azguard extension | Available on Chrome Web Store |
| Connect wallet on `http://localhost:5173` | Azguard popup → approve |
| Faucet page — mint tokens | Transaction submitted, balance updates |
| Markets page | Markets load from indexer or on-chain fallback |
| Trade page | deposit_collateral + buy_shares (two Azguard prompts) |
| Portfolio page | Notes visible, claim_winnings works |

### P1 — Security fixes (before any real-value use)

See `SECURITY.md` for full details. Priority order:
1. C-2: Add Oracle verification to `settle_winnings`
2. C-1/H-6: Connect `buy_shares` to actual `AMM.swap()` output
3. C-7: Enforce real bond transfer in `dispute_resolution`
4. C-3: Remove caller-supplied `fee_recipient`
5. C-4/C-5/C-6: Auth checks on `refund_void_market`, `initialize_market`, `register_market`

After any contract change: rebuild artifacts (`cd contracts && aztec build`), redeploy to testnet via CLI, update `.env` files.

### P2 — Remaining frontend gaps
- Human-readable market question text (indexer `POST /api/markets/:id/metadata` for arbitrary creator markets)
- Import backup feature (`Backup.tsx` is currently a placeholder)
- Playwright E2E specs need `data-testid` hooks wired in React components

### P3 — Production path
- TokenPortal bridge for real USDC when Aztec mainnet launches
- Multi-sig admin (replace single-key admin — see M-8 in SECURITY.md)
- External security audit before mainnet
- Publish `aztec-connect/` SDK to npm
- Docker Compose E2E with all services including Aztec sandbox

---

## How to Resume Development

### Testnet (current default)

No local Aztec sandbox needed. Contracts are live on testnet.

```bash
# 1. Install dependencies
pnpm install
cd tests/integration && pnpm install && cd ../..
cd frontend && pnpm install && cd ..

# 2. Start infrastructure (postgres + indexer + keeper + frontend)
docker compose up -d

# 3. Open frontend
# http://localhost:5173  (local PC)
# or forwarded port URL (GitHub Codespace)

# 4. Connect Azguard wallet in browser
# 5. Use faucet, trade, etc.
```

### Redeploying Contracts to Testnet (after contract changes)

If you change Noir contract source, rebuild and redeploy:

```bash
# Step 1: Rebuild artifacts
cd contracts && aztec build && cd ..

# Step 2: Copy artifacts to @-free path (required by CLI artifact parser)
mkdir -p /tmp/aztec-artifacts
cp contracts/target/test_token-TestToken.json /tmp/aztec-artifacts/
cp contracts/target/amm-AMM.json /tmp/aztec-artifacts/
cp contracts/target/oracle-Oracle.json /tmp/aztec-artifacts/
cp contracts/target/private_vault-PrivateVault.json /tmp/aztec-artifacts/
cp contracts/target/market_factory-MarketFactory.json /tmp/aztec-artifacts/
cp tests/integration/node_modules/.pnpm/@aztec+noir-contracts.js@4.2.0_typescript@5.7.3/node_modules/@aztec/noir-contracts.js/artifacts/sponsored_fpc_contract-SponsoredFPC.json /tmp/aztec-artifacts/SponsoredFPC.json

# Step 3: Register SponsoredFPC (only needed once per CLI wallet DB)
cd tests/integration
node_modules/.bin/aztec-wallet \
  --node-url https://rpc.testnet.aztec-labs.com \
  register-contract \
  0x254082b62f9108d044b8998f212bb145619d91bfcd049461d74babb840181257 \
  /tmp/aztec-artifacts/SponsoredFPC.json \
  --alias sponsoredfpc --salt 0

# Step 4: Create/deploy admin account (skip if already deployed)
node_modules/.bin/aztec-wallet \
  --node-url https://rpc.testnet.aztec-labs.com \
  create-account \
  --alias admin \
  --secret-key 0x2153536ff6628eee01cf4024889ff977a18d9fa61d0e414422f7681cf085c281 \
  --payment method=fpc-sponsored,fpc=0x254082b62f9108d044b8998f212bb145619d91bfcd049461d74babb840181257

# Step 5: Deploy each contract (example for AMM)
ADMIN=0x1092539b9d20142398c8a8f3e9b0462f1d38cddd587c94b7bc80ff47e6a0b51a
FPC=0x254082b62f9108d044b8998f212bb145619d91bfcd049461d74babb840181257

node_modules/.bin/aztec-wallet \
  --node-url https://rpc.testnet.aztec-labs.com \
  deploy /tmp/aztec-artifacts/AMM.json \
  --from accounts:admin \
  --payment method=fpc-sponsored,fpc=$FPC \
  --alias amm \
  --args $ADMIN

# Step 6: Wire dependencies
node_modules/.bin/aztec-wallet \
  --node-url https://rpc.testnet.aztec-labs.com \
  send set_dependencies \
  --from accounts:admin \
  --payment method=fpc-sponsored,fpc=$FPC \
  --contract-address contracts:amm \
  --contract-artifact /tmp/aztec-artifacts/AMM.json \
  --args <VAULT_ADDRESS> <ORACLE_ADDRESS>

# Step 7: Update .env files with new addresses, then rebuild Docker
docker compose up -d --build
```

**Dependency wiring order:**
1. `AMM.set_dependencies(vault, oracle)`
2. `Oracle.set_dependencies(amm)`
3. `PrivateVault.set_dependencies(token, amm, oracle)`
4. `MarketFactory.set_dependencies(amm, oracle, token)`

### Local Sandbox (development/testing only)

Use `deploy.ts` script against a local sandbox. Note: `proverEnabled = false` in the script — this only works on sandbox, not testnet.

```bash
# Terminal 1
aztec start --sandbox

# Terminal 2
cd tests/integration
AZTEC_RPC_URL=http://localhost:8080 npx tsx src/deploy.ts
npx tsx src/create-market.ts
```

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| Azguard shows "contract instance not found" | Contracts not registered with Azguard PXE. `ensureContractRegistered.ts` runs automatically — verify contract addresses in `.env` are current |
| CLI `register-contract` fails with "nargo workspace" error | Path contains `@`. Copy artifact to `/tmp/aztec-artifacts/` first |
| `Invalid tx: Invalid proof` | Using TypeScript deploy script against testnet. Use `aztec-wallet` CLI instead |
| "Account not found in wallet" | Admin account not in CLI wallet DB. Run `create-account` step |
| Docker frontend env missing addresses | Run `docker compose up -d --build` after updating `.env` |
| Markets page empty | Indexer may not have the new contract addresses. Update `MARKET_FACTORY_ADDRESS` etc. in Docker env and restart |
| aztecscan.xyz shows "Standard Contract Type: Not available" | Cosmetic. Our custom contracts don't match Aztec-Scan's standard class registry. No action needed |

---

## Key Architecture Decisions

1. **Azguard wallet** — replaces in-browser PXE. All proving happens in the extension (~30s/tx). Eliminates the 66-minute WASM proving issue. `AzguardWallet` in `frontend/src/utils/azguardWallet.ts` implements the Aztec Wallet interface via `@azguardwallet/client`.
2. **CLI-based testnet deployment** — `aztec-wallet` CLI defaults to native proving. TypeScript `deploy.ts` with `proverEnabled = false` only works on local sandbox.
3. **TestToken is our own contract** — No official stablecoin exists on the Aztec testnet. Every Aztec project deploys its own test token.
4. **Artifact path `@` gotcha** — The CLI's `artifactPathParser` treats any path containing `@` as `pkg@contract` workspace syntax. pnpm store paths include `@aztec+...@4.2.0`. Always copy artifacts to an `@`-free location (e.g. `/tmp/aztec-artifacts/`) before passing to CLI commands.
5. **SponsoredFPC** — Fee payment contract pre-deployed on testnet at `0x254082b62...`. Register it once in the CLI wallet DB. All deployments and sends use `--payment method=fpc-sponsored,fpc=<address>`.
6. **`aztecNode.getContract()` vs `pxe.getContractInstance()`** — Node checks on-chain (authoritative after testnet reset). PXE checks local registered store (always returns after `registerContract()`). Use node for deployment checks; use PXE for simulation readiness.
7. **Two-phase init** — `set_dependencies()` instead of constructor args to break circular deployment dependency (AMM needs Vault, Vault needs AMM).
8. **Vite dual proxy** — `/rpc` for Aztec RPC (CORS + Codespace), `/api` for indexer REST API. Both configurable via env vars.
9. **Indexer map slots** — `poseidon2([base_slot, market_id])` matches Aztec public map layout; base slots from codegen `ContractStorageLayout`.
10. **Open market creation** — Bond + schedule checks on-chain; no creator whitelist (whitelist storage remains for ABI compatibility but is dead code — see SECURITY.md H-5).

---

## File Map

| Path | Purpose |
|------|---------|
| `contracts/*/src/main.nr` | Noir contract source (5 contracts) |
| `contracts/target/*.json` | Compiled contract artifacts |
| `tests/integration/src/deploy.ts` | Programmatic deploy script (sandbox only) |
| `tests/integration/src/create-market.ts` | Market creation script |
| `tests/integration/src/artifacts/` | Generated TypeScript wrappers |
| `frontend/src/utils/azguardWallet.ts` | **Azguard extension wallet adapter** |
| `frontend/src/utils/ensureContractRegistered.ts` | **Pre-registers contracts with wallet PXE before simulate/send** |
| `frontend/src/contexts/WalletContext.tsx` | Global wallet state provider |
| `frontend/src/hooks/useAztecWallet.ts` | Wallet connection + stale state cleanup |
| `frontend/src/hooks/usePXE.ts` | simulateAndProve, simulateView, getPrivateNotes |
| `frontend/src/hooks/useTrade.ts` | deposit_collateral + buy_shares (two-tx flow) |
| `frontend/src/hooks/useMarkets.ts` | Indexer + on-chain market list/detail/prices |
| `frontend/src/utils/MinimalWallet.ts` | BaseWallet bridge for AccountManager (sandbox only) |
| `frontend/src/utils/feePolicy.ts` | Sponsored FPC then fee-juice fallback |
| `frontend/src/utils/browserSecretVault.ts` | AES-GCM encrypted wallet secret storage |
| `frontend/src/config/aztec.ts` | Config from env vars |
| `frontend/.env` | Contract addresses + RPC/indexer URLs |
| `indexer/src/indexer/mapSlot.ts` | Poseidon2 map slot derivation |
| `indexer/src/indexer/eventListener.ts` | Poll + index factory/oracle/AMM public state |
| `keeper/src/` | Auto-void bot + health monitoring |
| `aztec-connect/` | Reusable wallet SDK |
| `SECURITY.md` | **Full smart contract security audit** |
| `SETUP.md` | Setup guide |
| `scripts/preflight-testnet.mjs` | `pnpm verify:testnet` smoke check |
| `docker-compose.yml` | All services (postgres, indexer, keeper, frontend) |
| `.env` | Root env (indexer/keeper contract addresses) |
