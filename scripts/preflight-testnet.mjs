#!/usr/bin/env node
/**
 * Preflight checks for public testnet / Docker compose.
 * Exit 0 = warnings only or all ok; 1 = missing critical vars for indexer chain sync.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function readEnvFile(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const rootEnv = readEnvFile(".env");
const fe = readEnvFile("frontend/.env");

const requiredIndexer = ["MARKET_FACTORY_ADDRESS", "ORACLE_ADDRESS", "AMM_ADDRESS"];
let failed = false;

console.log("Honkers — testnet preflight\n");

for (const k of requiredIndexer) {
  const v = process.env[k] || rootEnv[k] || "";
  if (!v || v === '""') {
    console.error(`✗ ${k} unset — indexer chain polling will skip contract reads.`);
    failed = true;
  } else {
    console.log(`✓ ${k}`);
  }
}

const admins = fe.VITE_ADMIN_ADDRESSES || process.env.VITE_ADMIN_ADDRESSES || "";
if (!admins) {
  console.warn("⚠ VITE_ADMIN_ADDRESSES unset — /admin routes will redirect all wallets to /unauthorized.");
} else {
  console.log("✓ VITE_ADMIN_ADDRESSES set");
}

const meta = process.env.INDEXER_METADATA_SECRET || rootEnv.INDEXER_METADATA_SECRET || "";
if (!meta) {
  console.warn("⚠ INDEXER_METADATA_SECRET unset — POST /api/markets/:id/metadata is open (dev only).");
} else {
  console.log("✓ INDEXER_METADATA_SECRET set");
}

if (failed) {
  console.error("\nSet missing vars in root .env (for docker compose) or export before `docker compose up`.\n");
  process.exit(1);
}
console.log("\nPreflight OK.\n");
