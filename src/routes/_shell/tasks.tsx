import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { Plus, PhoneCall, ListTodo, CalendarDays, CheckCircle2, Circle, Clock, Loader2, ChevronLeft, ChevronRight, Search, Briefcase, Filter, X, SlidersHorizontal, UserCheck, AlertCircle, Check, Edit2, PhoneForwarded } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/common/Surface";
import { StatusPill, toneForStatus } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useQueryClient } from "@tanstack/react-query";
import { useSocketEvent } from "@/lib/socket";
import { useTasks, useUpdateTask, useToggleChecklistItem, taskKeys, type TaskRecord } from "@/services/tasks";
import { useEmployees } from "@/services/admin";
import { AddTaskDialog } from "@/components/tasks/AddTaskDialog";
import { QuickCallDialog } from "@/components/tasks/QuickCallDialog";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import { EditCallDialog } from "@/components/tasks/EditCallDialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_shell/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks · S & S Legal-Tech LLP" },
      {
        name: "description",
        content: "A calm reminders-style task list: overdue, due today, upcoming and call reminders.",
      },
      { property: "og:title", content: "Tasks · S & S Legal-Tech LLP" },
      {
        property: "og:description",
        content: "Overdue, due today, upcoming work and call reminders in one calm list.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { taskId?: string; search?: string } => ({
    ...(typeof search["taskId"] === "string" ? { taskId: search["taskId"] } : {}),
    ...(typeof search["search"] === "string" ? { search: search["search"] } : {}),
  }),
  component: TasksPage,
});

const BUCKETS = ["Overdue", "Due Today", "Upcoming", "In Review", "Completed"] as const;
const VIEWS = [
  { id: "list", label: "List", icon: ListTodo },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
];

function getBucket(task: TaskRecord): string {
  if (task.status === "completed") return "Completed";
  if (task.status === "pending_approval") return "In Review";
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

function getTaskCaseDisplay(task: TaskRecord): string | null {
  if (task.caseId && typeof task.caseId === "object") {
    const c = task.caseId as { _id?: string; title?: string; number?: string };
    const text = c.number ? `${c.number} — ${c.title}` : c.title;
    return text || null;
  }
  return task.caseName ?? null;
}

function TaskCard({ task, onSelect }: { task: TaskRecord; onSelect?: (task: TaskRecord) => void }) {
  const toggleChecklist = useToggleChecklistItem();
  const total = task.checklist?.length ?? 0;
  const done = task.checklist?.filter((c) => c.done).length ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const caseTitle = getTaskCaseDisplay(task);

  return (
    <article
      onClick={() => onSelect?.(task)}
      className={`lift card-hover pressable rounded-md border p-4 cursor-pointer transition-all duration-150 hover:border-primary/40 ${
        task.isCall ? "border-violet-500/30 bg-violet-500/5" : "border-border bg-card"
      }`}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{task.title}</p>
            {task.status === "pending_approval" && (
              <span className="shrink-0 rounded-pill bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 text-[10px] font-bold">
                IN REVIEW
              </span>
            )}
            {task.status === "completed" && (
              <span className="shrink-0 rounded-pill bg-success/15 text-success px-2 py-0.5 text-[10px] font-bold">
                COMPLETED
              </span>
            )}
          </div>
          <div className="truncate text-caption text-muted-foreground flex items-center gap-1.5 mt-0.5">
            {caseTitle ? (
              <>
                <Briefcase size={12} className="shrink-0 text-primary/80" />
                <span className="truncate font-medium text-foreground/80">{caseTitle}</span>
              </>
            ) : (
              <span className="truncate">{task.description || "No case linked"}</span>
            )}
          </div>
        </div>
        <StatusPill tone={toneForStatus(task.priority)}>{task.priority}</StatusPill>
      </div>

      {/* Checklist preview */}
      {total > 0 && (
        <div className="mt-3 space-y-1">
          {task.checklist.slice(0, 3).map((item, idx) => {
            const effectiveItemId = item._id || (item as any).id || String(idx);
            const toggle = (e: React.MouseEvent) => {
              e.stopPropagation();
              toggleChecklist.mutate({
                taskId: task._id,
                itemId: effectiveItemId,
                done: !item.done,
              });
            };
            return (
              <button
                type="button"
                key={effectiveItemId || item.text}
                onClick={toggle}
                className="flex w-full items-center gap-2 rounded text-helper transition-colors hover:bg-muted/50 disabled:cursor-default disabled:opacity-60 text-left"
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
            <p
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.(task);
              }}
              className="pl-7 text-caption text-muted-foreground hover:text-primary transition-colors cursor-pointer font-medium"
            >
              +{total - 3} more items — click to view
            </p>
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
  const routeSearch = Route.useSearch();
  const [view, setView] = useState("list");
  const [search, setSearch] = useState(routeSearch.search ?? "");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [priorityFilter, setPriorityFilter] = useState<string>("All");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(24);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showQuickCall, setShowQuickCall] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null);
  const [editingCallTask, setEditingCallTask] = useState<TaskRecord | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const queryClient = useQueryClient();
  const updateTask = useUpdateTask();

  const handleToggleCallDone = async (e: React.MouseEvent, t: TaskRecord) => {
    e.stopPropagation();
    const cr = t.callReminder;
    const nextCompleted = !Boolean(cr?.completed || t.status === "completed");
    try {
      await updateTask.mutateAsync({
        id: t._id,
        data: {
          status: nextCompleted ? "completed" : "pending",
          callReminder: {
            clientName: cr?.clientName || t.title,
            phone: cr?.phone || "",
            scheduledAt: cr?.scheduledAt || new Date().toISOString(),
            notes: cr?.notes || "",
            completed: nextCompleted,
          },
        },
      });
      toast.success(nextCompleted ? "Call marked as completed!" : "Call marked as pending");
    } catch {
      toast.error("Failed to update call status");
    }
  };

  const apiFilters = useMemo(() => {
    const f: Record<string, string> = {
      page: String(page),
      limit: String(limit),
    };
    if (search.trim()) f["search"] = search.trim();
    if (statusFilter !== "All") {
      if (statusFilter === "overdue") f["overdue"] = "true";
      else if (statusFilter === "due_today") f["dueToday"] = "true";
      else if (statusFilter === "in_progress") f["status"] = "in_progress,pending";
      else if (statusFilter === "in_review") f["status"] = "pending_approval";
      else if (statusFilter === "completed") f["status"] = "completed";
      else if (statusFilter === "calls") f["isCall"] = "true";
      else f["status"] = statusFilter;
    }
    if (priorityFilter !== "All") f["priority"] = priorityFilter;
    if (categoryFilter !== "All") f["category"] = categoryFilter;
    if (selectedStaff.length > 0) f["assignedTo"] = selectedStaff.join(",");
    if (dueFrom) f["dueFrom"] = dueFrom;
    if (dueTo) f["dueTo"] = dueTo;
    return f;
  }, [page, limit, search, statusFilter, priorityFilter, categoryFilter, selectedStaff, dueFrom, dueTo]);

  const { data, isLoading, isError, error } = useTasks(apiFilters);
  const { data: empData } = useEmployees();
  const employees = empData?.employees ?? [];

  useSocketEvent("task:created", () => {
    queryClient.invalidateQueries({ queryKey: taskKeys.all });
  });
  useSocketEvent("task:updated", () => {
    queryClient.invalidateQueries({ queryKey: taskKeys.all });
  });
  useSocketEvent<{ taskId: string }>("task:deleted", (payload) => {
    queryClient.invalidateQueries({ queryKey: taskKeys.all });
    if (payload?.taskId && selectedTask?._id === payload.taskId) {
      setSelectedTask(null);
    }
  });

  const allTasks = data?.tasks ?? [];

  // Deep linking: auto-open task dialog if taskId matches URL param
  useEffect(() => {
    if (routeSearch.taskId && allTasks.length > 0) {
      const matched = allTasks.find((t) => t._id === routeSearch.taskId);
      if (matched) {
        setSelectedTask(matched);
      }
    }
  }, [routeSearch.taskId, allTasks]);

  // Keep selectedTask in sync with latest queryClient/allTasks data
  useEffect(() => {
    if (selectedTask?._id && allTasks.length > 0) {
      const updated = allTasks.find((t) => t._id === selectedTask._id);
      if (updated && updated !== selectedTask) {
        setSelectedTask(updated);
      }
    }
  }, [allTasks, selectedTask?._id]);

  // Unique categories
  const categories = useMemo(() => {
    const set = new Set<string>(["Court Case", "Agreement", "CIDCO", "Property / RERA", "Due Diligence", "Other Work"]);
    for (const t of allTasks) {
      if (t.category) set.add(t.category);
    }
    return Array.from(set);
  }, [allTasks]);

  // Stat card counts from backend aggregation with fallback
  const stats = useMemo(() => {
    if (data?.stats) return data.stats;
    const total = allTasks.length;
    const overdue = allTasks.filter((t) => getBucket(t) === "Overdue" && t.status !== "completed").length;
    const dueToday = allTasks.filter((t) => getBucket(t) === "Due Today" && t.status !== "completed").length;
    const inProgress = allTasks.filter((t) => t.status === "in_progress" || t.status === "pending").length;
    const inReview = allTasks.filter((t) => t.status === "pending_approval").length;
    const completed = allTasks.filter((t) => t.status === "completed").length;
    const calls = allTasks.filter((t) => t.isCall || Boolean(t.callReminder)).length;
    return { total, overdue, dueToday, inProgress, inReview, completed, calls };
  }, [data?.stats, allTasks]);

  const tasks = allTasks;

  const toggleStaff = (idOrName: string) => {
    setSelectedStaff((prev) =>
      prev.includes(idOrName) ? prev.filter((s) => s !== idOrName) : [...prev, idOrName]
    );
  };

  const totalItems = data?.total ?? allTasks.length;
  const totalPages = data?.totalPages ?? 1;

  const clearAllFilters = () => {
    setSearch("");
    setStatusFilter("All");
    setPriorityFilter("All");
    setCategoryFilter("All");
    setSelectedStaff([]);
    setDueFrom("");
    setDueTo("");
    setPage(1);
  };

  const activeFilterCount =
    (statusFilter !== "All" ? 1 : 0) +
    (priorityFilter !== "All" ? 1 : 0) +
    (categoryFilter !== "All" ? 1 : 0) +
    (dueFrom ? 1 : 0) +
    (dueTo ? 1 : 0) +
    selectedStaff.length +
    (search.trim() ? 1 : 0);

  // Calendar helpers
  const calendarDays = useMemo(() => {
    const month = calendarMonth.getMonth();
    const year = calendarMonth.getFullYear();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay(); // 0 = Sunday
    const daysInMonth = lastDay.getDate();

    const days: (Date | null)[] = [];
    for (let i = 0; i < startDay; i++) days.push(null);
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
        breadcrumb={[{ label: "S & S", to: "/" }, { label: "Tasks" }]}
        title="Tasks"
        subtitle={`${tasks.length} items visible · ${stats.overdue} overdue · ${stats.calls} call reminders.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="rounded-md shadow-soft transition-transform duration-200 hover:-translate-y-0.5 text-xs sm:text-helper"
              onClick={() => setShowQuickCall(true)}
            >
              <PhoneCall size={16} strokeWidth={1.75} />
              <span>Call reminder</span>
            </Button>
            <Button
              className="gradient-primary rounded-md text-primary-foreground shadow-soft transition-transform duration-200 hover:-translate-y-0.5 text-xs sm:text-helper"
              onClick={() => setShowAddDialog(true)}
            >
              <Plus size={16} strokeWidth={2} />
              <span>Create task</span>
            </Button>
          </div>
        }
      />

      {/* ── Interactive Stat Cards (Clickable quick filters) ── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "All" ? "All" : "All")}
          className={`lift flex flex-col items-start rounded-xl border p-3.5 text-left transition-all duration-150 ${
            statusFilter === "All"
              ? "border-primary bg-primary/10 shadow-sm"
              : "border-border bg-card hover:border-primary/40"
          }`}
        >
          <span className="text-caption font-medium text-muted-foreground">All Tasks</span>
          <span className="num mt-1 text-section font-bold">{stats.total}</span>
          <span className="mt-1 text-[11px] text-muted-foreground">All workspace items</span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "overdue" ? "All" : "overdue")}
          className={`lift flex flex-col items-start rounded-xl border p-3.5 text-left transition-all duration-150 ${
            statusFilter === "overdue"
              ? "border-destructive bg-destructive/10 shadow-sm"
              : "border-border bg-card hover:border-destructive/40"
          }`}
        >
          <span className="text-caption font-medium text-destructive">Overdue</span>
          <span className="num mt-1 text-section font-bold text-destructive">{stats.overdue}</span>
          <span className="mt-1 text-[11px] text-muted-foreground">Passed deadline</span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "due_today" ? "All" : "due_today")}
          className={`lift flex flex-col items-start rounded-xl border p-3.5 text-left transition-all duration-150 ${
            statusFilter === "due_today"
              ? "border-amber-500 bg-amber-500/10 shadow-sm"
              : "border-border bg-card hover:border-amber-500/40"
          }`}
        >
          <span className="text-caption font-medium text-amber-600 dark:text-amber-400">Due Today</span>
          <span className="num mt-1 text-section font-bold text-amber-600 dark:text-amber-400">{stats.dueToday}</span>
          <span className="mt-1 text-[11px] text-muted-foreground">Needs attention</span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "in_progress" ? "All" : "in_progress")}
          className={`lift flex flex-col items-start rounded-xl border p-3.5 text-left transition-all duration-150 ${
            statusFilter === "in_progress"
              ? "border-indigo-500 bg-indigo-500/10 shadow-sm"
              : "border-border bg-card hover:border-indigo-500/40"
          }`}
        >
          <span className="text-caption font-medium text-indigo">In Progress</span>
          <span className="num mt-1 text-section font-bold text-indigo">{stats.inProgress}</span>
          <span className="mt-1 text-[11px] text-muted-foreground">Currently open</span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "completed" ? "All" : "completed")}
          className={`lift flex flex-col items-start rounded-xl border p-3.5 text-left transition-all duration-150 ${
            statusFilter === "completed"
              ? "border-success bg-success/10 shadow-sm"
              : "border-border bg-card hover:border-success/40"
          }`}
        >
          <span className="text-caption font-medium text-success">Completed</span>
          <span className="num mt-1 text-section font-bold text-success">{stats.completed}</span>
          <span className="mt-1 text-[11px] text-muted-foreground">Marked done</span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "calls" ? "All" : "calls")}
          className={`lift flex flex-col items-start rounded-xl border p-3.5 text-left transition-all duration-150 ${
            statusFilter === "calls"
              ? "border-violet bg-violet/10 shadow-sm"
              : "border-border bg-card hover:border-violet/40"
          }`}
        >
          <span className="text-caption font-medium text-violet">Call Reminders</span>
          <span className="num mt-1 text-section font-bold text-violet">{stats.calls}</span>
          <span className="mt-1 text-[11px] text-muted-foreground">Client calls</span>
        </button>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-pill border border-border bg-card p-1 shadow-soft">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={`flex min-h-9 sm:min-h-10 items-center gap-1.5 sm:gap-2 rounded-pill px-2.5 sm:px-3.5 text-xs sm:text-helper font-medium transition-all duration-200 ${
                  view === v.id
                    ? "gradient-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <v.icon size={15} strokeWidth={1.75} />
                <span>{v.label}</span>
              </button>
            ))}
          </div>

          <Button
            variant={showFilterPanel || activeFilterCount > 0 ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className="h-10 gap-2 rounded-pill px-4 text-xs font-medium"
          >
            <SlidersHorizontal size={14} />
            Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
          </Button>

          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-10 text-xs text-muted-foreground hover:text-destructive"
            >
              <X size={14} className="mr-1" /> Clear all
            </Button>
          )}
        </div>

        {/* Universal search input for tasks */}
        <label className="flex min-w-0 flex-1 items-center gap-2.5 rounded-pill border border-border bg-card px-4 py-2 shadow-soft sm:max-w-sm">
          <Search size={16} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
          <input
            type="search"
            aria-label="Search tasks"
            placeholder="Search title, client, category, staff…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="min-w-0 flex-1 bg-transparent text-helper outline-none"
          />
          {search && (
            <button
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </label>
      </div>

      {/* ── Expandable Filter Panel ── */}
      {showFilterPanel && (
        <div className="mb-6 rounded-xl border border-border bg-card/95 p-4 shadow-soft backdrop-blur-md animate-in fade-in-50 slide-in-from-top-2">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {/* Status Filter */}
            <div>
              <label className="mb-1.5 block text-caption font-semibold text-muted-foreground">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-xs outline-none focus:border-primary"
              >
                <option value="All">All Statuses</option>
                <option value="in_progress">Pending / In Progress</option>
                <option value="in_review">In Review (Approval)</option>
                <option value="overdue">Overdue</option>
                <option value="due_today">Due Today</option>
                <option value="completed">Completed</option>
                <option value="calls">Call Reminders Only</option>
              </select>
            </div>

            {/* Priority Filter */}
            <div>
              <label className="mb-1.5 block text-caption font-semibold text-muted-foreground">Priority</label>
              <select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value);
                  setPage(1);
                }}
                className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-xs outline-none focus:border-primary"
              >
                <option value="All">All Priorities</option>
                <option value="High">High Priority</option>
                <option value="Medium">Medium Priority</option>
                <option value="Low">Low Priority</option>
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label className="mb-1.5 block text-caption font-semibold text-muted-foreground">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-xs outline-none focus:border-primary"
              >
                <option value="All">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Due Date Range */}
            <div>
              <label className="mb-1.5 block text-caption font-semibold text-muted-foreground">Due From</label>
              <input
                type="date"
                value={dueFrom}
                onChange={(e) => {
                  setDueFrom(e.target.value);
                  setPage(1);
                }}
                className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-xs outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-caption font-semibold text-muted-foreground">Due To</label>
              <input
                type="date"
                value={dueTo}
                onChange={(e) => {
                  setDueTo(e.target.value);
                  setPage(1);
                }}
                className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-xs outline-none focus:border-primary"
              />
            </div>

            {/* Staff Multi-Select Filter */}
            <div>
              <label className="mb-1.5 block text-caption font-semibold text-muted-foreground">
                Assigned Staff ({selectedStaff.length} selected)
              </label>
              <div className="max-h-28 overflow-y-auto rounded-md border border-border bg-background p-2 space-y-1.5 text-xs">
                {employees.length === 0 ? (
                  <span className="text-muted-foreground italic">No staff members found</span>
                ) : (
                  employees.map((emp) => {
                    const checked = selectedStaff.includes(emp._id) || selectedStaff.includes(emp.name);
                    return (
                      <label key={emp._id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            toggleStaff(emp._id);
                            setPage(1);
                          }}
                          className="rounded border-border"
                        />
                        <span className="truncate">{emp.name}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
      {!isLoading && !isError && tasks.length > 0 && view === "calendar" ? (
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
          <div className="overflow-x-auto touch-scroll rounded-lg border border-border bg-card shadow-soft">
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
                            onClick={() => setSelectedTask(t)}
                            className="truncate text-caption px-1.5 py-0.5 rounded text-white bg-primary/80 hover:bg-primary cursor-pointer transition-colors"
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
                    <TaskCard key={t._id} task={t} onSelect={setSelectedTask} />
                  ))}
                </SectionCard>
              );
            })}
          </div>

          {/* Call reminders sidebar */}
          <SectionCard
            title="Call reminders"
            description="Scheduled client calls."
            icon={PhoneCall}
            action={
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs rounded-pill"
                onClick={() => setShowQuickCall(true)}
              >
                <Plus size={12} className="mr-1" /> Add Call
              </Button>
            }
          >
            {tasks.filter((t) => t.callReminder || t.isCall).length > 0 ? (
              <ul className="space-y-2.5">
                {tasks
                  .filter((t) => t.callReminder || t.isCall)
                  .map((t) => {
                    const cr = t.callReminder;
                    const isDone = Boolean(cr?.completed || t.status === "completed");
                    const clientName = cr?.clientName || t.title.replace(/^📞\s*CALL:\s*/i, "");
                    const phone = cr?.phone || "";
                    const schedTime = cr?.scheduledAt || t.deadline;

                    return (
                      <li
                        key={t._id}
                        onClick={() => setEditingCallTask(t)}
                        className={`group relative flex flex-col gap-2 rounded-lg border p-3.5 transition-all cursor-pointer ${
                          isDone
                            ? "border-border/60 bg-muted/20 opacity-75 hover:opacity-100 hover:border-border"
                            : "border-border bg-card shadow-soft hover:border-amber-500/40 hover:shadow-md"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <button
                              type="button"
                              onClick={(e) => handleToggleCallDone(e, t)}
                              className="mt-0.5 shrink-0 rounded-full p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                              title={isDone ? "Mark as pending" : "Mark as completed"}
                            >
                              {isDone ? (
                                <CheckCircle2 size={17} className="text-emerald-500 fill-emerald-500/20" />
                              ) : (
                                <Circle size={17} className="hover:text-amber-500" />
                              )}
                            </button>
                            <div className="min-w-0">
                              <p
                                className={`truncate font-medium text-sm ${
                                  isDone ? "line-through text-muted-foreground" : "text-foreground"
                                }`}
                              >
                                {clientName}
                              </p>
                              {phone && (
                                <p className="font-mono text-xs text-muted-foreground">
                                  {phone}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <StatusPill tone={isDone ? "success" : "warning"}>
                              {isDone ? "Done" : "Pending"}
                            </StatusPill>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="size-7 p-0 rounded-full text-muted-foreground hover:text-foreground"
                              onClick={() => setEditingCallTask(t)}
                              title="Edit call reminder"
                            >
                              <Edit2 size={12} />
                            </Button>
                            {phone && (
                              <a
                                href={`tel:${phone}`}
                                className="grid size-7 place-items-center rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                                title="Call now"
                              >
                                <PhoneCall size={11} />
                              </a>
                            )}
                          </div>
                        </div>

                        {schedTime && (
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground border-t border-border/40 pt-1.5 mt-0.5">
                            <Clock size={11} />
                            <span>
                              {new Date(schedTime).toLocaleDateString("en-IN", {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            {cr?.notes && (
                              <span className="truncate italic ml-1">
                                · {cr.notes}
                              </span>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
              </ul>
            ) : (
              <div className="py-8 text-center text-helper text-muted-foreground">
                <PhoneCall size={28} strokeWidth={1.5} className="mx-auto mb-2 opacity-40" />
                <p>No call reminders</p>
                <p className="mt-1 text-caption">Add a call reminder using Quick Call or when creating a task.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 text-xs rounded-pill"
                  onClick={() => setShowQuickCall(true)}
                >
                  <Plus size={12} className="mr-1" /> Add Call Reminder
                </Button>
              </div>
            )}
          </SectionCard>
        </div>
      ) : null}

      {totalItems > 0 && (
        <div className="mt-6 flex flex-col items-center justify-between gap-4 border-t border-border pt-4 sm:flex-row">
          <p className="flex items-center gap-2 text-helper text-muted-foreground">
            <ListTodo size={16} strokeWidth={1.75} />
            Showing {Math.min((page - 1) * limit + 1, totalItems)}–{Math.min(page * limit, totalItems)} of {totalItems} tasks
          </p>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Rows:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="h-8 rounded border border-border bg-background px-2 text-xs"
              >
                <option value={12}>12</option>
                <option value={24}>24</option>
                <option value={48}>48</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-8 w-8 p-0"
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
              </Button>
              <span className="px-2 text-xs font-medium text-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="h-8 w-8 p-0"
                aria-label="Next page"
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        </div>
      )}

      <AddTaskDialog open={showAddDialog} onClose={() => setShowAddDialog(false)} />
      <QuickCallDialog open={showQuickCall} onClose={() => setShowQuickCall(false)} />
      <TaskDetailDialog
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        task={selectedTask}
      />
      <EditCallDialog
        open={Boolean(editingCallTask)}
        onClose={() => setEditingCallTask(null)}
        task={editingCallTask}
      />
    </div>
  );
}
