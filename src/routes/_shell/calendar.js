import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, CalendarDays, ChevronLeft, ChevronRight, Gavel, PhoneCall, CheckSquare, Building2, User, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useCalendarEvents } from "@/services/calendar";
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
];
function getEventCls(type) {
    const map = {
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
    const events = eventsData?.events ?? [];
    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    ];
    const prevMonth = () => {
        if (currentMonth === 0) {
            setCurrentMonth(11);
            setCurrentYear((y) => y - 1);
        }
        else {
            setCurrentMonth((m) => m - 1);
        }
    };
    const nextMonth = () => {
        if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear((y) => y + 1);
        }
        else {
            setCurrentMonth((m) => m + 1);
        }
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
    for (let i = adjustedStart - 1; i >= 0; i--)
        days.push({ day: daysInPrevMonth - i, month: "prev" });
    for (let d = 1; d <= daysInMonth; d++)
        days.push({ day: d, month: "current" });
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++)
        days.push({ day: d, month: "next" });
    const eventsByDay = {};
    for (const e of events) {
        const d = new Date(e.start).getDate();
        if (!eventsByDay[d])
            eventsByDay[d] = [];
        eventsByDay[d].push(e);
    }
    const agendaEvents = events
        .filter((e) => {
        const d = new Date(e.start);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    const hearingCount = agendaEvents.filter((e) => e.type === "hearing").length;
    return (_jsxs("div", { children: [_jsx(PageHeader, { breadcrumb: [{ label: "StillWorks", to: "/" }, { label: "Calendar" }], title: `${monthNames[currentMonth]} ${currentYear}`, subtitle: `${events.length} events · ${hearingCount} hearings this month`, actions: _jsxs("div", { className: "flex gap-2", children: [isAdmin && (_jsxs("select", { value: filterEmployee, onChange: (e) => setFilterEmployee(e.target.value), className: "h-11 rounded-md border border-border bg-card px-3 text-helper outline-none transition-colors focus:border-primary", children: [_jsx("option", { value: "all", children: "All employees" }), apiEmployees.map((emp) => (_jsx("option", { value: emp._id, children: emp.name }, emp._id)))] })), _jsxs(Button, { className: "gradient-primary rounded-md text-primary-foreground shadow-soft transition-transform duration-200 hover:-translate-y-0.5", onClick: () => setShowScheduleDialog(true), children: [_jsx(Plus, { size: 17, strokeWidth: 2 }), "New event"] })] }) }), _jsxs("div", { className: "mb-6 flex flex-wrap items-center justify-between gap-4", children: [_jsx("div", { className: "inline-flex rounded-pill border border-border bg-card p-1 shadow-soft", children: ["Month", "Week", "Day", "Agenda"].map((v) => (_jsx("button", { onClick: () => setView(v), className: `min-h-11 rounded-pill px-4 text-helper font-medium transition-all duration-200 ${view === v ? "gradient-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`, children: v }, v))) }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { variant: "outline", size: "sm", className: "rounded-md", onClick: prevMonth, children: _jsx(ChevronLeft, { size: 16 }) }), _jsx(Button, { variant: "outline", size: "sm", className: "rounded-md", onClick: goToday, children: "Today" }), _jsx(Button, { variant: "outline", size: "sm", className: "rounded-md", onClick: nextMonth, children: _jsx(ChevronRight, { size: 16 }) })] })] }), _jsx("ul", { className: "mb-4 flex flex-wrap items-center gap-4 rounded-md border border-border bg-card p-3", children: LEGEND.map((l) => (_jsxs("li", { className: "flex items-center gap-2 text-caption text-muted-foreground", children: [_jsx("span", { className: `size-2.5 rounded-full ${l.cls}` }), l.label] }, l.label))) }), isLoading && (_jsx("div", { className: "rounded-lg border border-border bg-card p-6 shadow-soft animate-pulse", children: _jsx("div", { className: "grid grid-cols-7 gap-2", children: Array.from({ length: 42 }).map((_, i) => (_jsx("div", { className: "min-h-24 rounded-md bg-muted/50" }, i))) }) })), isError && (_jsxs("div", { className: "flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-12 text-center", children: [_jsx(AlertTriangle, { size: 28, className: "text-destructive" }), _jsx("p", { className: "font-medium", children: "Failed to load calendar" }), _jsx("p", { className: "text-helper text-muted-foreground", children: "Check that the server is running." })] })), !isLoading && !isError && (_jsx(_Fragment, { children: view === "Agenda" ? (_jsx("div", { className: "rounded-lg border border-border bg-card p-6 shadow-soft", children: agendaEvents.length === 0 ? (_jsxs("div", { className: "py-16 text-center", children: [_jsx(CalendarDays, { size: 32, strokeWidth: 1.5, className: "mx-auto text-muted-foreground/40" }), _jsx("p", { className: "mt-3 text-helper text-muted-foreground", children: "No events this month" })] })) : (_jsx("ol", { className: "relative space-y-4 border-l border-border pl-6", children: agendaEvents.map((e) => (_jsxs("li", { className: "relative", children: [_jsx("span", { className: `absolute top-2 -left-[1.9rem] size-2.5 rounded-full ring-4 ring-card ${LEGEND.find((l) => l.label.toLowerCase().includes(e.type.replace("_", " ")))?.cls ?? "bg-muted"}` }), _jsx("div", { className: "rounded-md border border-border bg-card p-4", children: _jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsx("p", { className: "font-medium", children: e.title }), _jsxs("p", { className: "num mt-0.5 text-caption text-muted-foreground", children: [e.allDay ? "All day" : new Date(e.start).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }), e.end && ` - ${new Date(e.end).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`] })] }), _jsx("div", { className: "text-right", children: _jsx("span", { className: `rounded-pill px-2 py-0.5 text-caption font-medium ${getEventCls(e.type)}`, children: e.type.replace("_", " ") }) })] }) })] }, e._id))) })) })) : (_jsxs("div", { className: "overflow-x-auto rounded-lg border border-border bg-card p-4 shadow-soft sm:p-6", children: [_jsx("div", { className: "grid min-w-[640px] grid-cols-7 gap-2 pb-3 text-caption font-medium text-muted-foreground", children: WEEKDAYS.map((d) => _jsx("div", { className: "px-2", children: d }, d)) }), _jsx("div", { className: "grid min-w-[640px] grid-cols-7 gap-2", children: days.map((d, i) => {
                                const inMonth = d.month === "current";
                                const dateStr = inMonth ? `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(d.day).padStart(2, "0")}` : "";
                                const isToday = dateStr === todayStr;
                                const dayEvents = inMonth ? (eventsByDay[d.day] ?? []) : [];
                                return (_jsxs("div", { className: `min-h-24 rounded-md border p-2 transition-colors duration-150 sm:min-h-28 ${inMonth ? "border-border bg-card hover:bg-accent/50" : "border-transparent bg-muted/40"}`, children: [_jsx("span", { className: `num inline-flex size-6 items-center justify-center rounded-full text-caption ${isToday ? "gradient-primary font-semibold text-primary-foreground" : inMonth ? "text-foreground" : "text-muted-foreground/40"}`, children: d.day }), _jsxs("div", { className: "mt-1.5 space-y-1", children: [dayEvents.slice(0, 3).map((e) => (_jsx("p", { className: `truncate rounded-sm px-1.5 py-0.5 text-[11px] font-medium ${getEventCls(e.type)}`, children: e.allDay ? e.title : `${new Date(e.start).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }).slice(0, 5)} ${e.title}` }, e._id))), dayEvents.length > 3 && (_jsxs("p", { className: "truncate rounded-sm px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground", children: ["+", dayEvents.length - 3, " more"] }))] })] }, i));
                            }) })] })) })), _jsxs("p", { className: "mt-4 flex items-center gap-2 text-helper text-muted-foreground", children: [_jsx(CalendarDays, { size: 16, strokeWidth: 1.75 }), isAdmin ? "Admin view — select employee from dropdown to filter" : "Showing your personal calendar"] }), showScheduleDialog && (_jsx(ScheduleHearingDialog, { open: showScheduleDialog, onClose: () => setShowScheduleDialog(false) }))] }));
}
