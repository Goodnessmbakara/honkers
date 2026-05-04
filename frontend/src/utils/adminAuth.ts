// ---------------------------------------------------------------------------
// Admin authorization — wallet address must match VITE_ADMIN_ADDRESSES.
// Comma-separated Aztec addresses (0x…). Empty env = no admin access (deny-by-default).
// ---------------------------------------------------------------------------

function normalizeAddr(s: string): string {
  return s.trim().toLowerCase();
}

export function getAdminAddresses(): string[] {
  const raw = import.meta.env.VITE_ADMIN_ADDRESSES?.trim();
  if (!raw) return [];
  return raw.split(",").map(normalizeAddr).filter(Boolean);
}

export function isAdminWallet(address: string | null | undefined): boolean {
  if (!address) return false;
  const needle = normalizeAddr(address);
  return getAdminAddresses().some((a) => a === needle);
}
