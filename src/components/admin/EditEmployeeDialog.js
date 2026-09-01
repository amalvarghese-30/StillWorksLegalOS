import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useUpdateEmployee, } from "@/services/admin";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from "@/components/ui/dialog";
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ROLES = [
    { value: "junior_advocate", label: "Junior Advocate" },
    { value: "senior_advocate", label: "Senior Advocate" },
    { value: "legal_assistant", label: "Legal Assistant" },
    { value: "office_staff", label: "Office Staff" },
    { value: "reception", label: "Reception" },
    { value: "intern", label: "Intern" },
    { value: "admin", label: "Administrator" },
];
const STATUSES = [
    { value: "offline", label: "Offline" },
    { value: "online", label: "Online" },
    { value: "away", label: "Away" },
];
const CORE_PERMISSIONS = [
    { key: "dashboard", label: "Dashboard" },
    { key: "clients", label: "Clients" },
    { key: "cases", label: "Cases" },
    { key: "tasks", label: "Tasks" },
    { key: "documents", label: "Documents" },
    { key: "calendar", label: "Calendar" },
    { key: "chat", label: "Chat" },
    { key: "reports", label: "Reports" },
];
const ADMIN_PERMISSIONS = [
    { key: "employees", label: "Employees" },
    { key: "approvals", label: "Approvals" },
    { key: "auditLogs", label: "Audit logs" },
    { key: "settings", label: "Admin settings" },
];
const DEFAULT_PERMISSIONS = {
    dashboard: true,
    clients: true,
    cases: true,
    tasks: true,
    documents: true,
    calendar: true,
    chat: true,
    reports: true,
    employees: false,
    approvals: false,
    auditLogs: false,
    settings: false,
};
export function EditEmployeeDialog({ employee, onClose }) {
    const [role, setRole] = useState("junior_advocate");
    const [title, setTitle] = useState("");
    const [phone, setPhone] = useState("");
    const [status, setStatus] = useState("offline");
    const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS);
    const updateEmployee = useUpdateEmployee();
    const isPending = updateEmployee.isPending;
    const isError = updateEmployee.isError;
    useEffect(() => {
        if (employee) {
            setRole(employee.role);
            setTitle(employee.title ?? "");
            setPhone(employee.phone ?? "");
            setStatus(employee.status ?? "offline");
            setPermissions({
                ...DEFAULT_PERMISSIONS,
                ...(employee.permissions ?? {}),
            });
        }
    }, [employee]);
    if (!employee)
        return null;
    const togglePermission = (key) => setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
    const handleSubmit = (e) => {
        e.preventDefault();
        updateEmployee.mutate({
            id: employee._id,
            data: { role, title: title.trim(), phone: phone.trim(), status, permissions },
        }, {
            onSuccess: () => onClose(),
        });
    };
    return (_jsx(Dialog, { open: !!employee, onOpenChange: onClose, children: _jsxs(DialogContent, { className: "max-w-lg", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Edit employee" }), _jsx(DialogDescription, { children: employee.email })] }), _jsxs("form", { className: "space-y-5", onSubmit: handleSubmit, children: [_jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "edit-role", className: "text-helper", children: "Role" }), _jsx("select", { id: "edit-role", value: role, onChange: (e) => setRole(e.target.value), className: "h-11 w-full rounded-md border border-border bg-background px-3 text-helper text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary", children: ROLES.map((r) => (_jsx("option", { value: r.value, children: r.label }, r.value))) })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "edit-status", className: "text-helper", children: "Status" }), _jsx("select", { id: "edit-status", value: status, onChange: (e) => setStatus(e.target.value), className: "h-11 w-full rounded-md border border-border bg-background px-3 text-helper text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary", children: STATUSES.map((s) => (_jsx("option", { value: s.value, children: s.label }, s.value))) })] })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "edit-title", className: "text-helper", children: "Title" }), _jsx(Input, { id: "edit-title", value: title, onChange: (e) => setTitle(e.target.value), placeholder: "e.g. Senior Associate", className: "h-11 rounded-md" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "edit-phone", className: "text-helper", children: "Phone" }), _jsx(Input, { id: "edit-phone", value: phone, onChange: (e) => setPhone(e.target.value), placeholder: "+91-XXXXXXXXXX", className: "h-11 rounded-md" })] }), _jsxs("div", { className: "space-y-3", children: [_jsx(Label, { className: "text-helper", children: "Module access" }), _jsxs("div", { className: "rounded-md border border-border p-4", children: [_jsx("p", { className: "mb-3 text-caption font-medium text-muted-foreground", children: "Core modules" }), _jsx("div", { className: "grid grid-cols-2 gap-x-4 gap-y-2", children: CORE_PERMISSIONS.map((p) => (_jsxs("label", { className: "flex items-center justify-between gap-2 py-0.5", children: [_jsx("span", { className: "text-helper", children: p.label }), _jsx(Switch, { checked: permissions[p.key], onCheckedChange: () => togglePermission(p.key) })] }, p.key))) })] }), _jsxs("div", { className: "rounded-md border border-border p-4", children: [_jsx("p", { className: "mb-3 text-caption font-medium text-muted-foreground", children: "Admin modules" }), _jsx("div", { className: "grid grid-cols-2 gap-x-4 gap-y-2", children: ADMIN_PERMISSIONS.map((p) => (_jsxs("label", { className: "flex items-center justify-between gap-2 py-0.5", children: [_jsx("span", { className: "text-helper", children: p.label }), _jsx(Switch, { checked: permissions[p.key], onCheckedChange: () => togglePermission(p.key) })] }, p.key))) })] })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: onClose, children: "Cancel" }), _jsxs(Button, { type: "submit", disabled: isPending, className: "gradient-primary rounded-md text-primary-foreground shadow-soft", children: [isPending ? _jsx(Loader2, { size: 17, className: "animate-spin" }) : _jsx(Save, { size: 17, strokeWidth: 2 }), isPending ? "Saving…" : "Save changes"] })] }), isError && (_jsx("p", { className: "text-caption text-destructive", children: "Failed to update employee. Please try again." }))] })] }) }));
}
