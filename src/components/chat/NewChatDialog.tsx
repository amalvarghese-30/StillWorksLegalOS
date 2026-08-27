import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { computeInitials } from "./helpers";
import type { UserForContact } from "@/services/chat";

interface NewChatDialogProps {
  open: boolean;
  onClose: () => void;
  users: UserForContact[];
  currentUserId: string;
  isCreating: boolean;
  onStartChat: (userId: string) => void;
}

export function NewChatDialog({
  open,
  onClose,
  users,
  currentUserId,
  isCreating,
  onStartChat,
}: NewChatDialogProps) {
  const [search, setSearch] = useState("");

  const contacts = users.filter((u) => u._id !== currentUserId);
  const query = search.trim().toLowerCase();
  const filtered = query
    ? contacts.filter(
        (u) =>
          u.name.toLowerCase().includes(query) ||
          u.email.toLowerCase().includes(query),
      )
    : contacts;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New chat</DialogTitle>
          <DialogDescription>
            Start a private conversation with a teammate.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
            <Search size={15} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search people…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-helper outline-none"
              autoFocus
            />
          </label>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-helper text-muted-foreground">No people found</p>
            ) : (
              filtered.map((u) => (
                <button
                  key={u._id}
                  type="button"
                  onClick={() => onStartChat(u._id)}
                  disabled={isCreating}
                  className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-accent disabled:opacity-60"
                >
                  <span className="relative shrink-0">
                    <Avatar className="size-9">
                      <AvatarFallback className="bg-primary/15 text-sm font-medium text-primary">
                        {computeInitials(u.name)}
                      </AvatarFallback>
                    </Avatar>
                    {u.status === "online" && (
                      <span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-card bg-success" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{u.name}</p>
                    <p className="truncate text-caption text-muted-foreground">{u.email}</p>
                  </div>
                  {isCreating && <Loader2 size={16} className="animate-spin text-muted-foreground" />}
                </button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
