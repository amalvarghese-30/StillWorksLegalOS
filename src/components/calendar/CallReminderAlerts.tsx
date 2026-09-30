import { useEffect, useState, useRef, useCallback } from "react";
import { PhoneCall, Clock, Check, Copy, PhoneForwarded } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTasks, useUpdateTask, taskKeys } from "@/services/tasks";
import { useCalendarEvents, useUpdateEvent, calendarKeys } from "@/services/calendar";
import {
  useDueReminders,
  useSnoozeReminder,
  useCompleteReminder,
  useDismissReminder,
  useUpdateReminder,
  reminderKeys,
} from "@/services/reminders";
import { useSocketEvent } from "@/lib/socket";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { notifications, externalLinks } from "@/platform";

interface ActiveReminder {
  id: string;
  source: "task" | "event" | "reminder";
  title: string;
  clientName: string;
  phone?: string | undefined;
  notes?: string | undefined;
  dueTime: Date;
  taskId?: string | undefined;
  eventId?: string | undefined;
  reminderId?: string | undefined;
  deliveryId?: string | undefined;
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

const TASK_QUERY_FILTERS = { limit: "200" };
const CALENDAR_QUERY_FILTERS = {};

export function CallReminderAlerts() {
  const queryClient = useQueryClient();
  const { data: taskData } = useTasks(TASK_QUERY_FILTERS);
  const { data: calendarData } = useCalendarEvents(CALENDAR_QUERY_FILTERS);
  const updateTask = useUpdateTask();
  const updateEvent = useUpdateEvent();
  const updateReminder = useUpdateReminder();

  const dueRemindersQuery = useDueReminders();
  const snoozeMutation = useSnoozeReminder();
  const completeMutation = useCompleteReminder();
  const dismissMutation = useDismissReminder();

  const [activeAlert, setActiveAlert] = useState<ActiveReminder | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editSchedule, setEditSchedule] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const alertedIdsRef = useRef<Set<string>>(new Set());
  const snoozedUntilRef = useRef<Map<string, number>>(new Map());
  const nextTimerRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Initialize BroadcastChannel for cross-tab and cross-window deduplication
  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
      return undefined;
    }

    const bc = new BroadcastChannel("legalos_call_reminders");
    channelRef.current = bc;

    bc.onmessage = (event: MessageEvent) => {
      const { type, id, key, deliveryId, snoozedUntil } = event.data || {};
      if (type === "ALERT_TRIGGERED") {
        if (id) alertedIdsRef.current.add(id);
        if (key) alertedIdsRef.current.add(key);
        if (deliveryId) alertedIdsRef.current.add(deliveryId);
        // If we had this alert open in this tab too, close to avoid duplicate popups
        setActiveAlert((curr) => {
          if (!curr) return null;
          const currKey = `${curr.source}:${curr.taskId || curr.eventId || curr.reminderId || curr.id}`;
          if (curr.id === id || currKey === key) return null;
          return curr;
        });
      } else if (type === "ALERT_DISMISSED") {
        if (id && snoozedUntil) snoozedUntilRef.current.set(id, snoozedUntil);
        if (key && snoozedUntil) snoozedUntilRef.current.set(key, snoozedUntil);
        setActiveAlert((curr) => {
          if (!curr) return null;
          const currKey = `${curr.source}:${curr.taskId || curr.eventId || curr.reminderId || curr.id}`;
          if (curr.id === id || currKey === key) return null;
          return curr;
        });
      } else if (type === "ALERT_COMPLETED") {
        if (id) alertedIdsRef.current.add(id);
        if (key) alertedIdsRef.current.add(key);
        setActiveAlert((curr) => {
          if (!curr) return null;
          const currKey = `${curr.source}:${curr.taskId || curr.eventId || curr.reminderId || curr.id}`;
          if (curr.id === id || currKey === key) return null;
          return curr;
        });
      }
    };

    return () => {
      bc.close();
    };
  }, []);

  // Request platform notification permission on mount
  useEffect(() => {
    notifications.requestPermission().catch(() => {});
  }, []);

  const triggerAlert = useCallback((reminder: ActiveReminder, deliveryId?: string) => {
    const reminderId = reminder.reminderId || reminder.id;
    const sourceKey = `${reminder.source}:${reminder.taskId || reminder.eventId || reminder.reminderId || reminder.id}`;

    if (
      alertedIdsRef.current.has(reminder.id) ||
      alertedIdsRef.current.has(reminderId) ||
      alertedIdsRef.current.has(sourceKey)
    ) {
      return;
    }
    if (deliveryId && alertedIdsRef.current.has(deliveryId)) {
      return;
    }

    alertedIdsRef.current.add(reminder.id);
    alertedIdsRef.current.add(reminderId);
    alertedIdsRef.current.add(sourceKey);
    if (deliveryId) alertedIdsRef.current.add(deliveryId);

    setActiveAlert((prev) => {
      if (prev) return prev;
      return reminder;
    });

    playReminderBeep();

    // Broadcast to other tabs so they don't fire duplicate audio or modal
    channelRef.current?.postMessage({
      type: "ALERT_TRIGGERED",
      id: reminder.id,
      key: sourceKey,
      deliveryId,
    });

    // Show platform-appropriate notification (Browser push or Windows native toast)
    notifications.show({
      id: reminder.id,
      title: `📞 Call Reminder: ${reminder.clientName || reminder.title}`,
      body: `Scheduled for ${reminder.dueTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}${
        reminder.phone ? ` • ${reminder.phone}` : ""
      }\n${reminder.notes || ""}`,
      sound: false, // We already played playReminderBeep()
    });
  }, []);

  // Client reconciliation fallback for scheduled dates
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
          clientName: ev.clientName || ev.title.replace(/^📞\s*(CALL:\s*)?/i, ""),
          notes: ev.description,
          dueTime: new Date(due),
          eventId: ev._id,
        });
      }

      for (const cand of candidates) {
        const sourceKey = `${cand.source}:${cand.taskId || cand.eventId || cand.id}`;
        if (alertedIdsRef.current.has(cand.id) || alertedIdsRef.current.has(sourceKey)) {
          continue;
        }

        const dueMs = cand.dueTime.getTime();
        const snoozedUntil = snoozedUntilRef.current.get(cand.id) || snoozedUntilRef.current.get(sourceKey);

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
          if (delayMs <= 24 * 60 * 60 * 1000) {
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

  // Socket.IO real-time listener for reminder triggers from authoritative server scheduler
  useSocketEvent("reminder:due", (payload: any) => {
    if (!payload || !payload.id) return;
    const reminderId = String(payload.id);
    const sourceKey = `${payload.sourceType || "custom"}:${payload.sourceId || reminderId}`;

    if (alertedIdsRef.current.has(reminderId) || alertedIdsRef.current.has(sourceKey)) return;
    if (payload.deliveryId && alertedIdsRef.current.has(payload.deliveryId)) return;

    const cand: ActiveReminder = {
      id: reminderId,
      source: payload.sourceType === "task" ? "task" : payload.sourceType === "event" ? "event" : "reminder",
      title: `📞 CALL: ${payload.clientName || "Call Reminder"}`,
      clientName: payload.clientName || "Call Reminder",
      phone: payload.phone,
      notes: payload.notes,
      dueTime: payload.scheduledAt ? new Date(payload.scheduledAt) : new Date(),
      taskId: payload.sourceType === "task" ? payload.sourceId : undefined,
      eventId: payload.sourceType === "event" ? payload.sourceId : undefined,
      reminderId,
      deliveryId: payload.deliveryId,
    };
    triggerAlert(cand, payload.deliveryId);
  });

  // Reconcile missed/due reminders returned by server API on load / reconnect
  useEffect(() => {
    const list = dueRemindersQuery.data?.reminders;
    if (!list || list.length === 0) return;
    for (const r of list) {
      const reminderId = String(r._id);
      const sourceKey = `${r.sourceType || "custom"}:${r.sourceId || reminderId}`;
      if (alertedIdsRef.current.has(reminderId) || alertedIdsRef.current.has(sourceKey)) continue;
      const snoozedUntil = r.snoozedUntil ? new Date(r.snoozedUntil).getTime() : null;
      if (snoozedUntil && Date.now() < snoozedUntil) continue;

      const cand: ActiveReminder = {
        id: reminderId,
        source: r.sourceType === "task" ? "task" : r.sourceType === "event" ? "event" : "reminder",
        title: `📞 CALL: ${r.clientName || "Call Reminder"}`,
        clientName: r.clientName || "Call Reminder",
        phone: r.phone,
        notes: r.notes,
        dueTime: r.scheduledAt ? new Date(r.scheduledAt) : new Date(),
        taskId: r.sourceType === "task" ? r.sourceId : undefined,
        eventId: r.sourceType === "event" ? r.sourceId : undefined,
        reminderId,
        deliveryId: r.deliveryId,
      };
      triggerAlert(cand, r.deliveryId);
      break; // Show one at a time to prevent popup floods
    }
  }, [dueRemindersQuery.data, triggerAlert]);

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

  const handleSaveReschedule = async () => {
    if (!activeAlert) return;
    const trimmedName = editName.trim();
    if (!trimmedName) {
      toast.error("Contact / Client name is required");
      return;
    }

    if (!editSchedule || !editSchedule.trim()) {
      toast.error("Please select a date and time for the reminder.");
      return;
    }

    const parsedDate = new Date(editSchedule);
    if (isNaN(parsedDate.getTime())) {
      toast.error("Please enter a valid date and time.");
      return;
    }

    const newScheduledIso = parsedDate.toISOString();
    setIsSaving(true);

    try {
      if (activeAlert.taskId) {
        await updateTask.mutateAsync({
          id: activeAlert.taskId,
          data: {
            title: `📞 CALL: ${trimmedName}`,
            deadline: newScheduledIso,
            callReminder: {
              clientName: trimmedName,
              phone: editPhone.trim(), // Optional: empty string is valid and clears
              scheduledAt: newScheduledIso,
              notes: editNotes.trim(), // Optional: empty string is valid and clears
              completed: false,
            },
          },
        });
      } else if (activeAlert.eventId) {
        await updateEvent.mutateAsync({
          id: activeAlert.eventId,
          data: {
            title: `📞 CALL: ${trimmedName}`,
            start: newScheduledIso,
            description: editNotes.trim(),
          },
        });
      } else if (activeAlert.reminderId || (!activeAlert.id.startsWith("task-") && !activeAlert.id.startsWith("event-"))) {
        const remId = activeAlert.reminderId || activeAlert.id;
        await updateReminder.mutateAsync({
          id: remId,
          data: {
            clientName: trimmedName,
            phone: editPhone.trim(),
            notes: editNotes.trim(),
            scheduledAt: newScheduledIso,
          },
        });
      }

      await queryClient.invalidateQueries({ queryKey: reminderKeys.all });
      await queryClient.invalidateQueries({ queryKey: taskKeys.all });
      await queryClient.invalidateQueries({ queryKey: calendarKeys.all });

      const sourceKey = `${activeAlert.source}:${activeAlert.taskId || activeAlert.eventId || activeAlert.reminderId || activeAlert.id}`;
      channelRef.current?.postMessage({
        type: "ALERT_DISMISSED",
        id: activeAlert.id,
        key: sourceKey,
        snoozedUntil: parsedDate.getTime(),
      });

      toast.success("Call reminder updated successfully.");
      setIsEditing(false);
      setActiveAlert(null);
    } catch (err: any) {
      console.error("[CallReminderAlerts] Failed to update reminder:", err);
      toast.error(err?.message || "We couldn't update the reminder. Please try again.");
      // Keeps the dialog open on failure so the user can correct or retry
    } finally {
      setIsSaving(false);
    }
  };

  const handleSnooze = async (minutes = 5) => {
    if (!activeAlert) return;
    const snoozeTime = Date.now() + minutes * 60 * 1000;
    const sourceKey = `${activeAlert.source}:${activeAlert.taskId || activeAlert.eventId || activeAlert.reminderId || activeAlert.id}`;

    snoozedUntilRef.current.set(activeAlert.id, snoozeTime);
    snoozedUntilRef.current.set(sourceKey, snoozeTime);

    // Call server snooze if it's a server reminder
    const remId = activeAlert.reminderId || (!activeAlert.id.startsWith("task-") && !activeAlert.id.startsWith("event-") ? activeAlert.id : null);
    if (remId) {
      try {
        await snoozeMutation.mutateAsync({ id: remId, minutes });
      } catch (err) {
        console.error("[CallReminderAlerts] Server snooze error:", err);
      }
    }

    channelRef.current?.postMessage({
      type: "ALERT_DISMISSED",
      id: activeAlert.id,
      key: sourceKey,
      snoozedUntil: snoozeTime,
    });
    toast.info(`Call reminder snoozed for ${minutes} minutes`);
    setIsEditing(false);
    setActiveAlert(null);
  };

  const handleMarkDone = async () => {
    if (!activeAlert) return;
    const sourceKey = `${activeAlert.source}:${activeAlert.taskId || activeAlert.eventId || activeAlert.reminderId || activeAlert.id}`;

    try {
      if (activeAlert.taskId) {
        await updateTask.mutateAsync({
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

      const remId = activeAlert.reminderId || (!activeAlert.id.startsWith("task-") && !activeAlert.id.startsWith("event-") ? activeAlert.id : null);
      if (remId) {
        await completeMutation.mutateAsync(remId);
      }

      channelRef.current?.postMessage({
        type: "ALERT_COMPLETED",
        id: activeAlert.id,
        key: sourceKey,
      });
      setIsEditing(false);
      setActiveAlert(null);
    } catch (err: any) {
      console.error("[CallReminderAlerts] Failed to mark completed:", err);
      toast.error("Failed to complete call reminder");
    }
  };

  const handleDismiss = async () => {
    if (!activeAlert) return;
    const sourceKey = `${activeAlert.source}:${activeAlert.taskId || activeAlert.eventId || activeAlert.reminderId || activeAlert.id}`;

    const remId = activeAlert.reminderId || (!activeAlert.id.startsWith("task-") && !activeAlert.id.startsWith("event-") ? activeAlert.id : null);
    if (remId) {
      try {
        await dismissMutation.mutateAsync(remId);
      } catch (err) {
        console.error("[CallReminderAlerts] Server dismiss error:", err);
      }
    }

    channelRef.current?.postMessage({
      type: "ALERT_DISMISSED",
      id: activeAlert.id,
      key: sourceKey,
    });
    setIsEditing(false);
    setActiveAlert(null);
  };

  const copyPhone = async () => {
    if (activeAlert?.phone) {
      await externalLinks.dialPhone(activeAlert.phone);
      toast.success("Phone number copied to clipboard");
    }
  };

  if (!activeAlert) return null;

  return (
    <Dialog
      open={Boolean(activeAlert)}
      onOpenChange={(open) => {
        if (!open && !isSaving) {
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
              <label className="text-[11px] font-medium text-foreground">
                Contact / Client Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Client Name"
                disabled={isSaving}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-foreground">
                Phone Number <span className="text-muted-foreground font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="Optional phone number"
                disabled={isSaving}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-foreground">
                Reschedule Date & Time <span className="text-destructive">*</span>
              </label>
              <input
                type="datetime-local"
                value={editSchedule}
                onChange={(e) => setEditSchedule(e.target.value)}
                disabled={isSaving}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              />
              <div className="flex items-center gap-1.5 pt-0.5">
                <span className="text-[10px] text-muted-foreground">Quick:</span>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => applyQuickReschedule(15)}
                  className="rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] hover:border-primary/50 disabled:opacity-50"
                >
                  +15m
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => applyQuickReschedule(60)}
                  className="rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] hover:border-primary/50 disabled:opacity-50"
                >
                  +1h
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => applyQuickReschedule(180)}
                  className="rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] hover:border-primary/50 disabled:opacity-50"
                >
                  +3h
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-foreground">
                Notes / Agenda <span className="text-muted-foreground font-normal">(Optional)</span>
              </label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={2}
                disabled={isSaving}
                placeholder="What to discuss..."
                className="w-full rounded-md border border-input bg-background p-2 text-xs text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
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
              <Button
                variant="ghost"
                size="sm"
                disabled={isSaving}
                onClick={() => setIsEditing(false)}
                className="text-xs"
              >
                Back
              </Button>
              <Button
                size="sm"
                onClick={handleSaveReschedule}
                disabled={isSaving}
                className="gradient-primary text-primary-foreground text-xs shadow-soft"
              >
                {isSaving ? (
                  <>
                    <span className="size-3.5 mr-1.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Check size={14} className="mr-1" /> Save Changes
                  </>
                )}
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
