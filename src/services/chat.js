import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
export const chatKeys = {
    all: ["chat"],
    groups: () => ["chat", "groups"],
    messages: (groupId) => ["chat", "messages", groupId],
    users: () => ["chat", "users"],
    members: (groupId) => ["chat", "members", groupId],
};
// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------
export function useChatGroups() {
    return useQuery({
        queryKey: chatKeys.groups(),
        queryFn: () => api.get("/chat/groups"),
        refetchInterval: 10_000,
    });
}
export function useChatMessages(groupId) {
    return useQuery({
        queryKey: chatKeys.messages(groupId),
        queryFn: () => api.get(`/chat/groups/${groupId}/messages`),
        enabled: !!groupId,
    });
}
export async function fetchOlderMessages(groupId, before) {
    return api.get(`/chat/groups/${groupId}/messages?before=${encodeURIComponent(before)}`);
}
export function useChatUsers() {
    return useQuery({
        queryKey: chatKeys.users(),
        queryFn: () => api.get("/chat/users"),
        staleTime: 5 * 60 * 1000, // 5 min
    });
}
export function useGroupMembers(groupId) {
    return useQuery({
        queryKey: chatKeys.members(groupId),
        queryFn: () => api.get(`/chat/groups/${groupId}/members`),
        enabled: !!groupId,
    });
}
export function useSendMessage() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ groupId, text, mentions, replyTo }) => api.post(`/chat/groups/${groupId}/messages`, { text, mentions, replyTo }),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: chatKeys.messages(vars.groupId) });
            qc.invalidateQueries({ queryKey: chatKeys.groups() });
        },
    });
}
export function useCreateGroup() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload) => api.post("/chat/groups", payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: chatKeys.all });
        },
    });
}
export function useDeleteGroup() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (groupId) => api.delete(`/chat/groups/${groupId}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: chatKeys.all });
        },
    });
}
export function useCreateDirectChat() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload) => api.post("/chat/groups", { memberIds: [payload.userId], type: "direct" }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: chatKeys.all });
        },
    });
}
export function useMarkRead() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (groupId) => api.post(`/chat/groups/${groupId}/read`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: chatKeys.groups() });
        },
    });
}
export function useAddGroupMembers() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ groupId, memberIds }) => api.post(`/chat/groups/${groupId}/members`, { memberIds }),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: chatKeys.groups() });
            qc.invalidateQueries({ queryKey: chatKeys.members(vars.groupId) });
        },
    });
}
export function useRemoveGroupMember() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ groupId, userId }) => api.delete(`/chat/groups/${groupId}/members/${userId}`),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: chatKeys.groups() });
            qc.invalidateQueries({ queryKey: chatKeys.members(vars.groupId) });
        },
    });
}
export function useChangeMemberRole() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ groupId, userId, role }) => api.patch(`/chat/groups/${groupId}/members/${userId}/role`, { role }),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: chatKeys.groups() });
            qc.invalidateQueries({ queryKey: chatKeys.members(vars.groupId) });
        },
    });
}
export function useLeaveGroup() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (groupId) => api.post(`/chat/groups/${groupId}/leave`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: chatKeys.all });
        },
    });
}
export function useAddReaction() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ groupId, messageId, emoji }) => api.post(`/chat/groups/${groupId}/reactions`, { messageId, emoji }),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: chatKeys.messages(vars.groupId) });
        },
    });
}
export function useRenameGroup() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ groupId, name }) => api.patch(`/chat/groups/${groupId}`, { name }),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: chatKeys.groups() });
            qc.invalidateQueries({ queryKey: chatKeys.members(vars.groupId) });
        },
    });
}
export function useDeleteMessageForEveryone() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ groupId, messageId }) => api.delete(`/chat/groups/${groupId}/messages/${messageId}`),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: chatKeys.messages(vars.groupId) });
        },
    });
}
export function useDeleteMessageForMe() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ groupId, messageId }) => api.post(`/chat/groups/${groupId}/messages/${messageId}/delete-for-me`),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: chatKeys.messages(vars.groupId) });
        },
    });
}
export function useTogglePin() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ groupId, pinned }) => api.post(`/chat/groups/${groupId}/${pinned ? "unpin" : "pin"}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: chatKeys.groups() });
        },
    });
}
export function useToggleMute() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ groupId, muted }) => api.post(`/chat/groups/${groupId}/${muted ? "unmute" : "mute"}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: chatKeys.groups() });
        },
    });
}
export function useToggleArchive() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ groupId, archived }) => api.post(`/chat/groups/${groupId}/${archived ? "unarchive" : "archive"}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: chatKeys.groups() });
        },
    });
}
export function useReportMessage() {
    return useMutation({
        mutationFn: ({ groupId, messageId, reason }) => api.post(`/chat/groups/${groupId}/messages/${messageId}/report`, { reason }),
    });
}
