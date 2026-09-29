import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { taskKeys } from "./tasks";

export interface ReminderRecord {
  _id: string;
  id?: string;
  userId: string;
  sourceType: "task" | "case" | "custom";
  sourceId?: string;
  clientName: string;
  phone: string;
  notes: string;
  scheduledAt: string;
  status: "scheduled" | "triggered" | "acknowledged" | "completed" | "dismissed" | "snoozed" | "cancelled";
  triggeredAt?: string;
  acknowledgedAt?: string;
  completedAt?: string;
  snoozedUntil?: string;
  deliveryId?: string;
  createdAt: string;
  updatedAt: string;
}

export const reminderKeys = {
  all: ["reminders"] as const,
  due: ["reminders", "due"] as const,
  list: (status?: string) => ["reminders", "list", status] as const,
};

export function useDueReminders() {
  return useQuery<{ reminders: ReminderRecord[] }>({
    queryKey: reminderKeys.due,
    queryFn: () => api.get("/reminders/due"),
    retry: (failureCount, error: any) => {
      // Never loop endlessly on 404 or auth failure
      const status = error?.status || error?.response?.status;
      if (status === 404 || status === 401) {
        return false;
      }
      return failureCount < 3;
    },
    refetchInterval: (query) => {
      const err = query.state.error as any;
      const status = err?.status || err?.response?.status;
      // Do not poll a 404 endpoint or unauthenticated session
      if (status === 404 || status === 401) {
        return false;
      }
      // If there are failures, back off refetch interval
      if (query.state.failureCount >= 2) {
        return 60_000;
      }
      return 30_000;
    },
    staleTime: 10_000,
  });
}

export function useRemindersHealth() {
  return useQuery<{ ok: boolean; service: string }>({
    queryKey: ["reminders", "health"] as const,
    queryFn: () => api.get("/reminders/health"),
    staleTime: 60_000,
    retry: 2,
  });
}

export function useUpdateReminder() {
  const qc = useQueryClient();
  return useMutation<
    { reminder: ReminderRecord },
    Error,
    { id: string; data: Partial<Pick<ReminderRecord, "clientName" | "phone" | "notes" | "scheduledAt">> }
  >({
    mutationFn: ({ id, data }) => api.patch(`/reminders/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reminderKeys.all });
      qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

export function useAcknowledgeReminder() {
  const qc = useQueryClient();
  return useMutation<{ reminder: ReminderRecord }, Error, string>({
    mutationFn: (id) => api.post(`/reminders/${id}/acknowledge`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reminderKeys.all });
    },
  });
}

export function useSnoozeReminder() {
  const qc = useQueryClient();
  return useMutation<{ reminder: ReminderRecord }, Error, { id: string; minutes: number }>({
    mutationFn: ({ id, minutes }) => api.post(`/reminders/${id}/snooze`, { minutes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reminderKeys.all });
    },
  });
}

export function useCompleteReminder() {
  const qc = useQueryClient();
  return useMutation<{ reminder: ReminderRecord }, Error, string>({
    mutationFn: (id) => api.post(`/reminders/${id}/complete`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reminderKeys.all });
      qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

export function useDismissReminder() {
  const qc = useQueryClient();
  return useMutation<{ reminder: ReminderRecord }, Error, string>({
    mutationFn: (id) => api.post(`/reminders/${id}/dismiss`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reminderKeys.all });
    },
  });
}
