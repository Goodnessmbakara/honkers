// ---------------------------------------------------------------------------
// Ensure contract is registered with the wallet's PXE before simulate/send.
// Works with both embedded PXE and extension wallets (Wallet extends PXE).
// ---------------------------------------------------------------------------

import { AztecAddress } from "@aztec/aztec.js/addresses";
import type { AztecNode } from "@aztec/aztec.js/node";
import type { ContractArtifact } from "@aztec/aztec.js/abi";
import type { Wallet } from "@aztec/aztec.js/wallet";

export async function ensureContractRegisteredWithPXE(
  wallet: Wallet,
  aztecNode: AztecNode,
  contractAddress: string,
  artifact: ContractArtifact,
): Promise<void> {
  const address = AztecAddress.fromString(contractAddress);
  try {
    const metadata = await wallet.getContractMetadata(address);
    if (metadata?.instance) return;
  } catch {
    // not yet registered — fall through to register
  }
  try {
    const instance = await aztecNode.getContract(address);
    if (!instance) {
      console.warn("[ensureContractRegistered] Contract not found on-chain:", contractAddress);
      return;
    }
    await wallet.registerContract(instance, artifact);
  } catch (e) {
    console.warn("[ensureContractRegistered] Registration failed:", e);
  }
}
