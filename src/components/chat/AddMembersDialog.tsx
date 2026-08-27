import { useEffect, useState } from "react";
import { Search, UserPlus, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { computeInitials } from "./helpers";
import type { UserForContact } from "@/services/chat";

interface AddMembersDialogProps {
  open: boolean;
  onClose: () => void;
  users: UserForContact[];
  existingMemberIds: string[];
  isAdding: boolean;
  onAdd: (memberIds: string[]) => void;
}

export function AddMembersDialog({
  open,
  onClose,
  users,
  existingMemberIds,
  isAdding,
  onAdd,
}: AddMembersDialogProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      setSearch("");
      setSelected(new Set());
    }
  }, [open]);

  const existing = new Set(existingMemberIds);
  const contacts = users.filter((u) => !existing.has(u._id));
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

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add members</DialogTitle>
          <DialogDescription>
            Select people to add ({selected.size} selected)
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
              <p className="py-8 text-center text-helper text-muted-foreground">
                No one left to add
              </p>
            ) : (
              filtered.map((u) => (
                <button
                  key={u._id}
                  type="button"
                  onClick={() => toggle(u._id)}
                  className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-accent"
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
                  <Checkbox checked={selected.has(u._id)} onCheckedChange={() => toggle(u._id)} />
                </button>
              ))
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="gradient-primary text-primary-foreground"
            onClick={() => onAdd(Array.from(selected))}
            disabled={isAdding || selected.size === 0}
          >
            {isAdding ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} strokeWidth={1.75} className="mr-1" />}
            {isAdding ? "Adding…" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
