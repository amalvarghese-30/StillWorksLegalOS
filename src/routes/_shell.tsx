import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ShieldAlert, ArrowLeft, Bell, X } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { SkipLink } from "@/components/common/SkipLink";
import { CallReminderAlerts } from "@/components/calendar/CallReminderAlerts";
import { notifications, getNotificationPermissionStatus, isElectron } from "@/platform";
import { useSocketEvent } from "@/lib/socket";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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
  const [notifPromptVisible, setNotifPromptVisible] = useState<boolean>(() => {
    if (isElectron()) return false;
    if (typeof window === "undefined") return false;
    const dismissed = localStorage.getItem("stillworks_notif_prompt_dismissed");
    return !dismissed && getNotificationPermissionStatus() === "default";
  });

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

  const queryClient = useQueryClient();

  // Global real-time synchronization for tasks and notifications across all routes
  useSocketEvent("task:created", () => {
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    queryClient.invalidateQueries({ queryKey: ["reports"] });
    queryClient.invalidateQueries({ queryKey: ["calendar"] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  });

  useSocketEvent("task:updated", () => {
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    queryClient.invalidateQueries({ queryKey: ["calendar"] });
    queryClient.invalidateQueries({ queryKey: ["reports"] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  });

  useSocketEvent<{ taskId: string }>("task:deleted", (payload) => {
    if (payload?.taskId) {
      queryClient.removeQueries({ queryKey: ["tasks", payload.taskId] });
      queryClient.removeQueries({ queryKey: ["task", payload.taskId] });
    }
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    queryClient.invalidateQueries({ queryKey: ["calendar"] });
    queryClient.invalidateQueries({ queryKey: ["reports"] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  });

  const isChatRoute = currentPath.startsWith("/chat");
  const searchParams = (location.search ?? {}) as Record<string, any>;
  const isChatActiveOnMobile = isChatRoute && Boolean(searchParams?.groupId);

  return (
    <div className="app-canvas min-h-screen overflow-x-hidden">
      <SkipLink />
      <CallReminderAlerts />
      <div
        className={
          isChatActiveOnMobile
            ? "mx-auto flex w-full max-w-[1600px] gap-6 px-0 lg:px-6 pb-0 lg:pb-10"
            : "mx-auto flex w-full max-w-[1600px] gap-6 px-2.5 sm:px-4 lg:px-6 pb-20 sm:pb-24 lg:pb-10"
        }
      >
        <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] shrink-0 py-4 lg:block">
          <Sidebar />
        </aside>
        <div className={`flex min-w-0 flex-1 flex-col ${isChatActiveOnMobile ? "py-0 lg:py-4" : "py-2 sm:py-4"}`}>
          <div className={isChatActiveOnMobile ? "hidden lg:block" : "block"}>
            <Topbar />
          </div>
          {!isElectron() && notifPromptVisible && !isChatActiveOnMobile && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-2.5 shadow-xs transition-all">
              <div className="flex items-center gap-2.5 min-w-0">
                <Bell size={16} className="text-primary shrink-0" />
                <p className="text-xs text-foreground font-medium">
                  Enable browser notifications to receive hearing dates, call reminders, and chat alerts in real time.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  className="gradient-primary text-primary-foreground h-7 px-3 text-xs rounded-md shadow-xs"
                  onClick={async () => {
                    const granted = await notifications.requestPermission();
                    setNotifPromptVisible(false);
                    if (granted) {
                      toast.success("Desktop notifications enabled successfully");
                    }
                  }}
                >
                  Enable
                </Button>
                <button
                  onClick={() => {
                    setNotifPromptVisible(false);
                    localStorage.setItem("stillworks_notif_prompt_dismissed", "true");
                  }}
                  className="p-1 text-muted-foreground hover:text-foreground rounded-md transition-colors"
                  title="Dismiss"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          )}
          <main id="main-content" className={`page-enter min-w-0 ${isChatActiveOnMobile ? "mt-0 lg:mt-6" : "mt-3 sm:mt-6"}`}>
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

      {/* Mobile Application Navigation Shell */}
      <MobileBottomNav />
    </div>
  );
}
