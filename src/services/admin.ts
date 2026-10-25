import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, getApiBase, getAccessToken } from "./api";
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
  secondaryPhone?: string;
  avatarUrl?: string;
  permissions?: UserPermissions;
  lastActiveAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmployeeMetrics {
  activeCases: number;
  totalCases: number;
  openTasks: number;
  completedTasks: number;
  overdueTasks: number;
  pendingApprovals: number;
  completedToday: number;
  completedThisWeek: number;
  completedThisMonth: number;
  upcomingDeadlines: number;
}

export interface EmployeeActivityItem {
  _id: string;
  action: string;
  resource: string;
  resourceName?: string;
  details?: string;
  ip?: string;
  userAgent?: string;
  createdAt: string;
}

export interface EmployeeDetailResponse {
  employee: EmployeeRecord;
  metrics: EmployeeMetrics;
  recentActivity: EmployeeActivityItem[];
}

export interface EmployeesResponse {
  employees: EmployeeRecord[];
  total: number;
}

export interface ApprovalItem {
  _id: string;
  rawApprovalId?: string;
  kind: string;
  category?: "tasks" | "documents" | "access" | "cases" | "clients" | string;
  title: string;
  context: string;
  when: string;
  status?: "pending" | "approved" | "rejected" | string;
  priority?: "low" | "medium" | "high" | "urgent" | string;
  agingDays?: number;
  agingLabel?: string;
  submittedBy?: {
    _id?: string;
    name: string;
    email?: string;
    role?: string;
    avatarUrl?: string;
  };
  rejectionReason?: string;
  decisionRemark?: string;
  reviewedAt?: string;
  reviewedBy?: {
    _id?: string;
    name?: string;
  };
  taskDetails?: {
    _id: string;
    title: string;
    description?: string;
    priority?: string;
    status?: string;
    category?: string;
    mainCategory?: string;
    subCategory?: string;
    deadline?: string | null;
    completedAt?: string | null;
    submittedForApprovalAt?: string | null;
    approvedAt?: string | null;
    rejectedAt?: string | null;
    rejectionReason?: string;
    rejectedByName?: string;
    assignedTo?: { _id: string; name: string; email: string; role?: string } | null;
    assignedBy?: { _id: string; name: string; email: string; role?: string } | null;
    case?: {
      _id: string;
      title: string;
      number: string;
      courtCaseId?: string;
      countCaseNumber?: string;
    } | null;
    client?: {
      _id: string;
      name: string;
      phone?: string;
      email?: string;
    } | null;
    checklist?: Array<{
      _id?: string;
      id?: string;
      text: string;
      done: boolean;
      remarks?: string;
      subItems?: Array<{ text: string; done: boolean }>;
    }>;
    remarks?: Array<{
      _id?: string;
      text: string;
      author: string;
      createdAt: string;
    }>;
    assignmentHistory?: Array<{
      action: string;
      note?: string;
      timestamp: string;
    }>;
    documents?: Array<{
      _id: string;
      name: string;
      originalName?: string;
      size?: number;
      sizeFormatted?: string;
      mimeType?: string;
      state?: string;
      createdAt?: string;
      task?: { _id: string; title: string; status?: string } | null;
    }>;
  };
  documents?: Array<{
    _id: string;
    name: string;
    originalName?: string;
    size?: number;
    sizeFormatted?: string;
    mimeType?: string;
    state?: string;
    createdAt?: string;
    task?: { _id: string; title: string; status?: string } | null;
  }>;
  documentDetails?: {
    _id: string;
    name: string;
    kind?: string;
    size?: number;
    sizeFormatted?: string;
    mimeType?: string;
    state?: string;
    storagePath?: string;
    case?: { _id: string; title: string; number: string } | null;
    task?: { _id: string; title: string; status?: string } | null;
    client?: { _id: string; name: string } | null;
    uploadedBy?: { _id: string; name: string; email?: string; role?: string } | null;
    createdAt?: string;
  };
  caseDetails?: {
    _id: string;
    title: string;
    number: string;
    courtCaseId?: string;
  };
  requestDetails?: {
    _id: string;
    type: string;
    entityType: string;
    entityId?: string;
    requester?: { _id: string; name: string; email: string };
    targetUser?: { _id: string; name: string; email: string };
    originalAssignee?: { _id: string; name: string; email: string };
    reason?: string;
    decisionRemark?: string;
    createdAt?: string;
    reviewedAt?: string;
    metadata?: Record<string, unknown>;
  };
}

export interface ApprovalsResponse {
  approvals: ApprovalItem[];
  total: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  categoryCounts?: {
    all: number;
    tasks: number;
    documents: number;
    access: number;
    cases: number;
    clients: number;
  };
}

export interface ApprovalMetrics {
  awaitingReview: number;
  submittedToday: number;
  approvedThisMonth: number;
  rejectedThisMonth: number;
}

export interface ApprovalQueryParams {
  status?: "pending" | "approved" | "rejected" | "all" | string;
  category?: "all" | "tasks" | "documents" | "access" | "cases" | "clients" | string;
  search?: string;
  submittedToday?: boolean;
  thisMonth?: boolean;
  sortBy?: "newest" | "oldest" | "waiting" | "priority" | "title" | string;
  page?: number;
  limit?: number;
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
  metadata?: {
    diffs?: string[];
    [key: string]: unknown;
  };
  hash?: string;
  prevHash?: string;
  sequence?: number;
  createdAt: string;
}

export interface AuditLogsResponse {
  logs: AuditLogItem[];
  total: number;
  page: number;
  totalPages: number;
  limit?: number;
}

export interface AuditLogMetrics {
  totalEvents: number;
  eventsToday: number;
  activeUsers: number;
  securityEvents: number;
}

export interface AuditLogQueryParams {
  search?: string;
  userId?: string;
  action?: string;
  resource?: string;
  startDate?: string;
  endDate?: string;
  todayOnly?: boolean;
  ip?: string;
  sortBy?: "newest" | "oldest" | "action" | "user";
  page?: number;
  limit?: number;
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
  avatarUrl?: string;
  name?: string;
  email?: string;
  role?: string;
  title?: string;
  status?: string;
  phone?: string;
  secondaryPhone?: string;
  password?: string;
  permissions?: UserPermissions;
}

export interface CreateEmployeePayload {
  name: string;
  email: string;
  role?: string | undefined;
  title?: string | undefined;
  phone?: string | undefined;
  secondaryPhone?: string | undefined;
  password?: string | undefined;
}

export interface ResetPasswordPayload {
  mode?: "generate" | "manual" | undefined;
  newPassword?: string | undefined;
}

export interface ResetPasswordResponse {
  message: string;
  temporaryPassword?: string | undefined;
  mustChangePassword?: boolean | undefined;
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
  detail: (id?: string) => ["admin", "employees", "detail", id ?? ""] as const,
  approvals: ["admin", "approvals"] as const,
  approvalsQuery: (params?: ApprovalQueryParams) => ["admin", "approvals", "list", params] as const,
  approvalMetrics: ["admin", "approvals", "metrics"] as const,
  auditLogs: (filters?: Record<string, unknown>) => ["admin", "auditLogs", filters] as const,
  auditLogMetrics: ["admin", "auditLogs", "metrics"] as const,
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

export function useEmployeeDetail(id?: string, options?: { enabled?: boolean }) {
  return useQuery<EmployeeDetailResponse>({
    queryKey: adminKeys.detail(id),
    queryFn: () => api.get(`/admin/employees/${id}`),
    enabled: Boolean(id) && (options?.enabled ?? true),
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation<{ user: EmployeeRecord }, Error, { id: string; data: UpdateEmployeePayload }>({
    mutationFn: ({ id, data }) => api.patch(`/admin/employees/${id}`, data),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: adminKeys.all });
      qc.setQueriesData<EmployeesResponse>({ queryKey: ["admin", "employees"] }, (old) => {
        if (!old) return old;
        return {
          ...old,
          employees: old.employees.map((emp) => (emp._id === result.user._id ? { ...emp, ...result.user } : emp)),
        };
      });
      qc.invalidateQueries({ queryKey: ["chat", "users"] });
    },
  });
}

export function useUploadEmployeeAvatar() {
  const qc = useQueryClient();
  return useMutation<{ avatarUrl: string; user: EmployeeRecord }, Error, { id: string; file: File }>({
    mutationFn: async ({ id, file }) => {
      const formData = new FormData();
      formData.append("avatar", file);
      const token = getAccessToken();
      const res = await fetch(`${getApiBase()}/admin/employees/${id}/avatar`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to upload avatar");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.all });
      qc.invalidateQueries({ queryKey: ["chat"] });
    },
  });
}

export function useRemoveEmployeeAvatar() {
  const qc = useQueryClient();
  return useMutation<{ user: EmployeeRecord }, Error, { id: string }>({
    mutationFn: async ({ id }) => {
      const token = getAccessToken();
      const res = await fetch(`${getApiBase()}/admin/employees/${id}/avatar`, {
        method: "DELETE",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to remove avatar");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.all });
      qc.invalidateQueries({ queryKey: ["chat"] });
    },
  });
}

export interface CreateEmployeeResponse {
  user: EmployeeRecord;
  tempPassword?: string;
  mustChangePassword?: boolean;
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation<CreateEmployeeResponse, Error, CreateEmployeePayload>({
    mutationFn: (data) => api.post("/admin/employees", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.all });
    },
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation<{ message: string }, Error, string>({
    mutationFn: (id) => api.delete(`/admin/employees/${id}`),
    onSuccess: (_, deletedId) => {
      qc.invalidateQueries({ queryKey: adminKeys.all });
      qc.setQueriesData<EmployeesResponse>({ queryKey: ["admin", "employees"] }, (old) => {
        if (!old) return old;
        return {
          ...old,
          employees: old.employees.filter((emp) => emp._id !== deletedId),
          total: Math.max(0, old.total - 1),
        };
      });
      qc.invalidateQueries({ queryKey: ["chat", "users"] });
    },
  });
}

export function useResetEmployeePassword() {
  const qc = useQueryClient();
  return useMutation<ResetPasswordResponse, Error, { id: string; payload?: ResetPasswordPayload }>({
    mutationFn: ({ id, payload }) =>
      api.post(`/admin/employees/${id}/reset-password`, payload ?? { mode: "generate" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.all });
    },
  });
}

export function useUpdateProfile() {
  return useMutation<{ user: EmployeeRecord }, Error, { name?: string; phone?: string; secondaryPhone?: string; title?: string }>({
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

export function useApprovals(
  paramsOrOptions?: ApprovalQueryParams | { enabled?: boolean },
  options?: { enabled?: boolean }
) {
  let params: ApprovalQueryParams | undefined;
  let opts: { enabled?: boolean } | undefined = options;

  if (paramsOrOptions && typeof paramsOrOptions === "object") {
    // If the object only provides `{ enabled: ... }` and not standard query params
    const filterKeys = ["status", "category", "search", "submittedToday", "thisMonth", "sortBy", "page", "limit"];
    const keys = Object.keys(paramsOrOptions);
    const isOptionsObject = keys.length > 0 && keys.every((k) => k === "enabled") && !keys.some((k) => filterKeys.includes(k));

    if (isOptionsObject) {
      opts = paramsOrOptions as { enabled?: boolean };
      params = undefined;
    } else {
      params = paramsOrOptions as ApprovalQueryParams;
    }
  }

  const queryStr = params
    ? Object.entries(params)
        .filter(([_, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&")
    : "";

  const isEnabled = opts?.enabled ?? true;

  return useQuery<ApprovalsResponse>({
    queryKey: params ? adminKeys.approvalsQuery(params) : adminKeys.approvals,
    queryFn: () => api.get(`/admin/approvals${queryStr ? `?${queryStr}` : ""}`),
    refetchInterval: (query) => {
      if (!isEnabled) return false;
      const error = query.state.error as any;
      if (error?.status === 401 || error?.status === 403 || error?.isForbidden) return false;
      return 30_000;
    },
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.status === 403 || error?.isForbidden) return false;
      return failureCount < 1;
    },
    enabled: isEnabled,
  });
}

export function useApprovalMetrics(options?: { enabled?: boolean }) {
  const isEnabled = options?.enabled ?? true;
  return useQuery<ApprovalMetrics>({
    queryKey: adminKeys.approvalMetrics,
    queryFn: () => api.get("/admin/approvals/metrics"),
    refetchInterval: (query) => {
      if (!isEnabled) return false;
      const error = query.state.error as any;
      if (error?.status === 401 || error?.status === 403 || error?.isForbidden) return false;
      return 30_000;
    },
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.status === 403 || error?.isForbidden) return false;
      return failureCount < 1;
    },
    enabled: isEnabled,
  });
}

export function useEmployeeApprovals(employeeId?: string, options?: { enabled?: boolean }) {
  const isEnabled = Boolean(employeeId) && (options?.enabled ?? true);
  return useQuery<ApprovalsResponse>({
    queryKey: ["admin", "employees", employeeId, "approvals"],
    queryFn: () => api.get(`/admin/employees/${employeeId}/approvals`),
    enabled: isEnabled,
    refetchInterval: (query) => {
      if (!isEnabled) return false;
      const error = query.state.error as any;
      if (error?.status === 401 || error?.status === 403 || error?.isForbidden) return false;
      return 30_000;
    },
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.status === 403 || error?.isForbidden) return false;
      return failureCount < 1;
    },
  });
}

export function useApproveRequest() {
  const qc = useQueryClient();
  return useMutation<{ success: boolean; message?: string }, Error, { id: string; decisionRemark: string }>({
    mutationFn: ({ id, decisionRemark }) =>
      api.post(`/approvals/${id}/approve`, { decisionRemark }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.approvals });
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useRejectRequest() {
  const qc = useQueryClient();
  return useMutation<{ success: boolean; message?: string }, Error, { id: string; decisionRemark: string }>({
    mutationFn: ({ id, decisionRemark }) =>
      api.post(`/approvals/${id}/reject`, { decisionRemark }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.approvals });
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useAuditLogs(
  filters?: AuditLogQueryParams | Record<string, string>,
  options?: { enabled?: boolean; refetchInterval?: number }
) {
  const queryRecord: Record<string, string> = {};
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== "") {
        queryRecord[key] = String(value);
      }
    }
  }
  const params = new URLSearchParams(queryRecord).toString();
  return useQuery<AuditLogsResponse>({
    queryKey: adminKeys.auditLogs(queryRecord),
    queryFn: () => api.get(`/admin/audit-logs${params ? `?${params}` : ""}`),
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval,
  });
}

export function useAuditLogMetrics(options?: { enabled?: boolean }) {
  return useQuery<AuditLogMetrics>({
    queryKey: adminKeys.auditLogMetrics,
    queryFn: () => api.get("/admin/audit-logs/metrics"),
    enabled: options?.enabled ?? true,
    refetchInterval: 30_000,
  });
}

export async function downloadAuditLogsCsv(params?: AuditLogQueryParams | Record<string, string>): Promise<void> {
  const queryRecord: Record<string, string> = {};
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        queryRecord[key] = String(value);
      }
    }
  }
  const queryString = new URLSearchParams(queryRecord).toString();
  const token = localStorage.getItem("legalos_token") || localStorage.getItem("auth_token") || localStorage.getItem("token") || "";
  const url = `/api/admin/audit-logs/export${queryString ? `?${queryString}` : ""}`;
  
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  
  if (!res.ok) {
    throw new Error("Failed to export audit logs");
  }
  
  const blob = await res.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = downloadUrl;
  const contentDisposition = res.headers.get("content-disposition");
  let filename = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^"]+)"?/);
    if (match && match[1]) filename = match[1];
  }
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(downloadUrl);
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
// Storage (Application Filesystem Storage)
// ---------------------------------------------------------------------------

export interface StorageConfig {
  configured: boolean;
  provider?: string;
  storagePath?: string;
  url?: string;
  username?: string;
  rootPath?: string;
  passwordSet?: boolean;
  writable?: boolean;
  status?: "active" | "error";
  error?: string;
}

export interface SaveStorageConfigPayload {
  url?: string;
  username?: string;
  password?: string;
  rootPath?: string;
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
  return useMutation<TestConnectionResult, Error, Partial<SaveStorageConfigPayload> | void>({
    mutationFn: (data) => api.post("/admin/storage/test-connection", data || {}),
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

// ---------------------------------------------------------------------------
// Active sessions management
// ---------------------------------------------------------------------------

export interface ActiveSession {
  _id: string;
  ip: string;
  userAgent: string;
  rememberMe: boolean;
  createdAt: string;
  lastActiveAt: string;
  isCurrent: boolean;
}

export function useActiveSessions() {
  return useQuery<{ sessions: ActiveSession[] }>({
    queryKey: ["auth", "sessions"],
    queryFn: () => api.get("/auth/sessions"),
  });
}

export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation<{ message: string }, Error, string>({
    mutationFn: (id) => api.delete(`/auth/sessions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auth", "sessions"] });
    },
  });
}

export function useRevokeAllOtherSessions() {
  const qc = useQueryClient();
  return useMutation<{ message: string }, Error, void>({
    mutationFn: () => api.delete("/auth/sessions"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auth", "sessions"] });
    },
  });
}

