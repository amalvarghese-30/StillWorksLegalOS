import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Plus, PhoneCall, ListTodo, LayoutGrid, CalendarDays, CheckCircle2, Circle, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/common/Surface";
import { StatusPill, toneForStatus } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useTasks, useToggleChecklistItem } from "@/services/tasks";
import { AddTaskDialog } from "@/components/tasks/AddTaskDialog";
import { QuickCallDialog } from "@/components/tasks/QuickCallDialog";
export const Route = createFileRoute("/_shell/tasks")({
    head: () => ({
        meta: [
            { title: "Tasks · StillWorks LegalOS" },
            {
                name: "description",
                content: "A calm reminders-style task list: overdue, due today, upcoming and call reminders.",
            },
            { property: "og:title", content: "Tasks · StillWorks LegalOS" },
            {
                property: "og:description",
                content: "Overdue, due today, upcoming work and call reminders in one calm list.",
            },
        ],
    }),
    component: TasksPage,
});
const BUCKETS = ["Overdue", "Due Today", "Upcoming", "Completed"];
const VIEWS = [
    { id: "list", label: "List", icon: ListTodo },
    { id: "kanban", label: "Kanban", icon: LayoutGrid },
    { id: "calendar", label: "Calendar", icon: CalendarDays },
];
function getBucket(task) {
    if (task.status === "completed")
        return "Completed";
    if (task.status === "overdue")
        return "Overdue";
    if (!task.deadline)
        return "Upcoming";
    const dl = new Date(task.deadline);
    const now = new Date();
    if (dl < now)
        return "Overdue";
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dlDay = new Date(dl.getFullYear(), dl.getMonth(), dl.getDate());
    if (dlDay.getTime() === today.getTime())
        return "Due Today";
    return "Upcoming";
}
function formatDeadline(iso) {
    if (!iso)
        return "No deadline";
    const d = new Date(iso);
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0)
        return `${Math.abs(diffDays)} day(s) ago`;
    if (diffDays === 0)
        return "Today";
    if (diffDays === 1)
        return "Tomorrow";
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
function TaskCard({ task }) {
    const toggleChecklist = useToggleChecklistItem();
    const total = task.checklist?.length ?? 0;
    const done = task.checklist?.filter((c) => c.done).length ?? 0;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return (_jsxs("article", { className: `lift card-hover pressable rounded-md border p-4 ${task.isCall ? "border-violet-500/30 bg-violet-500/5" : "border-border bg-card"}`, children: [_jsxs("div", { className: "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "truncate font-medium", children: task.title }), _jsx("p", { className: "truncate text-caption text-muted-foreground", children: task.caseName || task.description || "No case linked" })] }), _jsx(StatusPill, { tone: toneForStatus(task.priority), children: task.priority })] }), total > 0 && (_jsxs("div", { className: "mt-3 space-y-1", children: [task.checklist.slice(0, 3).map((item) => {
                        const toggle = item._id
                            ? () => toggleChecklist.mutate({
                                taskId: task._id,
                                itemId: item._id,
                                done: !item.done,
                            })
                            : undefined;
                        return (_jsxs("button", { type: "button", onClick: toggle, disabled: !toggle || toggleChecklist.isPending, className: "flex w-full items-center gap-2 rounded text-helper transition-colors hover:bg-muted/50 disabled:cursor-default disabled:opacity-60", children: [item.done ? (_jsx(CheckCircle2, { size: 15, className: "shrink-0 text-success" })) : (_jsx(Circle, { size: 15, className: "shrink-0 text-muted-foreground" })), _jsx("span", { className: `truncate ${item.done ? "text-muted-foreground line-through" : ""}`, children: item.text })] }, item._id ?? item.text));
                    }), total > 3 && (_jsxs("p", { className: "pl-7 text-caption text-muted-foreground", children: ["+", total - 3, " more items"] }))] })), _jsxs("div", { className: "mt-4 flex items-center gap-3", children: [_jsx(Progress, { value: pct, className: "h-1.5" }), _jsxs("span", { className: "num shrink-0 text-caption text-muted-foreground", children: [done, "/", total] })] }), _jsxs("div", { className: "mt-3 flex items-center justify-between", children: [_jsxs("p", { className: "num text-caption text-muted-foreground", children: [task.assignedTo?.name ?? "Unassigned", " \u00B7 ", formatDeadline(task.deadline)] }), task.callReminder && (_jsxs("span", { className: "flex items-center gap-1 text-caption text-warning", children: [_jsx(PhoneCall, { size: 12 }), " Call"] }))] })] }));
}
function TasksPage() {
    const [view, setView] = useState("list");
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [showQuickCall, setShowQuickCall] = useState(false);
    const [calendarMonth, setCalendarMonth] = useState(new Date());
    const { data, isLoading, isError, error } = useTasks();
    const tasks = data?.tasks ?? [];
    // Calendar helpers
    const calendarDays = useMemo(() => {
        const month = calendarMonth.getMonth();
        const year = calendarMonth.getFullYear();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDay = firstDay.getDay(); // 0 = Sunday
        const daysInMonth = lastDay.getDate();
        const days = [];
        // Add leading empty days
        for (let i = 0; i < startDay; i++)
            days.push(null);
        // Add actual days
        for (let d = 1; d <= daysInMonth; d++)
            days.push(new Date(year, month, d));
        return days;
    }, [calendarMonth]);
    const getTasksForDay = (date) => {
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);
        return tasks.filter((t) => {
            if (!t.deadline)
                return false;
            const dl = new Date(t.deadline);
            return dl >= dayStart && dl <= dayEnd;
        });
    };
    const formatMonthYear = (date) => date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    const prevMonth = () => setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
    const nextMonth = () => setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
    return (_jsxs("div", { children: [_jsx(PageHeader, { breadcrumb: [{ label: "StillWorks", to: "/" }, { label: "Tasks" }], title: "Tasks", subtitle: `${tasks.filter((t) => t.status !== "completed").length} open items · ${tasks.filter((t) => getBucket(t) === "Overdue").length} overdue · ${tasks.filter((t) => t.callReminder).length} call reminders.`, actions: _jsxs(_Fragment, { children: [_jsxs(Button, { variant: "outline", className: "rounded-md shadow-soft transition-transform duration-200 hover:-translate-y-0.5", onClick: () => setShowQuickCall(true), children: [_jsx(PhoneCall, { size: 17, strokeWidth: 1.75 }), "Call reminder"] }), _jsxs(Button, { className: "gradient-primary rounded-md text-primary-foreground shadow-soft transition-transform duration-200 hover:-translate-y-0.5", onClick: () => setShowAddDialog(true), children: [_jsx(Plus, { size: 17, strokeWidth: 2 }), "Create task"] })] }) }), _jsx("div", { className: "mb-6 inline-flex rounded-pill border border-border bg-card p-1 shadow-soft", children: VIEWS.map((v) => (_jsxs("button", { onClick: () => setView(v.id), className: `flex min-h-11 items-center gap-2 rounded-pill px-4 text-helper font-medium transition-all duration-200 ${view === v.id
                        ? "gradient-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"}`, children: [_jsx(v.icon, { size: 17, strokeWidth: 1.75 }), v.label] }, v.id))) }), isLoading && (_jsx("div", { className: "grid gap-4 sm:grid-cols-2 xl:grid-cols-3", children: Array.from({ length: 6 }).map((_, i) => (_jsx("div", { className: "rounded-lg border border-border bg-card p-4", children: _jsxs("div", { className: "space-y-3", children: [_jsx("div", { className: "h-4 w-48 animate-pulse rounded bg-muted" }), _jsx("div", { className: "h-3 w-32 animate-pulse rounded bg-muted" }), _jsx("div", { className: "h-1.5 w-full animate-pulse rounded bg-muted" })] }) }, i))) })), isError && !isLoading && (_jsxs("div", { className: "rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center", children: [_jsx("p", { className: "font-medium text-destructive", children: "Failed to load tasks" }), _jsx("p", { className: "mt-1 text-helper text-muted-foreground", children: error instanceof Error ? error.message : "Could not connect to the server." })] })), !isLoading && !isError && tasks.length === 0 && (_jsxs("div", { className: "rounded-lg border border-border bg-card p-16 text-center shadow-soft", children: [_jsx("p", { className: "text-title font-semibold", children: "No tasks yet" }), _jsx("p", { className: "mt-2 text-helper text-muted-foreground", children: "Create your first task to get started." })] })), !isLoading && !isError && tasks.length > 0 && view === "kanban" ? (_jsx("div", { className: "grid gap-4 lg:grid-cols-4", children: BUCKETS.map((b) => {
                    const bucketTasks = tasks.filter((t) => getBucket(t) === b);
                    return (_jsxs("div", { className: "rounded-lg border border-border bg-card/70 p-4", children: [_jsxs("div", { className: "mb-4 flex items-center justify-between", children: [_jsx("h2", { className: "text-helper font-semibold", children: b }), _jsx(StatusPill, { tone: toneForStatus(b), children: bucketTasks.length })] }), _jsxs("div", { className: "space-y-3 stagger-children", children: [bucketTasks.map((t) => (_jsx(TaskCard, { task: t }, t._id))), bucketTasks.length === 0 && (_jsx("p", { className: "py-4 text-center text-caption text-muted-foreground", children: "No tasks" }))] })] }, b));
                }) })) : !isLoading && !isError && tasks.length > 0 && view === "calendar" ? (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-title font-semibold", children: formatMonthYear(calendarMonth) }), _jsxs("p", { className: "text-helper text-muted-foreground", children: [tasks.filter((t) => t.deadline).length, " task(s) with deadlines this month"] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { variant: "outline", size: "sm", onClick: prevMonth, className: "rounded-md", children: _jsx(ChevronLeft, { size: 16 }) }), _jsx(Button, { variant: "outline", size: "sm", onClick: nextMonth, className: "rounded-md", children: _jsx(ChevronRight, { size: 16 }) })] })] }), _jsxs("div", { className: "rounded-lg border border-border bg-card overflow-hidden", children: [_jsx("div", { className: "grid grid-cols-7 border-b border-border bg-muted/50", children: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => (_jsx("div", { className: "px-2 py-3 text-center text-caption font-medium text-muted-foreground", children: day }, day))) }), _jsx("div", { className: "grid grid-cols-7", children: calendarDays.map((day, i) => {
                                    if (!day) {
                                        return _jsx("div", { className: "min-h-[100px] p-2" }, "empty-" + i);
                                    }
                                    const dayTasks = getTasksForDay(day);
                                    const isToday = day.toDateString() === new Date().toDateString();
                                    return (_jsxs("div", { className: `min-h-[100px] p-2 border-r border-b border-border ${isToday ? "bg-primary/5" : ""}`, children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsx("span", { className: `num text-caption font-medium ${isToday ? "text-primary" : "text-foreground"}`, children: day.getDate() }), dayTasks.length > 0 && (_jsx(StatusPill, { tone: "primary", className: "text-caption", children: dayTasks.length }))] }), _jsxs("div", { className: "space-y-1", children: [dayTasks.slice(0, 3).map((t) => (_jsx("div", { className: "truncate text-caption px-1 py-0.5 rounded text-white bg-primary/80 hover:bg-primary", title: t.title, children: t.title }, t._id))), dayTasks.length > 3 && (_jsxs("div", { className: "text-caption text-muted-foreground px-1", children: ["+", dayTasks.length - 3, " more"] }))] })] }, day.toISOString()));
                                }) })] })] })) : !isLoading && !isError && tasks.length > 0 ? (_jsxs("div", { className: "grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]", children: [_jsx("div", { className: "space-y-6 stagger-children", children: BUCKETS.map((b) => {
                            const bucketTasks = tasks.filter((t) => getBucket(t) === b);
                            if (bucketTasks.length === 0)
                                return null;
                            return (_jsx(SectionCard, { title: b, description: `${bucketTasks.length} item(s)`, icon: ListTodo, bodyClassName: "grid gap-3 sm:grid-cols-2 stagger-children", children: bucketTasks.map((t) => (_jsx(TaskCard, { task: t }, t._id))) }, b));
                        }) }), _jsx(SectionCard, { title: "Call reminders", description: "Scheduled client calls.", icon: PhoneCall, children: tasks.filter((t) => t.callReminder).length > 0 ? (_jsx("ul", { className: "space-y-3", children: tasks
                                .filter((t) => t.callReminder)
                                .map((t) => (_jsxs("li", { className: "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-border p-4", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "truncate font-medium", children: t.callReminder.clientName }), _jsx("p", { className: "num truncate text-caption text-muted-foreground", children: t.callReminder.phone }), _jsx("p", { className: "num mt-0.5 text-caption text-muted-foreground", children: new Date(t.callReminder.scheduledAt).toLocaleDateString("en-IN", {
                                                    weekday: "short",
                                                    day: "numeric",
                                                    month: "short",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                }) })] }), _jsx(StatusPill, { tone: t.callReminder.completed ? "success" : "warning", children: t.callReminder.completed ? "Done" : "Pending" })] }, t._id))) })) : (_jsxs("div", { className: "py-8 text-center text-helper text-muted-foreground", children: [_jsx(PhoneCall, { size: 28, strokeWidth: 1.5, className: "mx-auto mb-2 opacity-40" }), _jsx("p", { children: "No call reminders" }), _jsx("p", { className: "mt-1 text-caption", children: "Add a call reminder when creating a task." })] })) })] })) : null, _jsx(AddTaskDialog, { open: showAddDialog, onClose: () => setShowAddDialog(false) }), _jsx(QuickCallDialog, { open: showQuickCall, onClose: () => setShowQuickCall(false) })] }));
}
