import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Briefcase, CheckSquare, AlertTriangle, MessageSquare, Pencil } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusPill, toneForStatus } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { useEmployees } from "@/services/admin";
import { useEmployeeWorkload } from "@/services/reports";
import { useCreateDirectChat } from "@/services/chat";
import { useNavigate } from "@tanstack/react-router";
import { AddEmployeeDialog } from "@/components/admin/AddEmployeeDialog";
import { EditEmployeeDialog } from "@/components/admin/EditEmployeeDialog";
export const Route = createFileRoute("/_admin/admin/employees")({
    head: () => ({
        meta: [
            { title: "Employees · StillWorks LegalOS" },
            {
                name: "description",
                content: "Team management for the firm — roles, workload, hearings and permissions.",
            },
            { property: "og:title", content: "Employees · StillWorks LegalOS" },
            { property: "og:description", content: "Roles, workload, hearings and permissions for your team." },
        ],
    }),
    component: EmployeesPage,
});
function EmployeesPage() {
    const navigate = useNavigate();
    const [showAddEmployee, setShowAddEmployee] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState(null);
    const { data, isLoading, isError } = useEmployees();
    const { data: workloadData } = useEmployeeWorkload();
    const employees = data?.employees ?? [];
    const workloadById = new Map((workloadData?.workloads ?? []).map((w) => [w._id, w]));
    const createDirectChat = useCreateDirectChat();
    const handleMessage = (userId) => {
        createDirectChat.mutate({ userId }, {
            onSuccess: (result) => {
                navigate({ to: "/chat", search: { groupId: result.group._id } });
            },
        });
    };
    return (_jsxs("div", { children: [_jsx(PageHeader, { breadcrumb: [{ label: "StillWorks", to: "/" }, { label: "Employees" }], title: "Employees", subtitle: `${employees.length} people on the team.`, actions: _jsxs(Button, { className: "gradient-primary rounded-md text-primary-foreground shadow-soft transition-transform duration-200 hover:-translate-y-0.5", onClick: () => setShowAddEmployee(true), children: [_jsx(Plus, { size: 17, strokeWidth: 2 }), "Add employee"] }) }), isLoading && (_jsx("div", { className: "grid gap-4 sm:grid-cols-2 xl:grid-cols-3", children: [1, 2, 3].map((i) => (_jsxs("div", { className: "rounded-lg border border-border bg-card p-6 shadow-soft animate-pulse", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "size-12 rounded-full bg-muted" }), _jsxs("div", { className: "space-y-2 flex-1", children: [_jsx("div", { className: "h-4 w-32 rounded bg-muted" }), _jsx("div", { className: "h-3 w-24 rounded bg-muted" })] })] }), _jsx("div", { className: "mt-5 space-y-2", children: _jsx("div", { className: "h-1.5 rounded bg-muted" }) })] }, i))) })), isError && (_jsxs("div", { className: "flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-12 text-center", children: [_jsx(AlertTriangle, { size: 28, className: "text-destructive" }), _jsx("p", { className: "font-medium", children: "Failed to load employees" }), _jsx("p", { className: "text-helper text-muted-foreground", children: "Check that the server is running and try again." })] })), !isLoading && !isError && (_jsx("div", { className: "grid gap-4 sm:grid-cols-2 xl:grid-cols-3", children: employees.map((e) => (_jsxs("article", { className: "lift rounded-lg border border-border bg-card p-6 shadow-soft", children: [_jsxs("div", { className: "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3", children: [_jsx("span", { className: "gradient-primary grid size-12 shrink-0 place-items-center rounded-full font-display font-semibold text-primary-foreground", children: (e.name ?? "")
                                        .replace("Adv. ", "")
                                        .split(" ")
                                        .map((n) => n[0] ?? "")
                                        .join("") }), _jsxs("div", { className: "min-w-0", children: [_jsx("h2", { className: "truncate font-semibold", children: e.name }), _jsx("p", { className: "truncate text-caption text-muted-foreground", children: e.role })] }), _jsx(StatusPill, { tone: toneForStatus(e.status), children: e.status })] }), _jsxs("dl", { className: "mt-5 grid grid-cols-2 gap-3", children: [_jsxs("div", { className: "rounded-md bg-muted/60 p-3", children: [_jsxs("dt", { className: "flex items-center gap-1.5 text-caption text-muted-foreground", children: [_jsx(Briefcase, { size: 14, strokeWidth: 1.75 }), " Active cases"] }), _jsx("dd", { className: "num mt-1 text-title font-semibold", children: workloadById.get(e._id)?.activeCases ?? 0 })] }), _jsxs("div", { className: "rounded-md bg-muted/60 p-3", children: [_jsxs("dt", { className: "flex items-center gap-1.5 text-caption text-muted-foreground", children: [_jsx(CheckSquare, { size: 14, strokeWidth: 1.75 }), " Pending tasks"] }), _jsx("dd", { className: "num mt-1 text-title font-semibold", children: workloadById.get(e._id)?.pendingTasks ?? 0 })] })] }), _jsx("p", { className: "mt-4 truncate text-caption text-muted-foreground", children: e.email }), _jsxs("div", { className: "mt-4 flex items-center justify-end gap-2", children: [_jsxs(Button, { variant: "outline", size: "sm", className: "rounded-md", onClick: () => setEditingEmployee(e), children: [_jsx(Pencil, { size: 14, strokeWidth: 1.75, className: "mr-1" }), "Edit"] }), _jsxs(Button, { variant: "outline", size: "sm", className: "rounded-md", onClick: () => handleMessage(e._id), disabled: createDirectChat.isPending, children: [_jsx(MessageSquare, { size: 14, strokeWidth: 1.75, className: "mr-1" }), "Message"] })] })] }, e._id))) })), showAddEmployee && (_jsx(AddEmployeeDialog, { open: showAddEmployee, onClose: () => setShowAddEmployee(false) })), _jsx(EditEmployeeDialog, { employee: editingEmployee, onClose: () => setEditingEmployee(null) })] }));
}
