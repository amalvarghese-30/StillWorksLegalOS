import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
export const taskKeys = {
    all: ["tasks"],
    list: (filters) => ["tasks", "list", filters],
    detail: (id) => ["tasks", id],
    options: ["tasks", "options"],
};
// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------
export function useTasks(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return useQuery({
        queryKey: taskKeys.list(filters),
        queryFn: () => api.get(`/tasks${params ? `?${params}` : ""}`),
    });
}
export function useTaskOptions() {
    return useQuery({
        queryKey: taskKeys.options,
        queryFn: () => api.get("/tasks/options"),
        staleTime: 5 * 60 * 1000,
    });
}
export function useCreateTask() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload) => api.post("/tasks", payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: taskKeys.all });
        },
    });
}
export function useUpdateTask() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }) => api.patch(`/tasks/${id}`, data),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: taskKeys.detail(vars.id) });
            qc.invalidateQueries({ queryKey: taskKeys.all });
        },
    });
}
export function useDeleteTask() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => api.delete(`/tasks/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: taskKeys.all });
        },
    });
}
export function useToggleChecklistItem() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ taskId, itemId, done }) => api.patch(`/tasks/${taskId}/checklist/${itemId}`, { done }),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: taskKeys.detail(vars.taskId) });
            qc.invalidateQueries({ queryKey: taskKeys.all });
        },
    });
}
