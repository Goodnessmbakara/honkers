#!/usr/bin/env tsx
// ---------------------------------------------------------------------------
// create-market.ts — Create a market on the Honkers MarketFactory contract
//
// Usage:
//   cd /workspaces/honkers && npx tsx tests/integration/src/create-market.ts
// ---------------------------------------------------------------------------

import { createAztecNodeClient } from "@aztec/aztec.js/node";
import { Fr } from "@aztec/aztec.js/fields";
import { AccountManager } from "@aztec/aztec.js/wallet";
import { SchnorrAccountContract } from "@aztec/accounts/schnorr";
import { deriveSigningKey } from "@aztec/stdlib/keys";
import { createPXE } from "@aztec/pxe/server";
import { getPXEConfig } from "@aztec/pxe/config";
import { createHash } from "crypto";

import { MarketFactoryContract } from "./artifacts/MarketFactory.js";
import { OracleContract } from "./artifacts/Oracle.js";

const NODE_URL = process.env.AZTEC_RPC_URL || "http://localhost:8080";
const ADMIN_SECRET = Fr.fromHexString(
  process.env.ADMIN_SECRET ||
    "0x2153536ff6628eee01cf4024889ff977a18d9fa61d0e414422f7681cf085c281"
);

// Market parameters
const QUESTION = "Will Bola Ahmed Tinubu win the 2027 Nigerian Presidential Election?";
const CRITERIA = "Resolves YES if Bola Ahmed Tinubu is declared winner of the 2027 Nigerian Presidential Election by INEC (Independent National Electoral Commission). Resolves NO otherwise.";
const SOURCE = "Official INEC declaration at https://www.inecnigeria.org";
const END_DATE_ISO = "2027-03-15T00:00:00Z"; // Nigerian elections typically in Feb/Mar
const BOND_AMOUNT = 100_000_000n; // 100 USDC (6 decimals)

function hashString(s: string): Fr {
  const hash = createHash("sha256").update(s).digest();
  // Take first 31 bytes to fit in a field element (< 254 bits)
  const truncated = hash.subarray(0, 31);
  return new Fr(BigInt("0x" + Buffer.from(truncated).toString("hex")));
}

async function main() {
  console.log("=== Honkers Market Creator ===\n");

  // ── Step 1: Connect to Aztec node
  console.log(`Connecting to Aztec node @ ${NODE_URL}...`);
  const aztecNode = createAztecNodeClient(NODE_URL);

  // ── Step 2: Create local PXE
  console.log("Creating local PXE...");
  const l1Contracts = await aztecNode.getL1ContractAddresses();
  const config = getPXEConfig();
  config.l1Contracts = l1Contracts;
  config.proverEnabled = false;
  const pxe = await createPXE(aztecNode, config);

  // ── Step 3: Create admin wallet (same as deploy.ts)
  console.log("Setting up admin wallet...");
  const signingKey = deriveSigningKey(ADMIN_SECRET);
  const accountContract = new SchnorrAccountContract(signingKey);
  const salt = Fr.ZERO;

  const { BaseWallet } = await import("@aztec/wallet-sdk/base-wallet");
  const { SignerlessAccount } = await import("@aztec/aztec.js/account");
  const { AztecAddress } = await import("@aztec/aztec.js/addresses");

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
  console.log(`  Admin: ${adminAddress}`);

  // ── Step 4: Read contract addresses from env
  const { readFileSync } = await import("fs");
  const { join } = await import("path");
  const envPath = join(import.meta.dirname, "..", "..", "..", "frontend", ".env");
  const envContent = readFileSync(envPath, "utf-8");
  const envVars: Record<string, string> = {};
  for (const line of envContent.split("\n")) {
    const [k, ...v] = line.split("=");
    if (k && v.length) envVars[k.trim()] = v.join("=").trim();
  }

  const marketFactoryAddr = AztecAddress.fromString(envVars.VITE_MARKET_FACTORY_ADDRESS);
  const oracleAddr = AztecAddress.fromString(envVars.VITE_ORACLE_ADDRESS);

  // ── Step 5: Register contracts with PXE
  const marketFactoryArtifact = MarketFactoryContract.artifact;
  const oracleArtifact = OracleContract.artifact;

  // Register contract classes first, then instances
  await pxe.registerContractClass(marketFactoryArtifact);
  await pxe.registerContractClass(oracleArtifact);

  // Fetch deployed instances from the node
  const { getContractInstanceFromDeployParams } = await import("@aztec/aztec.js/deployment");

  const mfInstance = await aztecNode.getContract(marketFactoryAddr);
  if (mfInstance) {
    await pxe.registerContract({ instance: mfInstance, artifact: marketFactoryArtifact });
  } else {
    console.error("MarketFactory not found on chain at", marketFactoryAddr.toString());
    process.exit(1);
  }

  const oracleInstance = await aztecNode.getContract(oracleAddr);
  if (oracleInstance) {
    await pxe.registerContract({ instance: oracleInstance, artifact: oracleArtifact });
  } else {
    console.error("Oracle not found on chain at", oracleAddr.toString());
    process.exit(1);
  }

  const marketFactory = MarketFactoryContract.at(marketFactoryAddr, wallet);
  const oracle = OracleContract.at(oracleAddr, wallet);

  // ── Step 6: Create market
  // (Whitelist requirement removed from MarketFactory — any caller can create.)

  const questionHash = hashString(QUESTION);
  const criteriaHash = hashString(CRITERIA);
  const sourceHash = hashString(SOURCE);
  const endDate = BigInt(Math.floor(new Date(END_DATE_ISO).getTime() / 1000));

  console.log(`\nCreating market:`);
  console.log(`  Question: ${QUESTION}`);
  console.log(`  End date: ${END_DATE_ISO}`);
  console.log(`  Bond:     ${Number(BOND_AMOUNT) / 1e6} USDC`);
  console.log(`  Q hash:   ${questionHash}`);
  console.log(`  C hash:   ${criteriaHash}`);
  console.log(`  S hash:   ${sourceHash}`);

  const result = await marketFactory.methods
    .create_market(
      questionHash,
      criteriaHash,
      sourceHash,
      new Fr(endDate),
      new Fr(BOND_AMOUNT),
    )
    .send({ from: adminAddress });

  console.log(`\n  Market created! tx: ${(result as any).txHash ?? 'sent'}`);

  // ── Step 7: Read back market ID (best effort)
  let marketId = 1; // default for first market
  try {
    const nextId = await marketFactory.methods.get_next_market_id().simulate();
    marketId = Number(nextId) - 1;
  } catch {
    console.log("  (Could not read market ID via simulate, defaulting to 1)");
  }
  console.log(`  Market ID: ${marketId}`);

  // ── Step 8: Register market on Oracle
  console.log(`\nRegistering market ${marketId} on Oracle...`);
  await oracle.methods
    .register_market(new Fr(marketId), new Fr(endDate))
    .send({ from: adminAddress });
  console.log("  Market registered on Oracle ✓");

  console.log("\n=== Done ===");
  console.log(`Market "${QUESTION}" created with ID ${marketId}`);
  console.log(`End date: ${END_DATE_ISO}`);
  console.log(`Resolution source: ${SOURCE}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
