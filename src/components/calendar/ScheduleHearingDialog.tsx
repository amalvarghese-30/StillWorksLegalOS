import { useState, useEffect } from "react";
import { Gavel, Loader2, CalendarDays, Clock, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useCreateEvent, useUpdateEvent, type CreateEventPayload, type CalendarEvent } from "@/services/calendar";
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
  initialDate?: string | undefined;
  eventToEdit?: CalendarEvent | null;
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

// ---------------------------------------------------------------------------
// Helpers for Browser-Local Date & Time Conversion
// ---------------------------------------------------------------------------

function formatLocalDate(value?: string | Date | null): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatLocalTime(value?: string | Date | null, fallback = "10:30"): string {
  if (!value) return fallback;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function ScheduleHearingDialog({ open, onClose, initialDate, eventToEdit }: ScheduleHearingDialogProps) {
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();

  const { data: casesData } = useCases({ page: "1", limit: "50" });
  const cases = casesData?.cases ?? [];

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("hearing");
  const [startDate, setStartDate] = useState(initialDate || "");
  const [startTime, setStartTime] = useState("10:30");
  const [endDate, setEndDate] = useState(initialDate || "");
  const [endTime, setEndTime] = useState("11:30");
  const [allDay, setAllDay] = useState(false);
  const [caseId, setCaseId] = useState("");

  useEffect(() => {
    if (eventToEdit) {
      setTitle(eventToEdit.title || "");
      setDescription(eventToEdit.description || "");
      setType(eventToEdit.type || "hearing");
      setStartDate(formatLocalDate(eventToEdit.start));
      setStartTime(eventToEdit.allDay ? "10:30" : formatLocalTime(eventToEdit.start, "10:30"));
      setEndDate(formatLocalDate(eventToEdit.end || eventToEdit.start));
      setEndTime(eventToEdit.allDay ? "11:30" : formatLocalTime(eventToEdit.end, "11:30"));
      setAllDay(Boolean(eventToEdit.allDay));
      setCaseId(eventToEdit.caseId || "");
    } else if (initialDate) {
      setStartDate(initialDate);
      setEndDate(initialDate);
    }
  }, [eventToEdit, initialDate]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate) return;

    let startIso: string;
    let endIso: string | undefined = undefined;

    if (allDay) {
      // Local all-day start
      const [sYear, sMonth, sDay] = startDate.split("-").map(Number);
      startIso = new Date(sYear, sMonth - 1, sDay, 0, 0, 0, 0).toISOString();
      if (endDate) {
        const [eYear, eMonth, eDay] = endDate.split("-").map(Number);
        endIso = new Date(eYear, eMonth - 1, eDay, 23, 59, 59, 999).toISOString();
      }
    } else {
      const [sYear, sMonth, sDay] = startDate.split("-").map(Number);
      const [sHour, sMinute] = (startTime || "10:30").split(":").map(Number);
      startIso = new Date(sYear, sMonth - 1, sDay, sHour, sMinute, 0, 0).toISOString();

      const effectiveEndDate = endDate || startDate;
      const [eYear, eMonth, eDay] = effectiveEndDate.split("-").map(Number);
      const [eHour, eMinute] = (endTime || "11:30").split(":").map(Number);
      endIso = new Date(eYear, eMonth - 1, eDay, eHour, eMinute, 0, 0).toISOString();
    }

    const payload: CreateEventPayload = {
      title: title.trim(),
      description,
      type,
      start: startIso,
      allDay,
    };

    if (endIso) {
      payload.end = endIso;
    }

    if (caseId) payload.caseId = caseId;

    const resetAndClose = () => {
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
    };

    if (eventToEdit) {
      updateEvent.mutate(
        { id: eventToEdit._id, data: payload },
        { onSuccess: resetAndClose }
      );
    } else {
      createEvent.mutate(payload, { onSuccess: resetAndClose });
    }
  };

  const isPending = createEvent.isPending || updateEvent.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{eventToEdit ? "Edit / Reschedule event" : "Schedule event"}</DialogTitle>
          <DialogDescription>
            {eventToEdit
              ? "Update event timings, notes/remarks, or linked case."
              : "Add a hearing, call reminder, task or firm event to the calendar."}
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
              {isPending ? (eventToEdit ? "Updating…" : "Scheduling…") : (eventToEdit ? "Update Event" : "Schedule event")}
            </Button>
          </DialogFooter>

          {(createEvent.isError || updateEvent.isError) && (
            <p className="text-caption text-destructive">Failed to save event. Please try again.</p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}