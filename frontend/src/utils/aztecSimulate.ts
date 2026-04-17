// ---------------------------------------------------------------------------
// Helpers for Aztec contract `.simulate()` return shapes (tuple vs { result })
// ---------------------------------------------------------------------------

export function unwrapSimulate<T>(v: unknown): T {
  if (v != null && typeof v === "object" && "result" in v) {
    return (v as { result: T }).result;
  }
  return v as T;
}

export function fieldLikeToBigInt(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(Math.trunc(v));
  if (v != null && typeof (v as { toBigInt?: () => bigint }).toBigInt === "function") {
    return (v as { toBigInt: () => bigint }).toBigInt();
  }
  throw new Error("Unexpected field value from simulate");
}

const SCALE = 1_000_000n;

/** AMM fixed-point (1e6 scale) to probability in [0, 1]. */
export function ammPriceToFloat(raw: bigint): number {
  return Number(raw) / Number(SCALE);
}
