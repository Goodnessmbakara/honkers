# Honkers — Testnet Runtime Configuration

Live reference for running Honkers fully on Aztec testnet with Sponsored FPC.

Last updated: 2026-04-24

---

## Current Runtime Mode

- **Network:** Aztec testnet
- **RPC endpoint:** `https://rpc.testnet.aztec-labs.com`
- **L1:** Sepolia (`11155111`)
- **Confirmation cadence:** ~36s+ (variable)
- **Fee strategy:** Sponsored FPC for all frontend `.send()` transaction paths

---

## Effective Service Topology

`docker-compose.yml` now runs:

- `postgres`
- `indexer`
- `keeper`
- `frontend`

It no longer starts local `sandbox` or `ethereum` services.

### Compose defaults

- `frontend`:
  - `AZTEC_SANDBOX_URL=https://rpc.testnet.aztec-labs.com`
- `indexer`:
  - `AZTEC_RPC_URL=https://rpc.testnet.aztec-labs.com`
  - `POLL_INTERVAL_MS=30000`
- `keeper`:
  - `AZTEC_RPC_URL=https://rpc.testnet.aztec-labs.com`
  - `KEEPER_POLL_INTERVAL_MS=600000`

---

## Fee payment (Frontend)

- **`frontend/src/utils/feePolicy.ts`** — `resolveSendFeeOptions(wallet)`:
  - When `feeStrategy` is `sponsored_fpc` (testnet default), tries Sponsored FPC first, then falls back to **fee juice** (empty fee options) if sponsorship setup fails.
  - When `feeStrategy` is `fee_juice` (mainnet-oriented), uses default wallet fee only.

### Sponsored FPC helper

- `frontend/src/utils/sponsoredFee.ts` — derives canonical Sponsored FPC (`salt = 0`), registers with wallet, returns `SponsoredFeePaymentMethod`.

### Send call sites

1. `frontend/src/contexts/WalletContext.tsx` — account deploy uses `resolveSendFeeOptions`.
2. `frontend/src/hooks/usePXE.ts` — contract sends use `resolveSendFeeOptions`.

## Wallet secret storage (Frontend)

- Account encryption secret is **not** stored as plaintext in `localStorage`.
- `frontend/src/utils/browserSecretVault.ts` — AES-256-GCM + device wrap key (`honkers:vault-wrap-key`); legacy `honkers:wallet-secret` is migrated once then removed.
- PXE “reset stale DB” paths preserve vault keys so users are not logged out after recovery reloads.

---

## UX for Testnet Confirmations

Trade flow now exposes explicit confirmation waiting states for testnet latency.

### Proof step progression

For each tx segment:

`witness -> proving -> submitting -> confirming -> confirmed`

For 2-step trade flow:

- Deposit:
  - `deposit_witness`
  - `deposit_proving`
  - `deposit_submitting`
  - `deposit_confirming`
- Buy:
  - `buy_witness`
  - `buy_proving`
  - `buy_submitting`
  - `buy_confirming`

### UI copy

`ProofProgress` now displays:

- "Waiting for testnet confirmation (~36s+ block time)…"
- Segment-specific confirming labels for deposit and buy steps

---

## Quick Validation Commands

Start services:

```bash
docker compose up -d --build --remove-orphans
```

Verify frontend RPC proxy reaches testnet:

```bash
curl -sS -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"node_getNodeInfo","params":[]}' \
  http://localhost:5173/rpc
```

Verify indexer health:

```bash
curl -sS http://localhost:3001/health
```

---

## Operational Notes

- Keep local dev servers off ports `5173` and `3001` when using Docker, or they can shadow container services.
- Testnet confirmation times are nondeterministic; UX should always treat confirmation as asynchronous and potentially slow.
- Sponsored FPC availability is assumed from Aztec testnet docs; if network behavior changes, fallback to Fee Juice payment should be implemented next.

---

## Reference Links

- Networks: https://docs.aztec.network/networks
- Getting started on testnet: https://docs.aztec.network/developers/getting_started_on_testnet
- Paying fees: https://docs.aztec.network/developers/docs/guides/aztec-js/how_to_pay_fees
- Explorer: https://testnet.aztecscan.xyz
