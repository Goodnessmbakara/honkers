// ---------------------------------------------------------------------------
// Aztec RPC configuration
// Default platform proxy (non-logging) + user override option (EI-3)
// ---------------------------------------------------------------------------

// Use same-origin paths by default so CloudFront/ALB deployments do not depend
// on local-machine hostnames.
const DEFAULT_PXE_URL = "/rpc";
const DEFAULT_INDEXER_URL = "";

function getIndexerUrl(): string {
  const raw = import.meta.env.VITE_INDEXER_API_URL?.trim();
  if (!raw) return DEFAULT_INDEXER_URL;

  // In production, an accidental localhost value would route requests to the
  // user's own machine (and fail with CORS/network errors). Fall back to
  // same-origin so `/api` continues to work behind reverse proxies/CDNs.
  if (typeof window !== "undefined") {
    try {
      const parsed = new URL(raw, window.location.origin);
      const isLocalTarget = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
      const isLocalPage =
        window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      if (isLocalTarget && !isLocalPage) return DEFAULT_INDEXER_URL;
    } catch {
      // Invalid URL override: ignore and use same-origin fallback.
      return DEFAULT_INDEXER_URL;
    }
  }

  return raw;
}

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
  get indexerUrl() {
    return getIndexerUrl();
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
      localStorage.setItem("honkers:pxe-url", url);
    } else {
      localStorage.removeItem("honkers:pxe-url");
    }
  },
} as const;
