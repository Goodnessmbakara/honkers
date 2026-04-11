// ---------------------------------------------------------------------------
// useAztecWallet — Shared PXE + in-browser wallet for Aztec v4.1.3
//
// Follows the defi-wonderland/aztec-web-boilerplate pattern:
//   • createPXE from @aztec/pxe/client/bundle (pre-bundles protocol contracts)
//   • createStore for persistent IndexedDB storage
//   • proverEnabled=false (no local ZK proving for sandbox dev)
//   • Lazy singleton: PXE created once on first call, reused thereafter
//
// Root cause of the v4.1.3 hang:
//   Vite's dep optimizer rewrites `import.meta.url` in @aztec/noir-acvm_js and
//   @aztec/noir-noirc_abi, breaking the relative `new URL('...bg.wasm', import.meta.url)`
//   that wasm-bindgen uses to fetch the WASM binary → fetch() hangs indefinitely.
//   Fix: Add those packages to `optimizeDeps.exclude` in vite.config.ts.
// ---------------------------------------------------------------------------

import { createContext, useContext } from "react";
import type { AztecNode } from "@aztec/aztec.js/node";
import type { PXE } from "@aztec/pxe/server";
import type { MinimalWallet } from "../utils/MinimalWallet";

export type { PXE };

export interface SharedPXEInstance {
  pxe: PXE;
  aztecNode: AztecNode;
  wallet: MinimalWallet;
}

export interface AztecWalletContext {
  pxeInstance: SharedPXEInstance | null;
  loading: boolean;
  error: string | null;
}

export const AztecWalletCtx = createContext<AztecWalletContext>({
  pxeInstance: null,
  loading: false,
  error: null,
});

export function useAztecWallet() {
  return useContext(AztecWalletCtx);
}

// ---------------------------------------------------------------------------
// Singleton PXE service — mirrors SharedPXEService from boilerplate
// ---------------------------------------------------------------------------
let pxePromise: Promise<SharedPXEInstance> | null = null;

export async function getOrCreatePXE(nodeUrl: string): Promise<SharedPXEInstance> {
  if (pxePromise) return pxePromise;

  pxePromise = (async () => {
    const t0 = performance.now();
    const elapsed = () => `${((performance.now() - t0) / 1000).toFixed(1)}s`;

    // ── Step 1: Dynamic imports ─────────────────────────────────────────────
    // These are lazy so Vite doesn't pre-bundle @aztec/pxe/client/bundle
    // before the WASM exclusions have taken effect.
    console.log(`[pxe] [${elapsed()}] Importing aztec modules...`);
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
    console.log(`[pxe] [${elapsed()}] Modules imported ✓`);

    // ── Step 2: Connect to Aztec node ───────────────────────────────────────
    console.log(`[pxe] [${elapsed()}] Connecting to Aztec node @ ${nodeUrl}...`);
    const aztecNode = createAztecNodeClient(nodeUrl);
    const l1Contracts = await aztecNode.getL1ContractAddresses();
    console.log(`[pxe] [${elapsed()}] Node connected ✓ rollup=${l1Contracts.rollupAddress}`);

    // ── Step 3: PXE config ──────────────────────────────────────────────────
    const config = getPXEConfig();
    config.l1Contracts = l1Contracts;
    // v4.1.3 note: proverEnabled is read by PXE.create() for simulation modes.
    // createPXE() always instantiates BBBundlePrivateKernelProver regardless —
    // that prover only does heavy WASM work when createChonkProof() is called
    // (during transaction submission), NOT during init.
    config.proverEnabled = false;

    // ── Step 4: Persistent IndexedDB store ──────────────────────────────────
    console.log(`[pxe] [${elapsed()}] Creating IndexedDB store...`);
    const pxeStore = await createStore(
      "aztec-pxe-honkers",
      {
        dataDirectory: "pxe",
        dataStoreMapSizeKb: 100_000, // 100MB — same as boilerplate fallback
      },
      undefined,
      undefined,
    );
    console.log(`[pxe] [${elapsed()}] IndexedDB store ready ✓`);

    // ── Step 5: Create PXE ──────────────────────────────────────────────────
    console.log(`[pxe] [${elapsed()}] Creating PXE (bundle)...`);
    const pxe = await createPXE(aztecNode, config, { store: pxeStore });
    console.log(`[pxe] [${elapsed()}] PXE running ✓`);

    // ── Step 6: Create MinimalWallet Bridge ─────────────────────────────────
    // Bridging PXE to the Wallet interface required by AccountManager
    const { MinimalWallet } = await import("../utils/MinimalWallet");
    const wallet = new MinimalWallet(pxe, aztecNode);

    return { pxe, aztecNode, wallet };
  })();

  pxePromise.catch((err) => {
    console.error("[pxe] FAILED:", err);
    pxePromise = null; // Allow retry on next call
  });

  return pxePromise;
}
