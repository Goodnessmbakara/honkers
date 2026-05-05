// ---------------------------------------------------------------------------
// Keeper bot entry point — polling loop + job orchestration.
// ---------------------------------------------------------------------------

import { config } from "./config.js";
import { pollMarketExpiry } from "./jobs/pollMarketExpiry.js";
import { triggerAutoVoid } from "./jobs/triggerAutoVoid.js";
import { monitorHealth } from "./jobs/monitorHealth.js";
import { alertInfo, alertCritical } from "./utils/alerts.js";

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
  console.log("[keeper] Starting — reading markets directly from chain");
  await alertInfo("Keeper bot started");

  const healthLoop = (async () => {
    while (running) {
      await runJobSafe("monitorHealth", monitorHealth);
      await sleep(config.healthIntervalMs);
    }
  })();

  const marketLoop = (async () => {
    while (running) {
      await runJobSafe("pollMarketExpiry", pollMarketExpiry);
      await runJobSafe("triggerAutoVoid", triggerAutoVoid);
      await sleep(config.pollIntervalMs);
    }
  })();

  await Promise.all([healthLoop, marketLoop]);
}

process.on("SIGINT", () => { console.log("[keeper] SIGINT — shutting down"); running = false; });
process.on("SIGTERM", () => { console.log("[keeper] SIGTERM — shutting down"); running = false; });

main().catch(async (err) => {
  console.error("[keeper] Fatal:", err);
  await alertCritical(`Fatal startup error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
