import React from "react";
import { PhoneCall, PhoneMissed, Clock, CheckCircle2, Check, User, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatSafeDateTime } from "@/lib/dates";
import { toast } from "sonner";
import type { TaskRecord } from "@/services/tasks";

interface TaskCallReminderCardProps {
  activeTask: TaskRecord;
  callCompleted: boolean;
  handleToggleCallDone: () => void;
  isPending: boolean;
  onOpenReschedule: () => void;
}

export function TaskCallReminderCard({
  activeTask,
  callCompleted,
  handleToggleCallDone,
  isPending,
  onOpenReschedule,
}: TaskCallReminderCardProps) {
  if (!activeTask.isCall && !activeTask.callReminder) return null;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <PhoneCall size={18} strokeWidth={2} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-foreground">Call Reminder</h4>
              <span
                className={`rounded-pill px-2 py-0.5 text-[10px] font-bold ${
                  callCompleted
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                    : "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                }`}
              >
                {callCompleted ? "Done" : "Pending"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <Clock size={11} />
              {formatSafeDateTime(activeTask.callReminder?.scheduledAt, "No scheduled time")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenReschedule}
            className="h-8 rounded-pill text-xs font-semibold border-amber-500/50 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
          >
            <PhoneMissed size={12} className="mr-1" /> Reschedule Call
          </Button>
          <Button
            type="button"
            variant={callCompleted ? "outline" : "default"}
            size="sm"
            onClick={handleToggleCallDone}
            disabled={isPending}
            className={`h-8 rounded-pill text-xs font-semibold ${
              callCompleted
                ? "border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10"
                : "gradient-primary text-primary-foreground font-bold shadow-soft"
            }`}
          >
            {callCompleted ? (
              <>
                <CheckCircle2 size={13} className="mr-1 text-emerald-600" /> Completed
              </>
            ) : (
              <>
                <Check size={13} className="mr-1" /> Mark Call Done
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <User size={13} />
          <span>
            Contact:{" "}
            <strong className="text-foreground">
              {activeTask.callReminder?.clientName || activeTask.title}
            </strong>
          </span>
        </div>
        {activeTask.callReminder?.phone && (
          <div className="flex items-center justify-between rounded border border-border/60 bg-card px-2.5 py-1">
            <span className="font-mono text-xs font-medium text-foreground">
              {activeTask.callReminder.phone}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(activeTask.callReminder!.phone);
                  toast.success("Phone number copied to clipboard");
                }}
                className="rounded p-1 text-muted-foreground hover:text-foreground"
                title="Copy phone"
              >
                <Copy size={12} />
              </button>
              <a
                href={`tel:${activeTask.callReminder.phone}`}
                className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                Call
              </a>
            </div>
          </div>
        )}
      </div>

      {activeTask.callReminder?.notes && (
        <p className="mt-2.5 rounded border border-border/50 bg-background/60 p-2.5 text-xs text-foreground/90 italic">
          &ldquo;{activeTask.callReminder.notes}&rdquo;
        </p>
      )}
    </div>
  );
}
