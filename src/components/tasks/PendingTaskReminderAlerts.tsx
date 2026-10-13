import { useState, useEffect, useRef, useCallback } from "react";
import { Clock, CheckCircle2, ExternalLink, BellRing, User, UserCheck, Calendar, AlertTriangle, ChevronRight, ChevronLeft, X } from "lucide-react";
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
  const [isOpeningTask, setIsOpeningTask] = useState(false);

  const updateTask = useUpdateTask();
  const snoozedUntilRef = useRef<Map<string, number>>(new Map());

  // Load snoozed map from sessionStorage
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("legalos_pending_snoozed");
      if (stored) {
        const parsed = JSON.parse(stored);
        const map = new Map<string, number>();
        const now = Date.now();
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === "number" && v > now) {
            map.set(k, v);
          }
        }
        snoozedUntilRef.current = map;
      }
    } catch {}
  }, []);

  const saveSnoozed = useCallback(() => {
    try {
      const obj: Record<string, number> = {};
      const now = Date.now();
      for (const [k, v] of snoozedUntilRef.current.entries()) {
        if (v > now) obj[k] = v;
      }
      sessionStorage.setItem("legalos_pending_snoozed", JSON.stringify(obj));
    } catch {}
  }, []);

  // Fetch pending reminders from server
  const fetchPendingReminders = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get<{ pendingReminders: PendingReminderItem[] }>("/api/tasks/pending-reminders");
      const list = res.data?.pendingReminders || [];
      const now = Date.now();

      // Filter out snoozed tasks
      const active = list.filter((item) => {
        const snoozeTime = snoozedUntilRef.current.get(item.taskId);
        if (snoozeTime && snoozeTime > now) return false;
        // User access isolation: employees only see their assigned tasks
        if (!isAdmin && item.assignedToId && item.assignedToId !== currentUserId) {
          return false;
        }
        return true;
      });

      if (active.length > 0) {
        setAlerts((prev) => {
          // Merge unique items by taskId
          const existingIds = new Set(prev.map((a) => a.taskId));
          const newItems = active.filter((a) => !existingIds.has(a.taskId));
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

    // Check snooze
    const now = Date.now();
    const snoozeTime = snoozedUntilRef.current.get(item.taskId);
    if (snoozeTime && snoozeTime > now) return;

    // Check user access
    if (!isAdmin && item.assignedToId && item.assignedToId !== currentUserId) {
      return;
    }

    setAlerts((prev) => {
      const exists = prev.some((p) => p.taskId === item.taskId);
      if (exists) return prev;
      playPendingAlertChime();
      notifications.show({
        id: `pending-${item.taskId}`,
        title: `⏳ Pending Work: ${item.taskTitle}`,
        body: `Client: ${item.clientName} • Assigned: ${item.assignedStaff} • Pending: ${item.pendingHours}h`,
      });
      return [...prev, item];
    });
  });

  const currentAlert = alerts[currentIndex] || null;

  const handleSnooze = (hours = 2) => {
    if (!currentAlert) return;
    const snoozeUntil = Date.now() + hours * 60 * 60 * 1000;
    snoozedUntilRef.current.set(currentAlert.taskId, snoozeUntil);
    saveSnoozed();

    toast.info(`Reminder for "${currentAlert.taskTitle}" snoozed for ${hours} hours.`);
    removeCurrentAlert();
  };

  const handleDismiss = () => {
    if (!currentAlert) return;
    removeCurrentAlert();
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
    if (!currentAlert) return;
    try {
      await updateTask.mutateAsync({
        id: currentAlert.taskId,
        data: {
          status: "completed",
        },
      });
      toast.success(`Task "${currentAlert.taskTitle}" marked as completed!`);
      removeCurrentAlert();
    } catch (err: any) {
      toast.error(err?.message || "Failed to mark task as completed.");
    }
  };

  const handleOpenTask = async () => {
    if (!currentAlert) return;
    setIsOpeningTask(true);
    try {
      const res = await api.get<{ task: TaskRecord }>(`/api/tasks/${currentAlert.taskId}`);
      if (res.data?.task) {
        setSelectedTaskForModal(res.data.task);
      }
    } catch {
      toast.error("Could not load task details");
    } finally {
      setIsOpeningTask(false);
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

  return (
    <>
      <Dialog open={Boolean(currentAlert)} onOpenChange={(open) => !open && handleDismiss()}>
        <DialogContent className="max-w-md border-amber-500/50 bg-card p-6 shadow-2xl animate-in zoom-in-95">
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
                <UserCheck size={13} className="text-emerald-600" /> Assigned Staff:
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
                className="text-xs"
                title="Snooze reminder for 2 hours"
              >
                <Clock size={12} className="mr-1" /> Snooze 2h
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenTask}
                disabled={isOpeningTask}
                className="text-xs"
              >
                <ExternalLink size={12} className="mr-1" /> Open Task
              </Button>
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="ghost" size="sm" onClick={handleDismiss} className="text-xs flex-1 sm:flex-none">
                Dismiss
              </Button>
              <Button
                size="sm"
                onClick={handleMarkDone}
                disabled={updateTask.isPending}
                className="gradient-primary text-primary-foreground text-xs shadow-soft flex-1 sm:flex-none font-semibold"
              >
                <CheckCircle2 size={13} className="mr-1 text-emerald-400" /> Mark Done
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
