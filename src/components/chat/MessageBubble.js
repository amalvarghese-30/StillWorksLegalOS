import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { CornerUpLeft } from "lucide-react";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { MessageContextMenuContent } from "./MessageContextMenu";
import { MessageTail, ReadReceipt, highlightMentions, formatTime } from "./helpers";
const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "🙏"];
const SENDER_COLORS = [
    "text-blue-500",
    "text-emerald-500",
    "text-amber-500",
    "text-rose-500",
    "text-violet-500",
    "text-cyan-500",
];
function senderColor(id) {
    let h = 0;
    for (let i = 0; i < id.length; i++)
        h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return SENDER_COLORS[h % SENDER_COLORS.length];
}
function reactionGroups(reactions, currentUserId) {
    const map = new Map();
    for (const r of reactions) {
        const g = map.get(r.emoji) ?? { emoji: r.emoji, count: 0, hasMine: false };
        g.count++;
        if (r.userId === currentUserId)
            g.hasMine = true;
        map.set(r.emoji, g);
    }
    return Array.from(map.values());
}
export function MessageBubble({ message, isMine, isGroup, showSender, currentUserId, readState, canDeleteEveryone, onReply, onCopy, onForward, onDeleteForMe, onDeleteForEveryone, onReport, onToggleReaction, }) {
    const reactions = reactionGroups(message.reactions ?? [], currentUserId);
    const timeClass = isMine ? "text-primary-foreground/70" : "text-muted-foreground";
    return (_jsxs(ContextMenu, { children: [_jsx(ContextMenuTrigger, { asChild: true, children: _jsx("div", { className: `group flex ${isMine ? "justify-end" : "justify-start"}`, children: _jsxs("div", { className: `relative max-w-[78%] ${isMine ? "pl-10" : "pr-10"}`, children: [_jsx("div", { className: `absolute -top-4 z-10 flex items-center gap-0.5 rounded-full border border-border bg-card p-1 shadow-soft opacity-0 transition-opacity duration-150 group-hover:opacity-100 ${isMine ? "right-0" : "left-0"}`, children: QUICK_REACTIONS.map((emoji) => (_jsx("button", { type: "button", onClick: () => onToggleReaction(message, emoji), className: "rounded-full p-1 text-sm transition-transform hover:scale-125", children: emoji }, emoji))) }), _jsxs("div", { className: `relative rounded-2xl px-3.5 py-2 shadow-soft ${isMine
                                    ? "gradient-primary text-primary-foreground rounded-br-md"
                                    : "border border-border bg-muted/60 rounded-bl-md"}`, children: [message.replyTo && (_jsxs("div", { className: `mb-1.5 rounded-md border-l-2 px-2 py-1 text-caption ${isMine
                                            ? "border-primary-foreground/40 bg-primary-foreground/10"
                                            : "border-primary/40 bg-primary/5"}`, children: [_jsxs("p", { className: "flex items-center gap-1 font-medium", children: [_jsx(CornerUpLeft, { size: 11, strokeWidth: 2 }), message.replyTo.senderName] }), _jsx("p", { className: "truncate opacity-80", children: message.replyTo.text })] })), !isMine && isGroup && showSender && (_jsx("p", { className: `mb-0.5 text-caption font-semibold ${senderColor(message.sender._id)}`, children: message.sender.name })), _jsx("p", { className: "whitespace-pre-wrap break-words text-helper", children: highlightMentions(message.text) }), _jsxs("div", { className: "mt-1 flex items-center justify-end gap-1", children: [_jsx("div", { className: "mr-auto flex flex-wrap gap-1", children: reactions.map((r) => (_jsxs("button", { type: "button", onClick: () => onToggleReaction(message, r.emoji), className: `flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs transition-colors ${r.hasMine
                                                        ? "border border-primary/30 bg-primary/20 text-primary"
                                                        : "border border-border/60 bg-card/60 text-muted-foreground hover:bg-card"}`, title: `${r.count} ${r.count > 1 ? "people" : "person"}`, children: [_jsx("span", { style: { fontSize: "12px" }, children: r.emoji }), r.count > 1 && _jsx("span", { className: "text-[10px]", children: r.count })] }, r.emoji))) }), _jsxs("span", { className: `flex items-center gap-1 text-[10px] tabular-nums ${timeClass}`, children: [formatTime(message.createdAt), isMine && _jsx(ReadReceipt, { state: readState })] })] })] }), _jsx(MessageTail, { own: isMine })] }) }) }), _jsx(MessageContextMenuContent, { message: message, isMine: isMine, canDeleteEveryone: canDeleteEveryone, onReply: onReply, onCopy: onCopy, onForward: onForward, onDeleteForMe: onDeleteForMe, onDeleteForEveryone: onDeleteForEveryone, onReport: onReport })] }));
}
