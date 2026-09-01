import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { formatDate, computeReadState } from "./helpers";
export function MessageList({ messages, currentUserId, groupMembers, isAdmin, isLoading, hasOlder, loadingOlder, onLoadOlder, emptyText, onReply, onCopy, onForward, onDeleteForMe, onDeleteForEveryone, onReport, onToggleReaction, }) {
    const endRef = useRef(null);
    const isGroup = groupMembers.length > 2;
    const otherIds = groupMembers.filter((m) => m._id !== currentUserId).map((m) => m._id);
    const isGroupAdmin = isAdmin || groupMembers.find((m) => m._id === currentUserId)?.role === "admin";
    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages[messages.length - 1]?._id]);
    // ...
    const readStateFor = (msg) => {
        return computeReadState(msg, currentUserId, otherIds);
    };
    if (isLoading) {
        return (_jsx("div", { className: "flex min-h-0 flex-1 items-center justify-center", children: _jsx(Loader2, { size: 20, className: "animate-spin text-muted-foreground" }) }));
    }
    if (messages.length === 0) {
        return (_jsx("div", { className: "flex min-h-0 flex-1 items-center justify-center", children: _jsxs("div", { className: "text-center", children: [_jsx(MessageSquare, { size: 32, strokeWidth: 1.5, className: "mx-auto text-muted-foreground/40" }), _jsx("p", { className: "mt-2 text-helper text-muted-foreground", children: emptyText })] }) }));
    }
    let lastDate = "";
    return (_jsxs("div", { className: "min-h-0 flex-1 space-y-1 overflow-y-auto px-4 py-4", children: [hasOlder && (_jsx("div", { className: "flex justify-center", children: _jsx("button", { type: "button", onClick: onLoadOlder, disabled: loadingOlder, className: "rounded-full bg-muted/60 px-3 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50", children: loadingOlder ? "Loading…" : "Load older messages" }) })), messages.map((msg, i) => {
                const date = formatDate(msg.createdAt);
                const showDate = date !== lastDate;
                lastDate = date;
                const isMine = msg.sender._id === currentUserId;
                const prev = i > 0 ? messages[i - 1] : undefined;
                const showSender = isGroup &&
                    !isMine &&
                    (!prev || prev.sender._id !== msg.sender._id || prev.sender._id === currentUserId);
                const canDeleteEveryone = isMine || isGroupAdmin;
                return (_jsxs("div", { children: [showDate && (_jsx("div", { className: "my-3 flex items-center justify-center", children: _jsx("span", { className: "rounded-full bg-muted/60 px-3 py-1 text-[11px] text-muted-foreground", children: date }) })), _jsx(MessageBubble, { message: msg, isMine: isMine, isGroup: isGroup, showSender: showSender, currentUserId: currentUserId, readState: readStateFor(msg), canDeleteEveryone: canDeleteEveryone, onReply: onReply, onCopy: onCopy, onForward: onForward, onDeleteForMe: onDeleteForMe, onDeleteForEveryone: onDeleteForEveryone, onReport: onReport, onToggleReaction: onToggleReaction })] }, msg._id));
            }), _jsx("div", { ref: endRef })] }));
}
