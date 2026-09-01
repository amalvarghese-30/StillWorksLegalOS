import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { Pencil, UserPlus, LogOut, MoreVertical, Crown, UserMinus, Check, X, } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction, } from "@/components/ui/alert-dialog";
import { computeInitials, formatLastSeen } from "./helpers";
export function GroupInfoSheet({ open, onClose, group, members, currentUserId, canManage, onlineIds, onRename, onAddMembers, onChangeRole, onRemoveMember, onLeave, isLeaving, }) {
    const [editing, setEditing] = useState(false);
    const [nameDraft, setNameDraft] = useState(group?.name ?? "");
    const isOnline = (m) => onlineIds.has(m._id) || m.online;
    const saveRename = () => {
        const trimmed = nameDraft.trim();
        if (trimmed && trimmed !== group?.name)
            onRename(trimmed);
        setEditing(false);
    };
    return (_jsx(Sheet, { open: open, onOpenChange: (o) => !o && onClose(), children: _jsxs(SheetContent, { side: "right", className: "w-80 sm:w-96", children: [_jsxs(SheetHeader, { children: [_jsxs(SheetTitle, { className: "flex items-center gap-2", children: [group?.name, canManage && (_jsx("button", { onClick: () => {
                                        setNameDraft(group?.name ?? "");
                                        setEditing(true);
                                    }, className: "text-muted-foreground transition-colors hover:text-foreground", "aria-label": "Rename group", children: _jsx(Pencil, { size: 14, strokeWidth: 1.75 }) }))] }), _jsx(SheetDescription, { children: group?.type === "group" ? `${members.length} members` : "Direct conversation" })] }), editing && (_jsxs("div", { className: "mt-3 flex items-center gap-2", children: [_jsx(Input, { value: nameDraft, onChange: (e) => setNameDraft(e.target.value), className: "h-9", autoFocus: true, onKeyDown: (e) => {
                                if (e.key === "Enter")
                                    saveRename();
                                if (e.key === "Escape")
                                    setEditing(false);
                            } }), _jsx(Button, { size: "icon", variant: "ghost", className: "size-9 shrink-0", onClick: saveRename, children: _jsx(Check, { size: 16 }) }), _jsx(Button, { size: "icon", variant: "ghost", className: "size-9 shrink-0", onClick: () => setEditing(false), children: _jsx(X, { size: 16 }) })] })), _jsx(Separator, { className: "my-4" }), _jsx(ScrollArea, { className: "h-[calc(100%-140px)]", children: _jsxs("div", { className: "space-y-5 pr-1", children: [_jsxs("div", { children: [_jsx("h3", { className: "mb-2 text-caption font-medium text-muted-foreground", children: "Members" }), _jsx("ul", { className: "space-y-1", children: members.map((m) => {
                                            const online = isOnline(m);
                                            return (_jsxs("li", { className: "flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-accent", children: [_jsxs("div", { className: "relative shrink-0", children: [_jsx(Avatar, { className: "size-9", children: _jsx(AvatarFallback, { className: "bg-primary/15 text-sm font-medium text-primary", children: computeInitials(m.name) }) }), online && (_jsx("span", { className: "absolute bottom-0 right-0 size-3 rounded-full border-2 border-card bg-success" }))] }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("p", { className: "truncate font-medium", children: [m.name, m._id === currentUserId && _jsx("span", { className: "text-muted-foreground", children: " (you)" })] }), _jsx("p", { className: "truncate text-caption text-muted-foreground", children: online ? "online" : `last seen ${formatLastSeen(m.lastActiveAt)}` })] }), m.role === "admin" && (_jsx(Badge, { variant: "secondary", className: "shrink-0 text-[10px]", children: "admin" })), canManage && m._id !== currentUserId && (_jsxs(Popover, { children: [_jsx(PopoverTrigger, { asChild: true, children: _jsx("button", { className: "grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground", "aria-label": "Member options", children: _jsx(MoreVertical, { size: 14, strokeWidth: 1.75 }) }) }), _jsxs(PopoverContent, { align: "end", sideOffset: 4, className: "w-48 p-1", children: [m.role === "member" ? (_jsxs("button", { onClick: () => onChangeRole(m._id, "admin"), className: "flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent", children: [_jsx(Crown, { size: 14, strokeWidth: 1.75 }), "Make admin"] })) : (_jsxs("button", { onClick: () => onChangeRole(m._id, "member"), className: "flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent", children: [_jsx(UserMinus, { size: 14, strokeWidth: 1.75 }), "Remove admin"] })), _jsx(Separator, { className: "my-1" }), _jsxs("button", { onClick: () => onRemoveMember(m._id), className: "flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-destructive hover:bg-destructive/10", children: [_jsx(UserMinus, { size: 14, strokeWidth: 1.75 }), "Remove member"] })] })] }))] }, m._id));
                                        }) })] }), group?.type === "group" && (_jsxs(_Fragment, { children: [_jsx(Separator, {}), canManage && (_jsxs("button", { onClick: onAddMembers, className: "flex w-full items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80", children: [_jsx(UserPlus, { size: 14, strokeWidth: 1.75 }), "Add members"] })), _jsx(Separator, {}), _jsxs(AlertDialog, { children: [_jsx(AlertDialogTrigger, { asChild: true, children: _jsxs("button", { className: "flex w-full items-center gap-2 text-sm font-medium text-destructive transition-colors hover:text-destructive/80", disabled: isLeaving, children: [_jsx(LogOut, { size: 14, strokeWidth: 1.75 }), "Leave group"] }) }), _jsxs(AlertDialogContent, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: "Leave group?" }), _jsxs(AlertDialogDescription, { children: ["You will stop receiving messages from \u201C", group?.name, "\u201D."] })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogCancel, { children: "Cancel" }), _jsx(AlertDialogAction, { className: "bg-destructive text-white hover:bg-destructive/90", onClick: onLeave, children: "Leave" })] })] })] })] }))] }) })] }) }));
}
