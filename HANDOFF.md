# Honkers — Handoff Document

Status snapshot for co-contributors picking up the project.
Last updated: 2026-05-19

---

## Current working status

- **Network:** Aztec **testnet** (`https://rpc.testnet.aztec-labs.com`, Sepolia-backed, `rollupVersion: 4127419662`). All 5 contracts redeployed 2026-05-19 after SDK version alignment. Addresses in `.env` and `frontend/.env` are current.
- **SDK version:** `4.2.0-aztecnr-rc.2` everywhere — contracts (Nargo.toml), frontend, tests/integration, aztec-connect. This is the version Azguard wallet and the public testnet require. Do NOT use `4.2.0` stable — it produces `Invalid proof` on this testnet.
- **Wallet:** **Azguard** Chrome extension wallet. Users connect via Azguard; all signing and proving happens inside the extension (~30s per tx). No WASM proving in browser.
- **Markets page:** Loads without a connected wallet — reads public storage maps directly from the Aztec node via `node_getPublicStorageAt` + `node_getPublicLogs`. No indexer needed.
- **Trading:** Works end-to-end. `deposit_collateral` → `buy_shares` via Azguard (two proofs). Prices update after confirmation.
- **Create market:** Works. `MarketFactory.create_market` emits a `MarketCreated` public log with question text. Markets show immediately with full text.
- **Faucet:** TestToken mint from the Faucet page works for connected wallets.
- **Known gap — Token transfer on trade:** Buying shares does NOT yet deduct USDh from the user's wallet. The `deposit_collateral` + `buy_shares` flow needs a `TestToken.transfer` call before depositing. See **What's Next → P0** below.

---

## Contract Addresses (Testnet — current as of 2026-05-19)

| Contract | Address |
|----------|---------|
| Admin | `0x1c8721f544a7c5f96cc59d5e98587ca97d5c0f7be93090fe8c0c22be5da49c0c` |
| USDh (TestToken) | `0x0448f7619996e26f1160a94c66e91a7e0e6fa65b63ade93071e1cfc9ce0100b7` |
| AMM | `0x2821d6be5fc8c0d624eca4136dc7da7a11e94af094752fdebd7327e3ec7f23ec` |
| Oracle | `0x149be603161bfcb14cd2f54160f7f6efe9aa34c694c9e258cdeb6e74eea3fa42` |
| PrivateVault | `0x1f03a44841250ce9deccd1168229578e5580921dae2655564eb95ac1dcf5c885` |
| MarketFactory | `0x23f24f1147939dbd56a8c84e20c22babeca06dcf8c35209e1403da61247afe68` |
| SponsoredFPC | `0x2ae02a54fd254586fd628ff46b71071bd8db32b63dc5d083f844f2c208a3923c` |

Admin secret key: `0x2a999eb7ba046327c31dd7945349bf64bbf80fe8dfc0402f48f01ae8246067a4`

> **Note:** The old admin (`0x1092...`, secret `0x2153...`) was deployed with SDK 4.1.3. Its class hash changed in `rc.2` — the old account cannot be used to sign transactions with the new SDK. The new admin was freshly deployed via `aztec-wallet create-account` with `rc.2`.

---

## Why `4.2.0-aztecnr-rc.2` (not `4.2.0` stable)?

The Aztec public testnet (`rollupVersion: 4127419662`) runs a different proof system than the `4.2.0` stable npm release. The Azguard wallet dev confirmed their wallet also runs `4.2.0-aztecnr-rc.2`. Using `4.2.0` stable produces `Invalid proof` on the testnet node. The `aztecnr-rc` npm tag is the canonical pointer:

```bash
npm view @aztec/aztec.js dist-tags --json | grep aztecnr-rc
# → "aztecnr-rc": "4.2.0-aztecnr-rc.2"
```

This is documented in the Aztec networks page at `docs.aztec.network/networks`.

---

## Why USDh (Not USDC)?

There is no bridged USDC, USDT, or any stablecoin on the Aztec testnet. **USDh (USD Honkers)** is our custom testnet stablecoin:
- Symbol: `USDh`, decimals: 6
- Open faucet: anyone can mint up to **10,000 USDh per hour** from the Faucet page
- When Aztec mainnet launches, replace with a TokenPortal bridge from L1 USDC

---

## Security Status

A full internal audit has been completed — see [`SECURITY.md`](./SECURITY.md).

**Short version:** Functional for closed testnet demos. Critical security gaps make them unsuitable for real-value deployment. **No real funds should ever be deposited.**

Fix order before any real-value use: C-2 → C-1 → C-7 → C-3 → C-4 → C-5/C-6 → A-1.

---

## What's Done

### SDK Version Migration (2026-05-19)

- **Bumped everything to `4.2.0-aztecnr-rc.2`**: all 5 `Nargo.toml` files, `frontend/package.json`, `aztec-connect/package.json`, `tests/integration/package.json`
- **Contracts recompiled** using `aztecprotocol/aztec:4.2.0-aztecnr-rc.2` Docker image (`aztec compile` with nargo on PATH)
- **Breaking change fixed in `market_factory/src/main.nr`**: `emit_public_log` was removed in rc.2. Migrated to `#[event]` macro on `MarketCreated` struct + `emit_event_in_public` from `aztec::event::event_emission`
- **TypeScript artifacts regenerated** via `aztec codegen` with rc.2 image
- **All 5 contracts redeployed** to testnet via `aztec-wallet` CLI (native prover, SponsoredFPC payment)
- **All dependency wiring completed** via `aztec-wallet send set_dependencies`
- **New admin account** deployed fresh (old 4.1.3 account incompatible — see note above)

### Deployment Workflow (current — 2026-05-19)

The correct workflow for deploying to testnet:

```bash
# 1. Compile contracts
docker run --rm \
  -v $(pwd)/contracts:/contracts \
  -w /contracts \
  -e PATH="/usr/src/noir/noir-repo/target/release:$PATH" \
  aztecprotocol/aztec:4.2.0-aztecnr-rc.2 \
  compile --silence-warnings

# 2. Codegen TypeScript artifacts
for contract in amm-AMM market_factory-MarketFactory oracle-Oracle private_vault-PrivateVault test_token-TestToken; do
  docker run --rm \
    -v $(pwd)/contracts:/contracts \
    -v $(pwd)/tests/integration/src/artifacts:/artifacts \
    aztecprotocol/aztec:4.2.0-aztecnr-rc.2 \
    codegen /contracts/target/${contract}.json -o /artifacts
done

# 3. Install deps
cd tests/integration && pnpm install

# 4. Register SponsoredFPC in wallet
AZTEC_NODE_URL=https://rpc.testnet.aztec-labs.com \
node_modules/.bin/aztec-wallet register-contract \
  0x2ae02a54fd254586fd628ff46b71071bd8db32b63dc5d083f844f2c208a3923c SponsoredFPC

# 5. Create admin account (first time only)
AZTEC_NODE_URL=https://rpc.testnet.aztec-labs.com \
node_modules/.bin/aztec-wallet create-account \
  --alias admin \
  --payment method=fpc-sponsored,fpc=0x2ae02a54fd254586fd628ff46b71071bd8db32b63dc5d083f844f2c208a3923c

# 6. Deploy each contract (example: MarketFactory)
AZTEC_NODE_URL=https://rpc.testnet.aztec-labs.com \
node_modules/.bin/aztec-wallet deploy contracts/target/market_factory-MarketFactory.json \
  --args <ADMIN_ADDRESS> \
  --from admin --alias market_factory \
  --payment method=fpc-sponsored,fpc=0x2ae02a54fd254586fd628ff46b71071bd8db32b63dc5d083f844f2c208a3923c

# 7. Wire dependencies (see order below)
# 8. Update .env and frontend/.env with new addresses
```

**Dependency wiring order:**
1. `AMM.set_dependencies(vault, oracle)`
2. `Oracle.set_dependencies(amm)`
3. `PrivateVault.set_dependencies(token, amm, oracle)`
4. `MarketFactory.set_dependencies(amm, oracle, token)`

> **The TypeScript `deploy.ts` script** (`tests/integration/src/deploy.ts`) is broken for testnet — the custom `DeployerWallet` can't produce valid proofs for the deployed admin account. Use `aztec-wallet` CLI for all testnet deployments.

### Trading — Slippage Fix (2026-05-19)

- **Root cause:** `useTrade.ts` computed `minSharesOut` using a linear price formula (`collateral / price`) which overestimates expected shares vs the AMM's constant-product output
- **Fix:** `useTrade.ts` now mirrors the AMM's exact `swap` math: `new_reserve_out = k / new_reserve_in`, `shares_out = reserve_out - new_reserve_out`
- **`fetchAmmPrices`** now also returns `reserveYes` and `reserveNo` bigints so the trade hook can use them directly

### Prices — Live Refetch After Trade (2026-05-19)

- `useMarketDetail` now exposes a `refetch()` callback (uses `tick` counter in `useEffect` deps)
- **Trade page** calls `refetch()` when `step === "confirmed"` — odds update immediately after a buy
- **MarketDetail page** polls `refetch()` every 10 seconds for live price display

### Earlier Sessions

- **All 5 contracts** compiled from Aztec 0.75.0 → 4.2.0-aztecnr-rc.2 clean
- **MarketFactory** emits `MarketCreated` public log with question/criteria/source packed as Fields
- **Azguard wallet** replaces in-browser PXE; `AzguardWallet` adapter in `frontend/src/utils/azguardWallet.ts`
- **No indexer** — all data from chain reads (`node_getPublicStorageAt` + `node_getPublicLogs`)
- **Floating pill navbar** — fixed, centered, frosted glass
- **Wallet auto-reconnect** — stored in localStorage (`honkers:wallet-type`)
- **Keeper** reads chain directly (no postgres)
- Docker: keeper + frontend only

---

## What's Next (by priority)

### P0 — Token transfer on trade (NOT YET IMPLEMENTED)

**Current state:** `buy_shares` deducts from the user's vault balance internally, but no `TestToken.transfer` is called first. The user's USDh wallet balance never changes.

**What needs to happen:**
The `deposit_collateral` function in `PrivateVault` needs to actually receive tokens from the user. Looking at how Aztec private token transfers work, the flow should be:

1. User calls `TestToken.transfer(user → privateVault, amount)` — this is a private tx that moves USDh notes from the user's wallet into the PrivateVault contract
2. PrivateVault's `deposit_collateral` then mints an internal balance note for the user
3. `buy_shares` debits from that internal balance

**Files to change:**
- `contracts/private_vault/src/main.nr` — `deposit_collateral` needs to call `token.transfer(msg_sender, self, amount)` cross-contract (or the user calls `token.transfer` first as a separate step)
- `frontend/src/hooks/useTrade.ts` — add `TestToken.transfer` as step 0 before `deposit_collateral`
- `frontend/src/config/contractArtifacts.ts` — ensure TestToken artifact is wired

**Decision needed:** Does the transfer happen inside `deposit_collateral` (one Azguard prompt) or as a separate user-facing tx before deposit (two extra Azguard prompts for a total of three)? Calling `token.transfer` from inside `deposit_collateral` via cross-contract call is cleaner UX.

### P1 — Balance display reflects real token state

Once token transfer is wired, `usePortfolio` needs to read the actual TestToken balance from the user's PXE notes, not from a synthetic counter. The portfolio hook should call `token.balance_of_private(userAddress)` via a utility call.

### P2 — Security fixes (before any real-value use)

See `SECURITY.md`. Priority order:
1. C-2: Oracle verification in `settle_winnings`
2. C-1: Connect `buy_shares` to real AMM output
3. C-7: Enforce real bond transfer in `dispute_resolution`
4. C-3: Remove caller-supplied `fee_recipient`
5. C-4/C-5/C-6: Auth checks on void/initialize/register

### P3 — Remaining frontend gaps

- Portfolio page shows real positions (currently placeholder)
- Import backup feature (`Backup.tsx` is placeholder)
- Playwright E2E specs with `data-testid` hooks

### P4 — Production path

- TokenPortal bridge for real USDC when Aztec mainnet launches
- Multi-sig admin
- External security audit
- Publish `aztec-connect/` SDK to npm

---

## How to Resume Development

```bash
# Install all deps
pnpm install
cd tests/integration && pnpm install && cd ..
cd frontend && pnpm install && cd ..

# Local dev (recommended — HMR, no rebuild)
cd frontend && pnpm dev
# → http://localhost:5173

# Full Docker stack (keeper + frontend)
docker compose up -d
# Frontend changes: docker compose up -d --build frontend
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Invalid proof` on testnet | Wrong SDK version. Must use `4.2.0-aztecnr-rc.2` not `4.2.0` stable |
| `Existing nullifier` on admin deploy | Admin account already deployed on-chain. Skip deploy, use existing account |
| `Invalid tx: Existing nullifier, Invalid proof` | Old 4.1.3 admin account — it's incompatible with rc.2. Use the new admin (`0x1c87...`) |
| Markets show 50/50 after trade | Hard-refresh browser (Cmd+Shift+R) to clear Vite module cache |
| Markets page empty | Check `VITE_MARKET_FACTORY_ADDRESS` in `frontend/.env`. Confirm slot 6 of factory is > 1 |
| Wallet doesn't auto-reconnect | Check `honkers:wallet-type` in localStorage |
| `aztec-wallet` CLI can't find account | Run from `tests/integration/` — wallet DB at `~/.aztec/wallet/` |
| Testnet down / tx dropped by P2P | Retry after ~30s. Testnet is a public nightly, occasionally unstable |
| Docker frontend missing addresses | `docker compose up -d --build frontend` after updating `.env` |

---

## Key Architecture Decisions

1. **`4.2.0-aztecnr-rc.2` everywhere** — Testnet + Azguard both require this specific rc tag. `4.2.0` stable is incompatible.
2. **Azguard wallet** — All proving in extension. `AzguardWallet` in `frontend/src/utils/azguardWallet.ts`.
3. **No indexer** — All data from chain reads via `node_getPublicStorageAt` + `node_getPublicLogs`. Old Express+Postgres indexer deleted.
4. **`aztec-wallet` CLI for testnet deploys** — TypeScript `deploy.ts` only works on local sandbox. CLI uses native prover.
5. **Question text via public logs** — `MarketCreated` event read from `node_getPublicLogs`, filtered by `contractAddress`.
6. **Domain-separated slot derivation** — `Map<Field, PublicMutable>` stores at `poseidon2HashWithSeparator([base_slot, key], 4015149901)`.
7. **Constant-product AMM math in frontend** — `minSharesOut` computed via `k / new_reserve_in` to match contract exactly.
8. **Two-phase contract init** — `set_dependencies()` breaks circular deployment dependency.
9. **SponsoredFPC** — Fee payment at `0x2ae0...`. Must be registered in wallet DB before deploying.
10. **Floating pill navbar** — `position: fixed`, full pill shape, page content has `paddingTop: 84`.

---

## File Map

| Path | Purpose |
|------|---------|
| `contracts/*/src/main.nr` | Noir contract source (5 contracts) |
| `contracts/target/*.json` | Compiled + post-processed artifacts (committed) |
| `tests/integration/src/deploy.ts` | Deploy script (broken for testnet — use CLI instead) |
| `tests/integration/src/artifacts/` | Generated TypeScript wrappers (committed) |
| `frontend/src/utils/azguardWallet.ts` | Azguard extension wallet adapter |
| `frontend/src/utils/ensureContractRegistered.ts` | Pre-registers contracts with wallet PXE |
| `frontend/src/contexts/WalletContext.tsx` | Global wallet state + auto-reconnect |
| `frontend/src/hooks/useMarkets.ts` | Chain reads — prices, market list, detail, refetch |
| `frontend/src/hooks/useTrade.ts` | deposit_collateral + buy_shares (constant-product slippage) |
| `frontend/src/pages/Trade.tsx` | Trade page — refetches prices on confirm |
| `frontend/src/pages/MarketDetail.tsx` | Market detail — polls prices every 10s |
| `frontend/src/pages/CreateMarket.tsx` | Market creation form |
| `frontend/src/config/aztec.ts` | Contract addresses from env vars |
| `frontend/.env` | Contract addresses + RPC URL (gitignored) |
| `keeper/src/utils/chainReader.ts` | RPC-based market + oracle state reader |
| `aztec-connect/` | Reusable in-browser wallet SDK |
| `SECURITY.md` | Full smart contract security audit |
| `.env` | Root env — contract addresses (gitignored) |
| `docker-compose.yml` | keeper + frontend only |
