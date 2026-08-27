import { Info, MoreVertical, Pin, PinOff, Bell, BellOff, Archive, ArchiveRestore, Trash2, Users as UsersIcon } from "lucide-react";
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
}: ChatHeaderProps) {
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
    <header className="flex items-center gap-3 border-b border-border bg-card/70 px-4 py-3">
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
        <p className="truncate font-medium">{group.name}</p>
        <p className="truncate text-caption text-muted-foreground">{subtitle}</p>
      </div>

      <div className="flex items-center gap-0.5">
        {!isDirect && (
          <Button variant="ghost" size="icon" className="size-9 rounded-full" onClick={onOpenInfo} title="Group info">
            <Info size={17} strokeWidth={1.75} />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-9 rounded-full"
          onClick={onTogglePin}
          title={group.isPinned ? "Unpin" : "Pin"}
        >
          {group.isPinned ? <PinOff size={17} strokeWidth={1.75} /> : <Pin size={17} strokeWidth={1.75} />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 rounded-full"
          onClick={onToggleMute}
          title={group.isMuted ? "Unmute" : "Mute"}
        >
          {group.isMuted ? <BellOff size={17} strokeWidth={1.75} /> : <Bell size={17} strokeWidth={1.75} />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 rounded-full"
          onClick={onToggleArchive}
          title={group.isArchived ? "Unarchive" : "Archive"}
        >
          {group.isArchived ? <ArchiveRestore size={17} strokeWidth={1.75} /> : <Archive size={17} strokeWidth={1.75} />}
        </Button>

        {isAdmin && !isDirect && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-9 rounded-full" title="More">
                <MoreVertical size={17} strokeWidth={1.75} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDeleteGroup}>
                <Trash2 size={15} strokeWidth={1.75} className="mr-2" />
                Delete group
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
