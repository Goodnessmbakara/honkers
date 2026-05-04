// ---------------------------------------------------------------------------
// Typed classification for account deploy / network errors (avoid string-only checks).
// ---------------------------------------------------------------------------

export type DeployFailureKind =
  | "already_deployed"
  | "duplicate_nullifier"
  | "unknown";

export function classifyDeployError(err: unknown): DeployFailureKind {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes("already deployed")) return "already_deployed";
  if (lower.includes("duplicate_nullifier") || lower.includes("existing nullifier")) return "duplicate_nullifier";
  if (lower.includes("exists") && lower.includes("contract")) return "already_deployed";
  return "unknown";
}

export function isBenignDeployFailure(err: unknown): boolean {
  const k = classifyDeployError(err);
  return k === "already_deployed" || k === "duplicate_nullifier";
}
