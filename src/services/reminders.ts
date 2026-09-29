import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { taskKeys } from "./tasks";

export interface ReminderRecord {
  _id: string;
  id?: string;
  userId: string;
  sourceType: "task" | "case" | "event" | "custom";
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

let reminderEndpointAvailable: boolean | null = null;

export function useDueReminders() {
  return useQuery<{ reminders: ReminderRecord[] }>({
    queryKey: reminderKeys.due,
    queryFn: async () => {
      // If we previously detected that the backend does not have this route (404),
      // do not make further network requests to avoid console 404 spam.
      if (reminderEndpointAvailable === false) {
        return { reminders: [] };
      }
      try {
        const result = await api.get<{ reminders: ReminderRecord[] }>("/reminders/due");
        reminderEndpointAvailable = true;
        return result;
      } catch (err: any) {
        if (err?.status === 404) {
          // Deployed server build has not mounted /api/reminders yet; gracefully degrade
          reminderEndpointAvailable = false;
          return { reminders: [] };
        }
        throw err;
      }
    },
    enabled: reminderEndpointAvailable !== false,
    retry: false,
    refetchInterval: (query) => {
      if (reminderEndpointAvailable === false) {
        return false;
      }
      const err = query.state.error as any;
      const status = err?.status || err?.response?.status;
      if (status === 404 || status === 401) {
        return false;
      }
      return 30_000;
    },
    staleTime: 15_000,
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
