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
    refetchInterval: 30_000, // Background recovery poll
    staleTime: 10_000,
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
