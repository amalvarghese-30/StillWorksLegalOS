import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
        if (ready && !user)
            navigate({ to: "/login", replace: true });
    }, [ready, user, navigate]);
    if (!ready || !user) {
        return (_jsx("div", { className: "app-canvas grid min-h-screen place-items-center", children: _jsx("p", { className: "text-helper text-muted-foreground", children: "Loading your workspace\u2026" }) }));
    }
    return (_jsx(SocketProvider, { children: _jsxs("div", { className: "app-canvas min-h-screen", children: [_jsx(SkipLink, {}), _jsxs("div", { className: "mx-auto flex w-full max-w-[1600px] gap-6 px-4 pb-10 lg:px-6", children: [_jsx("aside", { className: "sticky top-4 hidden h-[calc(100vh-2rem)] shrink-0 py-4 lg:block", children: _jsx(Sidebar, {}) }), _jsxs("div", { className: "flex min-w-0 flex-1 flex-col py-4", children: [_jsx(Topbar, {}), _jsx("main", { id: "main-content", className: "page-enter mt-6 min-w-0", children: _jsx(Outlet, {}) })] })] })] }) }));
}
