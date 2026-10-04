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
  const ext = (attachment.name.split(".").pop() || "FILE").toUpperCase().slice(0, 4);

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
          ? "bg-black/15 hover:bg-black/25 border border-white/15 text-primary-foreground"
          : "bg-muted/80 hover:bg-muted border border-border/70 text-foreground shadow-xs"
      }`}
      title="Click to download"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`grid size-10 shrink-0 place-items-center rounded-lg font-bold text-[10px] tracking-wide ${
            isMine ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
          }`}
        >
          {ext === "PDF" ? "PDF" : ext === "DOCX" || ext === "DOC" ? "DOC" : <FileText size={18} />}
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold max-w-[180px] sm:max-w-[220px]">
            {attachment.name}
          </p>
          <p
            className={`text-[10.5px] ${
              isMine ? "text-primary-foreground/75" : "text-muted-foreground"
            }`}
          >
            {ext} · {attachment.size}
          </p>
        </div>
      </div>
      <button
        type="button"
        disabled={downloading}
        className={`grid size-8 shrink-0 place-items-center rounded-full transition-colors ${
          isMine
            ? "hover:bg-white/20 text-primary-foreground"
            : "hover:bg-accent text-muted-foreground hover:text-foreground"
        }`}
        aria-label="Download attachment"
      >
        {downloading ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <Download size={15} strokeWidth={2} />
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
  searchQuery?: string | undefined;
  onCaseClick?: ((caseNum: string) => void) | undefined;
  onPinNotice?: ((msg: ChatMessage) => void) | undefined;
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
  const timeClass = isMine ? "text-primary-foreground/75" : "text-muted-foreground";

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          id={`msg-${message._id}`}
          className={`group relative flex ${isMine ? "justify-end" : "justify-start"} ${
            reactions.length > 0 ? "mb-3" : "mb-1"
          }`}
        >
          <div className="relative max-w-[85%] sm:max-w-[75%] md:max-w-[65%]">
            {/* Quick reactions (appear on hover) */}
            <div
              className={`absolute -top-7 z-20 flex items-center gap-0.5 rounded-full border border-border/80 bg-card/95 backdrop-blur-xs px-1.5 py-0.5 shadow-soft opacity-0 transition-opacity duration-150 group-hover:opacity-100 ${
                isMine ? "right-1" : "left-1"
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

            {/* Bubble */}
            <div
              className={`relative rounded-2xl px-3 py-2 shadow-xs transition-shadow ${
                isMine
                  ? "gradient-primary text-primary-foreground rounded-tr-xs"
                  : "border border-border/80 bg-card dark:bg-[#202c33] dark:border-transparent text-foreground rounded-tl-xs"
              }`}
            >
              {/* Replying quote box */}
              {message.replyTo && (
                <div
                  className={`mb-1.5 rounded-lg border-l-[3.5px] px-2.5 py-1 text-caption ${
                    isMine
                      ? "border-white/70 bg-black/15 text-primary-foreground"
                      : "border-primary bg-primary/8 text-foreground"
                  }`}
                >
                  <p className="flex items-center gap-1 font-semibold text-[11px]">
                    <CornerUpLeft size={10} strokeWidth={2.5} />
                    {message.replyTo.senderName}
                  </p>
                  <p className="truncate text-[11.5px] opacity-85 mt-0.5">{message.replyTo.text}</p>
                </div>
              )}

              {/* Sender name for group chats */}
              {!isMine && isGroup && showSender && (
                <p className={`mb-1 text-[11.5px] font-bold ${senderColor(message.sender._id)}`}>
                  {message.sender.name}
                </p>
              )}

              {/* Attachments / Voice notes */}
              {message.attachments && message.attachments.length > 0 && (
                <div className={`flex flex-col gap-1.5 ${message.text ? "mb-1.5" : ""}`}>
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

              {/* Message text with inline timestamp like WhatsApp */}
              {message.text ? (
                <div className="flex flex-wrap items-end justify-between gap-x-2.5 gap-y-0.5">
                  <span className="min-w-0 flex-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[13.5px] sm:text-[14px] leading-relaxed select-text">
                    {highlightMentions(message.text, searchQuery, onCaseClick, isMine)}
                  </span>
                  <span
                    className={`ml-auto inline-flex shrink-0 items-center gap-1 text-[10px] tabular-nums select-none ${timeClass} self-end pb-0.5`}
                  >
                    {formatTime(message.createdAt)}
                    {isMine && <ReadReceipt state={readState} />}
                  </span>
                </div>
              ) : (
                /* Timestamp for attachment-only messages */
                <div className="mt-1 flex items-center justify-end gap-1">
                  <span className={`inline-flex items-center gap-1 text-[10px] tabular-nums select-none ${timeClass}`}>
                    {formatTime(message.createdAt)}
                    {isMine && <ReadReceipt state={readState} />}
                  </span>
                </div>
              )}
            </div>

            {/* Reactions pill attached at bubble corner */}
            {reactions.length > 0 && (
              <div
                className={`absolute -bottom-2.5 z-10 flex items-center gap-0.5 rounded-full border border-border/70 bg-card px-1.5 py-0.5 shadow-xs ${
                  isMine ? "right-2" : "left-2"
                }`}
              >
                {reactions.map((r) => (
                  <button
                    key={r.emoji}
                    type="button"
                    onClick={() => onToggleReaction(message, r.emoji)}
                    className="flex items-center gap-0.5 text-xs hover:scale-110 transition-transform"
                    title={`${r.count} ${r.count > 1 ? "people" : "person"}`}
                  >
                    <span>{r.emoji}</span>
                    {r.count > 1 && (
                      <span className="text-[10px] font-semibold text-muted-foreground">{r.count}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
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
