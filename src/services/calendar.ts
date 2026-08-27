import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CalendarEvent {
  _id: string;
  title: string;
  description: string;
  type: "hearing" | "task" | "call_reminder" | "leave" | "firm_event" | "personal";
  start: string;
  end: string;
  allDay: boolean;
  caseId?: string;
  caseName?: string;
  clientId?: string;
  clientName?: string;
  createdBy: { _id: string; name: string };
  assignedTo?: { _id: string; name: string }[];
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEventsResponse {
  events: CalendarEvent[];
}

export interface CreateEventPayload {
  title: string;
  description?: string;
  type?: string;
  start: string;
  end?: string;
  allDay?: boolean;
  caseId?: string;
  clientId?: string;
  assignedTo?: string[];
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const calendarKeys = {
  all: ["calendar"] as const,
  events: (filters: Record<string, string>) => ["calendar", "events", filters] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useCalendarEvents(filters: Record<string, string> = {}) {
  const params = new URLSearchParams(filters).toString();
  return useQuery<CalendarEventsResponse>({
    queryKey: calendarKeys.events(filters),
    queryFn: () => api.get(`/calendar/events${params ? `?${params}` : ""}`),
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation<{ event: CalendarEvent }, Error, CreateEventPayload>({
    mutationFn: (payload) => api.post("/calendar/events", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: calendarKeys.all });
    },
  });
}

export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation<{ event: CalendarEvent }, Error, { id: string; data: Partial<CreateEventPayload> }>({
    mutationFn: ({ id, data }) => api.patch(`/calendar/events/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: calendarKeys.all });
    },
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation<{ message: string }, Error, string>({
    mutationFn: (id) => api.delete(`/calendar/events/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: calendarKeys.all });
    },
  });
}
