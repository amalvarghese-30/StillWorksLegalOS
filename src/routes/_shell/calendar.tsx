import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, CalendarDays, ChevronLeft, ChevronRight, Gavel, PhoneCall, CheckSquare, Users, Building2, User, Loader2, AlertTriangle, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useCalendarEvents, type CalendarEvent } from "@/services/calendar";
import { useEmployees } from "@/services/admin";
import { ScheduleHearingDialog } from "@/components/calendar/ScheduleHearingDialog";

export const Route = createFileRoute("/_shell/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar · StillWorks LegalOS" },
      {
        name: "description",
        content: "Hearings, tasks, call reminders and firm events across month, week, day and agenda views.",
      },
      { property: "og:title", content: "Calendar · StillWorks LegalOS" },
      {
        property: "og:description",
        content: "Hearings, tasks, call reminders and firm events in one schedule.",
      },
    ],
  }),
  component: CalendarPage,
});

const LEGEND = [
  { label: "Hearings", cls: "bg-primary", icon: Gavel },
  { label: "Call reminders", cls: "bg-warning", icon: PhoneCall },
  { label: "Tasks due", cls: "bg-violet", icon: CheckSquare },
  { label: "Leave", cls: "bg-success", icon: User },
  { label: "Firm events", cls: "bg-indigo", icon: Building2 },
  { label: "Personal", cls: "bg-muted-foreground/30", icon: CalendarDays },
] as const;

function getEventCls(type: string): string {
  const map: Record<string, string> = {
    hearing: "bg-primary/12 text-primary border-l-2 border-primary",
    task: "bg-violet/18 text-indigo border-l-2 border-violet",
    call_reminder: "bg-warning/15 text-warning border-l-2 border-warning",
    leave: "bg-success/12 text-success border-l-2 border-success",
    firm_event: "bg-indigo/15 text-indigo border-l-2 border-indigo",
    personal: "bg-muted/30 text-muted-foreground border-l-2 border-muted-foreground/50",
  };
  return map[type] ?? "bg-muted/20 text-muted-foreground border-l-2 border-muted-foreground/40";
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function CalendarPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [view, setView] = useState("Month");
  const [search, setSearch] = useState("");
  const [filterEmployee, setFilterEmployee] = useState(isAdmin ? "all" : "me");
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);

  const monthStart = new Date(currentYear, currentMonth, 1).toISOString();
  const monthEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59).toISOString();

  const { data: eventsData, isLoading, isError } = useCalendarEvents({
    start: monthStart,
    end: monthEnd,
    ...(isAdmin && filterEmployee !== "all" ? { employeeId: filterEmployee } : {}),
  });

  const { data: empData } = useEmployees(undefined, { enabled: isAdmin });
  const apiEmployees = empData?.employees ?? [];

  const allEvents: CalendarEvent[] = eventsData?.events ?? [];
  const query = search.trim().toLowerCase();
  const events = query
    ? allEvents.filter((e) =>
        e.title.toLowerCase().includes(query) ||
        (e.description && e.description.toLowerCase().includes(query)) ||
        (e.caseName && e.caseName.toLowerCase().includes(query)) ||
        (e.clientName && e.clientName.toLowerCase().includes(query))
      )
    : allEvents;

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((y) => y - 1); }
    else { setCurrentMonth((m) => m - 1); }
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((y) => y + 1); }
    else { setCurrentMonth((m) => m + 1); }
  };
  const goToday = () => {
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
  };

  const firstDay = new Date(currentYear, currentMonth, 1);
  const startDayOfWeek = firstDay.getDay();
  const adjustedStart = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const days = [];
  for (let i = adjustedStart - 1; i >= 0; i--) days.push({ day: daysInPrevMonth - i, month: "prev" });
  for (let d = 1; d <= daysInMonth; d++) days.push({ day: d, month: "current" });
  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++) days.push({ day: d, month: "next" });

  const eventsByDay: Record<number, CalendarEvent[]> = {};
  for (const e of events) {
    const d = new Date(e.start).getDate();
    if (!eventsByDay[d]) eventsByDay[d] = [];
    eventsByDay[d]!.push(e);
  }

  const agendaEvents = events
    .filter((e) => {
      const d = new Date(e.start);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const hearingCount = agendaEvents.filter((e) => e.type === "hearing").length;

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "StillWorks", to: "/" }, { label: "Calendar" }]}
        title={`${monthNames[currentMonth]} ${currentYear}`}
        subtitle={`${events.length} events · ${hearingCount} hearings this month`}
        actions={
          <div className="flex gap-2">
            {isAdmin && (
              <select
                value={filterEmployee}
                onChange={(e) => setFilterEmployee(e.target.value)}
                className="h-11 rounded-md border border-border bg-card px-3 text-helper outline-none transition-colors focus:border-primary"
              >
                <option value="all">All employees</option>
                {apiEmployees.map((emp) => (
                  <option key={emp._id} value={emp._id}>{emp.name}</option>
                ))}
              </select>
            )}
            <Button className="gradient-primary rounded-md text-primary-foreground shadow-soft transition-transform duration-200 hover:-translate-y-0.5" onClick={() => setShowScheduleDialog(true)}>
              <Plus size={17} strokeWidth={2} />
              New event
            </Button>
          </div>
        }
      />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-pill border border-border bg-card p-1 shadow-soft">
          {["Month", "Week", "Day", "Agenda"].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`min-h-11 rounded-pill px-4 text-helper font-medium transition-all duration-200 ${
                view === v ? "gradient-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Search events */}
        <label className="flex min-w-0 flex-1 items-center gap-3 rounded-pill border border-border bg-card px-4 py-2.5 shadow-soft sm:max-w-xs">
          <Search size={18} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
          <input
            type="search"
            aria-label="Search events"
            placeholder="Search hearings or cases…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-helper outline-none"
          />
        </label>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-md" onClick={prevMonth}><ChevronLeft size={16} /></Button>
          <Button variant="outline" size="sm" className="rounded-md" onClick={goToday}>Today</Button>
          <Button variant="outline" size="sm" className="rounded-md" onClick={nextMonth}><ChevronRight size={16} /></Button>
        </div>
      </div>

      <ul className="mb-4 flex flex-wrap items-center gap-4 rounded-md border border-border bg-card p-3">
        {LEGEND.map((l) => (
          <li key={l.label} className="flex items-center gap-2 text-caption text-muted-foreground">
            <span className={`size-2.5 rounded-full ${l.cls}`} />{l.label}
          </li>
        ))}
      </ul>

      {isLoading && (
        <div className="rounded-lg border border-border bg-card p-6 shadow-soft animate-pulse">
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 42 }).map((_, i) => (
              <div key={i} className="min-h-24 rounded-md bg-muted/50" />
            ))}
          </div>
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-12 text-center">
          <AlertTriangle size={28} className="text-destructive" />
          <p className="font-medium">Failed to load calendar</p>
          <p className="text-helper text-muted-foreground">Check that the server is running.</p>
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {view === "Agenda" ? (
            <div className="rounded-lg border border-border bg-card p-6 shadow-soft">
              {agendaEvents.length === 0 ? (
                <div className="py-16 text-center">
                  <CalendarDays size={32} strokeWidth={1.5} className="mx-auto text-muted-foreground/40" />
                  <p className="mt-3 text-helper text-muted-foreground">No events this month</p>
                </div>
              ) : (
                <ol className="relative space-y-4 border-l border-border pl-6">
                  {agendaEvents.map((e) => (
                    <li key={e._id} className="relative">
                      <span className={`absolute top-2 -left-[1.9rem] size-2.5 rounded-full ring-4 ring-card ${LEGEND.find((l) => l.label.toLowerCase().includes(e.type.replace("_", " ")))?.cls ?? "bg-muted"}`} />
                      <div className="rounded-md border border-border bg-card p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium">{e.title}</p>
                            <p className="num mt-0.5 text-caption text-muted-foreground">
                              {e.allDay ? "All day" : new Date(e.start).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                              {e.end && ` - ${new Date(e.end).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className={`rounded-pill px-2 py-0.5 text-caption font-medium ${getEventCls(e.type)}`}>
                              {e.type.replace("_", " ")}
                            </span>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card p-4 shadow-soft sm:p-6">
              <div className="grid min-w-[640px] grid-cols-7 gap-2 pb-3 text-caption font-medium text-muted-foreground">
                {WEEKDAYS.map((d) => <div key={d} className="px-2">{d}</div>)}
              </div>
              <div className="grid min-w-[640px] grid-cols-7 gap-2">
                {days.map((d, i) => {
                  const inMonth = d.month === "current";
                  const dateStr = inMonth ? `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(d.day).padStart(2, "0")}` : "";
                  const isToday = dateStr === todayStr;
                  const dayEvents = inMonth ? (eventsByDay[d.day] ?? []) : [];
                  return (
                    <div
                      key={i}
                      className={`min-h-24 rounded-md border p-2 transition-colors duration-150 sm:min-h-28 ${
                        inMonth ? "border-border bg-card hover:bg-accent/50" : "border-transparent bg-muted/40"
                      }`}
                    >
                      <span className={`num inline-flex size-6 items-center justify-center rounded-full text-caption ${
                        isToday ? "gradient-primary font-semibold text-primary-foreground" : inMonth ? "text-foreground" : "text-muted-foreground/40"
                      }`}>
                        {d.day}
                      </span>
                      <div className="mt-1.5 space-y-1">
                        {dayEvents.slice(0, 3).map((e) => (
                          <p key={e._id} className={`truncate rounded-sm px-1.5 py-0.5 text-[11px] font-medium ${getEventCls(e.type)}`}>
                            {e.allDay ? e.title : `${new Date(e.start).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }).slice(0, 5)} ${e.title}`}
                          </p>
                        ))}
                        {dayEvents.length > 3 && (
                          <p className="truncate rounded-sm px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                            +{dayEvents.length - 3} more
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      <p className="mt-4 flex items-center gap-2 text-helper text-muted-foreground">
        <CalendarDays size={16} strokeWidth={1.75} />
        {isAdmin ? "Admin view — select employee from dropdown to filter" : "Showing your personal calendar"}
      </p>

      {showScheduleDialog && (
        <ScheduleHearingDialog open={showScheduleDialog} onClose={() => setShowScheduleDialog(false)} />
      )}
    </div>
  );
}
