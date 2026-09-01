import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Forward, Users as UsersIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, } from "@/components/ui/dialog";
import { computeInitials } from "./helpers";
export function ForwardDialog({ open, onClose, groups, currentUserId, message, onForward, }) {
    const targets = groups.filter((g) => g._id !== message?.groupId);
    return (_jsx(Dialog, { open: open, onOpenChange: (o) => !o && onClose(), children: _jsxs(DialogContent, { className: "max-w-md", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Forward message" }), _jsx(DialogDescription, { children: message ? (_jsxs("span", { className: "line-clamp-2 block text-helper text-muted-foreground", children: ["\u201C", message.text, "\u201D"] })) : ("Choose a chat") })] }), _jsx("div", { className: "max-h-72 space-y-1 overflow-y-auto", children: targets.length === 0 ? (_jsx("p", { className: "py-8 text-center text-helper text-muted-foreground", children: "No other chats" })) : (targets.map((g) => {
                        const isDirect = g.type === "direct";
                        const other = isDirect ? g.members.find((m) => m._id !== currentUserId) : undefined;
                        return (_jsxs("button", { type: "button", onClick: () => onForward(g._id), className: "flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-accent", children: [_jsx("span", { className: "grid size-9 shrink-0 place-items-center rounded-full bg-primary/12 text-sm font-semibold text-primary", children: isDirect ? computeInitials(g.name) : _jsx(UsersIcon, { size: 15, strokeWidth: 1.75 }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "truncate font-medium", children: isDirect && other ? other.name : g.name }), _jsx("p", { className: "truncate text-caption text-muted-foreground", children: isDirect ? "Direct" : `${g.members.length} members` })] }), _jsx(Forward, { size: 15, strokeWidth: 1.75, className: "text-muted-foreground" })] }, g._id));
                    })) })] }) }));
}
