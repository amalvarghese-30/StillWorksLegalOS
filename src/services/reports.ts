import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { useCases } from "./cases";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SummaryResponse {
  totalClients: number;
  activeCases: number;
  tasksCompleted: number;
  docsApproved: number;
  period: string;
}

export interface CaseGrowthPoint {
  month: string;
  cases: number;
  closed: number;
}

export interface CaseGrowthResponse {
  growth: CaseGrowthPoint[];
}

export interface PracticeAreaItem {
  name: string;
  value: number;
}

export interface PracticeAreasResponse {
  distribution: PracticeAreaItem[];
}

export interface WorkloadItem {
  _id: string;
  name: string;
  role: string;
  status: string;
  avatarUrl?: string;
  activeCases: number;
  pendingTasks: number;
  completedTasks: number;
  currentTask?: {
    _id: string;
    title: string;
    priority: "High" | "Medium" | "Low";
    deadline: string | null;
  } | null;
  workload: number;
}

export interface EmployeeWorkloadResponse {
  workloads: WorkloadItem[];
}

export interface TopClientItem {
  name: string;
  cases: number;
}

export interface TopClientsResponse {
  topClients: TopClientItem[];
}

export interface CaseStatusBreakdown {
  Active: number;
  "On Hold": number;
  Closed: number;
  Urgent: number;
}

export interface CaseStatusBreakdownResponse {
  breakdown: CaseStatusBreakdown;
  total?: number;
}

export interface TaskStatusBreakdown {
  pending: number;
  in_progress: number;
  pending_approval: number;
  overdue: number;
  completed: number;
}

export interface TaskStatusBreakdownResponse {
  breakdown: TaskStatusBreakdown;
  total: number;
}

export interface PerformanceItem {
  label: string;
  done: number;
  total: number;
}

export interface DailyEmployeeTaskItem {
  _id: string;
  title: string;
  priority: "High" | "Medium" | "Low";
  status: string;
  deadline?: string | null;
  caseId?: { _id: string; title: string; number: string } | null;
  clientId?: { _id: string; name: string; phone?: string } | null;
}

export interface DailyEmployeeAuditLogItem {
  _id: string;
  action: string;
  resource: string;
  resourceId?: string;
  resourceName?: string;
  details?: string;
  createdAt: string;
  ip?: string;
}

export interface DailyEmployeeCaseItem {
  _id: string;
  number: string;
  title: string;
  court?: string;
  practice?: string;
  status: string;
  priority?: string;
  nextHearing?: string | null;
  updatedAt?: string;
  completedAt?: string;
  parties?: Array<{ name: string; role?: string; type?: string }>;
}

export interface EmployeeAllTimeReport {
  tasksCompleted: number;
  tasksAssigned: number;
  tasksPending: number;
  tasksOverdue: number;
  completionRate: number;
  activeCasesCount: number;
  totalCasesCount: number;
  closedCasesCount: number;
  totalAuditLogsCount: number;
  recentAuditLogs: DailyEmployeeAuditLogItem[];
  activeCases: DailyEmployeeCaseItem[];
}

export interface EmployeeDailyReport {
  employee: {
    _id: string;
    name: string;
    email: string;
    role: string;
    title?: string;
    status: string;
  };
  metrics: {
    assignedTodayCount: number;
    completedTodayCount: number;
    pendingCount: number;
    overdueCount: number;
    auditLogsTodayCount?: number;
    casesWorkedTodayCount?: number;
    casesCompletedTodayCount?: number;
  };
  tasks: {
    assignedToday: DailyEmployeeTaskItem[];
    completedToday: DailyEmployeeTaskItem[];
    pending: DailyEmployeeTaskItem[];
    overdue: DailyEmployeeTaskItem[];
  };
  cases?: {
    completedToday: DailyEmployeeCaseItem[];
    workedOnToday: DailyEmployeeCaseItem[];
  };
  auditLogs?: DailyEmployeeAuditLogItem[];
  allTime?: EmployeeAllTimeReport;
}

export interface DailyEmployeeReportResponse {
  date: string;
  reports: EmployeeDailyReport[];
}

export interface MyPerformanceResponse {
  performance: PerformanceItem[];
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const reportKeys = {
  all: ["reports"] as const,
  summary: ["reports", "summary"] as const,
  caseGrowth: ["reports", "caseGrowth"] as const,
  practiceAreas: ["reports", "practiceAreas"] as const,
  employeeWorkload: ["reports", "employeeWorkload"] as const,
  topClients: ["reports", "topClients"] as const,
  caseStatusBreakdown: ["reports", "caseStatusBreakdown"] as const,
  taskStatusBreakdown: ["reports", "taskStatusBreakdown"] as const,
  myPerformance: ["reports", "myPerformance"] as const,
  dailyEmployee: (date?: string, employeeId?: string) => ["reports", "dailyEmployee", date ?? "", employeeId ?? ""] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useReportsSummary() {
  return useQuery<SummaryResponse>({
    queryKey: reportKeys.summary,
    queryFn: () => api.get("/admin/reports/summary"),
    refetchInterval: 60_000,
  });
}

export function useCaseGrowth() {
  return useQuery<CaseGrowthResponse>({
    queryKey: reportKeys.caseGrowth,
    queryFn: () => api.get("/admin/reports/case-growth"),
  });
}

export function usePracticeAreas() {
  return useQuery<PracticeAreasResponse>({
    queryKey: reportKeys.practiceAreas,
    queryFn: () => api.get("/admin/reports/practice-areas"),
  });
}

export function useEmployeeWorkload() {
  return useQuery<EmployeeWorkloadResponse>({
    queryKey: reportKeys.employeeWorkload,
    queryFn: () => api.get("/admin/reports/employee-workload"),
    refetchInterval: 30_000,
  });
}

export function useTopClients() {
  return useQuery<TopClientsResponse>({
    queryKey: reportKeys.topClients,
    queryFn: () => api.get("/admin/reports/top-clients"),
  });
}

export function useMyPerformance(enabled = true) {
  return useQuery<MyPerformanceResponse>({
    queryKey: reportKeys.myPerformance,
    queryFn: () => api.get("/admin/reports/my-performance"),
    enabled,
  });
}

export function useDailyEmployeeReport(params?: { date?: string; employeeId?: string }, enabled = true) {
  const dateStr = params?.date ?? "";
  const empId = params?.employeeId ?? "";
  const query = new URLSearchParams();
  if (dateStr) query.set("date", dateStr);
  if (empId) query.set("employeeId", empId);
  const qStr = query.toString();
  const endpoint = `/admin/reports/daily-employee${qStr ? `?${qStr}` : ""}`;

  return useQuery<DailyEmployeeReportResponse>({
    queryKey: reportKeys.dailyEmployee(dateStr, empId),
    queryFn: () => api.get(endpoint),
    enabled,
    refetchInterval: 60_000,
  });
}

export function useCaseStatusBreakdown() {
  return useQuery<CaseStatusBreakdownResponse>({
    queryKey: reportKeys.caseStatusBreakdown,
    queryFn: () => api.get("/admin/reports/case-status-breakdown"),
    refetchInterval: 60_000,
  });
}

export function useTaskStatusBreakdown() {
  return useQuery<TaskStatusBreakdownResponse>({
    queryKey: reportKeys.taskStatusBreakdown,
    queryFn: () => api.get("/admin/reports/task-status-breakdown"),
    refetchInterval: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Client Reports & Drilldown Types & Hooks
// ---------------------------------------------------------------------------

export interface ClientReportItem {
  _id: string;
  name: string;
  email: string;
  phone: string;
  type: "Individual" | "Corporate";
  tag: string;
  kyc: string;
  promisedCompletionDate: string | null;
  visitCount: number;
  lastVisitAt: string | null;
  metrics: {
    activeCases: number;
    totalCases: number;
    pendingTasks: number;
    completedTasks: number;
    documentCount: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ClientReportsResponse {
  clients: ClientReportItem[];
}

export interface ClientVisitItem {
  _id?: string;
  visitedAt: string;
  purpose: string;
  notes?: string;
  caseId?: string;
  handledBy?: { _id: string; name: string; email: string };
  recordedBy?: { _id: string; name: string; email: string };
}

export interface ClientDetailReportResponse {
  client: {
    _id: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    type: "Individual" | "Corporate";
    tag: string;
    kyc: string;
    notes?: string;
    promisedCompletionDate?: string | null;
    visits?: ClientVisitItem[];
    subClients?: Array<{ name: string; relationship: string; phone?: string; email?: string }>;
    propertyDetails?: { address?: string; surveyNo?: string; chsName?: string; sector?: string; plot?: string; area?: string };
    assignedTo?: Array<{ _id: string; name: string; email: string; role?: string }>;
    createdAt: string;
    updatedAt: string;
  };
  metrics: {
    totalCases: number;
    activeCases: number;
    closedCases: number;
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    overdueTasks: number;
    totalDocuments: number;
    totalVisits: number;
  };
  cases: Array<{
    _id: string;
    number: string;
    courtCaseId?: string;
    title: string;
    practice?: string;
    court?: string;
    status: string;
    priority: string;
    nextHearing?: string | null;
    assignedTo?: { _id: string; name: string; email: string } | null;
    createdAt: string;
    updatedAt: string;
  }>;
  tasks: Array<{
    _id: string;
    title: string;
    priority: "High" | "Medium" | "Low";
    status: string;
    deadline?: string | null;
    assignedTo?: { _id: string; name: string; email: string } | null;
    caseId?: { _id: string; title: string; number: string; courtCaseId?: string } | null;
    createdAt: string;
  }>;
  documents: Array<{
    _id: string;
    name: string;
    kind: string;
    sizeFormatted?: string;
    state: string;
    createdAt: string;
    uploadedBy?: { _id: string; name: string } | null;
    caseId?: { _id: string; title: string; number: string } | null;
  }>;
  auditLogs: Array<{
    _id: string;
    action: string;
    resource: string;
    details?: string;
    createdAt: string;
    userName?: string;
  }>;
}

export interface EmployeeDetailReportResponse {
  employee: {
    _id: string;
    name: string;
    email: string;
    role: string;
    title?: string;
    status: string;
    createdAt: string;
  };
  metrics: {
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    overdueTasks: number;
    completionRate: number;
    totalCases: number;
    activeCases: number;
    closedCases: number;
    totalAuditLogs: number;
  };
  tasks: Array<{
    _id: string;
    title: string;
    priority: "High" | "Medium" | "Low";
    status: string;
    deadline?: string | null;
    caseId?: { _id: string; title: string; number: string; courtCaseId?: string } | null;
    clientId?: { _id: string; name: string; phone?: string } | null;
    createdAt: string;
    updatedAt: string;
  }>;
  cases: Array<{
    _id: string;
    number: string;
    title: string;
    court?: string;
    practice?: string;
    status: string;
    priority?: string;
    nextHearing?: string | null;
    completedAt?: string;
    updatedAt: string;
  }>;
  auditLogs: Array<{
    _id: string;
    action: string;
    resource: string;
    resourceName?: string;
    details?: string;
    createdAt: string;
  }>;
}

export function useClientReports(params?: { search?: string; tag?: string; type?: string }) {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.tag) query.set("tag", params.tag);
  if (params?.type) query.set("type", params.type);
  const qStr = query.toString();
  return useQuery<ClientReportsResponse>({
    queryKey: ["reports", "clientReports", qStr],
    queryFn: () => api.get(`/admin/reports/client-reports${qStr ? `?${qStr}` : ""}`),
  });
}

export function useClientDetailReport(clientId: string | undefined) {
  return useQuery<ClientDetailReportResponse>({
    queryKey: ["reports", "clientDetail", clientId],
    queryFn: () => api.get(`/admin/reports/client-detail/${clientId}`),
    enabled: !!clientId,
  });
}

export function useEmployeeDetailReport(employeeId: string | undefined, dateRange?: { startDate?: string; endDate?: string }) {
  const query = new URLSearchParams();
  if (dateRange?.startDate) query.set("startDate", dateRange.startDate);
  if (dateRange?.endDate) query.set("endDate", dateRange.endDate);
  const qStr = query.toString();
  return useQuery<EmployeeDetailReportResponse>({
    queryKey: ["reports", "employeeDetail", employeeId, qStr],
    queryFn: () => api.get(`/admin/reports/employee-detail/${employeeId}${qStr ? `?${qStr}` : ""}`),
    enabled: !!employeeId,
  });
}
