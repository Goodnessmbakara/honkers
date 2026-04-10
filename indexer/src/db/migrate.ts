// ---------------------------------------------------------------------------
// Database migration runner — applies schema.sql to PostgreSQL.
// Usage: tsx src/db/migrate.ts
// ---------------------------------------------------------------------------

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const schemaPath = resolve(__dirname, "schema.sql");
  const sql = readFileSync(schemaPath, "utf-8");

  console.log("[migrate] Applying schema…");
  await pool.query(sql);
  console.log("[migrate] Schema applied successfully.");

  await pool.end();
}

migrate().catch((err) => {
  console.error("[migrate] Failed:", err);
  process.exit(1);
});
