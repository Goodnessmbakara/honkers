// ---------------------------------------------------------------------------
// Aztec environment + RPC configuration
// Single source of truth for local/testnet/mainnet.
// ---------------------------------------------------------------------------

export type AztecEnvMode = "local" | "testnet" | "mainnet";
export type FeeStrategy = "sponsored_fpc" | "fee_juice";

const ENV_STORAGE_KEY = "honkers:aztec-env";
const PXE_OVERRIDE_KEY = "honkers:pxe-url";
const DEFAULT_ENV: AztecEnvMode = "testnet";

interface AztecEnvironmentConfig {
  mode: AztecEnvMode;
  pxeUrl: string;
  explorerUrl: string;
  feeStrategy: FeeStrategy;
  sponsoredFpcAddress?: string;
  expectedL1ChainId?: number;
  networkHints: string[];
}

const ENVIRONMENTS: Record<AztecEnvMode, AztecEnvironmentConfig> = {
  local: {
    mode: "local",
    pxeUrl: "http://localhost:8080",
    explorerUrl: "",
    feeStrategy: "sponsored_fpc",
    sponsoredFpcAddress: "",
    expectedL1ChainId: 31337,
    networkHints: ["local", "sandbox", "localhost", "anvil"],
  },
  testnet: {
    mode: "testnet",
    pxeUrl: "/rpc",
    explorerUrl: "https://explorer.testnet.aztec.network",
    feeStrategy: "sponsored_fpc",
    sponsoredFpcAddress:
      import.meta.env.VITE_SPONSORED_FPC_ADDRESS ??
      "0x19b5539ca1b104d4c3705de94e4555c9630def411f025e023a13189d0c56f8f2",
    expectedL1ChainId: 11155111,
    networkHints: ["testnet", "sepolia", "alpha-testnet"],
  },
  mainnet: {
    mode: "mainnet",
    pxeUrl: "/rpc",
    explorerUrl: "https://explorer.aztec.network",
    feeStrategy: "fee_juice",
    sponsoredFpcAddress: "",
    expectedL1ChainId: 1,
    networkHints: ["mainnet", "ethereum"],
  },
};

function getPxeUrl(): string {
  const override = localStorage.getItem(PXE_OVERRIDE_KEY);
  if (override) return override.trim();
  const fromEnv = import.meta.env.VITE_AZTEC_RPC_URL?.trim();
  return fromEnv || getAztecEnvConfig().pxeUrl;
}

function resolveEnvMode(): AztecEnvMode {
  const fromStorage = localStorage.getItem(ENV_STORAGE_KEY)?.trim().toLowerCase();
  if (fromStorage === "local" || fromStorage === "testnet" || fromStorage === "mainnet") {
    return fromStorage;
  }

  const fromBuild = import.meta.env.VITE_AZTEC_ENV?.trim().toLowerCase();
  if (fromBuild === "local" || fromBuild === "testnet" || fromBuild === "mainnet") {
    return fromBuild;
  }

  return DEFAULT_ENV;
}

export function getAztecEnvConfig(): AztecEnvironmentConfig {
  return ENVIRONMENTS[resolveEnvMode()];
}

export const aztecConfig = {
  get envMode() {
    return resolveEnvMode();
  },
  get env() {
    return getAztecEnvConfig();
  },
  get pxeUrl() {
    return getPxeUrl();
  },
  contracts: {
    privateVault: import.meta.env.VITE_PRIVATE_VAULT_ADDRESS ?? "",
    amm: import.meta.env.VITE_AMM_ADDRESS ?? "",
    oracle: import.meta.env.VITE_ORACLE_ADDRESS ?? "",
    marketFactory: import.meta.env.VITE_MARKET_FACTORY_ADDRESS ?? "",
    testToken: import.meta.env.VITE_TEST_TOKEN_ADDRESS ?? "",
  },

  /** Platform fee recipient for `claim_winnings`; falls back to vault admin via `get_admin` if unset. */
  feeRecipient: import.meta.env.VITE_FEE_RECIPIENT_ADDRESS ?? "",

  /** Update the PXE URL override (persisted to localStorage). */
  setPxeUrl(url: string | null) {
    if (url) {
      localStorage.setItem(PXE_OVERRIDE_KEY, url);
    } else {
      localStorage.removeItem(PXE_OVERRIDE_KEY);
    }
  },
  setEnvMode(mode: AztecEnvMode) {
    localStorage.setItem(ENV_STORAGE_KEY, mode);
  },
  clearEnvMode() {
    localStorage.removeItem(ENV_STORAGE_KEY);
  },
} as const;
