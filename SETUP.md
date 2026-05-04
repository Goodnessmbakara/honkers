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
│              │      └────┬─────┘      └──────────────────────┘
│  ┌────────┐  │           │
│  │In-browser│ │           │  JSON-RPC (polling)
│  │  PXE   │  │           │
│  │(WASM)  │  │           ▼
│  └───┬────┘  │    ┌──────────────────────────────────┐
│      │       │    │         Aztec Sandbox            │
└──────┼───────┘    │  ┌──────────────┐                │
       │            │  │   L2 Node    │                │
       │ JSON-RPC   │  │  (sequencer) │                │
       └───────────►│  └──────────────┘                │
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

> **Key change (v4.1.3):** PXE runs **in the browser** via WASM (`@aztec/pxe/client/bundle`),
> not on the sandbox server. The sandbox exposes only `node_*` RPC methods.
> Private state, note decryption, and proof generation all happen client-side
> using IndexedDB for persistent storage.

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
| **Nargo**     | 1.0+        | See below                                  | `nargo --version`        |
| **Aztec CLI** | 4.1.3       | See below                                  | `aztec --version`        |
| **Docker**    | 24+         | [docker.com](https://docs.docker.com/get-docker/) | `docker --version` |
| **PostgreSQL**| 15+         | Via Docker (recommended) or native install | `psql --version`         |

### Installing Nargo (Noir compiler)

```bash
curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
noisup  # installs latest compatible version
```

### Installing Aztec CLI + Sandbox

```bash
# Install the Aztec toolchain (includes nargo, aztec CLI, sandbox)
bash -i <(curl -s https://install.aztec.network)
aztec-up 4.1.3
```

> **Pin version**: All contracts target `aztec-packages v4.1.3`. Using a different version will cause compilation failures.

---

## Environment Variables

Copy the example env file and fill in the required values:

```bash
cp .env.example .env
```

### Public testnet

For Aztec public testnet (no local sandbox), see **[TESTNET_MIGRATION.md](TESTNET_MIGRATION.md)**. After configuring root `.env` and `frontend/.env`:

```bash
pnpm verify:stack
pnpm verify:testnet
```

### Variable Reference

| Variable                   | Required | Default                                      | Description                                                 |
|----------------------------|----------|----------------------------------------------|-------------------------------------------------------------|
| `AZTEC_RPC_URL`            | No       | `http://localhost:8080`                      | Aztec Sandbox JSON-RPC endpoint (L2 node)                   |
| `AZTEC_CHAIN_ID`           | No       | `31337`                                      | Aztec L2 chain ID (31337 = sandbox/devnet)                  |
| `ADMIN_SECRET`             | **Yes**  | (sandbox default)                            | Admin account secret (hex). Sandbox account 0 is pre-deployed |
| `WHITELISTED_CREATORS`     | No       | —                                            | Comma-separated Aztec addresses allowed to create markets   |
| `DATABASE_URL`             | No       | `postgresql://honkers:honkers@localhost:5432/honkers` | PostgreSQL connection string                        |
| `INDEXER_PORT`             | No       | `3001`                                       | Port for the indexer REST API                               |
| `KEEPER_POLL_INTERVAL_MS`  | No       | `300000` (5 min)                             | How often the keeper bot polls for expired markets           |
| `SLACK_WEBHOOK_URL`        | No       | —                                            | Slack incoming webhook for keeper alerts                    |
| `PAGERDUTY_ROUTING_KEY`    | No       | —                                            | PagerDuty Events API v2 routing key                         |
| `VITE_AZTEC_RPC_URL`       | No       | `/rpc` (Vite proxy to `localhost:8080`)      | Frontend: L2 node endpoint (proxied to avoid CORS)          |
| `VITE_INDEXER_API_URL`     | No       | `http://localhost:3001`                      | Frontend: Indexer API endpoint                              |
| `VITE_ADMIN_ADDRESSES`     | No       | —                                            | Comma-separated Aztec addresses allowed to use `/admin` UI  |
| `INDEXER_METADATA_SECRET`  | No       | —                                            | If set, `POST /api/markets/:id/metadata` requires `Authorization: Bearer …` |
| `KEEPER_AUTO_VOID_MODE`    | No       | `alert_only`                                 | `disabled` \| `alert_only` \| `auto_void` (on-chain not wired yet) |
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

### Admin Account (Sandbox)

The Aztec sandbox pre-deploys 3 Schnorr accounts. The deploy script uses **account 0**:

```
Secret:  0x2153536ff6628eee01cf4024889ff977a18d9fa61d0e414422f7681cf085c281
Address: 0x0a60414ee907527880b7a53d4dacdeb9ef768bb98d9d8d1e7200725c13763331
```

The deploy script (`tests/integration/src/deploy.ts`) hardcodes this secret and derives the admin wallet automatically. No manual account creation is needed.

> **v0.75.0 → v4.1.3 change:** `aztec create-account` no longer exists. Accounts are created programmatically via `AccountManager.create()` + `SchnorrAccountContract`.

---

## Step-by-Step Setup

### Quick Start (Docker Compose)

The easiest way to run everything is via Docker Compose. This starts all services with correct dependency ordering:

```bash
# Start all services (Sandbox, PostgreSQL, Indexer, Keeper, Frontend)
docker compose up -d

# Watch logs
docker compose logs -f

# Stop everything
docker compose down

# Stop and wipe database volume
docker compose down -v
```

**Service startup order** (handled automatically):
1. **PostgreSQL** + **Aztec Sandbox** start first
2. **Indexer** waits for both Postgres and Sandbox to be healthy, runs migration, then starts
3. **Keeper** waits for both Postgres and Sandbox to be healthy
4. **Frontend** waits for Sandbox to be healthy

| Service  | Container           | Port | Health Check                   |
|----------|---------------------|------|--------------------------------|
| Sandbox  | `honkers-sandbox`   | 8080 | `curl http://localhost:8080/status` |
| Postgres | `honkers-postgres`  | 5432 | `pg_isready -U honkers`        |
| Indexer  | `honkers-indexer`   | 3001 | `curl http://localhost:3001/health` |
| Keeper   | `honkers-keeper`    | —    | —                              |
| Frontend | `honkers-frontend`  | 5173 | Open in browser                |

### Manual Setup (without Docker Compose)

If you prefer to run services individually:

#### 1. Start PostgreSQL

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

#### 2. Start the Aztec Sandbox

```bash
# Via Docker (recommended — no CLI install needed)
docker run -d \
  --name honkers-sandbox \
  -p 8080:8080 \
  aztecprotocol/aztec:4.1.3 \
  start --sandbox

# Sandbox will listen on http://localhost:8080
# Wait for health check: curl http://localhost:8080/status
```

### 3. Admin Account

The sandbox pre-deploys 3 accounts. No manual account creation needed — the deploy script (Step 8) handles this automatically.

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
# Compile all 5 Noir contracts in the workspace
nargo compile --workspace

# Generate Aztec-specific artifacts (JSON ABIs + bytecode)
aztec compile contracts
```

> Output artifacts go to `contracts/target/`. Both commands must succeed.

### 7. Generate TypeScript Contract Artifacts

```bash
# From the repo root — generates typed TS wrappers for each contract
aztec codegen contracts/target -o tests/integration/src/artifacts
```

### 8. Deploy Contracts

Contracts use a **two-phase initialization** pattern to solve circular deployment dependencies (AMM needs Oracle's address, Oracle needs AMM's address, etc.):

1. **Phase 1 — Deploy all contracts** with admin-only constructors (no cross-references)
2. **Phase 2 — Wire dependencies** by calling `set_dependencies()` on each contract

The deploy script handles everything automatically:

```bash
# From the repo root
cd tests/integration && npx tsx src/deploy.ts
```

The script will:
- Connect to the sandbox at `http://localhost:8080`
- Create an in-process PXE and derive the admin wallet from the sandbox account 0 secret
- Deploy all 5 contracts: TestToken → AMM → Oracle → PrivateVault → MarketFactory
- Call `set_dependencies()` on AMM, Oracle, PrivateVault, and MarketFactory
- Write `.env` files to both `frontend/.env` and the project root `.env`

> **v0.75.0 → v4.1.3 change:** There is no `aztec deploy` CLI for user contracts in v4.1.3.
> Deployment is done programmatically using the generated TypeScript contract classes.
> The old approach of passing all addresses in constructors (`PublicImmutable` fields)
> was replaced with `PublicMutable` + a one-time `set_dependencies()` call to break
> the circular dependency chain.

### 9. Whitelist Market Creators

Whitelisting is done programmatically. You can add it to the deploy script or call it from a separate script:

```typescript
import { MarketFactoryContract } from './artifacts/MarketFactory.js';

const factory = await MarketFactoryContract.at(factoryAddress, adminWallet);
await factory.methods.add_to_whitelist(creatorAddress).send({ from: adminAddress }).wait();
```

---

## Running Services

### Docker Compose (recommended)

```bash
docker compose up -d        # Start all services
docker compose logs -f      # Watch all logs
docker compose up -d --build  # Rebuild after code changes
```

### Manual Development Mode

Open separate terminals:

```bash
# Terminal 1 — Aztec Sandbox (if not already running)
docker run --rm -p 8080:8080 aztecprotocol/aztec:4.1.3 start --sandbox

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
Ensure your toolchain version matches. Run `aztec-up 4.1.3` to install the correct version. All contracts target `aztec-packages v4.1.3`.

### "PXE connection refused" / "Failed to connect"
The sandbox takes 10–30 seconds to start. Wait for the `Aztec Sandbox started` log. In v4.1.3, PXE runs **in the browser** — the sandbox only exposes the L2 node RPC on port 8080. If the frontend can't connect, check the Vite proxy (`/rpc → localhost:8080`).

### "Database 'honkers' does not exist"
Run `createdb honkers` or restart the Docker container. Then run `cd indexer && pnpm db:migrate`.

### "Faucet cooldown not expired"
The TestToken faucet enforces a 1-hour cooldown per address. For development:
- Restart the sandbox to reset contract state, or
- Use `admin_mint` (no cooldown) with the admin wallet

### "No accounts registered in PXE"
In v4.1.3, accounts are created in the browser PXE. The user enters a secret, and the frontend derives a Schnorr account via `AccountManager.create()`. No CLI command is needed.

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
│   ├── Nargo.toml                # Workspace root — pins aztec-packages-v4.1.3
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
│   │   └── src/deploy.ts         # Programmatic deploy script (two-phase init)
│   └── e2e/                      # Playwright browser E2E tests
├── docker-compose.yml            # Orchestrates all services
└── docs/                         # Additional documentation
```

---

## Changes from v0.75.0 → v4.1.3

This section documents what changed from the original v0.75.0 design and **why**.

### Contract Architecture: Two-Phase Initialization

**What changed:** Contract storage fields that hold cross-contract addresses were changed from `PublicImmutable` to `PublicMutable`, and a new `set_dependencies()` function was added to each contract (AMM, Oracle, PrivateVault, MarketFactory).

**Why:** The original design passed all dependency addresses directly in the constructor. This created a **circular deployment dependency** — AMM needed Oracle's address, Oracle needed AMM's address — making it impossible to deploy either first. The two-phase pattern solves this:

1. Deploy all contracts with admin-only constructors (no cross-references)
2. Call `set_dependencies(addr1, addr2, ...)` on each contract post-deploy

A `deps_set` guard field (one-time flag) prevents `set_dependencies()` from being called more than once, preserving the same security guarantees as `PublicImmutable`.

**Files affected:**
- `contracts/amm/src/main.nr` — `vault`, `oracle` fields → `PublicMutable` + `set_dependencies(vault, oracle)`
- `contracts/oracle/src/main.nr` — `amm` field → `PublicMutable` + `set_dependencies(amm)`
- `contracts/private_vault/src/main.nr` — `token`, `amm`, `oracle` → `PublicMutable` + `set_dependencies(token, amm, oracle)`
- `contracts/market_factory/src/main.nr` — `amm`, `oracle`, `token` → `PublicMutable` + `set_dependencies(amm, oracle, token)`

### PXE Architecture: Server → Browser

**What changed:** PXE (Private eXecution Environment) moved from running on the sandbox server to running **in the browser** via WASM.

**Why:** In Aztec v4.1.3, the sandbox only exposes `node_*` JSON-RPC methods (not `pxe_*`). Private state management — note decryption, proof generation, transaction building — happens client-side. This is more privacy-preserving (private keys never leave the browser) and matches Aztec's production architecture.

**Implementation:**
- `@aztec/pxe/client/bundle` — creates an in-browser PXE with WASM provers
- `@aztec/kv-store/indexeddb` — persistent storage for notes/keys in the browser
- `MinimalWallet` — extends `BaseWallet` to bridge PXE → Wallet interface
- Vite proxy (`/rpc` → `localhost:8080`) avoids CORS issues

### Deployment: CLI → Programmatic Script

**What changed:** Contract deployment moved from `aztec deploy` CLI commands to a TypeScript deploy script (`tests/integration/src/deploy.ts`).

**Why:** The `aztec deploy` CLI command for user contracts does not exist in v4.1.3. The v4 CLI only supports `aztec deploy-l1-contracts`. Deployment is done programmatically using the generated TypeScript contract classes (`ContractClass.deploy(wallet, ...args).send()`).

### Account Management: CLI → Programmatic

**What changed:** `aztec create-account` → `AccountManager.create(wallet, secret, SchnorrAccountContract, salt)`

**Why:** The v4.1.3 CLI doesn't have `create-account`. Accounts are created programmatically using `AccountManager` from `@aztec/aztec.js/account` with `SchnorrAccountContract` from `@aztec/accounts/schnorr`.

### Codegen: @aztec/builder → aztec codegen

**What changed:** `npx @aztec/builder codegen contracts/target --outdir ...` → `aztec codegen contracts/target -o ...`

**Why:** The `@aztec/builder` package was removed. Codegen is now a built-in `aztec` CLI command.

### Compile: nargo compile → nargo compile + aztec compile

**What changed:** Contract compilation now requires two steps: `nargo compile --workspace` (Noir → ACIR bytecode) then `aztec compile contracts` (ACIR → Aztec JSON artifacts with ABI).

**Why:** The Aztec-specific artifact generation was separated from the Noir compiler in v4.x.
