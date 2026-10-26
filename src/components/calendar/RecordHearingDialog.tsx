import { useState } from "react";
import { Gavel, CalendarDays, Loader2, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRecordHearing, type CalendarEvent } from "@/services/calendar";
import { toast } from "sonner";

interface RecordHearingDialogProps {
  open: boolean;
  onClose: () => void;
  event: CalendarEvent | null;
}

export function RecordHearingDialog({ open, onClose, event }: RecordHearingDialogProps) {
  const recordHearingMutation = useRecordHearing();

  const [status, setStatus] = useState<"held" | "rescheduled" | "cancelled" | "scheduled">("held");
  const [remarks, setRemarks] = useState(event?.remarks || "");
  const [nextDate, setNextDate] = useState("");

  if (!open || !event) return null;

  const currentHearingDate = new Date(event.start);
  const formattedHearingDate = currentHearingDate.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let nextHearingIso: string | null = null;
    if (nextDate) {
      // nextDate is from <input type="datetime-local" />: "YYYY-MM-DDTHH:mm"
      const d = new Date(nextDate);
      if (!Number.isNaN(d.getTime())) {
        nextHearingIso = d.toISOString();
      }
    }

    recordHearingMutation.mutate(
      {
        eventId: event._id,
        data: {
          status,
          remarks: remarks.trim(),
          nextHearingDate: nextHearingIso,
          hearingDate: event.start,
        },
      },
      {
        onSuccess: () => {
          toast.success("Hearing recorded & next date saved successfully");
          onClose();
        },
        onError: (err: Error) => {
          toast.error(err.message || "Failed to record hearing");
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card p-4 sm:p-6 shadow-lift">
        <DialogHeader className="border-b border-border/60 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <Gavel size={18} strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-title font-semibold text-foreground truncate">
                Record Hearing &amp; Add Next Date
              </DialogTitle>
              <DialogDescription className="text-caption text-muted-foreground mt-0.5">
                Record hearing outcome and work done, and schedule the next hearing date.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Case & Hearing Details Summary Card */}
        <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3.5 space-y-2">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Matter
            </p>
            <p className="text-body font-medium text-foreground break-words">{event.title}</p>
          </div>
          <div className="flex items-center gap-2 text-caption text-muted-foreground pt-1 border-t border-border/40">
            <Clock size={13} className="shrink-0 text-primary" />
            <span>
              Current Hearing Date:{" "}
              <strong className="text-foreground">{formattedHearingDate}</strong>
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Outcome / Status */}
          <div className="space-y-1.5">
            <Label htmlFor="hearing-status" className="text-helper font-semibold">
              Hearing Outcome / Status
            </Label>
            <select
              id="hearing-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as "held" | "rescheduled" | "cancelled")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-body shadow-xs focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="held">Hearing Held / Conducted</option>
              <option value="rescheduled">Rescheduled / Adjourned without hearing</option>
              <option value="cancelled">Matter Disposed / Cancelled</option>
            </select>
          </div>

          {/* Remarks / Work Done */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="hearing-remarks" className="text-helper font-semibold">
                Work done / Hearing remarks
              </Label>
              <span className="text-[11px] text-muted-foreground">(Optional)</span>
            </div>
            <Textarea
              id="hearing-remarks"
              rows={3}
              placeholder="e.g. Matter heard; arguments advanced on interim relief; commissioner report requested."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="resize-none"
            />
          </div>

          {/* Next Hearing Date */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="next-hearing-date"
                className="text-helper font-semibold flex items-center gap-1.5"
              >
                <CalendarDays size={14} className="text-primary" />
                Next Hearing Date
              </Label>
              <span className="text-[11px] text-muted-foreground">(Optional)</span>
            </div>
            <Input
              id="next-hearing-date"
              type="datetime-local"
              value={nextDate}
              onChange={(e) => setNextDate(e.target.value)}
              className="w-full"
            />
            <p className="text-[11px] text-muted-foreground">
              If provided, this will create a separate upcoming hearing in the calendar and update
              the case.
            </p>
          </div>

          <DialogFooter className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 border-t border-border/60 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={recordHearingMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="gradient-primary text-primary-foreground gap-1.5"
              disabled={recordHearingMutation.isPending}
            >
              {recordHearingMutation.isPending ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} /> Save Hearing &amp; Next Date
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
