// ---------------------------------------------------------------------------
// Contract artifact registry — maps contract addresses to their artifacts
// Used by usePXE to interact with deployed contracts via the SDK
// ---------------------------------------------------------------------------

import { loadContractArtifact, type ContractArtifact, type NoirCompiledContract } from "@aztec/aztec.js/abi";
import { aztecConfig } from "./aztec";

import PrivateVaultJson from "../artifacts/private_vault-PrivateVault.json";
import AMMJson from "../artifacts/amm-AMM.json";
import OracleJson from "../artifacts/oracle-Oracle.json";
import MarketFactoryJson from "../artifacts/market_factory-MarketFactory.json";
import TestTokenJson from "../artifacts/test_token-TestToken.json";

const artifacts: Record<string, ContractArtifact> = {};

function ensureLoaded(): Record<string, ContractArtifact> {
  if (Object.keys(artifacts).length > 0) return artifacts;

  const pairs: [string, unknown][] = [
    [aztecConfig.contracts.privateVault, PrivateVaultJson],
    [aztecConfig.contracts.amm, AMMJson],
    [aztecConfig.contracts.oracle, OracleJson],
    [aztecConfig.contracts.marketFactory, MarketFactoryJson],
    [aztecConfig.contracts.testToken, TestTokenJson],
  ];

  for (const [addr, json] of pairs) {
    if (addr) {
      artifacts[addr] = loadContractArtifact(json as NoirCompiledContract);
    }
  }

  return artifacts;
}

export function getArtifact(contractAddress: string): ContractArtifact {
  const map = ensureLoaded();
  const artifact = map[contractAddress];
  if (!artifact) {
    throw new Error(
      `No artifact found for contract address ${contractAddress}. ` +
      `Check that VITE_*_ADDRESS env vars match deployed contract addresses.`
    );
  }
  return artifact;
}
