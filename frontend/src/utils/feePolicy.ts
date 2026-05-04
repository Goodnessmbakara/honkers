// ---------------------------------------------------------------------------
// Fee policy — sponsored_fpc first, then fee_juice (default wallet fee), then fail.
// ---------------------------------------------------------------------------

import type { MinimalWallet } from "./MinimalWallet";
import { getSponsoredFeePaymentMethod } from "./sponsoredFee";
import { getAztecEnvConfig } from "../config/aztec";

export type FeeSendOptions =
  | { fee: { paymentMethod: Awaited<ReturnType<typeof getSponsoredFeePaymentMethod>> } }
  | Record<string, never>;

export class FeePolicyExhaustedError extends Error {
  constructor(
    message: string,
    public readonly sponsoredError: unknown,
  ) {
    super(message);
    this.name = "FeePolicyExhaustedError";
  }
}

/**
 * Build `send()` fee options: try Sponsored FPC when env strategy is sponsored_fpc;
 * on failure fall back to empty options (fee juice / wallet default).
 */
export async function resolveSendFeeOptions(
  wallet: MinimalWallet,
): Promise<FeeSendOptions> {
  const strategy = getAztecEnvConfig().feeStrategy;

  if (strategy === "fee_juice") {
    return {};
  }

  try {
    const paymentMethod = await getSponsoredFeePaymentMethod(wallet);
    return { fee: { paymentMethod } };
  } catch (sponsoredErr) {
    return {};
  }
}

/**
 * Same as resolveSendFeeOptions but throws if sponsored was required and both paths unusable.
 * For testnet, sponsored failure still returns {} for fee juice attempt at send time.
 */
export async function resolveSendFeeOptionsStrict(
  wallet: MinimalWallet,
): Promise<FeeSendOptions> {
  const strategy = getAztecEnvConfig().feeStrategy;
  if (strategy === "fee_juice") {
    return {};
  }

  try {
    const paymentMethod = await getSponsoredFeePaymentMethod(wallet);
    return { fee: { paymentMethod } };
  } catch (sponsoredErr) {
    return {};
  }
}
