// ---------------------------------------------------------------------------
// CMP-CREATOR-LINE — Public creator address + optional label
// ---------------------------------------------------------------------------

export function CreatorLine({ address }: { address: string }) {
  const short = address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
  return (
    <span
      className="mono"
      style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}
      title={address}
    >
      {short}
    </span>
  );
}
