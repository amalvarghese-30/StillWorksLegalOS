import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

// ---------------------------------------------------------------------------
// Types (mirrors server models)
// ---------------------------------------------------------------------------

export interface CaseParty {
  _id?: string;
  clientId?: string;
  name: string;
  role: string;
  type: "client" | "sub_client" | "opposing_party" | "counsel" | "other";
}

export interface CaseNote {
  _id?: string;
  text: string;
  author: string;
  authorId: string;
  createdAt: string;
}

export interface CaseTimelineEntry {
  _id?: string;
  event: string;
  by: string;
  when: string;
}

export interface CaseRecord {
  _id: string;
  number: string;
  title: string;
  description: string;
  practice: string;
  court: string;
  judge: string;
  status: "Active" | "On Hold" | "Closed" | "Urgent";
  priority: "High" | "Medium" | "Low";
  nextHearing: string | null;
  parties: CaseParty[];
  assignedTo?: { _id: string; name: string; email?: string; title?: string };
  createdBy?: { _id: string; name: string };
  notes: CaseNote[];
  timeline: CaseTimelineEntry[];
  nasPath: string;
  progress: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CasesResponse {
  cases: CaseRecord[];
  total: number;
  page: number;
  totalPages: number;
}

export interface CaseResponse {
  case: CaseRecord;
}

export interface CreateCasePayload {
  title: string;
  description?: string;
  practice?: string;
  court?: string;
  judge?: string;
  status?: string;
  priority?: string;
  nextHearing?: string;
  parties?: CaseParty[];
  assignedTo?: string;
  nasPath?: string;
  tags?: string[];
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const caseKeys = {
  all: ["cases"] as const,
  list: (filters: Record<string, string>) => ["cases", "list", filters] as const,
  detail: (id: string) => ["cases", id] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useCases(filters: Record<string, string> = {}) {
  const params = new URLSearchParams(filters).toString();
  return useQuery<CasesResponse>({
    queryKey: caseKeys.list(filters),
    queryFn: () => api.get(`/cases${params ? `?${params}` : ""}`),
  });
}

export function useCase(id: string | undefined) {
  return useQuery<CaseResponse>({
    queryKey: caseKeys.detail(id!),
    queryFn: () => api.get(`/cases/${id}`),
    enabled: !!id,
  });
}

export function useCreateCase() {
  const qc = useQueryClient();
  return useMutation<CaseResponse, Error, CreateCasePayload>({
    mutationFn: (payload) => api.post("/cases", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: caseKeys.all });
    },
  });
}

export function useUpdateCase() {
  const qc = useQueryClient();
  return useMutation<CaseResponse, Error, { id: string; data: Partial<CreateCasePayload> }>({
    mutationFn: ({ id, data }) => api.patch(`/cases/${id}`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: caseKeys.detail(vars.id) });
      qc.invalidateQueries({ queryKey: caseKeys.all });
    },
  });
}

export function useDeleteCase() {
  const qc = useQueryClient();
  return useMutation<{ message: string }, Error, string>({
    mutationFn: (id) => api.delete(`/cases/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: caseKeys.all });
    },
  });
}

export function useAddCaseParty() {
  const qc = useQueryClient();
  return useMutation<CaseResponse, Error, { caseId: string; party: CaseParty }>({
    mutationFn: ({ caseId, party }) => api.post(`/cases/${caseId}/parties`, party),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: caseKeys.detail(vars.caseId) });
    },
  });
}

export function useAddCaseNote() {
  const qc = useQueryClient();
  return useMutation<CaseResponse, Error, { caseId: string; text: string }>({
    mutationFn: ({ caseId, text }) => api.post(`/cases/${caseId}/notes`, { text }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: caseKeys.detail(vars.caseId) });
    },
  });
}
