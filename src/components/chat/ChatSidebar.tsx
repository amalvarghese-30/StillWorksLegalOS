import { useState, useRef } from "react";
import {
  Search,
  Users as UsersIcon,
  MessageSquare,
  Plus,
  Pin,
  PinOff,
  Bell,
  BellOff,
  Archive,
  ArchiveRestore,
  UserPlus,
  UserCheck,
  MoreVertical,
  CheckCheck,
  Mail,
  Trash2,
  LogOut,
  X,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatTime, computeInitials } from "./helpers";
import type { ChatGroup, UserForContact } from "@/services/chat";

export type SidebarFilter = "all" | "unread" | "direct" | "groups";

interface ChatSidebarProps {
  groups: ChatGroup[];
  activeGroupId: string | null;
  currentUserId: string;
  onlineIds: Set<string>;
  search: string;
  onSearchChange: (v: string) => void;
  isAdmin: boolean;
  onSelect: (id: string) => void;
  onNewGroup: () => void;
  onNewChat: () => void;
  users?: UserForContact[];
  onStartDirectChat?: (userId: string) => void;
  isCreatingDirectChat?: boolean;
  onTogglePin?: ((groupId: string, pinned: boolean) => void) | undefined;
  onToggleMute?: ((groupId: string, muted: boolean) => void) | undefined;
  onToggleArchive?: ((groupId: string, archived: boolean) => void) | undefined;
  onMarkRead?: ((groupId: string) => void) | undefined;
  onMarkUnread?: ((groupId: string) => void) | undefined;
  onDeleteChat?: ((groupId: string) => void) | undefined;
  onClearChat?: ((groupId: string) => void) | undefined;
  onLeaveGroup?: ((groupId: string) => void) | undefined;
  onDeleteGroup?: ((groupId: string) => void) | undefined;
}

function ChatRow({
  group,
  active,
  currentUserId,
  onlineIds,
  isAdmin,
  onSelect,
  onTogglePin,
  onToggleMute,
  onToggleArchive,
  onMarkRead,
  onMarkUnread,
  onDeleteChat,
  onClearChat,
  onLeaveGroup,
  onDeleteGroup,
}: {
  group: ChatGroup;
  active: boolean;
  currentUserId: string;
  onlineIds: Set<string>;
  isAdmin: boolean;
  onSelect: (id: string) => void;
  onTogglePin?: ((groupId: string, pinned: boolean) => void) | undefined;
  onToggleMute?: ((groupId: string, muted: boolean) => void) | undefined;
  onToggleArchive?: ((groupId: string, archived: boolean) => void) | undefined;
  onMarkRead?: ((groupId: string) => void) | undefined;
  onMarkUnread?: ((groupId: string) => void) | undefined;
  onDeleteChat?: ((groupId: string) => void) | undefined;
  onClearChat?: ((groupId: string) => void) | undefined;
  onLeaveGroup?: ((groupId: string) => void) | undefined;
  onDeleteGroup?: ((groupId: string) => void) | undefined;
}) {
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const longPressTimerRef = useRef<any>(null);

  const isDirect = group.type === "direct";
  const other = isDirect ? group.members.find((m) => m._id !== currentUserId) : undefined;
  const online = isDirect ? (other ? onlineIds.has(other._id) || other.online : false) : false;

  const isGroupAdmin =
    isAdmin || group.members.some((m) => m._id === currentUserId && m.role === "admin");

  const preview = group.lastMessage?.text
    ? (group.lastMessage.senderId === currentUserId ? "You: " : "") + group.lastMessage.text
    : isDirect
      ? "No messages yet"
      : `${group.members.length} members`;

  const unreadCount = group.unread ?? 0;
  const showUnread = unreadCount > 0 && !group.isMuted;

  // Touch long press support for mobile
  const handleTouchStart = () => {
    longPressTimerRef.current = setTimeout(() => {
      setDropdownOpen(true);
    }, 550);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Shared Action items rendered inside both ContextMenu and DropdownMenu
  const renderMenuItems = (isContext = false) => {
    const Item = isContext ? ContextMenuItem : DropdownMenuItem;
    const Separator = isContext ? ContextMenuSeparator : DropdownMenuSeparator;

    return (
      <>
        {unreadCount > 0 ? (
          <Item
            onClick={(e) => {
              e.stopPropagation();
              onMarkRead?.(group._id);
            }}
          >
            <CheckCheck size={14} className="mr-2 text-muted-foreground" />
            Mark as read
          </Item>
        ) : (
          <Item
            onClick={(e) => {
              e.stopPropagation();
              onMarkUnread?.(group._id);
            }}
          >
            <Mail size={14} className="mr-2 text-muted-foreground" />
            Mark as unread
          </Item>
        )}

        <Item
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin?.(group._id, group.isPinned);
          }}
        >
          {group.isPinned ? (
            <PinOff size={14} className="mr-2 text-muted-foreground" />
          ) : (
            <Pin size={14} className="mr-2 text-muted-foreground" />
          )}
          {group.isPinned ? "Unpin chat" : "Pin chat"}
        </Item>

        <Item
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute?.(group._id, group.isMuted);
          }}
        >
          {group.isMuted ? (
            <Bell size={14} className="mr-2 text-muted-foreground" />
          ) : (
            <BellOff size={14} className="mr-2 text-muted-foreground" />
          )}
          {group.isMuted ? "Unmute notifications" : "Mute notifications"}
        </Item>

        <Item
          onClick={(e) => {
            e.stopPropagation();
            onToggleArchive?.(group._id, group.isArchived);
          }}
        >
          {group.isArchived ? (
            <ArchiveRestore size={14} className="mr-2 text-muted-foreground" />
          ) : (
            <Archive size={14} className="mr-2 text-muted-foreground" />
          )}
          {group.isArchived ? "Unarchive chat" : "Archive chat"}
        </Item>

        <Separator />

        <Item
          onClick={(e) => {
            e.stopPropagation();
            setClearDialogOpen(true);
          }}
        >
          <X size={14} className="mr-2 text-muted-foreground" />
          Clear messages
        </Item>

        {isDirect ? (
          <Item
            className="text-destructive focus:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteDialogOpen(true);
            }}
          >
            <Trash2 size={14} className="mr-2" />
            Delete chat
          </Item>
        ) : (
          <>
            <Item
              className="text-destructive focus:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                setLeaveDialogOpen(true);
              }}
            >
              <LogOut size={14} className="mr-2" />
              Leave group
            </Item>
            {isGroupAdmin && (
              <Item
                className="text-destructive focus:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteDialogOpen(true);
                }}
              >
                <Trash2 size={14} className="mr-2" />
                Delete group
              </Item>
            )}
          </>
        )}
      </>
    );
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            role="button"
            tabIndex={0}
            onClick={() => onSelect(group._id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(group._id);
              }
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchEnd}
            className={`group relative grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl p-2.5 text-left transition-all duration-150 cursor-pointer select-none ${
              active
                ? "bg-primary/10 font-medium text-foreground shadow-xs border border-primary/20"
                : "hover:bg-accent/70 active:bg-accent focus-visible:bg-accent outline-none"
            }`}
          >
            {/* Avatar with initials or group icon */}
            <span className="relative grid size-11 shrink-0 place-items-center rounded-full bg-primary/12 text-helper font-semibold text-primary transition-transform group-hover:scale-105">
              {isDirect ? (
                computeInitials(group.name)
              ) : (
                <UsersIcon size={18} strokeWidth={1.75} />
              )}
              {online && (
                <span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-card bg-success" />
              )}
            </span>

            {/* Middle: Name & preview */}
            <div className="min-w-0 pr-1">
              <div className="flex items-center gap-1.5 truncate text-helper font-medium">
                {group.isPinned && (
                  <Pin size={11} strokeWidth={2.5} className="shrink-0 text-primary" />
                )}
                {group.isMuted && (
                  <BellOff size={11} strokeWidth={2} className="shrink-0 text-muted-foreground" />
                )}
                <span className="truncate text-foreground font-semibold">{group.name}</span>
              </div>
              <p className="block truncate text-caption text-muted-foreground mt-0.5">
                {preview}
              </p>
            </div>

            {/* Right: Time, Unread pill, and subtle hover 3-dot trigger */}
            <div className="flex shrink-0 flex-col items-end justify-between gap-1.5 min-w-[48px]">
              {group.lastMessage?.at && (
                <span className={`text-[10.5px] tabular-nums select-none ${showUnread ? "font-bold text-primary" : "text-muted-foreground"}`}>
                  {formatTime(group.lastMessage.at)}
                </span>
              )}

              <div className="flex items-center gap-1">
                {showUnread && (
                  <span className="inline-grid place-items-center rounded-full bg-primary px-1.5 min-w-4 text-[10.5px] font-bold leading-4 text-primary-foreground">
                    {unreadCount}
                  </span>
                )}

                {group.isArchived && !showUnread && (
                  <Archive size={12} strokeWidth={1.75} className="text-muted-foreground" />
                )}

                {/* Subtle Hover 3-dot Dropdown Trigger */}
                <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                      aria-label="Chat options"
                      title="Chat options"
                    >
                      <MoreVertical size={13} strokeWidth={2} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52 shadow-lift">
                    {renderMenuItems(false)}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </ContextMenuTrigger>

        {/* Right-click Context Menu */}
        <ContextMenuContent className="w-52 shadow-lift">
          {renderMenuItems(true)}
        </ContextMenuContent>
      </ContextMenu>

      {/* Confirmation Dialogs */}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear message history?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to clear all messages in “{group.name}”? Messages will be cleared from your view.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => onClearChat?.(group._id)}
            >
              Clear messages
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isDirect ? "Delete conversation?" : "Delete group permanently?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isDirect
                ? `Delete conversation with “${group.name}”? It will be removed from your chat list.`
                : `Permanently delete “${group.name}” and all messages for every member? This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (isDirect) {
                  onDeleteChat?.(group._id);
                } else {
                  onDeleteGroup?.(group._id);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave “{group.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              You will stop receiving messages from this group.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => onLeaveGroup?.(group._id)}
            >
              Leave group
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function ChatSidebar({
  groups,
  activeGroupId,
  currentUserId,
  onlineIds,
  search,
  onSearchChange,
  isAdmin,
  onSelect,
  onNewGroup,
  onNewChat,
  users = [],
  onStartDirectChat,
  isCreatingDirectChat = false,
  onTogglePin,
  onToggleMute,
  onToggleArchive,
  onMarkRead,
  onMarkUnread,
  onDeleteChat,
  onClearChat,
  onLeaveGroup,
  onDeleteGroup,
}: ChatSidebarProps) {
  const [filter, setFilter] = useState<SidebarFilter>("all");
  const [showArchivedView, setShowArchivedView] = useState(false);

  const query = search.trim().toLowerCase();

  // Active chats (non-archived) vs archived
  const allNonArchived = groups.filter((g) => !g.isArchived);
  const allArchived = groups.filter((g) => g.isArchived);

  // Apply query filter
  const searchFilter = (list: ChatGroup[]) =>
    query ? list.filter((g) => g.name.toLowerCase().includes(query)) : list;

  // Apply category pill filter
  const applyCategoryFilter = (list: ChatGroup[]) => {
    if (filter === "unread") return list.filter((g) => (g.unread ?? 0) > 0);
    if (filter === "direct") return list.filter((g) => g.type === "direct");
    if (filter === "groups") return list.filter((g) => g.type === "group");
    return list;
  };

  const currentDisplayList = showArchivedView
    ? searchFilter(allArchived)
    : applyCategoryFilter(searchFilter(allNonArchived));

  const pinned = currentDisplayList.filter((g) => g.isPinned);
  const main = currentDisplayList.filter((g) => !g.isPinned);

  // Count unread across non-archived
  const totalUnreadCount = allNonArchived.reduce((acc, g) => acc + (g.unread ?? 0), 0);

  // Search firm colleagues/employees when typing a query
  const matchingUsers = query
    ? users.filter(
        (u) =>
          u._id !== currentUserId &&
          (u.name.toLowerCase().includes(query) || (u.email && u.email.toLowerCase().includes(query))),
      )
    : [];

  const handleColleagueClick = (colleagueId: string) => {
    const existing = groups.find(
      (g) => g.type === "direct" && g.members.some((m) => m._id === colleagueId),
    );
    if (existing) {
      onSelect(existing._id);
      onSearchChange("");
    } else if (onStartDirectChat) {
      onStartDirectChat(colleagueId);
      onSearchChange("");
    }
  };

  const renderRows = (list: ChatGroup[]) =>
    list.length === 0 ? null : (
      <ul className="space-y-0.5">
        {list.map((g) => (
          <li key={g._id}>
            <ChatRow
              group={g}
              active={activeGroupId === g._id}
              currentUserId={currentUserId}
              onlineIds={onlineIds}
              isAdmin={isAdmin}
              onSelect={onSelect}
              onTogglePin={onTogglePin}
              onToggleMute={onToggleMute}
              onToggleArchive={onToggleArchive}
              onMarkRead={onMarkRead}
              onMarkUnread={onMarkUnread}
              onDeleteChat={onDeleteChat}
              onClearChat={onClearChat}
              onLeaveGroup={onLeaveGroup}
              onDeleteGroup={onDeleteGroup}
            />
          </li>
        ))}
      </ul>
    );

  return (
    <aside className="flex h-full flex-col border-r border-border bg-card/60 backdrop-blur-xs">
      {/* Top Search & Create Bar */}
      <div className="flex items-center gap-2 p-3 pb-2">
        <label className="flex flex-1 items-center gap-2 rounded-full border border-border bg-muted/50 px-3.5 py-2 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30 transition-all">
          <Search size={15} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
          <input
            type="search"
            aria-label="Search conversations or colleagues"
            placeholder="Search chats or colleagues…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
          />
        </label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="size-9 shrink-0 rounded-full border-border/80 shadow-xs hover:border-primary hover:text-primary transition-colors"
              title="New conversation"
            >
              <Plus size={17} strokeWidth={2} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 shadow-lift">
            {isAdmin && (
              <DropdownMenuItem onClick={onNewGroup}>
                <UsersIcon size={15} strokeWidth={1.75} className="mr-2" />
                New group
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onNewChat}>
              <MessageSquare size={15} strokeWidth={1.75} className="mr-2" />
              New chat
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* WhatsApp-Style Filter Pills */}
      {!showArchivedView && !query && (
        <div className="flex items-center gap-1.5 px-3 pb-2 pt-1 overflow-x-auto no-scrollbar touch-scroll">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
              filter === "all"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilter("unread")}
            className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
              filter === "unread"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <span>Unread</span>
            {totalUnreadCount > 0 && (
              <span
                className={`ml-0.5 grid place-items-center rounded-full px-1.5 text-[10px] font-bold ${
                  filter === "unread"
                    ? "bg-primary-foreground text-primary"
                    : "bg-primary text-primary-foreground"
                }`}
              >
                {totalUnreadCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setFilter("direct")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
              filter === "direct"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            Direct
          </button>
          <button
            type="button"
            onClick={() => setFilter("groups")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
              filter === "groups"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            Groups
          </button>
        </div>
      )}

      {/* Archived View Header Navigation */}
      {showArchivedView && (
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-3 py-2">
          <button
            type="button"
            onClick={() => setShowArchivedView(false)}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <ArrowLeft size={14} />
            <span>Back to all chats</span>
          </button>
          <span className="text-[11px] font-semibold text-muted-foreground">
            {allArchived.length} archived
          </span>
        </div>
      )}

      {/* Main Conversation List */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-2.5 pb-3">
        {/* Dedicated WhatsApp-Style Archived Row at the Top */}
        {!showArchivedView && !query && filter === "all" && allArchived.length > 0 && (
          <button
            type="button"
            onClick={() => setShowArchivedView(true)}
            className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Archive size={15} className="text-primary" />
              <span className="font-semibold text-foreground">Archived chats</span>
            </div>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
              {allArchived.length}
            </span>
          </button>
        )}

        {/* Colleagues match results while searching */}
        {query && matchingUsers.length > 0 && (
          <div>
            <p className="mb-1 flex items-center justify-between px-2 text-[11px] font-medium uppercase tracking-wide text-primary">
              <span>Firm Colleagues</span>
              <span className="text-muted-foreground">Tap to chat</span>
            </p>
            <ul className="space-y-0.5">
              {matchingUsers.map((u) => {
                const isOnline = onlineIds.has(u._id) || u.status === "online";
                return (
                  <li key={u._id}>
                    <button
                      type="button"
                      disabled={isCreatingDirectChat}
                      onClick={() => handleColleagueClick(u._id)}
                      className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-primary/10 active:bg-primary/20"
                    >
                      <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-primary/15 text-helper font-semibold text-primary">
                        <Avatar className="size-10">
                          <AvatarFallback className="bg-primary/15 text-sm font-semibold text-primary">
                            {computeInitials(u.name)}
                          </AvatarFallback>
                        </Avatar>
                        {isOnline && (
                          <span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-card bg-success" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-helper font-medium text-foreground">{u.name}</p>
                        <p className="truncate text-caption text-muted-foreground">{u.email}</p>
                      </div>
                      <span className="flex items-center gap-1 text-[11px] font-medium text-primary">
                        <UserCheck size={14} />
                        <span className="hidden sm:inline">Chat</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {query && currentDisplayList.length > 0 && matchingUsers.length > 0 && (
          <p className="px-2 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Active Chats
          </p>
        )}

        {pinned.length > 0 && (
          <div>
            <p className="mb-1 px-2 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
              Pinned
            </p>
            {renderRows(pinned)}
          </div>
        )}

        {main.length > 0 && renderRows(main)}

        {currentDisplayList.length === 0 && matchingUsers.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <UserPlus size={28} strokeWidth={1.25} className="text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">
              {query
                ? "No chats or colleagues match your search"
                : showArchivedView
                ? "No archived conversations"
                : filter === "unread"
                ? "No unread conversations"
                : "No conversations yet"}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
