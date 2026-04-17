#!/usr/bin/env node
/**
 * Honkers — verify local dev stack (Aztec JSON-RPC + indexer REST).
 *
 * Covers HANDOFF P0/P1 automated checks:
 *   - Aztec sandbox responds (node_getNodeInfo)
 *   - Indexer /health and GET /api/markets
 *   - Optional: frontend/.env has non-empty contract addresses after deploy
 *
 * Does NOT replace manual wallet / faucet / trade / ProtectedRoute testing.
 *
 * Usage:
 *   node scripts/verify-dev-stack.mjs
 *   AZTEC_RPC_URL=http://localhost:8080 INDEXER_URL=http://localhost:3001 node scripts/verify-dev-stack.mjs
 *
 * Exit: 0 = all checks passed, 1 = one or more failures
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const AZTEC = process.env.AZTEC_RPC_URL ?? "http://localhost:8080";
const INDEXER = process.env.INDEXER_URL ?? process.env.VITE_INDEXER_API_URL ?? "http://localhost:3001";

function logOk(msg) {
  console.log(`✓ ${msg}`);
}
function logFail(msg, err) {
  console.error(`✗ ${msg}`, err?.message ?? err);
}

async function aztecNodeInfo() {
  const res = await fetch(AZTEC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "node_getNodeInfo", params: [] }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? JSON.stringify(json.error));
  return json.result;
}

function readFrontendEnv() {
  const envPath = path.join(ROOT, "frontend", ".env");
  if (!fs.existsSync(envPath)) return {};
  const out = {};
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

async function main() {
  let failed = false;

  console.log("Honkers — verify dev stack\n");
  console.log(`  AZTEC_RPC_URL  = ${AZTEC}`);
  console.log(`  INDEXER_URL    = ${INDEXER}\n`);

  try {
    const info = await aztecNodeInfo();
    const bn = info?.blockNumber ?? info?.rollupVersion ?? "?";
    logOk(`Aztec node — node_getNodeInfo (block / version: ${bn})`);
  } catch (e) {
    logFail(`Aztec node @ ${AZTEC}`, e);
    failed = true;
  }

  try {
    const h = await fetch(`${INDEXER}/health`);
    if (!h.ok) throw new Error(`HTTP ${h.status}`);
    const j = await h.json();
    logOk(`Indexer — GET /health (${j.status ?? "ok"})`);
  } catch (e) {
    logFail(`Indexer health @ ${INDEXER}`, e);
    failed = true;
  }

  try {
    const res = await fetch(`${INDEXER}/api/markets`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const list = j.markets ?? j.data ?? [];
    if (!Array.isArray(list)) throw new Error("Response has no markets array");
    logOk(`Indexer — GET /api/markets (${list.length} row(s))`);
    if (list.length > 0) {
      const row = list[0];
      const q = row.questionText ?? row.question ?? "";
      if (typeof q === "string" && (q === "pending" || q.toLowerCase().includes("placeholder"))) {
        console.warn(
          "  ⚠ First market still looks like a placeholder — ensure event listener ran and/or POST /api/markets/:id/metadata",
        );
      }
    }
  } catch (e) {
    logFail(`Indexer — GET /api/markets`, e);
    failed = true;
  }

  const env = readFrontendEnv();
  const factory = env.VITE_MARKET_FACTORY_ADDRESS ?? "";
  const amm = env.VITE_AMM_ADDRESS ?? "";
  if (factory && amm) {
    logOk(`frontend/.env — contract addresses present (MarketFactory + AMM)`);
  } else {
    console.warn(
      "⚠ frontend/.env missing contract addresses — P0 deploy not done: cd tests/integration && pnpm exec tsx src/deploy.ts",
    );
  }

  console.log("");
  if (failed) {
    console.error("Some checks failed. Fix sandbox/indexer/deploy, then re-run.\n");
    process.exit(1);
  }
  console.log("All automated checks passed.\n");
  console.log("Manual P0 next: connect wallet → faucet → trade → portfolio; disconnect → open /portfolio (ProtectedRoute).\n");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
