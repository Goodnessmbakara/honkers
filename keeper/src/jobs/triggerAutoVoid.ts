// ---------------------------------------------------------------------------
// Job: Alert on markets past the 72-hour grace period with no resolution.
// Reads market + oracle state directly from chain via RPC.
//
// Full on-chain void submission requires a server-side wallet (not yet
// implemented). This job alerts the admin to void manually via the UI.
// ---------------------------------------------------------------------------

import { config } from "../config.js";
import { alertInfo, alertCritical } from "../utils/alerts.js";
import { readAllMarkets, readOracleState } from "../utils/chainReader.js";

export async function triggerAutoVoid(): Promise<void> {
  if (config.autoVoidMode === "disabled") return;
  if (!config.marketFactoryAddress) return;

  const now = Math.floor(Date.now() / 1000);
  const voidCutoff = now - config.gracePeriodSecs;

  const markets = await readAllMarkets(config.marketFactoryAddress);
  const eligible: typeof markets = [];

  for (const m of markets) {
    if (m.endDate >= voidCutoff) continue;
    const state = config.oracleAddress
      ? await readOracleState(config.oracleAddress, m.marketId)
      : 0;
    // Skip already finalised (2) or already voided (4)
    if (state === 2 || state === 4) continue;
    eligible.push(m);
  }

  if (eligible.length === 0) return;

  await alertInfo(
    `${eligible.length} market(s) past grace period need voiding: [${eligible.map((m) => m.marketId).join(", ")}]`,
  );

  for (const m of eligible) {
    try {
      // TODO: submit Oracle.void_market(market_id) via server-side wallet
      // Requires @aztec/wallets/embedded Node.js entrypoint + admin key.
      await alertInfo(
        `Market ${m.marketId} eligible for auto-void (end_date=${m.endDate}). Manual action required.`,
      );
      console.log(`[keeper] Market ${m.marketId} void-eligible (end_date=${m.endDate})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await alertCritical(`Failed processing void for market ${m.marketId}: ${msg}`, `void-market-${m.marketId}`);
    }
  }
}
