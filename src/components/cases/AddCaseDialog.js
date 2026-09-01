import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { X, Plus, Trash2, Briefcase, Users, Loader2, } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateCase } from "@/services/cases";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from "@/components/ui/dialog";
const EMPTY_FORM = {
    title: "",
    description: "",
    practice: "",
    court: "",
    judge: "",
    status: "Active",
    priority: "Medium",
    nextHearing: "",
    tags: "",
    nasPath: "",
};
const PRACTICE_AREAS = [
    "Civil Litigation",
    "Criminal Law",
    "Family Law",
    "Property Law",
    "Corporate Law",
    "Tax Law",
    "Labour Law",
    "Consumer Protection",
    "Intellectual Property",
    "Constitutional Law",
    "Arbitration",
    "RERA",
    "NCLT / Insolvency",
    "Other",
];
const COURTS = [
    "Bombay High Court",
    "City Civil Court, Mumbai",
    "NCLT Mumbai",
    "NCLAT",
    "District Court, Thane",
    "District Court, Pune",
    "Family Court, Mumbai",
    "Consumer Forum",
    "RERA Tribunal",
    "Supreme Court",
    "Other",
];
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function AddCaseDialog({ open, onClose }) {
    const [form, setForm] = useState(EMPTY_FORM);
    const [parties, setParties] = useState([]);
    const [tagInput, setTagInput] = useState("");
    const createCase = useCreateCase();
    const isPending = createCase.isPending;
    const isError = createCase.isError;
    if (!open)
        return null;
    const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
    const addParty = () => {
        setParties((prev) => [
            ...prev,
            { name: "", role: "", type: "client" },
        ]);
    };
    const updateParty = (idx, key, value) => {
        setParties((prev) => prev.map((p, i) => (i === idx ? { ...p, [key]: value } : p)));
    };
    const removeParty = (idx) => {
        setParties((prev) => prev.filter((_, i) => i !== idx));
    };
    const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
    const addTag = () => {
        const val = tagInput.trim();
        if (!val)
            return;
        const current = tags;
        if (!current.includes(val)) {
            setForm((prev) => ({ ...prev, tags: [...current, val].join(", ") }));
        }
        setTagInput("");
    };
    const removeTag = (tag) => {
        const current = tags.filter((t) => t !== tag);
        setForm((prev) => ({ ...prev, tags: current.join(", ") }));
    };
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.title.trim())
            return;
        const payload = {
            title: form.title,
            status: form.status,
            priority: form.priority,
            ...(form.description && { description: form.description }),
            ...(form.practice && { practice: form.practice }),
            ...(form.court && { court: form.court }),
            ...(form.judge && { judge: form.judge }),
            ...(form.nextHearing && { nextHearing: form.nextHearing }),
            ...(tags.length > 0 && { tags }),
            ...(form.nasPath && { nasPath: form.nasPath }),
            ...(parties.length > 0 && { parties }),
        };
        createCase.mutate(payload, {
            onSuccess: () => {
                setForm(EMPTY_FORM);
                setParties([]);
                setTagInput("");
                onClose();
            },
        });
    };
    return (_jsx(Dialog, { open: open, onOpenChange: onClose, children: _jsxs(DialogContent, { className: "max-w-2xl", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Add new case" }), _jsx(DialogDescription, { children: "Create a new matter with parties, court info and metadata." })] }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-6", children: [_jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [_jsxs("div", { className: "space-y-1.5 sm:col-span-2", children: [_jsx(Label, { htmlFor: "case-title", className: "text-helper", children: "Case title *" }), _jsx(Input, { id: "case-title", required: true, value: form.title, onChange: (e) => update("title", e.target.value), placeholder: "e.g. Mehra vs. Kapoor Estates", className: "h-11 rounded-md" })] }), _jsxs("div", { className: "space-y-1.5 sm:col-span-2", children: [_jsx(Label, { htmlFor: "case-desc", className: "text-helper", children: "Description" }), _jsx(Input, { id: "case-desc", value: form.description, onChange: (e) => update("description", e.target.value), placeholder: "Brief description of the matter", className: "h-11 rounded-md" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "case-practice", className: "text-helper", children: "Practice area" }), _jsxs("select", { id: "case-practice", value: form.practice, onChange: (e) => update("practice", e.target.value), className: "h-11 w-full rounded-md border border-border bg-card px-3 text-helper outline-none transition-colors focus:border-primary", children: [_jsx("option", { value: "", children: "Select practice area" }), PRACTICE_AREAS.map((a) => (_jsx("option", { value: a, children: a }, a)))] })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "case-court", className: "text-helper", children: "Court" }), _jsxs("select", { id: "case-court", value: form.court, onChange: (e) => update("court", e.target.value), className: "h-11 w-full rounded-md border border-border bg-card px-3 text-helper outline-none transition-colors focus:border-primary", children: [_jsx("option", { value: "", children: "Select court" }), COURTS.map((c) => (_jsx("option", { value: c, children: c }, c)))] })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "case-judge", className: "text-helper", children: "Judge / Presiding Officer" }), _jsx(Input, { id: "case-judge", value: form.judge, onChange: (e) => update("judge", e.target.value), placeholder: "e.g. Justice A. M. Khanwilkar", className: "h-11 rounded-md" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "case-hearing", className: "text-helper", children: "Next hearing" }), _jsx(Input, { id: "case-hearing", type: "date", value: form.nextHearing, onChange: (e) => update("nextHearing", e.target.value), className: "h-11 rounded-md" })] })] }), _jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "text-helper", children: "Case status" }), _jsx("div", { className: "flex rounded-md border border-border", children: ["Active", "Urgent", "On Hold", "Closed"].map((s) => (_jsx("button", { type: "button", onClick: () => update("status", s), className: `flex-1 px-2.5 py-2 text-caption font-medium transition-colors first:rounded-l-md last:rounded-r-md border-r border-border last:border-r-0 ${form.status === s
                                                    ? "bg-primary/10 text-primary"
                                                    : "text-muted-foreground hover:text-foreground"}`, children: s }, s))) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "text-helper", children: "Priority" }), _jsx("div", { className: "flex rounded-md border border-border", children: ["High", "Medium", "Low"].map((p) => (_jsx("button", { type: "button", onClick: () => update("priority", p), className: `flex-1 px-2.5 py-2 text-caption font-medium transition-colors ${p === "High" ? "rounded-l-md border-r" : p === "Low" ? "rounded-r-md border-l" : "border-r"} border-border ${form.priority === p
                                                    ? p === "High"
                                                        ? "bg-destructive/10 text-destructive"
                                                        : p === "Medium"
                                                            ? "bg-warning/10 text-warning"
                                                            : "bg-muted text-muted-foreground"
                                                    : "text-muted-foreground hover:text-foreground"}`, children: p }, p))) })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "case-tags", className: "text-helper", children: "Tags" }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Input, { id: "case-tags", value: tagInput, onChange: (e) => setTagInput(e.target.value), onKeyDown: (e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    addTag();
                                                }
                                            }, placeholder: "Type a tag and press Enter", className: "h-11 flex-1 rounded-md" }), _jsx(Button, { type: "button", variant: "outline", className: "rounded-md h-11", onClick: addTag, children: _jsx(Plus, { size: 15 }) })] }), tags.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-1.5", children: tags.map((t) => (_jsxs("span", { className: "flex items-center gap-1 rounded-pill bg-muted px-3 py-1 text-caption font-medium", children: [t, _jsx("button", { type: "button", onClick: () => removeTag(t), className: "ml-0.5 grid size-4 place-items-center rounded-full text-muted-foreground hover:text-destructive", "aria-label": `Remove tag ${t}`, children: _jsx(X, { size: 11, strokeWidth: 2.5 }) })] }, t))) }))] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "case-nas", className: "text-helper", children: "NAS folder path" }), _jsx(Input, { id: "case-nas", value: form.nasPath, onChange: (e) => update("nasPath", e.target.value), placeholder: "e.g. /Cases/SW-2026-0148/", className: "h-11 rounded-md" }), _jsx("p", { className: "text-caption text-muted-foreground", children: "Synology NAS folder where case documents will be stored." })] }), _jsxs("div", { className: "rounded-lg border border-border", children: [_jsxs("div", { className: "flex items-center justify-between px-4 py-3", children: [_jsxs("p", { className: "flex items-center gap-2 text-helper font-medium", children: [_jsx(Users, { size: 16, strokeWidth: 1.75, className: "text-muted-foreground" }), "Parties"] }), _jsxs(Button, { type: "button", variant: "outline", size: "sm", className: "rounded-md", onClick: addParty, children: [_jsx(Plus, { size: 14 }), " Add party"] })] }), parties.length > 0 && (_jsx("div", { className: "border-t border-border p-4 space-y-3", children: parties.map((p, idx) => (_jsxs("div", { className: "rounded-md border border-border bg-muted/30 p-4", children: [_jsxs("div", { className: "mb-3 flex items-center justify-between", children: [_jsxs("p", { className: "text-helper font-medium", children: ["Party #", idx + 1] }), _jsx("button", { type: "button", onClick: () => removeParty(idx), className: "grid size-8 place-items-center rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive", "aria-label": "Remove party", children: _jsx(Trash2, { size: 15 }) })] }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsxs("div", { className: "space-y-1.5 sm:col-span-2", children: [_jsx(Label, { htmlFor: `party-name-${idx}`, className: "text-helper", children: "Name" }), _jsx(Input, { id: `party-name-${idx}`, value: p.name, onChange: (e) => updateParty(idx, "name", e.target.value), placeholder: "Party name", className: "h-10 rounded-md" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: `party-role-${idx}`, className: "text-helper", children: "Role" }), _jsx(Input, { id: `party-role-${idx}`, value: p.role, onChange: (e) => updateParty(idx, "role", e.target.value), placeholder: "Petitioner, Respondent, etc.", className: "h-10 rounded-md" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: `party-type-${idx}`, className: "text-helper", children: "Type" }), _jsxs("select", { id: `party-type-${idx}`, value: p.type, onChange: (e) => updateParty(idx, "type", e.target.value), className: "h-10 w-full rounded-md border border-border bg-card px-3 text-helper outline-none transition-colors focus:border-primary", children: [_jsx("option", { value: "client", children: "Client" }), _jsx("option", { value: "sub_client", children: "Sub-client" }), _jsx("option", { value: "opposing_party", children: "Opposing Party" }), _jsx("option", { value: "counsel", children: "Counsel" }), _jsx("option", { value: "other", children: "Other" })] })] })] })] }, idx))) })), parties.length === 0 && (_jsx("div", { className: "border-t border-border px-4 py-6 text-center text-helper text-muted-foreground", children: "No parties added yet. Click \"Add party\" to link clients, sub-clients, counsel or opposing parties." }))] }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: onClose, children: "Cancel" }), _jsxs(Button, { type: "submit", disabled: isPending || !form.title.trim(), className: "gradient-primary rounded-md text-primary-foreground shadow-soft", children: [isPending ? _jsx(Loader2, { size: 17, className: "animate-spin" }) : _jsx(Briefcase, { size: 17, strokeWidth: 2 }), isPending ? "Saving…" : "Save case"] })] }), isError && (_jsx("p", { className: "text-caption text-destructive", children: "Failed to create case. Please try again." }))] })] }) }));
}
