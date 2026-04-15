# Aztec Wallet Connect — Implementation Guide

> A comprehensive guide for implementing browser-based wallet connection with
> Aztec Network v4.1.3. Covers PXE initialization, account creation, Vite
> bundler configuration, and the patterns needed to build a wallet connect
> kit or SDK.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites & Dependencies](#2-prerequisites--dependencies)
3. [Vite Configuration](#3-vite-configuration)
4. [PXE Initialization (Singleton)](#4-pxe-initialization-singleton)
5. [Account Creation & Wallet Connection](#5-account-creation--wallet-connection)
6. [React Integration](#6-react-integration)
7. [Key Gotchas & Troubleshooting](#7-key-gotchas--troubleshooting)
8. [Building an SDK / Connect Kit](#8-building-an-sdk--connect-kit)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  Browser                                            │
│                                                     │
│  ┌──────────┐    ┌──────────┐    ┌───────────────┐  │
│  │  React UI │───▶│useWallet │───▶│ AccountManager│  │
│  └──────────┘    └──────────┘    └───────┬───────┘  │
│                                          │          │
│                       ┌──────────────────▼────────┐ │
│                       │  PXE (Private Execution   │ │
│                       │  Environment) — in-browser │ │
│                       │  IndexedDB-backed store    │ │
│                       └──────────────┬────────────┘ │
│                                      │              │
└──────────────────────────────────────┼──────────────┘
                                       │ HTTP/JSON-RPC
                              ┌────────▼────────┐
                              │  Aztec Sandbox   │
                              │  (localhost:8080)│
                              └─────────────────┘
```

**Key components:**

- **PXE** runs entirely in the browser via WASM. It handles private state,
  note decryption, and proof generation. It persists data to IndexedDB.
- **AccountManager** coordinates account contract deployment, key derivation,
  and registration with the PXE.
- **SchnorrAccountContract** is the recommended account contract — it uses
  Schnorr signatures over the Grumpkin curve for authentication.
- **Aztec Sandbox** is the local L1+L2 development node (or a remote testnet).

---

## 2. Prerequisites & Dependencies

### Required packages

```bash
pnpm add \
  @aztec/aztec.js@4.1.3 \
  @aztec/accounts@4.1.3 \
  @aztec/stdlib@4.1.3 \
  @aztec/wallets@4.1.3
```

### Vite plugins

```bash
pnpm add -D \
  vite-plugin-node-polyfills \
  vite-plugin-wasm \
  vite-plugin-top-level-await
```

### CJS transitive dependencies (critical for pnpm + Vite)

Aztec packages depend on several CommonJS modules. With **pnpm's strict
isolation**, these are not hoisted to `node_modules/` root, so Vite cannot
find them for pre-bundling. You must install them as **direct** dependencies:

```bash
pnpm add \
  sha3 \
  lodash.chunk lodash.isequal lodash.merge lodash.pickby lodash.times \
  detect-node \
  json-stringify-deterministic \
  pako \
  ohash \
  colorette \
  change-case \
  comlink \
  idb idb-keyval \
  msgpackr \
  ordered-binary
```

**Why?** The `@aztec/*` packages are excluded from Vite's `optimizeDeps`
(explained below). Excluded packages are served as native ESM, but their CJS
transitive deps need pre-bundling to generate proper ESM named exports. If
Vite can't find the CJS module on disk, the pre-bundle step fails silently
and you get runtime errors like:

```
SyntaxError: sha3 does not provide an export named 'Keccak'
```

---

## 3. Vite Configuration

The Aztec SDK uses WASM, SharedArrayBuffer, and Node.js built-ins — all
requiring special Vite configuration.

### 3.1 Node built-in shims

Create a plugin that intercepts `fs`, `fs/promises`, `net`, and `tty`
before `vite-plugin-node-polyfills` processes them:

```typescript
// vite.config.ts
import { defineConfig, type Plugin } from 'vite';

const nodeBuiltinsShim = (): Plugin => ({
  name: 'node-builtins-shim',
  enforce: 'pre',
  resolveId(source) {
    if (['fs/promises', 'fs', 'net', 'tty'].includes(source)) {
      return `\0virtual:${source}`;
    }
    return null;
  },
  load(id) {
    if (id === '\0virtual:fs/promises') {
      return `
        export const mkdir = () => Promise.reject(new Error('fs/promises not available'));
        export const writeFile = () => Promise.reject(new Error('fs/promises not available'));
        export const readFile = () => Promise.reject(new Error('fs/promises not available'));
        export const rm = () => Promise.reject(new Error('fs/promises not available'));
        export default { mkdir, writeFile, readFile, rm };
      `;
    }
    if (id === '\0virtual:fs') {
      return `
        export const existsSync = () => false;
        export const readFileSync = () => { throw new Error('fs not available'); };
        export const writeFileSync = () => { throw new Error('fs not available'); };
        export const mkdirSync = () => { throw new Error('fs not available'); };
        export default { existsSync, readFileSync, writeFileSync, mkdirSync };
      `;
    }
    if (id === '\0virtual:net') {
      return `
        export const Socket = class { constructor() { throw new Error('net not available'); } };
        export const connect = () => { throw new Error('net not available'); };
        export default { Socket, connect };
      `;
    }
    if (id === '\0virtual:tty') {
      return `export const isatty = () => false; export default { isatty };`;
    }
    return null;
  },
});
```

### 3.2 Full Vite config

```typescript
export default defineConfig({
  plugins: [
    nodeBuiltinsShim(),        // Must be first
    react(),
    wasm(),
    topLevelAwait(),
    nodePolyfills({
      include: ['buffer', 'process', 'util', 'stream', 'events', 'crypto', 'path', 'assert'],
      globals: { Buffer: true, global: true, process: true },
      exclude: ['fs', 'net', 'tty'],  // Handled by shim above
    }),
  ],

  assetsInclude: ['**/*.wasm'],
  define: { global: 'globalThis' },
  worker: { format: 'es' },
  esbuild: { target: 'esnext' },

  resolve: {
    preserveSymlinks: false,
    alias: {
      pino: 'pino/browser.js',
      crypto: 'crypto-browserify',
      stream: 'stream-browserify',
      'hash.js': 'hash.js/lib/hash.js',
    },
  },

  optimizeDeps: {
    // ────────────────────────────────────────────────────────────────────
    // EXCLUDE all @aztec/* packages.
    //
    // These use `new URL('...wasm', import.meta.url)` to locate WASM files
    // at runtime. If Vite pre-bundles them, it rewrites import.meta.url to
    // a virtual path, breaking the WASM fetch (hangs indefinitely).
    // ────────────────────────────────────────────────────────────────────
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
    ],

    // ────────────────────────────────────────────────────────────────────
    // INCLUDE CJS transitive deps so Vite pre-bundles them into ESM.
    // Without this, named imports from CJS modules fail at runtime.
    // ────────────────────────────────────────────────────────────────────
    include: [
      'buffer', 'crypto-browserify', 'stream-browserify', 'util', 'path-browserify',
      'sha3',
      'lodash.chunk', 'lodash.isequal', 'lodash.merge', 'lodash.pickby', 'lodash.times',
      'detect-node', 'json-stringify-deterministic', 'pako', 'ohash',
      'colorette', 'change-case', 'comlink',
      'idb', 'idb-keyval', 'msgpackr', 'ordered-binary',
    ],

    esbuildOptions: {
      target: 'esnext',
      define: { global: 'globalThis' },
    },
  },

  build: {
    target: 'esnext',
    commonjsOptions: {
      defaultIsModuleExports: (id: string) => {
        if (id.includes('@aztec/')) return false;
        return 'auto';
      },
      exclude: ['@aztec/stdlib/**', '@aztec/foundation/**', '@aztec/aztec.js/**'],
    },
  },

  server: {
    headers: {
      // Required for SharedArrayBuffer (Barretenberg WASM multi-threading)
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
    proxy: {
      '/rpc': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/rpc/, ''),
      },
    },
  },
});
```

### 3.3 Why `exclude` + `include` together?

| Package type | Vite behavior | What we want |
|---|---|---|
| `@aztec/*` (ESM with WASM) | Must NOT be pre-bundled — WASM URL resolution breaks | `exclude` |
| CJS transitive deps (`sha3`, `lodash.*`, etc.) | Must be pre-bundled to generate ESM exports | `include` |

When a package is in `exclude`, Vite also skips pre-bundling its dependencies.
By explicitly listing CJS deps in `include`, we force Vite to pre-bundle
them regardless.

---

## 4. PXE Initialization (Singleton)

The PXE is expensive to initialize (WASM compilation, IndexedDB setup, node
sync). Use a singleton pattern:

```typescript
// src/hooks/useAztecWallet.ts
import { createContext, useContext } from "react";
import type { EmbeddedWallet } from "@aztec/wallets/embedded";

export interface AztecWalletContext {
  wallet: EmbeddedWallet | null;
  loading: boolean;
  error: string | null;
}

export const AztecWalletCtx = createContext<AztecWalletContext>({
  wallet: null,
  loading: true,
  error: null,
});

export function useAztecWallet() {
  return useContext(AztecWalletCtx);
}

let walletPromise: Promise<EmbeddedWallet> | null = null;

/**
 * Lazily initialize the BrowserEmbeddedWallet singleton.
 * Multiple callers share the same promise/instance.
 */
export async function getOrCreateWallet(nodeUrl: string): Promise<EmbeddedWallet> {
  if (!walletPromise) {
    walletPromise = (async () => {
      const { EmbeddedWallet } = await import("@aztec/wallets/embedded");
      return EmbeddedWallet.create(nodeUrl, { ephemeral: false });
    })();
  }
  return walletPromise;
}
```

**Important notes:**
- `ephemeral: false` enables IndexedDB persistence — the PXE remembers
  registered accounts and decrypted notes across page reloads.
- The dynamic `import()` is intentional — it defers WASM loading until the
  wallet is actually needed.
- The singleton promise ensures concurrent React renders don't create
  multiple PXE instances.

---

## 5. Account Creation & Wallet Connection

### 5.1 The connect flow

```typescript
// src/hooks/useWallet.ts
import { useCallback, useEffect, useState } from "react";
import { Fr } from "@aztec/aztec.js/fields";
import { AccountManager } from "@aztec/aztec.js/wallet";
import { SchnorrAccountContract } from "@aztec/accounts/schnorr";
import { deriveSigningKey } from "@aztec/stdlib/keys";

const STORAGE_KEY = "myapp:wallet-address";
const SECRET_KEY = "myapp:wallet-secret";

export function useWallet() {
  const { wallet, loading, error } = useAztecWallet();
  const [state, setState] = useState({
    connected: false,
    address: null as string | null,
    syncing: false,
  });

  // Restore previous session (view-only until connect() is called)
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setState({ connected: true, address: saved, syncing: false });
  }, []);

  const connect = useCallback(async () => {
    if (!wallet) return;
    setState((s) => ({ ...s, syncing: true }));

    try {
      // ── Step 1: Get or generate account secret ──────────────────────
      let secret: Fr;
      const savedSecret = localStorage.getItem(SECRET_KEY);
      if (savedSecret) {
        secret = Fr.fromHexString(savedSecret);
      } else {
        secret = Fr.random();
        localStorage.setItem(SECRET_KEY, secret.toString());
      }

      // ── Step 2: Derive signing key & create account contract ───────
      //
      // CRITICAL: Use `deriveSigningKey()` — it returns a GrumpkinScalar.
      // Do NOT manually slice the secret buffer. The Schnorr crypto
      // internals call `privateKey.toBuffer()` which requires the
      // GrumpkinScalar type, not a raw Uint8Array.
      //
      const signingKey = deriveSigningKey(secret);
      const accountContract = new SchnorrAccountContract(signingKey);

      // ── Step 3: Create AccountManager ──────────────────────────────
      const salt = Fr.ZERO; // Fixed salt = one account per secret
      const accountManager = await AccountManager.create(
        wallet,     // EmbeddedWallet instance (implements PXE interface)
        secret,     // Fr — the master secret
        accountContract,
        salt,
      );

      // ── Step 4: Register account with PXE ──────────────────────────
      const account = await accountManager.getAccount();
      const instance = accountManager.getInstance();
      const artifact = await accountManager.getAccountContract().getContractArtifact();

      await wallet.registerContract(instance, artifact, accountManager.getSecretKey());
      wallet.addAccount(account);

      // ── Step 5: Deploy account contract (if needed) ────────────────
      if (await accountManager.hasInitializer()) {
        const isDeployed = await wallet.getContractInstance(account.getAddress());
        if (!isDeployed) {
          const deployMethod = await accountManager.getDeployMethod();
          await deployMethod.send().wait();
        }
      }

      // ── Step 6: Persist & update state ─────────────────────────────
      const address = account.getAddress().toString();
      localStorage.setItem(STORAGE_KEY, address);
      setState({ connected: true, address, syncing: false });
    } catch (err) {
      console.error("[useWallet] connect failed:", err);
      setState({ connected: false, address: null, syncing: false });
      throw err;
    }
  }, [wallet]);

  const disconnect = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState({ connected: false, address: null, syncing: false });
  }, []);

  return { ...state, connect, disconnect, loading, error };
}
```

### 5.2 Step-by-step explanation

| Step | What happens | Key type |
|---|---|---|
| **Secret generation** | `Fr.random()` creates a 254-bit field element. Persisted to localStorage so the same account is recovered on reload. | `Fr` |
| **Signing key derivation** | `deriveSigningKey(secret)` hashes the secret to produce a Grumpkin scalar suitable for Schnorr signing. | `GrumpkinScalar` |
| **Account contract** | `SchnorrAccountContract` wraps the signing key and provides the contract artifact + auth witness provider. | — |
| **AccountManager** | Coordinates key derivation, address computation, contract deployment, and PXE registration. | — |
| **Registration** | Tells the PXE to track notes for this address. Without this, the PXE won't decrypt incoming notes. | — |
| **Deployment** | First-time accounts need their contract deployed on-chain. Subsequent connects skip this step. | — |

### 5.3 Key derivation diagram

```
Fr.random()
    │
    ▼
  secret (Fr, 254-bit field element)
    │
    ├──▶ deriveSigningKey(secret) ──▶ signingKey (GrumpkinScalar)
    │                                      │
    │                                      ▼
    │                              SchnorrAccountContract
    │                                      │
    │                                      ▼
    └──────────────────────────────▶ AccountManager.create(
                                       wallet, secret, contract, salt
                                     )
                                           │
                                           ▼
                                     Aztec Address
```

---

## 6. React Integration

### 6.1 Provider component

```tsx
// src/providers/AztecProvider.tsx
import { useEffect, useState, type ReactNode } from "react";
import { AztecWalletCtx, getOrCreateWallet, type AztecWalletContext } from "../hooks/useAztecWallet";
import type { EmbeddedWallet } from "@aztec/wallets/embedded";

const NODE_URL = "/rpc"; // Proxied through Vite to localhost:8080

export function AztecProvider({ children }: { children: ReactNode }) {
  const [ctx, setCtx] = useState<AztecWalletContext>({
    wallet: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    getOrCreateWallet(NODE_URL)
      .then((wallet) => setCtx({ wallet, loading: false, error: null }))
      .catch((err) => setCtx({ wallet: null, loading: false, error: String(err) }));
  }, []);

  return (
    <AztecWalletCtx.Provider value={ctx}>
      {children}
    </AztecWalletCtx.Provider>
  );
}
```

### 6.2 Usage in components

```tsx
function ConnectButton() {
  const { connected, address, syncing, connect, disconnect, loading, error } = useWallet();

  if (loading) return <span>Initializing PXE...</span>;
  if (error) return <span>Error: {error}</span>;
  if (syncing) return <span>Connecting...</span>;

  if (connected) {
    return (
      <div>
        <span>{address?.slice(0, 10)}...</span>
        <button onClick={disconnect}>Disconnect</button>
      </div>
    );
  }

  return <button onClick={connect}>Connect Wallet</button>;
}
```

---

## 7. Key Gotchas & Troubleshooting

### 7.1 `SyntaxError: X does not provide an export named 'Y'`

**Cause:** A CommonJS module is being served as raw ESM (not pre-bundled).

**Fix:** Add the module to both `optimizeDeps.include` in vite.config.ts AND
install it as a direct dependency (`pnpm add <module>`).

**How to find the culprit:** The error message names the module. If you see
a new one after adding packages, grep for it:

```bash
grep -r "from ['\"]<module-name>['\"]" node_modules/@aztec/*/dest/
```

### 7.2 `TypeError: privateKey.toBuffer is not a function`

**Cause:** You're passing a raw `Buffer` or `Uint8Array` where a
`GrumpkinScalar` is expected.

**Fix:** Use `deriveSigningKey(secret)` from `@aztec/stdlib/keys`. Never
manually construct the signing key from buffer slices.

### 7.3 WASM fetch hangs indefinitely

**Cause:** An `@aztec/*` package was pre-bundled by Vite, which rewrites
`import.meta.url` and breaks the relative WASM file URL.

**Fix:** Ensure ALL `@aztec/*` packages are in `optimizeDeps.exclude`.

### 7.4 `SharedArrayBuffer is not defined`

**Cause:** Missing Cross-Origin Isolation headers. Barretenberg WASM needs
multi-threading via `SharedArrayBuffer`, which requires:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: credentialless
```

**Fix:** Add these to your dev server and production web server config.

### 7.5 pnpm can't find transitive dependency

**Cause:** pnpm's strict isolation doesn't hoist transitive deps.

**Fix:** Install as a direct dependency: `pnpm add <package>`.

### 7.6 Account not persisted after page reload

The PXE persists to IndexedDB when `ephemeral: false`, but you still need to
**re-register** the account with the PXE on each page load. The `connect()`
flow handles this — it's idempotent (registering an already-registered
account is a no-op).

---

## 8. Building an SDK / Connect Kit

If you're building a reusable wallet connect library for Aztec, here's the
recommended architecture:

### 8.1 Core SDK structure

```
@aztec-connect/core
  ├── createAztecWallet(nodeUrl)     → singleton PXE/wallet init
  ├── connectAccount(wallet, opts?)  → full connect flow
  ├── disconnectAccount()            → cleanup
  └── getAccountState()              → current connection state

@aztec-connect/react
  ├── <AztecProvider nodeUrl="..." />
  ├── useAztecWallet()               → wallet instance
  ├── useAccount()                   → connect/disconnect/state
  └── <ConnectButton />              → drop-in UI component

@aztec-connect/vite-plugin
  └── aztecViteConfig()              → pre-configured Vite settings
```

### 8.2 Vite plugin (most valuable piece)

The single biggest pain point is Vite configuration. A plugin that
auto-configures `optimizeDeps`, polyfills, and CORS headers would save
every integrator hours of debugging:

```typescript
// @aztec-connect/vite-plugin
export function aztecVitePlugin(): Plugin[] {
  return [
    nodeBuiltinsShim(),
    // ... auto-configure optimizeDeps.exclude, include, server headers
  ];
}
```

### 8.3 Account strategy options

An SDK should support multiple account contract types:

```typescript
interface ConnectOptions {
  accountType?: 'schnorr' | 'ecdsa' | 'multisig';
  salt?: Fr;            // Fr.ZERO for single account, Fr.random() for multi
  secretStorage?: 'localStorage' | 'sessionStorage' | 'custom';
  onStatus?: (status: 'initializing' | 'registering' | 'deploying' | 'ready') => void;
}
```

### 8.4 Security considerations for production

- **Secret storage:** localStorage is convenient for development but not
  secure for production. Consider encrypted storage, or deriving the secret
  from a user-provided passphrase via a KDF (e.g., Argon2).
- **Secret rotation:** Provide a way to migrate to a new secret/account.
- **Multiple accounts:** Use different `salt` values with the same secret,
  or different secrets entirely.
- **Session management:** Consider short-lived session keys that are
  authorized by the main account key.

### 8.5 Checklist for SDK implementers

- [ ] Singleton PXE initialization (never create multiple instances)
- [ ] Proper key derivation (`deriveSigningKey`, not manual buffer ops)
- [ ] Idempotent connect flow (safe to call multiple times)
- [ ] Account persistence (secret in storage, re-register on reload)
- [ ] Deploy-on-first-use (check `hasInitializer` + `getContractInstance`)
- [ ] Cross-Origin Isolation headers documented/automated
- [ ] Vite config helper or plugin
- [ ] CJS dependency list maintained and documented
- [ ] Error handling with actionable messages
- [ ] TypeScript types exported for all public APIs

---

## Appendix: Package Version Matrix

| Package | Version | Purpose |
|---|---|---|
| `@aztec/aztec.js` | 4.1.3 | Core SDK (Fr, AccountManager, etc.) |
| `@aztec/accounts` | 4.1.3 | Account contract implementations (Schnorr, ECDSA) |
| `@aztec/stdlib` | 4.1.3 | Standard library (key derivation, ABI loading) |
| `@aztec/wallets` | 4.1.3 | EmbeddedWallet for browser-based PXE |
| `vite-plugin-wasm` | latest | WASM support in Vite |
| `vite-plugin-top-level-await` | latest | Top-level await support |
| `vite-plugin-node-polyfills` | latest | Node.js polyfills for browser |

---

*This guide reflects Aztec Network v4.1.3. APIs may change in future versions.*
