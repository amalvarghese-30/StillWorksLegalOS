import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, uploadStream, downloadBlob } from "./api";
import { downloads } from "@/platform";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DocumentRecord {
  _id: string;
  name: string;
  originalName?: string;
  kind: string;
  mimeType?: string;
  size: number;
  sizeFormatted?: string;
  caseId?: string | { _id: string; title?: string; number?: string };
  caseName?: string;
  uploadedBy: string | { _id: string; name?: string };
  uploadedByName?: string;
  state: "Pending" | "Approved" | "Rejected" | "Draft";
  storagePath?: string;
  storageFolder?: string;
  nasPath?: string;
  nasFolder?: string;
  version?: number;
  sha256?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedReason?: string;
  accessRequests?: AccessRequest[];
  createdAt: string;
  updatedAt: string;
}

export interface AccessRequest {
  userId: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export interface FolderNode {
  name: string;
  path: string;
  children?: FolderNode[];
  isCaseFolder?: boolean;
  caseId?: string;
}

export type NasFolder = FolderNode; // backward compatibility alias

export interface DocumentsResponse {
  documents: DocumentRecord[];
  total: number;
  page: number;
  totalPages: number;
}

export interface VersionHistoryResponse {
  versions: DocumentRecord[];
  count: number;
}

export interface DocumentStructureResponse {
  folders: FolderNode[];
}

export type NasStructureResponse = DocumentStructureResponse; // backward compatibility alias

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const docKeys = {
  all: ["documents"] as const,
  list: (filters: Record<string, string>) => ["documents", "list", filters] as const,
  detail: (id: string) => ["documents", id] as const,
  structure: () => ["documents", "structure"] as const,
  nas: () => ["documents", "structure"] as const, // alias
  versions: (id: string) => ["documents", "versions", id] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useDocuments(filters: Record<string, string> = {}) {
  const params = new URLSearchParams(filters).toString();
  return useQuery<DocumentsResponse>({
    queryKey: docKeys.list(filters),
    queryFn: () => api.get(`/documents${params ? `?${params}` : ""}`),
  });
}

export function useDocument(id: string) {
  return useQuery<{ document: DocumentRecord }>({
    queryKey: docKeys.detail(id),
    queryFn: () => api.get(`/documents/${id}`),
    enabled: !!id,
  });
}

export function useDocumentStructure() {
  return useQuery<DocumentStructureResponse>({
    queryKey: docKeys.structure(),
    queryFn: () => api.get("/documents/structure"),
    staleTime: 5 * 60 * 1000,
  });
}

export const useNasStructure = useDocumentStructure;

export function uploadDocumentStream(
  formData: FormData,
  onProgress?: (percent: number) => void,
): Promise<{ document: DocumentRecord }> {
  return uploadStream<{ document: DocumentRecord }>({
    path: "/documents/upload",
    formData,
    ...(onProgress ? { onProgress } : {}),
  });
}

export async function downloadDocument(documentId: string): Promise<void> {
  const { blob, fileName } = await downloadBlob(`/documents/${documentId}/download`);
  await downloads.download({
    filename: fileName,
    data: blob,
  });
}

export async function viewDocument(documentId: string): Promise<void> {
  const { blob } = await downloadBlob(`/documents/${documentId}/view`);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}

export function useVerifyDocument() {
  return useMutation<{ documentId: string; expectedHash: string; algorithm: string }, Error, string>({
    mutationFn: (documentId) => api.get(`/documents/${documentId}/verify`),
  });
}

export function useUpdateDocument() {
  const qc = useQueryClient();
  return useMutation<{ document: DocumentRecord }, Error, { id: string; data: Record<string, unknown> }>({
    mutationFn: ({ id, data }) => api.patch(`/documents/${id}`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: docKeys.detail(vars.id) });
      qc.invalidateQueries({ queryKey: docKeys.all });
    },
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation<{ message: string }, Error, string>({
    mutationFn: (id) => api.delete(`/documents/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: docKeys.all });
    },
  });
}

export function useRequestAccess() {
  const qc = useQueryClient();
  return useMutation<{ message: string }, Error, { docId: string; reason: string }>({
    mutationFn: ({ docId, reason }) => api.post(`/documents/${docId}/request-access`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: docKeys.all });
    },
  });
}

export function useReviewAccessRequest() {
  const qc = useQueryClient();
  return useMutation<
    { message: string },
    Error,
    { docId: string; requestId: string; status: "approved" | "rejected" }
  >({
    mutationFn: ({ docId, requestId, status }) =>
      api.patch(`/documents/${docId}/access-requests/${requestId}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: docKeys.all });
      qc.invalidateQueries({ queryKey: ["admin", "approvals"] });
    },
  });
}

export function useVersionHistory(documentId: string) {
  return useQuery<VersionHistoryResponse>({
    queryKey: docKeys.versions(documentId),
    queryFn: () => api.get(`/documents/${documentId}/versions`),
    enabled: !!documentId,
  });
}