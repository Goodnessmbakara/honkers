// ---------------------------------------------------------------------------
// SCR-LANDING (S01) — Hero with animated background, value props, CTA
// ---------------------------------------------------------------------------

import { Link } from "react-router-dom";
import { ShieldCheck, ArrowRight, Lock, TrendingUp, Zap } from "lucide-react";
import { WalletConnect } from "../components/wallet/WalletConnect";

const features = [
  { icon: Lock, label: "Private positions", desc: "Your trades are hidden in zero-knowledge notes — not even the sequencer knows your size." },
  { icon: TrendingUp, label: "Real markets", desc: "Prediction markets backed by on-chain AMM pricing. Every bet is auditable, no position is." },
  { icon: Zap, label: "Instant faucet", desc: "Get test USDC in one click. No KYC, no bridge, no waiting." },
];

export function Landing() {
  return (
    <div style={{ position: "relative", overflow: "hidden", minHeight: "100vh" }}>

      {/* ── Layered background ─────────────────────────────────────── */}
      <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        {/* Deep base gradient */}
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,209,198,0.07) 0%, transparent 70%), radial-gradient(ellipse 60% 50% at 80% 80%, rgba(59,130,246,0.06) 0%, transparent 60%), #0a0a0f",
        }} />

        {/* Dot grid */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(ellipse 90% 80% at 50% 30%, black 30%, transparent 80%)",
        }} />

        {/* Glowing orb — top */}
        <div style={{
          position: "absolute", top: "-120px", left: "50%", transform: "translateX(-50%)",
          width: 700, height: 400,
          background: "radial-gradient(ellipse at center, rgba(0,209,198,0.13) 0%, transparent 70%)",
          filter: "blur(40px)",
          animation: "orb-drift 8s ease-in-out infinite alternate",
        }} />

        {/* Glowing orb — bottom right */}
        <div style={{
          position: "absolute", bottom: "5%", right: "-5%",
          width: 500, height: 350,
          background: "radial-gradient(ellipse at center, rgba(59,130,246,0.10) 0%, transparent 70%)",
          filter: "blur(60px)",
          animation: "orb-drift 10s ease-in-out infinite alternate-reverse",
        }} />

        {/* Subtle horizontal scan line */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,209,198,0.015) 3px, rgba(0,209,198,0.015) 4px)",
          opacity: 0.5,
        }} />
      </div>

      {/* ── Hero section ───────────────────────────────────────────── */}
      <div style={{
        position: "relative", zIndex: 1,
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", textAlign: "center",
        padding: "var(--space-16) var(--space-6) var(--space-12)",
        minHeight: "80vh",
        gap: "var(--space-6)",
      }}>

        {/* Badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: "var(--space-2)",
          background: "rgba(0,209,198,0.08)", border: "1px solid rgba(0,209,198,0.2)",
          borderRadius: "var(--radius-full)", padding: "6px 16px",
          fontSize: "0.75rem", color: "var(--accent)", letterSpacing: "0.06em",
          textTransform: "uppercase", fontWeight: 600,
        }}>
          <ShieldCheck size={13} />
          Built on Aztec — private by default
        </div>

        {/* Wordmark */}
        <h1 style={{
          fontFamily: "var(--font-display)", fontWeight: 900,
          fontSize: "clamp(3rem, 8vw, 5.5rem)",
          letterSpacing: "-0.04em", lineHeight: 1.0,
          background: "linear-gradient(135deg, #f0f0f5 30%, rgba(0,209,198,0.85) 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          margin: 0,
        }}>
          honkers
        </h1>

        {/* Tagline */}
        <p style={{
          fontSize: "clamp(1.1rem, 2.5vw, 1.35rem)",
          color: "var(--text-secondary)",
          maxWidth: 520, lineHeight: 1.6, margin: 0,
        }}>
          Trade prediction markets. Keep your positions hidden in zero-knowledge proofs.
        </p>

        {/* CTA row */}
        <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap", justifyContent: "center", marginTop: "var(--space-2)" }}>
          <WalletConnect />
          <Link to="/markets" className="btn-primary" style={{
            textDecoration: "none", display: "flex", alignItems: "center", gap: 6,
            background: "linear-gradient(135deg, var(--accent) 0%, #00a8a0 100%)",
            color: "#0a0a0f", fontWeight: 700,
          }}>
            Browse markets <ArrowRight size={16} />
          </Link>
        </div>

        {/* Stats strip */}
        <div style={{
          display: "flex", gap: "var(--space-8)", flexWrap: "wrap", justifyContent: "center",
          marginTop: "var(--space-4)",
        }}>
          {[["ZK proven", "every trade"], ["0 custody", "of your funds"], ["Testnet", "live now"]].map(([val, label]) => (
            <div key={val} style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>{val}</div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Feature cards ──────────────────────────────────────────── */}
      <div style={{
        position: "relative", zIndex: 1,
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: "var(--space-4)", maxWidth: 900, margin: "0 auto",
        padding: "0 var(--space-6) var(--space-16)",
      }}>
        {features.map(({ icon: Icon, label, desc }) => (
          <div key={label} className="card" style={{
            padding: "var(--space-6)",
            background: "rgba(18,18,26,0.7)", backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "var(--radius-lg)",
            transition: "border-color var(--duration-normal), transform var(--duration-normal)",
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,209,198,0.25)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: "var(--radius-md)",
              background: "rgba(0,209,198,0.1)", display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: "var(--space-3)",
            }}>
              <Icon size={20} style={{ color: "var(--accent)" }} />
            </div>
            <div style={{ fontWeight: 600, marginBottom: "var(--space-2)", color: "var(--text-primary)" }}>{label}</div>
            <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>{desc}</div>
          </div>
        ))}
      </div>

      {/* Legal links */}
      <div style={{
        position: "relative", zIndex: 1,
        display: "flex", gap: "var(--space-4)", justifyContent: "center",
        fontSize: "0.75rem", color: "var(--text-muted)",
        paddingBottom: "var(--space-8)",
      }}>
        <Link to="/terms" style={{ color: "var(--text-muted)" }}>Terms of service</Link>
        <Link to="/privacy" style={{ color: "var(--text-muted)" }}>Privacy model</Link>
        <Link to="/risk" style={{ color: "var(--text-muted)" }}>Risk disclosure</Link>
      </div>

      <style>{`
        @keyframes orb-drift {
          from { transform: translateX(-50%) translateY(0px) scale(1); }
          to   { transform: translateX(-50%) translateY(30px) scale(1.08); }
        }
      `}</style>
    </div>
  );
}
