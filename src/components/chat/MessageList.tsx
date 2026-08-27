import { useEffect, useRef } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { formatDate, type ReadState, computeReadState } from "./helpers";
import type { ChatMessage, ChatMember } from "@/services/chat";

interface MessageListProps {
  messages: ChatMessage[];
  currentUserId: string;
  groupMembers: ChatMember[];
  isAdmin: boolean;
  isLoading: boolean;
  hasOlder?: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
  emptyText: string;
  onReply: (msg: ChatMessage) => void;
  onCopy: (msg: ChatMessage) => void;
  onForward: (msg: ChatMessage) => void;
  onDeleteForMe: (msg: ChatMessage) => void;
  onDeleteForEveryone: (msg: ChatMessage) => void;
  onReport: (msg: ChatMessage) => void;
  onToggleReaction: (msg: ChatMessage, emoji: string) => void;
}

export function MessageList({
  messages,
  currentUserId,
  groupMembers,
  isAdmin,
  isLoading,
  hasOlder,
  loadingOlder,
  onLoadOlder,
  emptyText,
  onReply,
  onCopy,
  onForward,
  onDeleteForMe,
  onDeleteForEveryone,
  onReport,
  onToggleReaction,
}: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const isGroup = groupMembers.length > 2;
  const otherIds = groupMembers.filter((m) => m._id !== currentUserId).map((m) => m._id);
  const isGroupAdmin =
    isAdmin || groupMembers.find((m) => m._id === currentUserId)?.role === "admin";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages[messages.length - 1]?._id]);

// ...

const readStateFor = (msg: ChatMessage): ReadState => {
    return computeReadState(msg, currentUserId, otherIds);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="text-center">
          <MessageSquare size={32} strokeWidth={1.5} className="mx-auto text-muted-foreground/40" />
          <p className="mt-2 text-helper text-muted-foreground">{emptyText}</p>
        </div>
      </div>
    );
  }

  let lastDate = "";

  return (
    <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 py-4">
      {hasOlder && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onLoadOlder}
            disabled={loadingOlder}
            className="rounded-full bg-muted/60 px-3 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {loadingOlder ? "Loading…" : "Load older messages"}
          </button>
        </div>
      )}
      {messages.map((msg, i) => {
        const date = formatDate(msg.createdAt);
        const showDate = date !== lastDate;
        lastDate = date;

        const isMine = msg.sender._id === currentUserId;
        const prev = i > 0 ? messages[i - 1] : undefined;
        const showSender =
          isGroup &&
          !isMine &&
          (!prev || prev.sender._id !== msg.sender._id || prev.sender._id === currentUserId);

        const canDeleteEveryone = isMine || isGroupAdmin;

        return (
          <div key={msg._id}>
            {showDate && (
              <div className="my-3 flex items-center justify-center">
                <span className="rounded-full bg-muted/60 px-3 py-1 text-[11px] text-muted-foreground">
                  {date}
                </span>
              </div>
            )}
            <MessageBubble
              message={msg}
              isMine={isMine}
              isGroup={isGroup}
              showSender={showSender}
              currentUserId={currentUserId}
              readState={readStateFor(msg)}
              canDeleteEveryone={canDeleteEveryone}
              onReply={onReply}
              onCopy={onCopy}
              onForward={onForward}
              onDeleteForMe={onDeleteForMe}
              onDeleteForEveryone={onDeleteForEveryone}
              onReport={onReport}
              onToggleReaction={onToggleReaction}
            />
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
