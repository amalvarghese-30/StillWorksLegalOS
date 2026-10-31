import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { ShieldCheck, CalendarDays, Plus, ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useSocketEvent } from "@/lib/socket";
import { useReportsSummary, reportKeys } from "@/services/reports";
import { useCalendarEvents, type CalendarEvent } from "@/services/calendar";
import { useCases, useReviewCaseAccessRequest, type CaseRecord } from "@/services/cases";
import {
  useDocuments,
  useUpdateDocument,
  useReviewAccessRequest,
  type DocumentRecord,
} from "@/services/documents";
import { useApprovals, type ApprovalItem } from "@/services/admin";
import { useTasks, useUpdateTask, taskKeys, type TaskRecord } from "@/services/tasks";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import { QuickActionsMenu } from "@/components/layout/QuickActionsMenu";
import { DocumentPreviewModal } from "@/components/documents/DocumentPreviewModal";

import { DashboardMetricCards } from "@/components/dashboard/DashboardMetricCards";
import { RecentCasesAndTasksCard } from "@/components/dashboard/RecentCasesAndTasksCard";
import { TodaysHearingsCard } from "@/components/dashboard/TodaysHearingsCard";
import { RecentDocumentsCard } from "@/components/dashboard/RecentDocumentsCard";
import { ItemsAwaitingApprovalCard } from "@/components/dashboard/ItemsAwaitingApprovalCard";
import { PendingCasesAndTasksSection } from "@/components/dashboard/PendingCasesAndTasksSection";

export const Route = createFileRoute("/_shell/")({
  head: () => ({
    meta: [
      { title: "Dashboard · S & S Legal-Tech LLP" },
      {
        name: "description",
        content:
          "Executive command centre: hearings, overdue items, pending tasks, active cases, documents and approvals.",
      },
      { property: "og:title", content: "Dashboard · S & S Legal-Tech LLP" },
      {
        property: "og:description",
        content: "Hearings, overdue items, pending tasks, and live legal activity.",
      },
    ],
  }),
  component: Dashboard,
});

/** Resolve an approval `_id` back into the document + (optional) access-request ids or task id. */
function approvalTarget(a: { kind: string; _id: string }): {
  docId?: string;
  caseId?: string;
  requestId?: string;
  taskId?: string;
} {
  if (a.kind === "Task Completion" || a._id.startsWith("task_")) {
    return { taskId: a._id.replace(/^task_/, "") };
  }
  if (a.kind === "Case Request" || a._id.startsWith("case_")) {
    const marker = "_access_";
    const withoutPrefix = a._id.replace(/^case_/, "");
    const idx = withoutPrefix.indexOf(marker);
    if (idx >= 0)
      return {
        caseId: withoutPrefix.slice(0, idx),
        requestId: withoutPrefix.slice(idx + marker.length),
      };
  }
  if (a.kind === "Access Request") {
    const marker = "_access_";
    const idx = a._id.indexOf(marker);
    if (idx >= 0)
      return { docId: a._id.slice(0, idx), requestId: a._id.slice(idx + marker.length) };
  }
  return { docId: a._id };
}

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isAdmin = user?.role === "admin";
  const hasApprovalsAccess = isAdmin || user?.permissions?.approvals === true;

  const updateDocument = useUpdateDocument();
  const reviewAccessRequest = useReviewAccessRequest();
  const reviewCaseAccessRequest = useReviewCaseAccessRequest();
  const updateTask = useUpdateTask();

  const [actingOn, setActingOn] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DocumentRecord | null>(null);

  // Real-time task mutations across all connected clients
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

  const today = useMemo(() => new Date(), []);
  const startOfDay = useMemo(
    () => new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0).toISOString(),
    [today],
  );
  const endOfDay = useMemo(
    () =>
      new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        23,
        59,
        59,
        999,
      ).toISOString(),
    [today],
  );

  // Queries
  const {
    data: summary,
    isLoading: summaryLoading,
    isError: summaryError,
    refetch: refetchSummary,
    isFetching: summaryFetching,
  } = useReportsSummary();

  const {
    data: eventsData,
    isLoading: hearingsLoading,
    isError: hearingsError,
    refetch: refetchHearings,
    isFetching: hearingsFetching,
  } = useCalendarEvents({
    start: startOfDay,
    end: endOfDay,
  });

  const {
    data: casesData,
    isLoading: casesLoading,
    isError: casesError,
    refetch: refetchCases,
    isFetching: casesFetching,
  } = useCases({ page: "1", limit: "50" });

  const {
    data: docsData,
    isLoading: docsLoading,
    isError: docsError,
    refetch: refetchDocs,
    isFetching: docsFetching,
  } = useDocuments({ page: "1", limit: "10" });

  const {
    data: approvalsData,
    isLoading: approvalsLoading,
    isError: approvalsError,
    refetch: refetchApprovals,
    isFetching: approvalsFetching,
  } = useApprovals(undefined, {
    enabled: hasApprovalsAccess,
  });

  const {
    data: tasksData,
    isLoading: tasksLoading,
    isError: tasksError,
    refetch: refetchTasks,
    isFetching: tasksFetching,
  } = useTasks({ limit: "100" });

  const hearings: CalendarEvent[] = useMemo(
    () => (eventsData?.events ?? []).filter((e) => e.type === "hearing"),
    [eventsData?.events],
  );

  const rawCases: CaseRecord[] = useMemo(() => casesData?.cases ?? [], [casesData?.cases]);
  const cases: CaseRecord[] = useMemo(() => {
    if (isAdmin) return rawCases;
    return rawCases.filter((c) => {
      const assigned = c.assignedTo;
      const assignedId =
        typeof assigned === "object" && assigned !== null
          ? (assigned as { _id?: string })._id
          : assigned;
      if (assignedId && String(assignedId) !== String(user?._id)) {
        return false;
      }
      return true;
    });
  }, [isAdmin, rawCases, user?._id]);

  const documents: DocumentRecord[] = useMemo(
    () => docsData?.documents ?? [],
    [docsData?.documents],
  );
  const approvals: ApprovalItem[] = useMemo(
    () => (hasApprovalsAccess ? (approvalsData?.approvals ?? []) : []),
    [hasApprovalsAccess, approvalsData?.approvals],
  );
  const allTasks: TaskRecord[] = useMemo(() => tasksData?.tasks ?? [], [tasksData?.tasks]);

  // Keep selectedTask in sync with latest queryClient/allTasks data
  useEffect(() => {
    if (selectedTask?._id && allTasks.length > 0) {
      const updated = allTasks.find((t) => t._id === selectedTask._id);
      if (updated && updated !== selectedTask) {
        setSelectedTask(updated);
      }
    }
  }, [allTasks, selectedTask]);

  // Calculations for Overdue and Pending
  const overdueTasks = useMemo(
    () =>
      allTasks.filter(
        (t) =>
          t.status !== "completed" &&
          t.status !== "pending_approval" &&
          (t.status === "overdue" ||
            (t.deadline ? new Date(t.deadline).getTime() < today.getTime() : false)),
      ),
    [allTasks, today],
  );

  const pendingTasks = useMemo(() => allTasks.filter((t) => t.status !== "completed"), [allTasks]);

  const overdueCases = useMemo(
    () =>
      rawCases.filter(
        (c) =>
          c.status !== "Closed" &&
          c.status !== "Archived" &&
          c.nextHearing &&
          new Date(c.nextHearing).getTime() < today.getTime(),
      ),
    [rawCases, today],
  );

  const overdueCount = overdueTasks.length + overdueCases.length;
  const pendingTasksCount = pendingTasks.length;
  const activeCasesCount =
    summary?.activeCases ??
    rawCases.filter((c) => c.status === "Active" || c.status === "Urgent").length;
  const totalClientsCount = summary?.totalClients ?? 0;
  const tasksCompletedCount =
    summary?.tasksCompleted ?? allTasks.filter((t) => t.status === "completed").length;

  const runApproval = (a: ApprovalItem, action: "approved" | "rejected") => {
    const target = approvalTarget(a);
    setActingOn(a._id);
    const onSettled = () => {
      setActingOn(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "approvals"] });
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      queryClient.invalidateQueries({ queryKey: reportKeys.all });
    };
    if (target.taskId) {
      updateTask.mutate(
        {
          id: target.taskId,
          data: { status: action === "approved" ? "completed" : "in_progress" },
        },
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

  const dateStr = today.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const subtitle = `${dateStr} • ${hearings.length} ${
    hearings.length === 1 ? "hearing" : "hearings"
  }, ${pendingTasksCount} pending tasks, ${overdueCount} overdue items${
    hasApprovalsAccess ? `, ${approvals.length} approvals waiting` : ""
  }.`;

  return (
    <div className="space-y-6 pb-8">
      {/* ── Page Header ── */}
      <PageHeader
        breadcrumb={[{ label: "S & S", to: "/" }, { label: "Dashboard" }]}
        title="What should I work on today?"
        subtitle={subtitle}
        actions={
          <>
            {isAdmin && (
              <Button
                variant="outline"
                className="rounded-lg gap-1.5 border-border/80 text-foreground hover:bg-muted font-medium text-xs sm:text-sm"
                onClick={() => navigate({ to: "/admin" })}
              >
                <ShieldCheck size={16} strokeWidth={1.75} /> Admin console
              </Button>
            )}
            <Button
              variant="outline"
              className="rounded-lg gap-1.5 border-border/80 text-foreground hover:bg-muted font-medium text-xs sm:text-sm"
              onClick={() => navigate({ to: "/calendar" })}
            >
              <CalendarDays size={16} strokeWidth={1.75} /> Open calendar
            </Button>
            <QuickActionsMenu
              renderTrigger={(toggle) => (
                <Button
                  className="rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-medium text-xs sm:text-sm shadow-xs transition-transform duration-200 hover:-translate-y-0.5 cursor-pointer"
                  onClick={toggle}
                >
                  <Plus size={16} strokeWidth={2} />
                  Quick action
                  <ChevronDown size={14} strokeWidth={2} />
                </Button>
              )}
            />
          </>
        }
      />

      {/* ── Metric Summary Cards (Row of 6) ── */}
      <DashboardMetricCards
        hearingsCount={hearingsError && !eventsData ? null : hearings.length}
        overdueCount={tasksError && !tasksData ? null : overdueCount}
        pendingTasksCount={tasksError && !tasksData ? null : pendingTasksCount}
        activeCasesCount={casesError && !casesData ? null : activeCasesCount}
        totalClientsCount={summaryError && !summary ? null : totalClientsCount}
        tasksCompletedCount={summaryError && !summary ? null : tasksCompletedCount}
        periodLabel={summary?.period || "30 days"}
        loading={summaryLoading || tasksLoading || hearingsLoading}
      />

      {/* ── Row 1: Recent Cases & Tasks (~60%) + Today's Hearings (~40%) ── */}
      <div className="grid gap-6 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-7 xl:col-span-7">
          <RecentCasesAndTasksCard
            tasks={allTasks}
            cases={cases}
            isLoading={tasksLoading || casesLoading}
            isError={Boolean((tasksError && !tasksData) || (casesError && !casesData))}
            onRetry={() => {
              if (tasksError) refetchTasks();
              if (casesError) refetchCases();
            }}
            isRetrying={tasksFetching || casesFetching}
            onSelectTask={(task) => setSelectedTask(task)}
          />
        </div>
        <div className="lg:col-span-5 xl:col-span-5">
          <TodaysHearingsCard
            hearings={hearings}
            isLoading={hearingsLoading}
            isError={hearingsError}
            onRetry={() => refetchHearings()}
            isRetrying={hearingsFetching}
          />
        </div>
      </div>

      {/* ── Row 2: Recent Documents (~55%) + Items Awaiting Approval (~45%) ── */}
      <div className="grid gap-6 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-7 xl:col-span-7">
          <RecentDocumentsCard
            documents={documents}
            isLoading={docsLoading}
            isError={docsError}
            onRetry={() => refetchDocs()}
            isRetrying={docsFetching}
            onPreviewDocument={(doc) => setPreviewDoc(doc)}
          />
        </div>
        <div className="lg:col-span-5 xl:col-span-5">
          <ItemsAwaitingApprovalCard
            approvals={approvals}
            isLoading={approvalsLoading}
            isError={approvalsError}
            onRetry={() => refetchApprovals()}
            isRetrying={approvalsFetching}
            actingOn={actingOn}
            onApprove={(item) => runApproval(item, "approved")}
            onReject={(item) => runApproval(item, "rejected")}
          />
        </div>
      </div>

      {/* ── Full-Width Bottom Section: Pending Cases & Tasks ── */}
      <PendingCasesAndTasksSection
        tasks={allTasks}
        cases={cases}
        isLoading={tasksLoading || casesLoading}
        isError={Boolean((tasksError && !tasksData) || (casesError && !casesData))}
        onRetry={() => {
          if (tasksError) refetchTasks();
          if (casesError) refetchCases();
        }}
        isRetrying={tasksFetching || casesFetching}
        onSelectTask={(task) => setSelectedTask(task)}
      />

      {/* ── Modals / Dialogs ── */}
      <TaskDetailDialog
        open={Boolean(selectedTask)}
        onClose={() => setSelectedTask(null)}
        task={selectedTask}
      />

      <DocumentPreviewModal
        open={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        documentId={previewDoc?._id ?? null}
        documentName={previewDoc?.name}
        documentMimeType={previewDoc?.mimeType}
        documentSize={previewDoc?.size}
      />
    </div>
  );
}
