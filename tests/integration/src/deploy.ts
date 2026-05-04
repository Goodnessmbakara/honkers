#!/usr/bin/env tsx
// ---------------------------------------------------------------------------
// deploy.ts — Deploy all Honkers contracts to the Aztec sandbox
//
// Two-phase deployment:
//   Phase 1: Deploy all 5 contracts (admin-only constructors)
//   Phase 2: Wire dependencies via set_dependencies() calls
//
// Usage:
//   cd /workspaces/honkers && npx tsx scripts/deploy.ts
// ---------------------------------------------------------------------------

import { createAztecNodeClient } from "@aztec/aztec.js/node";
import { Fr } from "@aztec/aztec.js/fields";
import { AccountManager } from "@aztec/aztec.js/wallet";
import { NO_FROM } from "@aztec/aztec.js/account";
import { SchnorrAccountContract } from "@aztec/accounts/schnorr";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee";
import { deriveSigningKey } from "@aztec/stdlib/keys";
import { getContractInstanceFromInstantiationParams } from "@aztec/stdlib/contract";
import { createPXE } from "@aztec/pxe/server";
import { getPXEConfig } from "@aztec/pxe/config";
import { SponsoredFPCContractArtifact } from "@aztec/noir-contracts.js/SponsoredFPC";

import { AMMContract } from "./artifacts/AMM.js";
import { OracleContract } from "./artifacts/Oracle.js";
import { PrivateVaultContract } from "./artifacts/PrivateVault.js";
import { MarketFactoryContract } from "./artifacts/MarketFactory.js";
import { TestTokenContract } from "./artifacts/TestToken.js";

const NODE_URL = process.env.AZTEC_RPC_URL || "http://localhost:8080";
// Use a deterministic admin secret so re-runs produce the same admin address
const ADMIN_SECRET = Fr.fromHexString(
  process.env.ADMIN_SECRET ||
    "0x2153536ff6628eee01cf4024889ff977a18d9fa61d0e414422f7681cf085c281"
);

async function main() {
  console.log("=== Honkers Contract Deployer ===\n");

  // ── Step 1: Connect to Aztec node ────────────────────────────────────
  console.log(`Connecting to Aztec node @ ${NODE_URL}...`);
  const aztecNode = createAztecNodeClient(NODE_URL);
  const nodeInfo = await aztecNode.getNodeInfo();
  console.log(`  Node version: ${nodeInfo.nodeVersion}`);

  // ── Step 2: Create local PXE ─────────────────────────────────────────
  console.log("Creating local PXE...");
  const l1Contracts = await aztecNode.getL1ContractAddresses();
  const config = getPXEConfig();
  config.l1Contracts = l1Contracts;
  config.proverEnabled = false;
  const pxe = await createPXE(aztecNode, config);
  console.log("  PXE ready.");

  // ── Step 3: Create admin wallet ──────────────────────────────────────
  console.log("Setting up admin wallet...");
  const signingKey = deriveSigningKey(ADMIN_SECRET);
  const accountContract = new SchnorrAccountContract(signingKey);
  const salt = Fr.ZERO;

  // BaseWallet bridge for AccountManager (same pattern as MinimalWallet)
  const { BaseWallet } = await import("@aztec/wallet-sdk/base-wallet");

  class DeployerWallet extends BaseWallet {
    private accounts = new Map<string, any>();
    constructor(pxeInst: any, node: any) {
      super(pxeInst, node);
    }
    addAccount(account: any) {
      this.accounts.set(account.getAddress().toString(), account);
    }
    protected async getAccountFromAddress(address: any) {
      const acct = this.accounts.get(address.toString());
      if (!acct) throw new Error(`Account not found: ${address}`);
      return acct;
    }
    async getAccounts() {
      return Array.from(this.accounts.values()).map((acc: any) => ({
        alias: "",
        item: acc.getAddress(),
      }));
    }
  }

  const wallet = new DeployerWallet(pxe, aztecNode);
  const accountManager = await AccountManager.create(
    wallet,
    ADMIN_SECRET,
    accountContract,
    salt
  );

  const account = await accountManager.getAccount();
  const instance = accountManager.getInstance();
  const artifact = await accountManager
    .getAccountContract()
    .getContractArtifact();

  await wallet.registerContract(
    instance,
    artifact,
    accountManager.getSecretKey()
  );
  wallet.addAccount(account);

  const adminAddress = account.getAddress();
  console.log(`  Admin address: ${adminAddress}`);

  // Set up Sponsored FPC — pays fees unconditionally on sandbox/devnet
  console.log("  Setting up Sponsored FPC...");
  const sponsoredFPCInstance = await getContractInstanceFromInstantiationParams(
    SponsoredFPCContractArtifact,
    { salt: Fr.ZERO },
  );
  await wallet.registerContract(sponsoredFPCInstance, SponsoredFPCContractArtifact);
  const paymentMethod = new SponsoredFeePaymentMethod(sponsoredFPCInstance.address);
  console.log(`  Sponsored FPC @ ${sponsoredFPCInstance.address}`);

  const sendOpts = { from: NO_FROM, fee: { paymentMethod } };

  // Deploy the admin account contract if needed — check on-chain, not local PXE store
  if (await accountManager.hasInitializer()) {
    const existing = await aztecNode.getContract(adminAddress);
    if (!existing) {
      console.log("  Deploying admin account contract...");
      const deployMethod = await accountManager.getDeployMethod();
      await deployMethod.send(sendOpts);
      console.log("  Admin account deployed.");
    } else {
      console.log("  Admin account already deployed (on-chain).");
    }
  }

  // Fee recipient = sandbox account 1 (or admin itself for simplicity)
  const feeRecipient = adminAddress;

  const contractSendOpts = { from: adminAddress, fee: { paymentMethod } };

  // ── Phase 1: Deploy contracts (admin-only constructors) ────────────
  console.log("\n--- Phase 1: Deploying contracts ---\n");

  console.log("Deploying TestToken...");
  const token = await TestTokenContract.deploy(
    wallet,
    adminAddress,
    1, // name field (numeric encoding)
    2 // symbol field (numeric encoding)
  ).send(contractSendOpts);
  const tokenAddress = token.address;
  console.log(`  TestToken deployed: ${tokenAddress}`);

  console.log("Deploying AMM...");
  const amm = await AMMContract.deploy(wallet, adminAddress).send(contractSendOpts);
  const ammAddress = amm.address;
  console.log(`  AMM deployed: ${ammAddress}`);

  console.log("Deploying Oracle...");
  const oracle = await OracleContract.deploy(
    wallet,
    adminAddress
  ).send(contractSendOpts);
  const oracleAddress = oracle.address;
  console.log(`  Oracle deployed: ${oracleAddress}`);

  console.log("Deploying PrivateVault...");
  const vault = await PrivateVaultContract.deploy(
    wallet,
    adminAddress,
    feeRecipient
  ).send(contractSendOpts);
  const vaultAddress = vault.address;
  console.log(`  PrivateVault deployed: ${vaultAddress}`);

  console.log("Deploying MarketFactory...");
  const factory = await MarketFactoryContract.deploy(
    wallet,
    adminAddress
  ).send(contractSendOpts);
  const factoryAddress = factory.address;
  console.log(`  MarketFactory deployed: ${factoryAddress}`);

  // ── Phase 2: Wire dependencies ───────────────────────────────────────
  console.log("\n--- Phase 2: Wiring dependencies ---\n");

  console.log("AMM.set_dependencies(vault, oracle)...");
  await amm.methods.set_dependencies(vaultAddress, oracleAddress).send(contractSendOpts);
  console.log("  Done.");

  console.log("Oracle.set_dependencies(amm)...");
  await oracle.methods.set_dependencies(ammAddress).send(contractSendOpts);
  console.log("  Done.");

  console.log("PrivateVault.set_dependencies(token, amm, oracle)...");
  await vault.methods
    .set_dependencies(tokenAddress, ammAddress, oracleAddress)
    .send(contractSendOpts);
  console.log("  Done.");

  console.log("MarketFactory.set_dependencies(amm, oracle, token)...");
  await factory.methods
    .set_dependencies(ammAddress, oracleAddress, tokenAddress)
    .send(contractSendOpts);
  console.log("  Done.");

  // ── Output addresses ─────────────────────────────────────────────────
  console.log("\n=== Deployment Complete ===\n");

  const addresses = {
    ADMIN_ADDRESS: adminAddress.toString(),
    TEST_TOKEN_ADDRESS: tokenAddress.toString(),
    AMM_ADDRESS: ammAddress.toString(),
    ORACLE_ADDRESS: oracleAddress.toString(),
    PRIVATE_VAULT_ADDRESS: vaultAddress.toString(),
    MARKET_FACTORY_ADDRESS: factoryAddress.toString(),
  };

  for (const [key, value] of Object.entries(addresses)) {
    console.log(`${key}=${value}`);
  }

  // Write .env files
  const { writeFileSync } = await import("fs");
  const { join } = await import("path");
  const root = join(import.meta.dirname, "..", "..", "..");

  const frontendEnv = [
    `VITE_AZTEC_RPC_URL=/rpc`,
    `VITE_INDEXER_API_URL=`,
    // ^ Leave empty so the frontend uses the Vite /api proxy (works in Codespace/Docker)
    `VITE_ADMIN_ADDRESS=${addresses.ADMIN_ADDRESS}`,
    `VITE_TEST_TOKEN_ADDRESS=${addresses.TEST_TOKEN_ADDRESS}`,
    `VITE_AMM_ADDRESS=${addresses.AMM_ADDRESS}`,
    `VITE_ORACLE_ADDRESS=${addresses.ORACLE_ADDRESS}`,
    `VITE_PRIVATE_VAULT_ADDRESS=${addresses.PRIVATE_VAULT_ADDRESS}`,
    `VITE_MARKET_FACTORY_ADDRESS=${addresses.MARKET_FACTORY_ADDRESS}`,
  ].join("\n");

  const rootEnv = [
    `AZTEC_RPC_URL=http://localhost:8080`,
    `DATABASE_URL=postgresql://honkers:honkers@localhost:5432/honkers`,
    `ADMIN_ADDRESS=${addresses.ADMIN_ADDRESS}`,
    `TEST_TOKEN_ADDRESS=${addresses.TEST_TOKEN_ADDRESS}`,
    `AMM_ADDRESS=${addresses.AMM_ADDRESS}`,
    `ORACLE_ADDRESS=${addresses.ORACLE_ADDRESS}`,
    `PRIVATE_VAULT_ADDRESS=${addresses.PRIVATE_VAULT_ADDRESS}`,
    `MARKET_FACTORY_ADDRESS=${addresses.MARKET_FACTORY_ADDRESS}`,
  ].join("\n");

  writeFileSync(join(root, "frontend", ".env"), frontendEnv + "\n");
  writeFileSync(join(root, ".env"), rootEnv + "\n");

  console.log("\nWrote frontend/.env and .env");
  console.log("\nDone! You can now start the frontend with: cd frontend && pnpm dev");
}

main().catch((err) => {
  console.error("Deploy failed:", err);
  process.exit(1);
});
