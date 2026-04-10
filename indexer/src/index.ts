// ---------------------------------------------------------------------------
// Honkers Indexer — entry point.
//
// Starts two subsystems in parallel:
//   1. Event listener: polls Aztec node for new blocks and indexes public state.
//   2. API server: serves indexed data to the frontend via REST.
//
// Usage:
//   pnpm dev          — watch mode (development)
//   pnpm db:migrate   — apply schema to PostgreSQL
//   pnpm start        — production
// ---------------------------------------------------------------------------

import { startEventListener } from "./indexer/eventListener.js";
import { startServer } from "./api/server.js";
import { closePool } from "./db/client.js";

async function main() {
  console.log("[honkers-indexer] Starting…");

  // Start the REST API
  startServer();

  // Start the event listener (polling loop)
  startEventListener();

  console.log("[honkers-indexer] Running.");
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n[honkers-indexer] Shutting down…");
  await closePool();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("[honkers-indexer] SIGTERM received, shutting down…");
  await closePool();
  process.exit(0);
});

main().catch((err) => {
  console.error("[honkers-indexer] Fatal error:", err);
  process.exit(1);
});
