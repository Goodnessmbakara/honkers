# Software Requirements Specification (SRS)

**Product:** Aztec Private Markets (working title)  
**Document version:** 1.0  
**Date:** April 9, 2026  
**Primary references:** `ideation.md` (PRD), [Aztec documentation](https://docs.aztec.network/), [AztecProtocol/aztec-packages](https://github.com/AztecProtocol/aztec-packages)

---

## 1. Introduction

### 1.1 Purpose

This SRS specifies functional and non-functional requirements for the **client application** (web), supporting **indexer/API** surfaces, and **operational UIs** implied by the PRD. It translates `ideation.md` into implementable **screens**, **components**, and **requirement IDs** for engineering and design.

### 1.2 Scope


| In scope                                                 | Out of scope                                                                    |
| -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| vite.ts frontend per §8.2                                | Smart contract implementation details (specified only where UI depends on them) |
| PXE/wallet integration, client-side proving UX           | Sequencer/prover node operation (except env config in Settings)                 |
| Indexer-backed **public** market metadata API            | Legal final sign-off (requirements listed, not legal advice)                    |
| Admin/ops surfaces for Phase 1 manual resolution & pause | Polymarket API ingestion in Phase 1 (§3.5)                                      |


### 1.3 Definitions


| Term               | Meaning                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| **PXE**            | Private Execution Environment; local private state and proof generation.                           |
| **Indexer**        | PostgreSQL-backed service exposing **public** chain events and metadata (§8.1).                    |
| **Phase 1 (P1)**   | Testnet MVP: faucet, no L1 bridge, zero fees, whitelist creators, manual resolution inputs (§5.x). |
| **Phase 2+ (P2+)** | L1 portal deposit, trading fees, bond-based creation, optional external oracle sources.            |


### 1.4 Acronyms

SRS, PRD, AMM, CPMM, LMSR, L1, L2, ZK, UI, UX, E2E, OFAC, ToS.

---

## 2. Overall Description

### 2.1 Product Perspective

The system is a **prediction market dApp** on Aztec: **private** positions and balances in-protocol; **public** market listing, odds (from public AMM state), resolution outcomes, and creator identity where the PRD requires accountability.

### 2.2 User Classes


| Class                | Description                                             | Primary screens                                          |
| -------------------- | ------------------------------------------------------- | -------------------------------------------------------- |
| **Trader**           | Connects Aztec wallet, trades, claims, manages backup   | Markets, Trade, Portfolio, Deposit (P2+), Withdraw (P2+) |
| **Creator (P1)**     | Whitelisted address creating markets                    | Create Market                                            |
| **Creator (P2+)**    | Bond-based permissionless creation                      | Create Market + bond flow                                |
| **Admin / Resolver** | Multi-sig participant, pause, void, resolution runbooks | Admin Console                                            |
| **Visitor**          | Not connected                                           | Landing, Legal, Privacy                                  |


### 2.3 Design Constraints

- **No SSR of private data** (§8.2); portfolio and balances from **PXE** only.
- **Geoblocking** at edge (§4.3, §8.2); blocked users see a dedicated screen, not a broken app.
- **Client-side proving only** for trades/claims (§4.2); no server-side prover for user secrets.
- **Market question text** for winnings UI: resolve via **indexer** using `marketId` / `questionHash` (§3.1, §2.5).

### 2.4 Assumptions

- Users have a **compatible browser** and an Aztec-capable wallet connection path supported by pinned Aztec.js (§8.4).
- **Phase 1** uses **testnet tokens** from faucet (§1.1 Option C); mainnet USDC + portal in **P2+**.

---

## 3. External Interface Requirements

### 3.1 User Interfaces

- Responsive **web** layout (desktop first; usable mobile for monitoring, proving may be slower on low-end devices).
- Accessibility: focus order, labels on forms, sufficient contrast (target WCAG 2.1 AA where feasible).

### 3.2 Hardware / Software Interfaces


| ID       | Requirement                                                                                               |
| -------- | --------------------------------------------------------------------------------------------------------- |
| **EI-1** | Application integrates with **Aztec wallet** + **PXE** per pinned SDK.                                    |
| **EI-2** | **P2+ L1 deposit:** integrate Ethereum wallet (e.g. MetaMask) for `approve` + `depositToAztecPrivate`.    |
| **EI-3** | Configurable **Aztec RPC** URL: default platform proxy + optional user override (§2.2 Metadata Option C). |
| **EI-4** | **P2+:** optional OFAC/sanctions check hook at deposit (§4.3) — UI shows pass/fail before L1 tx.          |


### 3.3 Communication Interfaces


| ID        | Requirement                                                                                         |
| --------- | --------------------------------------------------------------------------------------------------- |
| **COM-1** | Indexer REST/GraphQL API for markets list, detail, resolution status, `questionText` by `marketId`. |
| **COM-2** | No transmission of **plaintext private notes** to platform servers (§2.2 backup Option A baseline). |


---

## 4. Functional Requirements

### 4.1 Wallet & Session


| ID         | Requirement                                                                           | PRD trace |
| ---------- | ------------------------------------------------------------------------------------- | --------- |
| **FR-W-1** | User can connect Aztec wallet and see connection state (address, sync status).        | §8.2      |
| **FR-W-2** | App detects wrong network / incompatible PXE and shows recovery steps.                | §5.3      |
| **FR-W-3** | Disconnect clears **UI** state; PXE note store behavior documented in Privacy screen. | §6.1      |


### 4.2 Markets Discovery & Detail


| ID         | Requirement                                                                                                                                                             | PRD trace          |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| **FR-M-1** | Display **list** of markets from indexer: question, status, end time, implied odds (public AMM), volume if available.                                                   | §8.1               |
| **FR-M-2** | **Detail** view: full resolution criteria, resolution source, creator (public), schedule, status badge (Open / Trading halted / Awaiting resolution / Resolved / Void). | §2.5 Creator, §3.6 |
| **FR-M-3** | When `now > end_date`, show **trading disabled** and explain halt (§3.6).                                                                                               | §3.6               |
| **FR-M-4** | Show **resolution pending** + **countdown to auto-void** after grace (e.g. 72h) per §2.1 Expiry.                                                                        | §2.5 Errors        |
| **FR-M-5** | Display **privacy caveat** for AMM: size may be inferable from price moves; identity of trader not on-chain (§2.2 AMM Option C).                                        | §2.2               |


### 4.3 Trading


| ID         | Requirement                                                                                                                           | PRD trace |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| **FR-T-1** | User selects side (YES/NO), enters size; shows **estimated cost**, **slippage** warning, **fee** (0 in P1; show P2 fee when enabled). | §2.1 Fees |
| **FR-T-2** | Submit trade triggers **local proof generation** with **progress UI** (non-blocking where possible) (§4.2 Option C).                  | §4.2      |
| **FR-T-3** | On proof failure: error + **Retry** + hint to reduce size (§2.5 Errors).                                                              | §2.5      |
| **FR-T-4** | On chain revert: message + return to trade form with **prefilled** values (§2.5).                                                     | §2.5      |
| **FR-T-5** | If market **resolves** during in-flight trade: show cancellation + collateral safety message (§2.5).                                  | §2.5      |
| **FR-T-6** | **P2+:** support **chunked** trade UX if product enables multi-tx fallback (§3.2 Option E) — stepper showing step N of M.             | §3.2      |


### 4.4 Portfolio & Winnings


| ID         | Requirement                                                                                                                                          | PRD trace             |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **FR-P-1** | **Portfolio** shows **private USDC balance** and **positions** from PXE (no server aggregation of positions).                                        | §3.1                  |
| **FR-P-2** | **Winnings:** list resolved markets where user has **pending claim** or **claimed** WinningNotes; merge indexer `questionText` with local note data. | §2.5 Auto-claim, §3.1 |
| **FR-P-3** | On session start, PXE **scans** resolution events and queues **auto-claim** txs (§2.5 Option A); UI shows **Pending claim** until confirmed.         | §2.5                  |
| **FR-P-4** | **Manual claim** button as fallback if auto path fails (optional safety net; PRD prefers auto §2.5 Option C rejected as primary).                    | §2.5                  |


### 4.5 Deposit (P2+)


| ID         | Requirement                                                                                             | PRD trace  |
| ---------- | ------------------------------------------------------------------------------------------------------- | ---------- |
| **FR-D-1** | Wizard: explain L1 leaks (EOA, amount, time) and **depositSecret** backup (§1.1, §2.5).                 | §1.1, §6.3 |
| **FR-D-2** | Steps: generate secret/hash → L1 approve + `depositToAztecPrivate` → L2 private claim → success (§2.5). | §2.5       |
| **FR-D-3** | **P2+:** enforce max deposit cap if configured (§6.3).                                                  | §6.3       |


### 4.6 Faucet (P1)


| ID         | Requirement                                                                         | PRD trace     |
| ---------- | ----------------------------------------------------------------------------------- | ------------- |
| **FR-F-1** | Authenticated flow to request **testnet USDC** from faucet (within fair-use rules). | §1.1 Option C |
| **FR-F-2** | Use **sponsored FPC** on local/devnet when available to reduce fee friction (§1.3). | §1.3          |


### 4.7 Withdraw (P2+)


| ID         | Requirement                                                                 | PRD trace |
| ---------- | --------------------------------------------------------------------------- | --------- |
| **FR-X-1** | Warn that **L1 recipient and amount are public** on exit (§1.3).            | §1.3      |
| **FR-X-2** | Execute private burn + L1 message flow per Aztec token docs; show progress. | §1.3      |


### 4.8 Market Creation


| ID         | Requirement                                                                           | PRD trace      |
| ---------- | ------------------------------------------------------------------------------------- | -------------- |
| **FR-C-1** | **P1:** only **whitelisted** creators see Create Market; others see explanation.      | §2.5 Creator A |
| **FR-C-2** | Form: question, resolution criteria, end date, resolution source, bond amount (§2.5). | §2.5           |
| **FR-C-3** | Submit creation + liquidity bond tx; show success with **market id** + link.          | §2.1 Liquidity |
| **FR-C-4** | **P2+:** bond-based open creation without whitelist (§2.5 Creator B).                 | §2.5           |


### 4.9 Backup & Recovery


| ID         | Requirement                                                                                      | PRD trace |
| ---------- | ------------------------------------------------------------------------------------------------ | --------- |
| **FR-B-1** | **Export** encrypted note backup file (§2.2 Option A).                                           | §2.2      |
| **FR-B-2** | **Import** backup to restore PXE notes.                                                          | §2.2      |
| **FR-B-3** | **Persistent banner** until user acknowledges backup or completes export (§6.1).                 | §6.1      |
| **FR-B-4** | **P2:** optional encrypted remote sync UI (§2.2 Option B) — if built, E2E encrypt before upload. | §2.2      |


### 4.10 Legal & Compliance (UI)


| ID         | Requirement                                                                | PRD trace |
| ---------- | -------------------------------------------------------------------------- | --------- |
| **FR-L-1** | **ToS** and **Risk** pages linked from footer and before first trade.      | §4.3      |
| **FR-L-2** | **Privacy model** page: L1 visibility, AMM leakage, metadata (§1.1, §2.2). | §1.1–§2.2 |
| **FR-L-3** | **Geo-block** screen when middleware blocks jurisdiction (§4.3, §8.2).     | §4.3      |


### 4.11 Admin Console (restricted)


| ID         | Requirement                                                                                                            | PRD trace   |
| ---------- | ---------------------------------------------------------------------------------------------------------------------- | ----------- |
| **FR-A-1** | View markets needing resolution / in grace / void-eligible.                                                            | §5.2 Keeper |
| **FR-A-2** | **Resolution** workflow aligned with M-of-N (may be “export payload for Safe” + status tracking if no on-app signing). | §3.3        |
| **FR-A-3** | **Dispute window** status per market (§2.1).                                                                           | §2.1        |
| **FR-A-4** | **Emergency pause** / migration messaging when protocol paused (§3.4).                                                 | §3.4        |
| **FR-A-5** | **Phase 1:** curated resolution input (internal DB/CSV) — no Polymarket API (§5.2, §3.5).                              | §5.2        |


---

## 5. UI Specification — Screens

### 5.1 Navigation Map (logical)

```text
[Landing] ──► [Markets] ──► [Market Detail] ──► [Trade]
                    │              │
                    │              └──► [Creator public info]
                    │
[Portfolio] ◄── (shell) ──► [Settings]
     │
     ├── [Winnings / Claims]
     └── [Backup & Recovery]

[P1: Faucet]          [P2+: Deposit] [P2+: Withdraw]

[Legal: ToS] [Privacy] [Risk]

[Geo-blocked] (standalone)

[Admin Console] (role-gated, separate layout optional)
```

### 5.2 Screen Catalog


| #   | Screen ID            | Name                              | Actor        | Purpose                                         | Primary FRs  |
| --- | -------------------- | --------------------------------- | ------------ | ----------------------------------------------- | ------------ |
| S01 | `SCR-LANDING`        | Landing                           | Visitor      | Value prop, CTA connect, links to legal/privacy | FR-L-*       |
| S02 | `SCR-MARKETS`        | Markets browse                    | Trader       | Indexer-driven grid/list of markets             | FR-M-1       |
| S03 | `SCR-MARKET-DETAIL`  | Market detail                     | Trader       | Odds, rules, halt/pending/void UI               | FR-M-2–5     |
| S04 | `SCR-TRADE`          | Trade                             | Trader       | Build & submit private trade + proof UX         | FR-T-*       |
| S05 | `SCR-PORTFOLIO`      | Portfolio overview                | Trader       | Private balance + positions summary             | FR-P-1       |
| S06 | `SCR-WINNINGS`       | Winnings & claims                 | Trader       | Pending/claimed winnings + claim actions        | FR-P-2–4     |
| S07 | `SCR-FAUCET`         | Get test funds                    | Trader (P1)  | Request testnet tokens                          | FR-F-*       |
| S08 | `SCR-DEPOSIT`        | Deposit (L1→L2)                   | Trader (P2+) | Portal flow + warnings                          | FR-D-*       |
| S09 | `SCR-WITHDRAW`       | Withdraw (L2→L1)                  | Trader (P2+) | Public exit warnings + flow                     | FR-X-*       |
| S10 | `SCR-CREATE-MARKET`  | Create market                     | Creator      | Form + bond tx                                  | FR-C-*       |
| S11 | `SCR-SETTINGS`       | Settings                          | Trader       | RPC, backup, advanced                           | FR-B-*, EI-3 |
| S12 | `SCR-BACKUP`         | Backup / Import                   | Trader       | Export/import encrypted notes                   | FR-B-1,2     |
| S13 | `SCR-PRIVACY`        | Privacy & model                   | All          | Honest disclosure                               | FR-L-2       |
| S14 | `SCR-TOS`            | Terms of Service                  | All          | Legal                                           | FR-L-1       |
| S15 | `SCR-RISK`           | Risk disclosure                   | All          | Legal                                           | FR-L-1       |
| S16 | `SCR-GEO-BLOCK`      | Jurisdiction blocked              | Visitor      | Explain block                                   | FR-L-3       |
| S17 | `SCR-NETWORK-ERROR`  | Wrong network / PXE               | Trader       | Fix instructions                                | FR-W-2       |
| S18 | `SCR-PROOF-PROGRESS` | Proof in progress (modal or full) | Trader       | Progress, non-blocking hint                     | FR-T-2, §4.2 |
| S19 | `SCR-ADMIN-HOME`     | Admin dashboard                   | Admin        | Ops overview                                    | FR-A-1       |
| S20 | `SCR-ADMIN-MARKET`   | Admin market ops                  | Admin        | Resolution/dispute/void                         | FR-A-2–5     |
| S21 | `SCR-MAINTENANCE`    | Protocol paused                   | All          | Explain pause + migration links if any          | FR-A-4, §3.4 |


**Optional P2 screens**


| #   | Screen ID               | Name                    | Notes            |
| --- | ----------------------- | ----------------------- | ---------------- |
| S22 | `SCR-FEE-SETTINGS`      | Fee preview preferences | When AMM fees on |
| S23 | `SCR-COMMUNITY-PROPOSE` | Propose market          | §3.5 Option C    |


---

## 6. UI Component Library (Required)

Components are **logical**; implementation in React + design system of choice.

### 6.1 Shell & Layout


| Component ID       | Responsibility                                          |
| ------------------ | ------------------------------------------------------- |
| `CMP-APP-SHELL`    | Header, nav, footer, disclaimer slot                    |
| `CMP-NAV-PRIMARY`  | Markets, Portfolio, Create (if allowed), Faucet/Deposit |
| `CMP-FOOTER-LEGAL` | ToS, Privacy, Risk links                                |


### 6.2 Wallet & Chain


| Component ID           | Responsibility                        |
| ---------------------- | ------------------------------------- |
| `CMP-WALLET-CONNECT`   | Connect / disconnect Aztec wallet     |
| `CMP-NETWORK-STATUS`   | Chain/RPC/PXE health indicator        |
| `CMP-L1-WALLET-PROMPT` | P2+ MetaMask (or similar) for deposit |


### 6.3 Market Display


| Component ID              | Responsibility                              |
| ------------------------- | ------------------------------------------- |
| `CMP-MARKET-CARD`         | List item: title, odds, status, end time    |
| `CMP-MARKET-STATUS-BADGE` | Open / Halted / Resolving / Resolved / Void |
| `CMP-ODDS-DISPLAY`        | YES/NO prices from **public** state         |
| `CMP-COUNTDOWN`           | End date + grace void countdown             |
| `CMP-CREATOR-LINE`        | Public creator address + optional label     |


### 6.4 Trading


| Component ID           | Responsibility                          |
| ---------------------- | --------------------------------------- |
| `CMP-TRADE-FORM`       | Side, size, validation                  |
| `CMP-SLIPPAGE-WARNING` | Dynamic warning from AMM math           |
| `CMP-FEE-LINE`         | P1 zero; P2 fee breakdown               |
| `CMP-PROOF-PROGRESS`   | Steps, elapsed time, cancel/retry rules |
| `CMP-TX-STATUS`        | Submitted / included / failed           |


### 6.5 Portfolio


| Component ID               | Responsibility                              |
| -------------------------- | ------------------------------------------- |
| `CMP-BALANCE-PRIVATE`      | USDC from PXE                               |
| `CMP-POSITION-LIST`        | Local notes aggregated by market            |
| `CMP-WINNING-ROW`          | Amount, question (indexer), date, claim CTA |
| `CMP-PENDING-CLAIM-BANNER` | Aggregate pending claims                    |


### 6.6 Deposit / Withdraw


| Component ID           | Responsibility      |
| ---------------------- | ------------------- |
| `CMP-DEPOSIT-WARNING`  | EOA + secret backup |
| `CMP-DEPOSIT-STEPPER`  | L1 → L2 steps       |
| `CMP-WITHDRAW-WARNING` | L1 public exit      |


### 6.7 Safety & Legal


| Component ID                  | Responsibility                    |
| ----------------------------- | --------------------------------- |
| `CMP-BACKUP-BANNER`           | Until dismissed per policy (§6.1) |
| `CMP-PRIVACY-CALLOUT`         | Short AMM + L1 leakage            |
| `CMP-ERROR-BOUNDARY-FALLBACK` | Generic failure                   |
| `CMP-TOAST`                   | Errors, successes                 |
| `CMP-CONFIRM-DIALOG`          | Destructive / high-risk actions   |


### 6.8 Admin


| Component ID                  | Responsibility                |
| ----------------------------- | ----------------------------- |
| `CMP-ADMIN-MARKET-TABLE`      | Filters by resolution state   |
| `CMP-ADMIN-RESOLUTION-ACTION` | Triggers runbook / tx builder |


---

## 7. Non-Functional Requirements (Summary)


| Area              | Requirement                                                             | PRD trace   |
| ----------------- | ----------------------------------------------------------------------- | ----------- |
| **Performance**   | Benchmark p50/p95 proof times; UI tolerates ≥30s with progress (§4.2).  | §4.2, §7    |
| **Security**      | No private note plaintext on servers; separate admin keys (§6.2).       | §6.2, COM-2 |
| **Reliability**   | Graceful degradation if indexer down (cached read-only or error state). | §8.1        |
| **Compliance**    | Geo + ToS before trade; OFAC hook P2+ (§4.3).                           | §4.3        |
| **Observability** | Sentry on frontend; no PII in logs for private flows (§8.3).            | §8.3        |


---

## 8. Traceability Matrix (Excerpt)


| Screen       | Key FRs        |
| ------------ | -------------- |
| S04 Trade    | FR-T-1–6       |
| S06 Winnings | FR-P-2–4       |
| S08 Deposit  | FR-D-1–3       |
| S11 Settings | FR-B-1–3, EI-3 |
| S19–20 Admin | FR-A-1–5       |


---

## 9. Revision History


| Version | Date       | Notes                                                          |
| ------- | ---------- | -------------------------------------------------------------- |
| 1.0     | 2026-04-09 | Initial SRS from `ideation.md` v1.2 + Aztec alignment research |


---

*End of SRS*