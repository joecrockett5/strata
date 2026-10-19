import { LogOut } from "lucide-react";
import { NavLink, Outlet } from "react-router";
import { Button } from "@/components/ui/button";
import { hasRole, useCurrentUser, useLogout } from "@/features/auth/auth";
import { cn } from "@/lib/cn";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "rounded-md px-3 py-1.5 text-sm font-medium",
    isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100",
  );

export function AppShell() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex h-14 items-center gap-6 border-b border-slate-200 bg-white px-4">
        <span className="font-semibold">Strata</span>
        <nav aria-label="Main" className="flex gap-1">
          {hasRole(user, "Designer") && (
            <>
              <NavLink to="/designer/sections" className={linkClass}>
                Sections
              </NavLink>
              <NavLink to="/designer/templates" className={linkClass}>
                Templates
              </NavLink>
            </>
          )}
          {hasRole(user, "SiteOwner") && (
            <NavLink to="/sites" className={linkClass}>
              My sites
            </NavLink>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-slate-600" data-testid="current-user">
            {user?.displayName}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              logout.mutate();
            }}
          >
            <LogOut className="size-4" aria-hidden /> Sign out
          </Button>
        </div>
      </header>
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}
