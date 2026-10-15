import React from "react";
import { Link } from "@tanstack/react-router";
import {
  CheckCircle2,
  Clock,
  Briefcase,
  Edit2,
  MoreVertical,
  Share2,
  UserCheck,
  Copy,
  Trash2,
  Loader2,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TaskRecord, ChecklistItem } from "@/services/tasks";

interface TaskHeaderProps {
  activeTask: TaskRecord;
  caseDisplay: string | null;
  linkedCaseId: string | null;
  isEditing: boolean;
  setIsEditing: (val: boolean) => void;
  setEditableChecklist: (items: ChecklistItem[]) => void;
  setEditingIndex: (val: number | null) => void;
  isAdmin: boolean;
  isDuplicating: boolean;
  handleSetStatus: (status: "pending" | "in_progress" | "pending_approval" | "completed") => void;
  handleOpenForwardModal: () => void;
  handleOpenReassignModal: () => void;
  handleOpenRejectModal: () => void;
  handleOpenAdminDeleteModal: () => void;
  handleOpenRequestDeleteModal: () => void;
  handleDuplicateTask: () => void;
  onClose: () => void;
}

export function TaskHeader({
  activeTask,
  caseDisplay,
  linkedCaseId,
  isEditing,
  setIsEditing,
  setEditableChecklist,
  setEditingIndex,
  isAdmin,
  isDuplicating,
  handleSetStatus,
  handleOpenForwardModal,
  handleOpenReassignModal,
  handleOpenRejectModal,
  handleOpenAdminDeleteModal,
  handleOpenRequestDeleteModal,
  handleDuplicateTask,
  onClose,
}: TaskHeaderProps) {
  return (
    <DialogHeader className="border-b border-border/60 pb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {activeTask.mainCategory ? (
              <span className="rounded-pill bg-primary/10 px-2.5 py-0.5 text-caption font-semibold text-primary">
                {activeTask.mainCategory}
                {activeTask.subCategory ? ` › ${activeTask.subCategory}` : ""}
              </span>
            ) : (
              <span className="rounded-pill bg-primary/10 px-2.5 py-0.5 text-caption font-semibold text-primary">
                {activeTask.category || "Task"}
              </span>
            )}
            <span
              className={`rounded-pill px-2.5 py-0.5 text-caption font-semibold ${
                activeTask.priority === "High"
                  ? "bg-destructive/15 text-destructive"
                  : activeTask.priority === "Medium"
                  ? "bg-warning/15 text-warning"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {activeTask.priority || "Medium"}
            </span>
            {activeTask.status === "completed" ? (
              <span className="rounded-pill bg-success/15 text-success px-2.5 py-0.5 text-caption font-semibold flex items-center gap-1">
                <CheckCircle2 size={12} /> Completed
              </span>
            ) : activeTask.status === "pending_approval" ? (
              <span className="rounded-pill bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2.5 py-0.5 text-caption font-semibold flex items-center gap-1">
                <Clock size={12} /> Pending Approval
              </span>
            ) : activeTask.status === "overdue" ? (
              <span className="rounded-pill bg-destructive text-destructive-foreground px-2.5 py-0.5 text-caption font-bold">
                Overdue
              </span>
            ) : null}

            {activeTask.agent && (
              <span className="rounded-pill bg-secondary/80 px-2.5 py-0.5 text-caption font-medium text-foreground border border-border">
                Agent: {activeTask.agent}
              </span>
            )}
          </div>
          <DialogTitle className="text-title font-semibold text-foreground pt-1">
            {activeTask.title}
          </DialogTitle>
          {caseDisplay && (
            <div className="pt-0.5">
              {linkedCaseId ? (
                <Link
                  to="/cases/$caseId"
                  params={{ caseId: linkedCaseId }}
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline hover:text-primary/80 font-medium transition-colors"
                  onClick={() => onClose()}
                >
                  <Briefcase size={13} className="shrink-0" />
                  <span>Case: {caseDisplay}</span>
                  <ArrowUpRight size={12} className="shrink-0 opacity-70" />
                </Link>
              ) : (
                <DialogDescription className="text-helper text-muted-foreground flex items-center gap-1.5">
                  <Briefcase size={13} />
                  {caseDisplay}
                </DialogDescription>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!isEditing) {
                setEditableChecklist(
                  (activeTask.checklist || []).map((c) => ({
                    _id: c._id,
                    id: c.id,
                    text: c.text,
                    done: Boolean(c.done),
                    subItems: Array.isArray(c.subItems)
                      ? c.subItems.map((s) => ({
                          _id: s._id,
                          id: s.id,
                          text: s.text,
                          done: Boolean(s.done),
                        }))
                      : [],
                  }))
                );
                setEditingIndex(null);
              }
              setIsEditing(!isEditing);
            }}
            className="rounded-md h-8 text-xs"
          >
            <Edit2 size={13} className="mr-1.5" />
            {isEditing ? "View Details" : "Edit"}
          </Button>

          {/* More Options Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md" aria-label="More options">
                <MoreVertical size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="text-xs">
                  <CheckCircle2 size={14} className="mr-2" />
                  Change Status
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-44">
                  <DropdownMenuItem
                    className="text-xs"
                    disabled={activeTask.status === "pending"}
                    onClick={() => handleSetStatus("pending")}
                  >
                    Mark as Pending
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-xs"
                    disabled={activeTask.status === "in_progress"}
                    onClick={() => handleSetStatus("in_progress")}
                  >
                    Mark as In Progress
                  </DropdownMenuItem>
                  {isAdmin ? (
                    <DropdownMenuItem
                      className="text-xs font-medium text-emerald-600 dark:text-emerald-400"
                      disabled={activeTask.status === "completed"}
                      onClick={() => handleSetStatus("completed")}
                    >
                      Approve & Complete
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      className="text-xs font-medium text-amber-600 dark:text-amber-400"
                      disabled={activeTask.status === "pending_approval" || activeTask.status === "completed"}
                      onClick={() => handleSetStatus("pending_approval")}
                    >
                      Submit for Approval
                    </DropdownMenuItem>
                  )}
                  {isAdmin && activeTask.status === "pending_approval" && (
                    <DropdownMenuItem
                      className="text-xs text-amber-600 dark:text-amber-400 cursor-pointer"
                      onSelect={handleOpenRejectModal}
                    >
                      Request Changes
                    </DropdownMenuItem>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuItem
                className="text-xs cursor-pointer"
                onSelect={handleOpenForwardModal}
              >
                <Share2 size={14} className="mr-2" />
                Forward Task
              </DropdownMenuItem>

              <DropdownMenuItem
                className="text-xs cursor-pointer"
                onSelect={handleOpenReassignModal}
              >
                <UserCheck size={14} className="mr-2" />
                Reassign Task
              </DropdownMenuItem>

              <DropdownMenuItem
                className="text-xs cursor-pointer"
                disabled={isDuplicating}
                onSelect={(e) => {
                  e.preventDefault();
                  handleDuplicateTask();
                }}
              >
                {isDuplicating ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Copy size={14} className="mr-2" />}
                Duplicate Task
              </DropdownMenuItem>

              {isAdmin ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-xs text-destructive focus:text-destructive cursor-pointer"
                    onSelect={handleOpenAdminDeleteModal}
                  >
                    <Trash2 size={14} className="mr-2" />
                    Delete Task
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-xs text-destructive focus:text-destructive cursor-pointer"
                    onSelect={handleOpenRequestDeleteModal}
                  >
                    <Trash2 size={14} className="mr-2" />
                    Request Task Deletion
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </DialogHeader>
  );
}
