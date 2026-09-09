import { useState, useRef } from "react";
import { CornerUpLeft, FileText, Download, Loader2, Play, Pause, Mic } from "lucide-react";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { MessageContextMenuContent } from "./MessageContextMenu";
import { MessageTail, ReadReceipt, highlightMentions, formatTime, type ReadState } from "./helpers";
import { downloadChatAttachment, type ChatMessage } from "@/services/chat";
import { downloadBlob } from "@/services/api";
import { toast } from "sonner";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "🙏"];

const SENDER_COLORS = [
  "text-blue-500",
  "text-emerald-500",
  "text-amber-500",
  "text-rose-500",
  "text-violet-500",
  "text-cyan-500",
];

function senderColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return SENDER_COLORS[h % SENDER_COLORS.length]!;
}

function reactionGroups(reactions: { userId: string; emoji: string }[], currentUserId: string) {
  const map = new Map<string, { emoji: string; count: number; hasMine: boolean }>();
  for (const r of reactions) {
    const g = map.get(r.emoji) ?? { emoji: r.emoji, count: 0, hasMine: false };
    g.count++;
    if (r.userId === currentUserId) g.hasMine = true;
    map.set(r.emoji, g);
  }
  return Array.from(map.values());
}

function AudioAttachmentPlayer({
  attachment,
  groupId,
  isMine,
}: {
  attachment: { name: string; nasPath: string; size: string };
  groupId: string;
  isMine: boolean;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!audioRef.current) {
      setIsLoading(true);
      try {
        const query = new URLSearchParams({ path: attachment.nasPath, name: attachment.name }).toString();
        const { blob } = await downloadBlob(`/chat/groups/${groupId}/attachments/download?${query}`);
        const url = URL.createObjectURL(blob);

        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onloadedmetadata = () => {
          if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
            setDuration(audio.duration);
          }
        };

        audio.ontimeupdate = () => {
          setCurrentTime(audio.currentTime);
        };

        audio.onended = () => {
          setIsPlaying(false);
          setCurrentTime(0);
        };

        audio.onerror = () => {
          setIsPlaying(false);
          setIsLoading(false);
          toast.error("Could not play voice note");
        };

        await audio.play();
        setIsPlaying(true);
      } catch (err) {
        console.error("Failed to play voice note:", err);
        toast.error("Failed to load voice note");
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      await audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const formatSecs = (sec: number) => {
    if (isNaN(sec) || !isFinite(sec)) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`flex items-center gap-3 rounded-2xl p-2.5 min-w-[210px] max-w-xs transition-all ${
        isMine
          ? "bg-primary-foreground/15 border border-primary-foreground/20 text-primary-foreground"
          : "bg-card border border-border/80 text-foreground shadow-xs"
      }`}
    >
      <button
        type="button"
        onClick={togglePlay}
        disabled={isLoading}
        className={`grid size-9 shrink-0 place-items-center rounded-full transition-transform active:scale-95 ${
          isMine
            ? "bg-primary-foreground text-primary hover:opacity-90"
            : "bg-primary text-primary-foreground hover:opacity-90"
        }`}
        aria-label={isPlaying ? "Pause voice note" : "Play voice note"}
      >
        {isLoading ? (
          <Loader2 size={15} className="animate-spin" />
        ) : isPlaying ? (
          <Pause size={15} fill="currentColor" />
        ) : (
          <Play size={15} fill="currentColor" className="ml-0.5" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-[11px] mb-1 opacity-80 font-medium">
          <span className="flex items-center gap-1">
            <Mic size={11} /> Voice Note
          </span>
          <span>{formatSecs(currentTime > 0 ? currentTime : duration)}</span>
        </div>

        <div
          className="relative h-1.5 w-full rounded-full bg-foreground/15 cursor-pointer overflow-hidden"
          onClick={(e) => {
            if (!audioRef.current || !duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            audioRef.current.currentTime = ratio * duration;
          }}
        >
          <div
            className={`h-full transition-all ${isMine ? "bg-primary-foreground" : "bg-primary"}`}
            style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function AttachmentItem({
  attachment,
  groupId,
  isMine,
}: {
  attachment: { name: string; nasPath: string; size: string };
  groupId: string;
  isMine: boolean;
}) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloading(true);
    try {
      await downloadChatAttachment(groupId, attachment.nasPath, attachment.name);
      toast.success(`Downloaded ${attachment.name}`);
    } catch (err) {
      console.error("Chat attachment download error:", err);
      toast.error("Failed to download attachment");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      onClick={handleDownload}
      className={`group/att flex items-center justify-between gap-3 rounded-xl p-2.5 transition-all cursor-pointer ${
        isMine
          ? "bg-primary-foreground/15 hover:bg-primary-foreground/25 border border-primary-foreground/20 text-primary-foreground"
          : "bg-card/90 hover:bg-card border border-border/80 text-foreground shadow-xs"
      }`}
      title="Click to download"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`grid size-9 shrink-0 place-items-center rounded-lg ${
            isMine ? "bg-primary-foreground/20" : "bg-primary/10 text-primary"
          }`}
        >
          <FileText size={18} strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium max-w-[180px] sm:max-w-[220px]">
            {attachment.name}
          </p>
          <p
            className={`text-[10px] ${
              isMine ? "text-primary-foreground/75" : "text-muted-foreground"
            }`}
          >
            {attachment.size}
          </p>
        </div>
      </div>
      <button
        type="button"
        disabled={downloading}
        className={`grid size-8 shrink-0 place-items-center rounded-lg transition-colors ${
          isMine
            ? "hover:bg-primary-foreground/20 text-primary-foreground"
            : "hover:bg-accent text-muted-foreground hover:text-foreground"
        }`}
        aria-label="Download attachment"
      >
        {downloading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Download size={14} strokeWidth={1.75} />
        )}
      </button>
    </div>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
  isMine: boolean;
  isGroup: boolean;
  showSender: boolean;
  currentUserId: string;
  readState: ReadState;
  canDeleteEveryone: boolean;
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

export function MessageBubble({
  message,
  isMine,
  isGroup,
  showSender,
  currentUserId,
  readState,
  canDeleteEveryone,
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
}: MessageBubbleProps) {
  const reactions = reactionGroups(message.reactions ?? [], currentUserId);
  const timeClass = isMine ? "text-primary-foreground/70" : "text-muted-foreground";

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div id={`msg-${message._id}`} className={`group flex ${isMine ? "justify-end" : "justify-start"}`}>
          <div className={`relative max-w-[78%] ${isMine ? "pl-10" : "pr-10"}`}>
            {/* Quick reactions (appear on hover) */}
            <div
              className={`absolute -top-4 z-10 flex items-center gap-0.5 rounded-full border border-border bg-card p-1 shadow-soft opacity-0 transition-opacity duration-150 group-hover:opacity-100 ${
                isMine ? "right-0" : "left-0"
              }`}
            >
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onToggleReaction(message, emoji)}
                  className="rounded-full p-1 text-sm transition-transform hover:scale-125"
                >
                  {emoji}
                </button>
              ))}
            </div>

            <div
              className={`relative rounded-2xl px-3.5 py-2 shadow-soft ${
                isMine
                  ? "gradient-primary text-primary-foreground rounded-br-md"
                  : "border border-border bg-muted/60 rounded-bl-md"
              }`}
            >
              {message.replyTo && (
                <div
                  className={`mb-1.5 rounded-md border-l-2 px-2 py-1 text-caption ${
                    isMine
                      ? "border-primary-foreground/40 bg-primary-foreground/10"
                      : "border-primary/40 bg-primary/5"
                  }`}
                >
                  <p className="flex items-center gap-1 font-medium">
                    <CornerUpLeft size={11} strokeWidth={2} />
                    {message.replyTo.senderName}
                  </p>
                  <p className="truncate opacity-80">{message.replyTo.text}</p>
                </div>
              )}

              {!isMine && isGroup && showSender && (
                <p className={`mb-0.5 text-caption font-semibold ${senderColor(message.sender._id)}`}>
                  {message.sender.name}
                </p>
              )}

              {message.text ? (
                <p className="whitespace-pre-wrap break-words text-helper">
                  {highlightMentions(message.text, searchQuery, onCaseClick)}
                </p>
              ) : null}

              {message.attachments && message.attachments.length > 0 && (
                <div className={`flex flex-col gap-1.5 ${message.text ? "mt-2" : ""}`}>
                  {message.attachments.map((att, idx) => {
                    const isAudio =
                      att.name.match(/\.(webm|mp3|wav|ogg|m4a)$/i) ||
                      att.name.toLowerCase().includes("voice_note");
                    return isAudio ? (
                      <AudioAttachmentPlayer
                        key={idx}
                        attachment={att}
                        groupId={message.groupId}
                        isMine={isMine}
                      />
                    ) : (
                      <AttachmentItem
                        key={idx}
                        attachment={att}
                        groupId={message.groupId}
                        isMine={isMine}
                      />
                    );
                  })}
                </div>
              )}

              <div className="mt-1 flex items-center justify-end gap-1">
                <div className="mr-auto flex flex-wrap gap-1">
                  {reactions.map((r) => (
                    <button
                      key={r.emoji}
                      type="button"
                      onClick={() => onToggleReaction(message, r.emoji)}
                      className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs transition-colors ${
                        r.hasMine
                          ? "border border-primary/30 bg-primary/20 text-primary"
                          : "border border-border/60 bg-card/60 text-muted-foreground hover:bg-card"
                      }`}
                      title={`${r.count} ${r.count > 1 ? "people" : "person"}`}
                    >
                      <span style={{ fontSize: "12px" }}>{r.emoji}</span>
                      {r.count > 1 && <span className="text-[10px]">{r.count}</span>}
                    </button>
                  ))}
                </div>
                <span className={`flex items-center gap-1 text-[10px] tabular-nums ${timeClass}`}>
                  {formatTime(message.createdAt)}
                  {isMine && <ReadReceipt state={readState} />}
                </span>
              </div>
            </div>

            <MessageTail own={isMine} />
          </div>
        </div>
      </ContextMenuTrigger>
      <MessageContextMenuContent
        message={message}
        isMine={isMine}
        canDeleteEveryone={canDeleteEveryone}
        onReply={onReply}
        onCopy={onCopy}
        onForward={onForward}
        onDeleteForMe={onDeleteForMe}
        onDeleteForEveryone={onDeleteForEveryone}
        onReport={onReport}
        onPinNotice={onPinNotice}
      />
    </ContextMenu>
  );
}
