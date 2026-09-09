import { Search, Users as UsersIcon, MessageSquare, Plus, Pin, BellOff, Archive, UserPlus, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatTime, computeInitials } from "./helpers";
import type { ChatGroup, UserForContact } from "@/services/chat";

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
}

function ChatRow({
  group,
  active,
  currentUserId,
  onlineIds,
  onSelect,
}: {
  group: ChatGroup;
  active: boolean;
  currentUserId: string;
  onlineIds: Set<string>;
  onSelect: (id: string) => void;
}) {
  const isDirect = group.type === "direct";
  const other = isDirect ? group.members.find((m) => m._id !== currentUserId) : undefined;
  const online = isDirect ? (other ? onlineIds.has(other._id) || other.online : false) : false;

  const preview = group.lastMessage?.text
    ? (group.lastMessage.senderId === currentUserId ? "You: " : "") + group.lastMessage.text
    : isDirect
      ? "No messages yet"
      : `${group.members.length} members`;

  const showUnread = (group.unread ?? 0) > 0 && !group.isMuted;

  return (
    <button
      onClick={() => onSelect(group._id)}
      className={`grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg p-2.5 text-left transition-colors duration-150 ${
        active ? "bg-primary/8 font-medium" : "hover:bg-accent"
      }`}
    >
      <span className="relative grid size-11 shrink-0 place-items-center rounded-full bg-primary/12 text-helper font-semibold text-primary">
        {isDirect ? (
          computeInitials(group.name)
        ) : (
          <UsersIcon size={18} strokeWidth={1.75} />
        )}
        {online && (
          <span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-card bg-success" />
        )}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1 truncate text-helper font-medium">
          {group.isPinned && <Pin size={11} strokeWidth={2} className="shrink-0 text-muted-foreground" />}
          {group.isMuted && <BellOff size={11} strokeWidth={2} className="shrink-0 text-muted-foreground" />}
          <span className="truncate">{group.name}</span>
        </span>
        <span className="block truncate text-caption text-muted-foreground">{preview}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        {group.lastMessage?.at && (
          <span className="text-[10px] tabular-nums text-muted-foreground">{formatTime(group.lastMessage.at)}</span>
        )}
        {showUnread ? (
          <span className="num inline-block rounded-full bg-primary px-1.5 text-[11px] leading-4 text-primary-foreground">
            {group.unread}
          </span>
        ) : group.isArchived ? (
          <Archive size={12} strokeWidth={1.75} className="text-muted-foreground" />
        ) : null}
      </span>
    </button>
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
}: ChatSidebarProps) {
  const query = search.trim().toLowerCase();
  const filtered = query ? groups.filter((g) => g.name.toLowerCase().includes(query)) : groups;
  const pinned = filtered.filter((g) => g.isPinned && !g.isArchived);
  const main = filtered.filter((g) => !g.isPinned && !g.isArchived);
  const archived = filtered.filter((g) => g.isArchived);

  // Search firm colleagues/employees when typing a query
  const matchingUsers = query
    ? users.filter(
        (u) =>
          u._id !== currentUserId &&
          (u.name.toLowerCase().includes(query) || (u.email && u.email.toLowerCase().includes(query))),
      )
    : [];

  const handleColleagueClick = (colleagueId: string) => {
    // Check if direct conversation already exists in groups
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
              onSelect={onSelect}
            />
          </li>
        ))}
      </ul>
    );

  return (
    <aside className="flex h-full flex-col border-r border-border bg-card/50">
      <div className="flex items-center gap-2 p-3">
        <label className="flex flex-1 items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-2">
          <Search size={15} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
          <input
            type="search"
            aria-label="Search conversations or colleagues"
            placeholder="Search chats or colleagues…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-helper outline-none"
          />
        </label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="size-10 shrink-0 rounded-full" title="New conversation">
              <Plus size={17} strokeWidth={1.75} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
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

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 pb-3">
        {/* If searching and colleagues match, present them prominently */}
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

        {query && filtered.length > 0 && matchingUsers.length > 0 && (
          <p className="px-2 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Active Chats
          </p>
        )}

        {pinned.length > 0 && (
          <div>
            <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Pinned
            </p>
            {renderRows(pinned)}
          </div>
        )}

        {main.length > 0 && renderRows(main)}

        {archived.length > 0 && (
          <div>
            <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Archived
            </p>
            {renderRows(archived)}
          </div>
        )}

        {filtered.length === 0 && matchingUsers.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <UserPlus size={28} strokeWidth={1.25} className="text-muted-foreground/40" />
            <p className="text-helper text-muted-foreground">
              {query ? "No chats or colleagues match your search" : "No conversations yet"}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
