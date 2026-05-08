// ---------------------------------------------------------------------------
// Embedded browser PXE singleton — lazy-initialized, persistent IndexedDB.
// Mirrors the defi-wonderland/aztec-web-boilerplate pattern.
//
// Use getOrCreateEmbeddedPXE(nodeUrl) to get a SharedPXEInstance.
// Use resetEmbeddedPXEState() to nuke stale data on sandbox restart.
// ---------------------------------------------------------------------------

import type { AztecNode } from "@aztec/aztec.js/node";
import type { PXE } from "@aztec/pxe/server";
import type { MinimalWallet } from "./MinimalWallet";

export interface SharedPXEInstance {
  pxe: PXE;
  aztecNode: AztecNode;
  wallet: MinimalWallet;
}

let pxePromise: Promise<SharedPXEInstance> | null = null;

const PXE_DB_NAME = "pxe/aztec-pxe-honkers";
const ROLLUP_KEY = "honkers:rollup-address";

async function nukeStaleDB() {
  const dbs = await indexedDB.databases?.();
  const targets = dbs
    ? dbs.filter((d) => d.name && (d.name.includes("aztec") || d.name.startsWith("pxe")))
    : [{ name: PXE_DB_NAME }];
  for (const db of targets) {
    if (db.name) {
      console.log(`[pxe] Deleting stale IndexedDB: ${db.name}`);
      indexedDB.deleteDatabase(db.name);
    }
  }
}

export async function resetEmbeddedPXEState() {
  pxePromise = null;
  await nukeStaleDB();
  // Clear ALL wallet-related localStorage so the next session gets a clean slate.
  // Failing to clear vault-wrap-key or wallet-secret-v2 causes loadDecryptedSecretHex()
  // to return null on next connect → random new secret → undeployed account → self.is_some().
  localStorage.removeItem("honkers:wallet-address");
  localStorage.removeItem("honkers:wallet-secret");
  localStorage.removeItem("honkers:wallet-secret-v2");
  localStorage.removeItem("honkers:vault-wrap-key");
  localStorage.removeItem(ROLLUP_KEY);
}

export async function getOrCreateEmbeddedPXE(nodeUrl: string): Promise<SharedPXEInstance> {
  if (pxePromise) return pxePromise;

  pxePromise = (async () => {
    const t0 = performance.now();
    const elapsed = () => `${((performance.now() - t0) / 1000).toFixed(1)}s`;

    console.log(`[pxe] [${elapsed()}] Importing aztec modules…`);
    const [
      { createAztecNodeClient },
      { createPXE },
      { getPXEConfig },
      { createStore },
    ] = await Promise.all([
      import("@aztec/aztec.js/node"),
      import("@aztec/pxe/client/bundle"),
      import("@aztec/pxe/config"),
      import("@aztec/kv-store/indexeddb"),
    ]);

    console.log(`[pxe] [${elapsed()}] Connecting to Aztec node @ ${nodeUrl}…`);
    const aztecNode = createAztecNodeClient(nodeUrl);
    const l1Contracts = await aztecNode.getL1ContractAddresses();
    const rollupAddr = l1Contracts.rollupAddress.toString();
    console.log(`[pxe] [${elapsed()}] Node connected ✓ rollup=${rollupAddr}`);

    const prevRollup = localStorage.getItem(ROLLUP_KEY);
    if (prevRollup && prevRollup !== rollupAddr) {
      console.warn(`[pxe] Sandbox restarted! Clearing stale PXE database…`);
      await nukeStaleDB();
      localStorage.removeItem("honkers:wallet-address");
      localStorage.removeItem("honkers:wallet-secret");
    } else if (!prevRollup) {
      const dbs = await indexedDB.databases?.();
      const hasExistingDB = dbs?.some(
        (d) => d.name && (d.name.includes("aztec") || d.name.startsWith("pxe"))
      );
      if (hasExistingDB) {
        console.warn("[pxe] First run with rollup tracking — clearing potentially stale PXE data");
        await nukeStaleDB();
        localStorage.removeItem("honkers:wallet-address");
        localStorage.removeItem("honkers:wallet-secret");
      }
    }
    localStorage.setItem(ROLLUP_KEY, rollupAddr);

    const config = getPXEConfig();
    config.l1Contracts = l1Contracts;
    config.proverEnabled = false;

    console.log(`[pxe] [${elapsed()}] Creating IndexedDB store…`);
    const pxeStore = await createStore(
      "aztec-pxe-honkers",
      { dataDirectory: "pxe", dataStoreMapSizeKb: 100_000 },
      undefined,
      undefined,
    );
    console.log(`[pxe] [${elapsed()}] IndexedDB store ready ✓`);

    console.log(`[pxe] [${elapsed()}] Creating PXE (bundle)…`);
    const pxe = await createPXE(aztecNode, config, { store: pxeStore });
    console.log(`[pxe] [${elapsed()}] PXE running ✓`);

    const { MinimalWallet } = await import("./MinimalWallet");
    const wallet = new MinimalWallet(pxe as never, aztecNode);

    return { pxe, aztecNode, wallet };
  })();

  pxePromise.catch((err) => {
    console.error("[pxe] FAILED:", err);
    pxePromise = null;
  });

  return pxePromise;
}
