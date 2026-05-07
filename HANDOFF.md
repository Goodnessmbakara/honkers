# Honkers — Handoff Document

Status snapshot for co-contributors picking up the project.
Last updated: 2026-05-05

---

## Current working status

- **Network:** Aztec **testnet** (`https://rpc.testnet.aztec-labs.com`, Sepolia-backed). All 5 contracts deployed 2026-05-04 after testnet reset. Addresses in `.env` and `frontend/.env` are current.
- **Wallet:** **Azguard** Chrome extension wallet (replaces old in-browser PXE). Users connect via Azguard; all signing and proving happens inside the extension. No WASM proving in the browser. Session persists across page refreshes automatically.
- **Markets page:** Loads all markets without a connected wallet — reads public storage maps directly from the Aztec node via `node_getPublicStorageAt`. No indexer, no wallet required.
- **Market question text:** Readable from chain via `node_getPublicLogs`. `MarketFactory.create_market` now emits a `MarketCreated` public log with question/criteria/source packed as Fields. New markets show full text immediately. Markets #1 and #2 predate this and show "Market #1/2".
- **Deployment:** Contracts deploy to testnet via **`aztec-wallet` CLI** (native prover). The TypeScript `deploy.ts` script only works against a local sandbox with `proverEnabled = false` — it produces invalid proofs on testnet.
- **Create market** — `MarketFactory.create_market` enforces **bond > 0** and **end date in the future**. Whitelist gate removed from source.
- **Faucet** — TestToken mint from the Faucet page works for connected wallets.
- **Explorer:** Contracts visible at `https://testnet.aztecscan.xyz`. "Standard Contract Type: Not available" is cosmetic.
- **Indexer removed** — The Express+Postgres indexer service has been deleted entirely. All data comes from chain reads.

---

## Contract Addresses (Testnet — current)

| Contract | Address |
|----------|---------|
| Admin | `0x1092539b9d20142398c8a8f3e9b0462f1d38cddd587c94b7bc80ff47e6a0b51a` |
| USDh (TestToken) | `0x14913c13aa09a37f18290ffe69a6c9b6a49cebd7e94b909f6c38a8324d2d11c3` |
|  AMM v2 | `0x21433bf88a25713b60d566d37050bb4777ddb3668b1126e4f7518c9513dddbd5` |
| Oracle | `0x14d5dfe1305071d6fc77de04698d323a7347339a950fe8571f24b4003511f449` |
| PrivateVault | `0x11dd43c8764811ed0b87e36fce7aecb58e465bc10df55cd49e0ae9004c9b2c7c` |
| MarketFactory | `0x1e1955a2e2d17c70c53313768052238704ffa04f23bbc7b9bac96ecdcc30334e` |
| SponsoredFPC | `0x254082b62f9108d044b8998f212bb145619d91bfcd049461d74babb840181257` |

Admin secret key: `0x2153536ff6628eee01cf4024889ff977a18d9fa61d0e414422f7681cf085c281`

---

## Why USDh (Not USDC)?

There is no bridged USDC, USDT, or any stablecoin on the Aztec testnet — confirmed via Aztec docs, GitHub, and Circle's official deployment list (Aztec is simply not listed). Aztec Labs' own tutorials instruct every project to deploy its own test token. When Aztec mainnet launches, the right path is a TokenPortal bridge from Ethereum L1 USDC → Aztec L2, but that infrastructure doesn't exist on the current testnet.

**USDh (USD Honkers)** is our custom testnet stablecoin:
- Symbol: `USDh`, decimals: 6
- Open faucet: anyone can mint up to **10,000 USDh per hour** by calling `faucet(amount)`
- No KYC, no bridge, no waiting — just call the faucet from the Faucet page

---

## Security Status

A full internal audit has been completed — see [`SECURITY.md`](./SECURITY.md).

**Short version:** The contracts are functional for closed testnet demos. They have critical security gaps (oracle verification missing from `settle_winnings`, AMM/Vault economically disconnected, free dispute bonds) that make them unsuitable for any real-value deployment. The core trading loop is exploitable at every step.

**No real funds should ever be deposited into the current contracts.**

Fix order before any real-value use: C-2 → C-1 → C-7 → C-3 → C-4 → C-5/C-6 → A-1 (see SECURITY.md for details).

---

## What's Done

### Contracts (Phase 1 — complete)
- **All 5 contracts ported** from Aztec v0.75.0 to v4.2.0 and compile clean
- **MarketFactory — open creation** — `create_market` no longer checks the whitelist map. Any address can create markets subject to positive bond and end date in the future
- **Two-phase initialization** on AMM, Oracle, PrivateVault, MarketFactory to break circular deployment dependency
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
- No more WASM proving in browser — Azguard extension handles all proving (~30s per tx)
- `frontend/src/utils/ensureContractRegistered.ts` — registers contracts with Azguard PXE before simulate/send

### Wallet Persistence — Auto-reconnect (2026-05-05)
- `WalletContext.tsx` saves wallet type (`"azguard"`, `"embedded"`, or `"sdk:<name>"`) to localStorage on connect. A `useEffect` on mount silently reconnects.
- Keys: `honkers:wallet-address`, `honkers:wallet-type`

### Markets Page — Wallet-Free Public Storage Reads (2026-05-05)
- `useMarkets.ts` reads public storage maps directly from the Aztec node — no wallet, no indexer, works for all visitors
- **Critical slot derivation:** uses `poseidon2HashWithSeparator([base_slot, key], 4015149901)` via `deriveStorageSlotInMap` from `@aztec/stdlib/hash`

### Indexer Removed (2026-05-05)
- The Express+Postgres indexer (`indexer/` directory) has been **deleted entirely**
- `docker-compose.yml` now has only `keeper` + `frontend` services — no postgres, no indexer
- `frontend/.env` — removed `VITE_INDEXER_API_URL`
- `frontend/src/pages/CreateMarket.tsx` — removed indexer metadata POST and all localStorage fallbacks
- `frontend/src/hooks/useMarkets.ts` — removed `SEED_META`, `LOCAL_META_KEY`, `fetchMetadataBatch`, all indexer enrichment
- **Keeper** — removed all `pg`/postgres dependencies. Keeper now reads markets from chain directly via `keeper/src/utils/chainReader.ts`
- Question text is not available for markets created before public log emission is added (see **What's Left → P0**)

### UI — Floating Pill Navbar (2026-05-05)
- `NavPrimary.tsx` — navbar is now `position: fixed`, floats 16px from top, centered with 24px side gutters, `borderRadius: 999` (full pill), frosted glass background (`backdrop-filter: blur(16px)`)
- `WalletConnect.tsx` — "Connect wallet" button is pill-shaped (`borderRadius: 999`)
- `AppShell.tsx` — `paddingTop: 84` on `<main>` so content clears the floating navbar

### Frontend Infrastructure
- **Vite config** — `/rpc` proxy → Aztec testnet RPC (no `/api` proxy — indexer gone)
- **Global wallet context** — `WalletContext.tsx` centralizes wallet state
- **Trade flow** — `useTrade` runs `deposit_collateral` then `buy_shares`. Two transactions, two proof cycles
- **Portfolio** — `usePXE.getPrivateNotes` uses `pxe.debug.getNotes`

### Docker Compose (current)
- Services: **keeper, frontend only** (postgres and indexer removed)
- All `VITE_*` contract addresses flow from root `.env` into the frontend container
- Run: `docker compose up -d` (no Aztec sandbox needed — we're on testnet)
- **Frontend changes require a rebuild:** `docker compose up -d --build frontend`
- For local development skip Docker entirely: `cd frontend && pnpm dev`

---

## Known Bugs

### Fixed (2026-05-05 — current session)

- **B21 — Market question text not showing for Market #2**: `useMarkets.ts` had `SEED_META` hardcoded for market #1 only. Root cause: contracts never emit plaintext — only store SHA-256 hashes. Fix path: add `emit_public_log` to `create_market` and redeploy. Interim: markets show "Market #N" fallback until redeployment.
- **B18 — Markets page shows "No markets found" for all visitors**: `useMarkets` required a connected wallet and used wrong slot derivation. Fixed by rewriting to use `node_getPublicStorageAt` with `deriveStorageSlotInMap`.
- **B19 — Wrong poseidon2 function for map slot derivation**: Both `useMarkets.ts` and indexer used plain `poseidon2Hash`. Aztec's Map uses `poseidon2HashWithSeparator([base, key], 4015149901)`. Fixed.
- **B20 — Wallet disconnects on every page refresh**: Fixed by storing wallet type and adding auto-reconnect `useEffect` on mount.

### Fixed (2026-05-04 — Testnet migration session)

- **B10** — `#stripFeePaymentMethod` missing from AzguardWallet
- **B11** — `AccountManager` wrong import path
- **B12** — `NO_FROM` wrong import
- **B13** — `.send().wait()` wrong in 4.2.0
- **B14** — `pxe.getContractInstance` vs `aztecNode.getContract`
- **B15** — CLI `register-contract` fails for paths containing `@`
- **B16** — `proverEnabled: false` produces invalid proofs on testnet

### Open

- **B5** — "Failed to execute 'get' on IDBObjectStore: The transaction has finished" on retry after stale DB nuke — intermittent.
- **B17** — Admin account shows "NOT FOUND" on `node_getContract` RPC — cosmetic.
- **B22** — Markets #1 and #2 show "Market #1" / "Market #2" — expected, they were created before the contract emitted public logs. All markets created after 2026-05-06 show full question text from chain.

---

## What's Left (by priority)

### P0 — ✅ DONE: MarketFactory emits public logs + redeployed (2026-05-06)

`MarketFactory.create_market` now accepts 7 extra Field params (question/criteria/source packed as 31-byte chunks) and emits a `MarketCreated` public log. The frontend reads it via `node_getPublicLogs`.

New address: `0x0fdce9f2c23d2658c0122dc85f91cff627215b769a31d9886fb2884f9c543b65`

**Build process for future contract changes (no `aztec` CLI needed):**
```bash
# 1. Compile with nargo
cd contracts && /Users/abba/.nargo/bin/nargo compile --package market_factory

# 2. AVM transpilation (must use bb matching the nargo/aztec version — v4.1.3)
BB=tests/integration/node_modules/.pnpm/@aztec+bb.js@4.1.3/node_modules/@aztec/bb.js/build/arm64-macos/bb
$BB aztec_process -i contracts/target/market_factory-MarketFactory.json

# 3. Strip internal prefix
python3 -c "
import json
path='contracts/target/market_factory-MarketFactory.json'
d=json.load(open(path))
for fn in d['functions']:
    fn['name'] = fn['name'].replace('__aztec_nr_internals__', '')
json.dump(d, open(path,'w'), indent=2)
"

# 4. Copy to @-free path and deploy
cp contracts/target/market_factory-MarketFactory.json /tmp/aztec-artifacts/MarketFactory.json
aztec-wallet deploy /tmp/aztec-artifacts/MarketFactory.json --from accounts:admin ...
```

Note: markets #1 and #2 predate the log emission — they still show "Market #1/2".

### P0 — End-to-end smoke test with Azguard

| Step | Expected |
|------|----------|
| Open `http://localhost:5173` | Markets page loads — no wallet needed |
| Connect wallet | Azguard popup → approve → stays connected across refreshes |
| Faucet page — mint tokens | Transaction submitted, balance updates |
| Trade page | deposit_collateral + buy_shares (two Azguard prompts) |
| Create market | Market appears with question text (after redeployment) |
| Refresh page | Wallet auto-reconnects without prompting |

### P1 — Security fixes (before any real-value use)

See `SECURITY.md` for full details. Priority order:
1. C-2: Add Oracle verification to `settle_winnings`
2. C-1/H-6: Connect `buy_shares` to actual `AMM.swap()` output
3. C-7: Enforce real bond transfer in `dispute_resolution`
4. C-3: Remove caller-supplied `fee_recipient`
5. C-4/C-5/C-6: Auth checks on `refund_void_market`, `initialize_market`, `register_market`

After any contract change: rebuild artifacts, redeploy to testnet, update `.env` files.

### P2 — Remaining frontend gaps
- Import backup feature (`Backup.tsx` is currently a placeholder)
- Playwright E2E specs need `data-testid` hooks wired in React components

### P3 — Production path
- TokenPortal bridge for real USDC when Aztec mainnet launches
- Multi-sig admin (replace single-key admin — see M-8 in SECURITY.md)
- External security audit before mainnet
- Publish `aztec-connect/` SDK to npm

---

## How to Resume Development

### Testnet (current default)

```bash
# 1. Install dependencies
pnpm install
cd tests/integration && pnpm install && cd ../..
cd frontend && pnpm install && cd ..

# 2. Option A — local dev (recommended, HMR, no rebuild needed)
cd frontend && pnpm dev

# 2. Option B — full Docker stack (keeper + frontend only)
docker compose up -d
# frontend changes require: docker compose up -d --build frontend

# 3. Open http://localhost:5173
# 4. Connect Azguard wallet
```

### Redeploying Contracts to Testnet (after contract changes)

```bash
# Step 1: Rebuild artifacts
cd contracts && aztec build && cd ..

# Step 2: Copy artifacts to @-free path (required by CLI artifact parser)
mkdir -p /tmp/aztec-artifacts
cp contracts/target/market_factory-MarketFactory.json /tmp/aztec-artifacts/
# ... copy other artifacts as needed

# Step 3: Deploy via aztec-wallet CLI
ADMIN=0x1092539b9d20142398c8a8f3e9b0462f1d38cddd587c94b7bc80ff47e6a0b51a
FPC=0x254082b62f9108d044b8998f212bb145619d91bfcd049461d74babb840181257

cd tests/integration
node_modules/.bin/aztec-wallet \
  --node-url https://rpc.testnet.aztec-labs.com \
  deploy /tmp/aztec-artifacts/MarketFactory.json \
  --from accounts:admin \
  --payment method=fpc-sponsored,fpc=$FPC \
  --alias market_factory \
  --args $ADMIN

# Step 4: Wire dependencies
node_modules/.bin/aztec-wallet \
  --node-url https://rpc.testnet.aztec-labs.com \
  send set_dependencies \
  --from accounts:admin \
  --payment method=fpc-sponsored,fpc=$FPC \
  --contract-address contracts:market_factory \
  --contract-artifact /tmp/aztec-artifacts/MarketFactory.json \
  --args <AMM_ADDRESS> <ORACLE_ADDRESS> <TOKEN_ADDRESS>

# Step 5: Update .env + frontend/.env with new address, rebuild Docker
docker compose up -d --build frontend
```

**Dependency wiring order:**
1. `AMM.set_dependencies(vault, oracle)`
2. `Oracle.set_dependencies(amm)`
3. `PrivateVault.set_dependencies(token, amm, oracle)`
4. `MarketFactory.set_dependencies(amm, oracle, token)`

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| Markets page shows "No markets found" | Check `VITE_MARKET_FACTORY_ADDRESS` in `frontend/.env`. Verify slot 6 (`next_market_id`) is > 1 via `node_getPublicStorageAt` |
| Markets show "Market #N" with no question text | MarketFactory doesn't emit public logs yet — see P0 above |
| Wallet doesn't auto-reconnect on refresh | Check `honkers:wallet-type` in localStorage |
| Azguard shows "contract instance not found" | `ensureContractRegistered.ts` runs automatically — verify contract addresses in `.env` are current |
| CLI `register-contract` fails with "nargo workspace" error | Path contains `@`. Copy artifact to `/tmp/aztec-artifacts/` first |
| `Invalid tx: Invalid proof` | Using TypeScript deploy script against testnet. Use `aztec-wallet` CLI instead |
| Docker frontend env missing addresses | Run `docker compose up -d --build frontend` after updating `.env` |

---

## Key Architecture Decisions

1. **Azguard wallet + auto-reconnect** — Replaces in-browser PXE. All proving in extension (~30s/tx). Session persists via localStorage. `AzguardWallet` in `frontend/src/utils/azguardWallet.ts`.
2. **No indexer — chain-only reads** — All market data (list, prices, resolution state) comes from direct RPC calls to the Aztec node. `useMarkets.ts` uses `node_getPublicStorageAt`. The old Express+Postgres indexer has been deleted.
3. **Question text via public logs** — Plaintext question/criteria/source will be read from `node_getPublicLogs` once `MarketFactory.create_market` emits them. The frontend already parses the expected log layout. Pending contract redeployment.
4. **Domain-separated slot derivation** — Aztec's `Map<Field, PublicMutable<...>>` stores values at `poseidon2HashWithSeparator([base_slot, key], 4015149901)`. Use `deriveStorageSlotInMap` from `@aztec/stdlib/hash` in the frontend.
5. **CLI-based testnet deployment** — `aztec-wallet` CLI defaults to native proving. TypeScript `deploy.ts` with `proverEnabled = false` only works on local sandbox.
6. **TestToken is our own contract** — No official stablecoin on Aztec testnet.
7. **Artifact path `@` gotcha** — CLI's `artifactPathParser` treats paths with `@` as workspace syntax. Always copy to `/tmp/aztec-artifacts/`.
8. **SponsoredFPC** — Fee payment contract at `0x254082b62...`. Register once in CLI wallet DB.
9. **Two-phase init** — `set_dependencies()` breaks circular deployment dependency.
10. **Vite `/rpc` proxy** — Proxies Aztec RPC to avoid CORS. No `/api` proxy (indexer gone).
11. **Open market creation** — Bond + schedule checks on-chain; whitelist storage is dead code (see SECURITY.md H-5).
12. **Floating pill navbar** — `NavPrimary` is `position: fixed`, centered, full pill shape. Page content has `paddingTop: 84` to clear it.
13. **Keeper reads chain directly** — `keeper/src/utils/chainReader.ts` derives map slots and reads MarketFactory + Oracle storage via `node_getPublicStorageAt`. No postgres dependency.

---

## File Map

| Path | Purpose |
|------|---------|
| `contracts/*/src/main.nr` | Noir contract source (5 contracts) |
| `contracts/target/*.json` | Compiled contract artifacts |
| `tests/integration/src/deploy.ts` | Programmatic deploy script (sandbox only) |
| `tests/integration/src/create-market.ts` | Market creation script |
| `tests/integration/src/artifacts/` | Generated TypeScript wrappers |
| `frontend/src/utils/azguardWallet.ts` | Azguard extension wallet adapter |
| `frontend/src/utils/ensureContractRegistered.ts` | Pre-registers contracts with wallet PXE |
| `frontend/src/contexts/WalletContext.tsx` | Global wallet state + auto-reconnect on mount |
| `frontend/src/hooks/useMarkets.ts` | **Chain-only reads via node_getPublicStorageAt + node_getPublicLogs** |
| `frontend/src/hooks/useTrade.ts` | deposit_collateral + buy_shares (two-tx flow) |
| `frontend/src/pages/CreateMarket.tsx` | Market creation form (no indexer calls) |
| `frontend/src/components/layout/NavPrimary.tsx` | **Floating pill navbar** |
| `frontend/src/config/aztec.ts` | Config from env vars |
| `frontend/.env` | Contract addresses + RPC URL (no indexer URL) |
| `keeper/src/utils/chainReader.ts` | **RPC-based market + oracle state reader (replaces postgres)** |
| `keeper/src/jobs/pollMarketExpiry.ts` | Expired market alert job (chain-based) |
| `keeper/src/jobs/triggerAutoVoid.ts` | Auto-void alert job (chain-based) |
| `keeper/src/` | Keeper bot (no postgres dependency) |
| `aztec-connect/` | Reusable wallet SDK |
| `SECURITY.md` | Full smart contract security audit |
| `SETUP.md` | Setup guide |
| `docker-compose.yml` | **keeper + frontend only (postgres + indexer removed)** |
| `.env` | Root env (contract addresses, no DB URL) |
