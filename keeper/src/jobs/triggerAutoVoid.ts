// ---------------------------------------------------------------------------
// Job: Trigger auto-void for markets past the 72-hour grace period.
// Calls Oracle.void_market() on-chain for each eligible market.
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
 * For each, submits an `Oracle.void_market(market_id)` transaction.
 */
export async function triggerAutoVoid(pool: Pool): Promise<void> {
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
      // Send void_market() transaction to the Oracle contract
      const body = {
        jsonrpc: "2.0",
        id: 1,
        method: "node_call",
        params: {
          to: config.oracleAddress,
          from: config.adminPrivateKey,
          functionName: "void_market",
          args: [row.market_id],
        },
      };

      const res = await fetch(config.aztecRpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`RPC ${res.status}: ${text}`);
      }

      const json = (await res.json()) as { error?: { message: string } };
      if (json.error) {
        throw new Error(`RPC error: ${json.error.message}`);
      }

      await alertInfo(`Successfully voided market ${row.market_id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await alertCritical(
        `Failed to void market ${row.market_id}: ${msg}`,
        `void-market-${row.market_id}`,
      );
    }
  }
}
