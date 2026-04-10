# PRD Issue Resolutions & Options


**How to use:**
- `[ ]` = undecided (default)
- `[x]` = selected
- ~~strikethrough~~ = rejected
- Edit or add bullet points freely to fit your intent.

---

## 1. Product Overview

---

### 1.1 Cross-chain Bridges & Entry-Point Privacy

**Context:** Mainstream prediction markets (e.g. Polymarket-class) run on **public** chains: trades, timing, and balances are observable or inferable; bridging from L1/L2 leaks **amount, timing, and usually the funding EOA**. [WakeUp Labs](https://www.wakeuplabs.io/blog/on-prediction-markets-and-privacy) publicly argues for **private** prediction markets and experiments with **Aztec** (“Aztec Markets”) — they are **not** documented in primary sources as having shipped a **zkSync-native** PM; use that framing in external comms only if you have a cite. **Goal:** be precise about what privacy we actually get (especially at L1) and improve **in-protocol** privacy vs transparent PMs.

**The Core Tension:** Every L2 (including Aztec) ultimately settles to L1 (Ethereum). A typical L1 deposit shows **sending address**, **amount**, **timing**, and **portal/pool contract**. Aztec’s **private consume** path hides the **Aztec recipient** linked via `secretHash`; it does **not** hide a bare `tx.from` on Ethereum. Privacy for positions/trades is **after** funds are claimed on L2. The question is: *what L1 leakage do we accept, and what optional mitigations (relayers, fixed denominations, delays) are in scope later?*

---

#### Option A — Aztec Native Portal with Secret Hash (Partial Privacy at Entry)
Use Aztec's canonical Token Portal (the L1↔L2 bridge built into Aztec). The user approves USDC on L1 and calls `depositToAztecPrivate(amount, secretHash)`. The bridge contract on L1 holds the tokens and emits a public event showing the *amount* deposited to *the platform contract address* — but the Aztec recipient is hidden behind the `secretHash`. Nobody on L1 can link the deposit to a specific Aztec wallet.

- **Pros:** Native Aztec primitive — no third-party trust; recipient identity is cryptographically hidden on L1; supported from day one by Aztec tooling.
- **Cons:** Deposit *amount*, *timing*, and **L1 `msg.sender`** are visible; adversaries can correlate and may infer Aztec activity heuristically.
- **Differentiator vs transparent PMs:** Interior Aztec state uses **private notes**; L1 still leaks EOA + amount + time unless you add **relayer / mixer-style** flows (out of scope unless explicitly scheduled).

**[ ] RECOMMENDED for Phase 2+ (Mainnet)**

---

#### Option B — Pooled Deposit UX (Canonical Bridge Under the Hood)
**Product UX:** One shared **platform** entry (single portal/pool address and consistent copy). **Implementation:** Still use Aztec’s **L1→L2 inbox** and **Token Portal** semantics — tokens are held on L1 by the portal, an **L1→L2 message** carries content + `secretHash`, and on L2 the user **consumes** the message in a **private** function to mint/spend into private notes. You cannot rely on a raw `ERC20.transfer` to a pool + arbitrary calldata alone to mint on Aztec; the **messaging + consumption path** is what creates L2 balances.

**Reference flow (aligned with Aztec docs):**
1. User generates `depositSecret` in the client (`computeSecretHash` / PXE helpers).
2. User approves USDC and calls `depositToAztecPrivate(amount, secretHash)` on the **TokenPortal** (optionally behind a thin “PlatformPool” router that forwards to the same portal/inbox API).
3. **L1 visibility:** `msg.sender`, **amount**, **timing**, portal contract — all public. **Not** visible on L1: which **Aztec address** will claim (requires preimage of `secretHash` to consume on L2).
4. On L2, the user’s wallet **submits a private tx** that consumes the L1 message with `depositSecret` and receives **private USDC notes**.
5. **Chain observers** without the secret cannot cryptographically derive the Aztec recipient; **heuristic** linking (amount/time/graph) remains. **Platform ops:** if you run RPC, analytics, or support flows, treat **operational correlation** as a separate threat (§2.2 Metadata).

- **Pros:** Same **protocol-native** security as Option A; UX feels like “deposit to the platform”; Aztec recipient hidden from L1 calldata.
- **Cons:** **L1 EOA still public** unless you add relayers; `depositSecret` backup is mandatory; shared portal address ≠ Tornado-scale **anonymity set** without extra mechanics.
- **Realistic differentiator:** Private **positions/settlement inside Aztec** vs fully public PM ledgers — not “no one can tell who deposited on L1.”

**[x] RECOMMENDED — Canonical deposit model for mainnet (Phase 1 testnet: Option C; Phase 2+: implement portal flow as above)**

---

#### Option C — No L1 Bridge in Phase 1 (Testnet Native Tokens)
Phase 1 uses Aztec's testnet native token (test USDC minted via faucet). No L1 bridge exists. Users just call the faucet and get testnet tokens on Aztec directly. Privacy at entry is a non-issue because there is no L1.

- **Pros:** Zero bridge complexity in Phase 1; pure Aztec-native privacy from day one; fastest path to MVP.
- **Cons:** Only works on testnet; defers the bridge architecture decision; users have no transferable skills to mainnet flow.

**[x] RECOMMENDED for Phase 1 (Testnet MVP) — combine with Option B for later phases**

**Note:** On **local/devnet**, prefer Aztec **sponsored fee payment (FPC)** where documented (§1.3) so testers are not blocked by fee UX during contract iteration.

---

#### Option D — Accept Public Entry Point, Private Interior (Honest Positioning)
Acknowledge openly: "Your deposit is public; everything inside is private." This is the approach most Aztec protocols take today. The privacy guarantee is *interior* — positions, trades, and balances inside the platform are hidden, but the fact that you deposited is not.

- **Pros:** Honest; simple to implement; no extra engineering; matches how Aztec itself describes its privacy model.
- **Cons:** Weakens the “fully private” narrative; **L1 entry** matches what most Aztec apps disclose today; differentiate on **in-network** privacy and honest docs.

**[ ] Consider this only as a fallback if Option B proves too complex**

---

### 1.2 WakeUp Labs & Transparent PMs (Differentiation)

**Public record (verify before marketing):**
- WakeUp builds across **EVM L2s** (e.g. Optimism, Arbitrum) and discusses **prediction markets + privacy**; their post *On Prediction Markets and Privacy* positions **Aztec** and “Aztec Markets” for **private** PM experiments — not a cited **zkSync PM** ship.
- **Typical** Polymarket-class products: **public** chain state / observability for activity; privacy limits are largely **pseudonymity + off-chain UX**, not Aztec-grade private state.

**How this project differentiates (intended architecture):**

| Feature | Transparent PM (incl. most public EVM deployments) | Aztec Private Markets (this PRD) |
|---|---|---|
| Position visibility | Public or inferable | Target: hidden in private notes |
| Trade history | On-chain, readable | Target: zero-knowledge interior |
| Wallet balance (in-app) | Public | Target: private notes |
| Proof generation | N/A or server-assisted | Target: client-side via PXE |
| L1 deposit | EOA + amount + time leaked | Same L1 leaks unless relayers; **Aztec recipient** hidden via portal `secretHash` pattern |
| Native private state on L2 | No | Yes (Aztec note model) |

**Recommendation:** In the shipped PRD intro, state clearly: **L1 funding is visible**; **differentiation is private trading/settlement on Aztec** and honest metadata posture (§2.2). Cite WakeUp only for **their published Aztec/privacy PM direction**, not an unverified chain list.

---

### 1.3 Aztec Platform Alignment (What Exists vs What We Build)

**Authoritative sources:** [Aztec documentation](https://docs.aztec.network/), monorepo [**AztecProtocol/aztec-packages**](https://github.com/AztecProtocol/aztec-packages), public [roadmap](https://aztec.network/roadmap). Pin your toolchain to a **released** tag + npm versions (§8.4); docs move faster than assumptions.

#### Strongly supported (use as default primitives)

| Capability | Implication for this product |
|------------|------------------------------|
| **Local network** (Anvil-class L1 + Aztec + prefunded accounts) | Phase 1 fastest iteration; no L1 bridge required with Option C (§1.1). |
| **Noir + Aztec.nr** — private and public functions, private internal calls | `PrivateVault`, note transfers, private trade execution inside one tx bundle. |
| **Aztec.js + PXE** | Client-side proving, wallets, deployment — matches core privacy story. |
| **L1↔L2 messaging + Token Portal** | Canonical USDC entry/exit; **private claim** on L2 with `secretHash` (§1.1 Option B, §2.5). |
| **Composability (private → private)** | Split logic across contracts; keep oracle/AMM boundaries explicit. |

#### Constraints to design around (not negotiable with “wording”)

| Constraint | Design response |
|------------|-----------------|
| **L1 `msg.sender` + amount + time** on portal deposits | Disclose honestly; optional future: relayers / mixers (explicit scope only). |
| **L1 withdrawals** — standard exits expose **amount + L1 recipient** on Ethereum (bridging docs) | Withdraw UX copy and compliance; not a bug — plan messaging. |
| **`enqueue` public calls from private execution** | Observable side effects — use for **oracle settles, AMM state updates** deliberately; minimize gratuitous public calls. |
| **Circuit / tx complexity ceilings** | Large LMSR-in-one-tx may fail; split flows, simplify ops per tx, or use **recursive verification** (§3.2, §4.2). |

#### Fee UX (test vs production)

- **Sponsored Fee Payment Contract (FPC)** — documented for **local + devnet**; **not** the long-term mainnet fee story per current [fee payment docs](https://docs.aztec.network/developers/docs/aztec-js/how_to_pay_fees). **Use in Phase 1** to reduce tester friction; **plan user-paid or alternate mainnet fee path** before launch.

#### Ecosystem leverage (reduce custom surface area)

| Resource | Use |
|----------|-----|
| [aztec-starter](https://github.com/AztecProtocol/aztec-starter) | Greenfield repo layout + conventions. |
| [aztec-examples](https://github.com/AztecProtocol/aztec-examples) | Contract patterns beyond the token bridge. |
| [yarn-project/end-to-end](https://github.com/AztecProtocol/aztec-packages/tree/master/yarn-project/end-to-end) (in monorepo) | Integration test style for Aztec.js + networks. |
| [defi-wonderland/aztec-standards](https://github.com/defi-wonderland/aztec-standards) | Token + DeFi primitives; evaluate compatibility before reinventing. |

**Protocol ops (later):** docs describe **sequencer** and **prover** operation for decentralized networks — relevant when you leave “local only”; not Phase 1 blockers for app MVP.

---

## 2. Core Features & Requirements

---

### 2.1 Market Lifecycle — Dispute Mechanism

**Issue:** No dispute mechanism. A single bad admin resolution can destroy trust permanently.

#### Option A — Time-locked Resolution with Challenge Window
After the admin calls `resolve(outcome)`, a 24–48 hour window opens before settlement finalises. Any whitelisted challenger (or any token holder) can call `dispute()` with a bond, which pauses settlement and escalates.

- **Pros:** Simple; native to the contract; no external dependencies; gives users time to react to bad resolutions.
- **Cons:** Adds 24–48h delay to all settlements; requires challenge bond management.

**[x] RECOMMENDED for Phase 1**

---

#### Option B — Multi-sig Resolution (M-of-N Admin Committee)
Resolution requires M signatures from N trusted admins (e.g., 3-of-5). No single admin can resolve incorrectly without collaborators.

- **Pros:** Immediate settlement (no waiting); addresses single-point-of-failure risk.
- **Cons:** Still centralised; all signers could collude; doesn't help users who disagree with the outcome.
- **Implementation note:** Aztec has no native multi-sig. Two buildable paths: (a) Custom Noir multi-sig account contract on L2 using AuthWit pattern for signature delegation. (b) L1 Gnosis Safe for oracle resolution on L1, bridging the result to Aztec L2 via portal messages.

**[x] Combine with Option A (multi-sig initiates resolution, time-lock allows challenge)**

---

#### Option C — UMA Optimistic Oracle (Phase 3, already in roadmap)
Use UMA's dispute resolution system where anyone can dispute a resolution by posting a bond, and UMA token holders arbitrate.

- **Pros:** Fully decentralised; battle-tested; aligns with Phase 3 roadmap.
- **Cons:** Significant cross-chain engineering (~4-8 weeks); not available for Phase 1. Buildable path: UMA stays on Ethereum L1, resolution results are bridged to Aztec L2 via L1→L2 portal messages (see §3.3 Option C for details).

**[ ] Adopt in Phase 3 as planned**

---

### 2.1 Market Lifecycle — Liquidity Initialisation

**Issue:** Who seeds the AMM at market creation? Without initial liquidity, the first trade is exploitable or has infinite slippage.

#### Option A — Creator-Provided Bootstrap Liquidity (Bond Model)
When a market is created, the creator must deposit a minimum liquidity bond (e.g., 500 USDC) to seed the AMM. This bond is locked until market resolution and returned to the creator minus fees.

- **Pros:** Aligns creator incentives with market quality; no platform treasury required; simple.
- **Cons:** Barrier to market creation; creator bond is locked capital.

**[x] RECOMMENDED**

---

#### Option B — Platform Treasury Seeds All Markets
The platform maintains a treasury and automatically seeds every market with an initial liquidity amount at 50/50 odds.

- **Pros:** Lower barrier to market creation; consistent starting liquidity.
- **Cons:** Requires platform to hold and risk capital; treasury needs to be funded; not sustainable at scale.

**[ ] Acceptable for Phase 1 testnet only (use testnet tokens from faucet)**

---

#### Option C — LP Incentive Programme
Announce an LP rewards programme where LPs who seed markets early earn bonus shares or a fee multiplier. Recruit early LPs before launch.

- **Pros:** Community-driven; scalable; aligns LP interest with platform growth.
- **Cons:** Requires token or fee rewards; complex to design; not Phase 1 material.

**[ ] Phase 2 feature**

---

### 2.1 Market Lifecycle — Market Expiry Without Resolution

**Issue:** What if a market's end date passes but the oracle hasn't resolved it?

#### Option A — Expiry Grace Period + Auto-Void
After end date, a grace period (e.g., 72 hours) begins. If oracle does not resolve within this window, the market is voided: all users get their collateral back, no winners.

- **Pros:** Clear, user-protective; prevents permanent fund lock.
- **Cons:** Requires refund logic in PrivateVault; voiding a large market is complex.

**[x] RECOMMENDED**

---

#### Option B — Keeper Bot Triggers Emergency Void
The keeper bot monitors for expired-unresolved markets and calls `voidMarket()` after the grace period.

- **Pros:** Automated; no user action needed.
- **Cons:** Keeper bot reliability is a dependency; if bot is down, markets stay stuck.

**[x] Combine with Option A (bot enforces, contract allows manual void too)**

---

### 2.1 Market Lifecycle — Fee Structure

**Issue:** Even a 0% fee is a design decision that must be explicit. Without fees, there is no incentive for LPs.

#### Option A — Fixed Protocol Fee (e.g., 2% of winnings)
A fixed percentage of gross winnings is taken as a protocol fee at settlement.

- **Pros:** Simple; predictable; aligns with standard prediction market models.
- **Cons:** Discourages participation if fee is too high; doesn't reward LPs directly.

**[ ] Consider for Phase 2**

---

#### Option B — AMM Trading Fee (e.g., 0.3% per swap)
Every buy/sell on the AMM incurs a small fee, credited to LPs in the pool.

- **Pros:** Industry-standard (Uniswap model); directly rewards LPs; incentivises liquidity.
- **Cons:** More complex AMM accounting; private fees need to stay private.

**[x] RECOMMENDED for Phase 2+**

---

#### Option C — Zero Fees in Phase 1 (Testnet)
No fees during testnet to maximise test participation.

- **Pros:** Simpler testnet implementation; better UX for testers.
- **Cons:** No LP incentive signals; cannot validate fee mechanics.

**[x] Adopt for Phase 1, implement fees in Phase 2**

---

### 2.2 Privacy — Note/PXE Recovery

**Issue:** PXE stores private notes in the browser. If the user clears their browser or switches devices, they lose their notes — and therefore their funds.

#### Option A — Encrypted Note Export (Backup File)
Users can export their private notes as an encrypted JSON file (encrypted with their account key). They import this on a new device/browser to restore their portfolio.

- **Pros:** Simple; no server dependency; similar to MetaMask seed phrase export.
- **Cons:** Users must remember to export; lost backup = lost funds; UX friction.

**[x] RECOMMENDED as minimum baseline for Phase 1**

---

#### Option B — Encrypted Remote Note Sync
Notes are encrypted client-side and synced to a backend storage service (S3, IPFS, or centralised DB). User authenticates with their Aztec key to pull notes on any device.

- **Pros:** Seamless cross-device experience; no manual export.
- **Cons:** Requires backend storage; backend must never see plaintext notes; additional attack surface.

**[ ] Phase 2 feature**

---

#### Option C — Derive Notes Deterministically from Account Key
If note values can be rederived from the user's account key (seed phrase) without external storage, recovery is automatic — import your seed phrase, get all notes back.

- **Pros:** Best UX; no backup files; same model as standard crypto wallets.
- **Cons:** There is no "v5" — Aztec is on SDK v4.x (alpha-testnet). Current note discovery uses PXE **trial-decryption** of on-chain encrypted logs when an account is re-registered from `(secret, salt)` via `instantiateAccount`. This recovers all notes without manual backup, **but only if the user retains their account secret**. Full deterministic derivation of all note values from a single seed is not yet a documented Aztec primitive — check upstream roadmap.

**[x] Investigate first — if Aztec adds full deterministic note derivation, it supersedes other backup options. Current fallback: PXE re-registration + trial-decryption recovers notes from on-chain logs.**

---

### 2.2 Privacy — Metadata Leakage

**Issue:** IP addresses, transaction timing, and network patterns can deanonymize users even if on-chain data is fully private.

#### Option A — Tor / VPN Guidance (User Responsibility)
Document clearly that users should use Tor or a VPN. The platform makes no infrastructure changes.

- **Pros:** Zero engineering effort.
- **Cons:** Shifts burden to users; low compliance; weak privacy narrative.

**[ ] Minimum baseline only**

---

#### Option B — Aztec RPC via Relay / Proxy
Route all Aztec RPC calls through a platform-managed proxy that strips IP headers. Users interact with the proxy, not directly with the Aztec node.

- **Pros:** Platform-level protection; transparent to users.
- **Cons:** Proxy itself becomes a deanonymization risk (platform sees IPs); adds infrastructure.

**[ ] Acceptable only if proxy does not log IPs**

---

#### Option C — Support Multiple RPC Endpoints + Encourage User-Run PXE
Allow users to configure their own Aztec node URL. Advanced users can run a local PXE node, eliminating all metadata leakage.

- **Pros:** Power-user option; strong privacy; aligns with decentralisation ethos.
- **Cons:** Too complex for average users.

**[x] RECOMMENDED — offer default proxy (non-logging) + custom RPC option for advanced users**

---

### 2.2 Privacy — AMM Price Impact Leakage

**Issue:** Large private trades still move the **public** AMM price (or state derived from it), allowing adversaries to infer position sizes from price movements. **Related:** public updates via Aztec **`enqueue`** are deliberately observable — minimize unnecessary public writes (§1.3).

#### Option A — Batch Execution with Delayed Price Update
Buffer trades over a time window (e.g., 1 block or 30 seconds) and execute them in batch, updating the AMM price once for the aggregate. Individual contributions are hidden within the batch.

- **Pros:** Hides individual trade sizes; adds meaningful privacy over raw per-trade updates.
- **Cons:** Adds latency to price discovery; batch size must be large enough to provide anonymity; complex to implement.

**[ ] Phase 2 consideration**

---

#### Option B — Commit-Reveal Scheme for Trades
Users commit to a trade (publish a hash) first, then reveal and execute in a later block. Price impact is only visible after the reveal window.

- **Pros:** Prevents front-running; adds a step of indirection.
- **Cons:** Two-transaction UX is friction; timing correlation still possible at reveal step.

**[ ] Evaluate in Phase 2**

---

#### Option C — Accept and Document the Leakage
Clearly state in the privacy model: "Individual trade amounts may be inferable by sophisticated on-chain analysis of AMM price movements. Position *identity* (who traded) is fully hidden; position *size* may be approximated." This is honest and accurate for most current hybrid AMM+privacy systems.

- **Pros:** Honest; no engineering overhead; standard for hybrid models.
- **Cons:** Weakens the "complete privacy" claim.

**[x] RECOMMENDED for Phase 1 — document it clearly; improve in Phase 2 with batching**

---

### 2.5 User Flows — Deposit Flow (Portal / Pooled UX)

**Architecture:** L2 balances come from **consuming an L1→L2 message** after `depositToAztecPrivate` (or equivalent) on the **TokenPortal**. An **optional** L1 router contract may wrap the same call for “deposit to platform” UX; it must not replace inbox semantics.

**Recommended Implementation:**

```
Step 1: User opens deposit flow in UI
Step 2: Client/PXE generates depositSecret and secretHash (Aztec.js helpers)
Step 3: UI instructs: approve USDC + call depositToAztecPrivate(amount, secretHash) on portal (or router → portal)
Step 4: User submits L1 tx from their wallet (MetaMask, etc.) — tx.from is public
Step 5: L1: tokens locked in portal; message enqueued for L2 with content hash + secretHash
Step 6: User (or app) on Aztec builds a private tx that consume_l1_to_l2_message / private claim with depositSecret
Step 7: Token bridge + token contract mint to user's private balance per app logic
Step 8: Portfolio shows USDC as private notes
```

**Privacy guarantees (precise):**
- **Public on L1:** funding wallet (`msg.sender`), amount, time, portal/router address.
- **Hidden from L1:** which **Aztec address** claims (without `depositSecret`).
- **Heuristics:** same-amount/same-block clustering can weaken pseudonymity; **platform** may correlate via infra (mitigate per §2.2).
- **Cryptographic:** third parties without the secret cannot complete the L2 claim; this is **not** proof that two people cannot *suspect* linkage from off-chain data.

**Options for the L1 entry contract:**

#### Option A — Aztec Canonical Token Portal (Recommended)
Use Aztec's built-in L1 token portal and Aztec L2 token bridge contract. Audited path; documented in [token bridge tutorial](https://docs.aztec.network/dev/developers/tutorials/js_tutorials/token_bridge).

**[x] RECOMMENDED**

---

#### Option B — Custom L1 Router + Same Portal
Thin contract that forwards deposits to the canonical portal for unified **platform** address UX. **Do not** bypass inbox/message passing.

**[ ] Only if product needs custom accounting; security review required**

---

### 2.5 User Flows — Auto-Claiming Winnings

**Based on your description:** When a market resolves, winnings should automatically be credited to the user's platform account, tagged by market, and available for withdrawal anytime.

**Privacy tension to resolve:** Auto-claiming requires knowing who won. But winning positions are in private notes — the platform cannot read them. There are two architectures:

#### Option A — Client-Side Auto-Claim (PXE-Driven, RECOMMENDED)
When a market resolves, the resolution event is emitted publicly on-chain. The next time the user's PXE is active (browser open, or a background service tab), it:
1. Detects the resolved market via public event.
2. Checks locally whether the user holds any YES/NO notes for that market.
3. If they do, automatically generates a ZK proof and submits the vault’s **claim** transaction (contracts perform mint/split of WinningNotes).
4. The claim settles winnings into new private USDC + **WinningNote** (see §3.1; UI text may load `marketQuestion` from indexer, not only from note).
5. UI displays the new note in the "Portfolio → Winnings" section.

- **Pros:** Fully private — platform never sees who won; no server-side processing of private data; automatic from user perspective.
- **Cons:** Only works when the user's browser/PXE is active; if offline at resolution, claim is queued until next login.
- **Mitigant:** Show "Pending claim" UI when user logs back in and has unclaimed winning notes.

**[x] RECOMMENDED**

---

#### Option B — Pre-Authorised Claim Proof (Delegated Claim)
At time of placing a bet, the user's PXE pre-generates a "claim authorisation note" that can be submitted by a keeper on their behalf at resolution time. The keeper proves the claim without knowing the user's identity.

- **Pros:** Truly automatic even when user is offline; gasless for the user.
- **Cons:** Complex cryptography; requires Aztec's note delegation to be mature; significant engineering effort.

**[ ] Phase 3 feature — research Aztec note delegation / AuthWit-based claim delegation as SDK matures**

---

#### Option C — User-Initiated Manual Claim
User must log in after resolution and click "Claim Winnings." No automation.

- **Pros:** Simplest to implement; no timing dependencies.
- **Cons:** Poor UX; user may miss claims; doesn't match your stated requirement.

**[ ] Only as fallback if Option A is blocked**

---

**Winnings Display Requirement (from your input):**
UX shows `{ marketId, marketQuestion, amountWon, resolvedDate }` — **on-chain note** carries `questionHash` + amounts + ids; **marketQuestion** string comes from **indexer/metadata** keyed by `marketId` / hash. Example UI:
```
Winnings Available:
 +$42.50 — "Will BTC exceed $100k by Jan 2027?" — resolved Apr 7, 2026
 +$15.00 — "Will ETH ETF pass in 2026?" — resolved Apr 2, 2026
```

---

### 2.5 User Flows — Market Creator Flow

**Issue:** No flow defined for creating a market.

**Recommended Flow:**
```
1. Creator connects Aztec wallet
2. Fills in: market question, resolution criteria, end date, resolution source
3. Deposits liquidity bond (see §2.1 Liquidity Init)
4. Signs a creation transaction (goes through MarketFactory)
5. Market appears publicly with 50/50 starting odds
6. Creator is listed as "creator" (public) for accountability
```

**Creator approval options:**

#### Option A — Admin Whitelist
Only pre-approved addresses can create markets. Admin maintains the whitelist.

- **Pros:** Full quality control; prevents spam.
- **Cons:** Centralised; bottleneck; doesn't scale.

**[x] Phase 1 only**

---

#### Option B — Bond-Based Open Creation
Anyone can create a market by posting a bond. Bond is returned if market resolves cleanly; forfeited if market is voided as invalid.

- **Pros:** Permissionless; scales; aligns incentives.
- **Cons:** Bond size needs calibration; some bad markets will still be created.

**[x] Target for Phase 2/3**

---

### 2.5 User Flows — Error & Edge Case Flows

**Missing from PRD. Recommended flows to define:**

| Scenario | Recommended Handling |
|---|---|
| ZK proof generation fails | Show error with retry button; log client-side details; offer "simplify trade" suggestion (smaller amount = faster proof) |
| Transaction reverted on-chain | Show descriptive error; return user to trade screen with pre-filled values |
| Market resolved while trade is in-flight | Transaction reverts at contract level; user gets collateral back; UI shows "Market has resolved, trade cancelled" |
| User disconnects mid-proof | Local state persists in PXE; on reconnect, resume or restart the pending proof |
| Deposit secret lost before claim | Funds are permanently unrecoverable without the secret; show prominent warning during deposit flow; recommend backup |
| Oracle offline at market end | Grace period triggers; after 72h show "Resolution pending" UI with countdown to auto-void |

---

## 3. System Architecture

---

### 3.1 PrivateVault Note Schema

**Issue:** Most security-critical contract has no note schema defined.

**Recommended Note Types:**

Notes in Aztec.nr use the `#[note]` macro, which auto-generates the note hash, nullifier, and randomness (nonce). You do **not** manually add a `nonce` field — the framework injects and manages it. Noir has no `String` type; use `Field` for hashes/IDs and store human-readable text off-chain (in the indexer DB, keyed by `market_id`).

```noir
#[note]
struct CollateralNote {
    owner: AztecAddress,       // private — owner of the funds
    amount: Field,             // private — USDC amount (fixed-point, e.g. 1e6 scale)
}

#[note]
struct ShareNote {
    owner: AztecAddress,       // private — who holds the shares
    market_id: Field,          // which market
    side: bool,                // true = YES, false = NO
    amount: Field,             // number of shares
    entry_price: Field,        // price paid per share (for analytics, fixed-point)
}

#[note]
struct WinningNote {
    owner: AztecAddress,
    market_id: Field,
    amount: Field,             // USDC winnings
    resolved_at: Field,        // block number or timestamp
    // marketQuestion is stored off-chain in the indexer DB, looked up by market_id
}
```

**Implementation note:** `Field` is the native arithmetic type in Noir circuits — avoids range-check overhead vs `u64` for AMM/pricing math. Use `u64` only where you need explicit overflow protection at contract boundaries. Store **question text** off-chain in public market metadata; use `market_id` in notes to join with indexer. For integrity checking, a `question_hash: Field` can optionally be stored in the note if you need to verify the question hasn't been tampered with.

**Options for double-spend prevention:**

#### Option A — Nullifier-Based (Aztec Native)
Each note has a nullifier derived from `hash(owner_secret, note_hash)`. When a note is spent, its nullifier is published. Attempting to spend again fails because the nullifier already exists. The `#[note]` macro generates the nullifier computation automatically.

**[x] RECOMMENDED — this is the standard Aztec approach**

---

### 3.2 AMM Design: CPMM vs LMSR

**Issue:** Constant Product Market Maker (`x*y=k`) has known problems in prediction markets — it can never reach 0 or 1 odds, and has large slippage at extremes.

#### Option A — CPMM (x\*y=k, as currently specified)
Standard Uniswap-style AMM.

- **Pros:** Well understood; easy to implement in Noir; team probably familiar.
- **Cons:** In prediction markets, probabilities near 0 or 1 become unreachable; large slippage on high-conviction markets; LP exposure is high (impermanent loss when market resolves).

**[ ] Acceptable for Phase 1 testnet with documented limitations**

---

#### Option B — LMSR (Logarithmic Market Scoring Rule)
The academic gold standard for prediction market AMMs. Used by Augur and early Gnosis. Cost function: $C(q_{yes}, q_{no}) = b \cdot \ln(e^{q_{yes}/b} + e^{q_{no}/b})$

- **Pros:** Market can reach 0 and 1; less slippage at extremes; well-studied; no LP impermanent loss (platform/creator is market maker).
- **Cons:** Platform must subsidise losses (the “b” parameter represents maximum loss); harder to implement in Noir (requires `exp` and `ln` approximations); **constraint-heavy** — may exceed comfortable per-tx circuit budgets.
- **How to build `exp`/`ln` in Noir:** Noir has no floating-point or transcendental math. Three buildable approaches:
  1. **Fixed-point Taylor series:** `exp(x)` and `ln(x)` as truncated polynomial approximations using fixed-point `Field` arithmetic (e.g., 18-decimal scale). A 6th-order Taylor expansion gives <0.1% error for |x| < 2, covering typical LMSR range.
  2. **Piecewise linear lookup:** Pre-compute `exp` at discrete intervals, interpolate linearly. Fewer constraints, lower accuracy.
  3. **Range reduction + polynomial:** `exp(x) = exp(k) * exp(r)` where `k` is integer (lookup) and `r` is small (polynomial). Best accuracy-to-constraint ratio.
  All three are buildable in Noir today. Expect ~500–2000 additional constraints per LMSR price calculation — modest relative to note encryption overhead.
- **Aztec escape hatch:** If a single function’s constraints explode, use **recursive verification** (off-chain or batched Noir prove of the pricing step, **verify proof on Aztec**) per Aztec [recursive verification tutorial](https://docs.aztec.network/developers/docs/tutorials/contract_tutorials/recursive_verification). Treat as **Phase 2+ engineering** if LMSR proves too fat for one circuit.

**[x] RECOMMENDED for long-term — evaluate LMSR implementation complexity in Noir during Phase 1**

---

#### Option C — Constant Sum Market Maker (CSMM) — p\_yes + p\_no = 1
A simpler AMM where the only constraint is probabilities sum to 1.

- **Pros:** Trivially ensures prices between 0 and 1; easy to implement.
- **Cons:** Extremely vulnerable to arbitrage; any savvy trader drains one side; not viable in production.

**[ ] Do not use**

---

#### Option D — Hybrid: CPMM Phase 1, LMSR Phase 2
Use CPMM in testnet to ship faster and validate the rest of the stack. Migrate to LMSR in Phase 2 before mainnet — **or** ship mainnet with CPMM + documented odds limitations if LMSR + recursion is not ready.

**[x] RECOMMENDED pragmatic path**

---

#### Option E — Chunked / multi-tx trading (circuit budget fallback)
Split one logical trade across **multiple Aztec transactions** (e.g. partial fill + consume note + merge) so each proof stays under PXE/device limits. **Cons:** worse UX, timing, and potential interim MEV; only if monolithic `swap` reverts or proves too slowly.

**[ ] Fallback if benchmarking (§4.2) shows single-tx trade proofs fail p95 targets**

---

### 3.3 Oracle Contract Design

**Issue:** Oracle contract interface, trust model, and multi-sig not specified.

**Recommended Interface:**

> **Note:** The pseudocode below is conceptual. In Aztec.nr, access control uses the AuthWit (Authentication Witness) pattern rather than passing raw signatures into functions. Each authorised signer creates an AuthWit off-chain; the contract checks `context.assert_valid_authwit(signer, action_hash)` before executing.

```noir
// Conceptual — actual Noir syntax uses #[public] / #[private] annotations
#[public]
fn resolve_market(market_id: Field, outcome: bool) {
    // Caller must be the multi-sig account contract, or
    // the contract checks N AuthWits from approved signers
    assert(is_authorised_resolver(context.msg_sender()));
    // ... store outcome, start challenge window
}

#[public]
fn dispute_resolution(market_id: Field, bond_amount: Field) {
    // Anyone can call within challenge window; bond is escrowed
}

#[public]
fn finalise_resolution(market_id: Field) {
    // Callable by anyone after challenge window expires
}
```

#### Option A — Admin EOA (Current implied state)
Single admin private key calls `resolveMarket`.

- **Pros:** Simple.
- **Cons:** Single point of failure; single point of compromise; cannot be trusted at scale.

**[ ] Testnet only**

---

#### Option B — Multi-sig Resolver (e.g., 3-of-5)
Resolution requires M of N pre-approved signers.

- **Pros:** No single point of compromise; significantly more trustworthy.
- **Cons:** Operational overhead (coordinate 3+ signatures per resolution); delays resolution by minutes to hours.
- **How to build this:** Aztec does not have a native multi-sig contract. Two viable approaches:
  1. **Custom Noir multi-sig account contract (on L2):** Build an account contract that requires M-of-N Schnorr signatures via Aztec's AuthWit (Authentication Witness) pattern. Each signer submits an AuthWit; the contract verifies the threshold before executing. Keeps resolution on L2 and private. Requires custom Noir development but AuthWit primitives exist.
  2. **L1 Gnosis Safe + portal bridge (simpler, less private):** Use an L1 Gnosis Safe to call a resolution function on L1, which sends an L1→L2 message via Aztec's portal. The L2 oracle contract consumes the message. Simpler to set up but resolution metadata is public on L1.

**[x] RECOMMENDED for Phase 1 mainnet and beyond**

---

#### Option C — Optimistic Oracle (UMA-style)
Admin proposes outcome. Anyone can dispute within 48h. If no dispute, outcome is accepted. If disputed, arbitration escalates.

**[x] Phase 3 as planned**

---

### 3.4 Upgrade & Emergency Mechanisms

**Issue:** ~~Aztec contracts are immutable post-deployment.~~ **Correction:** Aztec natively supports contract upgrades. Each contract instance has `originalContractClassId` and `currentContractClassId`. Upgrading works by calling `ContractInstanceRegistry.update(newClassId)` from within the contract itself, which schedules a time-delayed class ID change via `DelayedPublicMutable`. After the delay, the contract executes code from the new implementation while the address stays the same.

#### Option A — Escape Hatch / Emergency Pause + Migration
Add an `emergencyPause()` function callable by multi-sig. When paused, all trades halt. A `migrate(newVault)` function allows users to pull their notes to a new contract deployment.

- **Pros:** Standard safety valve; lets you fix bugs without total loss.
- **Cons:** Multi-sig pause is centralised; requires users to actively migrate.

**[x] RECOMMENDED — implement from day one**

---

#### Option B — Proxy Upgrade Pattern
Deploy a proxy contract that delegates to an implementation contract. Upgrade the implementation without changing the address.

- **Pros:** Seamless upgrades; users don't need to migrate.
- **Cons:** Proxy patterns on Aztec are **superseded by the native upgrade mechanism** — `ContractInstanceRegistry.update(newClassId)` with time-delayed class ID change via `DelayedPublicMutable`. The contract address stays the same. Use the native approach instead.

**[ ] Not needed — Aztec has native contract upgrades. Use `ContractInstanceRegistry.update()` instead of proxies.**

---

#### Option C — Versioned Deployments (No Migration)
Deploy v1, v2 as separate contracts. Users move of their own accord. Old contracts remain live.

- **Pros:** Simplest; no migration risk.
- **Cons:** Liquidity fragmentation; confusing UX; old vulnerable contracts stay active.

**[ ] Last resort only**

---

### 3.5 Polymarket API Dependency for Market Creation

**Issue:** Pulling markets from Polymarket's public API is a dependency on their ToS and API availability.

#### Option A — Manual Market Creation (No API Dependency)
Markets are created manually by the admin team, inspired by Polymarket but independently authored.

- **Pros:** Zero third-party dependency; full control over market quality; clear legal standing.
- **Cons:** Slow; doesn't scale; manual effort.

**[x] Phase 1 approach**

---

#### Option B — Multiple Source Aggregation (Polymarket + others)
Pull from multiple public sources (Polymarket API, Manifold, Metaculus, news APIs). If one goes down or bans, others continue.

- **Pros:** Resilient; diverse market coverage.
- **Cons:** More complex; still has ToS risk for each source; requires human review.

**[ ] Phase 2 with legal review**

---

#### Option C — Community Market Submission
Users propose markets via a front-end form. Admin approves or rejects.

- **Pros:** No external API dependency; community engagement.
- **Cons:** Low volume initially; requires moderation infrastructure.

**[ ] Phase 2 alongside bond-based permissionless creation**

---

### 3.6 Resolution Front-Running (Oracle Timing Attack)

**Issue:** Between real-world event resolution and on-chain settlement, traders who know the outcome can buy winning shares cheaply.

#### Option A — Trading Halt at Market Expiry
When the market's end date is reached, all new trades are blocked. Resolution happens in a "frozen" state where no price manipulation is possible.

- **Pros:** Simple; directly prevents the attack.
- **Cons:** Locks out legitimate late traders; requires contract-enforced halt.

**[x] RECOMMENDED — halt trading at end_date, resolve within grace period**

---

#### Option B — Commit-Reveal for Oracle
Admin commits to a resolution (hash of outcome) on-chain first, then reveals after a delay. This eliminates the window between commitment and execution.

- **Pros:** Eliminates front-running the reveal step.
- **Cons:** Doesn't help if private information leaks before commit; two-step oracle process.

**[ ] Useful addition for Phase 2**

---

### 3.7 Settlement — Unclaimed Winnings & Fund Accounting

**Issue:** What happens to winning USDC if a user never claims it? Who redistributes losing collateral?

**Recommended Approach:**
- Winning notes are auto-generated by PXE on resolution (per §2.5 Auto-Claim).
- Losing collateral is transferred to the platform's winning pool at resolution time.
- The platform divides the losing pool proportionally among winning sharenotes (standard prediction market payout).
- Unclaimed WinningNotes remain in the user's private note store indefinitely — they don't expire.
- Consider a 1-year dormancy policy after which unclaimed funds can be swept to a DAO treasury (requires governance and clear disclosure in ToS).

#### Option A — No Expiry on Winnings
Winnings remain claimable forever.

- **Pros:** User-protective; no fund loss risk.
- **Cons:** Unclaimed funds lock collateral in the contract permanently; contract state grows.

**[x] RECOMMENDED for Phase 1 and 2**

---

#### Option B — Dormancy Sweep (1-Year Policy)
After 1 year of inactivity, unclaimed winnings are swept to platform treasury or burned.

- **Pros:** Keeps contract state manageable; recovers dormant value.
- **Cons:** Requires governance; legal risk (user's funds); must be clearly disclosed.

**[ ] Phase 3/4 governance decision**

---

## 4. Non-Functional Requirements

---

### 4.1 Audit Strategy

**Issue:** "Audited before mainnet" with no auditor identified, no timeline, and no Noir-specialist named.

**Noir-capable auditors (as of 2026):**
- **Spearbit** — has audited Aztec protocol internals; top pick.
- **Trail of Bits** — leading ZK security team; audited Noir-adjacent systems.
- **Zellic** — growing ZK specialisation.
- **Aztec Labs internal review** — not a substitute for external audit but available for early feedback via their Discord/GitHub.

**Recommended Audit Timeline:**
1. Phase 1 testnet: Internal security review + Aztec community review (low cost, early feedback).
2. 4 weeks before mainnet: Full audit by Spearbit or Trail of Bits.
3. All critical findings fixed before mainnet deploy.
4. Audit report published publicly.

**[ ] Allocate audit budget in project plan — estimate: $80k–$150k USD for full Noir audit**

---

### 4.2 ZK Proof Performance

**Issue:** "< 15 seconds" target has no basis. Actual Aztec proof times depend on circuit complexity and device.

**Benchmarks to obtain (action item):**
- Run a representative PrivateVault transfer proof on: MacBook M-series, mid-range Android, low-end Android, iOS Safari.
- Establish actual p50 and p95 proof times.

**Options if proof times exceed 15 seconds:**

#### Option A — Simplify Circuits
Reduce the number of constraints in PrivateVault proofs. Fewer private note operations per transaction.

**[x] Primary optimisation path**

---

#### Option B — Server-Side Proving (Trusted Prover)
Send private inputs to a trusted server for proof generation. Server sees private data but generates proof faster.

- **Pros:** 1–2 second proofs; consistent performance.
- **Cons:** **Completely defeats the privacy model.** Platform would see all private positions. **Do not use.**

**[ ] REJECTED — contradicts core value proposition**

---

#### Option C — Proof Generation UX (Progress Bar + Background Processing)
While proof generates (even if 30+ seconds), show a clear progress indicator, disable the button, and let the user do other things. Don't block the entire UI.

**[x] RECOMMENDED UX mitigation regardless of proof speed**

---

#### Option D — Recursive proof verification / thinner circuits
Move the heaviest computation (e.g. LMSR cost update) to a **standalone Noir proof** verified inside a small Aztec contract path, or split state transitions per §3.2 Option E. Aligns with Aztec guidance when **single-function constraints** exceed practical limits.

**[ ] Phase 2+ — triggered if Option A (simplify) is insufficient for PM math**

---

### 4.3 Compliance

**Issue:** "Geo-blocking + disclaimers" is not a compliance plan for a financial product.

**Recommended minimum steps:**
1. Engage a crypto-specialised legal firm (e.g., DLx Law, Cooley, or Fenwick & West) for a legal opinion on prediction market operation.
2. Identify the top 5 restricted jurisdictions (US, China, UK pending MiFID, etc.) and implement IP-based blocking in the Next.js middleware.
3. Add a wallet address check against OFAC/sanctioned address lists (on-chain or via Chainalysis API) at deposit time.
4. Draft and publish clear Terms of Service and risk disclosures before testnet launch.
5. Consider a legal entity (offshore or Swiss Foundation) structure for operating the platform.

**[ ] Block mainnet launch until legal opinion is obtained**

---

## 5. Phase 1 Scope

---

### 5.1 Testing Strategy

**Issue:** No testing strategy defined. Noir contracts are difficult to test.

**Recommended test matrix:**

| Layer | Tool | Description |
|---|---|---|
| Noir unit tests | `nargo test` | Pure function tests for AMM math, note hashing, nullifiers |
| Contract integration | Aztec Sandbox | Full contract deployment + interaction tests in local sandbox |
| E2E | Aztec.js + in-repo patterns | Full user flow: deposit → trade → resolve → claim; mirror **yarn-project/end-to-end** style in aztec-packages |
| Reference repos | [aztec-starter](https://github.com/AztecProtocol/aztec-starter), [aztec-examples](https://github.com/AztecProtocol/aztec-examples) | Bootstrap + additional contract idioms |
| Standards (optional) | [aztec-standards](https://github.com/defi-wonderland/aztec-standards) | Evaluate token/DeFi primitives before custom implementations |
| Frontend | Cypress or Playwright | Browser E2E for UI flows |
| Fuzzing | Custom input fuzzer | Feed random inputs to AMM and vault; check for invariant violations |
| Security | Manual review + audit | For all privilege functions (resolve, pause, create) |

**[ ] Define test coverage targets: 80%+ unit, 100% happy-path E2E**

---

### 5.2 Keeper Bot Specification

**Issue:** Listed as "in scope" but has no spec. **Align with §3.5:** Phase 1 uses **manual** market definitions and **admin/co-signer** resolution — the keeper **must not** depend on Polymarket API unless you promote §3.5 Option B and clear legal review.

**Recommended Keeper Bot Spec:**

```
Language: Node.js / TypeScript
Functions:
  - pollMarketExpiry(): every 5 minutes, check for
    markets past end_date without resolution
  - pollOracle(): Phase 1 — read curated resolution inputs agreed in ops runbooks
    (admin dashboard, signed CSV, or internal DB); Phase 2+ — optional external APIs
    (Polymarket, news) only after ToS/legal clearance
  - submitResolution(marketId, outcome): call oracle
    contract with M-of-N multi-sig (requires key coordination)
  - triggerAutoVoid(marketId): call voidMarket() for
    markets past grace period
  - monitorHealth(): alert on any failure via PagerDuty/Slack

Infrastructure:
  - Hosted on: Railway / Fly.io / Render (low-cost, auto-restart)
  - Monitoring: UptimeRobot + Slack webhook for alerts
  - Key management: Hardware wallet or AWS KMS for signing keys
  - Run frequency: Polling every 5 minutes; retries on failure
  - Logs: Structured JSON logs to a persistent store (Logtail/Datadog)
```

---

### 5.3 Deployment Plan

**Issue:** No deployment plan for Phase 1.

**Recommended Phase 1 Deployment Plan:**

| Step | Owner | Detail |
|---|---|---|
| 1. Local Sandbox Testing | Dev Team | All contracts + keeper deployed locally |
| 2. Internal Testnet Deployment | Dev Team | Deploy to Aztec public testnet; test keys from Aztec faucet |
| 3. Testnet Keys Setup | Ops | Generate admin multi-sig keys; store securely |
| 4. Keeper Bot Deployment | Dev/Ops | Deploy bot to Railway/Fly.io with testnet RPC |
| 5. Frontend Deployment | Dev | Deploy Next.js to Vercel or Cloudflare Pages |
| 6. Smoke Testing | QA | Full user flow: deposit → trade → resolve → claim |
| 7. Invite-only Beta | Product | Small group of trusted testers; collect feedback |
| 8. Public Testnet Launch | Product | Open to all; 20+ markets seeded |

---

## 6. Risks (Additions to PRD)

---

### 6.1 Note Loss Risk

**Risk:** If a user's PXE data (browser storage) is cleared, they lose all their private notes and with them, their funds.

**Mitigations:** See §2.2 Note/PXE Recovery — implement encrypted backup export as minimum. Display a persistent warning banner until user has backed up.

---

### 6.2 Admin Key Compromise

**Risk:** A compromised admin key can create fraudulent markets AND resolve them incorrectly — double impact.

**Mitigations:**
- Separate the market creation key from the oracle resolution key (two distinct roles).
- Use hardware wallets for all admin keys.
- Implement multi-sig as per §3.3 Oracle Contract Design.
- Time-lock on resolution (Option A in §2.1 Dispute Mechanism).

---

### 6.3 Bridge / Deposit Contract Risk (Mainnet)

**Risk:** If the pooled deposit contract on L1 is exploited, all user funds in transit are at risk.

**Mitigations:**
- Use Aztec's canonical token portal (audited path; keep contracts and dependency versions pinned).
- **Code correctness** and **access control** matter more than “fast claiming”; escaping bridge bugs is not improved by latency alone.
- Cap maximum single deposit amount early mainnet (e.g., $10,000 USDC max) until battle-tested; monitor TVL in portal.

---

### 6.4 MEV / Resolution Front-Running

**Risk:** Resolvers or block producers who know the oracle outcome before it is on-chain can buy winning shares in the last moment before the trading halt.

**Mitigations:**
- Trading halt at market end_date (§3.6 Option A) — eliminates last-minute trades.
- Multi-sig resolution prevents a single insider from knowing outcome alone.
- Commit-reveal oracle in Phase 2 (§3.6 Option B).

---

## 7. Success Metrics (Revised)

**Issue:** Current metrics are either vanity metrics or launch criteria, not success signals.

**Recommended Replacement Metrics:**

| Metric | Target | Rationale |
|---|---|---|
| Unique traders (30 days) | 200+ | Genuine user interest |
| Total trading volume (testnet) | Equivalent of 100k+ USDC | Validates product-market fit |
| Average trade completion rate | >80% (proof generated + tx confirmed) | UX quality signal |
| Markets resolved correctly | 100% during Phase 1 | Trust and reliability signal |
| Avg ZK proof time (p50) | < 20 seconds | Performance benchmark |
| Note recovery incidents | 0 unresolved | Safety signal |
| Bug reports (critical/high severity) | 0 unresolved within 48h | Stability signal |
| User retention (D7) | >40% | Engagement signal |

---

## 8. Infrastructure & Technical Stack

---

### 8.1 Database / Indexer

**Issue:** Backend indexer has no database specification.

#### Option A — PostgreSQL + Custom Indexer
Node.js service reads Aztec public events, writes to PostgreSQL. REST API serves the frontend.

- **Pros:** Mature; flexible query patterns; easy to deploy.
- **Cons:** Must be kept in sync with chain; re-indexing risk if db corrupts.

**[x] RECOMMENDED for Phase 1**

---

#### Option B — The Graph Protocol (Subgraph)
Deploy an Aztec-compatible subgraph for automatic event indexing.

- **Pros:** Decentralised; no maintenance burden for indexing.
- **Cons:** Aztec support in The Graph is early-stage and may not be ready.

**[ ] Monitor Aztec + The Graph roadmap; target Phase 2 if ready**

---

### 8.2 Frontend Hosting

**Issue:** No hosting spec.

**Recommendation:** Deploy to **Vercel** (for Next.js, zero-config) with the following config:
- Geoblocking via Vercel Edge Middleware (IP-based, using a jurisdiction blocklist).
- CDN caching for public market data (no sensitive data cached).
- No server-side rendering of private data (all private data rendered client-side only via PXE).

---

### 8.3 Monitoring & Alerting

**Issue:** No monitoring plan.

**Recommended Stack:**
- **Uptime:** BetterStack or UptimeRobot (alert on downtime within 1 min).
- **Error tracking:** Sentry (frontend + backend).
- **Logs:** Logtail or Datadog Logs.
- **Keeper bot health:** Custom heartbeat endpoint; alert to Slack/PagerDuty if heartbeat missed.
- **Smart contract events:** Index and alert on anomalous events (e.g., unusually large deposits, emergency pause triggered).

---

### 8.4 Aztec Version Pinning

**Issue:** PRD does not specify Aztec version.

**Recommendation:** Pin to **Aztec SDK v4.2.0-aztecnr-rc.2** (or latest stable release) explicitly in the PRD and in all dependency files (`Nargo.toml`, `package.json`). There is no “v5” — Aztec is currently on v4.x with alpha-testnet (node v4.1.3, alpha-testnet tag 0.85.0-alpha-testnet.9).
- Pin an explicit **toolchain triple** in the repo: `aztec-up` version / `@aztec/aztec.js` semver / Noir compiler version.
- Track upstream release notes for: note encryption model and note discovery (tagging system), portal/bridge API changes (`TokenPortal.sol`, `token_bridge_contract`), PXE interface changes and wallet SDK (`@aztec/wallets/embedded`), Noir stdlib and Aztec.nr updates, contract upgrade mechanism (`ContractInstanceRegistry`).
- Watch [**AztecProtocol/aztec-packages**](https://github.com/AztecProtocol/aztec-packages) releases and [Aztec docs](https://docs.aztec.network/) — public testnet deploy assumes compatible **Ethereum test network** (e.g. Sepolia) per upstream tutorials.

---

### 8.5 Testnet vs mainnet readiness (alignment check)

Use this as a **gate**, not fluff:

| Gate | Meaning |
|------|---------|
| **MVP** | Local or public **devnet/testnet** per Aztec docs; Option C deposits or faucet; sponsored fees where supported (§1.3). |
| **Bridge + real assets** | Token portal path live on target network; legal + audit (§4.1, §4.3); user-paid fees where FPC is unavailable. |
| **Decentralized ops** | Sequencer/prover expectations match [roadmap](https://aztec.network/roadmap) / docs — don’t hardcode “mainnet alpha” behaviours until pinned release says so. |

---

*Document version: 1.2 — April 9, 2026*
*Updates: §1.3 Aztec alignment (constraints, fees, ecosystem), §3.2 LMSR + recursion + Option E chunked trades, §4.2 Option D recursive mitigation, §5.1 reference repos, §8.4–8.5 pinning/readiness gates.*
