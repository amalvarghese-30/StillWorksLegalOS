import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMember {
  _id: string;
  name: string;
  initials: string;
  role: "admin" | "member";
  online: boolean;
  lastActiveAt: string | null;
  joinedAt: string | null;
}

export interface ChatMessage {
  _id: string;
  groupId: string;
  text: string;
  sender: { _id: string; name: string; initials: string };
  attachments: { name: string; nasPath: string; size: string }[];
  mentions: string[];
  readBy: string[];
  reactions: { userId: string; emoji: string }[];
  replyTo?: { messageId: string; text: string; senderName: string } | null;
  createdAt: string | null;
}

export interface ChatGroup {
  _id: string;
  name: string;
  type: "direct" | "group";
  members: ChatMember[];
  lastMessage?: {
    text: string;
    senderId: string;
    senderName: string;
    at: string | null;
  } | null;
  createdBy: string;
  isPinned: boolean;
  isMuted: boolean;
  isArchived: boolean;
  unread?: number;
  createdAt: string | null;
}

export interface ChatGroupsResponse {
  groups: ChatGroup[];
}

export interface ChatMessagesResponse {
  messages: ChatMessage[];
  nextCursor: string | null;
}

export interface UserForContact {
  _id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastActiveAt: string;
}

export interface UsersResponse {
  users: UserForContact[];
}

export interface GroupMembersResponse {
  members: ChatMember[];
}

export interface ReplyPayload {
  messageId: string;
  text: string;
  senderName: string;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const chatKeys = {
  all: ["chat"] as const,
  groups: () => ["chat", "groups"] as const,
  messages: (groupId: string) => ["chat", "messages", groupId] as const,
  users: () => ["chat", "users"] as const,
  members: (groupId: string) => ["chat", "members", groupId] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useChatGroups() {
  return useQuery<ChatGroupsResponse>({
    queryKey: chatKeys.groups(),
    queryFn: () => api.get("/chat/groups"),
    refetchInterval: 10_000,
  });
}

export function useChatMessages(groupId: string | undefined) {
  return useQuery<ChatMessagesResponse>({
    queryKey: chatKeys.messages(groupId!),
    queryFn: () => api.get(`/chat/groups/${groupId}/messages`),
    enabled: !!groupId,
  });
}

export async function fetchOlderMessages(
  groupId: string,
  before: string,
): Promise<ChatMessagesResponse> {
  return api.get(`/chat/groups/${groupId}/messages?before=${encodeURIComponent(before)}`);
}

export function useChatUsers() {
  return useQuery<UsersResponse>({
    queryKey: chatKeys.users(),
    queryFn: () => api.get("/chat/users"),
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

export function useGroupMembers(groupId: string | undefined) {
  return useQuery<GroupMembersResponse>({
    queryKey: chatKeys.members(groupId!),
    queryFn: () => api.get(`/chat/groups/${groupId}/members`),
    enabled: !!groupId,
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation<
    ChatMessage,
    Error,
    { groupId: string; text: string; mentions?: string[]; replyTo?: ReplyPayload }
  >({
    mutationFn: ({ groupId, text, mentions, replyTo }) =>
      api.post(`/chat/groups/${groupId}/messages`, { text, mentions, replyTo }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: chatKeys.messages(vars.groupId) });
      qc.invalidateQueries({ queryKey: chatKeys.groups() });
    },
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation<{ group: ChatGroup }, Error, { name: string; memberIds: string[] }>({
    mutationFn: (payload) => api.post("/chat/groups", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.all });
    },
  });
}

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation<{ message: string }, Error, string>({
    mutationFn: (groupId) => api.delete(`/chat/groups/${groupId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.all });
    },
  });
}

export function useCreateDirectChat() {
  const qc = useQueryClient();
  return useMutation<{ group: ChatGroup }, Error, { userId: string }>({
    mutationFn: (payload) =>
      api.post("/chat/groups", { memberIds: [payload.userId], type: "direct" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.all });
    },
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation<{ message: string }, Error, string>({
    mutationFn: (groupId) => api.post(`/chat/groups/${groupId}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.groups() });
    },
  });
}

export function useAddGroupMembers() {
  const qc = useQueryClient();
  return useMutation<{ group: ChatGroup }, Error, { groupId: string; memberIds: string[] }>({
    mutationFn: ({ groupId, memberIds }) =>
      api.post(`/chat/groups/${groupId}/members`, { memberIds }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: chatKeys.groups() });
      qc.invalidateQueries({ queryKey: chatKeys.members(vars.groupId) });
    },
  });
}

export function useRemoveGroupMember() {
  const qc = useQueryClient();
  return useMutation<{ group: ChatGroup }, Error, { groupId: string; userId: string }>({
    mutationFn: ({ groupId, userId }) =>
      api.delete(`/chat/groups/${groupId}/members/${userId}`),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: chatKeys.groups() });
      qc.invalidateQueries({ queryKey: chatKeys.members(vars.groupId) });
    },
  });
}

export function useChangeMemberRole() {
  const qc = useQueryClient();
  return useMutation<
    { group: ChatGroup },
    Error,
    { groupId: string; userId: string; role: "admin" | "member" }
  >({
    mutationFn: ({ groupId, userId, role }) =>
      api.patch(`/chat/groups/${groupId}/members/${userId}/role`, { role }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: chatKeys.groups() });
      qc.invalidateQueries({ queryKey: chatKeys.members(vars.groupId) });
    },
  });
}

export function useLeaveGroup() {
  const qc = useQueryClient();
  return useMutation<{ group: ChatGroup | null; message?: string }, Error, string>({
    mutationFn: (groupId) => api.post(`/chat/groups/${groupId}/leave`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.all });
    },
  });
}

export function useAddReaction() {
  const qc = useQueryClient();
  return useMutation<
    { reactions: { userId: string; emoji: string }[] },
    Error,
    { groupId: string; messageId: string; emoji: string }
  >({
    mutationFn: ({ groupId, messageId, emoji }) =>
      api.post(`/chat/groups/${groupId}/reactions`, { messageId, emoji }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: chatKeys.messages(vars.groupId) });
    },
  });
}

export function useRenameGroup() {
  const qc = useQueryClient();
  return useMutation<{ group: ChatGroup }, Error, { groupId: string; name: string }>({
    mutationFn: ({ groupId, name }) => api.patch(`/chat/groups/${groupId}`, { name }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: chatKeys.groups() });
      qc.invalidateQueries({ queryKey: chatKeys.members(vars.groupId) });
    },
  });
}

export function useDeleteMessageForEveryone() {
  const qc = useQueryClient();
  return useMutation<{ messageId: string }, Error, { groupId: string; messageId: string }>({
    mutationFn: ({ groupId, messageId }) =>
      api.delete(`/chat/groups/${groupId}/messages/${messageId}`),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: chatKeys.messages(vars.groupId) });
    },
  });
}

export function useDeleteMessageForMe() {
  const qc = useQueryClient();
  return useMutation<{ messageId: string }, Error, { groupId: string; messageId: string }>({
    mutationFn: ({ groupId, messageId }) =>
      api.post(`/chat/groups/${groupId}/messages/${messageId}/delete-for-me`),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: chatKeys.messages(vars.groupId) });
    },
  });
}

export function useTogglePin() {
  const qc = useQueryClient();
  return useMutation<{ group: ChatGroup }, Error, { groupId: string; pinned: boolean }>({
    mutationFn: ({ groupId, pinned }) =>
      api.post(`/chat/groups/${groupId}/${pinned ? "unpin" : "pin"}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.groups() });
    },
  });
}

export function useToggleMute() {
  const qc = useQueryClient();
  return useMutation<{ group: ChatGroup }, Error, { groupId: string; muted: boolean }>({
    mutationFn: ({ groupId, muted }) =>
      api.post(`/chat/groups/${groupId}/${muted ? "unmute" : "mute"}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.groups() });
    },
  });
}

export function useToggleArchive() {
  const qc = useQueryClient();
  return useMutation<{ group: ChatGroup }, Error, { groupId: string; archived: boolean }>({
    mutationFn: ({ groupId, archived }) =>
      api.post(`/chat/groups/${groupId}/${archived ? "unarchive" : "archive"}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.groups() });
    },
  });
}

export function useReportMessage() {
  return useMutation<
    { message: string },
    Error,
    { groupId: string; messageId: string; reason?: string }
  >({
    mutationFn: ({ groupId, messageId, reason }) =>
      api.post(`/chat/groups/${groupId}/messages/${messageId}/report`, { reason }),
  });
}
