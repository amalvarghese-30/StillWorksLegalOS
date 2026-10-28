import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare,
  X,
  Minus,
  Maximize2,
  Minimize2,
  ExternalLink,
  Wifi,
  WifiOff,
  Loader2,
  Lock,
  Plus,
  Users as UsersIcon,
  ChevronLeft,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useSocket, useSocketEvent } from "@/lib/socket";
import { usePresence } from "@/lib/presence";
import { useFloatingChat } from "@/lib/floatingChat";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useChatGroups,
  useChatMessages,
  useSendMessage,
  useCreateGroup,
  useCreateDirectChat,
  useDeleteGroup,
  useClearChat,
  useDeleteChatForMe,
  useMarkRead,
  useMarkUnread,
  useChatUsers,
  useAddGroupMembers,
  useRemoveGroupMember,
  useChangeMemberRole,
  useLeaveGroup,
  useAddReaction,
  useRenameGroup,
  useDeleteMessageForEveryone,
  useDeleteMessageForMe,
  useTogglePin,
  useToggleMute,
  useToggleArchive,
  useReportMessage,
  usePinMessage,
  useUnpinMessage,
  type ChatGroup,
  type ChatMessage,
  type UserForContact,
  chatKeys,
  fetchOlderMessages,
} from "@/services/chat";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { MessageList } from "@/components/chat/MessageList";
import { MessageComposer } from "@/components/chat/MessageComposer";
import { CreateGroupDialog } from "@/components/chat/CreateGroupDialog";
import { NewChatDialog } from "@/components/chat/NewChatDialog";
import { AddMembersDialog } from "@/components/chat/AddMembersDialog";
import { ForwardDialog } from "@/components/chat/ForwardDialog";
import { GroupInfoSheet } from "@/components/chat/GroupInfoSheet";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export function FloatingChatWidget() {
  const { user, ready } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { socket, status: connStatus } = useSocket();
  const { onlineIds } = usePresence();

  const pathname = location.pathname;
  const isAdmin = user?.role === "admin";
  const hasChatPermission = isAdmin || user?.permissions?.chat !== false;

  // Strict gating conditions:
  // 1. Authentication initialization complete (ready === true)
  // 2. Authenticated user exists
  // 3. User is permitted to use Chat
  // 4. Current route is not login and not the dedicated /chat page
  const isChatEnabled = Boolean(
    ready &&
    user &&
    hasChatPermission &&
    pathname !== "/login" &&
    pathname !== "/chat"
  );

  const {
    isOpen,
    isExpanded,
    activeGroupId,
    close,
    toggle,
    setExpanded,
    setActiveGroup,
  } = useFloatingChat();

  const [searchConv, setSearchConv] = useState("");
  const [inChatSearch, setInChatSearch] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [forwardMessage, setForwardMessage] = useState<ChatMessage | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [showForward, setShowForward] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [lastSeen, setLastSeen] = useState<Map<string, string>>(new Map());
  const [olderPages, setOlderPages] = useState<ChatMessage[][]>([]);
  const [olderCursor, setOlderCursor] = useState<string | null | undefined>(undefined);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const prevGroupRef = useRef<string | null>(null);

  // ── Chat Groups Data ─────────────────────────────────────────────────────
  const { data: groupsData, isLoading: groupsLoading } = useChatGroups({ enabled: isChatEnabled });
  const groups: ChatGroup[] = groupsData?.groups ?? [];
  const activeGroup = groups.find((g) => g._id === activeGroupId) ?? null;

  // Total unread messages across all groups
  const totalUnread = useMemo(
    () => groups.reduce((sum, g) => sum + (g.unreadCount || 0), 0),
    [groups],
  );

  // ── Messages Data ────────────────────────────────────────────────────────
  const { data: messagesData, isLoading: messagesLoading } = useChatMessages(
    activeGroupId ?? undefined,
    { enabled: isChatEnabled && Boolean(activeGroupId) },
  );
  const latestMessages = messagesData?.messages ?? [];
  const allMessages = useMemo(
    () => [...olderPages.flat(), ...latestMessages],
    [olderPages, latestMessages],
  );
  const effectiveCursor =
    olderCursor === undefined ? (messagesData?.nextCursor ?? null) : olderCursor;
  const hasOlder = !!effectiveCursor;

  // ── Users Data for Contacts / Mentions ───────────────────────────────────
  const { data: usersData } = useChatUsers({ enabled: isChatEnabled });
  const allUsers: UserForContact[] = usersData?.users ?? [];

  // ── Mutations ────────────────────────────────────────────────────────────
  const sendMutation = useSendMessage();
  const createGroupMutation = useCreateGroup();
  const createDirectChatMutation = useCreateDirectChat();
  const deleteGroupMutation = useDeleteGroup();
  const clearChatMutation = useClearChat();
  const deleteChatForMeMutation = useDeleteChatForMe();
  const markReadMutation = useMarkRead();
  const markUnreadMutation = useMarkUnread();
  const addMembersMutation = useAddGroupMembers();
  const removeMemberMutation = useRemoveGroupMember();
  const changeRoleMutation = useChangeMemberRole();
  const leaveGroupMutation = useLeaveGroup();
  const addReactionMutation = useAddReaction();
  const renameMutation = useRenameGroup();
  const deleteForEveryoneMutation = useDeleteMessageForEveryone();
  const deleteForMeMutation = useDeleteMessageForMe();
  const togglePin = useTogglePin();
  const toggleMute = useToggleMute();
  const toggleArchive = useToggleArchive();
  const reportMutation = useReportMessage();
  const pinMessageMutation = usePinMessage();
  const unpinMessageMutation = useUnpinMessage();

  const activeMembers = activeGroup?.members ?? [];
  const canManage =
    isAdmin || activeMembers.some((m) => m._id === user?._id && m.role === "admin");

  // ── Socket room join / leave ─────────────────────────────────────────────
  useEffect(() => {
    if (!socket || activeGroupId === prevGroupRef.current) return;
    if (prevGroupRef.current) socket.emit("chat:leave", prevGroupRef.current);
    if (activeGroupId) socket.emit("chat:join", activeGroupId);
    prevGroupRef.current = activeGroupId;
    return () => {
      if (activeGroupId) socket.emit("chat:leave", activeGroupId);
    };
  }, [socket, activeGroupId]);

  // Re-join active room after socket reconnect
  useEffect(() => {
    if (!socket || !activeGroupId) return;
    const onReconnect = () => {
      socket.emit("chat:join", activeGroupId);
      qc.invalidateQueries({ queryKey: chatKeys.messages(activeGroupId) });
    };
    socket.on("connect", onReconnect);
    return () => {
      socket.off("connect", onReconnect);
    };
  }, [socket, activeGroupId, qc]);

  // Reset pagination on group switch
  useEffect(() => {
    setOlderPages([]);
    setOlderCursor(undefined);
    setLoadingOlder(false);
    setInChatSearch("");
  }, [activeGroupId]);

  // Mark group as read when open and focused
  useEffect(() => {
    if (isOpen && activeGroupId && activeGroup && (activeGroup.unreadCount ?? 0) > 0) {
      markReadMutation.mutate(activeGroupId);
    }
  }, [isOpen, activeGroupId, activeGroup?.unreadCount]);

  // ── Socket event listeners ───────────────────────────────────────────────
  useSocketEvent<ChatMessage>("chat:message", (msg) => {
    if (!msg.groupId) return;
    qc.setQueryData<{ messages: ChatMessage[]; nextCursor: string | null }>(
      chatKeys.messages(msg.groupId),
      (old) => {
        if (!old) return { messages: [msg], nextCursor: null };
        if (old.messages.some((m) => m._id === msg._id)) return old;
        return { ...old, messages: [...old.messages, msg] };
      },
    );
    qc.invalidateQueries({ queryKey: chatKeys.groups() });

    // If currently viewing this group in the open widget, immediately mark read
    if (isOpen && activeGroupId === msg.groupId && msg.sender?._id !== user?._id) {
      markReadMutation.mutate(msg.groupId);
    }
  });

  useSocketEvent<{ messageId: string; groupId: string; userId: string; deliveredAt: string }>(
    "message:delivered",
    (data) => {
      if (data.groupId !== activeGroupId) return;
      qc.setQueryData<{ messages: ChatMessage[]; nextCursor: string | null }>(
        chatKeys.messages(data.groupId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            messages: old.messages.map((m) =>
              m._id === data.messageId ? { ...m, deliveredAt: data.deliveredAt } : m,
            ),
          };
        },
      );
    },
  );

  useSocketEvent<{ messageId: string; groupId: string; userId: string; readAt: string }>(
    "message:read",
    (data) => {
      if (data.groupId !== activeGroupId) return;
      qc.setQueryData<{ messages: ChatMessage[]; nextCursor: string | null }>(
        chatKeys.messages(data.groupId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            messages: old.messages.map((m) =>
              m._id === data.messageId
                ? { ...m, readAt: data.readAt, readBy: [...(m.readBy ?? []), data.userId] }
                : m,
            ),
          };
        },
      );
      qc.invalidateQueries({ queryKey: chatKeys.groups() });
    },
  );

  useSocketEvent<{ groupId: string; messageId: string }>("chat:message-deleted", (data) => {
    qc.setQueryData<{ messages: ChatMessage[]; nextCursor: string | null }>(
      chatKeys.messages(data.groupId),
      (old) => {
        if (!old) return old;
        return { ...old, messages: old.messages.filter((m) => m._id !== data.messageId) };
      },
    );
    qc.invalidateQueries({ queryKey: chatKeys.groups() });
  });

  useSocketEvent<{ groupId: string }>("chat:group-updated", (data) => {
    qc.invalidateQueries({ queryKey: chatKeys.groups() });
    qc.invalidateQueries({ queryKey: chatKeys.members(data.groupId) });
  });

  useSocketEvent<{ groupId: string }>("chat:message-pinned", (data) => {
    qc.invalidateQueries({ queryKey: chatKeys.groups() });
    qc.invalidateQueries({ queryKey: chatKeys.messages(data.groupId) });
  });

  useSocketEvent<{ groupId: string }>("chat:message-unpinned", (data) => {
    qc.invalidateQueries({ queryKey: chatKeys.groups() });
    qc.invalidateQueries({ queryKey: chatKeys.messages(data.groupId) });
  });

  useSocketEvent<{ groupId: string }>("chat:messages-cleared", (data) => {
    qc.setQueryData<{ messages: ChatMessage[]; nextCursor: string | null }>(
      chatKeys.messages(data.groupId),
      { messages: [], nextCursor: null },
    );
    qc.invalidateQueries({ queryKey: chatKeys.messages(data.groupId) });
    qc.invalidateQueries({ queryKey: chatKeys.groups() });
  });

  useSocketEvent<{ groupId: string }>("chat:group-hidden", (data) => {
    if (activeGroupId === data.groupId) setActiveGroup(null);
    qc.invalidateQueries({ queryKey: chatKeys.groups() });
  });

  useSocketEvent<{ groupId: string }>("chat:group-deleted", (data) => {
    if (activeGroupId === data.groupId) setActiveGroup(null);
    qc.invalidateQueries({ queryKey: chatKeys.groups() });
  });

  useSocketEvent("chat:reaction", (data: { groupId?: string }) => {
    if (data.groupId) qc.invalidateQueries({ queryKey: chatKeys.messages(data.groupId) });
  });

  useSocketEvent<{ groupId: string; userId: string; userName: string }>("chat:typing", (data) => {
    if (data.groupId !== activeGroupId || data.userId === user?._id) return;
    setTypingUsers((prev) => new Map(prev).set(data.userId, data.userName));
  });

  useSocketEvent<{ groupId: string; userId: string }>("chat:stop-typing", (data) => {
    if (data.groupId !== activeGroupId) return;
    setTypingUsers((prev) => {
      const next = new Map(prev);
      next.delete(data.userId);
      return next;
    });
  });

  useSocketEvent<{ userId: string }>("user:offline", (data) => {
    setLastSeen((prev) => new Map(prev).set(data.userId, new Date().toISOString()));
  });

  // ── Typing helpers ───────────────────────────────────────────────────────
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendTyping = useCallback(() => {
    if (!socket || !activeGroupId) return;
    socket.emit("chat:typing", { groupId: activeGroupId });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("chat:stop-typing", { groupId: activeGroupId });
    }, 3000);
  }, [socket, activeGroupId]);

  const sendStopTyping = useCallback(() => {
    if (!socket || !activeGroupId) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socket.emit("chat:stop-typing", { groupId: activeGroupId });
  }, [socket, activeGroupId]);

  // ── Message sending & actions ────────────────────────────────────────────
  const handleSend = useCallback(
    (attachments?: { name: string; nasPath: string; size: string }[]) => {
      const text = chatInput.trim();
      const hasAttachments = attachments && attachments.length > 0;
      if ((!text && !hasAttachments) || !activeGroupId) return;
      sendStopTyping();
      const replyTo = replyingTo
        ? { messageId: replyingTo._id, text: replyingTo.text, senderName: replyingTo.sender.name }
        : undefined;

      const mentionedIds =
        activeGroup?.members
          ?.filter((m) => text.includes(`@${m.name}`))
          ?.map((m) => m._id) ?? [];

      const sendPayload: {
        groupId: string;
        text?: string;
        mentions?: string[];
        replyTo?: { messageId: string; text: string; senderName: string };
        attachments?: { name: string; nasPath: string; size: string }[];
      } = {
        groupId: activeGroupId,
        text,
      };
      if (attachments && attachments.length > 0) sendPayload.attachments = attachments;
      if (mentionedIds.length > 0) sendPayload.mentions = mentionedIds;
      if (replyTo) sendPayload.replyTo = replyTo;

      sendMutation.mutate(sendPayload, {
        onSuccess: () => {
          setChatInput("");
          setReplyingTo(null);
        },
      });
    },
    [chatInput, activeGroupId, replyingTo, activeGroup, sendMutation, sendStopTyping],
  );

  const handleLoadOlder = async () => {
    if (!activeGroupId || loadingOlder || !effectiveCursor) return;
    setLoadingOlder(true);
    try {
      const res = await fetchOlderMessages(activeGroupId, effectiveCursor);
      setOlderPages((prev) => [res.messages, ...prev]);
      setOlderCursor(res.nextCursor);
    } catch {
      /* ignore */
    } finally {
      setLoadingOlder(false);
    }
  };

  const handleSelectGroup = (id: string | null) => {
    setActiveGroup(id);
    if (id) {
      markReadMutation.mutate(id);
    }
  };

  const handleCreateGroup = (name: string, memberIds: string[]) => {
    createGroupMutation.mutate(
      { name, memberIds },
      {
        onSuccess: (data) => {
          setActiveGroup(data.group._id);
          setShowCreateGroup(false);
        },
      },
    );
  };

  const handleStartDirectChat = (targetUserId: string) => {
    createDirectChatMutation.mutate(
      { userId: targetUserId },
      {
        onSuccess: (data) => {
          setActiveGroup(data.group._id);
          setShowNewChat(false);
        },
      },
    );
  };

  const handleClearChat = (groupId: string) => {
    clearChatMutation.mutate(groupId, {
      onSuccess: () => toast.success("Messages cleared"),
    });
  };

  const handleDeleteChat = (groupId: string) => {
    deleteChatForMeMutation.mutate(groupId, {
      onSuccess: () => {
        if (activeGroupId === groupId) setActiveGroup(null);
        toast.success("Chat deleted from your conversation list");
      },
    });
  };

  const handleLeaveGroup = (groupId?: string) => {
    const targetId = groupId || activeGroupId;
    if (!targetId) return;
    leaveGroupMutation.mutate(targetId, {
      onSuccess: () => {
        if (activeGroupId === targetId) setActiveGroup(null);
        toast.success("Left group successfully");
      },
    });
  };

  const handleDeleteGroup = (groupId?: string) => {
    const targetId = groupId || activeGroupId;
    if (!targetId) return;
    deleteGroupMutation.mutate(targetId, {
      onSuccess: () => {
        if (activeGroupId === targetId) setActiveGroup(null);
        setDeleteConfirmOpen(false);
        toast.success("Group deleted successfully");
      },
    });
  };

  const searchMatchesCount = inChatSearch.trim()
    ? allMessages.filter((m) =>
        m.text?.toLowerCase().includes(inChatSearch.trim().toLowerCase()),
      ).length
    : 0;

  // Navigate to full-page chat if user chooses to pop out
  const handleOpenFullPage = () => {
    close();
    navigate({
      to: "/chat",
      search: activeGroupId ? { groupId: activeGroupId } : {},
    });
  };

  if (!isChatEnabled) return null;

  return (
    <>
      {/* ============================================================== */}
      {/* FLOATING CHAT LAUNCHER BUTTON                                  */}
      {/* ============================================================== */}
      <div className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-40 print:hidden select-none">
        <button
          type="button"
          onClick={toggle}
          aria-label={isOpen ? "Close LegalOS Chat" : "Open LegalOS Team Chat"}
          aria-expanded={isOpen}
          title={isOpen ? "Close Chat" : "Team Chat"}
          className={`group relative flex size-13 lg:size-14 items-center justify-center rounded-full gradient-primary text-primary-foreground shadow-xl shadow-primary/25 transition-all duration-200 hover:scale-105 hover:shadow-2xl hover:shadow-primary/35 active:scale-95 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/40 ${
            isOpen ? "ring-2 ring-primary-foreground/30" : ""
          }`}
        >
          {/* Animated subtle ripple when unread > 0 and closed */}
          {!isOpen && totalUnread > 0 && (
            <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-25 pointer-events-none" />
          )}

          {isOpen ? (
            <X size={24} strokeWidth={2.2} className="transition-transform duration-200 group-hover:rotate-90" />
          ) : (
            <MessageSquare size={24} strokeWidth={2.2} className="transition-transform duration-200" />
          )}

          {/* Unread Message Badge */}
          {!isOpen && totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 flex min-w-5 h-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-bold text-destructive-foreground shadow-sm ring-2 ring-background animate-in zoom-in-75">
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}
        </button>
      </div>

      {/* ============================================================== */}
      {/* FLOATING CHAT PANEL (Responsive Drawer / Card)                */}
      {/* ============================================================== */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Team Chat Window"
          aria-modal="false"
          className={`fixed z-50 overflow-hidden bg-card border border-border/80 shadow-2xl flex flex-col transition-all duration-200 animate-in fade-in-0 zoom-in-95 ${
            isExpanded
              ? "inset-0 sm:inset-auto sm:bottom-22 sm:right-6 sm:w-[780px] sm:h-[640px] sm:max-h-[calc(100vh-7rem)] sm:rounded-2xl"
              : "inset-0 sm:inset-auto sm:bottom-22 sm:right-6 sm:w-[420px] sm:h-[600px] sm:max-h-[calc(100vh-7rem)] sm:rounded-2xl"
          }`}
        >
          {/* ── Widget Window Control Header ──────────────────────────── */}
          <div className="flex items-center justify-between border-b border-border/70 bg-muted/40 px-3 py-2 text-xs select-none">
            <div className="flex items-center gap-2 min-w-0">
              <span className="grid size-6 place-items-center rounded-md bg-primary/10 text-primary">
                <MessageSquare size={13} strokeWidth={2.2} />
              </span>
              <span className="font-semibold text-foreground truncate text-xs">
                LegalOS Team Chat
              </span>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground ml-1">
                {connStatus === "connected" ? (
                  <Wifi size={11} className="text-emerald-500" />
                ) : (
                  <WifiOff size={11} className="text-amber-500" />
                )}
                <span className="hidden sm:inline">
                  {connStatus === "connected" ? "Connected" : "Reconnecting"}
                </span>
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* Pop out to full page */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleOpenFullPage}
                className="size-7 rounded-md text-muted-foreground hover:text-foreground"
                title="Open in full screen page"
                aria-label="Open full page chat"
              >
                <ExternalLink size={13} />
              </Button>

              {/* Desktop Expand / Narrow width toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setExpanded(!isExpanded)}
                className="size-7 rounded-md text-muted-foreground hover:text-foreground hidden sm:flex"
                title={isExpanded ? "Compact view" : "Split conversation view"}
                aria-label={isExpanded ? "Collapse to compact" : "Expand to split view"}
              >
                {isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </Button>

              {/* Minimize / Close */}
              <Button
                variant="ghost"
                size="icon"
                onClick={close}
                className="size-7 rounded-md text-muted-foreground hover:text-foreground"
                title="Minimize chat"
                aria-label="Minimize chat widget"
              >
                <Minus size={13} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={close}
                className="size-7 rounded-md text-muted-foreground hover:text-destructive"
                title="Close chat"
                aria-label="Close chat widget"
              >
                <X size={14} />
              </Button>
            </div>
          </div>

          {/* ── Widget Body: Split or Single Column ───────────────────── */}
          <div className="flex flex-1 min-h-0 overflow-hidden relative">
            {/* Left Column: Conversation List Sidebar */}
            <div
              className={`${
                isExpanded
                  ? "w-[280px] lg:w-[300px] border-r border-border/70 flex flex-col"
                  : activeGroupId
                  ? "hidden"
                  : "flex flex-1 flex-col"
              } bg-card overflow-hidden`}
            >
              <ChatSidebar
                groups={groups}
                activeGroupId={activeGroupId}
                currentUserId={user?._id ?? ""}
                onlineIds={onlineIds}
                search={searchConv}
                onSearchChange={setSearchConv}
                isAdmin={isAdmin}
                onSelect={handleSelectGroup}
                onNewGroup={() => setShowCreateGroup(true)}
                onNewChat={() => setShowNewChat(true)}
                users={allUsers}
                onStartDirectChat={handleStartDirectChat}
                isCreatingDirectChat={createDirectChatMutation.isPending}
                onTogglePin={(id, pinned) => togglePin.mutate({ groupId: id, pinned })}
                onToggleMute={(id, muted) => toggleMute.mutate({ groupId: id, muted })}
                onToggleArchive={(id, archived) => toggleArchive.mutate({ groupId: id, archived })}
                onMarkRead={(id) => markReadMutation.mutate(id)}
                onMarkUnread={(id) => markUnreadMutation.mutate(id)}
                onClearChat={(id) => handleClearChat(id)}
                onDeleteChat={(id) => handleDeleteChat(id)}
                onLeaveGroup={(id) => handleLeaveGroup(id)}
                onDeleteGroup={(id) => handleDeleteGroup(id)}
              />
            </div>

            {/* Right Column: Active Conversation (or empty placeholder if split view) */}
            <div
              className={`${
                isExpanded
                  ? "flex flex-1 flex-col min-w-0"
                  : activeGroupId
                  ? "flex flex-1 flex-col min-w-0"
                  : "hidden"
              } bg-card overflow-hidden`}
            >
              {activeGroup ? (
                <>
                  <ChatHeader
                    group={activeGroup}
                    currentUserId={user?._id ?? ""}
                    onlineIds={onlineIds}
                    lastSeen={lastSeen}
                    onOpenInfo={() => setShowGroupInfo(true)}
                    onTogglePin={() => togglePin.mutate({ groupId: activeGroup._id, pinned: !activeGroup.pinned })}
                    onToggleMute={() => toggleMute.mutate({ groupId: activeGroup._id, muted: !activeGroup.muted })}
                    onToggleArchive={() => toggleArchive.mutate({ groupId: activeGroup._id, archived: !activeGroup.archived })}
                    isAdmin={isAdmin}
                    canManage={canManage}
                    onDeleteGroup={() => setDeleteConfirmOpen(true)}
                    onDeleteChat={() => handleDeleteChat(activeGroup._id)}
                    onClearChat={() => handleClearChat(activeGroup._id)}
                    onLeaveGroup={() => handleLeaveGroup(activeGroup._id)}
                    onBack={() => setActiveGroup(null)}
                    showBackOnDesktop={!isExpanded}
                    searchQuery={inChatSearch}
                    onSearchChange={setInChatSearch}
                    matchCount={searchMatchesCount}
                    onJumpToMessage={(messageId) => {
                      const el = document.getElementById(`msg-${messageId}`);
                      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                      else toast.info("Message is in earlier history.");
                    }}
                    onUnpinMessage={() => unpinMessageMutation.mutate({ groupId: activeGroup._id })}
                  />

                  <MessageList
                    messages={allMessages}
                    currentUserId={user?._id ?? ""}
                    groupMembers={activeMembers}
                    isAdmin={isAdmin}
                    isLoading={messagesLoading}
                    hasOlder={hasOlder}
                    loadingOlder={loadingOlder}
                    onLoadOlder={handleLoadOlder}
                    emptyText={
                      activeGroup.type === "group"
                        ? "No messages yet. Start the conversation."
                        : "Send a message to start chatting."
                    }
                    onReply={(msg) => {
                      setReplyingTo(msg);
                      inputRef.current?.focus();
                    }}
                    onCopy={(msg) => {
                      navigator.clipboard?.writeText(msg.text).then(() => toast.success("Copied"));
                    }}
                    onForward={(msg) => {
                      setForwardMessage(msg);
                      setShowForward(true);
                    }}
                    onDeleteForMe={(msg) => {
                      deleteForMeMutation.mutate({ groupId: activeGroup._id, messageId: msg._id });
                    }}
                    onDeleteForEveryone={(msg) => {
                      deleteForEveryoneMutation.mutate({ groupId: activeGroup._id, messageId: msg._id });
                    }}
                    onReport={(msg) => {
                      reportMutation.mutate({ groupId: activeGroup._id, messageId: msg._id }, {
                        onSuccess: () => toast.success("Message reported to admins"),
                      });
                    }}
                    onToggleReaction={(msg, emoji) => {
                      addReactionMutation.mutate({ groupId: activeGroup._id, messageId: msg._id, emoji });
                    }}
                    searchQuery={inChatSearch}
                    onCaseClick={(caseNum) => {
                      close();
                      navigate({ to: "/clients", search: { search: caseNum } as any });
                    }}
                    onPinNotice={(msg) => {
                      pinMessageMutation.mutate({ groupId: activeGroup._id, messageId: msg._id });
                    }}
                  />

                  <MessageComposer
                    groupId={activeGroup._id}
                    value={chatInput}
                    onChange={setChatInput}
                    onSend={handleSend}
                    isSending={sendMutation.isPending}
                    replyTo={replyingTo}
                    onCancelReply={() => setReplyingTo(null)}
                    typingNames={Array.from(typingUsers.values())}
                    onTyping={sendTyping}
                    inputRef={inputRef}
                    members={activeMembers}
                  />
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center p-8 text-center bg-muted/20">
                  <div className="size-16 rounded-full bg-primary/10 grid place-items-center mb-3 text-primary">
                    <MessageSquare size={32} strokeWidth={1.5} />
                  </div>
                  <h4 className="font-semibold text-foreground text-sm">Select a Conversation</h4>
                  <p className="mt-1 text-xs text-muted-foreground max-w-xs">
                    Choose a colleague or team group from the list to start messaging.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Dialogs ─────────────────────────────────────────────────── */}
      <CreateGroupDialog
        open={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        users={allUsers}
        currentUserId={user?._id ?? ""}
        isCreating={createGroupMutation.isPending}
        onCreate={handleCreateGroup}
      />
      <NewChatDialog
        open={showNewChat}
        onClose={() => setShowNewChat(false)}
        users={allUsers}
        currentUserId={user?._id ?? ""}
        isCreating={createDirectChatMutation.isPending}
        onStartChat={handleStartDirectChat}
      />
      {activeGroup && (
        <>
          <AddMembersDialog
            open={showAddMembers}
            onClose={() => setShowAddMembers(false)}
            users={allUsers}
            existingMemberIds={activeMembers.map((m) => m._id)}
            isAdding={addMembersMutation.isPending}
            onAdd={(memberIds) => {
              addMembersMutation.mutate(
                { groupId: activeGroup._id, memberIds },
                { onSuccess: () => setShowAddMembers(false) },
              );
            }}
          />
          <GroupInfoSheet
            open={showGroupInfo}
            onClose={() => setShowGroupInfo(false)}
            group={activeGroup}
            currentUserId={user?._id ?? ""}
            isAdmin={isAdmin}
            canManage={canManage}
            onlineIds={onlineIds}
            lastSeen={lastSeen}
            onAddMembers={() => setShowAddMembers(true)}
            onRemoveMember={(memberId) => {
              removeMemberMutation.mutate({ groupId: activeGroup._id, memberId });
            }}
            onChangeRole={(memberId, role) => {
              changeRoleMutation.mutate({ groupId: activeGroup._id, memberId, role });
            }}
            onLeaveGroup={() => handleLeaveGroup(activeGroup._id)}
            onDeleteGroup={() => setDeleteConfirmOpen(true)}
            onRenameGroup={(name) => {
              renameMutation.mutate({ groupId: activeGroup._id, name });
            }}
          />
        </>
      )}
      <ForwardDialog
        open={showForward}
        onClose={() => {
          setShowForward(false);
          setForwardMessage(null);
        }}
        groups={groups}
        onForward={(targetGroupId) => {
          if (!forwardMessage) return;
          sendMutation.mutate({ groupId: targetGroupId, text: forwardMessage.text });
          setShowForward(false);
          setForwardMessage(null);
          toast.success("Message forwarded");
        }}
      />
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this group? All messages and attachments will be permanently removed for all members.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDeleteGroup(activeGroup?._id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Group
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
