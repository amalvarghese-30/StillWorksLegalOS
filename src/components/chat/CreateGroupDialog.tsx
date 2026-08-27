import { useEffect, useState } from "react";
import { Search, ArrowLeft, ArrowRight, Users as UsersIcon, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { computeInitials } from "./helpers";
import type { UserForContact } from "@/services/chat";

interface CreateGroupDialogProps {
  open: boolean;
  onClose: () => void;
  users: UserForContact[];
  currentUserId: string;
  isCreating: boolean;
  onCreate: (name: string, memberIds: string[]) => void;
}

export function CreateGroupDialog({
  open,
  onClose,
  users,
  currentUserId,
  isCreating,
  onCreate,
}: CreateGroupDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) {
      setStep(1);
      setSearch("");
      setSelected(new Set());
      setName("");
    }
  }, [open]);

  const contacts = users.filter((u) => u._id !== currentUserId);
  const query = search.trim().toLowerCase();
  const filtered = query
    ? contacts.filter(
        (u) =>
          u.name.toLowerCase().includes(query) ||
          u.email.toLowerCase().includes(query),
      )
    : contacts;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleCreate = () => {
    if (!name.trim() || selected.size === 0) return;
    onCreate(name.trim(), Array.from(selected));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        {step === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle>New group</DialogTitle>
              <DialogDescription>
                Select participants ({selected.size} selected)
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
                    <div
                      key={u._id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={selected.has(u._id)}
                      onClick={() => toggle(u._id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggle(u._id);
                        }
                      }}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-accent"
                    >
                      <Avatar className="size-9 shrink-0">
                        <AvatarFallback className="bg-primary/15 text-sm font-medium text-primary">
                          {computeInitials(u.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{u.name}</p>
                        <p className="truncate text-caption text-muted-foreground">{u.email}</p>
                      </div>
                      <Checkbox
                        checked={selected.has(u._id)}
                        className="pointer-events-none"
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button
                className="gradient-primary text-primary-foreground"
                onClick={() => setStep(2)}
                disabled={selected.size === 0}
              >
                Next
                <ArrowRight size={15} strokeWidth={1.75} className="ml-1" />
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Group name</DialogTitle>
              <DialogDescription>
                {selected.size} participant{selected.size === 1 ? "" : "s"} selected
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <Input
                placeholder="Group name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10 rounded-lg"
                autoFocus
              />
              <div className="flex items-center gap-1.5 text-caption text-muted-foreground">
                <UsersIcon size={13} strokeWidth={1.75} />
                Group chats are end-to-end encrypted
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft size={15} strokeWidth={1.75} className="mr-1" />
                Back
              </Button>
              <Button
                className="gradient-primary text-primary-foreground"
                onClick={handleCreate}
                disabled={isCreating || !name.trim()}
              >
                {isCreating ? <Loader2 size={15} className="animate-spin" /> : "Create group"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
