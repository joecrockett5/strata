import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { hasRole, type Role, useCurrentUser } from "./auth";

export function RequireAuth({ role, children }: { role?: Role; children: ReactNode }) {
  const { data: user, isPending } = useCurrentUser();
  const location = useLocation();

  if (isPending) {
    return <p className="p-6 text-sm text-slate-500">Loading…</p>;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (role && !hasRole(user, role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}
