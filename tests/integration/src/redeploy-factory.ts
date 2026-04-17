#!/usr/bin/env tsx
// ---------------------------------------------------------------------------
// redeploy-factory.ts — Redeploy MarketFactory with updated contract code
// and re-wire dependencies. Other contracts stay as-is.
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

async function main() {
  console.log("=== Redeploy MarketFactory ===\n");

  const aztecNode = createAztecNodeClient(NODE_URL);
  const l1Contracts = await aztecNode.getL1ContractAddresses();
  const config = getPXEConfig();
  config.l1Contracts = l1Contracts;
  config.proverEnabled = false;
  const pxe = await createPXE(aztecNode, config);

  const signingKey = deriveSigningKey(ADMIN_SECRET);
  const accountContract = new SchnorrAccountContract(signingKey);
  const salt = Fr.ZERO;

  const { BaseWallet } = await import("@aztec/wallet-sdk/base-wallet");
  const { SignerlessAccount } = await import("@aztec/aztec.js/account");

  class AdminWallet extends BaseWallet {
    private accounts = new Map<string, any>();
    constructor(pxeInst: any, node: any) { super(pxeInst, node); }
    addAccount(account: any) { this.accounts.set(account.getAddress().toString(), account); }
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
    SponsoredFPCContractArtifact, { salt: Fr.ZERO });
  await wallet.registerContract(sponsoredFPCInstance, SponsoredFPCContractArtifact);
  const paymentMethod = new SponsoredFeePaymentMethod(sponsoredFPCInstance.address);
  const sendOpts = { from: adminAddress, fee: { paymentMethod } };

  // Read existing addresses from env
  const ammAddress = process.env.AMM_ADDRESS!;
  const oracleAddress = process.env.ORACLE_ADDRESS!;
  const tokenAddress = process.env.TEST_TOKEN_ADDRESS!;

  // Deploy new MarketFactory with a different salt to get a new address
  console.log("Deploying new MarketFactory...");
  const factoryResult = await MarketFactoryContract.deploy(
    wallet, adminAddress
  ).send(sendOpts);
  const newFactoryAddress = factoryResult.contract.address;
  console.log(`  New MarketFactory: ${newFactoryAddress}`);

  // Wire dependencies
  console.log("Setting dependencies...");
  await factoryResult.contract.methods
    .set_dependencies(
      AztecAddress.fromString(ammAddress),
      AztecAddress.fromString(oracleAddress),
      AztecAddress.fromString(tokenAddress),
    )
    .send(sendOpts);
  console.log("  Done.");

  // Update .env files
  const { writeFileSync, readFileSync } = await import("fs");
  const { join } = await import("path");
  const root = join(import.meta.dirname, "..", "..", "..");

  // Update frontend .env
  const feEnvPath = join(root, "frontend", ".env");
  let feEnv = readFileSync(feEnvPath, "utf-8");
  feEnv = feEnv.replace(/VITE_MARKET_FACTORY_ADDRESS=.*/, `VITE_MARKET_FACTORY_ADDRESS=${newFactoryAddress}`);
  writeFileSync(feEnvPath, feEnv);

  // Update root .env
  const rootEnvPath = join(root, ".env");
  let rootEnv = readFileSync(rootEnvPath, "utf-8");
  rootEnv = rootEnv.replace(/MARKET_FACTORY_ADDRESS=.*/, `MARKET_FACTORY_ADDRESS=${newFactoryAddress}`);
  writeFileSync(rootEnvPath, rootEnv);

  console.log(`\nUpdated .env files with new factory address: ${newFactoryAddress}`);
  console.log("Rebuild frontend to pick up the new address.");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
