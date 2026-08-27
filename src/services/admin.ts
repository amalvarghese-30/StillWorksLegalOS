import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { TaskOptions } from "./tasks";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserPermissions {
  dashboard: boolean;
  clients: boolean;
  cases: boolean;
  tasks: boolean;
  documents: boolean;
  calendar: boolean;
  chat: boolean;
  reports: boolean;
  employees: boolean;
  approvals: boolean;
  auditLogs: boolean;
  settings: boolean;
}

export interface EmployeeRecord {
  _id: string;
  name: string;
  email: string;
  role: string;
  title?: string;
  status: string;
  phone?: string;
  permissions?: UserPermissions;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmployeesResponse {
  employees: EmployeeRecord[];
  total: number;
}

export interface ApprovalItem {
  _id: string;
  kind: string;
  title: string;
  context: string;
  when: string;
}

export interface ApprovalsResponse {
  approvals: ApprovalItem[];
  total: number;
}

export interface AuditLogItem {
  _id: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  resourceId?: string;
  resourceName?: string;
  details?: string;
  ip?: string;
  userAgent?: string;
  createdAt: string;
}

export interface AuditLogsResponse {
  logs: AuditLogItem[];
  total: number;
  page: number;
  totalPages: number;
}

export interface AuditChainVerification {
  valid: boolean;
  brokenAt?: number;
  totalChecked: number;
}

export interface FileIntegrityRecord {
  _id: string;
  documentId: string;
  originalName: string;
  storedPath: string;
  size: number;
  mimeType: string;
  sha256: string;
  algorithm: string;
  uploadedBy: { _id: string; name: string };
  uploadedAt: string;
  lastVerifiedAt?: string;
  status: "verified" | "tampered" | "missing" | "pending";
  verifications: Array<{
    verifiedAt: string;
    verifiedBy: { _id: string; name: string };
    status: "verified" | "tampered" | "missing";
    computedHash: string;
  }>;
  caseId?: { _id: string; title: string; number: string };
  tags?: string[];
}

export interface FileIntegrityResponse {
  records: FileIntegrityRecord[];
  total: number;
  page: number;
  totalPages: number;
}

export interface UpdateEmployeePayload {
  role?: string;
  title?: string;
  status?: string;
  phone?: string;
  permissions?: UserPermissions;
}

export interface CreateEmployeePayload {
  name: string;
  email: string;
  role?: string;
  title?: string;
  phone?: string;
  password?: string;
}

export interface UpdateFirmPayload {
  firmName?: string;
  firmBarRegistration?: string;
  firmPrimaryCourt?: string;
  firmAddress?: string;
  firmLogoUrl?: string;
}

export interface UpdatePreferencesPayload {
  notifyHearingReminders?: boolean;
  notifyApprovalRequests?: boolean;
  notifyCallReminders?: boolean;
  notifyDailyDigest?: boolean;
  securityTwoFactor?: boolean;
  securitySessionTimeout?: boolean;
  securityLoginAlerts?: boolean;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const adminKeys = {
  all: ["admin"] as const,
  employees: (filters?: Record<string, string>) => ["admin", "employees", filters] as const,
  approvals: ["admin", "approvals"] as const,
  auditLogs: (filters?: Record<string, string>) => ["admin", "auditLogs", filters] as const,
  storage: ["admin", "storage"] as const,
  taskOptions: ["admin", "taskOptions"] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useEmployees(filters?: Record<string, string>, options?: { enabled?: boolean }) {
  const params = filters ? new URLSearchParams(filters).toString() : "";
  return useQuery<EmployeesResponse>({
    queryKey: adminKeys.employees(filters),
    queryFn: () => api.get(`/admin/employees${params ? `?${params}` : ""}`),
    enabled: options?.enabled ?? true,
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation<{ user: EmployeeRecord }, Error, { id: string; data: UpdateEmployeePayload }>({
    mutationFn: ({ id, data }) => api.patch(`/admin/employees/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.all });
    },
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation<{ user: EmployeeRecord }, Error, CreateEmployeePayload>({
    mutationFn: (data) => api.post("/admin/employees", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.all });
    },
  });
}

export function useUpdateProfile() {
  return useMutation<{ user: EmployeeRecord }, Error, { name?: string; phone?: string; title?: string }>({
    mutationFn: (data) => api.patch("/auth/me", data),
  });
}

export function useUpdateFirm() {
  return useMutation<{ user: EmployeeRecord }, Error, UpdateFirmPayload>({
    mutationFn: (data) => api.patch("/auth/firm", data),
  });
}

export function useUpdatePreferences() {
  return useMutation<{ user: EmployeeRecord }, Error, UpdatePreferencesPayload>({
    mutationFn: (data) => api.patch("/auth/preferences", data),
  });
}

export function useApprovals(options?: { enabled?: boolean }) {
  return useQuery<ApprovalsResponse>({
    queryKey: adminKeys.approvals,
    queryFn: () => api.get("/admin/approvals"),
    refetchInterval: 30_000, // refresh every 30s for pending approvals
    enabled: options?.enabled ?? true,
  });
}

export function useAuditLogs(filters?: Record<string, string>, options?: { enabled?: boolean }) {
  const params = filters ? new URLSearchParams(filters).toString() : "";
  return useQuery<AuditLogsResponse>({
    queryKey: adminKeys.auditLogs(filters),
    queryFn: () => api.get(`/admin/audit-logs?limit=100${params ? `&${params}` : ""}`),
    enabled: options?.enabled ?? true,
  });
}

export function useVerifyAuditChain() {
  return useQuery<AuditChainVerification>({
    queryKey: ["admin", "integrity", "audit-chain"],
    queryFn: () => api.get("/admin/integrity/audit-chain"),
    staleTime: 0,
  });
}

export function useFileIntegrity(filters?: Record<string, string>) {
  const params = filters ? new URLSearchParams(filters).toString() : "";
  return useQuery<FileIntegrityResponse>({
    queryKey: ["admin", "integrity", "files", filters],
    queryFn: () => api.get(`/admin/integrity/files${params ? `?${params}` : ""}`),
  });
}

export function useVerifyAllFiles() {
  const qc = useQueryClient();
  return useMutation<{ verified: number; tampered: number; missing: number }, Error>({
    mutationFn: () => api.post("/admin/integrity/verify-all"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "integrity", "files"] });
    },
  });
}

export function useVerifyFile() {
  return useMutation<{
    fileId: string;
    documentId: string;
    originalName: string;
    expectedHash: string;
    algorithm: string;
    lastVerifiedAt?: string;
    currentStatus: string;
  }, Error, string>({
    mutationFn: (fileId) => api.post(`/admin/integrity/verify-file/${fileId}`),
  });
}

// ---------------------------------------------------------------------------
// Storage (Synology NAS WebDAV configuration)
// ---------------------------------------------------------------------------

export interface StorageConfig {
  configured: boolean;
  url: string;
  username: string;
  rootPath: string;
  passwordSet: boolean;
}

export interface SaveStorageConfigPayload {
  url: string;
  username: string;
  password: string;
  rootPath: string;
}

export interface TestConnectionResult {
  ok: boolean;
  url: string;
  server?: string;
  compliance?: string[];
  rootExists?: boolean;
  error?: string;
}

export function useStorageConfig() {
  return useQuery<StorageConfig>({
    queryKey: adminKeys.storage,
    queryFn: () => api.get("/admin/storage"),
  });
}

export function useUpdateStorageConfig() {
  const qc = useQueryClient();
  return useMutation<{ message: string }, Error, SaveStorageConfigPayload>({
    mutationFn: (data) => api.patch("/admin/storage", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.storage });
    },
  });
}

export function useTestStorageConnection() {
  return useMutation<TestConnectionResult, Error, SaveStorageConfigPayload>({
    mutationFn: (data) => api.post("/admin/storage/test-connection", data),
  });
}

// ---------------------------------------------------------------------------
// Task options (admin-managed workflow configuration)
// ---------------------------------------------------------------------------

export function useTaskOptionsConfig() {
  return useQuery<TaskOptions>({
    queryKey: adminKeys.taskOptions,
    queryFn: () => api.get("/admin/task-options"),
  });
}

export function useUpdateTaskOptions() {
  const qc = useQueryClient();
  return useMutation<{ message: string }, Error, TaskOptions>({
    mutationFn: (data) => api.put("/admin/task-options", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.taskOptions });
      qc.invalidateQueries({ queryKey: ["tasks", "options"] });
    },
  });
}
