import type { RefObject } from "react";
import { Send, Paperclip, Smile, X, Reply, Loader2 } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { EMOJI_PICKER_EMOJIS } from "./helpers";
import type { ChatMessage } from "@/services/chat";

interface MessageComposerProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  isSending: boolean;
  replyTo: ChatMessage | null;
  onCancelReply: () => void;
  typingNames: string[];
  onTyping: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
}

export function MessageComposer({
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
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSend();
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

        {/* Typing indicator */}
        {typingNames.length > 0 && (
          <div className="mb-1.5 px-1 text-caption italic text-muted-foreground">
            {typingNames.join(", ")} {typingNames.length === 1 ? "is" : "are"} typing…
          </div>
        )}

        <form className="flex items-center gap-1.5" onSubmit={handleSubmit}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <button
                  type="button"
                  disabled
                  aria-label="Attach file"
                  className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground/50"
                >
                  <Paperclip size={19} strokeWidth={1.75} />
                </button>
              </span>
            </TooltipTrigger>
            <TooltipContent>File sharing arrives with NAS integration</TooltipContent>
          </Tooltip>

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
            placeholder="Write a message…"
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              onTyping();
            }}
            className="min-w-0 flex-1 rounded-full border border-border bg-muted/50 px-4 py-3 text-helper outline-none transition-shadow focus:ring-2 focus:ring-ring/40"
          />
          <button
            type="submit"
            aria-label="Send message"
            disabled={!value.trim() || isSending}
            className="gradient-primary grid size-11 shrink-0 place-items-center rounded-full text-primary-foreground shadow-soft transition-transform duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} strokeWidth={1.75} />}
          </button>
        </form>
      </div>
    </TooltipProvider>
  );
}
