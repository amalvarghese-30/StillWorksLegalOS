import { Forward, Users as UsersIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { computeInitials } from "./helpers";
import type { ChatGroup, ChatMessage } from "@/services/chat";

interface ForwardDialogProps {
  open: boolean;
  onClose: () => void;
  groups: ChatGroup[];
  currentUserId: string;
  message: ChatMessage | null;
  onForward: (targetGroupId: string) => void;
}

export function ForwardDialog({
  open,
  onClose,
  groups,
  currentUserId,
  message,
  onForward,
}: ForwardDialogProps) {
  const targets = groups.filter((g) => g._id !== message?.groupId);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Forward message</DialogTitle>
          <DialogDescription>
            {message ? (
              <span className="line-clamp-2 block text-helper text-muted-foreground">
                “{message.text}”
              </span>
            ) : (
              "Choose a chat"
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {targets.length === 0 ? (
            <p className="py-8 text-center text-helper text-muted-foreground">No other chats</p>
          ) : (
            targets.map((g) => {
              const isDirect = g.type === "direct";
              const other = isDirect ? g.members.find((m) => m._id !== currentUserId) : undefined;
              return (
                <button
                  key={g._id}
                  type="button"
                  onClick={() => onForward(g._id)}
                  className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-accent"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/12 text-sm font-semibold text-primary">
                    {isDirect ? computeInitials(g.name) : <UsersIcon size={15} strokeWidth={1.75} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{isDirect && other ? other.name : g.name}</p>
                    <p className="truncate text-caption text-muted-foreground">
                      {isDirect ? "Direct" : `${g.members.length} members`}
                    </p>
                  </div>
                  <Forward size={15} strokeWidth={1.75} className="text-muted-foreground" />
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
