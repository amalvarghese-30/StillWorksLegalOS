import { Reply, Copy, Forward, Trash2, Flag } from "lucide-react";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import type { ChatMessage } from "@/services/chat";

interface MessageContextMenuContentProps {
  message: ChatMessage;
  isMine: boolean;
  canDeleteEveryone: boolean;
  onReply: (msg: ChatMessage) => void;
  onCopy: (msg: ChatMessage) => void;
  onForward: (msg: ChatMessage) => void;
  onDeleteForMe: (msg: ChatMessage) => void;
  onDeleteForEveryone: (msg: ChatMessage) => void;
  onReport: (msg: ChatMessage) => void;
}

export function MessageContextMenuContent({
  message,
  isMine,
  canDeleteEveryone,
  onReply,
  onCopy,
  onForward,
  onDeleteForMe,
  onDeleteForEveryone,
  onReport,
}: MessageContextMenuContentProps) {
  return (
    <ContextMenuContent className="w-56">
      <ContextMenuItem onSelect={() => onReply(message)}>
        <Reply size={15} strokeWidth={1.75} className="mr-2" />
        Reply
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => onCopy(message)}>
        <Copy size={15} strokeWidth={1.75} className="mr-2" />
        Copy
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => onForward(message)}>
        <Forward size={15} strokeWidth={1.75} className="mr-2" />
        Forward
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onSelect={() => onDeleteForMe(message)}>
        <Trash2 size={15} strokeWidth={1.75} className="mr-2" />
        Delete for me
      </ContextMenuItem>
      {canDeleteEveryone && (
        <ContextMenuItem className="text-destructive focus:text-destructive" onSelect={() => onDeleteForEveryone(message)}>
          <Trash2 size={15} strokeWidth={1.75} className="mr-2" />
          Delete for everyone
        </ContextMenuItem>
      )}
      {!isMine && (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => onReport(message)}>
            <Flag size={15} strokeWidth={1.75} className="mr-2" />
            Report
          </ContextMenuItem>
        </>
      )}
    </ContextMenuContent>
  );
}
