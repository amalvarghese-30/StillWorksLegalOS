import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useState } from "react";
import { Plus, Trash2, CheckSquare, PhoneCall, Loader2, ListChecks, UserRound, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useCreateTask, useTaskOptions } from "@/services/tasks";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from "@/components/ui/dialog";
const EMPTY_FORM = {
    title: "",
    description: "",
    category: "",
    priority: "Medium",
    deadline: "",
    caseId: "",
    clientId: "",
    assignedTo: "",
    callClientName: "",
    callPhone: "",
    callScheduledAt: "",
    callNotes: "",
};
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
let checklistCounter = 0;
function nextId() {
    return `cl_${++checklistCounter}_${Date.now()}`;
}
export function AddTaskDialog({ open, onClose }) {
    const { user } = useAuth();
    const { data: options } = useTaskOptions();
    const [form, setForm] = useState({ ...EMPTY_FORM, assignedTo: user?._id ?? "" });
    const [checklist, setChecklist] = useState([]);
    const [addCallReminder, setAddCallReminder] = useState(false);
    const [agentSelect, setAgentSelect] = useState("");
    const [agentCustom, setAgentCustom] = useState("");
    const [appliedTemplates, setAppliedTemplates] = useState([]);
    const templateInsertions = useRef({});
    const createTask = useCreateTask();
    const isPending = createTask.isPending;
    const isError = createTask.isError;
    if (!open)
        return null;
    const categories = options?.categories ?? [];
    const templates = options?.checklistTemplates ?? [];
    const agents = options?.agents ?? [];
    const staff = (options?.staff ?? []).filter((s) => s._id !== (user?._id ?? ""));
    const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
    const addChecklistItem = () => {
        setChecklist((prev) => [...prev, { id: nextId(), text: "" }]);
    };
    const updateChecklistItem = (id, text) => {
        setChecklist((prev) => prev.map((cl) => (cl.id === id ? { ...cl, text } : cl)));
    };
    const removeChecklistItem = (id) => {
        setChecklist((prev) => prev.filter((cl) => cl.id !== id));
    };
    const toggleTemplate = (name) => {
        const isApplied = appliedTemplates.includes(name);
        if (isApplied) {
            const ids = templateInsertions.current[name] ?? [];
            setChecklist((prev) => prev.filter((cl) => !ids.includes(cl.id)));
            delete templateInsertions.current[name];
            setAppliedTemplates((prev) => prev.filter((t) => t !== name));
            return;
        }
        const tpl = templates.find((t) => t.name === name);
        if (!tpl)
            return;
        const newLines = tpl.items.map((text) => ({ id: nextId(), text }));
        templateInsertions.current[name] = newLines.map((l) => l.id);
        setChecklist((prev) => [...prev, ...newLines]);
        setAppliedTemplates((prev) => [...prev, name]);
    };
    const reset = () => {
        setForm({ ...EMPTY_FORM, assignedTo: user?._id ?? "" });
        setChecklist([]);
        setAddCallReminder(false);
        setAgentSelect("");
        setAgentCustom("");
        setAppliedTemplates([]);
        templateInsertions.current = {};
    };
    const handleClose = () => {
        reset();
        onClose();
    };
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.title.trim())
            return;
        const finalAgent = agentSelect === "__other__" ? agentCustom.trim() : agentSelect;
        const payload = {
            title: form.title,
            ...(form.description && { description: form.description }),
            ...(form.category && { category: form.category }),
            priority: form.priority,
            ...(form.deadline && { deadline: form.deadline }),
            ...(form.caseId && { caseId: form.caseId }),
            ...(form.clientId && { clientId: form.clientId }),
            ...(form.assignedTo && { assignedTo: form.assignedTo }),
            ...(finalAgent && { agent: finalAgent }),
            ...(checklist.length > 0 && {
                checklist: checklist.map((cl) => ({ text: cl.text, done: false })),
            }),
            ...(addCallReminder && {
                callReminder: {
                    clientName: form.callClientName,
                    phone: form.callPhone,
                    scheduledAt: form.callScheduledAt,
                    notes: form.callNotes,
                },
            }),
        };
        createTask.mutate(payload, {
            onSuccess: () => {
                reset();
                onClose();
            },
        });
    };
    return (_jsx(Dialog, { open: open, onOpenChange: handleClose, children: _jsxs(DialogContent, { className: "max-w-2xl", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Create task" }), _jsx(DialogDescription, { children: "Add a task with subtasks and an optional call reminder." })] }), _jsxs("form", { className: "space-y-6", onSubmit: handleSubmit, children: [_jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [_jsxs("div", { className: "space-y-1.5 sm:col-span-2", children: [_jsx(Label, { htmlFor: "task-title", className: "text-helper", children: "Task title *" }), _jsx(Input, { id: "task-title", required: true, value: form.title, onChange: (e) => update("title", e.target.value), placeholder: "e.g. File written statement", className: "h-11 rounded-md" })] }), _jsxs("div", { className: "space-y-1.5 sm:col-span-2", children: [_jsx(Label, { htmlFor: "task-desc", className: "text-helper", children: "Description" }), _jsx(Input, { id: "task-desc", value: form.description, onChange: (e) => update("description", e.target.value), placeholder: "What needs to be done", className: "h-11 rounded-md" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "task-category", className: "text-helper", children: "Category" }), _jsxs(Select, { value: form.category, onValueChange: (v) => update("category", v), children: [_jsx(SelectTrigger, { id: "task-category", className: "h-11 rounded-md", children: _jsx(SelectValue, { placeholder: "Select category" }) }), _jsx(SelectContent, { children: categories.map((c) => (_jsx(SelectItem, { value: c, children: c }, c))) })] })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "task-deadline", className: "text-helper", children: "Deadline" }), _jsx(Input, { id: "task-deadline", type: "datetime-local", value: form.deadline, onChange: (e) => update("deadline", e.target.value), className: "h-11 rounded-md" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "task-assign", className: "text-helper", children: "Assign to" }), _jsxs(Select, { value: form.assignedTo, onValueChange: (v) => update("assignedTo", v), children: [_jsx(SelectTrigger, { id: "task-assign", className: "h-11 rounded-md", children: _jsx(SelectValue, { placeholder: "Assign to" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: user?._id ?? "self", children: _jsxs("span", { className: "flex items-center gap-2", children: [_jsx(UserRound, { size: 14 }), " Self"] }) }), staff.map((s) => (_jsx(SelectItem, { value: s._id, children: s.name }, s._id)))] })] })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { className: "text-helper", children: "Priority" }), _jsx("div", { className: "flex rounded-md border border-border", children: ["High", "Medium", "Low"].map((p) => (_jsx("button", { type: "button", onClick: () => update("priority", p), className: `flex-1 px-2.5 py-2 text-caption font-medium transition-colors ${p === "High" ? "rounded-l-md border-r" : p === "Low" ? "rounded-r-md border-l" : "border-r"} border-border ${form.priority === p
                                                    ? p === "High"
                                                        ? "bg-destructive/10 text-destructive"
                                                        : p === "Medium"
                                                            ? "bg-warning/10 text-warning"
                                                            : "bg-muted text-muted-foreground"
                                                    : "text-muted-foreground hover:text-foreground"}`, children: p }, p))) })] }), _jsxs("div", { className: "space-y-1.5 sm:col-span-2", children: [_jsx(Label, { htmlFor: "task-agent", className: "text-helper", children: "Broker / Agent (optional)" }), _jsxs(Select, { value: agentSelect, onValueChange: (v) => setAgentSelect(v), children: [_jsx(SelectTrigger, { id: "task-agent", className: "h-11 rounded-md", children: _jsx(SelectValue, { placeholder: "Select an agent" }) }), _jsxs(SelectContent, { children: [agents.map((a) => (_jsx(SelectItem, { value: a, children: a }, a))), _jsx(SelectItem, { value: "__other__", children: "Other\u2026" })] })] }), agentSelect === "__other__" && (_jsx(Input, { value: agentCustom, onChange: (e) => setAgentCustom(e.target.value), placeholder: "Agent / broker name", className: "mt-2 h-11 rounded-md" }))] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "task-caseid", className: "text-helper", children: "Case ID (optional)" }), _jsx(Input, { id: "task-caseid", value: form.caseId, onChange: (e) => update("caseId", e.target.value), placeholder: "Link to a case", className: "h-11 rounded-md" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "task-clientid", className: "text-helper", children: "Client ID (optional)" }), _jsx(Input, { id: "task-clientid", value: form.clientId, onChange: (e) => update("clientId", e.target.value), placeholder: "Link to a client", className: "h-11 rounded-md" })] })] }), templates.length > 0 && (_jsxs("div", { className: "rounded-lg border border-border p-4", children: [_jsxs("p", { className: "mb-3 flex items-center gap-2 text-helper font-medium", children: [_jsx(ListChecks, { size: 16, strokeWidth: 1.75, className: "text-muted-foreground" }), "Quick checklist templates"] }), _jsx("div", { className: "flex flex-wrap gap-2", children: templates.map((t) => {
                                        const active = appliedTemplates.includes(t.name);
                                        return (_jsxs("button", { type: "button", onClick: () => toggleTemplate(t.name), className: `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-caption font-medium transition-colors ${active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"}`, children: [active ? _jsx(BadgeCheck, { size: 14 }) : _jsx(Plus, { size: 14 }), t.name] }, t.name));
                                    }) })] })), _jsxs("div", { className: "rounded-lg border border-border", children: [_jsxs("div", { className: "flex items-center justify-between px-4 py-3", children: [_jsxs("p", { className: "flex items-center gap-2 text-helper font-medium", children: [_jsx(CheckSquare, { size: 16, strokeWidth: 1.75, className: "text-muted-foreground" }), "Subtask checklist"] }), _jsxs(Button, { type: "button", variant: "outline", size: "sm", className: "rounded-md", onClick: addChecklistItem, children: [_jsx(Plus, { size: 14 }), " Add item"] })] }), checklist.length > 0 && (_jsx("div", { className: "border-t border-border p-4 space-y-2", children: checklist.map((cl) => (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Input, { value: cl.text, onChange: (e) => updateChecklistItem(cl.id, e.target.value), placeholder: "Subtask description", className: "h-10 flex-1 rounded-md" }), _jsx("button", { type: "button", onClick: () => removeChecklistItem(cl.id), className: "grid size-9 shrink-0 place-items-center rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive", "aria-label": "Remove checklist item", children: _jsx(Trash2, { size: 15 }) })] }, cl.id))) })), checklist.length === 0 && (_jsx("div", { className: "border-t border-border px-4 py-6 text-center text-helper text-muted-foreground", children: "No subtasks yet. Add specific items that make up this task." }))] }), _jsxs("div", { className: "rounded-lg border border-border", children: [_jsxs("button", { type: "button", onClick: () => setAddCallReminder(!addCallReminder), className: "flex w-full items-center justify-between px-4 py-3 text-left", children: [_jsxs("p", { className: "flex items-center gap-2 text-helper font-medium", children: [_jsx(PhoneCall, { size: 16, strokeWidth: 1.75, className: "text-muted-foreground" }), "Call reminder ", _jsx("span", { className: "text-caption text-muted-foreground", children: "(optional)" })] }), _jsx("span", { className: "text-caption text-muted-foreground", children: addCallReminder ? "Added" : "Add" })] }), addCallReminder && (_jsx("div", { className: "border-t border-border p-4", children: _jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "call-name", className: "text-helper", children: "Client name" }), _jsx(Input, { id: "call-name", value: form.callClientName, onChange: (e) => update("callClientName", e.target.value), placeholder: "Who to call", className: "h-11 rounded-md" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "call-phone", className: "text-helper", children: "Phone number" }), _jsx(Input, { id: "call-phone", value: form.callPhone, onChange: (e) => update("callPhone", e.target.value), placeholder: "+91-XXXXXXXXXX", className: "h-11 rounded-md" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "call-schedule", className: "text-helper", children: "Scheduled for" }), _jsx(Input, { id: "call-schedule", type: "datetime-local", value: form.callScheduledAt, onChange: (e) => update("callScheduledAt", e.target.value), className: "h-11 rounded-md" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "call-notes", className: "text-helper", children: "Notes" }), _jsx(Input, { id: "call-notes", value: form.callNotes, onChange: (e) => update("callNotes", e.target.value), placeholder: "What to discuss", className: "h-11 rounded-md" })] })] }) }))] }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: handleClose, children: "Cancel" }), _jsxs(Button, { type: "submit", disabled: isPending || !form.title.trim(), className: "gradient-primary rounded-md text-primary-foreground shadow-soft", children: [isPending ? _jsx(Loader2, { size: 17, className: "animate-spin" }) : _jsx(Plus, { size: 17, strokeWidth: 2 }), isPending ? "Saving…" : "Create task"] })] }), isError && (_jsx("p", { className: "text-caption text-destructive", children: "Failed to create task. Please try again." }))] })] }) }));
}
