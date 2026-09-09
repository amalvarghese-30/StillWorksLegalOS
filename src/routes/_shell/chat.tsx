import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, AlertTriangle, Wifi, WifiOff, Lock, MessageSquare, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Toaster } from "@/components/ui/sonner";
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
import { useAuth } from "@/lib/auth";
import { useSocket, useSocketEvent } from "@/lib/socket";
import {
  useChatGroups,
  useChatMessages,
  useSendMessage,
  useCreateGroup,
  useCreateDirectChat,
  useDeleteGroup,
  useMarkRead,
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

export const Route = createFileRoute("/_shell/chat")({
  head: () => ({
    meta: [
      { title: "Chat · StillWorks LegalOS" },
      { name: "description", content: "Private, WhatsApp-style team messaging for the firm." },
      { property: "og:title", content: "Chat · StillWorks LegalOS" },
      { property: "og:description", content: "Private team messaging for the firm, without the noise." },
    ],
  }),
  validateSearch: (search) => ({
    groupId: search["groupId"] as string | undefined,
  }),
  component: ChatPage,
});

function ChatPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { socket, status: connStatus } = useSocket();
  const search = Route.useSearch();

  const navigate = useNavigate();
  const [activeGroupId, setActiveGroupId] = useState<string | null>(search["groupId"] ?? null);
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
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [lastSeen, setLastSeen] = useState<Map<string, string>>(new Map());
  const [olderPages, setOlderPages] = useState<ChatMessage[][]>([]);
  const [olderCursor, setOlderCursor] = useState<string | null | undefined>(undefined);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevGroupRef = useRef<string | null>(null);
  const seededPresence = useRef(false);

  const isAdmin = user?.role === "admin";

  // ── Data ─────────────────────────────────────────────────────────────────
  const { data: groupsData, isLoading: groupsLoading, isError: groupsError } = useChatGroups();
  const groups: ChatGroup[] = groupsData?.groups ?? [];
  const activeGroup = groups.find((g) => g._id === activeGroupId) ?? null;

  const { data: messagesData, isLoading: messagesLoading } = useChatMessages(activeGroupId ?? undefined);
  const latestMessages = messagesData?.messages ?? [];
  const allMessages = [...olderPages.flat(), ...latestMessages];
  const effectiveCursor =
    olderCursor === undefined ? (messagesData?.nextCursor ?? null) : olderCursor;
  const hasOlder = !!effectiveCursor;

  const { data: usersData } = useChatUsers();
  const allUsers: UserForContact[] = usersData?.users ?? [];

  // ── Mutations ────────────────────────────────────────────────────────────
  const sendMutation = useSendMessage();
  const createGroupMutation = useCreateGroup();
  const createDirectChatMutation = useCreateDirectChat();
  const deleteGroupMutation = useDeleteGroup();
  const markReadMutation = useMarkRead();
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

  // ── Socket: join / leave chat rooms ──────────────────────────────────────
  useEffect(() => {
    if (!socket || activeGroupId === prevGroupRef.current) return;
    if (prevGroupRef.current) socket.emit("chat:leave", prevGroupRef.current);
    socket.emit("chat:join", activeGroupId);
    prevGroupRef.current = activeGroupId;
    return () => {
      if (activeGroupId) socket.emit("chat:leave", activeGroupId);
    };
  }, [socket, activeGroupId]);

  // Re-join the active room after a reconnect and refetch messages to catch
  // anything broadcast while disconnected (replaces aggressive polling).
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

  // Reset pagination and in-chat search when switching conversations.
  useEffect(() => {
    setOlderPages([]);
    setOlderCursor(undefined);
    setLoadingOlder(false);
    setInChatSearch("");
  }, [activeGroupId]);

  const handleLoadOlder = async () => {
    if (!activeGroupId || loadingOlder) return;
    if (!effectiveCursor) return;
    setLoadingOlder(true);
    try {
      const res = await fetchOlderMessages(activeGroupId, effectiveCursor);
      setOlderPages((prev) => [res.messages, ...prev]);
      setOlderCursor(res.nextCursor);
    } catch {
      /* ignore — user can retry */
    } finally {
      setLoadingOlder(false);
    }
  };

  // ── Socket: incoming messages ────────────────────────────────────────────
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
  });

  // ── Socket: message delivered ────────────────────────────────────────────
  useSocketEvent<{
    messageId: string;
    groupId: string;
    userId: string;
    deliveredAt: string;
  }>("message:delivered", (data) => {
    if (data.groupId !== activeGroupId) return;
    qc.setQueryData<{ messages: ChatMessage[]; nextCursor: string | null }>(
      chatKeys.messages(data.groupId),
      (old) => {
        if (!old) return old;
        return {
          ...old,
          messages: old.messages.map((msg) =>
            msg._id === data.messageId
              ? { ...msg, deliveredAt: data.deliveredAt }
              : msg
          ),
        };
      },
    );
  });

  // ── Socket: message read ───────────────────────────────────────────────
  useSocketEvent<{
    messageId: string;
    groupId: string;
    userId: string;
    readAt: string;
  }>("message:read", (data) => {
    if (data.groupId !== activeGroupId) return;
    qc.setQueryData<{ messages: ChatMessage[]; nextCursor: string | null }>(
      chatKeys.messages(data.groupId),
      (old) => {
        if (!old) return old;
        return {
          ...old,
          messages: old.messages.map((msg) =>
            msg._id === data.messageId
              ? { ...msg, readAt: data.readAt, readBy: [...(msg.readBy ?? []), data.userId] }
              : msg
          ),
        };
      },
    );
    qc.invalidateQueries({ queryKey: chatKeys.groups() });
  });

  // ── Socket: message deleted for everyone ─────────────────────────────────
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

  // ── Socket: group mutations (rename, add/remove member, role) ────────────
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

  // ── Socket: reactions ────────────────────────────────────────────────────
  useSocketEvent("chat:reaction", (data: { groupId?: string }) => {
    if (data.groupId) qc.invalidateQueries({ queryKey: chatKeys.messages(data.groupId) });
  });

  // ── Socket: typing indicators ────────────────────────────────────────────
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

  // ── Socket: presence ─────────────────────────────────────────────────────
  useSocketEvent<{ userId: string }>("user:online", (data) => {
    setOnlineIds((prev) => new Set(prev).add(data.userId));
  });

  useSocketEvent<{ userId: string }>("user:offline", (data) => {
    setOnlineIds((prev) => {
      const next = new Set(prev);
      next.delete(data.userId);
      return next;
    });
    setLastSeen((prev) => new Map(prev).set(data.userId, new Date().toISOString()));
  });

  // Seed presence from the first data load
  useEffect(() => {
    if (seededPresence.current) return;
    if (groups.length === 0 && allUsers.length === 0) return;
    const ids = new Set<string>();
    groups.forEach((g) => g.members.forEach((m) => { if (m.online) ids.add(m._id); }));
    allUsers.forEach((u) => { if (u.status === "online") ids.add(u._id); });
    setOnlineIds(ids);
    seededPresence.current = true;
  }, [groups, allUsers]);

  // Auto-select the first group once on initial load so the desktop pane isn't
  // empty. A ref (not the activeGroupId dep) ensures an explicit "back to list"
  // on mobile isn't immediately undone by re-selecting the first group.
  const autoSelected = useRef(false);
  useEffect(() => {
    if (autoSelected.current || groups.length === 0) return;
    setActiveGroupId((prev) => prev ?? groups[0]!._id);
    autoSelected.current = true;
  }, [groups]);

  // Mark read when switching groups
  useEffect(() => {
    if (activeGroupId && activeGroup && (activeGroup.unread ?? 0) > 0) {
      markReadMutation.mutate(activeGroupId);
    }
  }, [activeGroupId]);

  // Focus input when switching groups
  useEffect(() => {
    inputRef.current?.focus();
  }, [activeGroupId]);

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

  // ── Message actions ──────────────────────────────────────────────────────
  const handleSend = useCallback(
    (attachments?: { name: string; nasPath: string; size: string }[]) => {
      const text = chatInput.trim();
      const hasAttachments = attachments && attachments.length > 0;
      if ((!text && !hasAttachments) || !activeGroupId) return;
      sendStopTyping();
      const replyTo = replyingTo
        ? { messageId: replyingTo._id, text: replyingTo.text, senderName: replyingTo.sender.name }
        : undefined;

      // Extract mentions if any member's name is tagged with @
      const mentionedIds = activeGroup?.members
        ?.filter((m) => text.includes(`@${m.name}`))
        ?.map((m) => m._id) ?? [];

      sendMutation.mutate(
        {
          groupId: activeGroupId,
          text,
          attachments,
          mentions: mentionedIds.length > 0 ? mentionedIds : undefined,
          ...(replyTo ? { replyTo } : {}),
        },
        {
          onSuccess: () => {
            setChatInput("");
            setReplyingTo(null);
          },
        },
      );
    },
    [chatInput, activeGroupId, replyingTo, activeGroup, sendMutation, sendStopTyping],
  );

  const handleReply = (msg: ChatMessage) => {
    setReplyingTo(msg);
    inputRef.current?.focus();
  };

  const handleCopy = (msg: ChatMessage) => {
    navigator.clipboard?.writeText(msg.text).then(() => toast.success("Copied"));
  };

  const handleForward = (msg: ChatMessage) => {
    setForwardMessage(msg);
    setShowForward(true);
  };

  const handleForwardSubmit = (targetGroupId: string) => {
    if (!forwardMessage) return;
    sendMutation.mutate({ groupId: targetGroupId, text: forwardMessage.text });
    setShowForward(false);
    setForwardMessage(null);
  };

  const handleDeleteForMe = (msg: ChatMessage) => {
    if (!activeGroupId) return;
    deleteForMeMutation.mutate({ groupId: activeGroupId, messageId: msg._id });
  };

  const handleDeleteForEveryone = (msg: ChatMessage) => {
    if (!activeGroupId) return;
    deleteForEveryoneMutation.mutate({ groupId: activeGroupId, messageId: msg._id });
  };

  const handleReport = (msg: ChatMessage) => {
    if (!activeGroupId) return;
    reportMutation.mutate(
      { groupId: activeGroupId, messageId: msg._id },
      {
        onSuccess: () => toast.success("Message reported to admins"),
        onError: () => toast.error("Could not report message. Please try again."),
      },
    );
  };

  const handleToggleReaction = (msg: ChatMessage, emoji: string) => {
    if (!activeGroupId) return;
    addReactionMutation.mutate({ groupId: activeGroupId, messageId: msg._id, emoji });
  };

  const handlePinNotice = (msg: ChatMessage) => {
    if (!activeGroupId) return;
    pinMessageMutation.mutate({ groupId: activeGroupId, messageId: msg._id });
  };

  const handleUnpinNotice = () => {
    if (!activeGroupId) return;
    unpinMessageMutation.mutate({ groupId: activeGroupId });
  };

  const handleJumpToMessage = (messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary", "rounded-lg", "transition-all", "duration-500");
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-primary", "rounded-lg", "transition-all", "duration-500");
      }, 2000);
    } else {
      toast.info("Message is in earlier history. Scroll up to load older messages.");
    }
  };

  const handleCaseClick = (caseNum: string) => {
    navigate({ to: "/cases", search: { search: caseNum } as any });
  };

  const searchMatchesCount = inChatSearch.trim()
    ? allMessages.filter((m) => m.text?.toLowerCase().includes(inChatSearch.trim().toLowerCase())).length
    : 0;

  // ── Group actions ────────────────────────────────────────────────────────
  const handleCreateGroup = (name: string, memberIds: string[]) => {
    createGroupMutation.mutate(
      { name, memberIds },
      {
        onSuccess: (data) => {
          setActiveGroupId(data.group._id);
          setShowCreateGroup(false);
        },
      },
    );
  };

  const handleStartDirectChat = (userId: string) => {
    createDirectChatMutation.mutate(
      { userId },
      {
        onSuccess: (data) => {
          setActiveGroupId(data.group._id);
          setShowNewChat(false);
        },
      },
    );
  };

  const handleAddMembers = (memberIds: string[]) => {
    if (!activeGroupId) return;
    addMembersMutation.mutate(
      { groupId: activeGroupId, memberIds },
      { onSuccess: () => setShowAddMembers(false) },
    );
  };

  const handleRemoveMember = (userId: string) => {
    if (!activeGroupId) return;
    removeMemberMutation.mutate({ groupId: activeGroupId, userId });
  };

  const handleChangeRole = (userId: string, role: "admin" | "member") => {
    if (!activeGroupId) return;
    changeRoleMutation.mutate({ groupId: activeGroupId, userId, role });
  };

  const handleLeaveGroup = () => {
    if (!activeGroupId) return;
    leaveGroupMutation.mutate(activeGroupId, {
      onSuccess: () => setActiveGroupId(null),
    });
  };

  const handleRename = (name: string) => {
    if (!activeGroupId) return;
    renameMutation.mutate({ groupId: activeGroupId, name });
  };

  const handleTogglePin = () => {
    if (!activeGroup) return;
    togglePin.mutate({ groupId: activeGroup._id, pinned: activeGroup.isPinned });
  };
  const handleToggleMute = () => {
    if (!activeGroup) return;
    toggleMute.mutate({ groupId: activeGroup._id, muted: activeGroup.isMuted });
  };
  const handleToggleArchive = () => {
    if (!activeGroup) return;
    toggleArchive.mutate({ groupId: activeGroup._id, archived: activeGroup.isArchived });
  };

  const handleDeleteGroup = () => {
    if (!activeGroupId) return;
    deleteGroupMutation.mutate(activeGroupId, {
      onSuccess: () => {
        setActiveGroupId(null);
        setDeleteConfirmOpen(false);
      },
    });
  };

  const canManage = isAdmin || activeMembers.some((m) => m._id === user?._id && m.role === "admin");

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      <Toaster position="top-right" richColors />
      <PageHeader
        breadcrumb={[{ label: "StillWorks", to: "/" }, { label: "Chat" }]}
        title="Chat"
        subtitle="Private, encrypted messaging for the firm."
        actions={
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-caption">
              {connStatus === "connected" ? (
                <Wifi size={14} strokeWidth={1.75} className="text-success" />
              ) : connStatus === "connecting" ? (
                <Loader2 size={14} strokeWidth={1.75} className="animate-spin text-muted-foreground" />
              ) : (
                <WifiOff size={14} strokeWidth={1.75} className="text-muted-foreground" />
              )}
              <span className={connStatus === "connected" ? "text-success" : "text-muted-foreground"}>
                {connStatus === "connected" ? "Live" : connStatus === "connecting" ? "Connecting…" : "Offline"}
              </span>
            </span>
            <div className="flex items-center gap-2 text-caption text-muted-foreground">
              <Lock size={14} strokeWidth={1.75} />
              <span>E2E Encrypted</span>
            </div>
          </div>
        }
      />

      {groupsLoading && (
        <div className="rounded-lg border border-border bg-card p-8 shadow-soft animate-pulse">
          <div className="flex items-center justify-center gap-3">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
            <span className="text-helper text-muted-foreground">Loading conversations…</span>
          </div>
        </div>
      )}

      {groupsError && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-12 text-center">
          <AlertTriangle size={28} className="text-destructive" />
          <p className="font-medium">Failed to load chat</p>
          <p className="text-helper text-muted-foreground">Check that the server is running.</p>
        </div>
      )}

      {!groupsLoading && !groupsError && (
        <div className="grid h-[calc(100dvh-5.5rem)] min-h-[480px] overflow-hidden rounded-lg border border-border bg-card shadow-soft sm:h-[calc(100vh-7.5rem)] sm:min-h-[540px] lg:grid-cols-[340px_minmax(0,1fr)]">
          <div className={`${activeGroupId ? "hidden lg:block" : "block"} min-h-0 min-w-0`}>
            <ChatSidebar
              groups={groups}
              activeGroupId={activeGroupId}
              currentUserId={user?._id ?? ""}
              onlineIds={onlineIds}
              search={searchConv}
              onSearchChange={setSearchConv}
              isAdmin={isAdmin}
              onSelect={setActiveGroupId}
              onNewGroup={() => setShowCreateGroup(true)}
              onNewChat={() => setShowNewChat(true)}
              users={allUsers}
              onStartDirectChat={handleStartDirectChat}
              isCreatingDirectChat={createDirectChatMutation.isPending}
            />
          </div>

          <section className={`${activeGroupId ? "flex" : "hidden lg:flex"} min-h-0 min-w-0 flex-col`}>
            {!activeGroup ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-center">
                  <MessageSquare size={40} strokeWidth={1} className="mx-auto text-muted-foreground/30" />
                  <p className="mt-3 text-helper text-muted-foreground">Select a conversation</p>
                </div>
              </div>
            ) : (
              <>
                <ChatHeader
                  group={activeGroup}
                  currentUserId={user?._id ?? ""}
                  onlineIds={onlineIds}
                  lastSeen={lastSeen}
                  onOpenInfo={() => setShowGroupInfo(true)}
                  onTogglePin={handleTogglePin}
                  onToggleMute={handleToggleMute}
                  onToggleArchive={handleToggleArchive}
                  isAdmin={isAdmin}
                  onDeleteGroup={() => setDeleteConfirmOpen(true)}
                  onBack={() => setActiveGroupId(null)}
                  searchQuery={inChatSearch}
                  onSearchChange={setInChatSearch}
                  matchCount={searchMatchesCount}
                  onJumpToMessage={handleJumpToMessage}
                  onUnpinMessage={handleUnpinNotice}
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
                  onReply={handleReply}
                  onCopy={handleCopy}
                  onForward={handleForward}
                  onDeleteForMe={handleDeleteForMe}
                  onDeleteForEveryone={handleDeleteForEveryone}
                  onReport={handleReport}
                  onToggleReaction={handleToggleReaction}
                  searchQuery={inChatSearch}
                  onCaseClick={handleCaseClick}
                  onPinNotice={handlePinNotice}
                />
                <MessageComposer
                  groupId={activeGroupId ?? ""}
                  value={chatInput}
                  onChange={setChatInput}
                  onSend={handleSend}
                  isSending={sendMutation.isPending}
                  replyTo={replyingTo}
                  onCancelReply={() => setReplyingTo(null)}
                  typingNames={Array.from(typingUsers.values())}
                  onTyping={sendTyping}
                  inputRef={inputRef}
                />
              </>
            )}
          </section>
        </div>
      )}

      {/* Dialogs */}
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
      <AddMembersDialog
        open={showAddMembers}
        onClose={() => setShowAddMembers(false)}
        users={allUsers}
        existingMemberIds={activeMembers.map((m) => m._id)}
        isAdding={addMembersMutation.isPending}
        onAdd={handleAddMembers}
      />
      <ForwardDialog
        open={showForward}
        onClose={() => setShowForward(false)}
        groups={groups}
        currentUserId={user?._id ?? ""}
        message={forwardMessage}
        onForward={handleForwardSubmit}
      />
      <GroupInfoSheet
        open={showGroupInfo}
        onClose={() => setShowGroupInfo(false)}
        group={activeGroup}
        members={activeMembers}
        currentUserId={user?._id ?? ""}
        canManage={canManage}
        onlineIds={onlineIds}
        onRename={handleRename}
        onAddMembers={() => setShowAddMembers(true)}
        onChangeRole={handleChangeRole}
        onRemoveMember={handleRemoveMember}
        onLeave={handleLeaveGroup}
        isLeaving={leaveGroupMutation.isPending}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete group?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes “{activeGroup?.name}” and all its messages for everyone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDeleteGroup}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}