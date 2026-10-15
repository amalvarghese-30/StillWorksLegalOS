import React from "react";
import { Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { TaskRecord } from "@/services/tasks";

interface TaskBannersProps {
  activeTask: TaskRecord;
  isAdmin: boolean;
  total: number;
  doneCount: number;
}

export function TaskBanners({ activeTask, isAdmin, total, doneCount }: TaskBannersProps) {
  return (
    <>
      {/* Pending Approval Banner */}
      {activeTask.status === "pending_approval" && (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-start gap-2.5">
          <Clock size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-helper font-semibold text-foreground">
              Pending Admin Verification &amp; Approval
            </p>
            <p className="text-caption text-muted-foreground mt-0.5">
              {isAdmin
                ? "Submitted for review. Review the checklist items below and approve or request changes using the action buttons."
                : "Task submitted. An administrator will verify completion and sign off."}
            </p>
          </div>
        </div>
      )}

      {/* Changes Requested Banner */}
      {activeTask.status !== "completed" &&
        activeTask.status !== "pending_approval" &&
        Boolean(activeTask.rejectedAt || (activeTask as any).rejectionReason) && (
          <div className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 flex items-start gap-3 animate-in fade-in">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-rose-700 dark:text-rose-300">
                  Changes Requested by Administrator
                </p>
                <span className="rounded-pill bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase">
                  Action Required
                </span>
              </div>
              <div className="mt-2 rounded-md border border-rose-500/25 bg-background/80 p-3 text-xs text-foreground leading-relaxed">
                <p className="font-semibold text-rose-600 dark:text-rose-400 text-[11px] uppercase tracking-wider mb-1">
                  Feedback / Rejection Reason:
                </p>
                <p className="font-medium whitespace-pre-wrap">
                  "{(activeTask as any).rejectionReason || "Revisions needed before this task can be approved. Please review work and re-submit."}"
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                {activeTask.rejectedAt
                  ? `Requested on ${new Date(activeTask.rejectedAt).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })}`
                  : ""}
                {(activeTask as any).rejectedByName ? ` by ${(activeTask as any).rejectedByName}` : ""}
                . Make the required corrections and click &ldquo;Submit for Approval&rdquo; when done.
              </p>
            </div>
          </div>
        )}

      {/* Completed Banner */}
      {activeTask.status === "completed" && (
        <div className="mt-4 rounded-lg border border-success/30 bg-success/10 p-3.5 flex items-center gap-2.5">
          <CheckCircle2 size={18} className="shrink-0 text-success" />
          <div>
            <p className="text-helper font-semibold text-foreground">Task Completed</p>
            <p className="text-caption text-muted-foreground">
              Work and checklist items have been completed and verified.
            </p>
          </div>
        </div>
      )}

      {/* All checklist items finished notice */}
      {activeTask.status !== "completed" &&
        activeTask.status !== "pending_approval" &&
        total > 0 &&
        doneCount === total && (
          <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3.5 flex items-center gap-2.5">
            <CheckCircle2 size={18} className="shrink-0 text-primary" />
            <div>
              <p className="text-helper font-semibold text-foreground">All checklist items are completed!</p>
              <p className="text-caption text-muted-foreground">
                {isAdmin
                  ? "Use the action button below to finalize and complete this task."
                  : "Submit this task for admin verification to complete it."}
              </p>
            </div>
          </div>
        )}
    </>
  );
}
