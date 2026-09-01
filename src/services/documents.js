import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, uploadStream, downloadBlob } from "./api";
// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
export const docKeys = {
    all: ["documents"],
    list: (filters) => ["documents", "list", filters],
    detail: (id) => ["documents", id],
    nas: () => ["documents", "nas"],
    versions: (id) => ["documents", "versions", id],
};
// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------
export function useDocuments(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return useQuery({
        queryKey: docKeys.list(filters),
        queryFn: () => api.get(`/documents${params ? `?${params}` : ""}`),
    });
}
export function useDocument(id) {
    return useQuery({
        queryKey: docKeys.detail(id),
        queryFn: () => api.get(`/documents/${id}`),
        enabled: !!id,
    });
}
export function useNasStructure() {
    return useQuery({
        queryKey: docKeys.nas(),
        queryFn: () => api.get("/documents/nas/structure"),
        // Stale time longer since NAS structure doesn't change often
        staleTime: 5 * 60 * 1000,
    });
}
export function uploadDocumentStream(formData, onProgress) {
    return uploadStream({
        path: "/documents/upload",
        formData,
        ...(onProgress ? { onProgress } : {}),
    });
}
export async function downloadDocument(documentId) {
    const { blob, fileName } = await downloadBlob(`/documents/${documentId}/download`);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}
export function useVerifyDocument() {
    return useMutation({
        mutationFn: (documentId) => api.get(`/documents/${documentId}/verify`),
    });
}
export function useUpdateDocument() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }) => api.patch(`/documents/${id}`, data),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: docKeys.detail(vars.id) });
            qc.invalidateQueries({ queryKey: docKeys.all });
        },
    });
}
export function useDeleteDocument() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => api.delete(`/documents/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: docKeys.all });
        },
    });
}
export function useRequestAccess() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ docId, reason }) => api.post(`/documents/${docId}/request-access`, { reason }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: docKeys.all });
        },
    });
}
export function useReviewAccessRequest() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ docId, requestId, status }) => api.patch(`/documents/${docId}/access-requests/${requestId}`, { status }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: docKeys.all });
            qc.invalidateQueries({ queryKey: ["admin", "approvals"] });
        },
    });
}
export function useVersionHistory(documentId) {
    return useQuery({
        queryKey: docKeys.versions(documentId),
        queryFn: () => api.get(`/documents/${documentId}/versions`),
        enabled: !!documentId,
    });
}
