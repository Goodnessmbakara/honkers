# Honkers — Development Setup Guide

Complete setup instructions for running the Honkers private prediction market locally.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Environment Variables](#environment-variables)
4. [Step-by-Step Setup](#step-by-step-setup)
5. [Contract Compilation & Deployment](#contract-compilation--deployment)
6. [Running Services](#running-services)
7. [Running Tests](#running-tests)
8. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌─────────────┐      ┌──────────┐      ┌──────────────────────┐
│  Frontend    │◄────►│ Indexer  │◄────►│  PostgreSQL          │
│  (Vite+React)│      │ (Express)│      │  (public chain data) │
└──────┬───────┘      └────┬─────┘      └──────────────────────┘
       │                   │
       │  JSON-RPC         │  JSON-RPC (polling)
       ▼                   ▼
┌──────────────────────────────────┐
│         Aztec Sandbox            │
│  ┌─────────┐  ┌──────────────┐  │
│  │   PXE   │  │   L2 Node    │  │
│  │(private)│  │  (sequencer) │  │
│  └─────────┘  └──────────────┘  │
│                                  │
│  Contracts:                      │
│    • TestToken    • AMM          │
│    • PrivateVault • Oracle       │
│    • MarketFactory               │
└──────────────────────────────────┘
       ▲
       │  polls expired markets
┌──────┴──────┐
│  Keeper Bot │
└─────────────┘
```

| Component       | Directory     | Port  | Purpose                                       |
|-----------------|---------------|-------|-----------------------------------------------|
| Frontend        | `frontend/`   | 5173  | React SPA — wallet, trading, portfolio        |
| Indexer         | `indexer/`    | 3001  | REST API serving public chain data             |
| Keeper          | `keeper/`     | —     | Cron-style bot: auto-void, health monitoring  |
| Contracts       | `contracts/`  | —     | Noir/Aztec.nr smart contracts                  |
| Tests (Noir)    | `tests/noir/` | —     | Pure arithmetic unit tests (no sandbox)        |
| Tests (Integration) | `tests/integration/` | — | Sandbox end-to-end contract tests       |
| Tests (E2E)     | `tests/e2e/`  | —     | Playwright browser tests                       |
| Aztec Sandbox   | (external)    | 8080  | Local L2 node + PXE                            |
| PostgreSQL      | (external)    | 5432  | Indexer + keeper database                      |

---

## Prerequisites

### Required Software

| Tool          | Min Version | Install                                    | Verify                   |
|---------------|-------------|--------------------------------------------|--------------------------|
| **Node.js**   | 20.x        | `nvm install 20`                           | `node --version`         |
| **pnpm**      | 9.x         | `npm install -g pnpm`                      | `pnpm --version`         |
| **Nargo**     | 0.35+       | See below                                  | `nargo --version`        |
| **Aztec CLI** | 0.75.0      | See below                                  | `aztec --version`        |
| **Docker**    | 24+         | [docker.com](https://docs.docker.com/get-docker/) | `docker --version` |
| **PostgreSQL**| 15+         | Via Docker (recommended) or native install | `psql --version`         |

### Installing Nargo (Noir compiler)

```bash
curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
noirup -v 0.35.0
```

### Installing Aztec CLI + Sandbox

```bash
# Install the Aztec CLI
npm install -g @aztec/cli@0.75.0

# Or use the install script
bash -i <(curl -s https://install.aztec.network)
```

> **Pin version**: All contracts depend on `aztec-packages-v0.75.0`. Using a different Aztec version will cause compilation failures.

---

## Environment Variables

Copy the example env file and fill in the required values:

```bash
cp .env.example .env
```

### Variable Reference

| Variable                   | Required | Default                                      | Description                                                 |
|----------------------------|----------|----------------------------------------------|-------------------------------------------------------------|
| `AZTEC_RPC_URL`            | No       | `http://localhost:8080`                      | Aztec Sandbox JSON-RPC endpoint (PXE)                       |
| `AZTEC_CHAIN_ID`           | No       | `31337`                                      | Aztec L2 chain ID (31337 = sandbox/devnet)                  |
| `ADMIN_PRIVATE_KEY`        | **Yes**  | —                                            | Private key of the admin wallet (hex, no 0x prefix)         |
| `WHITELISTED_CREATORS`     | No       | —                                            | Comma-separated Aztec addresses allowed to create markets   |
| `DATABASE_URL`             | No       | `postgresql://honkers:honkers@localhost:5432/honkers` | PostgreSQL connection string                        |
| `INDEXER_PORT`             | No       | `3001`                                       | Port for the indexer REST API                               |
| `KEEPER_POLL_INTERVAL_MS`  | No       | `300000` (5 min)                             | How often the keeper bot polls for expired markets           |
| `SLACK_WEBHOOK_URL`        | No       | —                                            | Slack incoming webhook for keeper alerts                    |
| `PAGERDUTY_ROUTING_KEY`    | No       | —                                            | PagerDuty Events API v2 routing key                         |
| `VITE_AZTEC_RPC_URL`       | No       | `http://localhost:8080`                      | Frontend: PXE endpoint (exposed to browser)                 |
| `VITE_INDEXER_API_URL`     | No       | `http://localhost:3001`                      | Frontend: Indexer API endpoint                              |
| `VITE_SENTRY_DSN`          | No       | —                                            | Sentry DSN for frontend error tracking (no PII)             |
| `BLOCKED_JURISDICTIONS`    | No       | `US,CN,GB`                                   | ISO country codes to geo-block (Vercel edge middleware)      |

### Post-Deployment Variables

After deploying contracts, you need to set these (they are blank until deployment):

| Variable                        | Set After                    | Description                           |
|---------------------------------|------------------------------|---------------------------------------|
| `VITE_PRIVATE_VAULT_ADDRESS`    | Contract deployment          | PrivateVault contract address         |
| `VITE_AMM_ADDRESS`              | Contract deployment          | AMM contract address                  |
| `VITE_ORACLE_ADDRESS`           | Contract deployment          | Oracle contract address               |
| `VITE_MARKET_FACTORY_ADDRESS`   | Contract deployment          | MarketFactory contract address        |
| `VITE_TEST_TOKEN_ADDRESS`       | Contract deployment          | TestToken contract address            |
| `MARKET_FACTORY_ADDRESS`        | Contract deployment          | For indexer — MarketFactory address   |
| `AMM_ADDRESS`                   | Contract deployment          | For indexer/keeper — AMM address      |
| `ORACLE_ADDRESS`                | Contract deployment          | For indexer/keeper — Oracle address   |
| `TEST_TOKEN_ADDRESS`            | Contract deployment          | For indexer — TestToken address       |

### Getting the `ADMIN_PRIVATE_KEY`

```bash
# Start the sandbox first, then create an account:
aztec start --sandbox

# In another terminal:
aztec create-account
# Output:
#   Address: 0x1234...
#   Private key: 0xabcd...
#   Signing key: 0xef01...

# Copy the private key (without 0x prefix) to .env:
# ADMIN_PRIVATE_KEY=abcd...
```

---

## Step-by-Step Setup

### 1. Start PostgreSQL

```bash
# Option A: Docker (recommended)
docker run -d \
  --name honkers-postgres \
  -e POSTGRES_USER=honkers \
  -e POSTGRES_PASSWORD=honkers \
  -e POSTGRES_DB=honkers \
  -p 5432:5432 \
  postgres:16-alpine

# Option B: If Postgres is already running locally
createdb honkers
```

### 2. Start the Aztec Sandbox

```bash
aztec start --sandbox
# Sandbox will listen on http://localhost:8080
# Wait for "Aztec Sandbox started" message before proceeding
```

### 3. Create an Admin Account

```bash
aztec create-account
# Save the output address and private key to your .env file
```

### 4. Install Dependencies

```bash
# Frontend
cd frontend && pnpm install && cd ..

# Indexer
cd indexer && pnpm install && cd ..

# Keeper
cd keeper && pnpm install && cd ..

# Integration tests
cd tests/integration && pnpm install && cd ../..

# E2E tests
cd tests/e2e && pnpm install && npx playwright install && cd ../..
```

### 5. Run Database Migration

```bash
cd indexer && pnpm db:migrate && cd ..
```

### 6. Compile Contracts

```bash
cd contracts && nargo compile && cd ..
```

> This compiles all 5 contracts in the workspace. Output artifacts go to `contracts/target/`.

### 7. Generate TypeScript Contract Artifacts

```bash
# From the repo root
npx @aztec/builder codegen contracts/target --outdir tests/integration/src/artifacts
```

### 8. Deploy Contracts

```bash
# Deploy in order (dependencies matter):

# 1. TestToken
aztec deploy contracts/target/test_token.json \
  --args <ADMIN_ADDRESS> <NAME_FIELD> <SYMBOL_FIELD>

# 2. AMM (vault + oracle addresses are ZERO initially, updated later)
aztec deploy contracts/target/amm.json \
  --args <ADMIN_ADDRESS> 0x0 0x0

# 3. Oracle
aztec deploy contracts/target/oracle.json \
  --args <ADMIN_ADDRESS> <AMM_ADDRESS>

# 4. PrivateVault
aztec deploy contracts/target/private_vault.json \
  --args <ADMIN_ADDRESS> <FEE_RECIPIENT> <TOKEN_ADDRESS> <AMM_ADDRESS> <ORACLE_ADDRESS>

# 5. MarketFactory
aztec deploy contracts/target/market_factory.json \
  --args <ADMIN_ADDRESS> <AMM_ADDRESS> <ORACLE_ADDRESS> <TOKEN_ADDRESS>
```

After each deployment, copy the returned contract address into your `.env` file.

### 9. Whitelist Market Creators

```bash
aztec send \
  --contract <MARKET_FACTORY_ADDRESS> \
  --function add_to_whitelist \
  --args <CREATOR_ADDRESS> \
  --private-key <ADMIN_PRIVATE_KEY>
```

---

## Running Services

### Development Mode (all services)

Open separate terminals:

```bash
# Terminal 1 — Aztec Sandbox (if not already running)
aztec start --sandbox

# Terminal 2 — Frontend
cd frontend && pnpm dev

# Terminal 3 — Indexer
cd indexer && pnpm dev

# Terminal 4 — Keeper (optional for local dev)
cd keeper && pnpm dev
```

### Verify Everything Is Running

| Check                | Command / URL                        | Expected                          |
|----------------------|--------------------------------------|-----------------------------------|
| Sandbox              | `curl http://localhost:8080`         | JSON-RPC response                 |
| Frontend             | Open `http://localhost:5173`         | Honkers landing page              |
| Indexer API          | `curl http://localhost:3001/health`  | `{"status":"ok"}`                 |
| PostgreSQL           | `psql $DATABASE_URL -c 'SELECT 1'`  | Returns `1`                       |

---

## Running Tests

### Noir Unit Tests (no sandbox needed)

```bash
cd tests/noir && nargo test
```

Tests pure AMM math (CPMM formula, fees, pricing) — runs in ~2 seconds.

### Integration Tests (requires sandbox)

```bash
# Ensure sandbox is running and contracts are deployed
cd tests/integration
PXE_URL=http://localhost:8080 pnpm test
```

> **Note**: Integration tests are currently stubbed with `assert.ok(true)` guards. Uncomment the implementation blocks after running `npx @aztec/builder codegen` to generate contract artifacts.

### Playwright E2E Tests (requires frontend + sandbox)

```bash
# Ensure frontend dev server + sandbox are running
cd tests/e2e
APP_URL=http://localhost:5173 npx playwright test
```

> Requires `npx playwright install` to have been run at least once.

---

## Troubleshooting

### "Market already initialised" error
The AMM's `initialize_market` asserts `invariant_k == 0`. If you're reusing a market ID from a previous session, restart the sandbox to clear state.

### "Nargo compile fails with version mismatch"
Ensure your Nargo version matches the dependency pin. Contracts use `aztec-packages-v0.75.0`, which requires `nargo >= 0.35.0`.

### "PXE connection refused"
The sandbox takes 10–30 seconds to start. Wait for the `Aztec Sandbox started` log before connecting.

### "Database 'honkers' does not exist"
Run `createdb honkers` or restart the Docker container. Then run `cd indexer && pnpm db:migrate`.

### "Faucet cooldown not expired"
The TestToken faucet enforces a 1-hour cooldown per address. For development:
- Restart the sandbox to reset contract state, or
- Use `admin_mint` (no cooldown) with the admin wallet

### "No accounts registered in PXE"
Run `aztec create-account` to register at least one account before connecting the frontend.

### Frontend shows blank contract addresses
Set `VITE_*_ADDRESS` variables in `.env` after deploying contracts. Restart the Vite dev server (`pnpm dev`) for env changes to take effect.

### Keeper "Oracle/AMM address empty" warnings
Set `ORACLE_ADDRESS` and `AMM_ADDRESS` in `.env` after deployment. The keeper skips these jobs when addresses are blank.

---

## Key Constants (for reference)

| Constant             | Value          | Location                      | Meaning                        |
|----------------------|----------------|-------------------------------|--------------------------------|
| `SCALE`              | `1_000_000`    | AMM, tests                    | Fixed-point 1e6 (USDC 6 dec)  |
| `CHALLENGE_WINDOW`   | `86_400`       | Oracle                        | 24 hours in seconds            |
| `GRACE_PERIOD`       | `259_200`      | Oracle                        | 72 hours in seconds            |
| `PLATFORM_FEE`       | `3 / 100`      | PrivateVault                  | 3% of gross winnings           |
| `MAX_FAUCET_AMOUNT`  | `100_000_000`  | TestToken                     | 100 USDC max per faucet drip   |
| `FAUCET_COOLDOWN`    | `3_600`        | TestToken                     | 1 hour between faucet requests |
| `side` values        | `1=YES, 0=NO`  | ShareNote, AMM swap           | Field (not bool) for circuits  |

---

## Directory Structure

```
honkers/
├── .env                          # Local env vars (git-ignored via secrets)
├── .env.example                  # Template with all variables
├── .gitignore
├── SETUP.md                      # ← You are here
├── PHASES.md                     # Development phases roadmap
├── SRS.md                        # Software Requirements Specification
├── ideation.md                   # Design decisions and trade-offs
├── contracts/                    # Noir/Aztec.nr smart contracts
│   ├── Nargo.toml                # Workspace root — pins aztec-packages-v0.75.0
│   ├── amm/                      # CPMM AMM (public state, price discovery)
│   ├── oracle/                   # Resolution: propose → dispute → finalise
│   ├── private_vault/            # Collateral, shares, winnings (private notes)
│   ├── market_factory/           # Market creation + whitelist gating
│   └── test_token/               # Testnet USDC with faucet + rate limiting
├── frontend/                     # Vite + React SPA
│   └── src/
│       ├── config/aztec.ts       # PXE + contract address config
│       ├── hooks/                # usePXE, useWallet, useTrade, etc.
│       ├── components/           # UI components by domain
│       ├── pages/                # Route pages
│       └── types/index.ts        # Shared TypeScript types
├── indexer/                      # PostgreSQL indexer + REST API
│   └── src/
│       ├── api/                  # Express routes
│       ├── db/                   # Schema, migrations, client
│       ├── indexer/              # Aztec block polling
│       └── types/                # TypeScript types
├── keeper/                       # Auto-void bot + health monitoring
│   └── src/
│       ├── jobs/                 # pollMarketExpiry, triggerAutoVoid, monitorHealth
│       └── utils/alerts.ts       # Slack + PagerDuty alerting
├── tests/
│   ├── noir/                     # Pure Noir unit tests (nargo test)
│   ├── integration/              # Aztec Sandbox integration tests
│   └── e2e/                      # Playwright browser E2E tests
└── docs/                         # Additional documentation
```
