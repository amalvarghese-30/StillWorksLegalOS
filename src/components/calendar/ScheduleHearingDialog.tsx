import { useState } from "react";
import { Gavel, Loader2, CalendarDays, Clock, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useCreateEvent, type CreateEventPayload } from "@/services/calendar";
import { useCases } from "@/services/cases";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ScheduleHearingDialogProps {
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const EVENT_TYPES: { value: string; label: string }[] = [
  { value: "hearing", label: "Hearing" },
  { value: "call_reminder", label: "Call reminder" },
  { value: "task", label: "Task" },
  { value: "firm_event", label: "Firm event" },
  { value: "leave", label: "Leave" },
  { value: "personal", label: "Personal" },
];

export function ScheduleHearingDialog({ open, onClose }: ScheduleHearingDialogProps) {
  const createEvent = useCreateEvent();

  const { data: casesData } = useCases({ page: "1", limit: "50" });
  const cases = casesData?.cases ?? [];

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("hearing");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("10:30");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("11:30");
  const [allDay, setAllDay] = useState(false);
  const [caseId, setCaseId] = useState("");

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate) return;

    const payload: CreateEventPayload = {
      title: title.trim(),
      description,
      type,
      start: allDay ? `${startDate}T00:00:00` : `${startDate}T${startTime}:00`,
      allDay,
    };

    if (!allDay && (endDate || (startDate && startTime))) {
      payload.end = endDate
        ? `${endDate}T${endTime}:00`
        : `${startDate}T${endTime}:00`;
    }

    if (caseId) payload.caseId = caseId;

    createEvent.mutate(payload, {
      onSuccess: () => {
        setTitle("");
        setDescription("");
        setType("hearing");
        setStartDate("");
        setStartTime("10:30");
        setEndDate("");
        setEndTime("11:30");
        setAllDay(false);
        setCaseId("");
        onClose();
      },
    });
  };

  const isPending = createEvent.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule event</DialogTitle>
          <DialogDescription>
            Add a hearing, call reminder, task or firm event to the calendar.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit}>
          {/* ── Event type ── */}
          <div className="space-y-2">
            <Label className="text-helper">Event type</Label>
            <div className="flex flex-wrap gap-2">
              {EVENT_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={`rounded-pill px-3 py-1.5 text-caption font-medium transition-colors ${type === t.value
                    ? "gradient-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:text-foreground"
                    }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Title ── */}
          <div className="space-y-1.5">
            <Label htmlFor="event-title" className="text-helper">Title *</Label>
            <Input
              id="event-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Bail hearing – State v. Sharma"
              className="h-11 rounded-md"
            />
          </div>

          {/* ── Description ── */}
          <div className="space-y-1.5">
            <Label htmlFor="event-desc" className="text-helper">Description</Label>
            <Input
              id="event-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief notes on what this event covers"
              className="h-11 rounded-md"
            />
          </div>

          {/* ── Date / Time ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-helper">Date & time</Label>
              <label className="flex items-center gap-2 text-caption text-muted-foreground cursor-pointer">
                <Switch checked={allDay} onCheckedChange={setAllDay} />
                All day
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="event-start-date" className="text-caption text-muted-foreground">
                  <CalendarDays size={13} className="inline mr-1" />
                  Start date *
                </Label>
                <Input
                  id="event-start-date"
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (!endDate) setEndDate(e.target.value);
                  }}
                  className="h-11 rounded-md"
                />
              </div>
              {!allDay && (
                <div className="space-y-1.5">
                  <Label htmlFor="event-start-time" className="text-caption text-muted-foreground">
                    <Clock size={13} className="inline mr-1" />
                    Start time
                  </Label>
                  <Input
                    id="event-start-time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="h-11 rounded-md"
                  />
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="event-end-date" className="text-caption text-muted-foreground">
                  <CalendarDays size={13} className="inline mr-1" />
                  End date
                </Label>
                <Input
                  id="event-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-11 rounded-md"
                />
              </div>
              {!allDay && (
                <div className="space-y-1.5">
                  <Label htmlFor="event-end-time" className="text-caption text-muted-foreground">
                    <Clock size={13} className="inline mr-1" />
                    End time
                  </Label>
                  <Input
                    id="event-end-time"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="h-11 rounded-md"
                  />
                </div>
              )}
            </div>
          </div>

          {/* ── Linked case ── */}
          <div className="space-y-1.5">
            <Label htmlFor="event-case" className="text-helper">Linked case</Label>
            <select
              id="event-case"
              value={caseId}
              onChange={(e) => setCaseId(e.target.value)}
              className="h-11 w-full rounded-md border border-border bg-background px-3 text-helper text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">None</option>
              {cases.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.number} · {c.title}
                </option>
              ))}
            </select>
          </div>

          {/* ── Actions ── */}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !title.trim() || !startDate}
              className="gradient-primary rounded-md text-primary-foreground shadow-soft"
            >
              {isPending ? <Loader2 size={17} className="animate-spin" /> : <Gavel size={17} strokeWidth={2} />}
              {isPending ? "Scheduling…" : "Schedule event"}
            </Button>
          </DialogFooter>

          {createEvent.isError && (
            <p className="text-caption text-destructive">Failed to schedule event. Please try again.</p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}