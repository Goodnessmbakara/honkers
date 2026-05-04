# Scripts

## `verify-dev-stack.mjs`

Automated checks for **HANDOFF** P0/P1 (Aztec node + indexer + `frontend/.env` contract addresses).

```bash
# From repo root (pnpm per project convention)
pnpm verify:stack

# Or
node scripts/verify-dev-stack.mjs
```

**Prerequisites:** Aztec sandbox (`aztec start --sandbox` or Docker), Postgres migrated, indexer running (`cd indexer && pnpm dev`), and after first setup `tests/integration` deploy so `frontend/.env` exists.

This script does **not** exercise the browser wallet, faucet, or ProtectedRoute — those remain manual (see `HANDOFF.md`).

## `preflight-testnet.mjs`

Checks root / deploy-related env for **Docker testnet** (indexer contract addresses, optional admin + metadata secret).

```bash
pnpm verify:testnet
# or
node scripts/preflight-testnet.mjs
```

