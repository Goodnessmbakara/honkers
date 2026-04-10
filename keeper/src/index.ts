// ---------------------------------------------------------------------------
// Keeper bot entry point — polling loop + job orchestration.
// Hosted on Railway / Fly.io with auto-restart.
// ---------------------------------------------------------------------------

import { Pool } from "pg";
import { config } from "./config";
import { pollMarketExpiry } from "./jobs/pollMarketExpiry";
import { triggerAutoVoid } from "./jobs/triggerAutoVoid";
import { monitorHealth } from "./jobs/monitorHealth";
import { alertInfo, alertCritical } from "./utils/alerts";

let running = true;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runJobSafe(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[keeper] Job "${name}" crashed: ${msg}`);
    await alertCritical(`Job "${name}" crashed: ${msg}`, `keeper-job-${name}`);
  }
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: config.databaseUrl });

  // Verify DB connectivity before starting loops
  await pool.query("SELECT 1");
  console.log("[keeper] Connected to database");

  await alertInfo("Keeper bot started");

  // ── Health monitoring loop (faster cadence) ───────────────────────────
  const healthLoop = (async () => {
    while (running) {
      await runJobSafe("monitorHealth", () => monitorHealth(pool));
      await sleep(config.healthIntervalMs);
    }
  })();

  // ── Market jobs loop ──────────────────────────────────────────────────
  const marketLoop = (async () => {
    while (running) {
      await runJobSafe("pollMarketExpiry", () => pollMarketExpiry(pool));
      await runJobSafe("triggerAutoVoid", () => triggerAutoVoid(pool));
      await sleep(config.pollIntervalMs);
    }
  })();

  await Promise.all([healthLoop, marketLoop]);
  await pool.end();
}

// ── Graceful shutdown ─────────────────────────────────────────────────────

function shutdown(signal: string) {
  console.log(`[keeper] Received ${signal}, shutting down…`);
  running = false;
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

main().catch(async (err) => {
  console.error("[keeper] Fatal:", err);
  await alertCritical(`Fatal startup error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
// Hosted on Railway/Fly.io with auto-restart
