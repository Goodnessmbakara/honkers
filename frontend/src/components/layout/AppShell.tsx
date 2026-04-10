// ---------------------------------------------------------------------------
// CMP-APP-SHELL — Header, nav, footer, disclaimer slot
// ---------------------------------------------------------------------------

import { Outlet } from "react-router-dom";
import { NavPrimary } from "./NavPrimary";
import { FooterLegal } from "./FooterLegal";
import { BackupBanner } from "../safety/BackupBanner";

export function AppShell() {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <NavPrimary />
      <BackupBanner />
      <main style={{ flex: 1 }}>
        <div className="container">
          <Outlet />
        </div>
      </main>
      <FooterLegal />
    </div>
  );
}
