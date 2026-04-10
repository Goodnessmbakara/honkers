// ---------------------------------------------------------------------------
// Configuration — loaded from environment variables.
// Defaults are safe for local Aztec Sandbox development.
// ---------------------------------------------------------------------------

function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  /** PostgreSQL connection string. */
  databaseUrl: requireEnv(
    "DATABASE_URL",
    "postgresql://honkers:honkers@localhost:5432/honkers",
  ),

  /** Aztec JSON-RPC endpoint. */
  aztecRpcUrl: requireEnv("AZTEC_RPC_URL", "http://localhost:8080"),

  /** HTTP server port for the indexer API. */
  port: Number(requireEnv("INDEXER_PORT", "3001")),

  /** Polling interval for the event listener (ms). */
  pollIntervalMs: Number(requireEnv("POLL_INTERVAL_MS", "5000")),

  /** Deployed contract addresses (hex strings). Set after deployment. */
  contracts: {
    marketFactory: requireEnv("MARKET_FACTORY_ADDRESS", ""),
    amm: requireEnv("AMM_ADDRESS", ""),
    oracle: requireEnv("ORACLE_ADDRESS", ""),
    testToken: requireEnv("TEST_TOKEN_ADDRESS", ""),
  },

  /** CORS origin whitelist. Comma-separated. */
  corsOrigins: requireEnv("CORS_ORIGINS", "http://localhost:5173").split(","),
} as const;
