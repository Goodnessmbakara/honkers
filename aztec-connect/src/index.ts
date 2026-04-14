// ---------------------------------------------------------------------------
// @honkers/aztec-connect — Public API
//
// Core (framework-agnostic):
//   import { getOrCreatePXE, connectAccount, MinimalWallet } from "@honkers/aztec-connect";
//
// React bindings:
//   import { AztecConnectProvider, useAccount } from "@honkers/aztec-connect/react";
//
// Vite plugin:
//   import { aztecVitePlugin } from "@honkers/aztec-connect/vite";
// ---------------------------------------------------------------------------

export {
  getOrCreatePXE,
  resetPXE,
  connectAccount,
  MinimalWallet,
} from "./core";

export type {
  AztecInstance,
  CreatePXEOptions,
  ConnectOptions,
  ConnectedAccount,
  AccountType,
} from "./core";
