import { createFileRoute, Link } from "@tanstack/react-router";
import {
  UserCog, ShieldCheck, ScrollText, Briefcase, Users, FileText,
  ArrowRight, Activity as ActivityIcon, Loader2, AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard, StatCard } from "@/components/common/Surface";
import { StatusPill } from "@/components/common/StatusPill";
import { ErrorState } from "@/components/common/ErrorState";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useReportsSummary } from "@/services/reports";
import { useApprovals, useAuditLogs } from "@/services/admin";
import { useEmployeeWorkload } from "@/services/reports";

export const Route = createFileRoute("/_admin/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Console · StillWorks LegalOS" },
      { name: "description", content: "Firm-wide administration: team capacity, approval queue, audit trail and governance controls." },
      { property: "og:title", content: "Admin Console · StillWorks LegalOS" },
      { property: "og:description", content: "Team capacity, approvals, audit trail and governance in one console." },
    ],
  }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data: summary, isLoading: summaryLoading } = useReportsSummary();
  const { data: approvalsData, isLoading: approvalsLoading, isError: approvalsError, refetch: refetchApprovals } = useApprovals();
  const { data: workloadData, isLoading: workloadLoading, isError: workloadError, refetch: refetchWorkload } = useEmployeeWorkload();
  const { data: auditData, isLoading: auditLoading, isError: auditError, refetch: refetchAudit } = useAuditLogs({ limit: "10" });

  const approvals = approvalsData?.approvals ?? [];
  const workloads = workloadData?.workloads ?? [];
  const logs = auditData?.logs ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={[{ label: "Admin", to: "/admin" }, { label: "Console" }]}
        title="Firm administration"
        subtitle="Governance, people and oversight — separate from the day-to-day case workspace."
        actions={
          <>
            <Button variant="outline" className="rounded-md" asChild>
              <Link to="/admin/audit-logs"><ScrollText size={17} strokeWidth={1.75} /> Audit trail</Link>
            </Button>
            <Button className="gradient-primary rounded-md text-primary-foreground shadow-soft transition-transform duration-200 hover:-translate-y-0.5" asChild>
              <Link to="/admin/employees"><UserCog size={17} strokeWidth={2} /> Manage team</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Pending approvals" value={approvalsLoading ? "…" : approvals.length} hint="Needs your sign-off" icon={ShieldCheck} accent />
        <StatCard label="Team members" value={workloadLoading ? "…" : workloads.length} hint="Roles & permissions" icon={UserCog} />
        <StatCard label="Active cases" value={summaryLoading ? "…" : summary?.activeCases ?? 0} hint="Firm-wide" icon={Briefcase} />
        <StatCard label="Clients" value={summaryLoading ? "…" : summary?.totalClients ?? 0} hint="On record" icon={Users} />
        <StatCard label="Docs approved" value={summaryLoading ? "…" : summary?.docsApproved ?? 0} hint={summary?.period ?? ""} icon={FileText} />
        <StatCard label="Audit events" value={auditLoading ? "…" : logs.length} hint="Recent" icon={ScrollText} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <SectionCard
          title="Approval queue"
          description="Requests waiting on an administrator"
          action={
            <Button variant="ghost" size="sm" className="rounded-md" asChild>
              <Link to="/admin/approvals">Open centre <ArrowRight size={15} strokeWidth={1.75} /></Link>
            </Button>
          }
        >
          {approvalsLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" size={20} /></div>
          ) : approvalsError ? (
            <ErrorState title="Couldn't load the approval queue" onRetry={refetchApprovals} />
          ) : approvals.length === 0 ? (
            <div className="py-8 text-center text-helper text-muted-foreground">All clear — nothing waiting for approval.</div>
          ) : (
            <ul className="divide-y divide-border/60">
              {approvals.slice(0, 5).map((a) => (
                <li key={a._id} className="flex items-center gap-3 py-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                    <ShieldCheck size={17} strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-helper font-medium">{a.title}</p>
                    <p className="truncate text-caption text-muted-foreground">{a.context}</p>
                  </div>
                  <StatusPill tone="primary">{a.kind}</StatusPill>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Team capacity" description="Workload across the firm">
          {workloadLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" size={20} /></div>
          ) : workloadError ? (
            <ErrorState title="Couldn't load team capacity" onRetry={refetchWorkload} />
          ) : workloads.length === 0 ? (
            <div className="py-8 text-center text-helper text-muted-foreground">No team data available yet.</div>
          ) : (
            <ul className="space-y-4">
              {workloads.slice(0, 6).map((w) => (
                <li key={w._id}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-helper font-medium">{w.name}</p>
                    <span className="num text-caption text-muted-foreground">{w.workload}%</span>
                  </div>
                  <p className="truncate text-caption text-muted-foreground">{w.role}</p>
                  <Progress value={w.workload} className="mt-2 h-1.5" />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Recent activity"
        description="Everything happening across the firm"
        action={
          <Button variant="ghost" size="sm" className="rounded-md" asChild>
            <Link to="/admin/audit-logs">Full audit log <ArrowRight size={15} strokeWidth={1.75} /></Link>
          </Button>
        }
      >
        {auditLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" size={20} /></div>
        ) : auditError ? (
          <ErrorState title="Couldn't load recent activity" onRetry={refetchAudit} />
        ) : logs.length === 0 ? (
          <div className="py-8 text-center text-helper text-muted-foreground">No activity recorded yet. Actions will appear here as the team works.</div>
        ) : (
          <ul className="divide-y divide-border/60">
            {logs.slice(0, 6).map((a) => (
              <li key={a._id} className="flex items-center gap-3 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-accent text-muted-foreground">
                  <ActivityIcon size={16} strokeWidth={1.75} />
                </span>
                <p className="min-w-0 flex-1 truncate text-helper">
                  <span className="font-medium">{a.userName}</span>{" "}
                  {a.action.replace(/_/g, " ")} {a.resourceName ?? a.resource}
                </p>
                <span className="shrink-0 text-caption text-muted-foreground">
                  {new Date(a.createdAt).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
