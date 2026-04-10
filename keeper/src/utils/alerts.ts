// ---------------------------------------------------------------------------
// Alert utilities — Slack webhook + PagerDuty Events API v2
// ---------------------------------------------------------------------------

import { config } from "../config";

// ── Slack ───────────────────────────────────────────────────────────────────

async function sendSlack(text: string): Promise<void> {
  if (!config.slackWebhookUrl) return;
  try {
    const res = await fetch(config.slackWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      console.error(`[alert/slack] ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error("[alert/slack] failed to send:", err);
  }
}

// ── PagerDuty ───────────────────────────────────────────────────────────────

type Severity = "critical" | "error" | "warning" | "info";

async function sendPagerDuty(
  summary: string,
  severity: Severity,
  dedupKey?: string,
): Promise<void> {
  if (!config.pagerdutyRoutingKey) return;
  try {
    const res = await fetch("https://events.pagerduty.com/v2/enqueue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        routing_key: config.pagerdutyRoutingKey,
        event_action: "trigger",
        dedup_key: dedupKey ?? `honkers-keeper-${Date.now()}`,
        payload: {
          summary,
          severity,
          source: "honkers-keeper",
        },
      }),
    });
    if (!res.ok) {
      console.error(`[alert/pagerduty] ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error("[alert/pagerduty] failed to send:", err);
  }
}

// ── Public helpers ──────────────────────────────────────────────────────────

export async function alertInfo(message: string): Promise<void> {
  console.log(`[keeper] ℹ️  ${message}`);
  await sendSlack(`ℹ️ *Keeper* — ${message}`);
}

export async function alertWarning(message: string): Promise<void> {
  console.warn(`[keeper] ⚠️  ${message}`);
  await Promise.all([
    sendSlack(`⚠️ *Keeper* — ${message}`),
    sendPagerDuty(message, "warning"),
  ]);
}

export async function alertCritical(
  message: string,
  dedupKey?: string,
): Promise<void> {
  console.error(`[keeper] 🚨  ${message}`);
  await Promise.all([
    sendSlack(`🚨 *Keeper CRITICAL* — ${message}`),
    sendPagerDuty(message, "critical", dedupKey),
  ]);
}
