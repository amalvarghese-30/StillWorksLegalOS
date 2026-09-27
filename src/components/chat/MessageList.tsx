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
  searchQuery?: string;
  onCaseClick?: (caseNum: string) => void;
  onPinNotice?: (msg: ChatMessage) => void;
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
  searchQuery,
  onCaseClick,
  onPinNotice,
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
      <div className="chat-wallpaper flex min-h-0 flex-1 items-center justify-center">
        <div className="rounded-full bg-card/80 backdrop-blur-xs p-3 shadow-xs border border-border/50">
          <Loader2 size={20} className="animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="chat-wallpaper flex min-h-0 flex-1 items-center justify-center p-6">
        <div className="text-center rounded-2xl bg-card/85 dark:bg-[#182229]/85 backdrop-blur-xs p-6 shadow-xs border border-border/50 max-w-xs">
          <div className="size-12 rounded-full bg-primary/10 grid place-items-center mx-auto text-primary mb-3">
            <MessageSquare size={22} strokeWidth={1.75} />
          </div>
          <p className="text-sm font-medium text-foreground">{emptyText}</p>
          <p className="mt-1 text-caption text-muted-foreground">Messages are end-to-end encrypted.</p>
        </div>
      </div>
    );
  }

  let lastDate = "";

  return (
    <div className="chat-wallpaper min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4 sm:px-6">
      {hasOlder && (
        <div className="flex justify-center mb-2">
          <button
            type="button"
            onClick={onLoadOlder}
            disabled={loadingOlder}
            className="rounded-full bg-card/90 dark:bg-card/80 backdrop-blur-xs border border-border/60 px-3.5 py-1 text-[11px] font-medium text-muted-foreground shadow-xs transition-colors hover:bg-card disabled:opacity-50"
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
              <div className="sticky top-2 z-10 my-3 flex items-center justify-center pointer-events-none">
                <span className="pointer-events-auto rounded-lg bg-card/90 dark:bg-[#182229]/90 backdrop-blur-xs px-3 py-1 text-[11px] font-semibold text-muted-foreground shadow-xs border border-border/50">
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
              searchQuery={searchQuery}
              onCaseClick={onCaseClick}
              onPinNotice={onPinNotice}
            />
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
