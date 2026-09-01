import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { UserPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateEmployee } from "@/services/admin";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from "@/components/ui/dialog";
// ---------------------------------------------------------------------------
// Types
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
const EMPTY_FORM = {
    name: "",
    email: "",
    role: "junior_advocate",
    title: "",
    phone: "",
    password: "password123",
};
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function AddEmployeeDialog({ open, onClose }) {
    const [form, setForm] = useState(EMPTY_FORM);
    const createEmployee = useCreateEmployee();
    const isPending = createEmployee.isPending;
    const isError = createEmployee.isError;
    const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.name.trim() || !form.email.trim())
            return;
        createEmployee.mutate({
            name: form.name.trim(),
            email: form.email.trim(),
            role: form.role,
            title: form.title.trim(),
            phone: form.phone.trim(),
            password: form.password || "password123",
        }, {
            onSuccess: () => {
                setForm(EMPTY_FORM);
                onClose();
            },
        });
    };
    if (!open)
        return null;
    return (_jsx(Dialog, { open: open, onOpenChange: onClose, children: _jsxs(DialogContent, { className: "max-w-lg", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Add employee" }), _jsx(DialogDescription, { children: "Create a team member account. They can sign in with the email and password below." })] }), _jsxs("form", { className: "space-y-5", onSubmit: handleSubmit, children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "emp-name", className: "text-helper", children: "Full name *" }), _jsx(Input, { id: "emp-name", required: true, value: form.name, onChange: (e) => update("name", e.target.value), placeholder: "e.g. Adv. Priya Nair", className: "h-11 rounded-md" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "emp-email", className: "text-helper", children: "Email *" }), _jsx(Input, { id: "emp-email", required: true, type: "email", value: form.email, onChange: (e) => update("email", e.target.value), placeholder: "name@stillworks.legal", className: "h-11 rounded-md" })] }), _jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "emp-role", className: "text-helper", children: "Role" }), _jsx("select", { id: "emp-role", value: form.role, onChange: (e) => update("role", e.target.value), className: "h-11 w-full rounded-md border border-border bg-background px-3 text-helper text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary", children: ROLES.map((r) => (_jsx("option", { value: r.value, children: r.label }, r.value))) })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "emp-title", className: "text-helper", children: "Title" }), _jsx(Input, { id: "emp-title", value: form.title, onChange: (e) => update("title", e.target.value), placeholder: "e.g. Senior Associate", className: "h-11 rounded-md" })] })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "emp-phone", className: "text-helper", children: "Phone" }), _jsx(Input, { id: "emp-phone", value: form.phone, onChange: (e) => update("phone", e.target.value), placeholder: "+91-XXXXXXXXXX", className: "h-11 rounded-md" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "emp-password", className: "text-helper", children: "Initial password" }), _jsx(Input, { id: "emp-password", value: form.password, onChange: (e) => update("password", e.target.value), placeholder: "password123", className: "h-11 rounded-md" }), _jsx("p", { className: "text-caption text-muted-foreground", children: "Share this with the employee \u2014 they can change it after their first sign-in." })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", className: "rounded-md", onClick: onClose, children: "Cancel" }), _jsxs(Button, { type: "submit", disabled: isPending || !form.name.trim() || !form.email.trim(), className: "gradient-primary rounded-md text-primary-foreground shadow-soft", children: [isPending ? _jsx(Loader2, { size: 17, className: "animate-spin" }) : _jsx(UserPlus, { size: 17, strokeWidth: 2 }), isPending ? "Creating…" : "Create employee"] })] }), isError && (_jsx("p", { className: "text-caption text-destructive", children: "Failed to create employee. Check the email isn't already in use and try again." }))] })] }) }));
}
