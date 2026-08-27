import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Briefcase, Users, CheckSquare, UserCog, ShieldCheck, Gavel, FileText,
  Activity as ActivityIcon, ArrowRight, Plus, ChevronDown, CalendarDays,
  AlertTriangle, Clock3, PhoneCall, Loader2, Check, X,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard, StatCard } from "@/components/common/Surface";
import { StatusPill, toneForStatus } from "@/components/common/StatusPill";
import { ErrorState } from "@/components/common/ErrorState";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/auth";
import { useReportsSummary } from "@/services/reports";
import { useCalendarEvents, type CalendarEvent } from "@/services/calendar";
import { useCases } from "@/services/cases";
import { useDocuments, useUpdateDocument, useReviewAccessRequest } from "@/services/documents";
import { useEmployeeWorkload } from "@/services/reports";
import { useApprovals } from "@/services/admin";
import { useAuditLogs } from "@/services/admin";
import { QuickActionsMenu } from "@/components/layout/QuickActionsMenu";

export const Route = createFileRoute("/_shell/")({
  head: () => ({
    meta: [
      { title: "Today · StillWorks LegalOS" },
      { name: "description", content: "A calm daily command centre for your firm: hearings, approvals, tasks and live activity in one view." },
      { property: "og:title", content: "Today · StillWorks LegalOS" },
      { property: "og:description", content: "Hearings, approvals, tasks and live activity in one calm view." },
    ],
  }),
  component: Dashboard,
});

const toneRing: Record<string, string> = {
  primary: "bg-primary",
  indigo: "bg-indigo",
  violet: "bg-violet",
};

/** Resolve an approval `_id` back into the document + (optional) access-request ids. */
function approvalTarget(a: { kind: string; _id: string }): { docId: string; requestId?: string } {
  if (a.kind === "Access Request") {
    const marker = "_access_";
    const idx = a._id.indexOf(marker);
    if (idx >= 0) return { docId: a._id.slice(0, idx), requestId: a._id.slice(idx + marker.length) };
  }
  return { docId: a._id };
}

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";
  const updateDocument = useUpdateDocument();
  const reviewAccessRequest = useReviewAccessRequest();
  const [actingOn, setActingOn] = useState<string | null>(null);
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const todayEnd = `${todayStr}T23:59:59`;

  const { data: summary, isLoading: summaryLoading } = useReportsSummary();
  const { data: eventsData, isLoading: hearingsLoading, isError: hearingsError, refetch: refetchHearings } = useCalendarEvents({ start: todayStr, end: todayEnd });
  const { data: casesData, isLoading: casesLoading, isError: casesError, refetch: refetchCases } = useCases({ page: "1", limit: "4" });
  const { data: docsData, isLoading: docsLoading, isError: docsError, refetch: refetchDocs } = useDocuments({ page: "1", limit: "4" });
  const { data: workloadData, isError: workloadError, refetch: refetchWorkload } = useEmployeeWorkload();
  const { data: approvalsData, isError: approvalsError, refetch: refetchApprovals } = useApprovals({ enabled: isAdmin });
  const { data: auditData, isLoading: auditLoading, isError: auditError, refetch: refetchAudit } = useAuditLogs({ limit: "8" }, { enabled: isAdmin });

  const hearings: CalendarEvent[] = (eventsData?.events ?? []).filter((e) => e.type === "hearing");
  const cases = casesData?.cases ?? [];
  const documents = docsData?.documents ?? [];
  const approvals = approvalsData?.approvals ?? [];
  const activity = auditData?.logs ?? [];
  const team = workloadData?.workloads ?? [];

  const dateStr = today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  const runApproval = (a: { kind: string; _id: string }, action: "approved" | "rejected") => {
    const target = approvalTarget(a);
    setActingOn(a._id);
    const onSettled = () => setActingOn(null);
    if (target.requestId) {
      reviewAccessRequest.mutate(
        { docId: target.docId, requestId: target.requestId, status: action },
        { onSettled },
      );
    } else {
      updateDocument.mutate(
        { id: target.docId, data: { state: action === "approved" ? "Approved" : "Rejected" } },
        { onSettled },
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={[{ label: "StillWorks", to: "/" }, { label: "Dashboard" }]}
        title="What should I work on today?"
        subtitle={`${dateStr} · ${hearings.length} hearings, ${approvals.length} approvals waiting.`}
        actions={
          <>
            <Button variant="outline" className="rounded-md" onClick={() => navigate({ to: "/calendar" })}>
              <CalendarDays size={17} strokeWidth={1.75} /> Open calendar
            </Button>
            <QuickActionsMenu
              renderTrigger={(toggle) => (
                <Button
                  className="gradient-primary rounded-md text-primary-foreground shadow-soft transition-transform duration-200 hover:-translate-y-0.5"
                  onClick={toggle}
                >
                  <Plus size={17} strokeWidth={2} />
                  Quick action
                  <ChevronDown size={15} strokeWidth={1.75} />
                </Button>
              )}
            />
          </>
        }
      />

      {/* ── Stat cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          label="Today's hearings"
          value={hearingsLoading ? "…" : hearings.length}
          hint="Next at 10:30 AM"
          icon={Gavel}
          accent
        />
        <StatCard
          label="Active cases"
          value={summaryLoading ? "…" : summary?.activeCases ?? 0}
          hint="Firm-wide"
          icon={Briefcase}
        />
        <StatCard
          label="Clients"
          value={summaryLoading ? "…" : summary?.totalClients ?? 0}
          hint={summary?.period ?? ""}
          icon={Users}
        />
        <StatCard
          label="Tasks done"
          value={summaryLoading ? "…" : summary?.tasksCompleted ?? 0}
          hint={summary?.period ?? ""}
          icon={CheckSquare}
        />
        <StatCard
          label="Pending approval"
          value={approvals.length}
          hint="Needs review"
          icon={ShieldCheck}
        />
        <StatCard
          label="Team on duty"
          value={team.length}
          hint={`${team.filter((t) => t.status === "active").length} active`}
          icon={UserCog}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* ── Left column ── */}
        <div className="space-y-6">
          {/* Needs attention */}
          <SectionCard title="Needs your attention" description="Priority items that require immediate action." icon={AlertTriangle}>
            {hearingsError || approvalsError ? (
              <ErrorState
                title="Couldn't load your attention items"
                onRetry={() => { refetchHearings(); refetchApprovals(); }}
              />
            ) : (
              <ul className="space-y-3">
                {hearings.length === 0 && approvals.length === 0 && (
                  <li className="py-8 text-center text-helper text-muted-foreground">All caught up! Nothing needs attention right now.</li>
                )}
                {hearings.slice(0, 2).map((h) => (
                  <li key={h._id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-4 rounded-md border border-border bg-card p-4">
                    <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><Gavel size={17} strokeWidth={1.75} /></span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">Hearing</p>
                      <p className="mt-0.5 truncate text-helper text-muted-foreground">{h.title}</p>
                      <p className="mt-1 num text-caption text-muted-foreground">{new Date(h.start).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                    <StatusPill tone="primary">Hearing</StatusPill>
                  </li>
                ))}
                {approvals.slice(0, 1).map((a) => (
                  <li key={a._id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-4 rounded-md border border-border bg-card p-4">
                    <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-md bg-warning/10 text-warning"><ShieldCheck size={17} strokeWidth={1.75} /></span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{a.kind}</p>
                      <p className="mt-0.5 truncate text-helper text-muted-foreground">{a.title}</p>
                      <p className="mt-1 num text-caption text-muted-foreground">{a.context}</p>
                    </div>
                    <StatusPill tone="warning">Pending</StatusPill>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Today's hearings */}
          <SectionCard
            title="Today's hearings"
            description="Your schedule in court today."
            icon={Gavel}
            action={
              <Button variant="ghost" size="sm" className="rounded-sm" onClick={() => navigate({ to: "/calendar" })}>
                View all <ArrowRight size={15} strokeWidth={1.75} />
              </Button>
            }
          >
            {hearingsLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" size={20} /></div>
            ) : hearingsError ? (
              <ErrorState title="Couldn't load today's hearings" onRetry={refetchHearings} />
            ) : hearings.length === 0 ? (
              <p className="py-8 text-center text-helper text-muted-foreground">No hearings scheduled for today.</p>
            ) : (
              <ol className="relative space-y-4 border-l border-border pl-6">
                {hearings.map((h) => (
                  <li key={h._id} className="relative">
                    <span className="absolute top-2 -left-[1.9rem] size-2.5 rounded-full ring-4 ring-card bg-primary" />
                    <div className="lift grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-md border border-border bg-card p-4">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{h.title}</p>
                      </div>
                      <span className="num shrink-0 rounded-pill bg-muted px-3 py-1 text-caption">
                        {new Date(h.start).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>

          {/* Approvals */}
          {approvals.length > 0 && (
            <SectionCard
              title="Pending approval"
              description="Requests waiting on you."
              icon={ShieldCheck}
              action={
                <Button variant="ghost" size="sm" className="rounded-sm" onClick={() => navigate({ to: "/admin/approvals" })}>
                  Approval centre <ArrowRight size={15} strokeWidth={1.75} />
                </Button>
              }
            >
              <ul className="space-y-3">
                {approvals.slice(0, 3).map((a) => (
                  <li key={a._id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-md border border-border p-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <StatusPill tone="primary">{a.kind}</StatusPill>
                        <span className="text-caption text-muted-foreground">{a.when ? new Date(a.when).toLocaleDateString() : ""}</span>
                      </div>
                      <p className="mt-2 truncate font-medium">{a.title}</p>
                      <p className="truncate text-helper text-muted-foreground">{a.context}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-sm"
                        onClick={() => runApproval(a, "rejected")}
                        disabled={actingOn === a._id}
                      >
                        <X size={15} strokeWidth={1.75} />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        className="gradient-primary rounded-sm text-primary-foreground"
                        onClick={() => runApproval(a, "approved")}
                        disabled={actingOn === a._id}
                      >
                        {actingOn === a._id ? <Loader2 size={15} strokeWidth={1.75} className="animate-spin" /> : <Check size={15} strokeWidth={1.75} />}
                        Approve
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {/* Recent cases */}
          <SectionCard title="Recent cases" description="Latest movement in your matters." icon={Briefcase}>
            {casesLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" size={20} /></div>
            ) : casesError ? (
              <ErrorState title="Couldn't load recent cases" onRetry={refetchCases} />
            ) : cases.length === 0 ? (
              <p className="py-8 text-center text-helper text-muted-foreground">No cases yet. Add your first case to get started.</p>
            ) : (
              <ul className="space-y-3">
                {cases.slice(0, 4).map((c) => (
                  <li key={c._id}>
                    <Link to="/cases/$caseId" params={{ caseId: c._id }}
                      className="lift grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-md border border-border p-4">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{c.title}</p>
                        <p className="num mt-0.5 truncate text-caption text-muted-foreground">
                          {c.number} · {c.court}
                        </p>
                      </div>
                      <StatusPill tone={toneForStatus(c.status)}>{c.status}</StatusPill>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        {/* ── Right column ── */}
        <div className="space-y-6">
          {/* Live activity */}
          {isAdmin && (
            <SectionCard title="Live activity" description="What the team just did." icon={ActivityIcon}>
              {auditLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" size={20} /></div>
              ) : auditError ? (
                <ErrorState title="Couldn't load activity" onRetry={refetchAudit} />
              ) : activity.length === 0 ? (
                <p className="py-8 text-center text-helper text-muted-foreground">No recent activity to show.</p>
              ) : (
                <ul className="space-y-4">
                  {activity.slice(0, 6).map((a) => (
                    <li key={a._id} className="flex gap-3">
                      <span className="mt-1 grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-caption font-semibold text-primary">
                        {(a.userName ?? "?").slice(0, 1)}
                      </span>
                      <p className="min-w-0 text-helper">
                        <span className="font-medium">{a.userName}</span>{" "}
                        <span className="text-muted-foreground">{a.action.replace(/_/g, " ")} {a.resourceName ?? a.resource}</span>
                        <span className="block text-caption text-muted-foreground/80">
                          {new Date(a.createdAt).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
                        </span>
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          )}

          {/* Team status */}
          <SectionCard title="Team status" description="Who's working on what." icon={UserCog}>
            {workloadError ? (
              <ErrorState title="Couldn't load team status" onRetry={refetchWorkload} />
            ) : team.length === 0 ? (
              <p className="py-8 text-center text-helper text-muted-foreground">No team data available.</p>
            ) : (
              <ul className="space-y-4">
                {team.slice(0, 4).map((t) => (
                  <li key={t._id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <p className="truncate text-helper font-medium">{t.name}</p>
                        <StatusPill tone={t.status === "active" ? "success" : "muted"}>{t.status}</StatusPill>
                      </div>
                      {t.currentTask && (
                        <div className="text-sm text-muted-foreground">
                          Current: {t.currentTask.title}{" "}
                          <StatusPill
                            tone={t.currentTask.priority === "High" ? "destructive" : t.currentTask.priority === "Medium" ? "warning" : "neutral"}
                          >
                            {t.currentTask.priority}
                          </StatusPill>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <Progress value={t.workload} className="h-1.5" />
                      <span className="num shrink-0 text-caption text-muted-foreground">{t.workload}%</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Recent documents */}
          <SectionCard title="Recent documents" description="Freshly uploaded files." icon={FileText}>
            {docsLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" size={20} /></div>
            ) : docsError ? (
              <ErrorState title="Couldn't load documents" onRetry={refetchDocs} />
            ) : documents.length === 0 ? (
              <p className="py-8 text-center text-helper text-muted-foreground">No documents uploaded yet.</p>
            ) : (
              <ul className="space-y-3">
                {documents.slice(0, 4).map((d) => (
                  <li key={d._id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                    <span className="num grid size-9 shrink-0 place-items-center rounded-sm bg-muted text-caption font-semibold text-muted-foreground">
                      {(d.kind ?? "DOC").slice(0, 3)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-helper font-medium">{d.name}</p>
                      <p className="truncate text-caption text-muted-foreground">{d.size}</p>
                    </div>
                    <StatusPill tone={toneForStatus(d.state)}>{d.state}</StatusPill>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Work completed */}
          <SectionCard title="Firm overview" description="Key metrics." icon={Clock3}>
            <dl className="grid grid-cols-2 gap-4">
              {[
                ["Active Cases", String(summary?.activeCases ?? "—")],
                ["Total Clients", String(summary?.totalClients ?? "—")],
                ["Tasks Completed", String(summary?.tasksCompleted ?? "—")],
                ["Docs Approved", String(summary?.docsApproved ?? "—")],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md bg-muted/60 p-4">
                  <dt className="text-caption text-muted-foreground">{label}</dt>
                  <dd className="num mt-1 text-section font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}