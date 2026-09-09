import { Check, CheckCheck, Briefcase } from "lucide-react";
import type { ChatMessage } from "@/services/chat";

const CASE_REGEX =
  /\b(?:W\.?P\.?(?:\([A-Za-z]+\))?|O\.?S\.?|Crl\.?A\.?|S\.?L\.?P\.?(?:\([A-Za-z]+\))?|C\.?P\.?|Arb\.?P\.?|C\.?S\.?|M\.?C\.?|Mat\.?App\.?|L\.?P\.?A\.?|Review Pet\.?|RFA|RSA|Bail Appl\.?)\s*(?:No\.?)?\s*\d+\s*[\/-]\s*\d{2,4}\b/i;

export function highlightMentions(
  text: string,
  searchQuery?: string,
  onCaseClick?: (caseNum: string) => void,
): React.ReactNode {
  if (!text) return null;

  const combinedRegex =
    /(@\w+|\b(?:W\.?P\.?(?:\([A-Za-z]+\))?|O\.?S\.?|Crl\.?A\.?|S\.?L\.?P\.?(?:\([A-Za-z]+\))?|C\.?P\.?|Arb\.?P\.?|C\.?S\.?|M\.?C\.?|Mat\.?App\.?|L\.?P\.?A\.?|Review Pet\.?|RFA|RSA|Bail Appl\.?)\s*(?:No\.?)?\s*\d+\s*[\/-]\s*\d{2,4}\b)/gi;

  const parts = text.split(combinedRegex);

  const renderTextSegment = (seg: string, keyPrefix: string | number) => {
    if (!searchQuery || !searchQuery.trim()) return seg;
    const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const searchRegex = new RegExp(`(${escaped})`, "gi");
    const subParts = seg.split(searchRegex);
    return subParts.map((sub, j) =>
      sub.toLowerCase() === searchQuery.toLowerCase() ? (
        <mark
          key={`${keyPrefix}-search-${j}`}
          className="rounded bg-amber-300/70 px-0.5 font-semibold text-foreground dark:bg-amber-500/50"
        >
          {sub}
        </mark>
      ) : (
        sub
      ),
    );
  };

  return parts.map((part, i) => {
    if (!part) return null;

    if (part.startsWith("@")) {
      return (
        <span
          key={i}
          className="rounded bg-primary/15 px-1 font-medium text-primary hover:bg-primary/25 transition-colors"
        >
          {part}
        </span>
      );
    }

    if (CASE_REGEX.test(part)) {
      return (
        <button
          key={i}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onCaseClick) {
              onCaseClick(part);
            } else {
              window.location.href = `/cases?search=${encodeURIComponent(part)}`;
            }
          }}
          className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[11.5px] font-semibold text-primary transition-all hover:bg-primary/20 hover:shadow-xs active:scale-95 mx-0.5"
          title={`Click to open Case Workspace for ${part}`}
        >
          <Briefcase size={11} strokeWidth={2} className="shrink-0" />
          <span>{part}</span>
        </button>
      );
    }

    return <span key={i}>{renderTextSegment(part, i)}</span>;
  });
}

// ---------------------------------------------------------------------------
// Shared chat utilities + small presentational pieces
// ---------------------------------------------------------------------------

const HONORIFICS = ["Adv.", "Mr.", "Mrs.", "Ms.", "Dr.", "Shri", "Smt."];

export function computeInitials(name: string): string {
  if (!name) return "??";
  const initials = name
    .split(/\s+/)
    .filter((p) => p && !HONORIFICS.includes(p))
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();
  return initials || "??";
}

export function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/** "last seen today at 14:30" style helper for presence. */
export function formatLastSeen(iso: string | null | undefined): string {
  if (!iso) return "recently";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "recently";
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

  if (date.toDateString() === today.toDateString()) return `today at ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `yesterday at ${time}`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}


// WhatsApp message bubble tail
export function MessageTail({ own }: { own: boolean }) {
  return (
    <svg
      className={`absolute bottom-0 ${own ? "-right-2" : "-left-2"}`}
      width={16}
      height={16}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d={
          own
            ? "M16 0 L8 0 C8 0 16 0 16 8 C16 8 8 8 8 16 L0 16 L0 0 Z"
            : "M0 0 L8 0 C8 0 0 0 0 8 C0 8 8 8 8 16 L16 16 L16 0 Z"
        }
        fill={own ? "var(--primary)" : "var(--muted)"}
        opacity={own ? 0.95 : 0.6}
      />
    </svg>
  );
}

export type ReadState = "sent" | "delivered" | "read";

export function computeReadState(message: ChatMessage, currentUserId: string, otherUserIds: string[]): ReadState {
  // If no other users in group, it's always sent (we're the only one)
  if (otherUserIds.length === 0) return "sent";

  // If message has been read by ALL other users
  const allRead = otherUserIds.every((id) => message.readBy?.includes(id));
  if (allRead) return "read";

  // If message has been delivered to (read by) AT LEAST ONE other user
  const anyDelivered = otherUserIds.some((id) => message.readBy?.includes(id));
  if (anyDelivered) return "delivered";

  // Otherwise just sent
  return "sent";
}

export function ReadReceipt({ state }: { state: ReadState }) {
  return (
    <span
      className="flex items-center gap-0.5"
      aria-label={state === "read" ? "Read" : state === "delivered" ? "Delivered" : "Sent"}
    >
      {state === "read" ? (
        <CheckCheck size={14} strokeWidth={2} className="text-blue-400" />
      ) : state === "delivered" ? (
        <CheckCheck size={14} strokeWidth={1.75} className="text-muted-foreground/60" />
      ) : (
        <Check size={14} strokeWidth={1.75} className="text-muted-foreground/60" />
      )}
    </span>
  );
}

export const EMOJI_PICKER_EMOJIS = [
  "👍", "👎", "❤️", "🔥", "😂", "😮", "😢", "🙏",
  "🎉", "✨", "💯", "👏", "🤔", "😎", "😭", "😴",
  "🤝", "💪", "🧠", "👀", "📝", "⚖️", "📅", "☕",
];
