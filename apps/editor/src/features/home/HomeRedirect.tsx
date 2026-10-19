import { Navigate } from "react-router";
import { hasRole, useCurrentUser } from "@/features/auth/auth";

/** Sends each role to its own landing page. */
export function HomeRedirect() {
  const { data: user } = useCurrentUser();
  return <Navigate to={hasRole(user, "Designer") ? "/designer/sections" : "/sites"} replace />;
}
