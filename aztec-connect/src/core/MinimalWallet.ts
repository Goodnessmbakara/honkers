// ---------------------------------------------------------------------------
// @honkers/aztec-connect — Core: MinimalWallet
//
// Bridges PXE → Wallet interface required by AccountManager.
// The Aztec SDK needs a Wallet to create accounts, but we need to create
// accounts before we have a "real" wallet. This minimal shim provides
// just enough to bootstrap the flow.
// ---------------------------------------------------------------------------

import {
  type AccountWithSecretKey,
  type Account,
  SignerlessAccount,
} from "@aztec/aztec.js/account";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import type { AztecNode } from "@aztec/aztec.js/node";
import type { PXE } from "@aztec/pxe/server";
import { BaseWallet } from "@aztec/wallet-sdk/base-wallet";

export class MinimalWallet extends BaseWallet {
  private readonly addressToAccount = new Map<string, AccountWithSecretKey>();

  constructor(pxe: PXE, aztecNode: AztecNode) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    super(pxe as unknown as any, aztecNode);
  }

  /** Register an account so it can be resolved during tx signing. */
  public addAccount(account: AccountWithSecretKey): void {
    this.addressToAccount.set(account.getAddress().toString(), account);
  }

  protected async getAccountFromAddress(address: AztecAddress): Promise<Account> {
    if (address.equals(AztecAddress.ZERO)) {
      return new SignerlessAccount();
    }
    const account = this.addressToAccount.get(address.toString());
    if (!account) {
      throw new Error(`Account not found for address: ${address.toString()}`);
    }
    return account;
  }

  async getAccounts(): Promise<{ alias: string; item: AztecAddress }[]> {
    return Array.from(this.addressToAccount.values()).map((acc) => ({
      alias: "",
      item: acc.getAddress(),
    }));
  }
}
