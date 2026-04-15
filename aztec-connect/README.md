# @honkers/aztec-connect

Reusable SDK for connecting to Aztec Network v4.1.3 from the browser. Handles the hard parts so you don't have to:

- **In-browser PXE** — singleton WASM-based PXE with IndexedDB persistence
- **Schnorr account management** — create, register, deploy, reconnect
- **Vite plugin** — one-line config for WASM, polyfills, COOP/COEP headers, and the RPC proxy
- **React bindings** — Provider + hooks with loading/error states

Born from building [Honkers](https://github.com/Goodnessmbakara/honkers) and hitting every Aztec+Vite gotcha so you don't have to.

---

## Install

```bash
# Core SDK + peer deps
pnpm add @honkers/aztec-connect \
  @aztec/aztec.js@4.1.3 \
  @aztec/accounts@4.1.3 \
  @aztec/stdlib@4.1.3 \
  @aztec/pxe@4.1.3 \
  @aztec/kv-store@4.1.3 \
  @aztec/wallet-sdk@4.1.3

# CJS transitive deps (required by pnpm strict isolation)
pnpm add sha3 lodash.chunk lodash.isequal lodash.merge lodash.pickby lodash.times \
  detect-node json-stringify-deterministic pako ohash colorette change-case \
  comlink idb idb-keyval msgpackr ordered-binary

# Vite plugins
pnpm add -D vite-plugin-node-polyfills vite-plugin-wasm vite-plugin-top-level-await
```

---

## Quick Start

### 1. Vite config (one line)

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { aztecVitePlugin } from "@honkers/aztec-connect/vite";

export default defineConfig({
  plugins: [
    ...aztecVitePlugin(),   // Must be first — adds shims + config
    react(),
    wasm(),
    topLevelAwait(),
    nodePolyfills({
      include: ["buffer", "process", "util", "stream", "events", "crypto", "path", "assert"],
      globals: { Buffer: true, global: true, process: true },
      exclude: ["fs", "net", "tty"],  // Handled by aztecVitePlugin
    }),
  ],
});
```

### 2. React app (3 lines)

```tsx
// App.tsx
import { AztecConnectProvider, useAccount } from "@honkers/aztec-connect/react";

function App() {
  return (
    <AztecConnectProvider nodeUrl="/rpc">
      <WalletButton />
    </AztecConnectProvider>
  );
}

function WalletButton() {
  const { connected, address, syncing, connect, disconnect, pxeLoading, pxeError } = useAccount();

  if (pxeLoading) return <p>Initializing PXE (WASM)…</p>;
  if (pxeError)   return <p>Error: {pxeError}</p>;
  if (syncing)    return <p>Connecting wallet…</p>;

  if (connected) {
    return (
      <div>
        <code>{address?.slice(0, 10)}…{address?.slice(-4)}</code>
        <button onClick={disconnect}>Disconnect</button>
      </div>
    );
  }

  return <button onClick={connect}>Connect Wallet</button>;
}
```

### 3. Without React (vanilla JS / other frameworks)

```ts
import { getOrCreatePXE, connectAccount } from "@honkers/aztec-connect";
import { Fr } from "@aztec/aztec.js/fields";

// 1. Initialize PXE
const instance = await getOrCreatePXE("/rpc", {
  dbName: "my-app-pxe",
  onProgress: console.log,
});

// 2. Connect account
const secret = Fr.random(); // or restore from storage
const { address } = await connectAccount(instance, secret, {
  onStatus: (s) => console.log("Status:", s),
});

console.log("Connected:", address);
```

---

## API Reference

### Core (`@honkers/aztec-connect`)

| Export | Description |
|--------|-------------|
| `getOrCreatePXE(nodeUrl, opts?)` | Singleton PXE factory. Returns `{ pxe, aztecNode, wallet }`. |
| `resetPXE()` | Destroy cached instance (for testing). |
| `connectAccount(instance, secret, opts?)` | Full connect flow: derive → register → deploy → return address. |
| `MinimalWallet` | `BaseWallet` subclass bridging PXE → Wallet interface. |

### React (`@honkers/aztec-connect/react`)

| Export | Description |
|--------|-------------|
| `<AztecConnectProvider nodeUrl pxeOptions?>` | Context provider. Initializes PXE on mount. |
| `useAztecConnect()` | Access raw `{ instance, loading, error }`. |
| `useAccount(opts?)` | `{ connected, address, syncing, connect, disconnect, pxeLoading, pxeError }` |

### Vite (`@honkers/aztec-connect/vite`)

| Export | Description |
|--------|-------------|
| `aztecVitePlugin(opts?)` | Returns `Plugin[]` — node shims + full Vite config. |
| `AZTEC_EXCLUDE` | List of `@aztec/*` packages to exclude from optimizeDeps. |
| `CJS_INCLUDE` | List of CJS transitive deps to include in optimizeDeps. |

---

## Why This Exists

Building a browser app on Aztec v4.1.3 requires solving several non-obvious problems:

| Problem | What happens | This SDK's fix |
|---------|-------------|----------------|
| WASM URL rewriting | Vite pre-bundles `@aztec/*`, rewriting `import.meta.url` → WASM fetch hangs forever | `optimizeDeps.exclude` for all `@aztec/*` |
| CJS named exports | Excluded packages' CJS deps aren't pre-bundled → `SyntaxError: X has no export named Y` | `optimizeDeps.include` for 20+ CJS transitive deps |
| Node built-ins | `@aztec/*` imports `fs`, `net`, `tty` at module level → crash | Virtual module shims (pre-enforce plugin) |
| SharedArrayBuffer | Barretenberg WASM needs multi-threading → requires COOP/COEP headers | Auto-configured server headers |
| CORS | Browser can't reach sandbox directly | Vite proxy `/rpc` → `localhost:8080` |
| PXE architecture | v4.1.3 PXE runs in-browser, not on server | In-browser PXE via `@aztec/pxe/client/bundle` |
| Wallet bootstrapping | `AccountManager` needs a `Wallet`, but you need `AccountManager` to create one | `MinimalWallet extends BaseWallet` bridge |
| Key derivation | Raw buffer slicing breaks Schnorr → `privateKey.toBuffer is not a function` | Always uses `deriveSigningKey()` → proper `GrumpkinScalar` |

---

## Requirements

- Aztec v4.1.3 (peer dependency)
- Node.js 20+
- Vite 5+ or 6+
- React 18+ (optional, for React bindings)

---

## License

MIT
