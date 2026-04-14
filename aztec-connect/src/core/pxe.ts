// ---------------------------------------------------------------------------
// @honkers/aztec-connect — Core: PXE singleton
//
// Creates a single in-browser PXE instance backed by IndexedDB.
// Expensive to initialize (WASM compile + node handshake), so it's cached
// as a module-level promise. Safe to call from multiple components.
// ---------------------------------------------------------------------------

import type { AztecNode } from "@aztec/aztec.js/node";
import type { PXE } from "@aztec/pxe/server";
import { MinimalWallet } from "./MinimalWallet";

export interface AztecInstance {
  pxe: PXE;
  aztecNode: AztecNode;
  wallet: MinimalWallet;
}

export interface CreatePXEOptions {
  /** IndexedDB database name. Default: "aztec-pxe" */
  dbName?: string;
  /** IndexedDB store size in KB. Default: 100_000 (100 MB) */
  dbSizeKb?: number;
  /** Enable local proving. Default: false (faster dev iteration) */
  proverEnabled?: boolean;
  /** Called with progress messages during init */
  onProgress?: (msg: string) => void;
}

let instancePromise: Promise<AztecInstance> | null = null;

/**
 * Create (or return existing) in-browser PXE singleton.
 *
 * @param nodeUrl - JSON-RPC URL of the Aztec L2 node (e.g. "/rpc" or "http://localhost:8080")
 * @param opts    - Optional configuration
 *
 * @example
 * ```ts
 * import { getOrCreatePXE } from "@honkers/aztec-connect";
 * const { pxe, wallet } = await getOrCreatePXE("/rpc");
 * ```
 */
export async function getOrCreatePXE(
  nodeUrl: string,
  opts: CreatePXEOptions = {},
): Promise<AztecInstance> {
  if (instancePromise) return instancePromise;

  const {
    dbName = "aztec-pxe",
    dbSizeKb = 100_000,
    proverEnabled = false,
    onProgress,
  } = opts;

  instancePromise = (async () => {
    const t0 = performance.now();
    const elapsed = () => `${((performance.now() - t0) / 1000).toFixed(1)}s`;
    const log = (msg: string) => {
      const m = `[aztec-connect] [${elapsed()}] ${msg}`;
      onProgress?.(m);
      console.log(m);
    };

    // ── Dynamic imports (keeps initial bundle small) ───────────────────
    log("Importing Aztec modules...");
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
    log("Modules imported ✓");

    // ── Connect to L2 node ─────────────────────────────────────────────
    log(`Connecting to Aztec node @ ${nodeUrl}...`);
    const aztecNode = createAztecNodeClient(nodeUrl);
    const l1Contracts = await aztecNode.getL1ContractAddresses();
    log(`Node connected ✓ rollup=${l1Contracts.rollupAddress}`);

    // ── PXE config ─────────────────────────────────────────────────────
    const config = getPXEConfig();
    config.l1Contracts = l1Contracts;
    config.proverEnabled = proverEnabled;

    // ── IndexedDB store ────────────────────────────────────────────────
    log("Creating IndexedDB store...");
    const pxeStore = await createStore(
      dbName,
      { dataDirectory: "pxe", dataStoreMapSizeKb: dbSizeKb },
      undefined,
      undefined,
    );
    log("IndexedDB store ready ✓");

    // ── Create PXE ─────────────────────────────────────────────────────
    log("Creating PXE (WASM bundle)...");
    const pxe = await createPXE(aztecNode, config, { store: pxeStore });
    log("PXE running ✓");

    // ── MinimalWallet bridge ───────────────────────────────────────────
    const wallet = new MinimalWallet(pxe, aztecNode);
    log("Ready ✓");

    return { pxe, aztecNode, wallet } satisfies AztecInstance;
  })();

  instancePromise.catch(() => {
    instancePromise = null; // allow retry on next call
  });

  return instancePromise;
}

/** Destroy the cached PXE instance (for testing / cleanup). */
export function resetPXE(): void {
  instancePromise = null;
}
