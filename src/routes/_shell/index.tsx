import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
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
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useSocketEvent } from "@/lib/socket";
import { useReportsSummary, useEmployeeWorkload, reportKeys } from "@/services/reports";
import { useCalendarEvents, type CalendarEvent } from "@/services/calendar";
import { useCases, useReviewCaseAccessRequest } from "@/services/cases";
import { useDocuments, useUpdateDocument, useReviewAccessRequest } from "@/services/documents";
import { useApprovals } from "@/services/admin";
import { useAuditLogs } from "@/services/admin";
import { useTasks, useUpdateTask, taskKeys, type TaskRecord } from "@/services/tasks";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import { QuickActionsMenu } from "@/components/layout/QuickActionsMenu";

export const Route = createFileRoute("/_shell/")({
  head: () => ({
    meta: [
      { title: "Today · S & S Legal-Tech LLP" },
      { name: "description", content: "A calm daily command centre for your firm: hearings, approvals, tasks and live activity in one view." },
      { property: "og:title", content: "Today · S & S Legal-Tech LLP" },
      { property: "og:description", content: "Hearings, approvals, tasks and live activity in one calm view." },
    ],
  }),
  component: Dashboard,
});

/** Resolve an approval `_id` back into the document + (optional) access-request ids or task id. */
function approvalTarget(a: { kind: string; _id: string }): { docId?: string; caseId?: string; requestId?: string; taskId?: string } {
  if (a.kind === "Task Completion" || a._id.startsWith("task_")) {
    return { taskId: a._id.replace(/^task_/, "") };
  }
  if (a.kind === "Case Request" || a._id.startsWith("case_")) {
    const marker = "_access_";
    const withoutPrefix = a._id.replace(/^case_/, "");
    const idx = withoutPrefix.indexOf(marker);
    if (idx >= 0) return { caseId: withoutPrefix.slice(0, idx), requestId: withoutPrefix.slice(idx + marker.length) };
  }
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
  const hasApprovalsAccess = isAdmin || user?.permissions?.approvals === true;
  const hasAuditAccess = isAdmin || user?.permissions?.auditLogs === true;
  const updateDocument = useUpdateDocument();
  const reviewAccessRequest = useReviewAccessRequest();
  const reviewCaseAccessRequest = useReviewCaseAccessRequest();
  const updateTask = useUpdateTask();
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null);
  const queryClient = useQueryClient();

  // Listen for real-time task mutations across all connected clients
  useSocketEvent("task:created", () => {
    queryClient.invalidateQueries({ queryKey: taskKeys.all });
    queryClient.invalidateQueries({ queryKey: reportKeys.all });
  });
  useSocketEvent("task:updated", () => {
    queryClient.invalidateQueries({ queryKey: taskKeys.all });
    queryClient.invalidateQueries({ queryKey: reportKeys.all });
  });
  useSocketEvent<{ taskId: string }>("task:deleted", (payload) => {
    queryClient.invalidateQueries({ queryKey: taskKeys.all });
    queryClient.invalidateQueries({ queryKey: reportKeys.all });
    if (payload?.taskId && selectedTask?._id === payload.taskId) {
      setSelectedTask(null);
    }
  });

  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0).toISOString();
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();

  const { data: summary, isLoading: summaryLoading } = useReportsSummary();
  const { data: eventsData, isLoading: hearingsLoading, isError: hearingsError, refetch: refetchHearings } = useCalendarEvents({ start: startOfDay, end: endOfDay });
  const { data: casesData, isLoading: casesLoading, isError: casesError, refetch: refetchCases } = useCases({ page: "1", limit: "4" });
  const { data: docsData, isLoading: docsLoading, isError: docsError, refetch: refetchDocs } = useDocuments({ page: "1", limit: "4" });
  const { data: workloadData, isError: workloadError, refetch: refetchWorkload } = useEmployeeWorkload();
  const { data: approvalsData, isError: approvalsError, refetch: refetchApprovals } = useApprovals({ enabled: hasApprovalsAccess });
  const { data: auditData, isLoading: auditLoading, isError: auditError, refetch: refetchAudit } = useAuditLogs({ limit: "8" }, { enabled: hasAuditAccess });
  const { data: tasksData, isLoading: tasksLoading, isError: tasksError, refetch: refetchTasks } = useTasks({ limit: "50" });

  const hearings: CalendarEvent[] = (eventsData?.events ?? []).filter((e) => e.type === "hearing");
  const rawCases = casesData?.cases ?? [];
  const cases = isAdmin
    ? rawCases
    : rawCases.filter((c) => {
        const assignedId = (c.assignedTo as any)?._id || (c.assignedTo as any);
        if (assignedId && String(assignedId) !== String(user?._id)) {
          return false;
        }
        return true;
      });
  const documents = docsData?.documents ?? [];
  const approvals = approvalsData?.approvals ?? [];
  const activity = auditData?.logs ?? [];
  const team = workloadData?.workloads ?? [];
  const allTasks = tasksData?.tasks ?? [];

  // Keep selectedTask in sync with latest queryClient/allTasks data
  useEffect(() => {
    if (selectedTask?._id && allTasks.length > 0) {
      const updated = allTasks.find((t) => t._id === selectedTask._id);
      if (updated && updated !== selectedTask) {
        setSelectedTask(updated);
      }
    }
  }, [allTasks, selectedTask?._id]);

  // Filter urgent / priority tasks for attention
  const attentionTasks = allTasks.filter((t) => {
    if (t.status === "completed") return false;
    const assignedId = typeof t.assignedTo === "object" && t.assignedTo ? (t.assignedTo as any)._id : t.assignedTo;
    const assignedUsers: string[] = Array.isArray((t as any).assignedUsers)
      ? (t as any).assignedUsers.map((u: any) => (typeof u === "object" && u ? u._id ?? u : u)?.toString())
      : [];
    const isAssignedToMe =
      assignedId?.toString() === user?._id?.toString() ||
      assignedUsers.includes(user?._id?.toString() ?? "");
    const isCreatedByMe = (typeof t.createdBy === "object" && t.createdBy ? (t.createdBy as any)._id : t.createdBy)?.toString() === user?._id?.toString();
    const isUrgentOrHigh = t.priority === "High" || (t.priority as string) === "Urgent";
    const isOverdue = t.status !== "pending_approval" && (t.status === "overdue" || (t.deadline ? new Date(t.deadline).getTime() < today.getTime() : false));
    const isDueToday = t.deadline ? new Date(t.deadline).toDateString() === today.toDateString() : false;

    const isChangesRequested = t.status !== "completed" && Boolean(t.rejectedAt || (t as any).rejectionReason);

    if (isAdmin) {
      return isUrgentOrHigh || isOverdue || isChangesRequested || (isAssignedToMe && isDueToday);
    } else {
      if (assignedId && !isAssignedToMe) {
        return false;
      }
      if (isAssignedToMe) {
        return isUrgentOrHigh || isOverdue || isDueToday || isChangesRequested;
      }
      if (!assignedId && (isCreatedByMe || isUrgentOrHigh)) {
        return isUrgentOrHigh || isOverdue || isDueToday || isChangesRequested;
      }
      return false;
    }
  });


  const dateStr = today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  const runApproval = (a: { kind: string; _id: string }, action: "approved" | "rejected") => {
    const target = approvalTarget(a);
    setActingOn(a._id);
    const onSettled = () => {
      setActingOn(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "approvals"] });
    };
    if (target.taskId) {
      updateTask.mutate(
        { id: target.taskId, data: { status: action === "approved" ? "completed" : "in_progress" } },
        { onSettled },
      );
    } else if (target.caseId && target.requestId) {
      reviewCaseAccessRequest.mutate(
        { caseId: target.caseId, requestId: target.requestId, status: action },
        { onSettled },
      );
    } else if (target.requestId && target.docId) {
      reviewAccessRequest.mutate(
        { docId: target.docId, requestId: target.requestId, status: action },
        { onSettled },
      );
    } else if (target.docId) {
      updateDocument.mutate(
        { id: target.docId, data: { state: action === "approved" ? "Approved" : "Rejected" } },
        { onSettled },
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={[{ label: "S & S", to: "/" }, { label: "Dashboard" }]}
        title="What should I work on today?"
        subtitle={`${dateStr} · ${hearings.length} hearings, ${attentionTasks.length} urgent tasks, ${approvals.length} approvals waiting.`}
        actions={
          <>
            {isAdmin && (
              <Button variant="outline" className="rounded-md gap-1.5" onClick={() => navigate({ to: "/admin" })}>
                <ShieldCheck size={16} strokeWidth={1.75} /> Admin console
              </Button>
            )}
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
      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          label="Today's hearings"
          value={hearingsLoading ? "…" : hearings.length}
          hint="Court appearances"
          icon={Gavel}
          accent
          to="/calendar"
        />
        <StatCard
          label="Urgent tasks"
          value={tasksLoading ? "…" : attentionTasks.length}
          hint="Requiring action"
          icon={AlertTriangle}
          to="/tasks"
        />
        <StatCard
          label="Active cases"
          value={summaryLoading ? "…" : summary?.activeCases ?? 0}
          hint="Firm-wide"
          icon={Briefcase}
          to="/cases"
        />
        <StatCard
          label="Clients"
          value={summaryLoading ? "…" : summary?.totalClients ?? 0}
          hint={summary?.period ?? "Active clients"}
          icon={Users}
          to="/clients"
        />
        <StatCard
          label="Tasks done"
          value={summaryLoading ? "…" : summary?.tasksCompleted ?? 0}
          hint={summary?.period ?? "Completed"}
          icon={CheckSquare}
          to="/tasks"
        />
        {isAdmin ? (
          <StatCard
            label="Admin console"
            value={approvals.length > 0 ? `${approvals.length} pending` : "Governance"}
            hint={approvals.length > 0 ? "Approvals waiting" : "Console & Team"}
            icon={ShieldCheck}
            to="/admin"
          />
        ) : (
          <StatCard
            label="Documents"
            value={docsLoading ? "…" : documents.length}
            hint="Vault files"
            icon={FileText}
            to="/documents"
          />
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* ── Left column ── */}
        <div className="space-y-6">
          {/* Needs attention */}
          <SectionCard title="Needs your attention" description="Priority items that require immediate action." icon={AlertTriangle}>
            {hearingsError || approvalsError || tasksError ? (
              <ErrorState
                title="Couldn't load your attention items"
                onRetry={() => { refetchHearings(); refetchApprovals(); refetchTasks(); }}
              />
            ) : (
              <ul className="space-y-3">
                {attentionTasks.length === 0 && hearings.length === 0 && approvals.length === 0 && (
                  <li className="py-8 text-center text-helper text-muted-foreground">All caught up! Nothing needs attention right now.</li>
                )}
                {/* Urgent & High-Priority Tasks */}
                {attentionTasks.slice(0, 4).map((t) => (
                  <li
                    key={t._id}
                    onClick={() => setSelectedTask(t)}
                    className="lift grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-4 rounded-md border border-destructive/25 bg-destructive/5 p-4 transition-all hover:border-destructive/40"
                  >
                    <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-md bg-destructive/15 text-destructive">
                      <AlertTriangle size={17} strokeWidth={2} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="truncate font-medium text-foreground">{t.title}</p>
                        <span className="shrink-0 rounded-pill bg-destructive/15 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                          {t.priority === "High" ? "High Priority" : t.priority}
                        </span>
                        {t.status === "pending_approval" ? (
                          <span className="shrink-0 rounded-pill bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 text-[10px] font-bold">
                            IN REVIEW
                          </span>
                        ) : (t.status !== "completed" && (t.rejectedAt || (t as any).rejectionReason)) ? (
                          <span className="shrink-0 rounded-pill bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold">
                            CHANGES REQUESTED
                          </span>
                        ) : (t.status === "overdue" || (t.deadline && new Date(t.deadline).getTime() < today.getTime())) ? (
                          <span className="shrink-0 rounded-pill bg-destructive text-destructive-foreground px-2 py-0.5 text-[10px] font-bold">
                            OVERDUE
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-helper text-muted-foreground">
                        {t.caseName ? `Case: ${t.caseName}` : t.clientName ? `Client: ${t.clientName}` : t.category || "Task"}
                        {t.description ? ` · ${t.description}` : ""}
                      </p>
                      {Boolean(t.status !== "completed" && ((t as any).rejectionReason || t.rejectedAt)) && (
                        <div className="mt-1.5 rounded-md bg-rose-500/10 dark:bg-rose-500/20 border border-rose-500/25 px-2.5 py-1 text-xs text-rose-700 dark:text-rose-300 font-medium">
                          ⚠️ <span className="font-bold">Admin Feedback:</span> "{(t as any).rejectionReason || "Revisions requested by administrator. Please update and re-submit."}"
                        </div>
                      )}
                      <p className="mt-1 text-caption text-muted-foreground">
                        {t.deadline ? `Due: ${new Date(t.deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : "Urgent action required"}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-sm border-destructive/30 text-destructive hover:bg-destructive/10 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTask(t);
                      }}
                    >
                      View task
                    </Button>
                  </li>
                ))}
                {/* Today's Hearings */}
                {hearings.slice(0, 2).map((h) => (
                  <li
                    key={h._id}
                    onClick={() => navigate({ to: "/calendar" })}
                    className="lift cursor-pointer grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-4 rounded-md border border-border bg-card p-4 hover:border-primary/40 transition-colors"
                  >
                    <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><Gavel size={17} strokeWidth={1.75} /></span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">Hearing</p>
                      <p className="mt-0.5 truncate text-helper text-muted-foreground">{h.title}</p>
                      <p className="mt-1 num text-caption text-muted-foreground">{new Date(h.start).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                    <StatusPill tone="primary">Hearing</StatusPill>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Recent cases */}
          <SectionCard
            title="Recent cases"
            description="Latest movement in your matters."
            icon={Briefcase}
            action={
              <Button variant="ghost" size="sm" className="rounded-sm" onClick={() => navigate({ to: "/cases" })}>
                View all <ArrowRight size={15} strokeWidth={1.75} />
              </Button>
            }
          >
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
                      className="lift grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-md border border-border p-4 hover:border-primary/40 transition-colors">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{c.title}</p>
                        <p className="num mt-0.5 truncate text-caption text-muted-foreground">
                          {c.number} · {c.category || c.practice || "General Legal"}
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

        {/* ── Right column: Schedule, Documents & Governance ── */}
        <div className="space-y-6">
          {/* Today's hearings */}
          <SectionCard
            title="Today's hearings"
            description="Your schedule in court today."
            icon={Gavel}
            action={
              <Button variant="ghost" size="sm" className="rounded-sm" onClick={() => navigate({ to: "/calendar" })}>
                View calendar <ArrowRight size={15} strokeWidth={1.75} />
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
                    <div
                      onClick={() => navigate({ to: "/calendar" })}
                      className="lift cursor-pointer grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-md border border-border bg-card p-4 hover:border-primary/40 transition-colors"
                    >
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

          {/* Admin Oversight Notice (Calm direct link to Admin Console Approval Centre) */}
          {hasApprovalsAccess && approvals.length > 0 && (
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3 min-w-0">
                <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
                  <ShieldCheck size={18} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground">
                    {approvals.length} {approvals.length === 1 ? "Item Awaiting Approval" : "Items Awaiting Approval"}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    Review and sign off in the Approval Centre
                  </p>
                </div>
              </div>
              <Button size="sm" variant="outline" className="rounded-lg text-xs font-semibold gap-1 shrink-0" asChild>
                <Link to="/admin/approvals">
                  Review <ArrowRight size={13} />
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>

      <TaskDetailDialog
        open={Boolean(selectedTask)}
        onClose={() => setSelectedTask(null)}
        task={selectedTask}
      />
    </div>
  );
}