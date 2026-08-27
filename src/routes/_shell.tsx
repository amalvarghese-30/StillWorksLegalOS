import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { useAuth } from "@/lib/auth";
import { SocketProvider } from "@/lib/socket";
import { SkipLink } from "@/components/common/SkipLink";

export const Route = createFileRoute("/_shell")({
  component: ShellLayout,
});

function ShellLayout() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();

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

  return (
    <SocketProvider>
      <div className="app-canvas min-h-screen">
        <SkipLink />
        <div className="mx-auto flex w-full max-w-[1600px] gap-6 px-4 pb-10 lg:px-6">
          <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] shrink-0 py-4 lg:block">
            <Sidebar />
          </aside>
          <div className="flex min-w-0 flex-1 flex-col py-4">
            <Topbar />
            <main id="main-content" className="page-enter mt-6 min-w-0">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </SocketProvider>
  );
}
