// ---------------------------------------------------------------------------
// AdminRoute — requires wallet + admin allowlist (VITE_ADMIN_ADDRESSES).
// ---------------------------------------------------------------------------

import { Navigate, Outlet } from "react-router-dom";
import { useWallet } from "../../hooks/useWallet";
import { isAdminWallet } from "../../utils/adminAuth";

export function AdminRoute() {
  const { connected, address } = useWallet();

  if (!connected || !address) {
    return <Navigate to="/" replace />;
  }

  if (!isAdminWallet(address)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
