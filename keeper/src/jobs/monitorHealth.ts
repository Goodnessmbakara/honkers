// ---------------------------------------------------------------------------
// Job: Health monitoring — checks Aztec node connectivity.
// Runs every KEEPER_HEALTH_INTERVAL_MS (default 1 min).
// ---------------------------------------------------------------------------

import { config } from "../config.js";
import { alertCritical, alertInfo } from "../utils/alerts.js";

let consecutiveFailures = 0;
const MAX_SILENT_FAILURES = 3;

export async function monitorHealth(): Promise<void> {
  const issues: string[] = [];

  try {
    const res = await fetch(config.aztecRpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "node_getNodeInfo", params: [] }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) issues.push(`Aztec RPC returned ${res.status}`);
  } catch (err) {
    issues.push(`Aztec RPC unreachable: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (issues.length === 0) {
    if (consecutiveFailures > 0) await alertInfo("Health recovered — Aztec RPC operational");
    consecutiveFailures = 0;
    return;
  }

  consecutiveFailures++;
  const summary = issues.join("; ");
  console.error(`[health] (${consecutiveFailures}) ${summary}`);

  if (consecutiveFailures >= MAX_SILENT_FAILURES) {
    await alertCritical(`Health check failing (${consecutiveFailures}x): ${summary}`, "keeper-health");
  }
}
