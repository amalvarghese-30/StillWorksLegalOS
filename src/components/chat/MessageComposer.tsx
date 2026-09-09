import { useState, useRef, type RefObject } from "react";
import { Send, Paperclip, Smile, X, Reply, Loader2, FileText, Mic, Trash2 } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { EMOJI_PICKER_EMOJIS } from "./helpers";
import { uploadChatAttachment, type ChatMessage } from "@/services/chat";
import { toast } from "sonner";

interface MessageComposerProps {
  groupId: string;
  value: string;
  onChange: (v: string) => void;
  onSend: (attachments?: { name: string; nasPath: string; size: string }[]) => void;
  isSending: boolean;
  replyTo: ChatMessage | null;
  onCancelReply: () => void;
  typingNames: string[];
  onTyping: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
}

export function MessageComposer({
  groupId,
  value,
  onChange,
  onSend,
  isSending,
  replyTo,
  onCancelReply,
  typingNames,
  onTyping,
  inputRef,
}: MessageComposerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [attachment, setAttachment] = useState<{ name: string; nasPath: string; size: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState<number>(0);

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Voice recording is not supported in this browser");
      return;
    }
    if (!groupId) {
      toast.error("Please select a conversation first");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone access denied or error:", err);
      toast.error("Microphone access was denied or is unavailable");
    }
  };

  const cancelRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
      mediaRecorderRef.current = null;
    }
    setIsRecording(false);
    setRecordSeconds(0);
    audioChunksRef.current = [];
  };

  const stopAndSendRecording = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const mediaRecorder = mediaRecorderRef.current;
    if (!mediaRecorder) return;

    setIsRecording(false);
    setIsUploading(true);

    mediaRecorder.onstop = async () => {
      try {
        mediaRecorder.stream.getTracks().forEach((t) => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const audioFile = new File([audioBlob], `Voice_Note_${Date.now()}.webm`, {
          type: "audio/webm",
        });

        const res = await uploadChatAttachment(groupId, audioFile);
        onSend([res.attachment]);
        toast.success("Voice note sent");
      } catch (err) {
        console.error("Failed to send voice note:", err);
        toast.error("Failed to send voice note");
      } finally {
        setIsUploading(false);
        setRecordSeconds(0);
        mediaRecorderRef.current = null;
        audioChunksRef.current = [];
      }
    };

    try {
      mediaRecorder.stop();
    } catch {
      setIsUploading(false);
    }
  };

  const formatRecordTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // reset so the same file can be reselected

    if (!groupId) {
      toast.error("No active conversation selected");
      return;
    }

    setIsUploading(true);
    setUploadPercent(0);
    try {
      const res = await uploadChatAttachment(groupId, file, (percent) => setUploadPercent(percent));
      setAttachment(res.attachment);
      toast.success(`Attached ${file.name}`);
    } catch (err) {
      console.error("Chat attachment upload failed:", err);
      toast.error("Failed to upload attachment. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!value.trim() && !attachment) || isSending || isUploading) return;
    onSend(attachment ? [attachment] : undefined);
    setAttachment(null);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="border-t border-border bg-card/70 px-3 py-2">
        {/* Replying-to bar */}
        {replyTo && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border-l-2 border-primary bg-primary/5 px-3 py-2">
            <Reply size={14} strokeWidth={1.75} className="shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-caption font-medium text-primary">Replying to {replyTo.sender.name}</p>
              <p className="truncate text-caption text-muted-foreground">{replyTo.text}</p>
            </div>
            <button
              type="button"
              onClick={onCancelReply}
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Cancel reply"
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          </div>
        )}

        {/* Attachment preview */}
        {attachment && (
          <div className="mb-2 flex items-center gap-2.5 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-primary">
            <FileText size={16} strokeWidth={1.75} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-caption font-medium">{attachment.name}</p>
              <p className="text-[11px] text-muted-foreground">{attachment.size}</p>
            </div>
            <button
              type="button"
              onClick={() => setAttachment(null)}
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Remove attachment"
            >
              <X size={15} strokeWidth={1.75} />
            </button>
          </div>
        )}

        {/* Uploading progress indicator */}
        {isUploading && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
            <Loader2 size={13} className="animate-spin" />
            <span>Uploading attachment... {uploadPercent > 0 ? `${uploadPercent}%` : ""}</span>
          </div>
        )}

        {/* Typing indicator */}
        {typingNames.length > 0 && (
          <div className="mb-1.5 px-1 text-caption italic text-muted-foreground">
            {typingNames.join(", ")} {typingNames.length === 1 ? "is" : "are"} typing…
          </div>
        )}

        {isRecording ? (
          <div className="flex items-center gap-3 rounded-full border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-rose-600 dark:text-rose-400 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex size-2.5 rounded-full bg-rose-500" />
              </span>
              <span className="font-mono text-xs font-semibold">
                Recording {formatRecordTime(recordSeconds)}
              </span>
            </div>

            {/* Pulsing Audio Waveform Indicator */}
            <div className="flex flex-1 items-center justify-center gap-1">
              <span className="h-2 w-1 animate-pulse rounded-full bg-rose-500/70" />
              <span className="h-4 w-1 animate-pulse rounded-full bg-rose-500 delay-75" />
              <span className="h-3 w-1 animate-pulse rounded-full bg-rose-500/80 delay-150" />
              <span className="h-5 w-1 animate-pulse rounded-full bg-rose-500 delay-100" />
              <span className="h-3 w-1 animate-pulse rounded-full bg-rose-500/90 delay-200" />
              <span className="h-4 w-1 animate-pulse rounded-full bg-rose-500 delay-75" />
              <span className="h-2 w-1 animate-pulse rounded-full bg-rose-500/70" />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelRecording}
                className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-rose-500/20 hover:text-rose-600 transition-colors"
                title="Discard voice note"
              >
                <Trash2 size={17} />
              </button>
              <button
                type="button"
                onClick={stopAndSendRecording}
                className="grid size-9 place-items-center rounded-full bg-rose-500 text-white hover:bg-rose-600 transition-colors shadow-soft"
                title="Send voice note"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        ) : (
          <form className="flex items-center gap-1.5" onSubmit={handleSubmit}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Attach file"
                  className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground disabled:opacity-50"
                >
                  <Paperclip size={19} strokeWidth={1.75} />
                </button>
              </TooltipTrigger>
              <TooltipContent>Attach file or document (up to 50MB)</TooltipContent>
            </Tooltip>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelect}
            />

            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Emoji"
                  className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
                >
                  <Smile size={19} strokeWidth={1.75} />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" sideOffset={8}>
                <div className="grid grid-cols-8 gap-1">
                  {EMOJI_PICKER_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        onChange(value + emoji);
                        inputRef.current?.focus();
                      }}
                      className="rounded p-1 text-2xl transition-transform hover:scale-125"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <input
              ref={inputRef}
              aria-label="Message"
              placeholder="Write a message or mention @colleague…"
              value={value}
              onChange={(e) => {
                onChange(e.target.value);
                onTyping();
              }}
              className="min-w-0 flex-1 rounded-full border border-border bg-muted/50 px-4 py-3 text-helper outline-none transition-shadow focus:ring-2 focus:ring-ring/40"
            />

            {value.trim() || attachment ? (
              <button
                type="submit"
                aria-label="Send message"
                disabled={isSending || isUploading}
                className="gradient-primary grid size-11 shrink-0 place-items-center rounded-full text-primary-foreground shadow-soft transition-transform duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {isSending || isUploading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Send size={18} strokeWidth={1.75} />
                )}
              </button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={startRecording}
                    aria-label="Record voice note"
                    className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
                  >
                    <Mic size={19} strokeWidth={1.75} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Record voice note</TooltipContent>
              </Tooltip>
            )}
          </form>
        )}
      </div>
    </TooltipProvider>
  );
}
