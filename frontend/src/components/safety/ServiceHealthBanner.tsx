// ---------------------------------------------------------------------------
// ServiceHealthBanner — degraded mode when the Aztec node RPC health check fails.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { aztecConfig } from "../../config/aztec";

export function ServiceHealthBanner() {
  const [degraded, setDegraded] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch(aztecConfig.pxeUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "node_getNodeInfo", params: [] }),
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error.message);
        if (!cancelled) { setDegraded(false); setDetail(null); }
      } catch (e) {
        if (!cancelled) {
          setDegraded(true);
          setDetail(e instanceof Error ? e.message : String(e));
        }
      }
    };
    run();
    const t = setInterval(run, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  if (!degraded) return null;

  return (
    <div
      style={{
        background: "rgba(239, 68, 68, 0.08)",
        borderBottom: "1px solid rgba(239, 68, 68, 0.25)",
        padding: "var(--space-2) 0",
        fontSize: "0.8125rem",
      }}
    >
      <div className="container" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
        <AlertTriangle size={14} style={{ color: "var(--negative)", flexShrink: 0 }} />
        <span style={{ color: "var(--text-secondary)" }}>
          Node connection degraded — market reads may fail. {detail ? `(${detail})` : ""}
        </span>
        <Link to="/network-error" style={{ color: "var(--accent)", marginLeft: "auto" }}>
          Diagnostics
        </Link>
      </div>
    </div>
  );
}
