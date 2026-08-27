import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

// ---------------------------------------------------------------------------
// Types (mirrors server models)
// ---------------------------------------------------------------------------

export interface SubClient {
  _id?: string;
  name: string;
  relationship: string;
  phone?: string;
  email?: string;
  aadhar?: string;
  pan?: string;
  notes?: string;
}

export interface ClientRecord {
  _id: string;
  type: "Individual" | "Corporate";
  tag: "Active" | "VIP" | "Corporate" | "Individual" | "Archived";
  name: string;
  phone: string;
  email: string;
  address: string;
  aadhar: string;
  pan: string;
  kyc: "Verified" | "Pending" | "Rejected";
  propertyDetails?: {
    address: string;
    surveyNo: string;
    chsName: string;
    sector: string;
    plot: string;
    area: string;
  };
  subClients: SubClient[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientsResponse {
  clients: ClientRecord[];
  total: number;
  page: number;
  totalPages: number;
}

export interface ClientResponse {
  client: ClientRecord;
}

export interface CreateClientPayload {
  type?: string;
  tag?: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  aadhar?: string;
  pan?: string;
  propertyDetails?: ClientRecord["propertyDetails"];
  subClients?: SubClient[];
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const clientKeys = {
  all: ["clients"] as const,
  list: (filters: Record<string, string>) => ["clients", "list", filters] as const,
  detail: (id: string) => ["clients", id] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useClients(filters: Record<string, string> = {}) {
  const params = new URLSearchParams(filters).toString();
  return useQuery<ClientsResponse>({
    queryKey: clientKeys.list(filters),
    queryFn: () => api.get(`/clients${params ? `?${params}` : ""}`),
  });
}

export function useClient(id: string | undefined) {
  return useQuery<ClientResponse>({
    queryKey: clientKeys.detail(id!),
    queryFn: () => api.get(`/clients/${id}`),
    enabled: !!id,
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation<ClientResponse, Error, CreateClientPayload>({
    mutationFn: (payload) => api.post("/clients", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clientKeys.all });
    },
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation<ClientResponse, Error, { id: string; data: Partial<CreateClientPayload> }>({
    mutationFn: ({ id, data }) => api.patch(`/clients/${id}`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: clientKeys.detail(vars.id) });
      qc.invalidateQueries({ queryKey: clientKeys.all });
    },
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation<{ message: string }, Error, string>({
    mutationFn: (id) => api.delete(`/clients/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clientKeys.all });
    },
  });
}
