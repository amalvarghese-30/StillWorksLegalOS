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
}

export interface PerformanceItem {
  label: string;
  done: number;
  total: number;
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
  myPerformance: ["reports", "myPerformance"] as const,
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

export function useCaseStatusBreakdown() {
  const { data: casesData } = useCases({ page: "1", limit: "1000" });
  const cases = casesData?.cases ?? [];

  const breakdown: CaseStatusBreakdown = {
    Active: 0,
    "On Hold": 0,
    Closed: 0,
    Urgent: 0,
  };

  for (const c of cases) {
    if (c.status === "Active") breakdown.Active++;
    else if (c.status === "On Hold") breakdown["On Hold"]++;
    else if (c.status === "Closed") breakdown.Closed++;
    else if (c.status === "Urgent") breakdown.Urgent++;
  }

  return { data: { breakdown } };
}
