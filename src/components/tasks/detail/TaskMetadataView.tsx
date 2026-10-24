import React from "react";
import { Link } from "@tanstack/react-router";
import {
  User,
  Calendar,
  Briefcase,
  Tag,
  UserCheck,
  Clock,
  CheckCircle2,
  Check,
  FolderOpen,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatSafeDateTime } from "@/lib/dates";
import { openLocalPath } from "@/platform/localPath";
import type { TaskRecord } from "@/services/tasks";

interface TaskMetadataViewProps {
  activeTask: TaskRecord;
  linkedCaseId: string | null;
  caseDisplay: string | null;
  clientDisplay: string | null;
  onClose: () => void;
}

export function TaskMetadataView({
  activeTask,
  linkedCaseId,
  caseDisplay,
  clientDisplay,
  onClose,
}: TaskMetadataViewProps) {
  return (
    <div className="space-y-4">
      {activeTask.description && (
        <div className="rounded-md bg-muted/50 p-3 text-helper text-foreground/90 whitespace-pre-wrap">
          {activeTask.description}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 text-helper">
        <div className="flex items-start gap-2 text-muted-foreground sm:col-span-2">
          <User size={15} className="mt-0.5 shrink-0" />
          <div className="flex flex-wrap items-center gap-1.5">
            <span>Assignees:</span>
            {activeTask.assignedUsers && activeTask.assignedUsers.length > 0 ? (
              activeTask.assignedUsers.map((u) => (
                <span
                  key={u._id}
                  className="inline-flex items-center gap-1.5 rounded bg-secondary/80 px-2 py-0.5 text-xs font-semibold text-secondary-foreground"
                >
                  {(u.avatarUrl || (u as any).avatar) && (
                    <img
                      src={u.avatarUrl || (u as any).avatar}
                      alt={u.name}
                      className="size-4 rounded-full object-cover shrink-0"
                    />
                  )}
                  {u.name}
                </span>
              ))
            ) : (
              <span className="inline-flex items-center gap-1.5">
                {(activeTask.assignedTo?.avatarUrl || (activeTask.assignedTo as any)?.avatar) && (
                  <img
                    src={activeTask.assignedTo?.avatarUrl || (activeTask.assignedTo as any)?.avatar}
                    alt={activeTask.assignedTo.name}
                    className="size-4 rounded-full object-cover shrink-0"
                  />
                )}
                <strong className="text-foreground">{activeTask.assignedTo?.name || "Unassigned"}</strong>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar size={15} />
          <span>
            Deadline:{" "}
            <strong className="text-foreground">
              {formatSafeDateTime(activeTask.deadline, "No deadline")}
            </strong>
          </span>
        </div>

        <div className="flex items-center gap-2 text-muted-foreground">
          <Briefcase size={15} />
          <span>
            Linked Case:{" "}
            {linkedCaseId ? (
              <Link
                to="/cases/$caseId"
                params={{ caseId: linkedCaseId }}
                className="text-primary hover:underline font-semibold inline-flex items-center gap-1"
                onClick={() => onClose()}
              >
                <span>{caseDisplay}</span>
                <ArrowUpRight size={13} />
              </Link>
            ) : (
              <strong className="text-foreground">
                {caseDisplay || "None (General Task)"}
              </strong>
            )}
          </span>
        </div>

        {clientDisplay && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <User size={15} />
            <span>
              Linked Client:{" "}
              <strong className="text-foreground">{clientDisplay}</strong>
            </span>
          </div>
        )}

        {activeTask.agent && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Tag size={15} />
            <span>
              Agent / Broker:{" "}
              <strong className="text-foreground">{activeTask.agent}</strong>
            </span>
          </div>
        )}

        <div className="flex items-center gap-2 text-muted-foreground">
          <User size={15} />
          <span>
            Created By:{" "}
            <strong className="text-foreground">
              {typeof activeTask.createdBy === "object" ? activeTask.createdBy?.name : "System"}
            </strong>
          </span>
        </div>

        {activeTask.assignedBy && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <UserCheck size={15} />
            <span>
              Assigned By:{" "}
              <strong className="text-foreground">
                {typeof activeTask.assignedBy === "object" ? activeTask.assignedBy?.name : "Admin"}
              </strong>
            </span>
          </div>
        )}

        {activeTask.startedAt && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock size={15} />
            <span>Started: <strong className="text-foreground">{formatSafeDateTime(activeTask.startedAt)}</strong></span>
          </div>
        )}

        {activeTask.completedAt && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 size={15} className="text-success" />
            <span>Completed: <strong className="text-foreground">{formatSafeDateTime(activeTask.completedAt)}</strong></span>
          </div>
        )}

        {activeTask.submittedForApprovalAt && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock size={15} className="text-amber-500" />
            <span>Submitted for Review: <strong className="text-foreground">{formatSafeDateTime(activeTask.submittedForApprovalAt)}</strong></span>
          </div>
        )}

        {activeTask.approvedAt && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Check size={15} className="text-emerald-500" />
            <span>Approved: <strong className="text-foreground">{formatSafeDateTime(activeTask.approvedAt)}</strong></span>
          </div>
        )}

        <div className="flex items-center gap-2 text-muted-foreground">
          <User size={15} />
          <span>
            Last Edited By:{" "}
            <strong className="text-foreground">
              {typeof activeTask.updatedBy === "object"
                ? activeTask.updatedBy?.name
                : (activeTask.updatedBy || (typeof activeTask.createdBy === "object" ? activeTask.createdBy?.name : "Staff"))}
            </strong>
            {" "}({formatSafeDateTime(activeTask.updatedAt || activeTask.createdAt)})
          </span>
        </div>
      </div>

      {/* Local Folder / File Path */}
      {activeTask.localPath && (
        <div className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/40 p-3 text-xs">
          <div className="min-w-0">
            <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Local Task Folder</p>
            <p className="font-mono text-xs text-foreground truncate mt-0.5">{activeTask.localPath}</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs rounded-md shrink-0 ml-2"
            onClick={() => openLocalPath(activeTask.localPath!)}
          >
            <FolderOpen size={13} className="mr-1" /> Open Path
          </Button>
        </div>
      )}
    </div>
  );
}
