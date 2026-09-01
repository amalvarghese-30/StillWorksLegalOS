import { jsx as _jsx } from "react/jsx-runtime";
import { Check, CheckCheck } from "lucide-react";
// ---------------------------------------------------------------------------
// Shared chat utilities + small presentational pieces
// ---------------------------------------------------------------------------
const HONORIFICS = ["Adv.", "Mr.", "Mrs.", "Ms.", "Dr.", "Shri", "Smt."];
export function computeInitials(name) {
    if (!name)
        return "??";
    const initials = name
        .split(/\s+/)
        .filter((p) => p && !HONORIFICS.includes(p))
        .slice(0, 2)
        .map((p) => p[0] ?? "")
        .join("")
        .toUpperCase();
    return initials || "??";
}
export function formatTime(dateStr) {
    if (!dateStr)
        return "";
    const date = new Date(dateStr);
    if (isNaN(date.getTime()))
        return "";
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
export function formatDate(dateStr) {
    if (!dateStr)
        return "";
    const date = new Date(dateStr);
    if (isNaN(date.getTime()))
        return "";
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString())
        return "Today";
    if (date.toDateString() === yesterday.toDateString())
        return "Yesterday";
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
/** "last seen today at 14:30" style helper for presence. */
export function formatLastSeen(iso) {
    if (!iso)
        return "recently";
    const date = new Date(iso);
    if (isNaN(date.getTime()))
        return "recently";
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    if (date.toDateString() === today.toDateString())
        return `today at ${time}`;
    if (date.toDateString() === yesterday.toDateString())
        return `yesterday at ${time}`;
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
export function highlightMentions(text) {
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, i) => part.startsWith("@") ? (_jsx("span", { className: "rounded bg-primary/15 px-1 font-medium text-primary", children: part }, i)) : (part));
}
// WhatsApp message bubble tail
export function MessageTail({ own }) {
    return (_jsx("svg", { className: `absolute bottom-0 ${own ? "-right-2" : "-left-2"}`, width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", xmlns: "http://www.w3.org/2000/svg", children: _jsx("path", { d: own
                ? "M16 0 L8 0 C8 0 16 0 16 8 C16 8 8 8 8 16 L0 16 L0 0 Z"
                : "M0 0 L8 0 C8 0 0 0 0 8 C0 8 8 8 8 16 L16 16 L16 0 Z", fill: own ? "var(--primary)" : "var(--muted)", opacity: own ? 0.95 : 0.6 }) }));
}
export function computeReadState(message, currentUserId, otherUserIds) {
    // If no other users in group, it's always sent (we're the only one)
    if (otherUserIds.length === 0)
        return "sent";
    // If message has been read by ALL other users
    const allRead = otherUserIds.every((id) => message.readBy?.includes(id));
    if (allRead)
        return "read";
    // If message has been delivered to (read by) AT LEAST ONE other user
    const anyDelivered = otherUserIds.some((id) => message.readBy?.includes(id));
    if (anyDelivered)
        return "delivered";
    // Otherwise just sent
    return "sent";
}
export function ReadReceipt({ state }) {
    return (_jsx("span", { className: "flex items-center gap-0.5", "aria-label": state === "read" ? "Read" : state === "delivered" ? "Delivered" : "Sent", children: state === "read" ? (_jsx(CheckCheck, { size: 14, strokeWidth: 2, className: "text-blue-400" })) : state === "delivered" ? (_jsx(CheckCheck, { size: 14, strokeWidth: 1.75, className: "text-muted-foreground/60" })) : (_jsx(Check, { size: 14, strokeWidth: 1.75, className: "text-muted-foreground/60" })) }));
}
export const EMOJI_PICKER_EMOJIS = [
    "👍", "👎", "❤️", "🔥", "😂", "😮", "😢", "🙏",
    "🎉", "✨", "💯", "👏", "🤔", "😎", "😭", "😴",
    "🤝", "💪", "🧠", "👀", "📝", "⚖️", "📅", "☕",
];
