// ---------------------------------------------------------------------------
// @honkers/aztec-connect — Core: Account management
//
// Framework-agnostic connect / disconnect for Schnorr accounts.
// Wraps AccountManager + SchnorrAccountContract with sensible defaults.
// ---------------------------------------------------------------------------

import { Fr } from "@aztec/aztec.js/fields";
import { AccountManager } from "@aztec/aztec.js/wallet";
import { SchnorrAccountContract } from "@aztec/accounts/schnorr";
import { deriveSigningKey } from "@aztec/stdlib/keys";
import type { AztecInstance } from "./pxe";

export type AccountType = "schnorr";

export interface ConnectOptions {
  /** Account contract type. Currently only "schnorr" is supported. Default: "schnorr" */
  accountType?: AccountType;
  /** Salt for address derivation. Fr.ZERO = one account per secret. Default: Fr.ZERO */
  salt?: Fr;
  /** Called with status updates during connection */
  onStatus?: (status: "deriving" | "registering" | "deploying" | "ready") => void;
}

export interface ConnectedAccount {
  address: string;
  secret: string;
}

/**
 * Connect (create or restore) a Schnorr account.
 *
 * @param instance - AztecInstance from getOrCreatePXE()
 * @param secret   - Account secret (Fr). Generate with `Fr.random()` for new accounts.
 * @param opts     - Optional configuration
 *
 * @example
 * ```ts
 * import { getOrCreatePXE, connectAccount } from "@honkers/aztec-connect";
 * import { Fr } from "@aztec/aztec.js/fields";
 *
 * const instance = await getOrCreatePXE("/rpc");
 * const secret = Fr.random();
 * const { address } = await connectAccount(instance, secret);
 * ```
 */
export async function connectAccount(
  instance: AztecInstance,
  secret: Fr,
  opts: ConnectOptions = {},
): Promise<ConnectedAccount> {
  const { salt = Fr.ZERO, onStatus } = opts;
  const { pxe, wallet } = instance;

  // 1. Derive signing key (GrumpkinScalar, NOT raw buffer)
  onStatus?.("deriving");
  const signingKey = deriveSigningKey(secret);
  const accountContract = new SchnorrAccountContract(signingKey);

  // 2. Create AccountManager
  const accountManager = await AccountManager.create(wallet, secret, accountContract, salt);

  // 3. Register with PXE
  onStatus?.("registering");
  const account = await accountManager.getAccount();
  const contractInstance = accountManager.getInstance();
  const artifact = await accountManager.getAccountContract().getContractArtifact();

  await wallet.registerContract(contractInstance, artifact, accountManager.getSecretKey());
  wallet.addAccount(account);

  // 4. Deploy account contract if needed
  if (await accountManager.hasInitializer()) {
    const isDeployed = await pxe.getContractInstance(account.getAddress());
    if (!isDeployed) {
      onStatus?.("deploying");
      const deployMethod = await accountManager.getDeployMethod();
      const sentTx = await deployMethod.send({ from: account.getAddress() });
      await sentTx;
    }
  }

  onStatus?.("ready");

  return {
    address: account.getAddress().toString(),
    secret: secret.toString(),
  };
}
