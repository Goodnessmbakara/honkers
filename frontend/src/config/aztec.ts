// ---------------------------------------------------------------------------
// Aztec RPC configuration
// Default platform proxy (non-logging) + user override option (EI-3)
// ---------------------------------------------------------------------------

// Use the Vite proxy to avoid CORS issues with the Aztec sandbox
const DEFAULT_PXE_URL = "/rpc";
const INDEXER_URL = import.meta.env.VITE_INDEXER_API_URL ?? "http://localhost:3001";

function getPxeUrl(): string {
  // User override stored in localStorage (Settings page)
  const override = localStorage.getItem("honkers:pxe-url");
  if (override) return override;
  return import.meta.env.VITE_AZTEC_RPC_URL ?? DEFAULT_PXE_URL;
}

export const aztecConfig = {
  get pxeUrl() {
    return getPxeUrl();
  },
  indexerUrl: INDEXER_URL,

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
      localStorage.setItem("honkers:pxe-url", url);
    } else {
      localStorage.removeItem("honkers:pxe-url");
    }
  },
} as const;
