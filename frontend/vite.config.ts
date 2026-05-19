import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import path from 'path';

/**
 * Shim Node.js built-in modules that cannot run in the browser.
 * Must run BEFORE nodePolyfills to intercept these modules first.
 */
const nodeBuiltinsShim = (): Plugin => ({
  name: 'node-builtins-shim',
  enforce: 'pre',
  resolveId(source) {
    if (source === 'fs/promises' || source === 'fs' || source === 'net' || source === 'tty') {
      return `\0virtual:${source}`;
    }
    return null;
  },
  load(id) {
    if (id === '\0virtual:fs/promises') {
      return `
        export const mkdir = () => Promise.reject(new Error('fs/promises not available in browser'));
        export const writeFile = () => Promise.reject(new Error('fs/promises not available in browser'));
        export const readFile = () => Promise.reject(new Error('fs/promises not available in browser'));
        export const rm = () => Promise.reject(new Error('fs/promises not available in browser'));
        export default { mkdir, writeFile, readFile, rm };
      `;
    }
    if (id === '\0virtual:fs') {
      return `
        export const existsSync = () => false;
        export const readFileSync = () => { throw new Error('fs not available in browser'); };
        export const writeFileSync = () => { throw new Error('fs not available in browser'); };
        export const mkdirSync = () => { throw new Error('fs not available in browser'); };
        export default { existsSync, readFileSync, writeFileSync, mkdirSync };
      `;
    }
    if (id === '\0virtual:net') {
      return `
        export const Socket = class Socket { constructor() { throw new Error('net not available in browser'); } };
        export const connect = () => { throw new Error('net not available in browser'); };
        export default { Socket, connect };
      `;
    }
    if (id === '\0virtual:tty') {
      return `
        export const isatty = () => false;
        export default { isatty };
      `;
    }
    return null;
  },
});

export default defineConfig({
  plugins: [
    nodeBuiltinsShim(), // Must be first — intercept before nodePolyfills
    react(),
    wasm(),
    topLevelAwait(),
    nodePolyfills({
      include: ['buffer', 'process', 'util', 'stream', 'events', 'crypto', 'path', 'assert'],
      globals: { Buffer: true, global: true, process: true },
      exclude: ['fs', 'net', 'tty'], // Handled by nodeBuiltinsShim
    }),
  ],
  assetsInclude: ['**/*.wasm'],
  define: {
    global: 'globalThis',
  },
  worker: {
    format: 'es',
  },
  esbuild: {
    target: 'esnext',
  },
  resolve: {
    preserveSymlinks: false,
    alias: {
      pino: 'pino/browser.js',
      // CJS → ESM shims required by @aztec/* dependency chain
      crypto: 'crypto-browserify',
      stream: 'stream-browserify',
      'hash.js': 'hash.js/lib/hash.js',
      // Stub out bb.js (barretenberg WASM prover) — not needed in browser.
      // All proving happens in the Azguard Chrome extension.
      '@aztec/bb.js': path.resolve(__dirname, 'src/stubs/bb-stub.js'),
    },
  },
  optimizeDeps: {
    // CRITICAL: These packages use `new URL('...wasm', import.meta.url)` to locate
    // their WASM files at runtime. If Vite pre-bundles them, it rewrites import.meta.url
    // to a virtual path, breaking the relative WASM URL → the fetch() hangs indefinitely.
    //
    // Additionally, we exclude aztec.js, foundation, and native because they depend on bb.js.
    // If Vite tries to optimize them, it will try to pull bb.js into a shared chunk and fail
    // to resolve it during pre-bundling.
    exclude: [
      '@aztec/noir-acvm_js',
      '@aztec/noir-noirc_abi',
      '@aztec/bb.js',
      '@aztec/aztec.js',
      '@aztec/foundation',
      '@aztec/native',
      '@aztec/accounts',
      '@aztec/pxe',
      '@aztec/stdlib',
      '@aztec/kv-store',
      '@aztec/protocol-contracts',
      '@aztec/wallets',
      '@aztec/wallet-sdk',
      '@aztec/noir-contracts.js',
    ],
    // Explicitly include polyfills so they are pre-bundled and available to the 
    // non-optimized @aztec packages above.
    include: [
      'buffer',
      'crypto-browserify',
      'stream-browserify',
      'util',
      'path-browserify',
      // CJS transitive deps of excluded @aztec/* packages — must be pre-bundled for ESM compatibility
      'sha3',
      'lodash.chunk',
      'lodash.isequal',
      'lodash.merge',
      'lodash.pickby',
      'lodash.times',
      'detect-node',
      'json-stringify-deterministic',
      'pako',
      'ohash',
      'colorette',
      'change-case',
      'comlink',
      'idb',
      'idb-keyval',
      'msgpackr',
      'ordered-binary',
    ],
    esbuildOptions: {
      target: 'esnext',
      define: { global: 'globalThis' },
    },
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Keep all @aztec/* in one chunk to preserve class constructor init order.
          // embeddedPXE (which pulls bb.js/barretenberg/pxe/client/bundle) is a
          // dynamic import so it will be split into its own lazy chunk automatically.
          if (id.includes('@aztec') || id.includes('bb.js') || id.includes('barretenberg')) {
            return 'aztec-sdk';
          }
          return undefined;
        },
      },
    },
    commonjsOptions: {
      // Force all @aztec/* to be treated as pure ESM — prevents dual CJS/ESM processing
      // that causes class identity errors and double-initialization of singletons.
      defaultIsModuleExports: (id: string) => {
        if (id.includes('@aztec/')) return false;
        return 'auto';
      },
      exclude: [
        '@aztec/stdlib/**',
        '@aztec/foundation/**',
        '@aztec/aztec.js/**',
      ],
    },
  },
  server: {
    // Allow ALB/CloudFront host headers in production deployments.
    allowedHosts: true,
    headers: {
      // Required for SharedArrayBuffer (Barretenberg WASM multi-threading)
      // MUST be same-origin + credentialless for crossOriginIsolated === true
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
    proxy: {
      // Proxy Aztec sandbox RPC to avoid CORS issues.
      // The configure hook strips COEP/COOP from proxy responses — these headers
      // are required for SharedArrayBuffer but block cross-origin proxy responses.
      '/rpc': {
        target: process.env.AZTEC_SANDBOX_URL || 'https://rpc.testnet.aztec-labs.com',
        changeOrigin: true,
        rewrite: (p) => {
          const rewritten = p.replace(/^\/rpc/, '');
          return rewritten.length === 0 ? '/' : rewritten;
        },
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            // Remove COEP/CORP from upstream so the browser doesn't block it
            delete proxyRes.headers['cross-origin-embedder-policy'];
            delete proxyRes.headers['cross-origin-resource-policy'];
            delete proxyRes.headers['cross-origin-opener-policy'];
            // Ensure JSON responses are readable
            proxyRes.headers['access-control-allow-origin'] = '*';
          });
        },
      },
    },
    fs: {
      allow: [
        // Allow serving files from the workspace root (for contract artifacts via symlink)
        path.resolve(__dirname, '..'),
      ],
    },
  },
});
