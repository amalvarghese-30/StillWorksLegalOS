import { useEffect, useState, useRef, useCallback } from "react";
import { PhoneCall, BellRing, Clock, X, Check, Copy, PhoneForwarded } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTasks, useUpdateTask, type TaskRecord } from "@/services/tasks";
import { useCalendarEvents, type CalendarEvent } from "@/services/calendar";
import {
  useDueReminders,
  useSnoozeReminder,
  useCompleteReminder,
  useDismissReminder,
} from "@/services/reminders";
import { useSocketEvent } from "@/lib/socket";
import { toast } from "sonner";

interface ActiveReminder {
  id: string;
  source: "task" | "event";
  title: string;
  clientName: string;
  phone?: string;
  notes?: string;
  dueTime: Date;
  taskId?: string;
}

/** Synthesize a pleasant, crisp attention-grabbing phone chime using Web Audio API */
function playReminderBeep() {
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
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };

    // Sequence: two alert chimes (880Hz A5 -> 1174Hz D6 -> 1318Hz E6)
    playTone(880, 0, 0.18);
    playTone(1174, 0.18, 0.18);
    playTone(1318, 0.36, 0.28);

    playTone(880, 0.8, 0.18);
    playTone(1174, 0.98, 0.18);
    playTone(1318, 1.16, 0.35);
  } catch (err) {
    console.warn("Could not play audio reminder chime:", err);
  }
}

export function CallReminderAlerts() {
  const { data: taskData } = useTasks({ limit: "200" });
  const { data: calendarData } = useCalendarEvents();
  const updateTask = useUpdateTask();

  const [activeAlert, setActiveAlert] = useState<ActiveReminder | null>(null);
  const alertedIdsRef = useRef<Set<string>>(new Set());
  const snoozedUntilRef = useRef<Map<string, number>>(new Map());
  const nextTimerRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Initialize BroadcastChannel for cross-tab synchronization
  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
      return undefined;
    }

    const bc = new BroadcastChannel("legalos_call_reminders");
    channelRef.current = bc;

    bc.onmessage = (event: MessageEvent) => {
      const { type, id, snoozedUntil } = event.data || {};
      if (type === "ALERT_TRIGGERED" && id) {
        alertedIdsRef.current.add(id);
        // If we had this alert open in this tab too, close to avoid duplicate popups
        setActiveAlert((curr) => (curr?.id === id ? null : curr));
      } else if (type === "ALERT_DISMISSED" && id) {
        if (snoozedUntil) snoozedUntilRef.current.set(id, snoozedUntil);
        setActiveAlert((curr) => (curr?.id === id ? null : curr));
      } else if (type === "ALERT_COMPLETED" && id) {
        alertedIdsRef.current.add(id);
        setActiveAlert((curr) => (curr?.id === id ? null : curr));
      }
    };

    return () => {
      bc.close();
    };
  }, []);

  // Ask for browser notification permission once
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const triggerAlert = useCallback((reminder: ActiveReminder) => {
    setActiveAlert(reminder);
    alertedIdsRef.current.add(reminder.id);
    playReminderBeep();

    // Broadcast to other tabs so they don't fire duplicate audio or modal
    channelRef.current?.postMessage({ type: "ALERT_TRIGGERED", id: reminder.id });

    // Browser push notification if in background
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(`📞 Call Reminder: ${reminder.clientName || reminder.title}`, {
          body: `Scheduled for ${reminder.dueTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}${
            reminder.phone ? ` • ${reminder.phone}` : ""
          }\n${reminder.notes || ""}`,
          icon: "/favicon.ico",
        });
      } catch {
        /* ignore */
      }
    }
  }, []);

  // Exact-time scheduling and periodic reconciliation
  useEffect(() => {
    const tasks = taskData?.tasks ?? [];
    const events = calendarData?.events ?? [];

    const reconcileAndSchedule = () => {
      const now = Date.now();
      let nextDueReminder: { reminder: ActiveReminder; delayMs: number } | null = null;

      // Clear existing single-shot timer
      if (nextTimerRef.current) {
        clearTimeout(nextTimerRef.current);
        nextTimerRef.current = null;
      }

      // Collect all candidate reminders
      const candidates: ActiveReminder[] = [];

      for (const t of tasks) {
        if (!t.isCall || t.status === "completed" || t.callReminder?.completed || !t.callReminder?.scheduledAt) continue;
        const due = new Date(t.callReminder.scheduledAt).getTime();
        candidates.push({
          id: `task-${t._id}`,
          source: "task",
          title: t.title,
          clientName: t.callReminder.clientName || t.title.replace(/^📞\s*CALL:\s*/i, ""),
          phone: t.callReminder.phone,
          notes: t.callReminder.notes,
          dueTime: new Date(due),
          taskId: t._id,
        });
      }

      for (const ev of events) {
        if (ev.type !== "call_reminder" || !ev.start) continue;
        const due = new Date(ev.start).getTime();
        candidates.push({
          id: `event-${ev._id}`,
          source: "event",
          title: ev.title,
          clientName: ev.clientName || ev.title,
          notes: ev.description,
          dueTime: new Date(due),
        });
      }

      for (const cand of candidates) {
        const dueMs = cand.dueTime.getTime();
        const snoozedUntil = snoozedUntilRef.current.get(cand.id);

        if (snoozedUntil && now < snoozedUntil) continue;

        // EXACT TIMING: Trigger only once scheduled time has arrived (scheduledAt <= now)
        // and within 5 minutes past (300,000ms grace window)
        if (now >= dueMs && now <= dueMs + 300_000) {
          if (!alertedIdsRef.current.has(cand.id) || (snoozedUntil && now >= snoozedUntil)) {
            triggerAlert(cand);
            return;
          }
        } else if (dueMs > now) {
          // Future reminder: calculate delay to exact millisecond
          const delayMs = dueMs - now;
          if (delayMs <= 24 * 60 * 60 * 1000) { // within 24 hours
            if (!nextDueReminder || delayMs < nextDueReminder.delayMs) {
              nextDueReminder = { reminder: cand, delayMs };
            }
          }
        }
      }

      // Schedule exact setTimeout for the next closest reminder
      if (nextDueReminder) {
        nextTimerRef.current = setTimeout(() => {
          triggerAlert(nextDueReminder!.reminder);
        }, nextDueReminder.delayMs);
      }
    };

    reconcileAndSchedule();
    // 20-second heartbeat reconciliation for tab wake/sleep
    const intervalTimer = setInterval(reconcileAndSchedule, 20_000);

    return () => {
      clearInterval(intervalTimer);
      if (nextTimerRef.current) {
        clearTimeout(nextTimerRef.current);
      }
    };
  }, [taskData, calendarData, triggerAlert]);

  const dueRemindersQuery = useDueReminders();
  const snoozeMutation = useSnoozeReminder();
  const completeMutation = useCompleteReminder();
  const dismissMutation = useDismissReminder();

  // Socket.IO real-time listener for reminder triggers from server scheduler
  useSocketEvent("reminder:due", (payload: any) => {
    if (!payload || !payload.id) return;
    const reminderId = String(payload.id);
    if (alertedIdsRef.current.has(reminderId)) return;

    const cand: ActiveReminder = {
      id: reminderId,
      source: payload.sourceType === "task" ? "task" : "event",
      title: `📞 CALL: ${payload.clientName || "Call Reminder"}`,
      clientName: payload.clientName || "Call Reminder",
      phone: payload.phone,
      notes: payload.notes,
      dueTime: payload.scheduledAt ? new Date(payload.scheduledAt) : new Date(),
      taskId: payload.sourceType === "task" ? payload.sourceId : undefined,
    };
    triggerAlert(cand);
  });

  // Reconcile missed/due reminders returned by server API on load
  useEffect(() => {
    const list = dueRemindersQuery.data?.reminders;
    if (!list || list.length === 0) return;
    for (const r of list) {
      const reminderId = String(r._id);
      if (alertedIdsRef.current.has(reminderId)) continue;
      const snoozedUntil = r.snoozedUntil ? new Date(r.snoozedUntil).getTime() : null;
      if (snoozedUntil && Date.now() < snoozedUntil) continue;

      const cand: ActiveReminder = {
        id: reminderId,
        source: r.sourceType === "task" ? "task" : "event",
        title: `📞 CALL: ${r.clientName || "Call Reminder"}`,
        clientName: r.clientName || "Call Reminder",
        phone: r.phone,
        notes: r.notes,
        dueTime: r.scheduledAt ? new Date(r.scheduledAt) : new Date(),
        taskId: r.sourceType === "task" ? r.sourceId : undefined,
      };
      triggerAlert(cand);
      break; // Show one at a time to prevent popup floods
    }
  }, [dueRemindersQuery.data, triggerAlert]);

  // Inline edit state when editing from the popup alert
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editSchedule, setEditSchedule] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const startEdit = () => {
    if (!activeAlert) return;
    setEditName(activeAlert.clientName);
    setEditPhone(activeAlert.phone || "");
    const localIso = new Date(activeAlert.dueTime.getTime() - activeAlert.dueTime.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setEditSchedule(localIso);
    setEditNotes(activeAlert.notes || "");
    setIsEditing(true);
  };

  const applyQuickReschedule = (mins: number) => {
    const target = new Date(Date.now() + mins * 60 * 1000);
    const localIso = new Date(target.getTime() - target.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setEditSchedule(localIso);
  };

  const handleSaveReschedule = () => {
    if (!activeAlert) return;
    if (!editName.trim()) {
      toast.error("Contact name is required");
      return;
    }
    const newScheduledIso = editSchedule ? new Date(editSchedule).toISOString() : new Date().toISOString();

    if (activeAlert.taskId) {
      updateTask.mutate({
        id: activeAlert.taskId,
        data: {
          title: `📞 CALL: ${editName.trim()}`,
          deadline: newScheduledIso,
          callReminder: {
            clientName: editName.trim(),
            phone: editPhone.trim(),
            scheduledAt: newScheduledIso,
            notes: editNotes.trim(),
            completed: false,
          },
        },
      });
      toast.success("Call reminder updated and rescheduled!");
    } else {
      toast.info("Rescheduled");
    }

    channelRef.current?.postMessage({
      type: "ALERT_DISMISSED",
      id: activeAlert.id,
      snoozedUntil: new Date(newScheduledIso).getTime(),
    });
    setIsEditing(false);
    setActiveAlert(null);
  };

  if (!activeAlert) return null;

  const handleSnooze = (minutes = 5) => {
    if (!activeAlert) return;
    const snoozeTime = Date.now() + minutes * 60 * 1000;
    snoozedUntilRef.current.set(activeAlert.id, snoozeTime);

    // Call server snooze if it's a server reminder ID
    if (!activeAlert.id.startsWith("task-") && !activeAlert.id.startsWith("event-")) {
      snoozeMutation.mutate({ id: activeAlert.id, minutes });
    }

    channelRef.current?.postMessage({
      type: "ALERT_DISMISSED",
      id: activeAlert.id,
      snoozedUntil: snoozeTime,
    });
    toast.info(`Call reminder snoozed for ${minutes} minutes`);
    setIsEditing(false);
    setActiveAlert(null);
  };

  const handleMarkDone = () => {
    if (activeAlert.taskId) {
      updateTask.mutate({
        id: activeAlert.taskId,
        data: {
          status: "completed",
          callReminder: {
            clientName: activeAlert.clientName,
            phone: activeAlert.phone || "",
            scheduledAt: activeAlert.dueTime.toISOString(),
            notes: activeAlert.notes || "",
            completed: true,
          },
        },
      });
      toast.success("Call marked as completed!");
    } else {
      toast.success("Call acknowledged");
    }

    // Call server complete mutation
    if (!activeAlert.id.startsWith("task-") && !activeAlert.id.startsWith("event-")) {
      completeMutation.mutate(activeAlert.id);
    }

    channelRef.current?.postMessage({
      type: "ALERT_COMPLETED",
      id: activeAlert.id,
    });
    setIsEditing(false);
    setActiveAlert(null);
  };

  const handleDismiss = () => {
    if (!activeAlert) return;
    if (!activeAlert.id.startsWith("task-") && !activeAlert.id.startsWith("event-")) {
      dismissMutation.mutate(activeAlert.id);
    }
    channelRef.current?.postMessage({
      type: "ALERT_DISMISSED",
      id: activeAlert.id,
    });
    setIsEditing(false);
    setActiveAlert(null);
  };

  const copyPhone = () => {
    if (activeAlert.phone) {
      navigator.clipboard.writeText(activeAlert.phone);
      toast.success("Phone number copied to clipboard");
    }
  };

  return (
    <Dialog
      open={Boolean(activeAlert)}
      onOpenChange={(open) => {
        if (!open) {
          setIsEditing(false);
          setActiveAlert(null);
        }
      }}
    >
      <DialogContent className="max-w-md border-amber-500/40 bg-card p-6 shadow-2xl animate-in zoom-in-95">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 animate-bounce">
              <PhoneCall size={22} strokeWidth={2.5} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-pill bg-amber-500 px-2 py-0.5 text-[10px] font-bold tracking-wider text-black uppercase">
                  CALL DUE NOW
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock size={12} /> {activeAlert.dueTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <DialogTitle className="mt-1 text-lg font-semibold tracking-tight">
                {activeAlert.clientName}
              </DialogTitle>
            </div>
          </div>
          {!isEditing && (
            <DialogDescription className="mt-2 text-sm text-foreground/80">
              {activeAlert.notes || activeAlert.title}
            </DialogDescription>
          )}
        </DialogHeader>

        {isEditing ? (
          /* Inline Edit / Reschedule Form */
          <div className="my-2 space-y-3.5 border-t border-b border-border/70 py-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-foreground">Contact / Client Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-foreground">Phone Number</label>
              <input
                type="text"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-foreground">Reschedule Date & Time</label>
              <input
                type="datetime-local"
                value={editSchedule}
                onChange={(e) => setEditSchedule(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex items-center gap-1.5 pt-0.5">
                <span className="text-[10px] text-muted-foreground">Quick:</span>
                <button
                  type="button"
                  onClick={() => applyQuickReschedule(15)}
                  className="rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] hover:border-primary/50"
                >
                  +15m
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickReschedule(60)}
                  className="rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] hover:border-primary/50"
                >
                  +1h
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickReschedule(180)}
                  className="rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] hover:border-primary/50"
                >
                  +3h
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-foreground">Notes / Agenda</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={2}
                placeholder="What to discuss..."
                className="w-full rounded-md border border-input bg-background p-2 text-xs text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        ) : (
          /* Normal Alert Details */
          activeAlert.phone && (
            <div className="my-2 flex items-center justify-between rounded-lg border border-border bg-muted/40 p-3">
              <div className="flex items-center gap-2.5">
                <span className="text-caption text-muted-foreground font-medium">Phone:</span>
                <span className="font-mono text-sm font-semibold tracking-wide text-foreground">
                  {activeAlert.phone}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Button variant="ghost" size="sm" onClick={copyPhone} title="Copy phone number" className="h-8 px-2">
                  <Copy size={14} />
                </Button>
                <a
                  href={`tel:${activeAlert.phone}`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-transform active:scale-95"
                >
                  <PhoneForwarded size={13} /> Call
                </a>
              </div>
            </div>
          )
        )}

        <DialogFooter className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-between">
          {isEditing ? (
            <div className="flex w-full justify-between items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} className="text-xs">
                Back
              </Button>
              <Button
                size="sm"
                onClick={handleSaveReschedule}
                className="gradient-primary text-primary-foreground text-xs shadow-soft"
              >
                <Check size={14} className="mr-1" /> Save & Reschedule
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <Button variant="outline" size="sm" onClick={() => handleSnooze(5)} className="text-xs">
                  Snooze 5m
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleSnooze(15)} className="text-xs">
                  15m
                </Button>
                <Button variant="outline" size="sm" onClick={startEdit} className="text-xs">
                  Edit / Reschedule
                </Button>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button variant="ghost" size="sm" onClick={handleDismiss} className="flex-1 sm:flex-none text-xs">
                  Dismiss
                </Button>
                <Button
                  size="sm"
                  onClick={handleMarkDone}
                  className="flex-1 sm:flex-none gradient-primary text-primary-foreground text-xs shadow-soft"
                >
                  <Check size={14} className="mr-1" /> Done
                </Button>
              </div>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
