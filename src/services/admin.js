import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
export const adminKeys = {
    all: ["admin"],
    employees: (filters) => ["admin", "employees", filters],
    approvals: ["admin", "approvals"],
    auditLogs: (filters) => ["admin", "auditLogs", filters],
    storage: ["admin", "storage"],
    taskOptions: ["admin", "taskOptions"],
};
// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------
export function useEmployees(filters, options) {
    const params = filters ? new URLSearchParams(filters).toString() : "";
    return useQuery({
        queryKey: adminKeys.employees(filters),
        queryFn: () => api.get(`/admin/employees${params ? `?${params}` : ""}`),
        enabled: options?.enabled ?? true,
    });
}
export function useUpdateEmployee() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }) => api.patch(`/admin/employees/${id}`, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: adminKeys.all });
        },
    });
}
export function useCreateEmployee() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data) => api.post("/admin/employees", data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: adminKeys.all });
        },
    });
}
export function useUpdateProfile() {
    return useMutation({
        mutationFn: (data) => api.patch("/auth/me", data),
    });
}
export function useUpdateFirm() {
    return useMutation({
        mutationFn: (data) => api.patch("/auth/firm", data),
    });
}
export function useUpdatePreferences() {
    return useMutation({
        mutationFn: (data) => api.patch("/auth/preferences", data),
    });
}
export function useApprovals(options) {
    return useQuery({
        queryKey: adminKeys.approvals,
        queryFn: () => api.get("/admin/approvals"),
        refetchInterval: 30_000, // refresh every 30s for pending approvals
        enabled: options?.enabled ?? true,
    });
}
export function useAuditLogs(filters, options) {
    const params = filters ? new URLSearchParams(filters).toString() : "";
    return useQuery({
        queryKey: adminKeys.auditLogs(filters),
        queryFn: () => api.get(`/admin/audit-logs?limit=100${params ? `&${params}` : ""}`),
        enabled: options?.enabled ?? true,
    });
}
export function useVerifyAuditChain() {
    return useQuery({
        queryKey: ["admin", "integrity", "audit-chain"],
        queryFn: () => api.get("/admin/integrity/audit-chain"),
        staleTime: 0,
    });
}
export function useFileIntegrity(filters) {
    const params = filters ? new URLSearchParams(filters).toString() : "";
    return useQuery({
        queryKey: ["admin", "integrity", "files", filters],
        queryFn: () => api.get(`/admin/integrity/files${params ? `?${params}` : ""}`),
    });
}
export function useVerifyAllFiles() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => api.post("/admin/integrity/verify-all"),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["admin", "integrity", "files"] });
        },
    });
}
export function useVerifyFile() {
    return useMutation({
        mutationFn: (fileId) => api.post(`/admin/integrity/verify-file/${fileId}`),
    });
}
export function useStorageConfig() {
    return useQuery({
        queryKey: adminKeys.storage,
        queryFn: () => api.get("/admin/storage"),
    });
}
export function useUpdateStorageConfig() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data) => api.patch("/admin/storage", data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: adminKeys.storage });
        },
    });
}
export function useTestStorageConnection() {
    return useMutation({
        mutationFn: (data) => api.post("/admin/storage/test-connection", data),
    });
}
// ---------------------------------------------------------------------------
// Task options (admin-managed workflow configuration)
// ---------------------------------------------------------------------------
export function useTaskOptionsConfig() {
    return useQuery({
        queryKey: adminKeys.taskOptions,
        queryFn: () => api.get("/admin/task-options"),
    });
}
export function useUpdateTaskOptions() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data) => api.put("/admin/task-options", data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: adminKeys.taskOptions });
            qc.invalidateQueries({ queryKey: ["tasks", "options"] });
        },
    });
}
