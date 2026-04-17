#!/usr/bin/env tsx
// ---------------------------------------------------------------------------
// whitelist.ts — Whitelist an address on the MarketFactory contract
//
// Usage:
//   npx tsx tests/integration/src/whitelist.ts <address-to-whitelist>
// ---------------------------------------------------------------------------

import { createAztecNodeClient } from "@aztec/aztec.js/node";
import { Fr } from "@aztec/aztec.js/fields";
import { AccountManager } from "@aztec/aztec.js/wallet";
import { SchnorrAccountContract } from "@aztec/accounts/schnorr";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee";
import { deriveSigningKey } from "@aztec/stdlib/keys";
import { getContractInstanceFromInstantiationParams } from "@aztec/stdlib/contract";
import { createPXE } from "@aztec/pxe/server";
import { getPXEConfig } from "@aztec/pxe/config";
import { SponsoredFPCContractArtifact } from "@aztec/noir-contracts.js/SponsoredFPC";
import { AztecAddress } from "@aztec/aztec.js/addresses";

import { MarketFactoryContract } from "./artifacts/MarketFactory.js";

const NODE_URL = process.env.AZTEC_RPC_URL || "http://localhost:8080";
const ADMIN_SECRET = Fr.fromHexString(
  process.env.ADMIN_SECRET ||
    "0x2153536ff6628eee01cf4024889ff977a18d9fa61d0e414422f7681cf085c281"
);

const TARGET_ADDRESS = process.argv[2];
if (!TARGET_ADDRESS) {
  console.error("Usage: npx tsx tests/integration/src/whitelist.ts <address>");
  process.exit(1);
}

async function main() {
  console.log(`Whitelisting ${TARGET_ADDRESS}...\n`);

  const aztecNode = createAztecNodeClient(NODE_URL);
  const l1Contracts = await aztecNode.getL1ContractAddresses();
  const config = getPXEConfig();
  config.l1Contracts = l1Contracts;
  config.proverEnabled = false;
  const pxe = await createPXE(aztecNode, config);

  // Create admin wallet (same as deploy.ts)
  const signingKey = deriveSigningKey(ADMIN_SECRET);
  const accountContract = new SchnorrAccountContract(signingKey);
  const salt = Fr.ZERO;

  const { BaseWallet } = await import("@aztec/wallet-sdk/base-wallet");
  const { SignerlessAccount } = await import("@aztec/aztec.js/account");

  class AdminWallet extends BaseWallet {
    private accounts = new Map<string, any>();
    constructor(pxeInst: any, node: any) {
      super(pxeInst, node);
    }
    addAccount(account: any) {
      this.accounts.set(account.getAddress().toString(), account);
    }
    protected async getAccountFromAddress(address: any) {
      if (address.equals(AztecAddress.ZERO)) return new SignerlessAccount();
      const acct = this.accounts.get(address.toString());
      if (!acct) throw new Error(`Account not found: ${address}`);
      return acct;
    }
  }

  const wallet = new AdminWallet(pxe, aztecNode);
  const accountManager = await AccountManager.create(wallet, ADMIN_SECRET, accountContract, salt);

  const account = await accountManager.getAccount();
  const instance = accountManager.getInstance();
  const artifact = await accountManager.getAccountContract().getContractArtifact();
  await wallet.registerContract(instance, artifact, accountManager.getSecretKey());
  wallet.addAccount(account);

  const adminAddress = account.getAddress();
  console.log(`Admin: ${adminAddress}`);

  // Sponsored FPC
  const sponsoredFPCInstance = await getContractInstanceFromInstantiationParams(
    SponsoredFPCContractArtifact,
    { salt: Fr.ZERO },
  );
  await wallet.registerContract(sponsoredFPCInstance, SponsoredFPCContractArtifact);
  const paymentMethod = new SponsoredFeePaymentMethod(sponsoredFPCInstance.address);

  // Get MarketFactory contract
  const factoryAddress = AztecAddress.fromString(
    process.env.MARKET_FACTORY_ADDRESS || ""
  );

  // Register the MarketFactory artifact directly — the PXE just needs the
  // artifact + address to build tx requests. Use getContractInstanceFromInstantiationParams
  // or just register with Contract.at pattern (it auto-registers on interaction).
  // For methods to work, we need the artifact registered in the PXE.
  const { getContractInstanceFromInstantiationParams: getInst } = await import("@aztec/stdlib/contract");
  // Just register the class artifact so PXE knows how to encode calls
  await pxe.registerContractClass(MarketFactoryContract.artifact);
  // Also register the deployed instance by fetching from the PXE's node view
  const instResult = await pxe.getContractInstance(factoryAddress);
  if (instResult) {
    await wallet.registerContract(instResult, MarketFactoryContract.artifact);
  } else {
    // Manually register: create a stub instance entry
    console.log("  Contract instance not in PXE, using Contract.at directly...");
  }

  const factory = MarketFactoryContract.at(factoryAddress, wallet);

  // Whitelist the target address
  const target = AztecAddress.fromString(TARGET_ADDRESS);
  console.log(`Calling add_to_whitelist(${target})...`);
  await factory.methods.add_to_whitelist(target).send({
    from: adminAddress,
    fee: { paymentMethod },
  });
  console.log("Done! Address whitelisted.");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
