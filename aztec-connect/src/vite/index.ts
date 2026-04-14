// ---------------------------------------------------------------------------
// @honkers/aztec-connect/vite — Pre-configured Vite plugin for Aztec
//
// Handles the three biggest pain points:
//   1. Node built-in shims (fs, net, tty) that @aztec/* imports at module level
//   2. optimizeDeps exclude/include dance (WASM URLs vs CJS named exports)
//   3. COOP/COEP headers for SharedArrayBuffer (Barretenberg multi-threading)
//
// Usage:
//   import { aztecVitePlugin } from "@honkers/aztec-connect/vite";
//   export default defineConfig({ plugins: [aztecVitePlugin(), react()] });
// ---------------------------------------------------------------------------

import type { Plugin, UserConfig } from "vite";

// ── Node built-in shim plugin ──────────────────────────────────────────────

function nodeBuiltinsShim(): Plugin {
  return {
    name: "aztec-connect:node-builtins-shim",
    enforce: "pre",
    resolveId(source) {
      if (["fs/promises", "fs", "net", "tty"].includes(source)) {
        return `\0virtual:${source}`;
      }
      return null;
    },
    load(id) {
      if (id === "\0virtual:fs/promises") {
        return `
          export const mkdir = () => Promise.reject(new Error('fs/promises not available in browser'));
          export const writeFile = () => Promise.reject(new Error('fs/promises not available in browser'));
          export const readFile = () => Promise.reject(new Error('fs/promises not available in browser'));
          export const rm = () => Promise.reject(new Error('fs/promises not available in browser'));
          export default { mkdir, writeFile, readFile, rm };
        `;
      }
      if (id === "\0virtual:fs") {
        return `
          export const existsSync = () => false;
          export const readFileSync = () => { throw new Error('fs not available in browser'); };
          export const writeFileSync = () => { throw new Error('fs not available in browser'); };
          export const mkdirSync = () => { throw new Error('fs not available in browser'); };
          export default { existsSync, readFileSync, writeFileSync, mkdirSync };
        `;
      }
      if (id === "\0virtual:net") {
        return `
          export const Socket = class { constructor() { throw new Error('net not available in browser'); } };
          export const connect = () => { throw new Error('net not available in browser'); };
          export default { Socket, connect };
        `;
      }
      if (id === "\0virtual:tty") {
        return `export const isatty = () => false; export default { isatty };`;
      }
      return null;
    },
  };
}

// ── Constants ──────────────────────────────────────────────────────────────

/** @aztec/* packages that MUST be excluded from Vite pre-bundling (WASM URL resolution) */
const AZTEC_EXCLUDE = [
  "@aztec/noir-acvm_js",
  "@aztec/noir-noirc_abi",
  "@aztec/bb.js",
  "@aztec/aztec.js",
  "@aztec/foundation",
  "@aztec/native",
  "@aztec/accounts",
  "@aztec/pxe",
  "@aztec/stdlib",
  "@aztec/kv-store",
  "@aztec/protocol-contracts",
  "@aztec/wallets",
  "@aztec/wallet-sdk",
];

/** CJS transitive deps that MUST be included for pre-bundling (ESM export generation) */
const CJS_INCLUDE = [
  "buffer",
  "crypto-browserify",
  "stream-browserify",
  "util",
  "path-browserify",
  "sha3",
  "lodash.chunk",
  "lodash.isequal",
  "lodash.merge",
  "lodash.pickby",
  "lodash.times",
  "detect-node",
  "json-stringify-deterministic",
  "pako",
  "ohash",
  "colorette",
  "change-case",
  "comlink",
  "idb",
  "idb-keyval",
  "msgpackr",
  "ordered-binary",
];

// ── Main plugin ────────────────────────────────────────────────────────────

export interface AztecVitePluginOptions {
  /** Extra packages to exclude from optimizeDeps (on top of @aztec/*) */
  extraExclude?: string[];
  /** Extra CJS packages to include in optimizeDeps */
  extraInclude?: string[];
  /** Aztec node URL for the dev server proxy. Default: "http://localhost:8080" */
  nodeUrl?: string;
  /** Proxy path in the browser. Default: "/rpc" */
  proxyPath?: string;
}

/**
 * Pre-configured Vite plugin for Aztec browser apps.
 *
 * Handles node shims, optimizeDeps exclude/include, COOP/COEP headers,
 * and the RPC proxy. Use it as the FIRST plugin in your Vite config.
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { defineConfig } from "vite";
 * import react from "@vitejs/plugin-react";
 * import { aztecVitePlugin } from "@honkers/aztec-connect/vite";
 *
 * export default defineConfig({
 *   plugins: [
 *     aztecVitePlugin(),     // Must be first
 *     react(),
 *   ],
 * });
 * ```
 */
export function aztecVitePlugin(opts: AztecVitePluginOptions = {}): Plugin[] {
  const {
    extraExclude = [],
    extraInclude = [],
    nodeUrl = "http://localhost:8080",
    proxyPath = "/rpc",
  } = opts;

  const configPlugin: Plugin = {
    name: "aztec-connect:config",
    config(): UserConfig {
      return {
        assetsInclude: ["**/*.wasm"],
        define: { global: "globalThis" },
        worker: { format: "es" },
        esbuild: { target: "esnext" },

        resolve: {
          preserveSymlinks: false,
          alias: {
            pino: "pino/browser.js",
            crypto: "crypto-browserify",
            stream: "stream-browserify",
            "hash.js": "hash.js/lib/hash.js",
          },
        },

        optimizeDeps: {
          exclude: [...AZTEC_EXCLUDE, ...extraExclude],
          include: [...CJS_INCLUDE, ...extraInclude],
          esbuildOptions: {
            target: "esnext",
            define: { global: "globalThis" },
          },
        },

        build: {
          target: "esnext",
          commonjsOptions: {
            defaultIsModuleExports: ((id: string) => {
              if (id.includes("@aztec/")) return false;
              return "auto";
            }) as unknown as boolean,
            exclude: [
              "@aztec/stdlib/**",
              "@aztec/foundation/**",
              "@aztec/aztec.js/**",
            ],
          },
        },

        server: {
          headers: {
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Embedder-Policy": "credentialless",
            "Cross-Origin-Resource-Policy": "cross-origin",
          },
          proxy: {
            [proxyPath]: {
              target: nodeUrl,
              changeOrigin: true,
              rewrite: (p: string) => p.replace(new RegExp(`^${proxyPath.replace("/", "\\/")}`), ""),
            },
          },
        },
      };
    },
  };

  return [nodeBuiltinsShim(), configPlugin];
}

export { AZTEC_EXCLUDE, CJS_INCLUDE };
