import { useState, useMemo } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Briefcase,
  CheckSquare,
  Calendar,
  MessageSquare,
  ChevronRight,
  ChevronDown,
  Loader2,
  CalendarDays,
} from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { formatSafeDate } from "@/lib/dates";
import { EmployeeAvatar } from "@/components/admin/EmployeeAvatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TaskRecord } from "@/services/tasks";
import type { CaseRecord } from "@/services/cases";
import { cn } from "@/lib/utils";

export interface PendingItem {
  id: string;
  type: "task" | "case";
  title: string;
  description?: string;
  notesCount: number;
  caseNumber?: string;
  clientName?: string;
  assignedTo?: {
    name: string;
    role?: string;
    avatarUrl?: string;
  };
  assignedBy?: {
    name: string;
    role?: string;
    avatarUrl?: string;
  };
  deadline: string | null;
  priority: "High" | "Medium" | "Low";
  status: "Overdue" | "Pending" | "In Progress" | "In Review" | "Active" | "Urgent";
  isOverdue: boolean;
  updatedAt: string;
  rawTask?: TaskRecord;
  rawCase?: CaseRecord;
}

type TabKey = "all" | "overdue" | "tasks" | "cases";
type SortKey = "deadline_earliest" | "deadline_latest" | "priority_high" | "recently_updated";

const SORT_LABELS: Record<SortKey, string> = {
  deadline_earliest: "Deadline (Earliest)",
  deadline_latest: "Deadline (Latest)",
  priority_high: "Priority (High to Low)",
  recently_updated: "Recently Updated",
};

interface PendingCasesAndTasksSectionProps {
  tasks: TaskRecord[];
  cases: CaseRecord[];
  isLoading?: boolean;
  onSelectTask: (task: TaskRecord) => void;
}

export function PendingCasesAndTasksSection({
  tasks,
  cases,
  isLoading = false,
  onSelectTask,
}: PendingCasesAndTasksSectionProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [sortKey, setSortKey] = useState<SortKey>("deadline_earliest");

  const today = useMemo(() => new Date(), []);

  // Compute unified pending items
  const items: PendingItem[] = useMemo(() => {
    const list: PendingItem[] = [];

    // 1. Process tasks that are not completed
    for (const t of tasks) {
      if (t.status === "completed") continue;

      const isOverdue = Boolean(
        t.status !== "pending_approval" &&
        (t.status === "overdue" ||
          (t.deadline && new Date(t.deadline).getTime() < today.getTime())),
      );

      const assignedToUser = typeof t.assignedTo === "object" ? t.assignedTo : undefined;
      const creatorObj =
        typeof (t as Record<string, unknown>).createdBy === "object"
          ? ((t as Record<string, unknown>).createdBy as {
              name?: string;
              title?: string;
              role?: string;
            })
          : undefined;
      const assignedByUser =
        typeof t.assignedBy === "object" && t.assignedBy ? t.assignedBy : creatorObj;

      const caseNumber = typeof t.caseId === "object" && t.caseId ? t.caseId.number : t.caseName;
      const clientName =
        t.clientName ||
        (typeof t.clientId === "object" && t.clientId ? t.clientId.name : undefined);

      const notesCount = (t.remarks?.length ?? 0) + (t.notes ? 1 : 0);

      const statusDisplay: PendingItem["status"] = isOverdue
        ? "Overdue"
        : t.status === "in_progress"
          ? "In Progress"
          : t.status === "pending_approval"
            ? "In Review"
            : "Pending";

      list.push({
        id: `task_${t._id}`,
        type: "task",
        title: t.title,
        description: t.description,
        notesCount,
        caseNumber,
        clientName,
        assignedTo: assignedToUser
          ? {
              name: assignedToUser.name,
              role: assignedToUser.title || assignedToUser.role || "Advocate",
              avatarUrl: assignedToUser.avatarUrl || assignedToUser.avatar,
            }
          : undefined,
        assignedBy: assignedByUser?.name
          ? {
              name: assignedByUser.name,
              role:
                (assignedByUser as { title?: string; role?: string }).title ||
                (assignedByUser as { title?: string; role?: string }).role,
            }
          : undefined,
        deadline: t.deadline,
        priority: t.priority || "Medium",
        status: statusDisplay,
        isOverdue,
        updatedAt:
          ((t as unknown as Record<string, unknown>).updatedAt as string) ||
          ((t as unknown as Record<string, unknown>).createdAt as string) ||
          new Date().toISOString(),
        rawTask: t,
      });
    }

    // 2. Process open cases
    for (const c of cases) {
      if (c.status === "Closed" || c.status === "Archived") continue;

      const isOverdue = Boolean(
        c.nextHearing && new Date(c.nextHearing).getTime() < today.getTime(),
      );

      const clientParty = c.parties?.find((p) => p.type === "client");
      const clientName = clientParty?.name;
      const assignedToUser = typeof c.assignedTo === "object" ? c.assignedTo : undefined;
      const assignedByUser = typeof c.assignedBy === "object" ? c.assignedBy : c.createdBy;

      const notesCount = c.notes?.length ?? 0;

      list.push({
        id: `case_${c._id}`,
        type: "case",
        title: c.title,
        description: c.description || `${c.practice || "Legal"} · ${c.court || "Court"}`,
        notesCount,
        caseNumber: c.number || c.courtCaseId || "CASE",
        clientName,
        assignedTo: assignedToUser
          ? {
              name: assignedToUser.name,
              role: assignedToUser.title || assignedToUser.role || "Lead Counsel",
              avatarUrl: assignedToUser.avatarUrl || assignedToUser.avatar,
            }
          : undefined,
        assignedBy: assignedByUser?.name
          ? {
              name: assignedByUser.name,
              role:
                (assignedByUser as { title?: string; role?: string }).title ||
                (assignedByUser as { title?: string; role?: string }).role,
            }
          : undefined,
        deadline: c.nextHearing || null,
        priority: c.priority || "Medium",
        status: isOverdue ? "Overdue" : c.status === "Urgent" ? "Urgent" : "Active",
        isOverdue,
        updatedAt: c.updatedAt || c.createdAt || new Date().toISOString(),
        rawCase: c,
      });
    }

    return list;
  }, [tasks, cases, today]);

  // Counts for tabs
  const overdueCount = useMemo(() => items.filter((i) => i.isOverdue).length, [items]);
  const pendingTasksCount = useMemo(() => items.filter((i) => i.type === "task").length, [items]);
  const pendingCasesCount = useMemo(() => items.filter((i) => i.type === "case").length, [items]);

  // Filtered by tab
  const filteredItems = useMemo(() => {
    let result = items;
    if (activeTab === "overdue") {
      result = items.filter((i) => i.isOverdue);
    } else if (activeTab === "tasks") {
      result = items.filter((i) => i.type === "task");
    } else if (activeTab === "cases") {
      result = items.filter((i) => i.type === "case");
    }

    // Sort items
    const priorityWeight: Record<string, number> = { High: 3, Medium: 2, Low: 1 };

    return [...result].sort((a, b) => {
      if (sortKey === "deadline_earliest") {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      if (sortKey === "deadline_latest") {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(b.deadline).getTime() - new Date(a.deadline).getTime();
      }
      if (sortKey === "priority_high") {
        return (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
      }
      if (sortKey === "recently_updated") {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      return 0;
    });
  }, [items, activeTab, sortKey]);

  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/40">
            <AlertTriangle size={18} strokeWidth={2} />
          </span>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-foreground">
              Pending Cases & Tasks
            </h2>
            <p className="text-xs text-muted-foreground">
              Items that are overdue or pending action
            </p>
          </div>
        </div>
        <Link
          to="/tasks"
          className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 transition-colors self-start sm:self-auto"
        >
          View all <ArrowRight size={13} strokeWidth={2} />
        </Link>
      </div>

      {/* Tabs & Sort Controls */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-lg bg-muted/40 border border-border/50 self-start">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer",
              activeTab === "all"
                ? "bg-card text-foreground shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            All <span className="text-[11px] opacity-75">({items.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("overdue")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer",
              activeTab === "overdue"
                ? "bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 shadow-xs border border-rose-200/60 dark:border-rose-800/50"
                : "text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400",
            )}
          >
            <AlertTriangle size={13} className="text-rose-600 dark:text-rose-400" />
            Overdue <span className="text-[11px] opacity-85">({overdueCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("tasks")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer",
              activeTab === "tasks"
                ? "bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 shadow-xs border border-amber-200/60 dark:border-amber-800/50"
                : "text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400",
            )}
          >
            <CheckSquare size={13} className="text-amber-600 dark:text-amber-400" />
            Pending Tasks <span className="text-[11px] opacity-85">({pendingTasksCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("cases")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer",
              activeTab === "cases"
                ? "bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 shadow-xs border border-blue-200/60 dark:border-blue-800/50"
                : "text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400",
            )}
          >
            <Briefcase size={13} className="text-blue-600 dark:text-blue-400" />
            Pending Cases <span className="text-[11px] opacity-85">({pendingCasesCount})</span>
          </button>
        </div>

        {/* Sort dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-lg border-border/70 text-xs font-medium text-foreground self-start sm:self-auto"
            >
              <span className="text-muted-foreground">Sort by:</span> {SORT_LABELS[sortKey]}
              <ChevronDown size={14} className="text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 text-xs">
            {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
              <DropdownMenuItem
                key={key}
                onClick={() => setSortKey(key)}
                className={cn(
                  "cursor-pointer text-xs",
                  sortKey === key && "font-semibold text-primary",
                )}
              >
                {SORT_LABELS[key]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Main Table / Horizontal Cards */}
      <div className="mt-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-muted-foreground" size={24} />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center rounded-lg border border-dashed border-border/70 bg-muted/20">
            <p className="text-sm font-semibold text-foreground">No pending items found</p>
            <p className="mt-1 text-xs text-muted-foreground">All caught up in this view!</p>
          </div>
        ) : (
          <div className="w-full">
            {/* Desktop View (>= xl) */}
            <div className="hidden xl:block space-y-2">
              {filteredItems.map((item) => {
                let deadlineSubtitle = "";
                if (item.deadline) {
                  const deadlineDate = new Date(item.deadline);
                  if (!isNaN(deadlineDate.getTime())) {
                    const diffDays = Math.ceil(
                      (deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
                    );
                    if (diffDays < 0) {
                      deadlineSubtitle = `${Math.abs(diffDays)} days overdue`;
                    } else if (diffDays === 0) {
                      deadlineSubtitle = "Due today";
                    } else {
                      deadlineSubtitle = `${diffDays} days left`;
                    }
                  }
                }

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (item.type === "task" && item.rawTask) {
                        onSelectTask(item.rawTask);
                      } else if (item.type === "case" && item.rawCase) {
                        navigate({ to: "/cases/$caseId", params: { caseId: item.rawCase._id } });
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (item.type === "task" && item.rawTask) {
                          onSelectTask(item.rawTask);
                        } else if (item.type === "case" && item.rawCase) {
                          navigate({ to: "/cases/$caseId", params: { caseId: item.rawCase._id } });
                        }
                      }
                    }}
                    className="group grid grid-cols-[70px_minmax(180px,1.4fr)_140px_130px_120px_110px_75px_95px_32px] items-center gap-2.5 rounded-lg border border-border/60 bg-background/50 hover:bg-muted/40 px-3.5 py-3 transition-all duration-150 hover:border-primary/40 cursor-pointer text-xs"
                  >
                    {/* 1. Type badge */}
                    <div>
                      {item.type === "task" ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase",
                            item.isOverdue
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40",
                          )}
                        >
                          TASK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40 px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase">
                          CASE
                        </span>
                      )}
                    </div>

                    {/* 2. Title & Description & Notes count */}
                    <div className="min-w-0 pr-2">
                      <p className="truncate font-semibold text-foreground group-hover:text-primary transition-colors">
                        {item.title}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        {item.description && (
                          <span className="truncate max-w-[180px]">{item.description}</span>
                        )}
                        {item.notesCount > 0 && (
                          <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.2 text-[10px] font-medium text-foreground/80 shrink-0">
                            <MessageSquare size={11} className="text-muted-foreground" />
                            {item.notesCount} {item.notesCount === 1 ? "note" : "notes"}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 3. Case / Client */}
                    <div className="min-w-0">
                      {item.caseNumber && (
                        <span className="rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/40 px-1.5 py-0.5 font-mono text-[10px] font-semibold">
                          {item.caseNumber}
                        </span>
                      )}
                      <p className="mt-1 truncate font-medium text-foreground/90 text-[11px]">
                        {item.clientName || "—"}
                      </p>
                    </div>

                    {/* 4. Assigned To */}
                    <div className="flex items-center gap-2 min-w-0">
                      <EmployeeAvatar
                        name={item.assignedTo?.name || "Unassigned"}
                        avatarUrl={item.assignedTo?.avatarUrl}
                        size="xs"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground text-[11px] leading-tight">
                          {item.assignedTo?.name || "Unassigned"}
                        </p>
                        <p className="truncate text-muted-foreground text-[10px] leading-tight">
                          {item.assignedTo?.role || "Team"}
                        </p>
                      </div>
                    </div>

                    {/* 5. Deadline */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 font-medium text-foreground text-[11px]">
                        <Calendar size={12} className="text-muted-foreground shrink-0" />
                        <span>{formatSafeDate(item.deadline, "No date")}</span>
                      </div>
                      {deadlineSubtitle && (
                        <p
                          className={cn(
                            "mt-0.5 text-[10px] font-semibold truncate",
                            item.isOverdue
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-amber-600 dark:text-amber-400",
                          )}
                        >
                          {deadlineSubtitle}
                        </p>
                      )}
                    </div>

                    {/* 6. Assigned By */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      {item.assignedBy?.name ? (
                        <>
                          <EmployeeAvatar
                            name={item.assignedBy.name}
                            avatarUrl={item.assignedBy.avatarUrl}
                            size="xs"
                          />
                          <p className="truncate text-[11px] font-medium text-muted-foreground">
                            {item.assignedBy.name}
                          </p>
                        </>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">—</span>
                      )}
                    </div>

                    {/* 7. Priority */}
                    <div>
                      <span
                        className={cn(
                          "inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase",
                          item.priority === "High"
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50"
                            : item.priority === "Medium"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50",
                        )}
                      >
                        {item.priority}
                      </span>
                    </div>

                    {/* 8. Status */}
                    <div>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                          item.status === "Overdue"
                            ? "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200/60 dark:border-rose-900/40"
                            : item.status === "Urgent"
                              ? "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200/60 dark:border-rose-900/40"
                              : item.status === "In Progress"
                                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-900/40"
                                : item.status === "In Review"
                                  ? "bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200/60 dark:border-purple-900/40"
                                  : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/40",
                        )}
                      >
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            item.status === "Overdue" || item.status === "Urgent"
                              ? "bg-rose-500"
                              : item.status === "In Progress"
                                ? "bg-indigo-500"
                                : item.status === "In Review"
                                  ? "bg-purple-500"
                                  : "bg-amber-500",
                          )}
                        />
                        {item.status}
                      </span>
                    </div>

                    {/* 9. Action Chevron */}
                    <div className="flex justify-end">
                      <span className="grid size-7 place-items-center rounded-md text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                        <ChevronRight size={16} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tablet & Mobile Card View (< xl) */}
            <div className="xl:hidden space-y-2.5">
              {filteredItems.map((item) => {
                let deadlineSubtitle = "";
                if (item.deadline) {
                  const deadlineDate = new Date(item.deadline);
                  if (!isNaN(deadlineDate.getTime())) {
                    const diffDays = Math.ceil(
                      (deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
                    );
                    if (diffDays < 0) {
                      deadlineSubtitle = `${Math.abs(diffDays)}d overdue`;
                    } else if (diffDays === 0) {
                      deadlineSubtitle = "Due today";
                    } else {
                      deadlineSubtitle = `${diffDays}d left`;
                    }
                  }
                }

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (item.type === "task" && item.rawTask) {
                        onSelectTask(item.rawTask);
                      } else if (item.type === "case" && item.rawCase) {
                        navigate({ to: "/cases/$caseId", params: { caseId: item.rawCase._id } });
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className="group rounded-xl border border-border/70 bg-card p-3.5 space-y-2.5 transition-all hover:border-primary/40 hover:bg-muted/20 cursor-pointer shadow-soft"
                  >
                    {/* Header: Type, Case number, Priority, Status */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase",
                            item.type === "task"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200",
                          )}
                        >
                          {item.type}
                        </span>
                        {item.caseNumber && (
                          <span className="font-mono text-[10px] text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded border border-blue-200/50">
                            {item.caseNumber}
                          </span>
                        )}
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {item.priority}
                        </span>
                      </div>

                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          item.status === "Overdue" || item.status === "Urgent"
                            ? "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
                        )}
                      >
                        {item.status}
                      </span>
                    </div>

                    {/* Title & Description */}
                    <div>
                      <p className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors">
                        {item.title}
                      </p>
                      {item.description && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                          {item.description}
                        </p>
                      )}
                      {item.clientName && (
                        <p className="text-[11px] text-muted-foreground font-medium mt-1">
                          Client: {item.clientName}
                        </p>
                      )}
                    </div>

                    {/* Footer: Assigned info & Deadline */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40 text-[11px]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <EmployeeAvatar
                          name={item.assignedTo?.name || "Unassigned"}
                          avatarUrl={item.assignedTo?.avatarUrl}
                          size="xs"
                        />
                        <span className="truncate text-muted-foreground">{item.assignedTo?.name || "Unassigned"}</span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 font-mono text-[11px]">
                        <Calendar size={11} className="text-muted-foreground" />
                        <span>{formatSafeDate(item.deadline, "No date")}</span>
                        {deadlineSubtitle && (
                          <span
                            className={cn(
                              "text-[10px] font-semibold ml-1",
                              item.isOverdue ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400",
                            )}
                          >
                            ({deadlineSubtitle})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
