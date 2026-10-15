import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Activity, ArrowRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuditLogs, type AuditLogItem } from "@/services/admin";
import { useTask, type TaskRecord } from "@/services/tasks";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";

function cleanAction(action: string): string {
  return action
    .replace(/_/g, " ")
    .replace(/^case /, "")
    .replace(/^task /, "")
    .replace(/^document /, "")
    .toLowerCase();
}

function formatAuditTimestamp(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

export function AdminRecentActivity() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useAuditLogs({ limit: "7" });
  const logs = data?.logs ?? [];

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Lazy load task if clicked
  const { data: activeTask } = useTask(selectedTaskId || undefined);

  const handleRowClick = (log: AuditLogItem) => {
    const res = (log.resource || "").toLowerCase();
    const resId = log.resourceId;

    if (res.includes("task") && resId) {
      setSelectedTaskId(resId);
    } else if (res.includes("case") && resId) {
      navigate({ to: "/cases/$caseId", params: { caseId: resId } });
    } else if ((res.includes("employee") || res.includes("user")) && resId) {
      navigate({ to: "/admin/employees", search: { employeeId: resId } });
    } else if (res.includes("doc")) {
      navigate({ to: "/documents" });
    } else {
      navigate({ to: "/admin/audit-logs" });
    }
  };

  return (
    <section className="flex flex-col rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-soft transition-all duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-border/60">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-900/50 shadow-2xs">
            <Activity size={18} strokeWidth={2} />
          </span>
          <div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
              Recent activity
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Latest actions across the firm.
            </p>
          </div>
        </div>
        <Link
          to="/admin/audit-logs"
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline transition-colors group shrink-0"
        >
          <span>View Full Audit Log</span>
          <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* Content */}
      <div className="mt-2 flex-1">
        {isLoading ? (
          <div className="space-y-3 py-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between gap-3 p-2.5 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-full bg-muted/60" />
                  <div className="h-4 w-64 rounded bg-muted/50" />
                </div>
                <div className="h-3 w-20 rounded bg-muted/40" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <AlertTriangle className="size-8 text-destructive/80 mb-2" />
            <p className="text-sm font-semibold text-foreground">Couldn't load recent activity</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Check server connection and try again.
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-4 rounded-md">
              Retry
            </Button>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 mb-3">
              <Activity size={24} strokeWidth={1.75} />
            </div>
            <p className="text-sm font-semibold text-foreground">No activity recorded yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Actions will appear here in real time as the firm operates.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/50">
            {logs.map((a) => (
              <li
                key={a._id}
                onClick={() => handleRowClick(a)}
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 py-3 px-2 -mx-2 rounded-xl transition-all hover:bg-muted/40 cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-100 dark:bg-slate-800/90 text-slate-500 dark:text-slate-400 group-hover:text-primary transition-colors">
                    <Activity size={15} strokeWidth={1.75} />
                  </span>
                  <p className="min-w-0 truncate text-xs sm:text-sm text-foreground">
                    <span className="font-semibold text-foreground">{a.userName}</span>{" "}
                    <span className="text-muted-foreground">{cleanAction(a.action)}</span>{" "}
                    <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                      {a.resourceName ?? a.resource}
                    </span>
                    {a.details ? (
                      <span className="text-muted-foreground/80 font-normal ml-1.5 text-xs truncate">
                        — {a.details}
                      </span>
                    ) : null}
                  </p>
                </div>
                <span className="shrink-0 text-caption text-muted-foreground font-mono pl-11 sm:pl-0">
                  {formatAuditTimestamp(a.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Task detail dialog if opened from activity */}
      {activeTask && (
        <TaskDetailDialog
          open={!!activeTask}
          onClose={() => setSelectedTaskId(null)}
          task={activeTask}
        />
      )}
    </section>
  );
}
