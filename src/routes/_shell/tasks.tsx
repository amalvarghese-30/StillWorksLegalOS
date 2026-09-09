import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Plus, PhoneCall, ListTodo, LayoutGrid, CalendarDays, CheckCircle2, Circle, Clock, Loader2, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/common/Surface";
import { StatusPill, toneForStatus } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useTasks, useToggleChecklistItem, type TaskRecord } from "@/services/tasks";
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

const BUCKETS = ["Overdue", "Due Today", "Upcoming", "Completed"] as const;
const VIEWS = [
  { id: "list", label: "List", icon: ListTodo },
  { id: "kanban", label: "Kanban", icon: LayoutGrid },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
];

function getBucket(task: TaskRecord): string {
  if (task.status === "completed") return "Completed";
  if (task.status === "overdue") return "Overdue";
  if (!task.deadline) return "Upcoming";
  const dl = new Date(task.deadline);
  const now = new Date();
  if (dl < now) return "Overdue";
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dlDay = new Date(dl.getFullYear(), dl.getMonth(), dl.getDate());
  if (dlDay.getTime() === today.getTime()) return "Due Today";
  return "Upcoming";
}

function formatDeadline(iso: string | null): string {
  if (!iso) return "No deadline";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `${Math.abs(diffDays)} day(s) ago`;
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function TaskCard({ task }: { task: TaskRecord }) {
  const toggleChecklist = useToggleChecklistItem();
  const total = task.checklist?.length ?? 0;
  const done = task.checklist?.filter((c) => c.done).length ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <article
      className={`lift card-hover pressable rounded-md border p-4 ${
        task.isCall ? "border-violet-500/30 bg-violet-500/5" : "border-border bg-card"
      }`}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{task.title}</p>
          <p className="truncate text-caption text-muted-foreground">
            {task.caseName || task.description || "No case linked"}
          </p>
        </div>
        <StatusPill tone={toneForStatus(task.priority)}>{task.priority}</StatusPill>
      </div>

      {/* Checklist preview */}
      {total > 0 && (
        <div className="mt-3 space-y-1">
          {task.checklist.slice(0, 3).map((item) => {
            const toggle = item._id
              ? () =>
                  toggleChecklist.mutate({
                    taskId: task._id,
                    itemId: item._id!,
                    done: !item.done,
                  })
              : undefined;
            return (
              <button
                type="button"
                key={item._id ?? item.text}
                onClick={toggle}
                disabled={!toggle || toggleChecklist.isPending}
                className="flex w-full items-center gap-2 rounded text-helper transition-colors hover:bg-muted/50 disabled:cursor-default disabled:opacity-60"
              >
                {item.done ? (
                  <CheckCircle2 size={15} className="shrink-0 text-success" />
                ) : (
                  <Circle size={15} className="shrink-0 text-muted-foreground" />
                )}
                <span className={`truncate ${item.done ? "text-muted-foreground line-through" : ""}`}>
                  {item.text}
                </span>
              </button>
            );
          })}
          {total > 3 && (
            <p className="pl-7 text-caption text-muted-foreground">+{total - 3} more items</p>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <Progress value={pct} className="h-1.5" />
        <span className="num shrink-0 text-caption text-muted-foreground">
          {done}/{total}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <p className="num text-caption text-muted-foreground">
          {task.assignedTo?.name ?? "Unassigned"} · {formatDeadline(task.deadline)}
        </p>
        {task.callReminder && (
          <span className="flex items-center gap-1 text-caption text-warning">
            <PhoneCall size={12} /> Call
          </span>
        )}
      </div>
    </article>
  );
}

function TasksPage() {
  const [view, setView] = useState("list");
  const [search, setSearch] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showQuickCall, setShowQuickCall] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const { data, isLoading, isError, error } = useTasks();

  const allTasks = data?.tasks ?? [];
  const query = search.trim().toLowerCase();
  const tasks = useMemo(() => {
    if (!query) return allTasks;
    return allTasks.filter((t) =>
      t.title.toLowerCase().includes(query) ||
      (t.category && t.category.toLowerCase().includes(query)) ||
      (t.assignedTo && typeof t.assignedTo === "object" && "name" in t.assignedTo && (t.assignedTo as { name: string }).name.toLowerCase().includes(query))
    );
  }, [allTasks, query]);

  // Calendar helpers
  const calendarDays = useMemo(() => {
    const month = calendarMonth.getMonth();
    const year = calendarMonth.getFullYear();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay(); // 0 = Sunday
    const daysInMonth = lastDay.getDate();

    const days: (Date | null)[] = [];
    // Add leading empty days
    for (let i = 0; i < startDay; i++) days.push(null);
    // Add actual days
    for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d));
    return days;
  }, [calendarMonth]);

  const getTasksForDay = (date: Date) => {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    return tasks.filter((t) => {
      if (!t.deadline) return false;
      const dl = new Date(t.deadline);
      return dl >= dayStart && dl <= dayEnd;
    });
  };

  const formatMonthYear = (date: Date) =>
    date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  const prevMonth = () => setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const nextMonth = () => setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "StillWorks", to: "/" }, { label: "Tasks" }]}
        title="Tasks"
        subtitle={`${tasks.filter((t) => t.status !== "completed").length} open items · ${tasks.filter((t) => getBucket(t) === "Overdue").length} overdue · ${tasks.filter((t) => t.callReminder).length} call reminders.`}
        actions={
          <>
            <Button
              variant="outline"
              className="rounded-md shadow-soft transition-transform duration-200 hover:-translate-y-0.5"
              onClick={() => setShowQuickCall(true)}
            >
              <PhoneCall size={17} strokeWidth={1.75} />
              Call reminder
            </Button>
            <Button
              className="gradient-primary rounded-md text-primary-foreground shadow-soft transition-transform duration-200 hover:-translate-y-0.5"
              onClick={() => setShowAddDialog(true)}
            >
              <Plus size={17} strokeWidth={2} />
              Create task
            </Button>
          </>
        }
      />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-pill border border-border bg-card p-1 shadow-soft">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`flex min-h-11 items-center gap-2 rounded-pill px-4 text-helper font-medium transition-all duration-200 ${
                view === v.id
                  ? "gradient-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <v.icon size={17} strokeWidth={1.75} />
              {v.label}
            </button>
          ))}
        </div>

        {/* Universal search input for tasks */}
        <label className="flex min-w-0 flex-1 items-center gap-3 rounded-pill border border-border bg-card px-4 py-2.5 shadow-soft sm:max-w-xs">
          <Search size={18} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
          <input
            type="search"
            aria-label="Search tasks"
            placeholder="Search tasks or assignee…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-helper outline-none"
          />
        </label>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-4">
              <div className="space-y-3">
                <div className="h-4 w-48 animate-pulse rounded bg-muted" />
                <div className="h-3 w-32 animate-pulse rounded bg-muted" />
                <div className="h-1.5 w-full animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {isError && !isLoading && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
          <p className="font-medium text-destructive">Failed to load tasks</p>
          <p className="mt-1 text-helper text-muted-foreground">
            {error instanceof Error ? error.message : "Could not connect to the server."}
          </p>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && tasks.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-16 text-center shadow-soft">
          <p className="text-title font-semibold">No tasks yet</p>
          <p className="mt-2 text-helper text-muted-foreground">
            Create your first task to get started.
          </p>
        </div>
      )}

      {/* Data */}
      {!isLoading && !isError && tasks.length > 0 && view === "kanban" ? (
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4">
          {BUCKETS.map((b) => {
            const bucketTasks = tasks.filter((t) => getBucket(t) === b);
            return (
              <div key={b} className="w-[85vw] shrink-0 snap-center rounded-lg border border-border bg-card/70 p-4 sm:w-auto">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-helper font-semibold">{b}</h2>
                  <StatusPill tone={toneForStatus(b)}>{bucketTasks.length}</StatusPill>
                </div>
                <div className="space-y-3 stagger-children">
                  {bucketTasks.map((t) => (
                    <TaskCard key={t._id} task={t} />
                  ))}
                  {bucketTasks.length === 0 && (
                    <p className="py-4 text-center text-caption text-muted-foreground">No tasks</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : !isLoading && !isError && tasks.length > 0 && view === "calendar" ? (
        <div className="space-y-6">
          {/* Calendar header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-title font-semibold">{formatMonthYear(calendarMonth)}</h2>
              <p className="text-helper text-muted-foreground">
                {tasks.filter((t) => t.deadline).length} task(s) with deadlines this month
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={prevMonth} className="rounded-md">
                <ChevronLeft size={16} />
              </Button>
              <Button variant="outline" size="sm" onClick={nextMonth} className="rounded-md">
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>

          {/* Calendar grid wrapper for mobile responsiveness */}
          <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-soft">
            <div className="min-w-[620px]">
              {/* Weekday headers */}
              <div className="grid grid-cols-7 border-b border-border bg-muted/50">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="px-2 py-3 text-center text-caption font-medium text-muted-foreground">
                    {day}
                  </div>
                ))}
              </div>

              {/* Days */}
              <div className="grid grid-cols-7">
                {calendarDays.map((day, i) => {
                  if (!day) {
                    return <div key={"empty-" + i} className="min-h-[100px] border-r border-b border-border p-2" />;
                  }
                  const dayTasks = getTasksForDay(day);
                  const isToday = day.toDateString() === new Date().toDateString();
                  return (
                    <div
                      key={day.toISOString()}
                      className={`min-h-[100px] p-2 border-r border-b border-border ${
                        isToday ? "bg-primary/5" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`num text-caption font-medium ${
                            isToday ? "text-primary font-semibold" : "text-foreground"
                          }`}
                        >
                          {day.getDate()}
                        </span>
                        {dayTasks.length > 0 && (
                          <StatusPill tone="primary" className="text-caption">
                            {dayTasks.length}
                          </StatusPill>
                        )}
                      </div>
                      <div className="space-y-1">
                        {dayTasks.slice(0, 3).map((t) => (
                          <div
                            key={t._id}
                            className="truncate text-caption px-1.5 py-0.5 rounded text-white bg-primary/80 hover:bg-primary"
                            title={t.title}
                          >
                            {t.title}
                          </div>
                        ))}
                        {dayTasks.length > 3 && (
                          <div className="text-caption text-muted-foreground px-1">
                            +{dayTasks.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : !isLoading && !isError && tasks.length > 0 ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <div className="space-y-6 stagger-children">
            {BUCKETS.map((b) => {
              const bucketTasks = tasks.filter((t) => getBucket(t) === b);
              if (bucketTasks.length === 0) return null;
              return (
                <SectionCard
                  key={b}
                  title={b}
                  description={`${bucketTasks.length} item(s)`}
                  icon={ListTodo}
                  bodyClassName="grid gap-3 sm:grid-cols-2 stagger-children"
                >
                  {bucketTasks.map((t) => (
                    <TaskCard key={t._id} task={t} />
                  ))}
                </SectionCard>
              );
            })}
          </div>

          {/* Call reminders sidebar */}
          <SectionCard title="Call reminders" description="Scheduled client calls." icon={PhoneCall}>
            {tasks.filter((t) => t.callReminder).length > 0 ? (
              <ul className="space-y-3">
                {tasks
                  .filter((t) => t.callReminder)
                  .map((t) => (
                    <li
                      key={t._id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-border p-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{t.callReminder!.clientName}</p>
                        <p className="num truncate text-caption text-muted-foreground">
                          {t.callReminder!.phone}
                        </p>
                        <p className="num mt-0.5 text-caption text-muted-foreground">
                          {new Date(t.callReminder!.scheduledAt).toLocaleDateString("en-IN", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <StatusPill tone={t.callReminder!.completed ? "success" : "warning"}>
                        {t.callReminder!.completed ? "Done" : "Pending"}
                      </StatusPill>
                    </li>
                  ))}
              </ul>
            ) : (
              <div className="py-8 text-center text-helper text-muted-foreground">
                <PhoneCall size={28} strokeWidth={1.5} className="mx-auto mb-2 opacity-40" />
                <p>No call reminders</p>
                <p className="mt-1 text-caption">Add a call reminder when creating a task.</p>
              </div>
            )}
          </SectionCard>
        </div>
      ) : null}

      <AddTaskDialog open={showAddDialog} onClose={() => setShowAddDialog(false)} />
      <QuickCallDialog open={showQuickCall} onClose={() => setShowQuickCall(false)} />
    </div>
  );
}
