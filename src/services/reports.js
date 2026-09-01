import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { useCases } from "./cases";
// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
export const reportKeys = {
    all: ["reports"],
    summary: ["reports", "summary"],
    caseGrowth: ["reports", "caseGrowth"],
    practiceAreas: ["reports", "practiceAreas"],
    employeeWorkload: ["reports", "employeeWorkload"],
    topClients: ["reports", "topClients"],
    caseStatusBreakdown: ["reports", "caseStatusBreakdown"],
    myPerformance: ["reports", "myPerformance"],
};
// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------
export function useReportsSummary() {
    return useQuery({
        queryKey: reportKeys.summary,
        queryFn: () => api.get("/admin/reports/summary"),
        refetchInterval: 60_000,
    });
}
export function useCaseGrowth() {
    return useQuery({
        queryKey: reportKeys.caseGrowth,
        queryFn: () => api.get("/admin/reports/case-growth"),
    });
}
export function usePracticeAreas() {
    return useQuery({
        queryKey: reportKeys.practiceAreas,
        queryFn: () => api.get("/admin/reports/practice-areas"),
    });
}
export function useEmployeeWorkload() {
    return useQuery({
        queryKey: reportKeys.employeeWorkload,
        queryFn: () => api.get("/admin/reports/employee-workload"),
        refetchInterval: 30_000,
    });
}
export function useTopClients() {
    return useQuery({
        queryKey: reportKeys.topClients,
        queryFn: () => api.get("/admin/reports/top-clients"),
    });
}
export function useMyPerformance(enabled = true) {
    return useQuery({
        queryKey: reportKeys.myPerformance,
        queryFn: () => api.get("/admin/reports/my-performance"),
        enabled,
    });
}
export function useCaseStatusBreakdown() {
    const { data: casesData } = useCases({ page: "1", limit: "1000" });
    const cases = casesData?.cases ?? [];
    const breakdown = {
        Active: 0,
        "On Hold": 0,
        Closed: 0,
        Urgent: 0,
    };
    for (const c of cases) {
        if (c.status === "Active")
            breakdown.Active++;
        else if (c.status === "On Hold")
            breakdown["On Hold"]++;
        else if (c.status === "Closed")
            breakdown.Closed++;
        else if (c.status === "Urgent")
            breakdown.Urgent++;
    }
    return { data: { breakdown } };
}
