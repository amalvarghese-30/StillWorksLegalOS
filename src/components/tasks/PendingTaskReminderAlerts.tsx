import { useState, useEffect, useRef, useCallback } from "react";
import {
  Clock,
  CheckCircle2,
  ExternalLink,
  User,
  UserCheck,
  Calendar,
  ChevronRight,
  ChevronLeft,
  Loader2,
  CalendarClock,
  CalendarDays,
  Layers,
  CheckSquare,
  Square,
  AlertCircle,
  HelpCircle,
  CalendarPlus,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSocketEvent } from "@/lib/socket";
import { useAuth } from "@/lib/auth";
import {
  useUpdateTask,
  usePostponeTaskReminder,
  useBulkPostponeTaskReminders,
  useUpdateTaskDeadline,
  type TaskRecord,
} from "@/services/tasks";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import { api } from "@/services/api";
import { toast } from "sonner";
import { notifications } from "@/platform";
import { formatSafeDateTime } from "@/lib/dates";

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
  postponedUntil?: string | null;
  postponeReason?: string | null;
}

/** Chime alert using Web Audio API */
function playPendingAlertChime() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getPresetDate(preset: "later_today" | "tomorrow" | "next_week"): Date {
  const now = new Date();
  if (preset === "later_today") {
    return new Date(now.getTime() + 4 * 60 * 60 * 1000);
  }
  if (preset === "tomorrow") {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return d;
  }
  const d = new Date(now);
  d.setDate(d.getDate() + 7);
  d.setHours(10, 0, 0, 0);
  return d;
}

export function PendingTaskReminderAlerts() {
  const { user } = useAuth();
  const currentUserId = user?._id?.toString?.() || (user as any)?.id?.toString?.();
  const isAdmin = user?.role === "admin";

  const [alerts, setAlerts] = useState<PendingReminderItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedTaskForModal, setSelectedTaskForModal] = useState<TaskRecord | null>(null);
  const [actionPending, setActionPending] = useState<"dismiss" | "snooze" | "done" | "postpone" | "deadline" | null>(null);

  // Bulk management view toggle & selection state
  const [isBulkView, setIsBulkView] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  // Postpone modal state
  const [postponeModalTarget, setPostponeModalTarget] = useState<{
    taskIds: string[];
    taskTitles: string[];
  } | null>(null);
  const [postponePreset, setPostponePreset] = useState<"later_today" | "tomorrow" | "next_week" | "custom">("tomorrow");
  const [customPostponeDate, setCustomPostponeDate] = useState(() => {
    const tmrw = getPresetDate("tomorrow");
    return toDatetimeLocal(tmrw);
  });
  const [postponeReason, setPostponeReason] = useState("");

  // Deadline modal state
  const [deadlineModalTarget, setDeadlineModalTarget] = useState<{
    taskId: string;
    taskTitle: string;
    currentDeadline: string | null;
  } | null>(null);
  const [newDeadlineInput, setNewDeadlineInput] = useState("");

  const updateTask = useUpdateTask();
  const postponeReminder = usePostponeTaskReminder();
  const bulkPostponeReminders = useBulkPostponeTaskReminders();
  const updateDeadline = useUpdateTaskDeadline();

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
  }, [user, currentUserId]);

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

  const removeAlertIds = (taskIds: string[]) => {
    const idSet = new Set(taskIds);
    setAlerts((prev) => {
      const next = prev.filter((a) => !idSet.has(a.taskId));
      if (currentIndex >= next.length && next.length > 0) {
        setCurrentIndex(next.length - 1);
      }
      return next;
    });
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      for (const id of taskIds) next.delete(id);
      return next;
    });
  };

  const removeCurrentAlert = () => {
    if (!currentAlert) return;
    removeAlertIds([currentAlert.taskId]);
  };

  // --- ACTIONS ---

  // 1. Snooze (2 hours)
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

  // 2. Dismiss
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

  // 3. Mark Done
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

  // 4. Open Task
  const handleOpenTask = () => {
    if (!currentAlert || actionPending) return;

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

    api.post(`/tasks/${currentAlert.taskId}/reminders/dismiss`, { slot: currentAlert.slot }).catch(() => {});
    transientSuppressedRef.current.add(currentAlert.taskId);
    removeCurrentAlert();
  };

  // 5. Open Postpone Dialog for Current Item
  const openSinglePostpone = (item: PendingReminderItem) => {
    setPostponeModalTarget({
      taskIds: [item.taskId],
      taskTitles: [item.taskTitle],
    });
    setPostponePreset("tomorrow");
    const tmrw = getPresetDate("tomorrow");
    setCustomPostponeDate(toDatetimeLocal(tmrw));
    setPostponeReason("");
  };

  // 6. Open Bulk Postpone Dialog
  const openBulkPostpone = () => {
    if (selectedTaskIds.size === 0) {
      toast.warning("Please select at least one reminder to postpone.");
      return;
    }
    const selectedList = alerts.filter((a) => selectedTaskIds.has(a.taskId));
    setPostponeModalTarget({
      taskIds: selectedList.map((a) => a.taskId),
      taskTitles: selectedList.map((a) => a.taskTitle),
    });
    setPostponePreset("tomorrow");
    const tmrw = getPresetDate("tomorrow");
    setCustomPostponeDate(toDatetimeLocal(tmrw));
    setPostponeReason("");
  };

  // 7. Confirm Postponement
  const handleConfirmPostpone = async () => {
    if (!postponeModalTarget || actionPending) return;
    setActionPending("postpone");

    let targetDate: Date;
    if (postponePreset === "custom") {
      targetDate = new Date(customPostponeDate);
      if (isNaN(targetDate.getTime()) || targetDate.getTime() <= Date.now()) {
        toast.error("Please select a valid future date and time.");
        setActionPending(null);
        return;
      }
    } else {
      targetDate = getPresetDate(postponePreset);
    }

    const { taskIds } = postponeModalTarget;
    try {
      if (taskIds.length === 1) {
        const taskId = taskIds[0]!;
        await postponeReminder.mutateAsync({
          taskId,
          data: {
            postponeUntil: targetDate.toISOString(),
            reason: postponeReason.trim() || undefined,
          },
        });
        transientSuppressedRef.current.add(taskId);
        removeAlertIds([taskId]);
        toast.success(`Reminder postponed until ${formatSafeDateTime(targetDate)}.`);
      } else {
        const res = await bulkPostponeReminders.mutateAsync({
          taskIds,
          postponeUntil: targetDate.toISOString(),
          reason: postponeReason.trim() || undefined,
        });

        for (const id of taskIds) {
          transientSuppressedRef.current.add(id);
        }
        removeAlertIds(taskIds);

        if (res.failedCount > 0) {
          toast.warning(
            `Postponed ${res.updatedCount} reminder(s). ${res.failedCount} failed to update.`,
          );
        } else {
          toast.success(`Postponed ${res.updatedCount} reminders until ${formatSafeDateTime(targetDate)}.`);
        }
      }
      setPostponeModalTarget(null);
    } catch (err: any) {
      console.error("[PendingTaskReminderAlerts] Postpone error:", err);
      toast.error(err?.message || "Failed to postpone reminder(s). Please try again.");
    } finally {
      setActionPending(null);
    }
  };

  // 8. Open Change Planned Date / Deadline Modal
  const openDeadlineModal = (item: PendingReminderItem) => {
    setDeadlineModalTarget({
      taskId: item.taskId,
      taskTitle: item.taskTitle,
      currentDeadline: item.deadline || null,
    });
    if (item.deadline) {
      try {
        const d = new Date(item.deadline);
        if (!isNaN(d.getTime())) {
          setNewDeadlineInput(toDatetimeLocal(d));
        } else {
          setNewDeadlineInput(toDatetimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)));
        }
      } catch {
        setNewDeadlineInput(toDatetimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)));
      }
    } else {
      setNewDeadlineInput(toDatetimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)));
    }
  };

  // 9. Confirm Deadline Change
  const handleConfirmDeadlineChange = async () => {
    if (!deadlineModalTarget || actionPending) return;
    setActionPending("deadline");

    try {
      let targetIso: string | null = null;
      if (newDeadlineInput) {
        const d = new Date(newDeadlineInput);
        if (isNaN(d.getTime())) {
          toast.error("Please enter a valid deadline date and time.");
          setActionPending(null);
          return;
        }
        targetIso = d.toISOString();
      }

      await updateDeadline.mutateAsync({
        taskId: deadlineModalTarget.taskId,
        deadline: targetIso,
      });

      // Update in local alerts
      setAlerts((prev) =>
        prev.map((a) =>
          a.taskId === deadlineModalTarget.taskId ? { ...a, deadline: targetIso } : a,
        ),
      );

      toast.success(
        targetIso
          ? `Planned deadline updated to ${formatSafeDateTime(new Date(targetIso))}.`
          : "Deadline cleared for this task.",
      );
      setDeadlineModalTarget(null);
    } catch (err: any) {
      console.error("[PendingTaskReminderAlerts] Deadline update error:", err);
      toast.error(err?.message || "Failed to update deadline.");
    } finally {
      setActionPending(null);
    }
  };

  // Bulk Selection Helpers
  const toggleSelectAll = () => {
    if (selectedTaskIds.size === alerts.length) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(alerts.map((a) => a.taskId)));
    }
  };

  const toggleSelectTask = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  // Mobile swipe-to-dismiss state
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
          {formatSafeDateTime(date)}
          {isOverdue && " (Overdue)"}
        </span>
      );
    } catch {
      return "No deadline";
    }
  };

  // Preview formatted target date for postpone dialog
  const getPostponeTargetDatePreview = (): Date => {
    if (postponePreset === "custom") {
      const d = new Date(customPostponeDate);
      return isNaN(d.getTime()) ? new Date() : d;
    }
    return getPresetDate(postponePreset);
  };

  if (alerts.length === 0) {
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
      {/* ============================================================== */}
      {/* MAIN REMINDER DIALOG (Card View or Bulk View)                  */}
      {/* ============================================================== */}
      <Dialog
        open={alerts.length > 0 && !postponeModalTarget && !deadlineModalTarget}
        onOpenChange={(open) => !open && handleDismiss()}
      >
        <DialogContent
          onTouchStart={isBulkView ? undefined : handleTouchStart}
          onTouchMove={isBulkView ? undefined : handleTouchMove}
          onTouchEnd={isBulkView ? undefined : handleTouchEnd}
          style={
            !isBulkView
              ? {
                  transform:
                    isSwiping || swipeOffsetX !== 0 ? `translateX(${swipeOffsetX}px)` : undefined,
                  transition: isSwiping ? "none" : "transform 0.2s ease",
                  opacity: isSwiping ? Math.max(0.3, 1 - Math.abs(swipeOffsetX) / 300) : 1,
                }
              : undefined
          }
          className={`${
            isBulkView ? "max-w-2xl" : "max-w-md"
          } border-amber-500/50 bg-card p-6 shadow-2xl animate-in zoom-in-95 touch-pan-y transition-all`}
        >
          <DialogHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="grid size-11 place-items-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-4 ring-amber-500/20 animate-pulse">
                  <Clock size={22} strokeWidth={2.5} />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-pill bg-amber-500 px-2 py-0.5 text-[10px] font-bold tracking-wider text-black uppercase">
                      2-HOUR PENDING REMINDER
                    </span>
                    {!isBulkView && currentAlert && (
                      <Badge
                        variant="outline"
                        className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-300"
                      >
                        Pending {currentAlert.pendingHours}+ hrs
                      </Badge>
                    )}
                  </div>
                  <DialogTitle className="mt-1 text-lg font-semibold tracking-tight text-foreground line-clamp-1">
                    {isBulkView
                      ? `Pending Work Reminders (${alerts.length})`
                      : currentAlert?.taskTitle || "Pending Work"}
                  </DialogTitle>
                </div>
              </div>

              {/* View Switcher: Single Card vs Bulk List (when multiple items) */}
              {alerts.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsBulkView(!isBulkView)}
                  className="h-8 text-xs gap-1.5 shrink-0 border-amber-500/30 hover:bg-amber-500/10"
                >
                  <Layers size={13} className="text-amber-500" />
                  {isBulkView ? "Card View" : `Bulk Manage (${alerts.length})`}
                </Button>
              )}
            </div>

            <DialogDescription className="mt-2 text-xs text-muted-foreground">
              {isBulkView
                ? "Manage and postpone multiple pending reminders together, or update their planned deadlines."
                : "This task has been pending for over 2 hours without completion. Choose an action below."}
            </DialogDescription>
          </DialogHeader>

          {/* ========================================================== */}
          {/* BULK VIEW (List / Table with Checkboxes)                  */}
          {/* ========================================================== */}
          {isBulkView ? (
            <div className="my-3 space-y-3">
              {/* Bulk Header Controls */}
              <div className="flex items-center justify-between bg-muted/50 p-2.5 rounded-lg border border-border text-xs">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all"
                    checked={selectedTaskIds.size === alerts.length && alerts.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                  <Label htmlFor="select-all" className="font-semibold cursor-pointer text-xs">
                    Select All ({selectedTaskIds.size} / {alerts.length} selected)
                  </Label>
                </div>
                {selectedTaskIds.size > 0 && (
                  <Button
                    size="sm"
                    onClick={openBulkPostpone}
                    className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1"
                  >
                    <CalendarClock size={12} />
                    Postpone Selected ({selectedTaskIds.size})
                  </Button>
                )}
              </div>

              {/* Reminder List */}
              <div className="max-h-[340px] overflow-y-auto space-y-2 pr-1">
                {alerts.map((item) => {
                  const isChecked = selectedTaskIds.has(item.taskId);
                  return (
                    <div
                      key={item.taskId}
                      className={`flex items-start gap-3 p-3 rounded-lg border text-xs transition-colors ${
                        isChecked
                          ? "border-amber-500/50 bg-amber-500/5 dark:bg-amber-500/10"
                          : "border-border bg-card hover:bg-muted/30"
                      }`}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleSelectTask(item.taskId)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-foreground truncate">{item.taskTitle}</p>
                          <Badge
                            variant="secondary"
                            className="text-[10px] shrink-0 font-medium"
                          >
                            {item.pendingHours}h pending
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground mt-1 text-[11px]">
                          <span className="flex items-center gap-1">
                            <User size={11} className="text-primary" /> {item.clientName}
                          </span>
                          <span className="flex items-center gap-1">
                            <UserCheck size={11} className="text-emerald-600" /> {item.assignedStaff}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar size={11} className="text-amber-600" />{" "}
                            {formatDeadlineText(item.deadline)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openSinglePostpone(item)}
                          className="h-7 px-2 text-[11px] text-amber-600 hover:text-amber-700"
                          title="Postpone this reminder"
                        >
                          <Clock size={12} className="mr-1" />
                          Postpone
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeadlineModal(item)}
                          className="h-7 px-2 text-[11px] text-blue-600 hover:text-blue-700"
                          title="Change planned date / deadline"
                        >
                          <CalendarPlus size={12} className="mr-1" />
                          Date
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ======================================================== */
            /* SINGLE CARD VIEW                                         */
            /* ======================================================== */
            currentAlert && (
              <>
                <div className="my-3 space-y-2.5 rounded-xl border border-border/80 bg-muted/40 p-3.5 text-xs">
                  {/* Task Name */}
                  <div className="flex items-start justify-between gap-2 border-b border-border/50 pb-2">
                    <span className="text-muted-foreground font-medium shrink-0">Task Name:</span>
                    <span className="font-semibold text-foreground text-right">
                      {currentAlert.taskTitle}
                    </span>
                  </div>

                  {/* Client Name */}
                  <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
                    <span className="text-muted-foreground font-medium flex items-center gap-1.5 shrink-0">
                      <User size={13} className="text-primary" /> Client Name:
                    </span>
                    <span className="font-semibold text-foreground text-right">
                      {currentAlert.clientName}
                    </span>
                  </div>

                  {/* Assigned Staff */}
                  <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
                    <span className="text-muted-foreground font-medium flex items-center gap-1.5 shrink-0">
                      <UserCheck size={13} className="text-emerald-600" /> Assigned To:
                    </span>
                    <span className="font-semibold text-foreground text-right">
                      {currentAlert.assignedStaff}
                    </span>
                  </div>

                  {/* Deadline with Quick Change Option */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground font-medium flex items-center gap-1.5 shrink-0">
                      <Calendar size={13} className="text-amber-600" /> Planned Deadline:
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-right">{formatDeadlineText(currentAlert.deadline)}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeadlineModal(currentAlert)}
                        className="h-6 px-1.5 text-[11px] text-blue-600 hover:text-blue-700 hover:bg-blue-500/10"
                        title="Change planned date / deadline"
                      >
                        Change
                      </Button>
                    </div>
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
              </>
            )
          )}

          {/* ========================================================== */}
          {/* DIALOG FOOTER & ACTION BUTTONS                            */}
          {/* ========================================================== */}
          <DialogFooter className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-between">
            {/* Primary Reminder Controls */}
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              {/* Postpone Action (Dedicated Dialog) */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (isBulkView) {
                    openBulkPostpone();
                  } else if (currentAlert) {
                    openSinglePostpone(currentAlert);
                  }
                }}
                disabled={Boolean(actionPending)}
                className="text-xs border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
                title="Postpone reminder until a specific future date"
              >
                <CalendarClock size={13} className="mr-1 text-amber-500" />
                {isBulkView ? "Postpone Selected" : "Postpone Until..."}
              </Button>

              {/* Snooze 2h (Short-term 2h deferral preserved) */}
              {!isBulkView && (
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
                    <Clock size={12} className="mr-1 text-muted-foreground" />
                  )}
                  Snooze 2h
                </Button>
              )}

              {/* Open Task */}
              {!isBulkView && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenTask}
                  disabled={Boolean(actionPending)}
                  className="text-xs"
                >
                  <ExternalLink size={12} className="mr-1" />
                  Open
                </Button>
              )}
            </div>

            {/* Dismiss & Completion */}
            <div className="flex gap-2 w-full sm:w-auto">
              {!isBulkView && (
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
              )}

              {!isBulkView && (
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
              )}

              {isBulkView && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsBulkView(false)}
                  className="text-xs ml-auto"
                >
                  Close Bulk View
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================== */}
      {/* POSTPONE REMINDER MODAL (Quick presets + Custom date/time)     */}
      {/* ============================================================== */}
      {postponeModalTarget && (
        <Dialog open={Boolean(postponeModalTarget)} onOpenChange={() => setPostponeModalTarget(null)}>
          <DialogContent className="max-w-md bg-card p-6 shadow-2xl border-amber-500/50 animate-in zoom-in-95">
            <DialogHeader>
              <div className="flex items-center gap-2.5">
                <span className="grid size-10 place-items-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <CalendarClock size={20} />
                </span>
                <div>
                  <DialogTitle className="text-base font-semibold">
                    Postpone Reminder
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    {postponeModalTarget.taskIds.length === 1
                      ? `"${postponeModalTarget.taskTitles[0]}"`
                      : `${postponeModalTarget.taskIds.length} reminders selected`}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {/* Explanatory Notice */}
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2.5 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
              <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Notice:</strong> Postponing temporarily pauses 2-hour repeating alerts until the selected date and time. It does <em>not</em> alter the task's deadline or status.
              </div>
            </div>

            {/* Quick Preset Buttons */}
            <div className="space-y-3">
              <Label className="text-xs font-semibold">Quick Choices</Label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Button
                  type="button"
                  variant={postponePreset === "later_today" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPostponePreset("later_today")}
                  className="justify-start text-xs h-9"
                >
                  <Clock size={13} className="mr-2 text-amber-500" />
                  Later Today (+4h)
                </Button>
                <Button
                  type="button"
                  variant={postponePreset === "tomorrow" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPostponePreset("tomorrow")}
                  className="justify-start text-xs h-9"
                >
                  <CalendarDays size={13} className="mr-2 text-emerald-500" />
                  Tomorrow (10 AM)
                </Button>
                <Button
                  type="button"
                  variant={postponePreset === "next_week" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPostponePreset("next_week")}
                  className="justify-start text-xs h-9"
                >
                  <Calendar size={13} className="mr-2 text-blue-500" />
                  Next Week (7 days)
                </Button>
                <Button
                  type="button"
                  variant={postponePreset === "custom" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPostponePreset("custom")}
                  className="justify-start text-xs h-9"
                >
                  <CalendarPlus size={13} className="mr-2 text-purple-500" />
                  Custom Date & Time
                </Button>
              </div>

              {/* Custom Date & Time Picker */}
              {postponePreset === "custom" && (
                <div className="space-y-1.5 pt-1">
                  <Label htmlFor="custom-postpone-input" className="text-xs">
                    Select Future Date & Time (any future date allowed)
                  </Label>
                  <Input
                    id="custom-postpone-input"
                    type="datetime-local"
                    value={customPostponeDate}
                    min={toDatetimeLocal(new Date())}
                    onChange={(e) => setCustomPostponeDate(e.target.value)}
                    className="text-xs"
                  />
                </div>
              )}

              {/* Optional Reason */}
              <div className="space-y-1.5 pt-1">
                <Label htmlFor="postpone-reason" className="text-xs">
                  Reason for Postponing (Optional)
                </Label>
                <Input
                  id="postpone-reason"
                  placeholder="e.g. Client visiting next week, awaiting revenue records..."
                  value={postponeReason}
                  onChange={(e) => setPostponeReason(e.target.value)}
                  maxLength={500}
                  className="text-xs"
                />
              </div>

              {/* Target Preview Confirmation */}
              <div className="p-2.5 rounded-lg bg-muted/60 border border-border text-xs flex items-center justify-between">
                <span className="text-muted-foreground font-medium">Silent until:</span>
                <span className="font-semibold text-foreground">
                  {formatSafeDateTime(getPostponeTargetDatePreview())}
                </span>
              </div>
            </div>

            <DialogFooter className="mt-2 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPostponeModalTarget(null)}
                disabled={Boolean(actionPending)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmPostpone}
                disabled={Boolean(actionPending)}
                className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold"
              >
                {actionPending === "postpone" ? (
                  <Loader2 size={13} className="mr-1.5 animate-spin" />
                ) : (
                  <CheckCircle2 size={13} className="mr-1.5" />
                )}
                Confirm Postponement
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ============================================================== */}
      {/* CHANGE PLANNED DATE / DEADLINE MODAL                           */}
      {/* ============================================================== */}
      {deadlineModalTarget && (
        <Dialog open={Boolean(deadlineModalTarget)} onOpenChange={() => setDeadlineModalTarget(null)}>
          <DialogContent className="max-w-md bg-card p-6 shadow-2xl border-blue-500/50 animate-in zoom-in-95">
            <DialogHeader>
              <div className="flex items-center gap-2.5">
                <span className="grid size-10 place-items-center rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400">
                  <Calendar size={20} />
                </span>
                <div>
                  <DialogTitle className="text-base font-semibold">
                    Change Planned Date / Deadline
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    "{deadlineModalTarget.taskTitle}"
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {/* Distinction Notice */}
            <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-2.5 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2">
              <HelpCircle size={15} className="text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong>Contractual Schedule:</strong> This modifies the underlying planned deadline of the task in the database and syncs with the firm calendar. This is distinct from postponing notification alerts.
              </div>
            </div>

            <div className="space-y-3">
              {/* Current Deadline Display */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/60 border border-border text-xs">
                <span className="text-muted-foreground font-medium">Current Planned Date:</span>
                <span className="font-semibold text-foreground">
                  {formatDeadlineText(deadlineModalTarget.currentDeadline)}
                </span>
              </div>

              {/* New Deadline Input */}
              <div className="space-y-1.5">
                <Label htmlFor="new-deadline-input" className="text-xs font-semibold">
                  New Planned Deadline
                </Label>
                <Input
                  id="new-deadline-input"
                  type="datetime-local"
                  value={newDeadlineInput}
                  onChange={(e) => setNewDeadlineInput(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            <DialogFooter className="mt-2 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeadlineModalTarget(null)}
                disabled={Boolean(actionPending)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmDeadlineChange}
                disabled={Boolean(actionPending)}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                {actionPending === "deadline" ? (
                  <Loader2 size={13} className="mr-1.5 animate-spin" />
                ) : (
                  <CheckCircle2 size={13} className="mr-1.5" />
                )}
                Update Planned Date
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Task Detail Dialog when opening full task */}
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
