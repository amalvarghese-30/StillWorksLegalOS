import { useState } from "react";
import {
  Pencil,
  UserPlus,
  LogOut,
  MoreVertical,
  Crown,
  UserMinus,
  Check,
  X,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { computeInitials, formatLastSeen } from "./helpers";
import type { ChatGroup, ChatMember } from "@/services/chat";

interface GroupInfoSheetProps {
  open: boolean;
  onClose: () => void;
  group: ChatGroup | null;
  members: ChatMember[];
  currentUserId: string;
  canManage: boolean;
  onlineIds: Set<string>;
  onRename: (name: string) => void;
  onAddMembers: () => void;
  onChangeRole: (userId: string, role: "admin" | "member") => void;
  onRemoveMember: (userId: string) => void;
  onLeave: () => void;
  isLeaving: boolean;
  isAdmin?: boolean;
  onClearChat?: () => void;
  onDeleteChat?: () => void;
  onDeleteGroup?: () => void;
}

export function GroupInfoSheet({
  open,
  onClose,
  group,
  members,
  currentUserId,
  canManage,
  onlineIds,
  onRename,
  onAddMembers,
  onChangeRole,
  onRemoveMember,
  onLeave,
  isLeaving,
  isAdmin = false,
  onClearChat,
  onDeleteChat,
  onDeleteGroup,
}: GroupInfoSheetProps) {
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(group?.name ?? "");
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [deleteChatConfirmOpen, setDeleteChatConfirmOpen] = useState(false);
  const [deleteGroupConfirmOpen, setDeleteGroupConfirmOpen] = useState(false);

  const isDirect = group?.type === "direct";
  const otherMember = isDirect
    ? members.find((m) => m._id !== currentUserId)
    : undefined;

  const isOnline = (m: ChatMember) => onlineIds.has(m._id) || m.online;

  const saveRename = () => {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== group?.name) onRename(trimmed);
    setEditing(false);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-80 sm:w-96">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {group?.name}
            {canManage && (
              <button
                onClick={() => {
                  setNameDraft(group?.name ?? "");
                  setEditing(true);
                }}
                className="text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Rename group"
              >
                <Pencil size={14} strokeWidth={1.75} />
              </button>
            )}
          </SheetTitle>
          <SheetDescription>
            {group?.type === "group" ? `${members.length} members` : "Direct conversation"}
          </SheetDescription>
        </SheetHeader>

        {editing && (
          <div className="mt-3 flex items-center gap-2">
            <Input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              className="h-9"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") saveRename();
                if (e.key === "Escape") setEditing(false);
              }}
            />
            <Button size="icon" variant="ghost" className="size-9 shrink-0" onClick={saveRename}>
              <Check size={16} />
            </Button>
            <Button size="icon" variant="ghost" className="size-9 shrink-0" onClick={() => setEditing(false)}>
              <X size={16} />
            </Button>
          </div>
        )}

        <Separator className="my-4" />

        <ScrollArea className="h-[calc(100%-140px)]">
          <div className="space-y-5 pr-1">
            {isDirect ? (
              /* Direct Contact Profile View */
              <div className="flex flex-col items-center text-center pt-2 pb-4">
                <div className="relative mb-3">
                  <Avatar className="size-20 shadow-soft border-2 border-primary/20">
                    <AvatarFallback className="bg-primary/15 text-2xl font-bold text-primary">
                      {computeInitials(group?.name ?? "")}
                    </AvatarFallback>
                  </Avatar>
                  {otherMember && isOnline(otherMember) && (
                    <span className="absolute bottom-1 right-1 size-4 rounded-full border-2 border-card bg-success" />
                  )}
                </div>
                <h3 className="text-lg font-bold text-foreground">{group?.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {otherMember && isOnline(otherMember)
                    ? "Online"
                    : otherMember?.lastActiveAt
                    ? `Last seen ${formatLastSeen(otherMember.lastActiveAt)}`
                    : "Firm Colleague"}
                </p>

                <div className="mt-5 w-full rounded-xl border border-border/70 bg-muted/30 p-3 text-left">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Security & Encryption
                  </p>
                  <p className="text-xs text-foreground/80 mt-1 leading-relaxed">
                    Messages with this colleague are end-to-end encrypted for the firm.
                  </p>
                </div>
              </div>
            ) : (
              /* Group Chat Members View */
              <div>
                <h3 className="mb-2 text-caption font-medium text-muted-foreground">Members</h3>
                <ul className="space-y-1">
                  {members.map((m) => {
                    const online = isOnline(m);
                    return (
                      <li key={m._id} className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-accent">
                        <div className="relative shrink-0">
                          <Avatar className="size-9">
                            <AvatarFallback className="bg-primary/15 text-sm font-medium text-primary">
                              {computeInitials(m.name)}
                            </AvatarFallback>
                          </Avatar>
                          {online && (
                            <span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-card bg-success" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">
                            {m.name}
                            {m._id === currentUserId && <span className="text-muted-foreground"> (you)</span>}
                          </p>
                          <p className="truncate text-caption text-muted-foreground">
                            {online ? "online" : `last seen ${formatLastSeen(m.lastActiveAt)}`}
                          </p>
                        </div>
                        {m.role === "admin" && (
                          <Badge variant="secondary" className="shrink-0 text-[10px]">admin</Badge>
                        )}
                        {canManage && m._id !== currentUserId && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                                aria-label="Member options"
                              >
                                <MoreVertical size={14} strokeWidth={1.75} />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent align="end" sideOffset={4} className="w-48 p-1">
                              {m.role === "member" ? (
                                <button
                                  onClick={() => onChangeRole(m._id, "admin")}
                                  className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent"
                                >
                                  <Crown size={14} strokeWidth={1.75} />
                                  Make admin
                                </button>
                              ) : (
                                <button
                                  onClick={() => onChangeRole(m._id, "member")}
                                  className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent"
                                >
                                  <UserMinus size={14} strokeWidth={1.75} />
                                  Remove admin
                                </button>
                              )}
                              <Separator className="my-1" />
                              <button
                                onClick={() => onRemoveMember(m._id)}
                                className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                              >
                                <UserMinus size={14} strokeWidth={1.75} />
                                Remove member
                              </button>
                            </PopoverContent>
                          </Popover>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {!isDirect && canManage && (
              <>
                <Separator />
                <button
                  onClick={onAddMembers}
                  className="flex w-full items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
                >
                  <UserPlus size={14} strokeWidth={1.75} />
                  Add members
                </button>
              </>
            )}

            <Separator />

            {/* Danger Zone Actions */}
            <div className="space-y-2 pt-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Chat Management
              </p>

              {/* Clear Messages */}
              {onClearChat && (
                <AlertDialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
                  <AlertDialogTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-1.5"
                    >
                      <X size={15} strokeWidth={1.75} />
                      Clear message history
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear messages?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove all messages in this conversation from your device. Other participants will still be able to see them.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-white hover:bg-destructive/90"
                        onClick={() => {
                          onClearChat();
                          onClose();
                        }}
                      >
                        Clear messages
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              {/* Direct Chat: Delete chat */}
              {isDirect && onDeleteChat && (
                <AlertDialog open={deleteChatConfirmOpen} onOpenChange={setDeleteChatConfirmOpen}>
                  <AlertDialogTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 text-sm font-medium text-destructive transition-colors hover:text-destructive/80 py-1.5"
                    >
                      <LogOut size={15} strokeWidth={1.75} />
                      Delete conversation
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will delete this conversation from your chat list and clear your message history. If this person messages you again, a new conversation will appear.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-white hover:bg-destructive/90"
                        onClick={() => {
                          onDeleteChat();
                          onClose();
                        }}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              {/* Group Chat: Leave Group */}
              {!isDirect && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 text-sm font-medium text-destructive transition-colors hover:text-destructive/80 py-1.5"
                      disabled={isLeaving}
                    >
                      <LogOut size={15} strokeWidth={1.75} />
                      Leave group
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Leave group?</AlertDialogTitle>
                      <AlertDialogDescription>
                        You will stop receiving messages from “{group?.name}”.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-white hover:bg-destructive/90"
                        onClick={() => {
                          onLeave();
                          onClose();
                        }}
                      >
                        Leave
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              {/* Group Chat: Admin Delete Group */}
              {!isDirect && (isAdmin || canManage) && onDeleteGroup && (
                <AlertDialog open={deleteGroupConfirmOpen} onOpenChange={setDeleteGroupConfirmOpen}>
                  <AlertDialogTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 text-sm font-medium text-destructive transition-colors hover:text-destructive/80 py-1.5"
                    >
                      <X size={15} strokeWidth={1.75} className="rotate-45" />
                      Delete group permanently
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete group permanently?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete “{group?.name}” and all its messages for everyone in the group. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-white hover:bg-destructive/90"
                        onClick={() => {
                          onDeleteGroup();
                          onClose();
                        }}
                      >
                        Delete group
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
