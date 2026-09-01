import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Search, UserPlus, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { computeInitials } from "./helpers";
export function AddMembersDialog({ open, onClose, users, existingMemberIds, isAdding, onAdd, }) {
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState(new Set());
    useEffect(() => {
        if (open) {
            setSearch("");
            setSelected(new Set());
        }
    }, [open]);
    const existing = new Set(existingMemberIds);
    const contacts = users.filter((u) => !existing.has(u._id));
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
    return (_jsx(Dialog, { open: open, onOpenChange: (o) => !o && onClose(), children: _jsxs(DialogContent, { className: "max-w-md", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Add members" }), _jsxs(DialogDescription, { children: ["Select people to add (", selected.size, " selected)"] })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("label", { className: "flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2", children: [_jsx(Search, { size: 15, strokeWidth: 1.75, className: "shrink-0 text-muted-foreground" }), _jsx("input", { type: "search", placeholder: "Search people\u2026", value: search, onChange: (e) => setSearch(e.target.value), className: "min-w-0 flex-1 bg-transparent text-helper outline-none", autoFocus: true })] }), _jsx("div", { className: "max-h-72 space-y-1 overflow-y-auto", children: filtered.length === 0 ? (_jsx("p", { className: "py-8 text-center text-helper text-muted-foreground", children: "No one left to add" })) : (filtered.map((u) => (_jsxs("button", { type: "button", onClick: () => toggle(u._id), className: "flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-accent", children: [_jsx(Avatar, { className: "size-9 shrink-0", children: _jsx(AvatarFallback, { className: "bg-primary/15 text-sm font-medium text-primary", children: computeInitials(u.name) }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "truncate font-medium", children: u.name }), _jsx("p", { className: "truncate text-caption text-muted-foreground", children: u.email })] }), _jsx(Checkbox, { checked: selected.has(u._id), onCheckedChange: () => toggle(u._id) })] }, u._id)))) })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: onClose, children: "Cancel" }), _jsxs(Button, { className: "gradient-primary text-primary-foreground", onClick: () => onAdd(Array.from(selected)), disabled: isAdding || selected.size === 0, children: [isAdding ? _jsx(Loader2, { size: 15, className: "animate-spin" }) : _jsx(UserPlus, { size: 15, strokeWidth: 1.75, className: "mr-1" }), isAdding ? "Adding…" : "Add"] })] })] }) }));
}
