import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { AdminTopbar } from "@/components/layout/AdminTopbar";
import { useAuth } from "@/lib/auth";
import { SkipLink } from "@/components/common/SkipLink";
export const Route = createFileRoute("/_admin")({
    component: AdminLayout,
});
function AdminLayout() {
    const { user, ready } = useAuth();
    const navigate = useNavigate();
    useEffect(() => {
        if (!ready)
            return;
        if (!user)
            navigate({ to: "/login", replace: true });
        else if (user.role !== "admin")
            navigate({ to: "/", replace: true });
    }, [ready, user, navigate]);
    if (!ready || !user || user.role !== "admin") {
        return (_jsx("div", { className: "app-canvas grid min-h-screen place-items-center", children: _jsx("p", { className: "text-helper text-muted-foreground", children: "Checking administrator access\u2026" }) }));
    }
    return (_jsxs("div", { className: "app-canvas min-h-screen", children: [_jsx(SkipLink, {}), _jsxs("div", { className: "mx-auto flex w-full max-w-[1600px] gap-6 px-4 pb-10 lg:px-6", children: [_jsx("aside", { className: "sticky top-4 hidden h-[calc(100vh-2rem)] shrink-0 py-4 lg:block", children: _jsx(AdminSidebar, {}) }), _jsxs("div", { className: "flex min-w-0 flex-1 flex-col py-4", children: [_jsx(AdminTopbar, {}), _jsx("main", { id: "main-content", className: "page-enter mt-6 min-w-0", children: _jsx(Outlet, {}) })] })] })] }));
}
