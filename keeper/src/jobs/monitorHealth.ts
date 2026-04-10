// ---------------------------------------------------------------------------
// Job: Health monitoring — checks Aztec node + indexer DB connectivity.
// Runs every KEEPER_HEALTH_INTERVAL_MS (default 1 min).
// ---------------------------------------------------------------------------

import { Pool } from "pg";
import { config } from "../config";
import { alertCritical, alertInfo } from "../utils/alerts";

let consecutiveFailures = 0;
const MAX_SILENT_FAILURES = 3;

export async function monitorHealth(pool: Pool): Promise<void> {
  const issues: string[] = [];

  // Check Aztec RPC node
  try {
    const res = await fetch(config.aztecRpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "aztec_getNodeInfo",
        params: [],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      issues.push(`Aztec RPC returned ${res.status}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    issues.push(`Aztec RPC unreachable: ${msg}`);
  }

  // Check Postgres (indexer DB)
  try {
    const { rows } = await pool.query<{ ok: number }>("SELECT 1 AS ok");
    if (!rows[0] || rows[0].ok !== 1) {
      issues.push("Postgres health-check query returned unexpected result");
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    issues.push(`Postgres unreachable: ${msg}`);
  }

  // Check indexer lag
  try {
    const { rows } = await pool.query<{ last_block: string; updated_at: Date }>(
      `SELECT value AS last_block, updated_at
         FROM indexer_state
        WHERE key = 'last_indexed_block'
        LIMIT 1`,
    );
    if (rows[0]) {
      const lagMs = Date.now() - new Date(rows[0].updated_at).getTime();
      if (lagMs > 600_000) {
        issues.push(
          `Indexer stale — last update ${Math.round(lagMs / 1000)}s ago (block ${rows[0].last_block})`,
        );
      }
    }
  } catch {
    // indexer_state table might not exist yet — non-critical
  }

  // Report results
  if (issues.length === 0) {
    if (consecutiveFailures > 0) {
      await alertInfo("Health recovered — all systems operational");
    }
    consecutiveFailures = 0;
    return;
  }

  consecutiveFailures++;
  const summary = issues.join("; ");
  console.error(`[health] (${consecutiveFailures}) ${summary}`);

  if (consecutiveFailures >= MAX_SILENT_FAILURES) {
    await alertCritical(
      `Health check failing (${consecutiveFailures}x): ${summary}`,
      "keeper-health",
    );
  }
}
