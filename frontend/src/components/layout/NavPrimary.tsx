// ---------------------------------------------------------------------------
// CMP-NAV-PRIMARY — Markets, Portfolio, Create, Faucet
// ---------------------------------------------------------------------------

import { NavLink } from "react-router-dom";
import { LayoutGrid, Briefcase, PlusCircle, Droplets, Settings } from "lucide-react";
import { WalletConnect } from "../wallet/WalletConnect";

const linkStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--space-2)",
  padding: "var(--space-2) var(--space-3)",
  color: isActive ? "var(--accent)" : "var(--text-secondary)",
  fontWeight: isActive ? 500 : 400,
  fontSize: "0.875rem",
  borderRadius: "var(--radius-md)",
  transition: "color var(--duration-fast) ease-out",
  textDecoration: "none",
});

export function NavPrimary() {
  return (
    <header
      style={{
        borderBottom: "1px solid var(--border)",
        background: "var(--surface)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        className="container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 56,
        }}
      >
        {/* Wordmark */}
        <NavLink
          to="/"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 900,
            fontSize: "1.25rem",
            letterSpacing: "-0.02em",
            color: "var(--text-primary)",
            textDecoration: "none",
          }}
        >
          honkers
        </NavLink>

        {/* Navigation */}
        <nav style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
          <NavLink to="/markets" style={linkStyle}>
            <LayoutGrid size={16} /> Markets
          </NavLink>
          <NavLink to="/portfolio" style={linkStyle}>
            <Briefcase size={16} /> Portfolio
          </NavLink>
          <NavLink to="/create" style={linkStyle}>
            <PlusCircle size={16} /> Create
          </NavLink>
          <NavLink to="/faucet" style={linkStyle}>
            <Droplets size={16} /> Faucet
          </NavLink>
          <NavLink to="/settings" style={linkStyle}>
            <Settings size={16} />
          </NavLink>
        </nav>

        {/* Wallet */}
        <WalletConnect />
      </div>
    </header>
  );
}
