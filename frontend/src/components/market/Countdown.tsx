// ---------------------------------------------------------------------------
// CMP-COUNTDOWN — End date countdown + grace void countdown (72h)
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Expired";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  if (h > 48) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${m}m ${s}s`;
}

export function Countdown({ targetUnix, label }: { targetUnix: number; label?: string }) {
  const [remaining, setRemaining] = useState(() => targetUnix * 1000 - Date.now());

  useEffect(() => {
    const id = setInterval(() => setRemaining(targetUnix * 1000 - Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetUnix]);

  const isUrgent = remaining > 0 && remaining < 86_400_000; // < 24h

  return (
    <span
      className="mono"
      style={{
        color: remaining <= 0 ? "var(--text-muted)" : isUrgent ? "var(--warning)" : "var(--text-secondary)",
        fontSize: "0.8125rem",
      }}
    >
      {label && <span style={{ color: "var(--text-muted)", marginRight: "var(--space-1)" }}>{label}</span>}
      {formatRemaining(remaining)}
    </span>
  );
}
