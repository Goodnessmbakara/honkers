// ---------------------------------------------------------------------------
// PostgreSQL client — connection pool + typed query helpers.
// ---------------------------------------------------------------------------

import pg from "pg";
import { config } from "../config.js";

const pool = new pg.Pool({ connectionString: config.databaseUrl });

pool.on("error", (err) => {
  console.error("[db] Unexpected pool error:", err.message);
});

/** Run a parameterised query and return rows. */
export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const { rows } = await pool.query<T>(text, params);
  return rows;
}

/** Run a parameterised query and return the first row or null. */
export async function queryOne<T extends pg.QueryResultRow = any>(
  text: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Run a parameterised query and return the count of affected rows. */
export async function execute(
  text: string,
  params?: unknown[],
): Promise<number> {
  const result = await pool.query(text, params);
  return result.rowCount ?? 0;
}

// ---------------------------------------------------------------------------
// Indexer state helpers (watermark tracking)
// ---------------------------------------------------------------------------

export async function getIndexerState(key: string): Promise<string | null> {
  const row = await queryOne<{ value: string }>(
    "SELECT value FROM indexer_state WHERE key = $1",
    [key],
  );
  return row?.value ?? null;
}

export async function setIndexerState(
  key: string,
  value: string,
): Promise<void> {
  await execute(
    `INSERT INTO indexer_state (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [key, value],
  );
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export async function closePool(): Promise<void> {
  await pool.end();
}

export { pool };
