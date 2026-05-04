// ---------------------------------------------------------------------------
// Job: Trigger auto-void for markets past the 72-hour grace period.
// Calls Oracle.void_market() on-chain for each eligible market.
//
// v4.1.3: State-changing transactions require a full wallet to simulate,
// prove, and send. This currently logs the intent and alerts the admin.
// A full implementation would use a server-side EmbeddedWallet from
// @aztec/wallets/embedded (Node.js entrypoint).
// ---------------------------------------------------------------------------

import { Pool } from "pg";
import { config } from "../config";
import { alertInfo, alertCritical } from "../utils/alerts";

/**
 * Finds markets where:
 *   1. end_date + GRACE_PERIOD (72h) has elapsed, AND
 *   2. No resolution has been finalised (state != 'resolved'), AND
 *   3. The market has not already been voided.
 *
 * For each, attempts to submit an `Oracle.void_market(market_id)` transaction.
 */
export async function triggerAutoVoid(pool: Pool): Promise<void> {
  if (config.autoVoidMode === "disabled") {
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  const voidCutoff = now - config.gracePeriodSecs;

  const { rows } = await pool.query<{
    market_id: number;
    end_date: number;
  }>(
    `SELECT m.market_id, m.end_date
       FROM markets m
      WHERE m.end_date < to_timestamp($1)
        AND m.status = 'open'
        AND NOT EXISTS (
              SELECT 1 FROM resolutions r
               WHERE r.market_id = m.market_id
                 AND r.state IN (2, 4)
            )
      ORDER BY m.end_date ASC`,
    [voidCutoff],
  );

  if (rows.length === 0) return;

  await alertInfo(
    `Auto-voiding ${rows.length} market(s): [${rows.map((r) => r.market_id).join(", ")}]`,
  );

  for (const row of rows) {
    try {
      // TODO: Implement server-side EmbeddedWallet transaction submission.
      // In v4.1.3, submitting a state-changing tx requires:
      //   1. Create a NodeEmbeddedWallet (from @aztec/wallets/embedded)
      //   2. Contract.at(oracleAddress, OracleArtifact, wallet)
      //   3. contract.methods.void_market(market_id).send({ from: adminAddress })
      //
      // For now, alert the admin so they can void manually via the UI.
      await alertInfo(
        `Market ${row.market_id} is past grace period and needs voiding. ` +
        `Manual action required until server-side wallet is configured.`,
      );

      console.log(
        `[keeper] Market ${row.market_id} eligible for auto-void (end_date=${row.end_date}). ` +
        `Server-side tx submission not yet implemented.`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await alertCritical(
        `Failed to void market ${row.market_id}: ${msg}`,
        `void-market-${row.market_id}`,
      );
    }
  }
}
