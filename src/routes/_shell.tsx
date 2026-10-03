import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { SkipLink } from "@/components/common/SkipLink";
import { CallReminderAlerts } from "@/components/calendar/CallReminderAlerts";

export const Route = createFileRoute("/_shell")({
  component: ShellLayout,
});

interface RoutePermissionDef {
  prefix: string;
  permKey: string;
  label: string;
}

const ROUTE_PERMISSIONS: RoutePermissionDef[] = [
  { prefix: "/clients", permKey: "clients", label: "Clients" },
  { prefix: "/cases", permKey: "cases", label: "Cases" },
  { prefix: "/tasks", permKey: "tasks", label: "Tasks" },
  { prefix: "/documents", permKey: "documents", label: "Documents" },
  { prefix: "/calendar", permKey: "calendar", label: "Calendar" },
  { prefix: "/chat", permKey: "chat", label: "Chat" },
  { prefix: "/reports", permKey: "reports", label: "Reports" },
];

function ShellLayout() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (ready && !user) navigate({ to: "/login", replace: true });
  }, [ready, user, navigate]);

  if (!ready || !user) {
    return (
      <div className="app-canvas grid min-h-screen place-items-center">
        <p className="text-helper text-muted-foreground">Loading your workspace…</p>
      </div>
    );
  }

  // Check route-level permissions for non-admin employees
  const currentPath = location.pathname;
  const matchedRoute = ROUTE_PERMISSIONS.find(
    (r) => currentPath === r.prefix || currentPath.startsWith(`${r.prefix}/`)
  );

  const isRestricted =
    user.role !== "admin" &&
    matchedRoute &&
    user.permissions &&
    user.permissions[matchedRoute.permKey] === false;

  return (
    <div className="app-canvas min-h-screen">
      <SkipLink />
      <CallReminderAlerts />
      <div className="mx-auto flex w-full max-w-[1600px] gap-6 px-3 sm:px-4 lg:px-6 pb-10">
        <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] shrink-0 py-4 lg:block">
          <Sidebar />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col py-4">
          <Topbar />
          <main id="main-content" className="page-enter mt-6 min-w-0">
            {isRestricted ? (
              <div className="flex flex-col items-center justify-center p-10 text-center rounded-xl border border-destructive/20 bg-card shadow-soft mt-8 max-w-lg mx-auto">
                <div className="grid size-14 place-items-center rounded-full bg-destructive/10 text-destructive mb-4">
                  <ShieldAlert size={28} />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">Access Restricted</h2>
                <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                  Your account does not have permission to access the{" "}
                  <span className="font-semibold text-foreground">{matchedRoute?.label}</span> module.
                  Please contact your firm administrator if you require access.
                </p>
                <Button
                  variant="outline"
                  onClick={() => navigate({ to: "/" })}
                  className="rounded-md"
                >
                  <ArrowLeft size={16} className="mr-2" />
                  Return to Dashboard
                </Button>
              </div>
            ) : (
              <Outlet />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
