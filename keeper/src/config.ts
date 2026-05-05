// ---------------------------------------------------------------------------
// Keeper bot configuration — loaded from environment variables.
// ---------------------------------------------------------------------------

function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  /** Aztec JSON-RPC endpoint. */
  aztecRpcUrl: requireEnv("AZTEC_RPC_URL", "https://rpc.testnet.aztec-labs.com"),

  /** MarketFactory contract address — used to enumerate markets from chain. */
  marketFactoryAddress: requireEnv("MARKET_FACTORY_ADDRESS", ""),

  /** Master polling interval in ms (default 10 minutes). */
  pollIntervalMs: Number(requireEnv("KEEPER_POLL_INTERVAL_MS", "600000")),

  /** Health check interval in ms (default 1 minute). */
  healthIntervalMs: Number(requireEnv("KEEPER_HEALTH_INTERVAL_MS", "60000")),

  /** Oracle contract address (hex). */
  oracleAddress: requireEnv("ORACLE_ADDRESS", ""),

  /** AMM contract address (hex). */
  ammAddress: requireEnv("AMM_ADDRESS", ""),

  /** Admin private key for signing keeper transactions. */
  adminPrivateKey: requireEnv("ADMIN_PRIVATE_KEY", ""),

  /**
   * auto_void: attempt on-chain void when admin key configured (not yet implemented — logs only).
   * alert_only: notify via alerts (default).
   * disabled: skip auto-void job work entirely.
   */
  autoVoidMode: (process.env.KEEPER_AUTO_VOID_MODE ?? "alert_only").toLowerCase(),

  /** Slack webhook URL for alerts (optional). */
  slackWebhookUrl: requireEnv("SLACK_WEBHOOK_URL", ""),

  /** PagerDuty Events API v2 routing key (optional). */
  pagerdutyRoutingKey: requireEnv("PAGERDUTY_ROUTING_KEY", ""),

  /** Grace period in seconds — must match Oracle contract (72h). */
  gracePeriodSecs: 259_200,

  /** Challenge window in seconds — must match Oracle contract (24h). */
  challengeWindowSecs: 86_400,
} as const;
