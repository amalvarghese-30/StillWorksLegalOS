import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Search, ArrowLeft, ArrowRight, Users as UsersIcon, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { computeInitials } from "./helpers";
export function CreateGroupDialog({ open, onClose, users, currentUserId, isCreating, onCreate, }) {
    const [step, setStep] = useState(1);
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState(new Set());
    const [name, setName] = useState("");
    useEffect(() => {
        if (open) {
            setStep(1);
            setSearch("");
            setSelected(new Set());
            setName("");
        }
    }, [open]);
    const contacts = users.filter((u) => u._id !== currentUserId);
    const query = search.trim().toLowerCase();
    const filtered = query
        ? contacts.filter((u) => u.name.toLowerCase().includes(query) ||
            u.email.toLowerCase().includes(query))
        : contacts;
    const toggle = (id) => setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id))
            next.delete(id);
        else
            next.add(id);
        return next;
    });
    const handleCreate = () => {
        if (!name.trim() || selected.size === 0)
            return;
        onCreate(name.trim(), Array.from(selected));
    };
    return (_jsx(Dialog, { open: open, onOpenChange: (o) => !o && onClose(), children: _jsx(DialogContent, { className: "max-w-md", children: step === 1 ? (_jsxs(_Fragment, { children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "New group" }), _jsxs(DialogDescription, { children: ["Select participants (", selected.size, " selected)"] })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("label", { className: "flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2", children: [_jsx(Search, { size: 15, strokeWidth: 1.75, className: "shrink-0 text-muted-foreground" }), _jsx("input", { type: "search", placeholder: "Search people\u2026", value: search, onChange: (e) => setSearch(e.target.value), className: "min-w-0 flex-1 bg-transparent text-helper outline-none", autoFocus: true })] }), _jsx("div", { className: "max-h-72 space-y-1 overflow-y-auto", children: filtered.length === 0 ? (_jsx("p", { className: "py-8 text-center text-helper text-muted-foreground", children: "No people found" })) : (filtered.map((u) => (_jsxs("div", { role: "button", tabIndex: 0, "aria-pressed": selected.has(u._id), onClick: () => toggle(u._id), onKeyDown: (e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            toggle(u._id);
                                        }
                                    }, className: "flex w-full cursor-pointer items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-accent", children: [_jsx(Avatar, { className: "size-9 shrink-0", children: _jsx(AvatarFallback, { className: "bg-primary/15 text-sm font-medium text-primary", children: computeInitials(u.name) }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "truncate font-medium", children: u.name }), _jsx("p", { className: "truncate text-caption text-muted-foreground", children: u.email })] }), _jsx(Checkbox, { checked: selected.has(u._id), className: "pointer-events-none" })] }, u._id)))) })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: onClose, children: "Cancel" }), _jsxs(Button, { className: "gradient-primary text-primary-foreground", onClick: () => setStep(2), disabled: selected.size === 0, children: ["Next", _jsx(ArrowRight, { size: 15, strokeWidth: 1.75, className: "ml-1" })] })] })] })) : (_jsxs(_Fragment, { children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Group name" }), _jsxs(DialogDescription, { children: [selected.size, " participant", selected.size === 1 ? "" : "s", " selected"] })] }), _jsxs("div", { className: "space-y-3 py-2", children: [_jsx(Input, { placeholder: "Group name", value: name, onChange: (e) => setName(e.target.value), className: "h-10 rounded-lg", autoFocus: true }), _jsxs("div", { className: "flex items-center gap-1.5 text-caption text-muted-foreground", children: [_jsx(UsersIcon, { size: 13, strokeWidth: 1.75 }), "Group chats are end-to-end encrypted"] })] }), _jsxs(DialogFooter, { children: [_jsxs(Button, { variant: "outline", onClick: () => setStep(1), children: [_jsx(ArrowLeft, { size: 15, strokeWidth: 1.75, className: "mr-1" }), "Back"] }), _jsx(Button, { className: "gradient-primary text-primary-foreground", onClick: handleCreate, disabled: isCreating || !name.trim(), children: isCreating ? _jsx(Loader2, { size: 15, className: "animate-spin" }) : "Create group" })] })] })) }) }));
}
