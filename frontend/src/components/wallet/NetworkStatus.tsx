// ---------------------------------------------------------------------------
// CMP-NETWORK-STATUS — Chain/RPC/PXE health indicator
// ---------------------------------------------------------------------------

import { useEffect } from "react";
import { usePXE } from "../../hooks/usePXE";

export function NetworkStatus() {
  const { health, checkHealth } = usePXE();

  useEffect(() => {
    checkHealth();
    const id = setInterval(checkHealth, 30_000);
    return () => clearInterval(id);
  }, [checkHealth]);

  const color = health.ok ? "var(--positive)" : "var(--negative)";
  const label = health.ok
    ? `Block ${health.blockNumber ?? "…"}`
    : health.error ?? "PXE offline";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-2)",
        fontSize: "0.75rem",
        color: "var(--text-muted)",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "var(--radius-full)",
          background: color,
          display: "inline-block",
        }}
      />
      {label}
    </div>
  );
}
