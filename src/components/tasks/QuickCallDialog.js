import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { PhoneCall, Loader2, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateTask } from "@/services/tasks";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, } from "@/components/ui/dialog";
const EMPTY = {
    name: "",
    phone: "",
    note: "",
    scheduledAt: "",
};
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function QuickCallDialog({ open, onClose }) {
    const [form, setForm] = useState(EMPTY);
    const createTask = useCreateTask();
    const isPending = createTask.isPending;
    const isError = createTask.isError;
    const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
    const handleClose = () => {
        setForm(EMPTY);
        onClose();
    };
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.name.trim())
            return;
        const payload = {
            title: `📞 CALL: ${form.name.trim()}`,
            category: "Other Work",
            isCall: true,
            callReminder: {
                clientName: form.name.trim(),
                phone: form.phone.trim(),
                scheduledAt: form.scheduledAt || new Date().toISOString(),
                notes: form.note.trim(),
            },
        };
        createTask.mutate(payload, {
            onSuccess: () => {
                setForm(EMPTY);
                onClose();
            },
        });
    };
    if (!open)
        return null;
    return (_jsx(Dialog, { open: open, onOpenChange: onClose, children: _jsxs(DialogContent, { className: "max-w-md", children: [_jsxs(DialogHeader, { children: [_jsxs(DialogTitle, { children: [_jsx(PhoneCall, { size: 19, strokeWidth: 1.75, className: "text-primary" }), "Quick call reminder"] }), _jsx(DialogDescription, { children: "Log a follow-up call in one tap." })] }), _jsxs("form", { className: "space-y-5", onSubmit: handleSubmit, children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "call-name", className: "text-helper", children: "Contact name *" }), _jsx(Input, { id: "call-name", required: true, value: form.name, onChange: (e) => update("name", e.target.value), placeholder: "Who to call", className: "h-11 rounded-md" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "call-phone", className: "text-helper", children: "Phone number" }), _jsx(Input, { id: "call-phone", value: form.phone, onChange: (e) => update("phone", e.target.value), placeholder: "+91-XXXXXXXXXX", className: "h-11 rounded-md" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsxs(Label, { htmlFor: "call-schedule", className: "text-helper flex items-center gap-1.5", children: [_jsx(CalendarClock, { size: 14, strokeWidth: 1.75, className: "text-muted-foreground" }), "Remind me at"] }), _jsx(Input, { id: "call-schedule", type: "datetime-local", value: form.scheduledAt, onChange: (e) => update("scheduledAt", e.target.value), className: "h-11 rounded-md" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "call-note", className: "text-helper", children: "Note" }), _jsx(Input, { id: "call-note", value: form.note, onChange: (e) => update("note", e.target.value), placeholder: "What to discuss", className: "h-11 rounded-md" })] }), isError && (_jsx("p", { className: "text-caption text-destructive", children: "Failed to create reminder. Please try again." })), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: handleClose, children: "Cancel" }), _jsxs(Button, { type: "submit", disabled: isPending || !form.name.trim(), className: "gradient-primary rounded-md text-primary-foreground shadow-soft", children: [isPending ? _jsx(Loader2, { size: 17, className: "animate-spin" }) : _jsx(PhoneCall, { size: 17, strokeWidth: 2 }), isPending ? "Saving…" : "Create reminder"] })] })] })] }) }));
}
