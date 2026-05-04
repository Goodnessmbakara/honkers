import { Fr } from "@aztec/aztec.js/fields";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee";
import { getContractInstanceFromInstantiationParams } from "@aztec/stdlib/contract";
import type { MinimalWallet } from "./MinimalWallet";

let sponsoredFPCPromise: Promise<SponsoredFeePaymentMethod> | null = null;
let sponsoredFPCWallet: unknown = null;

/**
 * Returns a cached Sponsored FPC payment method for the current wallet.
 * Address is deterministic: artifact + salt=0, same on local sandbox and testnet.
 */
export async function getSponsoredFeePaymentMethod(
  wallet: MinimalWallet,
): Promise<SponsoredFeePaymentMethod> {
  if (sponsoredFPCPromise && sponsoredFPCWallet === wallet) {
    return sponsoredFPCPromise;
  }

  sponsoredFPCWallet = wallet;
  sponsoredFPCPromise = (async () => {
    const { SponsoredFPCContractArtifact } = await import("@aztec/noir-contracts.js/SponsoredFPC");

    // Canonical SponsoredFPC address is deterministic across all environments:
    // it's derived from the artifact + salt=0. On testnet Aztec Labs deploys and
    // funds this address. Using a hardcoded address is wrong — use derivation.
    const instance = await getContractInstanceFromInstantiationParams(
      SponsoredFPCContractArtifact,
      { salt: Fr.ZERO },
    );
    await wallet.registerContract(instance, SponsoredFPCContractArtifact);
    return new SponsoredFeePaymentMethod(instance.address);
  })();

  sponsoredFPCPromise.catch(() => {
    sponsoredFPCPromise = null;
  });

  return sponsoredFPCPromise;
}
