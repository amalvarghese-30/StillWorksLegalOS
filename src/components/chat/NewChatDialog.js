import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { computeInitials } from "./helpers";
export function NewChatDialog({ open, onClose, users, currentUserId, isCreating, onStartChat, }) {
    const [search, setSearch] = useState("");
    const contacts = users.filter((u) => u._id !== currentUserId);
    const query = search.trim().toLowerCase();
    const filtered = query
        ? contacts.filter((u) => u.name.toLowerCase().includes(query) ||
            u.email.toLowerCase().includes(query))
        : contacts;
    return (_jsx(Dialog, { open: open, onOpenChange: (o) => !o && onClose(), children: _jsxs(DialogContent, { className: "max-w-md", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "New chat" }), _jsx(DialogDescription, { children: "Start a private conversation with a teammate." })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("label", { className: "flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2", children: [_jsx(Search, { size: 15, strokeWidth: 1.75, className: "shrink-0 text-muted-foreground" }), _jsx("input", { type: "search", placeholder: "Search people\u2026", value: search, onChange: (e) => setSearch(e.target.value), className: "min-w-0 flex-1 bg-transparent text-helper outline-none", autoFocus: true })] }), _jsx("div", { className: "max-h-72 space-y-1 overflow-y-auto", children: filtered.length === 0 ? (_jsx("p", { className: "py-8 text-center text-helper text-muted-foreground", children: "No people found" })) : (filtered.map((u) => (_jsxs("button", { type: "button", onClick: () => onStartChat(u._id), disabled: isCreating, className: "flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-accent disabled:opacity-60", children: [_jsxs("span", { className: "relative shrink-0", children: [_jsx(Avatar, { className: "size-9", children: _jsx(AvatarFallback, { className: "bg-primary/15 text-sm font-medium text-primary", children: computeInitials(u.name) }) }), u.status === "online" && (_jsx("span", { className: "absolute bottom-0 right-0 size-3 rounded-full border-2 border-card bg-success" }))] }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "truncate font-medium", children: u.name }), _jsx("p", { className: "truncate text-caption text-muted-foreground", children: u.email })] }), isCreating && _jsx(Loader2, { size: 16, className: "animate-spin text-muted-foreground" })] }, u._id)))) })] })] }) }));
}
