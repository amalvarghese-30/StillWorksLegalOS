import { useEffect, useState, useRef, useCallback } from "react";
import { PhoneCall, BellRing, Clock, X, Check, Copy, PhoneForwarded } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTasks, useUpdateTask, type TaskRecord } from "@/services/tasks";
import { useCalendarEvents, type CalendarEvent } from "@/services/calendar";
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
  const { data: taskData } = useTasks();
  const { data: calendarData } = useCalendarEvents();
  const updateTask = useUpdateTask();

  const [activeAlert, setActiveAlert] = useState<ActiveReminder | null>(null);
  const alertedIdsRef = useRef<Set<string>>(new Set());
  const snoozedUntilRef = useRef<Map<string, number>>(new Map());

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

  // Poll for upcoming or due call reminders every 10 seconds
  useEffect(() => {
    const checkReminders = () => {
      const now = Date.now();

      // 1. Check Tasks with call reminders
      const tasks = taskData?.tasks ?? [];
      for (const t of tasks) {
        if (!t.isCall || t.status === "completed" || !t.callReminder?.scheduledAt) continue;
        const dueTime = new Date(t.callReminder.scheduledAt).getTime();
        const reminderId = `task-${t._id}`;

        const snoozedUntil = snoozedUntilRef.current.get(reminderId);
        if (snoozedUntil && now < snoozedUntil) continue;

        // Due if within 2 minutes past or up to 30 seconds ahead
        if (now >= dueTime - 30_000 && now <= dueTime + 180_000) {
          if (!alertedIdsRef.current.has(reminderId) || (snoozedUntil && now >= snoozedUntil)) {
            triggerAlert({
              id: reminderId,
              source: "task",
              title: t.title,
              clientName: t.callReminder.clientName || t.title.replace(/^📞\s*CALL:\s*/i, ""),
              phone: t.callReminder.phone,
              notes: t.callReminder.notes,
              dueTime: new Date(dueTime),
              taskId: t._id,
            });
            return;
          }
        }
      }

      // 2. Check Calendar Events of type "call_reminder"
      const events = calendarData?.events ?? [];
      for (const ev of events) {
        if (ev.type !== "call_reminder" || !ev.start) continue;
        const dueTime = new Date(ev.start).getTime();
        const reminderId = `event-${ev._id}`;

        const snoozedUntil = snoozedUntilRef.current.get(reminderId);
        if (snoozedUntil && now < snoozedUntil) continue;

        if (now >= dueTime - 30_000 && now <= dueTime + 180_000) {
          if (!alertedIdsRef.current.has(reminderId) || (snoozedUntil && now >= snoozedUntil)) {
            triggerAlert({
              id: reminderId,
              source: "event",
              title: ev.title,
              clientName: ev.clientName || ev.title,
              notes: ev.description,
              dueTime: new Date(dueTime),
            });
            return;
          }
        }
      }
    };

    checkReminders();
    const timer = setInterval(checkReminders, 10_000);
    return () => clearInterval(timer);
  }, [taskData, calendarData, triggerAlert]);

  if (!activeAlert) return null;

  const handleSnooze = () => {
    if (!activeAlert) return;
    const snoozeTime = Date.now() + 5 * 60 * 1000; // 5 minutes
    snoozedUntilRef.current.set(activeAlert.id, snoozeTime);
    toast.info("Call reminder snoozed for 5 minutes");
    setActiveAlert(null);
  };

  const handleMarkDone = () => {
    if (activeAlert.taskId) {
      updateTask.mutate({
        id: activeAlert.taskId,
        data: { status: "completed" },
      });
      toast.success("Call marked as completed!");
    } else {
      toast.success("Call acknowledged");
    }
    setActiveAlert(null);
  };

  const copyPhone = () => {
    if (activeAlert.phone) {
      navigator.clipboard.writeText(activeAlert.phone);
      toast.success("Phone number copied to clipboard");
    }
  };

  return (
    <Dialog open={Boolean(activeAlert)} onOpenChange={(open) => !open && setActiveAlert(null)}>
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
          <DialogDescription className="mt-2 text-sm text-foreground/80">
            {activeAlert.notes || activeAlert.title}
          </DialogDescription>
        </DialogHeader>

        {activeAlert.phone && (
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
        )}

        <DialogFooter className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button variant="outline" size="sm" onClick={handleSnooze} className="w-full sm:w-auto text-xs">
            Snooze 5 min
          </Button>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="ghost" size="sm" onClick={() => setActiveAlert(null)} className="flex-1 sm:flex-none text-xs">
              Dismiss
            </Button>
            <Button
              size="sm"
              onClick={handleMarkDone}
              className="flex-1 sm:flex-none gradient-primary text-primary-foreground text-xs shadow-soft"
            >
              <Check size={14} /> Done
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
