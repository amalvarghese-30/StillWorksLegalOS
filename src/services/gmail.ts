import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export interface GmailAccountStatus {
  connected: boolean;
  email?: string;
  name?: string;
  connectedAt?: string;
  clientIdConfigured: boolean;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  hasAttachments?: boolean;
}

export interface GmailMessageDetail extends GmailMessage {
  body: string;
  attachments?: Array<{
    filename: string;
    mimeType: string;
    size: number;
    attachmentId: string;
  }>;
}

export const gmailKeys = {
  all: ["gmail"] as const,
  status: () => [...gmailKeys.all, "status"] as const,
  messages: (q?: string) => [...gmailKeys.all, "messages", q] as const,
  message: (id: string) => [...gmailKeys.all, "message", id] as const,
};

export function useGmailStatus() {
  return useQuery({
    queryKey: gmailKeys.status(),
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: GmailAccountStatus }>("/gmail/status");
      return res.data.data;
    },
    staleTime: 30_000,
  });
}

export function useGmailMessages(q?: string) {
  return useQuery({
    queryKey: gmailKeys.messages(q),
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: { messages: GmailMessage[]; nextPageToken?: string } }>(
        "/gmail/messages",
        { params: q ? { q } : undefined }
      );
      return res.data.data;
    },
    staleTime: 60_000,
  });
}

export function useGmailMessage(id: string) {
  return useQuery({
    queryKey: gmailKeys.message(id),
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: GmailMessageDetail }>(`/gmail/messages/${id}`);
      return res.data.data;
    },
    enabled: Boolean(id),
  });
}

export function useDisconnectGmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.post<{ success: boolean; message: string }>("/gmail/disconnect");
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gmailKeys.all });
    },
  });
}

export function useSendGmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { to: string; subject: string; body: string; threadId?: string }) => {
      const res = await api.post<{ success: boolean; data: { messageId: string } }>("/gmail/send", payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gmailKeys.messages() });
    },
  });
}

export function useAssociateEmail() {
  return useMutation({
    mutationFn: async ({ messageId, caseId, taskId }: { messageId: string; caseId?: string; taskId?: string }) => {
      const res = await api.post<{ success: boolean; message: string }>(`/gmail/messages/${messageId}/associate`, {
        caseId,
        taskId,
      });
      return res.data;
    },
  });
}
