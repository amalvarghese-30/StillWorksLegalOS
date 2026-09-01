import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Info, MoreVertical, Pin, PinOff, Bell, BellOff, Archive, ArchiveRestore, Trash2, Users as UsersIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from "@/components/ui/dropdown-menu";
import { formatLastSeen, computeInitials } from "./helpers";
export function ChatHeader({ group, currentUserId, onlineIds, lastSeen, onOpenInfo, onTogglePin, onToggleMute, onToggleArchive, isAdmin, onDeleteGroup, }) {
    const isDirect = group.type === "direct";
    const other = isDirect ? group.members.find((m) => m._id !== currentUserId) : undefined;
    const otherOnline = other ? onlineIds.has(other._id) || other.online : false;
    const onlineCount = group.members.filter((m) => m._id !== currentUserId && (onlineIds.has(m._id) || m.online)).length;
    let subtitle;
    if (isDirect) {
        subtitle = otherOnline
            ? "online"
            : `last seen ${formatLastSeen(other?.lastActiveAt ?? lastSeen.get(other?._id ?? ""))}`;
    }
    else if (onlineCount > 0) {
        subtitle = `${group.members.length} members · ${onlineCount} online`;
    }
    else {
        subtitle = `${group.members.length} members`;
    }
    return (_jsxs("header", { className: "flex items-center gap-3 border-b border-border bg-card/70 px-4 py-3", children: [_jsxs("span", { className: "relative grid size-10 shrink-0 place-items-center rounded-full bg-primary/12 text-helper font-semibold text-primary", children: [isDirect ? (computeInitials(group.name)) : (_jsx(UsersIcon, { size: 17, strokeWidth: 1.75 })), isDirect && otherOnline && (_jsx("span", { className: "absolute bottom-0 right-0 size-3 rounded-full border-2 border-card bg-success" }))] }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "truncate font-medium", children: group.name }), _jsx("p", { className: "truncate text-caption text-muted-foreground", children: subtitle })] }), _jsxs("div", { className: "flex items-center gap-0.5", children: [!isDirect && (_jsx(Button, { variant: "ghost", size: "icon", className: "size-9 rounded-full", onClick: onOpenInfo, title: "Group info", children: _jsx(Info, { size: 17, strokeWidth: 1.75 }) })), _jsx(Button, { variant: "ghost", size: "icon", className: "size-9 rounded-full", onClick: onTogglePin, title: group.isPinned ? "Unpin" : "Pin", children: group.isPinned ? _jsx(PinOff, { size: 17, strokeWidth: 1.75 }) : _jsx(Pin, { size: 17, strokeWidth: 1.75 }) }), _jsx(Button, { variant: "ghost", size: "icon", className: "size-9 rounded-full", onClick: onToggleMute, title: group.isMuted ? "Unmute" : "Mute", children: group.isMuted ? _jsx(BellOff, { size: 17, strokeWidth: 1.75 }) : _jsx(Bell, { size: 17, strokeWidth: 1.75 }) }), _jsx(Button, { variant: "ghost", size: "icon", className: "size-9 rounded-full", onClick: onToggleArchive, title: group.isArchived ? "Unarchive" : "Archive", children: group.isArchived ? _jsx(ArchiveRestore, { size: 17, strokeWidth: 1.75 }) : _jsx(Archive, { size: 17, strokeWidth: 1.75 }) }), isAdmin && !isDirect && (_jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsx(Button, { variant: "ghost", size: "icon", className: "size-9 rounded-full", title: "More", children: _jsx(MoreVertical, { size: 17, strokeWidth: 1.75 }) }) }), _jsx(DropdownMenuContent, { align: "end", className: "w-48", children: _jsxs(DropdownMenuItem, { className: "text-destructive focus:text-destructive", onClick: onDeleteGroup, children: [_jsx(Trash2, { size: 15, strokeWidth: 1.75, className: "mr-2" }), "Delete group"] }) })] }))] })] }));
}
