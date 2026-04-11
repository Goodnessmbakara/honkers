// ---------------------------------------------------------------------------
// Root App component — routing setup
// ---------------------------------------------------------------------------

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { ErrorBoundary } from "./components/safety/ErrorBoundary";
import { AztecProvider } from "./components/AztecProvider";

// Pages
import { Landing } from "./pages/Landing";
import { Markets } from "./pages/Markets";
import { MarketDetail } from "./pages/MarketDetail";
import { Trade } from "./pages/Trade";
import { Portfolio } from "./pages/Portfolio";
import { Winnings } from "./pages/Winnings";
import { Faucet } from "./pages/Faucet";
import { CreateMarket } from "./pages/CreateMarket";
import { Settings } from "./pages/Settings";
import { Backup } from "./pages/Backup";
import { Privacy } from "./pages/Privacy";
import { Terms } from "./pages/Terms";
import { Risk } from "./pages/Risk";
import { GeoBlocked } from "./pages/GeoBlocked";
import { NetworkError } from "./pages/NetworkError";
import { Maintenance } from "./pages/Maintenance";

// Admin
import { AdminHome } from "./admin/AdminHome";
import { AdminMarket } from "./admin/AdminMarket";

export default function App() {
  return (
    <ErrorBoundary>
      <AztecProvider>
        <BrowserRouter>
        <Routes>
          {/* Public shell routes */}
          <Route element={<AppShell />}>
            <Route index element={<Landing />} />
            <Route path="markets" element={<Markets />} />
            <Route path="markets/:id" element={<MarketDetail />} />
            <Route path="trade/:id" element={<Trade />} />
            <Route path="portfolio" element={<Portfolio />} />
            <Route path="winnings" element={<Winnings />} />
            <Route path="faucet" element={<Faucet />} />
            <Route path="create" element={<CreateMarket />} />
            <Route path="settings" element={<Settings />} />
            <Route path="backup" element={<Backup />} />
            <Route path="privacy" element={<Privacy />} />
            <Route path="terms" element={<Terms />} />
            <Route path="risk" element={<Risk />} />

            {/* Admin */}
            <Route path="admin" element={<AdminHome />} />
            <Route path="admin/market/:id" element={<AdminMarket />} />
          </Route>

          {/* Standalone pages (no shell) */}
          <Route path="geo-blocked" element={<GeoBlocked />} />
          <Route path="network-error" element={<NetworkError />} />
          <Route path="maintenance" element={<Maintenance />} />
        </Routes>
      </BrowserRouter>
      </AztecProvider>
    </ErrorBoundary>
  );
}
