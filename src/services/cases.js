import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
export const caseKeys = {
    all: ["cases"],
    list: (filters) => ["cases", "list", filters],
    detail: (id) => ["cases", id],
};
// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------
export function useCases(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return useQuery({
        queryKey: caseKeys.list(filters),
        queryFn: () => api.get(`/cases${params ? `?${params}` : ""}`),
    });
}
export function useCase(id) {
    return useQuery({
        queryKey: caseKeys.detail(id),
        queryFn: () => api.get(`/cases/${id}`),
        enabled: !!id,
    });
}
export function useCreateCase() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload) => api.post("/cases", payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: caseKeys.all });
        },
    });
}
export function useUpdateCase() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }) => api.patch(`/cases/${id}`, data),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: caseKeys.detail(vars.id) });
            qc.invalidateQueries({ queryKey: caseKeys.all });
        },
    });
}
export function useDeleteCase() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => api.delete(`/cases/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: caseKeys.all });
        },
    });
}
export function useAddCaseParty() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ caseId, party }) => api.post(`/cases/${caseId}/parties`, party),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: caseKeys.detail(vars.caseId) });
        },
    });
}
export function useAddCaseNote() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ caseId, text }) => api.post(`/cases/${caseId}/notes`, { text }),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: caseKeys.detail(vars.caseId) });
        },
    });
}
