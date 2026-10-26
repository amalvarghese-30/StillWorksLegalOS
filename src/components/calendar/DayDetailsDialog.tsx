import { useState } from "react";
import {
  CalendarDays,
  Plus,
  Clock,
  Briefcase,
  Gavel,
  PhoneCall,
  CheckSquare,
  Building,
  Pencil,
  FileCheck2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CalendarEvent } from "@/services/calendar";
import { RecordHearingDialog } from "./RecordHearingDialog";

interface DayDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  dateStr: string;
  events: CalendarEvent[];
  onScheduleEvent: (dateStr: string) => void;
  onEditEvent?: (event: CalendarEvent) => void;
}

const getEventCls = (type: string) => {
  switch (type) {
    case "hearing":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30";
    case "call_reminder":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
    case "task":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30";
    case "firm_event":
      return "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30";
    case "leave":
      return "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

const getEventIcon = (type: string) => {
  switch (type) {
    case "hearing":
      return Gavel;
    case "call_reminder":
      return PhoneCall;
    case "task":
      return CheckSquare;
    case "firm_event":
      return Building;
    default:
      return CalendarDays;
  }
};

export function DayDetailsDialog({
  open,
  onClose,
  dateStr,
  events,
  onScheduleEvent,
  onEditEvent,
}: DayDetailsDialogProps) {
  const [recordingEvent, setRecordingEvent] = useState<CalendarEvent | null>(null);

  if (!open || !dateStr) return null;

  const dateObj = new Date(dateStr + "T00:00:00");
  const formattedDate = dateObj.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:w-full sm:max-w-lg max-h-[85vh] overflow-y-auto overflow-x-hidden rounded-xl border border-border bg-card p-4 sm:p-6 shadow-lift">
          <DialogHeader className="border-b border-border/60 pb-4">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                <CalendarDays size={18} strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-title font-semibold text-foreground break-words">
                  {formattedDate}
                </DialogTitle>
                <DialogDescription className="text-helper text-muted-foreground">
                  {events.length === 0
                    ? "No hearings or events scheduled"
                    : `${events.length} event(s) scheduled for this day`}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="mt-4 space-y-3 min-w-0">
            {events.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/80 p-8 text-center">
                <CalendarDays
                  size={32}
                  strokeWidth={1.5}
                  className="mx-auto text-muted-foreground/40"
                />
                <p className="mt-3 text-helper font-medium text-foreground">
                  Nothing scheduled for this day
                </p>
                <p className="mt-1 text-caption text-muted-foreground">
                  You can add a court hearing, client call, or firm event.
                </p>
              </div>
            ) : (
              <ul className="space-y-3 min-w-0">
                {events.map((event) => {
                  const Icon = getEventIcon(event.type);
                  const isHearingWithCase = event.type === "hearing" && Boolean(event.caseId);
                  const timeStr = event.allDay
                    ? "All Day"
                    : `${new Date(event.start).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}${
                        event.end
                          ? " – " +
                            new Date(event.end).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""
                      }`;

                  return (
                    <li
                      key={event._id}
                      className="w-full min-w-0 flex flex-col gap-2.5 rounded-lg border border-border bg-background/60 p-3.5 shadow-soft transition-colors hover:bg-muted/40"
                    >
                      {/* Top Row: Icon + Title & Description + Badge */}
                      <div className="flex items-start justify-between gap-2.5 min-w-0">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                            <Icon size={14} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-helper text-foreground break-words whitespace-normal leading-snug">
                              {event.title}
                            </p>
                            {event.description && (
                              <p className="text-caption text-muted-foreground mt-1 break-words whitespace-normal">
                                {event.description}
                              </p>
                            )}
                            {event.remarks && event.remarks !== event.description && (
                              <p className="text-caption text-primary/90 font-medium mt-1 break-words whitespace-normal bg-primary/5 px-2 py-1 rounded">
                                Remarks: {event.remarks}
                              </p>
                            )}
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded-pill border px-2 py-0.5 text-caption font-medium uppercase tracking-wider text-[10px] ${getEventCls(
                            event.type,
                          )}`}
                        >
                          {event.hearingStatus && event.type === "hearing"
                            ? `${event.hearingStatus}`
                            : event.type.replace("_", " ")}
                        </span>
                      </div>

                      {/* Bottom Row: Time & Case Link + Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-caption text-muted-foreground border-t border-border/40 pt-2.5 mt-0.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-3 min-w-0">
                          <span className="inline-flex items-center gap-1 shrink-0">
                            <Clock size={12} className="text-muted-foreground/80" />
                            {timeStr}
                          </span>
                          {event.caseId && (
                            <span className="inline-flex items-center gap-1 shrink-0 font-medium text-foreground/80">
                              <Briefcase size={12} className="text-primary" />
                              Case linked
                            </span>
                          )}
                        </div>

                        {/* Actions group */}
                        <div className="flex flex-wrap items-center gap-2">
                          {isHearingWithCase && (
                            <button
                              type="button"
                              onClick={() => setRecordingEvent(event)}
                              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-[12px] font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-all cursor-pointer active:scale-95"
                              title="Record hearing outcome, work done, and schedule next date"
                            >
                              <FileCheck2 size={13} /> Next Date
                            </button>
                          )}
                          {onEditEvent && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onEditEvent(event);
                              }}
                              className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              title="Edit / Reschedule event"
                            >
                              <Pencil size={11} /> Edit / Reschedule
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <DialogFooter className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 border-t border-border/60 pt-4">
            <Button
              type="button"
              className="gradient-primary rounded-md text-primary-foreground order-2 sm:order-1"
              onClick={() => {
                onClose();
                onScheduleEvent(dateStr);
              }}
            >
              <Plus size={15} className="mr-1.5" />
              Schedule Event for this Date
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-md order-1 sm:order-2"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {recordingEvent && (
        <RecordHearingDialog
          open={Boolean(recordingEvent)}
          onClose={() => setRecordingEvent(null)}
          event={recordingEvent}
        />
      )}
    </>
  );
}
