import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
export const clientKeys = {
    all: ["clients"],
    list: (filters) => ["clients", "list", filters],
    detail: (id) => ["clients", id],
};
// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------
export function useClients(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return useQuery({
        queryKey: clientKeys.list(filters),
        queryFn: () => api.get(`/clients${params ? `?${params}` : ""}`),
    });
}
export function useClient(id) {
    return useQuery({
        queryKey: clientKeys.detail(id),
        queryFn: () => api.get(`/clients/${id}`),
        enabled: !!id,
    });
}
export function useCreateClient() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload) => api.post("/clients", payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: clientKeys.all });
        },
    });
}
export function useUpdateClient() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }) => api.patch(`/clients/${id}`, data),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: clientKeys.detail(vars.id) });
            qc.invalidateQueries({ queryKey: clientKeys.all });
        },
    });
}
export function useDeleteClient() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => api.delete(`/clients/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: clientKeys.all });
        },
    });
}
