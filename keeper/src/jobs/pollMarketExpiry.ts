// ---------------------------------------------------------------------------
// Job: Poll for expired markets that lack a resolution proposal.
// Reads market list directly from the MarketFactory public storage via RPC.
// ---------------------------------------------------------------------------

import { config } from "../config.js";
import { alertInfo, alertWarning } from "../utils/alerts.js";
import { readAllMarkets, readOracleState } from "../utils/chainReader.js";

export async function pollMarketExpiry(): Promise<void> {
  if (!config.marketFactoryAddress) return;

  const now = Math.floor(Date.now() / 1000);
  const markets = await readAllMarkets(config.marketFactoryAddress);

  const expired = markets.filter((m) => m.endDate < now);
  if (expired.length === 0) return;

  // Check oracle resolution state for each expired market
  const unresolved: typeof markets = [];
  for (const m of expired) {
    const state = config.oracleAddress
      ? await readOracleState(config.oracleAddress, m.marketId)
      : 0;
    // state 0 = unresolved — no proposal yet
    if (state === 0) unresolved.push(m);
  }

  if (unresolved.length === 0) return;

  const ids = unresolved.map((m) => m.marketId);
  await alertInfo(`${unresolved.length} expired market(s) without resolution: [${ids.join(", ")}]`);

  const voidThreshold = now - config.gracePeriodSecs + 3600; // warn 1h before void-eligible
  const urgent = unresolved.filter((m) => m.endDate < voidThreshold);
  if (urgent.length > 0) {
    await alertWarning(
      `${urgent.length} market(s) approaching auto-void window: [${urgent.map((m) => m.marketId).join(", ")}]`,
    );
  }
}
