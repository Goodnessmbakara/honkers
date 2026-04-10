// ---------------------------------------------------------------------------
// Job: Poll for expired markets that lack a resolution proposal.
// Runs every KEEPER_POLL_INTERVAL_MS (default 5 min).
// ---------------------------------------------------------------------------

import { Pool } from "pg";
import { config } from "../config";
import { alertInfo, alertWarning } from "../utils/alerts";

/**
 * Queries the indexer DB for markets whose `end_date` has passed but have
 * no row in the `resolutions` table, meaning no one has proposed a resolution
 * yet.  Logs them and sends an alert so the admin team can act.
 */
export async function pollMarketExpiry(pool: Pool): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  const { rows } = await pool.query<{
    market_id: number;
    question_hash: string;
    end_date: number;
  }>(
    `SELECT m.market_id, m.question_hash, m.end_date
       FROM markets m
      WHERE m.end_date < $1
        AND m.status = 'open'
        AND NOT EXISTS (
              SELECT 1 FROM resolutions r WHERE r.market_id = m.market_id
            )
      ORDER BY m.end_date ASC`,
    [now],
  );

  if (rows.length === 0) return;

  const ids = rows.map((r) => r.market_id);
  const message = `${rows.length} expired market(s) without resolution: [${ids.join(", ")}]`;
  await alertInfo(message);

  // Check if any are approaching the void window (end_date + gracePeriod)
  const voidThreshold = now - config.gracePeriodSecs + 3600; // warn 1h before void-eligible
  const urgent = rows.filter((r) => r.end_date < voidThreshold);
  if (urgent.length > 0) {
    const urgentIds = urgent.map((r) => r.market_id);
    await alertWarning(
      `${urgent.length} market(s) approaching auto-void window: [${urgentIds.join(", ")}]`,
    );
  }
}
