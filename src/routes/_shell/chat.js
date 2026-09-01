import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, AlertTriangle, Wifi, WifiOff, Lock, MessageSquare, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Toaster } from "@/components/ui/sonner";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction, } from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth";
import { useSocket, useSocketEvent } from "@/lib/socket";
import { useChatGroups, useChatMessages, useSendMessage, useCreateGroup, useCreateDirectChat, useDeleteGroup, useMarkRead, useChatUsers, useAddGroupMembers, useRemoveGroupMember, useChangeMemberRole, useLeaveGroup, useAddReaction, useRenameGroup, useDeleteMessageForEveryone, useDeleteMessageForMe, useTogglePin, useToggleMute, useToggleArchive, useReportMessage, chatKeys, fetchOlderMessages, } from "@/services/chat";
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
        groupId: search["groupId"],
    }),
    component: ChatPage,
});
function ChatPage() {
    const { user } = useAuth();
    const qc = useQueryClient();
    const { socket, status: connStatus } = useSocket();
    const search = Route.useSearch();
    const [activeGroupId, setActiveGroupId] = useState(search["groupId"] ?? null);
    const [searchConv, setSearchConv] = useState("");
    const [chatInput, setChatInput] = useState("");
    const [replyingTo, setReplyingTo] = useState(null);
    const [forwardMessage, setForwardMessage] = useState(null);
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [showNewChat, setShowNewChat] = useState(false);
    const [showGroupInfo, setShowGroupInfo] = useState(false);
    const [showAddMembers, setShowAddMembers] = useState(false);
    const [showForward, setShowForward] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [typingUsers, setTypingUsers] = useState(new Map());
    const [onlineIds, setOnlineIds] = useState(new Set());
    const [lastSeen, setLastSeen] = useState(new Map());
    const [olderPages, setOlderPages] = useState([]);
    const [olderCursor, setOlderCursor] = useState(undefined);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const inputRef = useRef(null);
    const prevGroupRef = useRef(null);
    const seededPresence = useRef(false);
    const isAdmin = user?.role === "admin";
    // ── Data ─────────────────────────────────────────────────────────────────
    const { data: groupsData, isLoading: groupsLoading, isError: groupsError } = useChatGroups();
    const groups = groupsData?.groups ?? [];
    const activeGroup = groups.find((g) => g._id === activeGroupId) ?? null;
    const { data: messagesData, isLoading: messagesLoading } = useChatMessages(activeGroupId ?? undefined);
    const latestMessages = messagesData?.messages ?? [];
    const allMessages = [...olderPages.flat(), ...latestMessages];
    const effectiveCursor = olderCursor === undefined ? (messagesData?.nextCursor ?? null) : olderCursor;
    const hasOlder = !!effectiveCursor;
    const { data: usersData } = useChatUsers();
    const allUsers = usersData?.users ?? [];
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
    const activeMembers = activeGroup?.members ?? [];
    // ── Socket: join / leave chat rooms ──────────────────────────────────────
    useEffect(() => {
        if (!socket || activeGroupId === prevGroupRef.current)
            return;
        if (prevGroupRef.current)
            socket.emit("chat:leave", prevGroupRef.current);
        socket.emit("chat:join", activeGroupId);
        prevGroupRef.current = activeGroupId;
        return () => {
            if (activeGroupId)
                socket.emit("chat:leave", activeGroupId);
        };
    }, [socket, activeGroupId]);
    // Re-join the active room after a reconnect and refetch messages to catch
    // anything broadcast while disconnected (replaces aggressive polling).
    useEffect(() => {
        if (!socket || !activeGroupId)
            return;
        const onReconnect = () => {
            socket.emit("chat:join", activeGroupId);
            qc.invalidateQueries({ queryKey: chatKeys.messages(activeGroupId) });
        };
        socket.on("connect", onReconnect);
        return () => {
            socket.off("connect", onReconnect);
        };
    }, [socket, activeGroupId, qc]);
    // Reset pagination when switching conversations.
    useEffect(() => {
        setOlderPages([]);
        setOlderCursor(undefined);
        setLoadingOlder(false);
    }, [activeGroupId]);
    const handleLoadOlder = async () => {
        if (!activeGroupId || loadingOlder)
            return;
        if (!effectiveCursor)
            return;
        setLoadingOlder(true);
        try {
            const res = await fetchOlderMessages(activeGroupId, effectiveCursor);
            setOlderPages((prev) => [res.messages, ...prev]);
            setOlderCursor(res.nextCursor);
        }
        catch {
            /* ignore — user can retry */
        }
        finally {
            setLoadingOlder(false);
        }
    };
    // ── Socket: incoming messages ────────────────────────────────────────────
    useSocketEvent("chat:message", (msg) => {
        if (!msg.groupId)
            return;
        qc.setQueryData(chatKeys.messages(msg.groupId), (old) => {
            if (!old)
                return { messages: [msg], nextCursor: null };
            if (old.messages.some((m) => m._id === msg._id))
                return old;
            return { ...old, messages: [...old.messages, msg] };
        });
        qc.invalidateQueries({ queryKey: chatKeys.groups() });
    });
    // ── Socket: message delivered ────────────────────────────────────────────
    useSocketEvent("message:delivered", (data) => {
        if (data.groupId !== activeGroupId)
            return;
        qc.setQueryData(chatKeys.messages(data.groupId), (old) => {
            if (!old)
                return old;
            return {
                ...old,
                messages: old.messages.map((msg) => msg._id === data.messageId
                    ? { ...msg, deliveredAt: data.deliveredAt }
                    : msg),
            };
        });
    });
    // ── Socket: message read ───────────────────────────────────────────────
    useSocketEvent("message:read", (data) => {
        if (data.groupId !== activeGroupId)
            return;
        qc.setQueryData(chatKeys.messages(data.groupId), (old) => {
            if (!old)
                return old;
            return {
                ...old,
                messages: old.messages.map((msg) => msg._id === data.messageId
                    ? { ...msg, readAt: data.readAt, readBy: [...(msg.readBy ?? []), data.userId] }
                    : msg),
            };
        });
        qc.invalidateQueries({ queryKey: chatKeys.groups() });
    });
    // ── Socket: message deleted for everyone ─────────────────────────────────
    useSocketEvent("chat:message-deleted", (data) => {
        qc.setQueryData(chatKeys.messages(data.groupId), (old) => {
            if (!old)
                return old;
            return { ...old, messages: old.messages.filter((m) => m._id !== data.messageId) };
        });
        qc.invalidateQueries({ queryKey: chatKeys.groups() });
    });
    // ── Socket: group mutations (rename, add/remove member, role) ────────────
    useSocketEvent("chat:group-updated", (data) => {
        qc.invalidateQueries({ queryKey: chatKeys.groups() });
        qc.invalidateQueries({ queryKey: chatKeys.members(data.groupId) });
    });
    // ── Socket: reactions ────────────────────────────────────────────────────
    useSocketEvent("chat:reaction", (data) => {
        if (data.groupId)
            qc.invalidateQueries({ queryKey: chatKeys.messages(data.groupId) });
    });
    // ── Socket: typing indicators ────────────────────────────────────────────
    useSocketEvent("chat:typing", (data) => {
        if (data.groupId !== activeGroupId || data.userId === user?._id)
            return;
        setTypingUsers((prev) => new Map(prev).set(data.userId, data.userName));
    });
    useSocketEvent("chat:stop-typing", (data) => {
        if (data.groupId !== activeGroupId)
            return;
        setTypingUsers((prev) => {
            const next = new Map(prev);
            next.delete(data.userId);
            return next;
        });
    });
    // ── Socket: presence ─────────────────────────────────────────────────────
    useSocketEvent("user:online", (data) => {
        setOnlineIds((prev) => new Set(prev).add(data.userId));
    });
    useSocketEvent("user:offline", (data) => {
        setOnlineIds((prev) => {
            const next = new Set(prev);
            next.delete(data.userId);
            return next;
        });
        setLastSeen((prev) => new Map(prev).set(data.userId, new Date().toISOString()));
    });
    // Seed presence from the first data load
    useEffect(() => {
        if (seededPresence.current)
            return;
        if (groups.length === 0 && allUsers.length === 0)
            return;
        const ids = new Set();
        groups.forEach((g) => g.members.forEach((m) => { if (m.online)
            ids.add(m._id); }));
        allUsers.forEach((u) => { if (u.status === "online")
            ids.add(u._id); });
        setOnlineIds(ids);
        seededPresence.current = true;
    }, [groups, allUsers]);
    // Auto-select the first group once on initial load so the desktop pane isn't
    // empty. A ref (not the activeGroupId dep) ensures an explicit "back to list"
    // on mobile isn't immediately undone by re-selecting the first group.
    const autoSelected = useRef(false);
    useEffect(() => {
        if (autoSelected.current || groups.length === 0)
            return;
        setActiveGroupId((prev) => prev ?? groups[0]._id);
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
    const typingTimeoutRef = useRef(null);
    const sendTyping = useCallback(() => {
        if (!socket || !activeGroupId)
            return;
        socket.emit("chat:typing", { groupId: activeGroupId });
        if (typingTimeoutRef.current)
            clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            socket.emit("chat:stop-typing", { groupId: activeGroupId });
        }, 3000);
    }, [socket, activeGroupId]);
    const sendStopTyping = useCallback(() => {
        if (!socket || !activeGroupId)
            return;
        if (typingTimeoutRef.current)
            clearTimeout(typingTimeoutRef.current);
        socket.emit("chat:stop-typing", { groupId: activeGroupId });
    }, [socket, activeGroupId]);
    // ── Message actions ──────────────────────────────────────────────────────
    const handleSend = useCallback(() => {
        const text = chatInput.trim();
        if (!text || !activeGroupId)
            return;
        sendStopTyping();
        const replyTo = replyingTo
            ? { messageId: replyingTo._id, text: replyingTo.text, senderName: replyingTo.sender.name }
            : undefined;
        sendMutation.mutate({ groupId: activeGroupId, text, ...(replyTo ? { replyTo } : {}) }, { onSuccess: () => { setChatInput(""); setReplyingTo(null); } });
    }, [chatInput, activeGroupId, replyingTo, sendMutation, sendStopTyping]);
    const handleReply = (msg) => {
        setReplyingTo(msg);
        inputRef.current?.focus();
    };
    const handleCopy = (msg) => {
        navigator.clipboard?.writeText(msg.text).then(() => toast.success("Copied"));
    };
    const handleForward = (msg) => {
        setForwardMessage(msg);
        setShowForward(true);
    };
    const handleForwardSubmit = (targetGroupId) => {
        if (!forwardMessage)
            return;
        sendMutation.mutate({ groupId: targetGroupId, text: forwardMessage.text });
        setShowForward(false);
        setForwardMessage(null);
    };
    const handleDeleteForMe = (msg) => {
        if (!activeGroupId)
            return;
        deleteForMeMutation.mutate({ groupId: activeGroupId, messageId: msg._id });
    };
    const handleDeleteForEveryone = (msg) => {
        if (!activeGroupId)
            return;
        deleteForEveryoneMutation.mutate({ groupId: activeGroupId, messageId: msg._id });
    };
    const handleReport = (msg) => {
        if (!activeGroupId)
            return;
        reportMutation.mutate({ groupId: activeGroupId, messageId: msg._id }, {
            onSuccess: () => toast.success("Message reported to admins"),
            onError: () => toast.error("Could not report message. Please try again."),
        });
    };
    const handleToggleReaction = (msg, emoji) => {
        if (!activeGroupId)
            return;
        addReactionMutation.mutate({ groupId: activeGroupId, messageId: msg._id, emoji });
    };
    // ── Group actions ────────────────────────────────────────────────────────
    const handleCreateGroup = (name, memberIds) => {
        createGroupMutation.mutate({ name, memberIds }, {
            onSuccess: (data) => {
                setActiveGroupId(data.group._id);
                setShowCreateGroup(false);
            },
        });
    };
    const handleStartDirectChat = (userId) => {
        createDirectChatMutation.mutate({ userId }, {
            onSuccess: (data) => {
                setActiveGroupId(data.group._id);
                setShowNewChat(false);
            },
        });
    };
    const handleAddMembers = (memberIds) => {
        if (!activeGroupId)
            return;
        addMembersMutation.mutate({ groupId: activeGroupId, memberIds }, { onSuccess: () => setShowAddMembers(false) });
    };
    const handleRemoveMember = (userId) => {
        if (!activeGroupId)
            return;
        removeMemberMutation.mutate({ groupId: activeGroupId, userId });
    };
    const handleChangeRole = (userId, role) => {
        if (!activeGroupId)
            return;
        changeRoleMutation.mutate({ groupId: activeGroupId, userId, role });
    };
    const handleLeaveGroup = () => {
        if (!activeGroupId)
            return;
        leaveGroupMutation.mutate(activeGroupId, {
            onSuccess: () => setActiveGroupId(null),
        });
    };
    const handleRename = (name) => {
        if (!activeGroupId)
            return;
        renameMutation.mutate({ groupId: activeGroupId, name });
    };
    const handleTogglePin = () => {
        if (!activeGroup)
            return;
        togglePin.mutate({ groupId: activeGroup._id, pinned: activeGroup.isPinned });
    };
    const handleToggleMute = () => {
        if (!activeGroup)
            return;
        toggleMute.mutate({ groupId: activeGroup._id, muted: activeGroup.isMuted });
    };
    const handleToggleArchive = () => {
        if (!activeGroup)
            return;
        toggleArchive.mutate({ groupId: activeGroup._id, archived: activeGroup.isArchived });
    };
    const handleDeleteGroup = () => {
        if (!activeGroupId)
            return;
        deleteGroupMutation.mutate(activeGroupId, {
            onSuccess: () => {
                setActiveGroupId(null);
                setDeleteConfirmOpen(false);
            },
        });
    };
    const canManage = isAdmin || activeMembers.some((m) => m._id === user?._id && m.role === "admin");
    // ── Render ───────────────────────────────────────────────────────────────
    return (_jsxs("div", { children: [_jsx(Toaster, { position: "top-right", richColors: true }), _jsx(PageHeader, { breadcrumb: [{ label: "StillWorks", to: "/" }, { label: "Chat" }], title: "Chat", subtitle: "Private, encrypted messaging for the firm.", actions: _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("span", { className: "flex items-center gap-1.5 text-caption", children: [connStatus === "connected" ? (_jsx(Wifi, { size: 14, strokeWidth: 1.75, className: "text-success" })) : connStatus === "connecting" ? (_jsx(Loader2, { size: 14, strokeWidth: 1.75, className: "animate-spin text-muted-foreground" })) : (_jsx(WifiOff, { size: 14, strokeWidth: 1.75, className: "text-muted-foreground" })), _jsx("span", { className: connStatus === "connected" ? "text-success" : "text-muted-foreground", children: connStatus === "connected" ? "Live" : connStatus === "connecting" ? "Connecting…" : "Offline" })] }), _jsxs("div", { className: "flex items-center gap-2 text-caption text-muted-foreground", children: [_jsx(Lock, { size: 14, strokeWidth: 1.75 }), _jsx("span", { children: "E2E Encrypted" })] })] }) }), groupsLoading && (_jsx("div", { className: "rounded-lg border border-border bg-card p-8 shadow-soft animate-pulse", children: _jsxs("div", { className: "flex items-center justify-center gap-3", children: [_jsx(Loader2, { size: 20, className: "animate-spin text-muted-foreground" }), _jsx("span", { className: "text-helper text-muted-foreground", children: "Loading conversations\u2026" })] }) })), groupsError && (_jsxs("div", { className: "flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-12 text-center", children: [_jsx(AlertTriangle, { size: 28, className: "text-destructive" }), _jsx("p", { className: "font-medium", children: "Failed to load chat" }), _jsx("p", { className: "text-helper text-muted-foreground", children: "Check that the server is running." })] })), !groupsLoading && !groupsError && (_jsxs("div", { className: "grid h-[calc(100vh-7.5rem)] min-h-[540px] overflow-hidden rounded-lg border border-border bg-card shadow-soft lg:grid-cols-[340px_minmax(0,1fr)]", children: [_jsx("div", { className: `${activeGroupId ? "hidden lg:block" : "block"} min-h-0 min-w-0`, children: _jsx(ChatSidebar, { groups: groups, activeGroupId: activeGroupId, currentUserId: user?._id ?? "", onlineIds: onlineIds, search: searchConv, onSearchChange: setSearchConv, isAdmin: isAdmin, onSelect: setActiveGroupId, onNewGroup: () => setShowCreateGroup(true), onNewChat: () => setShowNewChat(true) }) }), _jsx("section", { className: `${activeGroupId ? "flex" : "hidden lg:flex"} min-h-0 min-w-0 flex-col`, children: !activeGroup ? (_jsx("div", { className: "flex flex-1 items-center justify-center", children: _jsxs("div", { className: "text-center", children: [_jsx(MessageSquare, { size: 40, strokeWidth: 1, className: "mx-auto text-muted-foreground/30" }), _jsx("p", { className: "mt-3 text-helper text-muted-foreground", children: "Select a conversation" })] }) })) : (_jsxs(_Fragment, { children: [_jsxs("button", { type: "button", onClick: () => setActiveGroupId(null), "aria-label": "Back to conversations", className: "flex w-full items-center gap-1.5 border-b border-border bg-card/70 px-4 py-3 text-left text-helper font-medium lg:hidden", children: [_jsx(ChevronLeft, { size: 17, strokeWidth: 1.75 }), "Back to chats"] }), _jsx(ChatHeader, { group: activeGroup, currentUserId: user?._id ?? "", onlineIds: onlineIds, lastSeen: lastSeen, onOpenInfo: () => setShowGroupInfo(true), onTogglePin: handleTogglePin, onToggleMute: handleToggleMute, onToggleArchive: handleToggleArchive, isAdmin: isAdmin, onDeleteGroup: () => setDeleteConfirmOpen(true) }), _jsx(MessageList, { messages: allMessages, currentUserId: user?._id ?? "", groupMembers: activeMembers, isAdmin: isAdmin, isLoading: messagesLoading, hasOlder: hasOlder, loadingOlder: loadingOlder, onLoadOlder: handleLoadOlder, emptyText: activeGroup.type === "group"
                                        ? "No messages yet. Start the conversation."
                                        : "Send a message to start chatting.", onReply: handleReply, onCopy: handleCopy, onForward: handleForward, onDeleteForMe: handleDeleteForMe, onDeleteForEveryone: handleDeleteForEveryone, onReport: handleReport, onToggleReaction: handleToggleReaction }), _jsx(MessageComposer, { value: chatInput, onChange: setChatInput, onSend: handleSend, isSending: sendMutation.isPending, replyTo: replyingTo, onCancelReply: () => setReplyingTo(null), typingNames: Array.from(typingUsers.values()), onTyping: sendTyping, inputRef: inputRef })] })) })] })), _jsx(CreateGroupDialog, { open: showCreateGroup, onClose: () => setShowCreateGroup(false), users: allUsers, currentUserId: user?._id ?? "", isCreating: createGroupMutation.isPending, onCreate: handleCreateGroup }), _jsx(NewChatDialog, { open: showNewChat, onClose: () => setShowNewChat(false), users: allUsers, currentUserId: user?._id ?? "", isCreating: createDirectChatMutation.isPending, onStartChat: handleStartDirectChat }), _jsx(AddMembersDialog, { open: showAddMembers, onClose: () => setShowAddMembers(false), users: allUsers, existingMemberIds: activeMembers.map((m) => m._id), isAdding: addMembersMutation.isPending, onAdd: handleAddMembers }), _jsx(ForwardDialog, { open: showForward, onClose: () => setShowForward(false), groups: groups, currentUserId: user?._id ?? "", message: forwardMessage, onForward: handleForwardSubmit }), _jsx(GroupInfoSheet, { open: showGroupInfo, onClose: () => setShowGroupInfo(false), group: activeGroup, members: activeMembers, currentUserId: user?._id ?? "", canManage: canManage, onlineIds: onlineIds, onRename: handleRename, onAddMembers: () => setShowAddMembers(true), onChangeRole: handleChangeRole, onRemoveMember: handleRemoveMember, onLeave: handleLeaveGroup, isLeaving: leaveGroupMutation.isPending }), _jsx(AlertDialog, { open: deleteConfirmOpen, onOpenChange: setDeleteConfirmOpen, children: _jsxs(AlertDialogContent, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: "Delete group?" }), _jsxs(AlertDialogDescription, { children: ["This permanently deletes \u201C", activeGroup?.name, "\u201D and all its messages for everyone."] })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogCancel, { children: "Cancel" }), _jsx(AlertDialogAction, { className: "bg-destructive text-white hover:bg-destructive/90", onClick: handleDeleteGroup, children: "Delete" })] })] }) })] }));
}
