import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { AdminTopbar } from "@/components/layout/AdminTopbar";
import { useAuth } from "@/lib/auth";
import { SkipLink } from "@/components/common/SkipLink";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CallReminderAlerts } from "@/components/calendar/CallReminderAlerts";

export const Route = createFileRoute("/_admin")({
  component: AdminLayout,
});

const ADMIN_MODULE_NAMES: Record<string, string> = {
  employees: "Employees & Team",
  approvals: "Approval Centre",
  auditLogs: "Audit Logs & Security",
  settings: "Firm Settings",
};

function getRequiredAdminPermission(pathname: string): string | null {
  if (pathname.startsWith("/admin/employees")) return "employees";
  if (pathname.startsWith("/admin/approvals")) return "approvals";
  if (pathname.startsWith("/admin/audit-logs")) return "auditLogs";
  if (pathname.startsWith("/admin/settings")) return "settings";
  return null;
}

function AdminLayout() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const hasAdminAccess =
    user?.role === "admin" ||
    !!(
      user?.permissions?.employees ||
      user?.permissions?.approvals ||
      user?.permissions?.auditLogs ||
      user?.permissions?.settings
    );

  useEffect(() => {
    if (!ready) return;
    if (!user) navigate({ to: "/login", replace: true });
    else if (!hasAdminAccess) navigate({ to: "/", replace: true });
  }, [ready, user, hasAdminAccess, navigate]);

  if (!ready || !user || !hasAdminAccess) {
    return (
      <div className="app-canvas grid min-h-screen place-items-center">
        <p className="text-helper text-muted-foreground">Checking administrator access…</p>
      </div>
    );
  }

  const requiredPerm = getRequiredAdminPermission(pathname);
  const isRestricted =
    user.role !== "admin" &&
    requiredPerm &&
    user.permissions &&
    user.permissions[requiredPerm] === false;

  return (
    <div className="app-canvas min-h-screen">
      <SkipLink />
      <CallReminderAlerts />
      <div className="mx-auto flex w-full max-w-[1600px] gap-6 px-3 sm:px-4 lg:px-6 pb-10">
        <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] shrink-0 py-4 lg:block">
          <AdminSidebar />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col py-4">
          <AdminTopbar />
          <main id="main-content" className="page-enter mt-6 min-w-0">
            {isRestricted ? (
              <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-2xl border border-destructive/20 bg-card/60 p-8 text-center shadow-lg backdrop-blur-md">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <ShieldAlert className="h-7 w-7" />
                </div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Access Restricted
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  You do not have permission to access{" "}
                  <span className="font-semibold text-foreground">
                    {ADMIN_MODULE_NAMES[requiredPerm] || "this admin module"}
                  </span>
                  . Please contact your principal administrator.
                </p>
                <div className="mt-6 flex gap-3">
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => navigate({ to: "/" })}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Dashboard
                  </Button>
                </div>
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
