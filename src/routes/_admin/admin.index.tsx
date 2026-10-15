import { createFileRoute, Link } from "@tanstack/react-router";
import { UserCog, ScrollText, Calendar, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useReportsSummary, useEmployeeWorkload } from "@/services/reports";
import { useApprovals, useAuditLogs } from "@/services/admin";
import { AdminKpiRow } from "@/components/admin/dashboard/AdminKpiRow";
import { AdminApprovalQueue } from "@/components/admin/dashboard/AdminApprovalQueue";
import { AdminTeamCapacity } from "@/components/admin/dashboard/AdminTeamCapacity";
import { AdminRecentActivity } from "@/components/admin/dashboard/AdminRecentActivity";

export const Route = createFileRoute("/_admin/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Console · S & S Legal-Tech LLP" },
      {
        name: "description",
        content:
          "Firm-wide administration: team capacity, approval queue, audit trail and governance controls.",
      },
      { property: "og:title", content: "Admin Console · S & S Legal-Tech LLP" },
      {
        property: "og:description",
        content: "Team capacity, approvals, audit trail and governance in one console.",
      },
    ],
  }),
  component: AdminDashboard,
});

export function AdminDashboard() {
  const { user } = useAuth();

  // Queries for KPI row
  const { data: summary, isLoading: summaryLoading } = useReportsSummary();
  const { data: approvalsData, isLoading: approvalsLoading } = useApprovals();
  const { data: workloadData, isLoading: workloadLoading } = useEmployeeWorkload();
  const { data: auditData, isLoading: auditLoading } = useAuditLogs({ limit: "10" });

  const approvals = approvalsData?.approvals ?? [];
  const workloads = workloadData?.workloads ?? [];
  const logs = auditData?.logs ?? [];

  const pendingApprovalsCount = approvalsLoading ? "…" : (approvalsData?.total ?? approvals.length);
  const teamMembersCount = workloadLoading ? "…" : workloads.length;
  const activeCasesCount = summaryLoading ? "…" : (summary?.activeCases ?? 0);
  const clientsCount = summaryLoading ? "…" : (summary?.totalClients ?? 0);
  const docsApprovedCount = summaryLoading ? "…" : (summary?.docsApproved ?? 0);
  const auditEventsCount = auditLoading ? "…" : (auditData?.total ?? logs.length);

  const greetingTitle = user?.name ? `Welcome back, ${user.name} 👋` : "Firm administration";

  // Current month formatting e.g. "Oct 2026"
  const currentMonthLabel = new Date().toLocaleString("en-US", {
    month: "short",
    year: "numeric",
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Dashboard Administrative Header */}
      <PageHeader
        breadcrumb={[{ label: "Admin", to: "/admin" }, { label: "Console" }]}
        title={greetingTitle}
        subtitle="Here's what's happening across your firm today."
        actions={
          <div className="flex items-center gap-2">
            {/* Date Pill matching reference image */}
            <div className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-2xs">
              <Calendar size={14} className="text-muted-foreground" />
              <span>{currentMonthLabel}</span>
            </div>

            <Button variant="outline" size="sm" className="rounded-xl gap-1.5 font-medium shadow-2xs" asChild>
              <Link to="/admin/audit-logs">
                <ScrollText size={15} strokeWidth={1.75} />
                <span className="hidden sm:inline">Audit trail</span>
              </Link>
            </Button>
            <Button
              size="sm"
              className="gradient-primary rounded-xl text-primary-foreground font-semibold shadow-soft transition-transform duration-200 hover:-translate-y-0.5 gap-1.5"
              asChild
            >
              <Link to="/admin/employees">
                <UserCog size={15} strokeWidth={2} />
                <span>Manage team</span>
              </Link>
            </Button>
          </div>
        }
      />

      {/* Responsive Row of Six KPI Metric Cards */}
      <AdminKpiRow
        pendingApprovalsCount={pendingApprovalsCount}
        teamMembersCount={teamMembersCount}
        activeCasesCount={activeCasesCount}
        clientsCount={clientsCount}
        docsApprovedCount={docsApprovedCount}
        auditEventsCount={auditEventsCount}
        periodHint={summary?.period || "30 days"}
      />

      {/* Operational Center: Approval Queue (60%) & Team Capacity (40%) */}
      <div className="grid gap-6 grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <AdminApprovalQueue />
        <AdminTeamCapacity />
      </div>

      {/* Firm-Wide Recent Activity Feed */}
      <AdminRecentActivity />
    </div>
  );
}
