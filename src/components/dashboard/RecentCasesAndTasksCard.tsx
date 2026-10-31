import { Clock, Briefcase, CheckSquare, ArrowRight, Loader2, AlertTriangle, RotateCw } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { formatSafeRelative } from "@/lib/dates";
import { EmployeeAvatar } from "@/components/admin/EmployeeAvatar";
import { StatusPill, toneForStatus } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import type { TaskRecord } from "@/services/tasks";
import type { CaseRecord } from "@/services/cases";
import { cn } from "@/lib/utils";

export interface ActivityItem {
  id: string;
  type: "task" | "case";
  title: string;
  updatedAt: string;
  caseNumber?: string;
  clientName?: string;
  assigneeName?: string;
  assigneeRole?: string;
  assigneeAvatar?: string;
  status: string;
  rawTask?: TaskRecord;
  rawCase?: CaseRecord;
}

interface RecentCasesAndTasksCardProps {
  tasks: TaskRecord[];
  cases: CaseRecord[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  isRetrying?: boolean;
  onSelectTask: (task: TaskRecord) => void;
}

export function RecentCasesAndTasksCard({
  tasks,
  cases,
  isLoading = false,
  isError = false,
  onRetry,
  isRetrying = false,
  onSelectTask,
}: RecentCasesAndTasksCardProps) {
  const navigate = useNavigate();

  // Normalize and merge recent cases and tasks
  const activities: ActivityItem[] = [
    ...cases.map((c) => {
      const clientParty = c.parties?.find((p) => p.type === "client");
      const clientName = clientParty?.name || (typeof c.assignedTo === "object" ? "" : "");
      const assignee = typeof c.assignedTo === "object" ? c.assignedTo : undefined;

      return {
        id: `case_${c._id}`,
        type: "case" as const,
        title: c.title,
        updatedAt: c.updatedAt || c.createdAt || new Date().toISOString(),
        caseNumber: c.number || c.courtCaseId || "CASE",
        clientName: clientName || undefined,
        assigneeName: assignee?.name || "Unassigned",
        assigneeRole: assignee?.title || assignee?.role || "Advocate",
        assigneeAvatar: assignee?.avatarUrl || assignee?.avatar,
        status: c.status,
        rawCase: c,
      };
    }),
    ...tasks.map((t) => {
      const caseNumber = typeof t.caseId === "object" && t.caseId ? t.caseId.number : undefined;
      const assignee = typeof t.assignedTo === "object" ? t.assignedTo : undefined;

      return {
        id: `task_${t._id}`,
        type: "task" as const,
        title: t.title,
        updatedAt:
          ((t as unknown as Record<string, unknown>).updatedAt as string) ||
          ((t as unknown as Record<string, unknown>).createdAt as string) ||
          new Date().toISOString(),
        caseNumber: caseNumber || t.caseName || undefined,
        clientName: t.clientName || undefined,
        assigneeName: assignee?.name || "Unassigned",
        assigneeRole: assignee?.title || assignee?.role || "Team Member",
        assigneeAvatar: assignee?.avatarUrl || assignee?.avatar,
        status:
          t.status === "in_progress"
            ? "In Progress"
            : t.status === "pending_approval"
              ? "In Review"
              : t.status,
        rawTask: t,
      };
    }),
  ]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  return (
    <div className="flex h-full flex-col rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/40">
            <Clock size={18} strokeWidth={2} />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Recent Cases & Tasks</h2>
            <p className="text-xs text-muted-foreground">Latest activities across your matters</p>
          </div>
        </div>
        <Link
          to="/tasks"
          className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 transition-colors"
        >
          View all <ArrowRight size={13} strokeWidth={2} />
        </Link>
      </div>

      {/* Body */}
      <div className="mt-3.5 flex-1 min-w-0">
        {isLoading && activities.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="animate-spin text-muted-foreground" size={20} />
          </div>
        ) : isError && activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4 rounded-lg border border-destructive/30 bg-destructive/5">
            <AlertTriangle size={24} className="text-destructive mb-2" />
            <p className="text-sm font-semibold text-destructive">Failed to load recent activity</p>
            <p className="mt-1 text-xs text-muted-foreground max-w-[280px]">
              Could not retrieve cases and tasks from the server.
            </p>
            {onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                disabled={isRetrying}
                className="mt-3 rounded-lg text-xs"
              >
                <RotateCw size={12} className={`mr-1.5 ${isRetrying ? "animate-spin" : ""}`} />
                {isRetrying ? "Retrying…" : "Retry"}
              </Button>
            )}
          </div>
        ) : activities.length === 0 ? (
          <div className="py-10 text-center text-xs text-muted-foreground">
            No recent case or task activity found.
          </div>
        ) : (
          <div className="space-y-2.5">
            {isError && (
              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-800 dark:text-amber-300">
                <span>Showing cached activity. Refresh failed.</span>
                {onRetry && (
                  <button onClick={onRetry} className="font-semibold underline hover:no-underline">
                    Retry
                  </button>
                )}
              </div>
            )}
            {activities.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  if (item.type === "task" && item.rawTask) {
                    onSelectTask(item.rawTask);
                  } else if (item.type === "case" && item.rawCase) {
                    navigate({ to: "/cases/$caseId", params: { caseId: item.rawCase._id } });
                  }
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (item.type === "task" && item.rawTask) {
                      onSelectTask(item.rawTask);
                    } else if (item.type === "case" && item.rawCase) {
                      navigate({ to: "/cases/$caseId", params: { caseId: item.rawCase._id } });
                    }
                  }
                }}
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/50 hover:bg-muted/40 p-3 transition-all duration-150 hover:border-primary/30 cursor-pointer"
              >
                {/* Left: Icon & Title info */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold",
                      item.type === "case"
                        ? "bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
                    )}
                  >
                    {item.type === "case" ? (
                      <Briefcase size={16} strokeWidth={2} />
                    ) : (
                      <CheckSquare size={16} strokeWidth={2} />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs sm:text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                      {item.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span>Updated {formatSafeRelative(item.updatedAt)}</span>
                      {item.caseNumber && (
                        <>
                          <span>•</span>
                          <span className="rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/40 px-1.5 py-0.2 font-mono text-[10px] font-medium">
                            {item.caseNumber}
                          </span>
                        </>
                      )}
                      {item.clientName && (
                        <>
                          <span>•</span>
                          <span className="truncate max-w-[120px] font-medium text-foreground/80">
                            {item.clientName}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Assignee & Status */}
                <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 pl-12 sm:pl-0">
                  <div className="flex items-center gap-2">
                    <EmployeeAvatar
                      name={item.assigneeName}
                      avatarUrl={item.assigneeAvatar}
                      size="xs"
                    />
                    <div className="text-left hidden xs:block">
                      <p className="text-xs font-medium text-foreground leading-tight truncate max-w-[100px]">
                        {item.assigneeName}
                      </p>
                      <p className="text-[10px] text-muted-foreground leading-tight truncate max-w-[100px]">
                        {item.assigneeRole}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <StatusPill
                      tone={toneForStatus(item.status)}
                      className="capitalize text-[11px] px-2 py-0.5"
                    >
                      {item.status}
                    </StatusPill>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
