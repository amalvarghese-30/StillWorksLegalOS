import { useState, useEffect, useRef, useCallback } from "react";
import { Clock, CheckCircle2, ExternalLink, BellRing, User, UserCheck, Calendar, AlertTriangle, ChevronRight, ChevronLeft, X, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSocketEvent } from "@/lib/socket";
import { useAuth } from "@/lib/auth";
import { useUpdateTask, type TaskRecord } from "@/services/tasks";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import { api } from "@/services/api";
import { toast } from "sonner";
import { notifications } from "@/platform";

export interface PendingReminderItem {
  taskId: string;
  taskTitle: string;
  clientName: string;
  assignedStaff: string;
  assignedToId?: string | null;
  deadline?: string | null;
  priority?: string;
  pendingHours: number;
  slot?: number;
}

/** Chime alert using Web Audio API */
function playPendingAlertChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };

    // Soft double chime (659Hz E5 -> 880Hz A5)
    playTone(659, 0, 0.2);
    playTone(880, 0.22, 0.35);
  } catch (err) {
    console.warn("Could not play pending task reminder chime:", err);
  }
}

export function PendingTaskReminderAlerts() {
  const { user } = useAuth();
  const currentUserId = user?._id?.toString?.() || (user as any)?.id?.toString?.();
  const isAdmin = user?.role === "admin";

  const [alerts, setAlerts] = useState<PendingReminderItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedTaskForModal, setSelectedTaskForModal] = useState<TaskRecord | null>(null);
  const [actionPending, setActionPending] = useState<"dismiss" | "snooze" | "done" | null>(null);

  const updateTask = useUpdateTask();
  const transientSuppressedRef = useRef<Set<string>>(new Set());

  // Fetch pending reminders from server
  const fetchPendingReminders = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get<{ pendingReminders: PendingReminderItem[] }>("/tasks/pending-reminders");
      const list = res?.pendingReminders || (res as any)?.data?.pendingReminders || [];

      // Filter out locally suppressed items and enforce user access isolation
      const active = list.filter((item: PendingReminderItem) => {
        if (transientSuppressedRef.current.has(item.taskId)) return false;
        // User access isolation: each user (including Admin) only sees reminders for tasks assigned to them
        if (item.assignedToId && currentUserId && item.assignedToId !== currentUserId) {
          return false;
        }
        return true;
      });

      if (active.length > 0) {
        setAlerts((prev) => {
          // Merge unique items by taskId
          const existingIds = new Set(prev.map((a) => a.taskId));
          const newItems = active.filter((a: PendingReminderItem) => !existingIds.has(a.taskId));
          if (newItems.length > 0 && prev.length === 0) {
            playPendingAlertChime();
          }
          return [...prev, ...newItems];
        });
      }
    } catch (err) {
      console.error("[PendingTaskReminderAlerts] Fetch error:", err);
    }
  }, [user, isAdmin, currentUserId]);

  // Periodic poll every 5 minutes
  useEffect(() => {
    fetchPendingReminders();
    const interval = setInterval(fetchPendingReminders, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchPendingReminders]);

  // Real-time socket listener
  useSocketEvent("task:pending-reminder", (data: unknown) => {
    const item = data as PendingReminderItem;
    if (!item?.taskId) return;

    if (transientSuppressedRef.current.has(item.taskId)) return;

    // User access isolation: only alert if the task is assigned to the current user
    if (item.assignedToId && currentUserId && item.assignedToId !== currentUserId) {
      return;
    }

    setAlerts((prev) => {
      const exists = prev.some((p) => p.taskId === item.taskId);
      if (exists) return prev;
      playPendingAlertChime();
      notifications.show({
        id: `pending-${item.taskId}`,
        title: `⏳ Pending Work: ${item.taskTitle}`,
        body: `Client: ${item.clientName} • Assigned To: ${item.assignedStaff} • Pending: ${item.pendingHours}h`,
      });
      return [...prev, item];
    });
  });

  const currentAlert = alerts[currentIndex] || null;

  const handleSnooze = async (hours = 2) => {
    if (!currentAlert || actionPending) return;
    const targetAlert = currentAlert;
    setActionPending("snooze");

    try {
      await api.post(`/tasks/${targetAlert.taskId}/reminders/snooze`, { hours });
      transientSuppressedRef.current.add(targetAlert.taskId);
      removeCurrentAlert();
      toast.info(`Reminder for "${targetAlert.taskTitle}" snoozed for ${hours} hours.`);
    } catch (err: any) {
      console.error("[PendingTaskReminderAlerts] Snooze error:", err);
      toast.error(err?.message || "Failed to snooze reminder on server. Please try again.");
    } finally {
      setActionPending(null);
    }
  };

  const handleDismiss = async () => {
    if (!currentAlert || actionPending) return;
    const targetAlert = currentAlert;
    setActionPending("dismiss");

    try {
      await api.post(`/tasks/${targetAlert.taskId}/reminders/dismiss`, { slot: targetAlert.slot });
      transientSuppressedRef.current.add(targetAlert.taskId);
      removeCurrentAlert();
    } catch (err: any) {
      console.error("[PendingTaskReminderAlerts] Dismiss error:", err);
      toast.error(err?.message || "Failed to dismiss reminder on server. Please try again.");
    } finally {
      setActionPending(null);
    }
  };

  const removeCurrentAlert = () => {
    setAlerts((prev) => {
      const next = prev.filter((_, idx) => idx !== currentIndex);
      if (currentIndex >= next.length && next.length > 0) {
        setCurrentIndex(next.length - 1);
      }
      return next;
    });
  };

  const handleMarkDone = async () => {
    if (!currentAlert || actionPending) return;
    const targetAlert = currentAlert;
    setActionPending("done");

    try {
      const res = await updateTask.mutateAsync({
        id: targetAlert.taskId,
        data: {
          status: "completed",
        },
      });
      const resolvedStatus = (res as any)?.task?.status;
      if (resolvedStatus === "pending_approval") {
        toast.info(`Task "${targetAlert.taskTitle}" submitted for admin approval.`);
        transientSuppressedRef.current.add(targetAlert.taskId);
        removeCurrentAlert();
      } else if (resolvedStatus === "completed") {
        toast.success(`Task "${targetAlert.taskTitle}" marked as completed!`);
        transientSuppressedRef.current.add(targetAlert.taskId);
        removeCurrentAlert();
      } else {
        toast.error("Unexpected task status received from server. Completion unverified.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to mark task as completed.");
    } finally {
      setActionPending(null);
    }
  };

  const handleOpenTask = () => {
    if (!currentAlert || actionPending) return;

    // Build a minimal TaskRecord stub from the reminder data we already have.
    // TaskDetailDialog's internal useTask(task._id, task) hook will fetch the
    // full record lazily — no blocking pre-fetch needed here.
    // Use Object.assign to avoid assigning `undefined` to optional keys under
    // exactOptionalPropertyTypes.
    const stubBase = {
      _id: currentAlert.taskId,
      title: currentAlert.taskTitle,
      description: "",
      category: "",
      priority: (currentAlert.priority as TaskRecord["priority"]) ?? ("Medium" as const),
      status: "pending" as const,
      deadline: currentAlert.deadline ?? null,
      checklist: [] as TaskRecord["checklist"],
      clientName: currentAlert.clientName,
      createdBy: currentAlert.assignedToId ?? "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const stubTask: TaskRecord = currentAlert.assignedToId
      ? Object.assign(stubBase, {
          assignedTo: { _id: currentAlert.assignedToId, name: currentAlert.assignedStaff },
        })
      : stubBase;

    setSelectedTaskForModal(stubTask);

    // Silently dismiss the reminder on the server — best-effort, non-blocking.
    api
      .post(`/tasks/${currentAlert.taskId}/reminders/dismiss`, { slot: currentAlert.slot })
      .catch(() => {});
    transientSuppressedRef.current.add(currentAlert.taskId);
    removeCurrentAlert();
  };

  // Mobile swipe-to-dismiss state and handlers (declared unconditionally at top level)
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const [swipeOffsetX, setSwipeOffsetX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const isHorizontalSwipe = useRef<boolean | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch0 = e.touches[0];
    if (!touch0) return;
    touchStartX.current = touch0.clientX;
    touchStartY.current = touch0.clientY;
    isHorizontalSwipe.current = null;
    setIsSwiping(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch0 = e.touches[0];
    if (!touch0) return;
    const deltaX = touch0.clientX - touchStartX.current;
    const deltaY = touch0.clientY - touchStartY.current;

    if (isHorizontalSwipe.current === null) {
      if (Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY)) {
        isHorizontalSwipe.current = true;
      } else if (Math.abs(deltaY) > 10) {
        isHorizontalSwipe.current = false;
      }
    }

    if (isHorizontalSwipe.current) {
      setIsSwiping(true);
      setSwipeOffsetX(deltaX);
    }
  };

  const handleTouchEnd = () => {
    if (isHorizontalSwipe.current && Math.abs(swipeOffsetX) >= 75) {
      // Swiped past threshold (left or right)
      setSwipeOffsetX(swipeOffsetX > 0 ? 500 : -500);
      setTimeout(() => {
        handleDismiss();
        setSwipeOffsetX(0);
        setIsSwiping(false);
      }, 150);
    } else {
      setSwipeOffsetX(0);
      setIsSwiping(false);
    }
    isHorizontalSwipe.current = null;
  };

  const formatDeadlineText = (d?: string | null) => {
    if (!d) return "No deadline set";
    try {
      const date = new Date(d);
      if (isNaN(date.getTime())) return "Invalid deadline";
      const isOverdue = date.getTime() < Date.now();
      return (
        <span className={isOverdue ? "text-destructive font-semibold" : "text-foreground"}>
          {date.toLocaleDateString("en-IN", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
          {isOverdue && " (Overdue)"}
        </span>
      );
    } catch {
      return "No deadline";
    }
  };

  if (!currentAlert) {
    return (
      <>
        {selectedTaskForModal && (
          <TaskDetailDialog
            open={Boolean(selectedTaskForModal)}
            onClose={() => setSelectedTaskForModal(null)}
            task={selectedTaskForModal}
          />
        )}
      </>
    );
  }

  return (
    <>
      <Dialog open={Boolean(currentAlert)} onOpenChange={(open) => !open && handleDismiss()}>
        <DialogContent
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            transform: isSwiping || swipeOffsetX !== 0 ? `translateX(${swipeOffsetX}px)` : undefined,
            transition: isSwiping ? "none" : "transform 0.2s ease",
            opacity: isSwiping ? Math.max(0.3, 1 - Math.abs(swipeOffsetX) / 300) : 1,
          }}
          className="max-w-md border-amber-500/50 bg-card p-6 shadow-2xl animate-in zoom-in-95 touch-pan-y"
        >
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="grid size-11 place-items-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-4 ring-amber-500/20 animate-pulse">
                  <Clock size={22} strokeWidth={2.5} />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-pill bg-amber-500 px-2 py-0.5 text-[10px] font-bold tracking-wider text-black uppercase">
                      2-HOUR PENDING REMINDER
                    </span>
                    <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-300">
                      Pending {currentAlert.pendingHours}+ hrs
                    </Badge>
                  </div>
                  <DialogTitle className="mt-1 text-lg font-semibold tracking-tight text-foreground line-clamp-1">
                    {currentAlert.taskTitle}
                  </DialogTitle>
                </div>
              </div>
            </div>

            <DialogDescription className="mt-2 text-xs text-muted-foreground">
              This task has been pending for over 2 hours without completion. Please review or take action.
            </DialogDescription>
          </DialogHeader>

          {/* Core Required Details */}
          <div className="my-3 space-y-2.5 rounded-xl border border-border/80 bg-muted/40 p-3.5 text-xs">
            {/* Task Name */}
            <div className="flex items-start justify-between gap-2 border-b border-border/50 pb-2">
              <span className="text-muted-foreground font-medium shrink-0">Task Name:</span>
              <span className="font-semibold text-foreground text-right">{currentAlert.taskTitle}</span>
            </div>

            {/* Client Name */}
            <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
              <span className="text-muted-foreground font-medium flex items-center gap-1.5 shrink-0">
                <User size={13} className="text-primary" /> Client Name:
              </span>
              <span className="font-semibold text-foreground text-right">{currentAlert.clientName}</span>
            </div>

            {/* Assigned Staff */}
            <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
              <span className="text-muted-foreground font-medium flex items-center gap-1.5 shrink-0">
                <UserCheck size={13} className="text-emerald-600" /> Assigned To:
              </span>
              <span className="font-semibold text-foreground text-right">{currentAlert.assignedStaff}</span>
            </div>

            {/* Deadline */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground font-medium flex items-center gap-1.5 shrink-0">
                <Calendar size={13} className="text-amber-600" /> Deadline:
              </span>
              <span className="text-right">{formatDeadlineText(currentAlert.deadline)}</span>
            </div>
          </div>

          {/* Pagination when multiple tasks are pending */}
          {alerts.length > 1 && (
            <div className="flex items-center justify-between border-t border-border/60 pt-2 text-xs text-muted-foreground">
              <span>
                Task {currentIndex + 1} of {alerts.length}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                >
                  <ChevronLeft size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={currentIndex >= alerts.length - 1}
                  onClick={() => setCurrentIndex((i) => Math.min(alerts.length - 1, i + 1))}
                >
                  <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}

          <DialogFooter className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-between">
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSnooze(2)}
                disabled={Boolean(actionPending)}
                className="text-xs"
                title="Snooze reminder for 2 hours"
              >
                {actionPending === "snooze" ? (
                  <Loader2 size={12} className="mr-1 animate-spin" />
                ) : (
                  <Clock size={12} className="mr-1" />
                )}
                Snooze 2h
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenTask}
                disabled={Boolean(actionPending)}
                className="text-xs"
              >
                <ExternalLink size={12} className="mr-1" />
                Open Task
              </Button>
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                disabled={Boolean(actionPending)}
                className="text-xs flex-1 sm:flex-none"
              >
                {actionPending === "dismiss" ? (
                  <Loader2 size={12} className="mr-1 animate-spin" />
                ) : null}
                Dismiss
              </Button>
              <Button
                size="sm"
                onClick={handleMarkDone}
                disabled={Boolean(actionPending) || updateTask.isPending}
                className="gradient-primary text-primary-foreground text-xs shadow-soft flex-1 sm:flex-none font-semibold"
              >
                {actionPending === "done" || updateTask.isPending ? (
                  <Loader2 size={13} className="mr-1 animate-spin" />
                ) : (
                  <CheckCircle2 size={13} className="mr-1 text-emerald-400" />
                )}
                Mark Done
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedTaskForModal && (
        <TaskDetailDialog
          open={Boolean(selectedTaskForModal)}
          onClose={() => setSelectedTaskForModal(null)}
          task={selectedTaskForModal}
        />
      )}
    </>
  );
}
