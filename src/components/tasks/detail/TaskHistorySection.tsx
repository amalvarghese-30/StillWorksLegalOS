import React from "react";
import { History, UserCheck, Activity, ArrowRight, Loader2 } from "lucide-react";
import { formatSafeDateTime } from "@/lib/dates";
import type { TaskRecord, TaskAuditLog } from "@/services/tasks";

interface TaskHistorySectionProps {
  activeTask: TaskRecord;
  auditTab: "assignment" | "edits";
  setAuditTab: (t: "assignment" | "edits") => void;
  auditLogs: TaskAuditLog[];
  isLoadingAuditLogs: boolean;
}

export function TaskHistorySection({
  activeTask,
  auditTab,
  setAuditTab,
  auditLogs,
  isLoadingAuditLogs,
}: TaskHistorySectionProps) {
  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 space-y-3.5 shadow-xs">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-md bg-primary/10 text-primary">
            <History size={15} />
          </span>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Task History &amp; Audit Trail</h4>
            <p className="text-[11px] text-muted-foreground">
              Last edited by{" "}
              <span className="font-medium text-foreground">
                {typeof activeTask.updatedBy === "object"
                  ? activeTask.updatedBy?.name
                  : (activeTask.updatedBy || (typeof activeTask.createdBy === "object" ? activeTask.createdBy?.name : "Staff"))}
              </span>{" "}
              • {formatSafeDateTime(activeTask.updatedAt || activeTask.createdAt)}
            </p>
          </div>
        </div>

        {/* Tabs / Switcher */}
        <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border/60 text-xs">
          <button
            type="button"
            onClick={() => setAuditTab("assignment")}
            className={`px-3 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
              auditTab === "assignment"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <UserCheck size={13} />
            Assignment History
            <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-muted font-mono">
              {activeTask.assignmentHistory?.length || 1}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setAuditTab("edits")}
            className={`px-3 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
              auditTab === "edits"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Activity size={13} />
            Edit Log
            <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-muted font-mono">
              {auditLogs.length}
            </span>
          </button>
        </div>
      </div>

      {auditTab === "assignment" ? (
        /* Reassignment & Assignment History View */
        <div className="space-y-2">
          <div className="divide-y divide-border/50 max-h-52 overflow-y-auto pr-1">
            {activeTask.assignmentHistory && activeTask.assignmentHistory.length > 0 ? (
              activeTask.assignmentHistory
                .slice()
                .reverse()
                .map((h, i) => (
                  <div key={i} className="py-2.5 first:pt-1 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-primary/10 text-primary">
                        {h.action || "ASSIGNED"}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatSafeDateTime(h.timestamp)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 font-medium text-foreground text-xs">
                      <span className="text-muted-foreground">
                        {typeof h.fromUser === "object" ? h.fromUser?.name : "Initial"}
                      </span>
                      <ArrowRight size={12} className="text-muted-foreground shrink-0" />
                      <span className="text-foreground font-semibold">
                        {typeof h.toUser === "object" ? h.toUser?.name : "Staff"}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Assigned by{" "}
                      <strong className="text-foreground/90">
                        {typeof h.assignedBy === "object" ? h.assignedBy?.name : "Staff Member"}
                      </strong>
                      {h.note && <span className="italic ml-1.5">&mdash; &ldquo;{h.note}&rdquo;</span>}
                    </p>
                  </div>
                ))
            ) : (
              <div className="py-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-primary/10 text-primary">
                    ASSIGNED
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatSafeDateTime(activeTask.assignedAt || activeTask.createdAt)}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 font-medium text-foreground text-xs">
                  <span className="text-muted-foreground">Created</span>
                  <ArrowRight size={12} className="text-muted-foreground shrink-0" />
                  <span className="text-foreground font-semibold">
                    {activeTask.assignedUsers && activeTask.assignedUsers.length > 0
                      ? activeTask.assignedUsers.map((u) => u.name).join(", ")
                      : (activeTask.assignedTo?.name || "Unassigned")}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Assigned by{" "}
                  <strong className="text-foreground/90">
                    {typeof activeTask.assignedBy === "object"
                      ? activeTask.assignedBy?.name
                      : (activeTask.assignedBy || (typeof activeTask.createdBy === "object" ? activeTask.createdBy?.name : "Creator"))}
                  </strong>
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Edit & Change Audit Log View */
        <div className="space-y-2">
          {isLoadingAuditLogs ? (
            <div className="py-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 size={15} className="animate-spin text-primary" />
              Loading edit logs...
            </div>
          ) : auditLogs.length > 0 ? (
            <div className="divide-y divide-border/50 max-h-52 overflow-y-auto pr-1">
              {auditLogs.map((log) => (
                <div key={log._id} className="py-2.5 first:pt-1 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-primary" />
                      {log.userName || "Staff Member"}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatSafeDateTime(log.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-foreground/90 mt-1 whitespace-pre-wrap">
                    {log.details || "Updated task details"}
                  </p>
                  {Array.isArray(log.metadata?.diffs) && log.metadata.diffs.length > 0 && (
                    <ul className="mt-1 space-y-0.5 pl-2 border-l border-border/80">
                      {log.metadata.diffs.map((diff, idx) => (
                        <li key={idx} className="text-[11px] text-muted-foreground">
                          • {diff}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-5 text-center text-xs text-muted-foreground">
              <p>No recent modification logs found for this task.</p>
              <p className="text-[11px] mt-0.5">Any edits made to this task will appear here in real time.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
