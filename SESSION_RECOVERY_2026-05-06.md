# Honkers Session Recovery Notes (2026-05-06)

## Why this file exists
This file captures what changed during the troubleshooting session, what the goal was, what has already been attempted, and how to continue if chat history is lost.

## Baseline repo reference
- Repo: `Goodnessmbakara/honkers`
- Branch: `main`
- Baseline commit at start of this note: `57458bc`
- Baseline commit message: `chore: update claude permissions, remove stale worktree ref`

## Primary objective for this session
Restore end-to-end testnet flow with Azguard wallet by fixing faucet failures (`Contract artifact not found`) and ensuring the deployed contract addresses/artifacts/class IDs are compatible with current Aztec testnet.

## Root cause identified
The configured on-chain `TestToken` at `TEST_TOKEN_ADDRESS` does not match the local compiled artifact class ID. Azguard is strict about artifact/class compatibility, so contract registration fails and faucet calls fail.

Additional compatibility issue found:
- Testnet node reports version `4.2.0-rc.1`.
- Client packages previously mixed `4.1.3` and `4.2.0`, which caused proof/payment incompatibilities in deploy flows.

## Working tree changes (not yet committed)

### 1) Frontend Aztec dependency pinning
File: `frontend/package.json`
- Changed all key Aztec packages from `4.2.0`/`^4.2.0` to `4.2.0-rc.1`:
  - `@aztec/accounts`
  - `@aztec/aztec.js`
  - `@aztec/foundation`
  - `@aztec/kv-store`
  - `@aztec/noir-contracts.js`
  - `@aztec/protocol-contracts`
  - `@aztec/pxe`
  - `@aztec/stdlib`
  - `@aztec/wallet-sdk`
  - `@aztec/wallets`

### 2) Artifact lookup hardening
File: `frontend/src/config/contractArtifacts.ts`
- Added address normalization (`trim().toLowerCase()`) for artifact lookup.
- Added `rawArtifacts` cache and `getRawArtifact()` export.
- Allows both loaded artifact and raw compiled artifact retrieval by address.

### 3) Faucet cooldown key scoping
File: `frontend/src/hooks/useFaucet.ts`
- Cooldown localStorage key changed from global key to per-wallet-address key.

### 4) Market hook type cleanup
File: `frontend/src/hooks/useMarkets.ts`
- Tightened typings in market fetch mapping (`Promise<Market | null>`, explicit `Market` variable).
- Removed assignment of optional text fields (`criteria`, `source`) in one path.

### 5) PXE send path updates
File: `frontend/src/hooks/usePXE.ts`
- Uses `getRawArtifact()` in addition to `getArtifact()`.
- Passes both artifact forms to registration helper.
- Adds fee option resolution via `resolveSendFeeOptions()` for `.send()` calls.

### 6) Azguard fee option normalization
File: `frontend/src/utils/azguardWallet.ts`
- Replaced fee-stripping behavior with `#normalizeSendLikeOpts()`.
- Ensures `fee` object exists instead of removing it.

### 7) Contract registration fallback behavior
File: `frontend/src/utils/ensureContractRegistered.ts`
- `ensureContractRegisteredWithPXE(...)` now accepts optional `rawArtifact`.
- On artifact/class mismatch errors, tries:
  1. loaded artifact
  2. raw artifact
  3. instance-only registration

### 8) Fee policy wallet typing
File: `frontend/src/utils/feePolicy.ts`
- Switched type dependency from `MinimalWallet` to wallet interface shape (`Pick<Wallet, "registerContract">`) for compatibility.

### 9) Sponsored fee contract registration strategy
File: `frontend/src/utils/sponsoredFee.ts`
- Switched from deterministic local derivation to configured sponsored FPC address from env.
- Fetches on-chain instance from node, registers contract, and falls back to instance-only on artifact mismatch.
- Creates `SponsoredFeePaymentMethod` from configured address.

### 10) Integration dependency pinning
File: `tests/integration/package.json`
- Changed Aztec dependencies/devDependency from `4.2.0` to `4.2.0-rc.1`:
  - `@aztec/accounts`
  - `@aztec/aztec.js`
  - `@aztec/cli-wallet`
  - `@aztec/noir-contracts.js`
  - `@aztec/pxe`
  - `@aztec/stdlib`
  - `@aztec/wallet-sdk`
  - `@aztec/aztec` (dev)

### 11) Deploy script idempotence + proving mode fix
File: `tests/integration/src/deploy.ts`
- `config.proverEnabled` is now conditional:
  - local node (`localhost`/`127.0.0.1`): proving disabled
  - non-local (testnet): proving enabled
- Admin account deployment now tolerates rerun errors (`Existing nullifier` / already initialized) and continues.

## Actions attempted during the session (operational)
- Fully reset Docker state and restarted services.
- Verified frontend/keeper service health.
- Verified testnet RPC connectivity.
- Investigated wallet connect + faucet call flow.
- Confirmed class mismatch between deployed token and local token artifact as faucet blocker.
- Attempted deploy flows via CLI and integration deploy script; deploy blocked by proof/account compatibility before fixes above.

## Current status
- Major compatibility cleanup has been applied in code.
- Deploy script has been patched to be testnet-safe for proving and reruns.
- New contracts have NOT been successfully redeployed yet in this note.
- Env addresses still need to be refreshed after successful redeploy.

## Recommended next steps (resume checklist)
1. Install dependencies with updated versions:
   - `cd /workspaces/honkers/frontend && pnpm install`
   - `cd /workspaces/honkers/tests/integration && pnpm install`
2. Run deploy on testnet using integration script:
   - `cd /workspaces/honkers/tests/integration && AZTEC_RPC_URL=https://rpc.testnet.aztec-labs.com npx tsx src/deploy.ts`
3. Confirm script writes updated addresses to:
   - `/workspaces/honkers/.env`
   - `/workspaces/honkers/frontend/.env`
4. Restart runtime services:
   - `cd /workspaces/honkers && docker compose up -d --build`
5. Validate flows in frontend:
   - wallet connect
   - faucet mint
   - create market
   - place prediction (yes/no)

## Important note for future debugging
If faucet fails again with artifact/class errors, first verify that:
- `VITE_TEST_TOKEN_ADDRESS` and `TEST_TOKEN_ADDRESS` point to the newly deployed token.
- The frontend artifact for TestToken is from the same contract class version as the deployed instance.
- Aztec package versions used by frontend + integration match live testnet node expectations.

## Update: Successful redeploy + wiring completed
This section supersedes the earlier "Current status" block.

### Outcome
- Contracts were successfully redeployed on testnet using the patched deploy script and wired in phase 2.
- Env files were updated and Docker services were rebuilt/restarted.
- Frontend is reachable and `/rpc` proxy returns testnet node version.

### Active deployed addresses
- `ADMIN_ADDRESS=0x2f3688133ffb22035a3955751c09e4e8d689cbec0689e14039e04fc675eb56d2`
- `TEST_TOKEN_ADDRESS=0x02772350c39ce54b5efe749438254807742fae9abd329c8f9c7fadf8290cfc9b`
- `AMM_ADDRESS=0x246079360894194cfcd5c6e94482a3e42e173dccd2b4dacf414b7e44b70d72a1`
- `ORACLE_ADDRESS=0x300687de55b8c6ee0e9aa4ec58a079d4b3191daedbafa36668b4d2eee7d7f419`
- `PRIVATE_VAULT_ADDRESS=0x0023004e6fba2c780dac224a53bf2e958e88b65a232dc17ea9e06b8c5f766fe3`
- `MARKET_FACTORY_ADDRESS=0x24d7abe1f7ccaadb74dd9650b35895a4ec3f93747bc993e9ebff40b4518df572`
- `SPONSORED_FPC_ADDRESS=0x254082b62f9108d044b8998f212bb145619d91bfcd049461d74babb840181257`

### Validation completed
- `docker compose ps` shows `frontend` and `keeper` up.
- `curl http://localhost:5173` succeeded.
- `curl http://localhost:5173/rpc` with `node_getVersion` returned `4127419662`.
- All newly deployed contract addresses resolve on testnet via `node_getContract`.
- New token on-chain class ID is `0x102aa69808437d4f211ceaed1fa8585711fc9d04f895fa32c2b82376f972af5e`, which matches the class ID emitted during deployment for local artifact.

### Deploy script fixes now in place
File: `tests/integration/src/deploy.ts`
- Testnet proving enabled (`proverEnabled = !isLocalNode`).
- Admin deploy is idempotent on reruns.
- Deploy return handling updated for Aztec `4.2.0-rc.1` (`send(...).contract`).
- Env output now preserves testnet RPC, includes Sponsored FPC, and writes `VITE_ADMIN_ADDRESSES`.

### If you need to rerun deployment
1. `cd /workspaces/honkers/tests/integration`
2. `export ADMIN_SECRET=$(node -e "import('@aztec/aztec.js/fields').then(({Fr})=>console.log(Fr.random().toString()))")`
3. `AZTEC_RPC_URL=https://rpc.testnet.aztec-labs.com ADMIN_SECRET="$ADMIN_SECRET" npx tsx src/deploy.ts`
4. `cd /workspaces/honkers && docker compose up -d --build`

## Update: Azguard oracle callback error and mitigation

### Symptom observed
- Azguard popup/runtime error: `Oracle callback aztec_utl_getPendingTaggedLogs_v2 not found`.

### Likely cause
- Frontend was using `@aztec/*` `4.2.0-rc.1` while Azguard extension/client currently exposes callback set compatible with older oracle interface.
- `_v2` utility callback names are present in newer account flow, but missing in installed Azguard runtime.

### Mitigation applied
File: `frontend/package.json`
- Rolled frontend-only Aztec packages back to `4.1.3`:
   - `@aztec/accounts`
   - `@aztec/aztec.js`
   - `@aztec/foundation`
   - `@aztec/kv-store`
   - `@aztec/noir-contracts.js`
   - `@aztec/protocol-contracts`
   - `@aztec/pxe`
   - `@aztec/stdlib`
   - `@aztec/wallet-sdk`
   - `@aztec/wallets`

File: `frontend/src/utils/azguardWallet.ts`
- Updated adapter header comment to remove stale `v4.2.0` wording.

Operational actions:
- `cd /workspaces/honkers/frontend && pnpm install`
- `cd /workspaces/honkers && docker compose up -d --build frontend`

### Current intended version split
- Frontend runtime: `@aztec/*` `4.1.3` (Azguard compatibility)
- Integration/deploy tooling: `@aztec/*` `4.2.0-rc.1` (testnet deploy/prover compatibility)

### Retest instructions after this mitigation
1. Hard refresh app tab.
2. Reconnect Azguard (disconnect first if connected).
3. Retry faucet flow.
4. If still failing, update/reinstall Azguard extension and retry.
