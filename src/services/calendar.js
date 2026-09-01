import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
export const calendarKeys = {
    all: ["calendar"],
    events: (filters) => ["calendar", "events", filters],
};
// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------
export function useCalendarEvents(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return useQuery({
        queryKey: calendarKeys.events(filters),
        queryFn: () => api.get(`/calendar/events${params ? `?${params}` : ""}`),
    });
}
export function useCreateEvent() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload) => api.post("/calendar/events", payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: calendarKeys.all });
        },
    });
}
export function useUpdateEvent() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }) => api.patch(`/calendar/events/${id}`, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: calendarKeys.all });
        },
    });
}
export function useDeleteEvent() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => api.delete(`/calendar/events/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: calendarKeys.all });
        },
    });
}
