import React from "react";
import { Share2, UserCheck, Trash2, AlertTriangle, PhoneMissed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { TaskRecord } from "@/services/tasks";

interface TaskSubModalsProps {
  task: TaskRecord;
  activeTask: TaskRecord;
  allStaffMembers: any[];
  showForwardModal: boolean;
  setShowForwardModal: (val: boolean) => void;
  showReassignModal: boolean;
  setShowReassignModal: (val: boolean) => void;
  showRequestDeleteModal: boolean;
  setShowRequestDeleteModal: (val: boolean) => void;
  showAdminDeleteModal: boolean;
  setShowAdminDeleteModal: (val: boolean) => void;
  showRejectModal: boolean;
  setShowRejectModal: (val: boolean) => void;
  showRescheduleModal: boolean;
  setShowRescheduleModal: (val: boolean) => void;
  targetUserId: string;
  setTargetUserId: (val: string) => void;
  actionNote: string;
  setActionNote: (val: string) => void;
  deleteRequestReason: string;
  setDeleteRequestReason: (val: string) => void;
  rejectReason: string;
  setRejectReason: (val: string) => void;
  rescheduleDateTime: string;
  setRescheduleDateTime: (val: string) => void;
  rescheduleReason: string;
  setRescheduleReason: (val: string) => void;
  isRescheduling: boolean;
  forwardTask: any;
  reassignTask: any;
  requestTaskDeletion: any;
  handleDeleteTask: () => void;
  rejectTask: any;
  handleConfirmReschedule: () => void;
  handleQuickReschedulePreset: (minsOrHours: number, isDay?: boolean) => void;
  onClose: () => void;
}

export function TaskSubModals({
  task,
  activeTask,
  allStaffMembers,
  showForwardModal,
  setShowForwardModal,
  showReassignModal,
  setShowReassignModal,
  showRequestDeleteModal,
  setShowRequestDeleteModal,
  showAdminDeleteModal,
  setShowAdminDeleteModal,
  showRejectModal,
  setShowRejectModal,
  showRescheduleModal,
  setShowRescheduleModal,
  targetUserId,
  setTargetUserId,
  actionNote,
  setActionNote,
  deleteRequestReason,
  setDeleteRequestReason,
  rejectReason,
  setRejectReason,
  rescheduleDateTime,
  setRescheduleDateTime,
  rescheduleReason,
  setRescheduleReason,
  isRescheduling,
  forwardTask,
  reassignTask,
  requestTaskDeletion,
  handleDeleteTask,
  rejectTask,
  handleConfirmReschedule,
  handleQuickReschedulePreset,
  onClose,
}: TaskSubModalsProps) {
  return (
    <>
      {/* Reschedule Call Modal */}
      {showRescheduleModal && (
        <Dialog open={showRescheduleModal} onOpenChange={(open) => !open && setShowRescheduleModal(false)}>
          <DialogContent className="max-w-md rounded-xl p-6">
            <DialogHeader>
              <div className="flex items-center gap-2.5">
                <span className="grid size-10 place-items-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <PhoneMissed size={20} />
                </span>
                <div>
                  <DialogTitle className="text-lg font-semibold">Reschedule Call</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Person did not pick up? Postpone and update this call reminder.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="my-3 space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Contact / Client</Label>
                <p className="rounded-md border border-border/60 bg-muted/30 p-2 text-xs font-semibold text-foreground">
                  {activeTask.callReminder?.clientName || activeTask.title}
                  {activeTask.callReminder?.phone ? ` (${activeTask.callReminder.phone})` : ""}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">New Scheduled Time</Label>
                <Input
                  type="datetime-local"
                  value={rescheduleDateTime}
                  onChange={(e) => setRescheduleDateTime(e.target.value)}
                  className="text-xs font-mono"
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[11px] text-muted-foreground self-center mr-1">Quick:</span>
                  <button
                    type="button"
                    onClick={() => handleQuickReschedulePreset(15)}
                    className="rounded border border-border/80 bg-muted/40 px-2 py-0.5 text-[10px] font-medium hover:border-primary/50"
                  >
                    +15m
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickReschedulePreset(30)}
                    className="rounded border border-border/80 bg-muted/40 px-2 py-0.5 text-[10px] font-medium hover:border-primary/50"
                  >
                    +30m
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickReschedulePreset(60)}
                    className="rounded border border-border/80 bg-muted/40 px-2 py-0.5 text-[10px] font-medium hover:border-primary/50"
                  >
                    +1 hour
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickReschedulePreset(120)}
                    className="rounded border border-border/80 bg-muted/40 px-2 py-0.5 text-[10px] font-medium hover:border-primary/50"
                  >
                    +2 hours
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickReschedulePreset(1, true)}
                    className="rounded border border-border/80 bg-muted/40 px-2 py-0.5 text-[10px] font-medium hover:border-primary/50"
                  >
                    Tomorrow 10 AM
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Reason / Remark <span className="text-[11px] font-normal text-muted-foreground">(Optional)</span></Label>
                <Input
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  placeholder="e.g. Person did not pick up call (optional)"
                  className="text-xs"
                />
              </div>
            </div>

            <DialogFooter className="mt-2 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowRescheduleModal(false)} className="text-xs">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmReschedule}
                disabled={isRescheduling}
                className="gradient-primary text-primary-foreground text-xs shadow-soft font-semibold"
              >
                {isRescheduling ? "Rescheduling…" : "Confirm Reschedule"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Forward Task Dialog */}
      <Dialog open={showForwardModal} onOpenChange={setShowForwardModal}>
        <DialogContent className="z-[70] rounded-xl border border-border bg-card p-6 shadow-lift max-w-md" overlayClassName="z-[65]">
          <DialogHeader>
            <DialogTitle className="text-title font-semibold text-foreground flex items-center gap-2">
              <Share2 size={18} /> Forward Task
            </DialogTitle>
            <DialogDescription className="text-helper text-muted-foreground mt-1">
              Forward task &ldquo;{task.title}&rdquo; to a team member.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!targetUserId) {
                toast.error("Please select an employee");
                return;
              }
              try {
                await forwardTask.mutateAsync({
                  taskId: task._id,
                  toUserId: targetUserId,
                  note: actionNote.trim() || undefined,
                });
                toast.success("Task forwarded successfully");
                setShowForwardModal(false);
                setTargetUserId("");
                setActionNote("");
              } catch (err: any) {
                toast.error(err?.response?.data?.message || "Failed to forward task");
              }
            }}
            className="mt-4 space-y-4"
          >
            <div className="space-y-1.5">
              <Label className="text-helper">Forward To</Label>
              <select
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-helper"
                required
              >
                <option value="">Select team member...</option>
                {allStaffMembers.map((emp: any) => (
                  <option key={emp._id} value={emp._id}>
                    {emp.name} {emp.title ? `(${emp.title})` : emp.role ? `(${emp.role})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-helper">Note / Reason (Optional)</Label>
              <Input
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder="Reason for forwarding..."
                className="h-10 rounded-md"
              />
            </div>
            <DialogFooter className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowForwardModal(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="gradient-primary text-primary-foreground font-semibold" disabled={forwardTask.isPending}>
                {forwardTask.isPending ? "Forwarding..." : "Forward Task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reassign Task Dialog */}
      <Dialog open={showReassignModal} onOpenChange={setShowReassignModal}>
        <DialogContent className="z-[70] rounded-xl border border-border bg-card p-6 shadow-lift max-w-md" overlayClassName="z-[65]">
          <DialogHeader>
            <DialogTitle className="text-title font-semibold text-foreground flex items-center gap-2">
              <UserCheck size={18} /> Reassign Task
            </DialogTitle>
            <DialogDescription className="text-helper text-muted-foreground mt-1">
              Reassign task &ldquo;{task.title}&rdquo; to a new owner.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!targetUserId) {
                toast.error("Please select an employee");
                return;
              }
              try {
                await reassignTask.mutateAsync({
                  taskId: task._id,
                  toUserId: targetUserId,
                  note: actionNote.trim() || undefined,
                });
                toast.success("Task reassigned successfully");
                setShowReassignModal(false);
                setTargetUserId("");
                setActionNote("");
              } catch (err: any) {
                toast.error(err?.response?.data?.message || "Failed to reassign task");
              }
            }}
            className="mt-4 space-y-4"
          >
            <div className="space-y-1.5">
              <Label className="text-helper">New Assignee</Label>
              <select
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-helper"
                required
              >
                <option value="">Select team member...</option>
                {allStaffMembers.map((emp: any) => (
                  <option key={emp._id} value={emp._id}>
                    {emp.name} {emp.title ? `(${emp.title})` : emp.role ? `(${emp.role})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-helper">Reason for Reassignment (Optional)</Label>
              <Input
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder="Reason for reassignment..."
                className="h-10 rounded-md"
              />
            </div>
            <DialogFooter className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowReassignModal(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="gradient-primary text-primary-foreground font-semibold" disabled={reassignTask.isPending}>
                {reassignTask.isPending ? "Reassigning..." : "Reassign Task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Staff Request Task Deletion Modal */}
      <Dialog open={showRequestDeleteModal} onOpenChange={setShowRequestDeleteModal}>
        <DialogContent className="z-[70] rounded-xl border border-border bg-card p-6 shadow-lift max-w-md" overlayClassName="z-[65]">
          <DialogHeader>
            <DialogTitle className="text-title font-semibold text-foreground flex items-center gap-2 text-destructive">
              <Trash2 size={18} /> Request Task Deletion
            </DialogTitle>
            <DialogDescription className="text-helper text-muted-foreground mt-1">
              Submit a deletion request for &ldquo;{task.title}&rdquo; to firm administrators.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!deleteRequestReason.trim()) {
                toast.error("Please enter a reason for deletion");
                return;
              }
              try {
                await requestTaskDeletion.mutateAsync({
                  taskId: task._id,
                  reason: deleteRequestReason.trim(),
                });
                toast.success("Task deletion requested successfully");
                setShowRequestDeleteModal(false);
                setDeleteRequestReason("");
              } catch (err: any) {
                toast.error(err?.response?.data?.message || "Failed to request deletion");
              }
            }}
            className="mt-4 space-y-4"
          >
            <div className="space-y-1.5">
              <Label className="text-helper font-medium">Reason for Deletion <span className="text-destructive">*</span></Label>
              <textarea
                value={deleteRequestReason}
                onChange={(e) => setDeleteRequestReason(e.target.value)}
                rows={3}
                placeholder="Why should this task be deleted? (e.g. Duplicate, Created by mistake, Case settled)..."
                className="w-full rounded-md border border-border bg-background p-2.5 text-helper focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                required
              />
            </div>
            <DialogFooter className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowRequestDeleteModal(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" variant="destructive" disabled={requestTaskDeletion.isPending}>
                {requestTaskDeletion.isPending ? "Submitting..." : "Submit Deletion Request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Admin Instant Delete Modal */}
      <Dialog open={showAdminDeleteModal} onOpenChange={setShowAdminDeleteModal}>
        <DialogContent className="z-[70] rounded-xl border border-destructive/30 bg-card p-6 shadow-lift max-w-md" overlayClassName="z-[65]">
          <DialogHeader>
            <DialogTitle className="text-title font-semibold text-destructive flex items-center gap-2">
              <AlertTriangle size={18} /> Delete Task Permanently
            </DialogTitle>
            <DialogDescription className="text-helper text-muted-foreground mt-1">
              Are you sure you want to permanently delete &ldquo;{task.title}&rdquo;? This action will remove all checklists, sub-items, and task records immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowAdminDeleteModal(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={async () => {
                setShowAdminDeleteModal(false);
                await handleDeleteTask();
              }}
            >
              Confirm Permanent Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject / Request Changes Modal */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent className="z-[70] rounded-xl border border-amber-500/30 bg-card p-6 shadow-lift max-w-md" overlayClassName="z-[65]">
          <DialogHeader>
            <DialogTitle className="text-title font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-500" /> Request Task Changes
            </DialogTitle>
            <DialogDescription className="text-helper text-muted-foreground mt-1">
              Provide feedback explaining why this task is not approved and what revisions are required.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!rejectReason.trim()) {
                toast.error("Please enter a reason or feedback for the requested changes");
                return;
              }
              try {
                await rejectTask.mutateAsync({
                  taskId: task._id,
                  reason: rejectReason.trim(),
                });
                toast.success("Changes requested. Task returned to in progress.");
                setShowRejectModal(false);
                setRejectReason("");
                onClose();
              } catch (err: any) {
                toast.error(err?.response?.data?.message || "Failed to request changes");
              }
            }}
            className="mt-4 space-y-4"
          >
            <div className="space-y-1.5">
              <Label className="text-helper font-medium">Feedback / Revisions Required <span className="text-destructive">*</span></Label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder="Specific instructions or missing items that need to be addressed before signoff..."
                className="w-full rounded-md border border-border bg-background p-2.5 text-helper focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                required
              />
            </div>
            <DialogFooter className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowRejectModal(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="gradient-primary text-primary-foreground font-semibold" disabled={rejectTask.isPending}>
                {rejectTask.isPending ? "Submitting..." : "Send Feedback & Request Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
