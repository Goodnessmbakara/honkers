// ---------------------------------------------------------------------------
// AztecProvider — pass-through wrapper.
//
// Wallet discovery and connection are now handled by WalletContext via the
// official @aztec/wallet-sdk WalletManager extension protocol.
// This component is kept for structural compatibility only.
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";

export function AztecProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
