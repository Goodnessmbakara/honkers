# Honkers — Testnet Migration Plan

Guide for migrating from local sandbox to Aztec testnet.

Last updated: 2026-04-16

---

## Current State

- **Sandbox**: Aztec v4.1.3 on `localhost:8080` (ephemeral, zero fees, instant blocks)
- **Target**: Aztec testnet at `https://rpc.testnet.aztec-labs.com` (persistent, fees required, ~36s blocks)
- **Both run node v4.1.3** — contracts are compatible without recompilation

---

## Network Details

| Parameter | Sandbox | Testnet |
|-----------|---------|---------|
| Node version | 4.1.3 | 4.1.3 |
| L1 chain | Anvil (31337) | Sepolia (11155111) |
| RPC endpoint | `http://localhost:8080` | `https://rpc.testnet.aztec-labs.com` |
| Block time | Instant | ~36 seconds |
| Fees | None | Required (Fee Juice) |
| Sponsored FPC | Yes | Check availability |
| Proving | Disabled by default | Always enabled |
| State persistence | Ephemeral (lost on restart) | Persistent |
| Test accounts | 3 pre-funded | None |
| Block explorer | N/A | [aztecscan.xyz](https://testnet.aztecscan.xyz) |

---

## Prerequisites

### 1. Sepolia ETH

Users need Sepolia ETH to bridge Fee Juice. Sources:
- Alchemy Sepolia faucet
- Infura Sepolia faucet
- Any Sepolia ETH faucet

### 2. Fee Juice

Required for every L2 transaction. Sources:
- **Nethermind faucet**: https://aztec-faucet.nethermind.io/ (1 claim per 24h)
- **Bridge from L1**: Send Sepolia ETH to the Fee Juice portal on L1, claim on L2

### 3. Aztec CLI (for contract deployment)

```bash
bash -i <(curl -s https://install.aztec.network)
aztec-up -v 4.1.3
```

---

## Migration Steps

### Phase 1: Configuration

#### 1a. Environment variables

Create `frontend/.env.testnet`:

```env
VITE_AZTEC_RPC_URL=/rpc
VITE_INDEXER_API_URL=https://your-indexer.example.com
```

Update `docker-compose.yml` or local dev config:

```yaml
environment:
  AZTEC_SANDBOX_URL: https://rpc.testnet.aztec-labs.com
```

Or for local dev without Docker, update `frontend/vite.config.ts` proxy target:

```typescript
'/rpc': {
  target: process.env.AZTEC_SANDBOX_URL || 'https://rpc.testnet.aztec-labs.com',
  changeOrigin: true,
  rewrite: (p) => p.replace(/^\/rpc/, ''),
},
```

#### 1b. Remove sandbox-specific code

- Remove rollup address tracking in `useAztecWallet.ts` (testnet rollup is stable)
- Or make it testnet-aware (only nuke DB if rollup changes on sandbox, not testnet)

### Phase 2: Fee Payment

This is the largest change. Every `.send()` call needs a fee payment method.

#### Option A: Sponsored FPC (if available on testnet)

```typescript
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee";
import { getContractInstanceFromInstantiationParams } from "@aztec/aztec.js";

// Derive the canonical Sponsored FPC address
const sponsoredFPCInstance = await getContractInstanceFromInstantiationParams(
  SponsoredFPCContract.artifact,
  { salt: new Fr(0) },
);
await wallet.registerContract(sponsoredFPCInstance, SponsoredFPCContract.artifact);

const paymentMethod = new SponsoredFeePaymentMethod(sponsoredFPCInstance.address);

// Use on every transaction
await contract.methods.some_function(args).send({
  from: userAddress,
  fee: { paymentMethod },
});
```

#### Option B: Fee Juice (user pays directly)

```typescript
// User must have Fee Juice balance
// No special payment method needed — it's the default
await contract.methods.some_function(args).send({
  from: userAddress,
  // fee: { paymentMethod: defaultFeeJuiceMethod } — implicit
});
```

#### Option C: Bridge + Claim (bootstrap from L1)

```typescript
import { FeeJuicePaymentMethodWithClaim } from "@aztec/aztec.js/fee";

// After bridging Sepolia ETH to Fee Juice on L1:
const bridgePaymentMethod = new FeeJuicePaymentMethodWithClaim(
  account.address,
  claim, // from the bridge transaction
);

// Use to deploy account in one step
const deployMethod = await accountManager.getDeployMethod();
await deployMethod.send({
  from: NO_FROM,
  fee: { paymentMethod: bridgePaymentMethod },
});
```

#### Implementation plan

1. Create `frontend/src/utils/feePayment.ts`:

```typescript
// Centralize fee payment method creation
export async function getFeePaymentMethod(wallet: Wallet): Promise<FeePaymentMethod> {
  // Try Sponsored FPC first
  // Fall back to direct Fee Juice
  // If no balance, prompt user to get Fee Juice
}
```

2. Update every contract interaction to use it:
   - `WalletContext.tsx` — account deployment
   - `useTrade.ts` — buy/sell outcomes
   - `useFaucet.ts` — token minting
   - `useMarkets.ts` — market creation (admin)

### Phase 3: Account Deployment

On testnet there are no pre-funded accounts. The account deployment in `WalletContext.tsx` needs fee payment.

```typescript
// Current (sandbox — no fees):
await deployMethod.send({ from: account.getAddress() });

// Testnet (with fees):
const paymentMethod = await getFeePaymentMethod(minimalWallet);
await deployMethod.send({
  from: account.getAddress(),
  fee: { paymentMethod },
});
```

First-time users need Fee Juice before they can even deploy their account. Options:
1. Direct them to Nethermind faucet first
2. Use Sponsored FPC (if available) for account deployment
3. Implement L1 bridge flow in the UI (bridge Sepolia ETH → claim Fee Juice → deploy account)

### Phase 4: Contract Deployment

Deploy the 5 Honkers contracts to testnet:

```bash
export NODE_URL=https://rpc.testnet.aztec-labs.com

# Create deployer account
aztec-wallet create-account --register-only --node-url $NODE_URL --alias deployer

# Fund deployer via faucet or bridge

# Deploy account
aztec-wallet deploy-account \
  --node-url $NODE_URL \
  --from deployer \
  --payment method=fee-juice

# Deploy each contract (update deploy.ts to accept fee payment)
cd tests/integration && AZTEC_RPC_URL=$NODE_URL npx tsx src/deploy.ts
```

The deploy script (`tests/integration/src/deploy.ts`) needs updating to:
1. Accept a `--network testnet` flag
2. Add fee payment to every deployment transaction
3. Wait longer for confirmations (36s+ per tx)
4. Handle timeout errors gracefully

### Phase 5: UI Changes

#### 5a. Transaction confirmation times

Current UI expects instant confirmation. Testnet needs:

- Loading spinners that say "Waiting for block confirmation (~36s)"
- Timeout handling — "Transaction submitted, waiting for inclusion..."
- Link to block explorer for pending transactions

Update `ProofProgress` component steps:

```
proving → submitting → waiting for block (~36s) → confirmed
```

#### 5b. Fee Juice balance display

Add Fee Juice balance to wallet UI:

```typescript
// In WalletContext or a new useFeeBalance hook
const feeBalance = await wallet.getBalance(feeJuiceAddress);
```

Show warning when balance is low: "Low Fee Juice — transactions may fail."

#### 5c. Onboarding flow for new users

New testnet users need guided onboarding:

1. "Get Sepolia ETH" — link to faucet
2. "Bridge to Fee Juice" — L1 bridge UI or link to Nethermind faucet
3. "Deploy account" — automatic after Fee Juice available
4. "Start trading" — normal app flow

### Phase 6: Indexer

The indexer currently polls the local sandbox. For testnet:

1. Point `AZTEC_RPC_URL` to testnet RPC
2. Increase `POLL_INTERVAL_MS` (testnet blocks are slower)
3. Deploy indexer to a server (can't rely on local Docker)
4. Handle chain reorgs (testnet has real L1 reorgs on Sepolia)

### Phase 7: Testing

Before going live on testnet:

- [ ] Account creation + deployment with fee payment works
- [ ] Contract deployment succeeds on testnet
- [ ] Market creation works
- [ ] Trading (buy/sell) works with fee payment
- [ ] Faucet minting works
- [ ] Portfolio displays correctly
- [ ] Note recovery works after clearing browser data
- [ ] Transaction timeout handling is smooth
- [ ] Fee Juice balance displays correctly
- [ ] Onboarding flow guides new users through Fee Juice acquisition

---

## Cost Estimate

Every transaction costs Fee Juice. Rough per-user costs on testnet:

| Action | Transactions | Notes |
|--------|-------------|-------|
| Account deployment | 1 (one-time) | ~1 tx worth of Fee Juice |
| Token mint (faucet) | 1 per mint | |
| Buy outcome | 1 per trade | |
| Sell outcome | 1 per trade | |
| Claim winnings | 1 per market | |

Fee Juice is free from the Nethermind faucet (1 claim per 24h). For a demo, this is sufficient.

---

## What NOT to Change

- **Contract code**: Same Noir contracts work on sandbox and testnet (v4.1.3 compatible)
- **PXE initialization**: Same `@aztec/pxe/client/bundle` for in-browser PXE
- **Vite config**: Same WASM/polyfill/proxy setup
- **Wallet context architecture**: Same WalletProvider + ProtectedRoute pattern
- **Note backup/recovery**: Same secret key approach

---

## Migration Order

1. **Get sandbox flows working first** (current priority)
2. Add fee payment utility (`feePayment.ts`)
3. Update account deployment with fees
4. Deploy contracts to testnet
5. Update UI for longer confirmation times
6. Add Fee Juice balance display
7. Add onboarding flow for new users
8. Deploy indexer to server pointing at testnet
9. End-to-end test on testnet

---

## Useful Links

- Testnet RPC: `https://rpc.testnet.aztec-labs.com`
- Block explorer: https://testnet.aztecscan.xyz
- Faucet: https://aztec-faucet.nethermind.io
- Testnet migration guide: https://docs.aztec.network/dev/developers/guides/getting_started_on_testnet
- Fee payment guide: https://docs.aztec.network/developers/docs/guides/aztec-js/how_to_pay_fees
- Network info: https://docs.aztec.network/networks
