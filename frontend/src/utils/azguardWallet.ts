// ---------------------------------------------------------------------------
// AzguardWallet — implements the Aztec.js Wallet interface via Azguard's
// native inpage RPC (`window.azguard`), using @azguardwallet/client.
//
// Equivalent to @azguardwallet/aztec-wallet but imports from our own
// @aztec/* v4.2.0 packages to avoid the version-conflict that package brings.
// ---------------------------------------------------------------------------

import { AzguardClient } from "@azguardwallet/client";
import type { AztecAddress } from "@aztec/aztec.js/addresses";
import type { Wallet } from "@aztec/aztec.js/wallet";

// All methods that must be approved in the Azguard permission popup.
const AZTEC_METHODS = [
  "aztec_getContractClassMetadata",
  "aztec_getContractMetadata",
  "aztec_getPrivateEvents",
  "aztec_getChainInfo",
  "aztec_registerSender",
  "aztec_getAddressBook",
  "aztec_getAccounts",
  "aztec_registerContract",
  "aztec_simulateTx",
  "aztec_executeUtility",
  "aztec_profileTx",
  "aztec_sendTx",
  "aztec_createAuthWit",
];

type AzguardChain = "aztec:4138294185" | "aztec:0" | string;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function resolveChain(chain?: string): AzguardChain {
  if (!chain || chain === "testnet") return "aztec:4138294185";
  if (chain === "sandbox") return "aztec:0";
  return chain;
}

// ---------------------------------------------------------------------------
// AzguardWallet — Wallet adapter
// ---------------------------------------------------------------------------

export class AzguardWallet {
  readonly #azguard: AzguardClient;
  readonly #chain: AzguardChain;

  private constructor(azguard: AzguardClient, chain: AzguardChain) {
    this.#azguard = azguard;
    this.#chain = chain;
  }

  static async connect(
    dappName: string,
    chain?: string,
    timeout = 2000,
  ): Promise<AzguardWallet> {
    const resolvedChain = resolveChain(chain);
    const azguard = await AzguardClient.create("aztec.js", timeout);
    const wallet = new AzguardWallet(azguard, resolvedChain);
    await wallet.#ensureConnected(dappName);
    return wallet;
  }

  get connected(): boolean {
    return this.#azguard.connected;
  }

  get onDisconnected() {
    return this.#azguard.onDisconnected;
  }

  async disconnect(): Promise<void> {
    await this.#azguard.disconnect();
  }

  /** Return the list of approved CAIP-10 account addresses (raw strings). */
  get rawAccounts(): string[] {
    return this.#azguard.accounts;
  }

  // ---------------------------------------------------------------------------
  // Core Wallet methods
  // ---------------------------------------------------------------------------

  async getAccounts(): Promise<{ alias: string; item: AztecAddress }[]> {
    const result = await this.#execute({ kind: "aztec_getAccounts", chain: this.#chain });
    // Azguard returns Aliased<AztecAddress>[] — pass through (serialized form)
    return result as { alias: string; item: AztecAddress }[];
  }

  async getContractMetadata(address: AztecAddress) {
    const result = await this.#execute({
      kind: "aztec_getContractMetadata",
      chain: this.#chain,
      address,
    });
    return result as { instance?: unknown; isInitialized?: boolean };
  }

  async getContractClassMetadata(id: unknown) {
    return this.#execute({ kind: "aztec_getContractClassMetadata", chain: this.#chain, id });
  }

  async registerContract(instance: unknown, artifact?: unknown, secretKey?: unknown) {
    return this.#execute({
      kind: "aztec_registerContract",
      chain: this.#chain,
      instance,
      artifact,
      secretKey,
    });
  }

  async registerSender(address: unknown, alias?: string) {
    return this.#execute({ kind: "aztec_registerSender", chain: this.#chain, address, alias });
  }

  async getAddressBook() {
    return this.#execute({ kind: "aztec_getAddressBook", chain: this.#chain });
  }

  async getChainInfo() {
    return this.#execute({ kind: "aztec_getChainInfo", chain: this.#chain });
  }

  async getPrivateEvents(eventMetadata: unknown, eventFilter: unknown) {
    return this.#execute({
      kind: "aztec_getPrivateEvents",
      chain: this.#chain,
      eventMetadata,
      eventFilter,
    });
  }

  async simulateTx(exec: unknown, opts?: Record<string, unknown>) {
    const account = this.#findAccount((opts?.from as { toString(): string } | undefined)?.toString());
    // Strip paymentMethod from fee — Azguard manages fees via its own UI
    const cleanOpts = this.#stripFeePaymentMethod(opts);
    return this.#execute({ kind: "aztec_simulateTx", account, exec, opts: cleanOpts });
  }

  async executeUtility(call: unknown, opts?: Record<string, unknown>) {
    const account = this.#findAccount((opts?.scope as { toString(): string } | undefined)?.toString());
    const cleanOpts = this.#stripFeePaymentMethod(opts);
    return this.#execute({ kind: "aztec_executeUtility", account, call, opts: cleanOpts });
  }

  async profileTx(exec: unknown, opts?: Record<string, unknown>) {
    const account = this.#findAccount((opts?.from as { toString(): string } | undefined)?.toString());
    const cleanOpts = this.#stripFeePaymentMethod(opts);
    return this.#execute({ kind: "aztec_profileTx", account, exec, opts: cleanOpts });
  }

  async sendTx(exec: unknown, opts?: Record<string, unknown>) {
    const account = this.#findAccount((opts?.from as { toString(): string } | undefined)?.toString());
    // Strip paymentMethod — Azguard shows its own fee UI ("Pay fee with: Fee Juice")
    const cleanOpts = this.#stripFeePaymentMethod(opts);
    return this.#execute({ kind: "aztec_sendTx", account, exec, opts: cleanOpts });
  }

  async createAuthWit(from: AztecAddress, messageHashOrIntent: unknown) {
    const account = this.#findAccount(from?.toString());
    return this.#execute({ kind: "aztec_createAuthWit", account, messageHashOrIntent });
  }

  async requestCapabilities(_manifest: unknown) {
    return {};
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  async #ensureConnected(dappName: string) {
    if (!this.#azguard.connected) {
      await this.#azguard.connect(
        { name: dappName },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [{ chains: [this.#chain], methods: AZTEC_METHODS }] as any,
      );
    }
  }

  async #execute(operation: Record<string, unknown>): Promise<unknown> {
    await this.#ensureConnected("Honkers");
    const [result] = await this.#azguard.execute([operation as never]);
    if (result.status === "failed") throw new Error(`Azguard: ${result.error}`);
    if (result.status === "skipped") throw new Error("Azguard operation was skipped");
    return result.result;
  }

  #stripFeePaymentMethod(opts?: Record<string, unknown>): Record<string, unknown> {
    if (!opts) return {};
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { fee: _fee, ...rest } = opts;
    return rest;
  }

  #findAccount(addressStr?: string): string {
    if (!addressStr) {
      const first = this.#azguard.accounts[0];
      if (!first) throw new Error("No authorized accounts in Azguard");
      return first;
    }
    const match = this.#azguard.accounts.find((a) => a.endsWith(addressStr));
    if (!match) throw new Error(`Unauthorized account: ${addressStr}`);
    return match;
  }
}

// Cast to Wallet for use in WalletContext.
// The method signatures are structurally compatible with Wallet in 4.2.0.
export function asWallet(w: AzguardWallet): Wallet {
  return w as unknown as Wallet;
}
