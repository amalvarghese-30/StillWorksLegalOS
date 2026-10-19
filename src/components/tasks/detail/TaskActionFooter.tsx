import React from "react";
import { AlertTriangle, Trash2, Check, Clock, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import type { TaskRecord } from "@/services/tasks";

interface TaskActionFooterProps {
  isEditing: boolean;
  isCreatorOrAdmin: boolean;
  showDeleteConfirm: boolean;
  setShowDeleteConfirm: (val: boolean) => void;
  handleDeleteTask: (e?: React.MouseEvent) => void;
  deletePending: boolean;
  isDirty: boolean;
  setShowDiscardConfirm: (val: boolean) => void;
  setIsEditing: (val: boolean) => void;
  handleSaveDetails: () => void;
  updatePending: boolean;
  onClose: () => void;
  activeTask: TaskRecord;
  isAdmin: boolean;
  handleOpenRejectModal: () => void;
  handleSetStatus: (status: "pending" | "in_progress" | "pending_approval" | "completed") => void;
  handleOpenRequestDeleteModal?: () => void;
}

export function TaskActionFooter({
  isEditing,
  isCreatorOrAdmin,
  showDeleteConfirm,
  setShowDeleteConfirm,
  handleDeleteTask,
  deletePending,
  isDirty,
  setShowDiscardConfirm,
  setIsEditing,
  handleSaveDetails,
  updatePending,
  onClose,
  activeTask,
  isAdmin,
  handleOpenRejectModal,
  handleSetStatus,
  handleOpenRequestDeleteModal,
}: TaskActionFooterProps) {
  return (
    <DialogFooter className="mt-6 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-border/60 pt-4">
      <div>
        {isAdmin ? (
          showDeleteConfirm ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs animate-in fade-in">
              <span className="font-semibold text-destructive flex items-center gap-1">
                <AlertTriangle size={13} className="shrink-0" />
                Delete permanently?
              </span>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="h-7 px-3 text-xs font-semibold rounded-md shadow-sm"
                disabled={deletePending}
                onClick={handleDeleteTask}
              >
                {deletePending ? (
                  <Loader2 size={12} className="animate-spin mr-1" />
                ) : (
                  <Trash2 size={12} className="mr-1" />
                )}
                {deletePending ? "Deleting…" : "Confirm Delete"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs rounded-md"
                disabled={deletePending}
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive rounded-md"
            >
              <Trash2 size={15} className="mr-1.5" />
              Delete Task
            </Button>
          )
        ) : (
          activeTask.pendingDeletion ? (
            <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 rounded-md font-medium">
              <Clock size={13} />
              Deletion Requested (Pending Admin Approval)
            </span>
          ) : handleOpenRequestDeleteModal ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleOpenRequestDeleteModal}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive rounded-md"
            >
              <Trash2 size={15} className="mr-1.5" />
              Request Deletion
            </Button>
          ) : null
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {isEditing ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (isDirty) {
                  setShowDiscardConfirm(true);
                } else {
                  setIsEditing(false);
                }
              }}
              className="rounded-md"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="gradient-primary rounded-md text-primary-foreground font-semibold shadow-soft"
              disabled={updatePending}
              onClick={handleSaveDetails}
            >
              {updatePending ? (
                <Loader2 size={14} className="animate-spin mr-1.5" />
              ) : (
                <Check size={14} className="mr-1.5" />
              )}
              Save Changes
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="outline" size="sm" onClick={onClose} className="rounded-md">
              Close
            </Button>

            {/* Single Contextual Action Button */}
            {activeTask.status === "pending_approval" ? (
              isAdmin ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={updatePending}
                    onClick={handleOpenRejectModal}
                    className="rounded-md"
                  >
                    Request Changes
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="gradient-primary rounded-md text-primary-foreground font-semibold shadow-soft"
                    disabled={updatePending}
                    onClick={() => handleSetStatus("completed")}
                  >
                    {updatePending ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Check size={14} className="mr-1.5" />}
                    Approve &amp; Complete
                  </Button>
                </>
              ) : (
                <Button type="button" size="sm" variant="secondary" disabled className="rounded-md opacity-80">
                  <Clock size={14} className="mr-1.5 text-amber-500" />
                  Awaiting Approval
                </Button>
              )
            ) : activeTask.status === "completed" ? (
              isAdmin ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-md"
                  disabled={updatePending}
                  onClick={() => handleSetStatus("in_progress")}
                >
                  <RotateCcw size={14} className="mr-1.5" />
                  Reopen Task
                </Button>
              ) : null
            ) : (
              <Button
                type="button"
                size="sm"
                className="gradient-primary rounded-md text-primary-foreground font-semibold shadow-soft"
                disabled={updatePending}
                onClick={() => handleSetStatus(isAdmin ? "completed" : "pending_approval")}
              >
                {updatePending ? (
                  <Loader2 size={14} className="animate-spin mr-1.5" />
                ) : (
                  <Check size={14} className="mr-1.5" />
                )}
                {isAdmin ? "Mark as Completed" : "Submit for Approval"}
              </Button>
            )}
          </>
        )}
      </div>
    </DialogFooter>
  );
}
