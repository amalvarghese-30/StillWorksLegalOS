import { useState } from "react";
import {
  Info,
  MoreVertical,
  Pin,
  PinOff,
  Bell,
  BellOff,
  Archive,
  ArchiveRestore,
  Trash2,
  Users as UsersIcon,
  ArrowLeft,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatLastSeen, computeInitials } from "./helpers";
import type { ChatGroup } from "@/services/chat";

interface ChatHeaderProps {
  group: ChatGroup;
  currentUserId: string;
  onlineIds: Set<string>;
  lastSeen: Map<string, string>;
  onOpenInfo: () => void;
  onTogglePin: () => void;
  onToggleMute: () => void;
  onToggleArchive: () => void;
  isAdmin: boolean;
  onDeleteGroup: () => void;
  onBack?: () => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  matchCount?: number;
  onJumpToMessage?: (messageId: string) => void;
  onUnpinMessage?: () => void;
}

export function ChatHeader({
  group,
  currentUserId,
  onlineIds,
  lastSeen,
  onOpenInfo,
  onTogglePin,
  onToggleMute,
  onToggleArchive,
  isAdmin,
  onDeleteGroup,
  onBack,
  searchQuery = "",
  onSearchChange,
  matchCount = 0,
  onJumpToMessage,
  onUnpinMessage,
}: ChatHeaderProps) {
  const [showSearch, setShowSearch] = useState(false);
  const isDirect = group.type === "direct";
  const other = isDirect ? group.members.find((m) => m._id !== currentUserId) : undefined;
  const otherOnline = other ? onlineIds.has(other._id) || other.online : false;
  const onlineCount = group.members.filter((m) => m._id !== currentUserId && (onlineIds.has(m._id) || m.online)).length;

  let subtitle: string;
  if (isDirect) {
    subtitle = otherOnline
      ? "online"
      : `last seen ${formatLastSeen(other?.lastActiveAt ?? lastSeen.get(other?._id ?? ""))}`;
  } else if (onlineCount > 0) {
    subtitle = `${group.members.length} members · ${onlineCount} online`;
  } else {
    subtitle = `${group.members.length} members`;
  }

  return (
    <header className="flex flex-col border-b border-border bg-card/70">
      <div className="flex items-center gap-2.5 px-3 py-2.5 sm:px-4 sm:py-3">
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 rounded-full lg:hidden"
            onClick={onBack}
            aria-label="Back to conversations"
          >
            <ArrowLeft size={18} strokeWidth={2} />
          </Button>
        )}

        <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-primary/12 text-helper font-semibold text-primary">
          {isDirect ? (
            computeInitials(group.name)
          ) : (
            <UsersIcon size={17} strokeWidth={1.75} />
          )}
          {isDirect && otherOnline && (
            <span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-card bg-success" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium sm:text-base">{group.name}</p>
          <p className="truncate text-[11px] text-muted-foreground sm:text-caption">{subtitle}</p>
        </div>

        <div className="flex items-center gap-0.5">
          {/* In-chat search button */}
          <Button
            variant="ghost"
            size="icon"
            className={`size-9 rounded-full ${showSearch ? "bg-accent text-foreground" : ""}`}
            onClick={() => {
              if (showSearch) {
                onSearchChange?.("");
                setShowSearch(false);
              } else {
                setShowSearch(true);
              }
            }}
            title="Search in conversation"
          >
            <Search size={17} strokeWidth={1.75} />
          </Button>

          {!isDirect && (
            <Button variant="ghost" size="icon" className="size-9 rounded-full" onClick={onOpenInfo} title="Group info">
              <Info size={17} strokeWidth={1.75} />
            </Button>
          )}

          {/* Action icons on tablet / desktop */}
          <Button
            variant="ghost"
            size="icon"
            className="hidden size-9 rounded-full sm:inline-flex"
            onClick={onTogglePin}
            title={group.isPinned ? "Unpin chat" : "Pin chat"}
          >
            {group.isPinned ? <PinOff size={17} strokeWidth={1.75} /> : <Pin size={17} strokeWidth={1.75} />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden size-9 rounded-full sm:inline-flex"
            onClick={onToggleMute}
            title={group.isMuted ? "Unmute chat" : "Mute chat"}
          >
            {group.isMuted ? <BellOff size={17} strokeWidth={1.75} /> : <Bell size={17} strokeWidth={1.75} />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden size-9 rounded-full sm:inline-flex"
            onClick={onToggleArchive}
            title={group.isArchived ? "Unarchive chat" : "Archive chat"}
          >
            {group.isArchived ? <ArchiveRestore size={17} strokeWidth={1.75} /> : <Archive size={17} strokeWidth={1.75} />}
          </Button>

          {/* Dropdown with mobile options and admin options */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-9 rounded-full" title="More options">
                <MoreVertical size={17} strokeWidth={1.75} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="sm:hidden">
                <DropdownMenuItem onClick={onTogglePin}>
                  {group.isPinned ? <PinOff size={15} className="mr-2" /> : <Pin size={15} className="mr-2" />}
                  {group.isPinned ? "Unpin chat" : "Pin chat"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onToggleMute}>
                  {group.isMuted ? <Bell size={15} className="mr-2" /> : <BellOff size={15} className="mr-2" />}
                  {group.isMuted ? "Unmute chat" : "Mute chat"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onToggleArchive}>
                  {group.isArchived ? <ArchiveRestore size={15} className="mr-2" /> : <Archive size={15} className="mr-2" />}
                  {group.isArchived ? "Unarchive chat" : "Archive chat"}
                </DropdownMenuItem>
                {isAdmin && !isDirect && <DropdownMenuSeparator />}
              </div>
              {isAdmin && !isDirect && (
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDeleteGroup}>
                  <Trash2 size={15} strokeWidth={1.75} className="mr-2" />
                  Delete group
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* In-chat Search Expandable Bar */}
      {showSearch && (
        <div className="flex items-center gap-2 border-t border-border/80 bg-muted/40 px-3 py-2 animate-in fade-in duration-150">
          <Search size={15} className="shrink-0 text-muted-foreground" />
          <input
            type="search"
            autoFocus
            placeholder="Search messages in this conversation…"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
          />
          {searchQuery && (
            <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
              {matchCount > 0 ? `${matchCount} found` : "No matches"}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              onSearchChange?.("");
              setShowSearch(false);
            }}
            className="size-6 shrink-0 grid place-items-center rounded text-muted-foreground hover:text-foreground"
            aria-label="Close search"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Pinned Message Notice Banner */}
      {group.pinnedMessage && (
        <div className="flex items-center justify-between gap-2 border-t border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-900 dark:text-amber-200">
          <div
            onClick={() => onJumpToMessage?.(group.pinnedMessage!.messageId)}
            className="flex min-w-0 flex-1 items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity"
            title="Click to jump to pinned notice"
          >
            <Pin size={13} className="shrink-0 text-amber-600 dark:text-amber-400 rotate-45" />
            <span className="font-semibold text-amber-800 dark:text-amber-300 shrink-0">
              Pinned Notice:
            </span>
            <span className="truncate text-foreground/80 font-normal">
              {group.pinnedMessage.text}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] text-amber-800 dark:text-amber-300 hover:bg-amber-500/20"
              onClick={() => onJumpToMessage?.(group.pinnedMessage!.messageId)}
            >
              Jump
            </Button>
            {onUnpinMessage && (
              <button
                type="button"
                onClick={onUnpinMessage}
                className="grid size-6 place-items-center rounded text-muted-foreground hover:text-foreground"
                title="Unpin notice"
                aria-label="Unpin notice"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
