#!/usr/bin/env tsx
// Quick debug: what does get_market_info().simulate() actually return?
import { createAztecNodeClient } from "@aztec/aztec.js/node";
import { Fr } from "@aztec/aztec.js/fields";
import { AccountManager } from "@aztec/aztec.js/wallet";
import { SchnorrAccountContract } from "@aztec/accounts/schnorr";
import { deriveSigningKey } from "@aztec/stdlib/keys";
import { createPXE } from "@aztec/pxe/server";
import { getPXEConfig } from "@aztec/pxe/config";
import { MarketFactoryContract } from "./artifacts/MarketFactory.js";

const NODE_URL = "http://localhost:8080";
const ADMIN_SECRET = Fr.fromHexString("0x2153536ff6628eee01cf4024889ff977a18d9fa61d0e414422f7681cf085c281");

async function main() {
  const aztecNode = createAztecNodeClient(NODE_URL);
  const l1Contracts = await aztecNode.getL1ContractAddresses();
  const config = getPXEConfig();
  config.l1Contracts = l1Contracts;
  config.proverEnabled = false;
  const pxe = await createPXE(aztecNode, config);

  const signingKey = deriveSigningKey(ADMIN_SECRET);
  const accountContract = new SchnorrAccountContract(signingKey);
  const { BaseWallet } = await import("@aztec/wallet-sdk/base-wallet");
  const { SignerlessAccount } = await import("@aztec/aztec.js/account");
  const { AztecAddress } = await import("@aztec/aztec.js/addresses");

  class W extends BaseWallet {
    private accounts = new Map<string, any>();
    constructor(p: any, n: any) { super(p, n); }
    addAccount(a: any) { this.accounts.set(a.getAddress().toString(), a); }
    protected async getAccountFromAddress(address: any) {
      if (address.equals(AztecAddress.ZERO)) return new SignerlessAccount();
      const acct = this.accounts.get(address.toString());
      if (!acct) throw new Error(`Account not found: ${address}`);
      return acct;
    }
  }

  const wallet = new W(pxe, aztecNode);
  const am = await AccountManager.create(wallet, ADMIN_SECRET, accountContract, Fr.ZERO);
  const account = await am.getAccount();
  await wallet.registerContract(am.getInstance(), await am.getAccountContract().getContractArtifact(), am.getSecretKey());
  wallet.addAccount(account);

  // Read .env
  const { readFileSync } = await import("fs");
  const { join } = await import("path");
  const envPath = join(import.meta.dirname, "..", "..", "..", "frontend", ".env");
  const envVars: Record<string, string> = {};
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const [k, ...v] = line.split("=");
    if (k && v.length) envVars[k.trim()] = v.join("=").trim();
  }

  const factoryAddr = AztecAddress.fromString(envVars.VITE_MARKET_FACTORY_ADDRESS);
  await pxe.registerContractClass(MarketFactoryContract.artifact);
  const inst = await aztecNode.getContract(factoryAddr);
  if (inst) await pxe.registerContract({ instance: inst, artifact: MarketFactoryContract.artifact });

  const factory = MarketFactoryContract.at(factoryAddr, wallet);

  // Test get_next_market_id
  const nextIdRaw = await factory.methods.get_next_market_id().simulate();
  console.log("\n=== get_next_market_id() ===");
  console.log("typeof:", typeof nextIdRaw);
  console.log("value:", nextIdRaw);
  console.log("JSON:", JSON.stringify(nextIdRaw, (_, v) => typeof v === "bigint" ? `BigInt(${v})` : v));

  const nextId = Number(nextIdRaw);
  console.log("as Number:", nextId);

  if (nextId > 1) {
    const infoRaw = await factory.methods.get_market_info(1).simulate();
    console.log("\n=== get_market_info(1) ===");
    console.log("typeof:", typeof infoRaw);
    console.log("isArray:", Array.isArray(infoRaw));
    console.log("value:", infoRaw);
    console.log("JSON:", JSON.stringify(infoRaw, (_, v) => typeof v === "bigint" ? `BigInt(${v})` : v));
    
    if (typeof infoRaw === "object" && infoRaw != null) {
      console.log("keys:", Object.keys(infoRaw as object));
      console.log("values:", Object.values(infoRaw as object));
      const vals = Array.isArray(infoRaw) ? infoRaw : Object.values(infoRaw as object);
      for (let i = 0; i < vals.length; i++) {
        const v = vals[i];
        console.log(`  [${i}] typeof=${typeof v}, isObj=${typeof v === 'object' && v !== null}, val=${v}, hasToString=${typeof v?.toString === 'function'}, hasToBigInt=${typeof v?.toBigInt === 'function'}`);
        if (typeof v === 'object' && v !== null) {
          console.log(`       keys=${Object.keys(v)}, values=${Object.values(v)}`);
        }
      }
    }
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
