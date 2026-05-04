#!/usr/bin/env tsx
// Registers SponsoredFPC with the CLI wallet's persistent PXE
// so it can be used as a fee payment method in subsequent CLI commands.

import { createAztecNodeClient } from "@aztec/aztec.js/node";
import { Fr } from "@aztec/aztec.js/fields";
import { getContractInstanceFromInstantiationParams } from "@aztec/stdlib/contract";
import { SponsoredFPCContractArtifact } from "@aztec/noir-contracts.js/SponsoredFPC";
import { createPXE } from "@aztec/pxe/server";
import { getPXEConfig } from "@aztec/pxe/config";
import { homedir } from "os";
import { join } from "path";

const NODE_URL = process.env.AZTEC_RPC_URL || "https://rpc.testnet.aztec-labs.com";
const DATA_DIR = join(homedir(), ".aztec", "wallet", "pxe");

console.log("Connecting to node:", NODE_URL);
const aztecNode = createAztecNodeClient(NODE_URL);

const l1Contracts = await aztecNode.getL1ContractAddresses();
const config = getPXEConfig();
config.l1Contracts = l1Contracts;
config.proverEnabled = false;

// Use the same data directory as the CLI wallet
const { createStore } = await import("@aztec/kv-store/dest/lmdb/index.js" as never);
const store = await (createStore as Function)("pxe_data", { dataDirectory: DATA_DIR, mapSizeKb: 128 * 1024 * 1024 });
const pxe = await createPXE(aztecNode, config, store as never);

const fpcInstance = await getContractInstanceFromInstantiationParams(
  SponsoredFPCContractArtifact,
  { salt: Fr.ZERO }
);
console.log("SponsoredFPC address:", fpcInstance.address.toString());

try {
  await (pxe as { registerContract: (...args: unknown[]) => Promise<void> }).registerContract({
    instance: fpcInstance,
    artifact: SponsoredFPCContractArtifact,
  });
  console.log("✓ SponsoredFPC registered with wallet PXE");
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("already")) {
    console.log("✓ SponsoredFPC already registered");
  } else {
    throw e;
  }
}
