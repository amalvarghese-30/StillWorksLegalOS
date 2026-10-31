import React, { useMemo, useState } from "react";
import {
  Calendar,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  CheckCircle2,
  Eye,
  Edit2,
  Copy,
  Trash2,
  PhoneCall,
  User,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatSafeDate } from "@/lib/dates";
import { toast } from "sonner";
import { useTableSorting } from "@/hooks/useTableSorting";
import { SortHeaderButton } from "@/components/common/table/SortableTableHeader";
import type { TaskRecord } from "@/services/tasks";
import type { ClientRecord } from "@/services/clients";

// ---------------------------------------------------------------------------
// Color Palettes for Client Card Headers (Subtle pastel accents like reference)
// ---------------------------------------------------------------------------
interface ClientAccent {
  headerBg: string;
  avatarBg: string;
  cardBorder: string;
}

const CLIENT_ACCENTS: ClientAccent[] = [
  // 1. Soft Blue (like Rahul Sharma in reference image)
  {
    headerBg: "bg-blue-50/80 dark:bg-blue-950/25",
    avatarBg: "bg-blue-600 text-white",
    cardBorder: "border-blue-100 dark:border-blue-900/30",
  },
  // 2. Soft Green (like Priya Kannan in reference image)
  {
    headerBg: "bg-emerald-50/80 dark:bg-emerald-950/25",
    avatarBg: "bg-emerald-600 text-white",
    cardBorder: "border-emerald-100 dark:border-emerald-900/30",
  },
  // 3. Soft Amber (like Mohan Gupta in reference image)
  {
    headerBg: "bg-amber-50/80 dark:bg-amber-950/25",
    avatarBg: "bg-amber-600 text-white",
    cardBorder: "border-amber-100 dark:border-amber-900/30",
  },
  // 4. Soft Violet
  {
    headerBg: "bg-violet-50/80 dark:bg-violet-950/25",
    avatarBg: "bg-violet-600 text-white",
    cardBorder: "border-violet-100 dark:border-violet-900/30",
  },
  // 5. Soft Teal
  {
    headerBg: "bg-teal-50/80 dark:bg-teal-950/25",
    avatarBg: "bg-teal-600 text-white",
    cardBorder: "border-teal-100 dark:border-teal-900/30",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getClientAccent(clientKey: string): ClientAccent {
  if (clientKey === "__unlinked__") {
    return {
      headerBg: "bg-muted/40",
      avatarBg: "bg-muted-foreground text-background",
      cardBorder: "border-border",
    };
  }
  let hash = 0;
  for (let i = 0; i < clientKey.length; i++) {
    hash = (hash << 5) - hash + clientKey.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % CLIENT_ACCENTS.length;
  return CLIENT_ACCENTS[idx];
}

function getInitials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatPhoneNumber(phone?: string): string {
  if (!phone) return "";
  const cleaned = phone.trim();
  if (!cleaned) return "";
  if (cleaned.startsWith("+")) return cleaned;
  if (/^\d{10}$/.test(cleaned)) {
    return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  }
  return cleaned;
}

function getRelativeDeadline(deadlineIso: string | null): {
  label: string;
  isUrgent: boolean;
} {
  if (!deadlineIso) return { label: "No deadline", isUrgent: false };
  const d = new Date(deadlineIso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: `${Math.abs(diffDays)}d overdue`, isUrgent: true };
  }
  if (diffDays === 0) {
    return { label: "Due today", isUrgent: true };
  }
  if (diffDays === 1) {
    return { label: "Tomorrow", isUrgent: true };
  }
  if (diffDays <= 3) {
    return { label: `In ${diffDays} days`, isUrgent: true };
  }
  return { label: `In ${diffDays} days`, isUrgent: false };
}

function getTaskCaseDisplay(task: TaskRecord): string | null {
  if (task.caseId && typeof task.caseId === "object") {
    const c = task.caseId as { _id?: string; title?: string; number?: string };
    const text = c.number ? `${c.number} — ${c.title}` : c.title;
    return text || null;
  }
  return task.caseName ?? null;
}

// ---------------------------------------------------------------------------
// Client Group Interface
// ---------------------------------------------------------------------------
export interface ClientTaskGroup {
  clientId: string;
  clientName: string;
  clientPhone?: string;
  tasks: TaskRecord[];
  caseCount: number;
}

interface UpcomingClientDashboardProps {
  tasks: TaskRecord[];
  clients?: ClientRecord[];
  onSelectTask: (task: TaskRecord) => void;
  onCompleteTask?: (task: TaskRecord) => void;
  isAdmin?: boolean;
}

export function UpcomingClientDashboard({
  tasks,
  clients = [],
  onSelectTask,
  onCompleteTask,
  isAdmin = false,
}: UpcomingClientDashboardProps) {
  // Map of clients for fast lookup
  const clientsMap = useMemo(() => {
    const map = new Map<string, ClientRecord>();
    for (const cl of clients) {
      if (cl._id) map.set(cl._id, cl);
    }
    return map;
  }, [clients]);

  // Group tasks by client
  const clientGroups = useMemo(() => {
    const groupsMap = new Map<string, ClientTaskGroup>();

    for (const task of tasks) {
      // 1. Resolve client identity
      let resolvedId = "";
      let resolvedName = "";
      let resolvedPhone: string | undefined = undefined;

      if (task.clientId) {
        if (typeof task.clientId === "object" && task.clientId._id) {
          resolvedId = task.clientId._id;
          resolvedName = task.clientId.name || "";
          resolvedPhone = task.clientId.phone || undefined;
        } else if (typeof task.clientId === "string") {
          resolvedId = task.clientId;
          resolvedName = task.clientName || "";
        }
      }

      // Check clientsMap if phone or name missing
      if (resolvedId && clientsMap.has(resolvedId)) {
        const cRecord = clientsMap.get(resolvedId)!;
        if (!resolvedName) resolvedName = cRecord.name;
        if (!resolvedPhone) resolvedPhone = cRecord.phone;
      }

      // If no clientId but call reminder has clientName
      if (!resolvedName && task.callReminder?.clientName) {
        resolvedName = task.callReminder.clientName;
        resolvedPhone = task.callReminder.phone || undefined;
        // See if matches an existing client
        for (const cl of clientsMap.values()) {
          if (cl.name.toLowerCase() === resolvedName.toLowerCase()) {
            resolvedId = cl._id;
            if (!resolvedPhone) resolvedPhone = cl.phone;
            break;
          }
        }
        if (!resolvedId) resolvedId = `call_${resolvedName}`;
      }

      // If no client on task, resolve through case primary client
      if (!resolvedName && task.caseId && typeof task.caseId === "object") {
        const cObj = task.caseId as {
          parties?: Array<{ name?: string; role?: string; type?: string; clientId?: any }>;
        };
        if (Array.isArray(cObj.parties) && cObj.parties.length > 0) {
          const primaryParty =
            cObj.parties.find((p) => p.role === "Primary Client" || p.type === "client") ||
            cObj.parties[0];
          if (primaryParty?.name) {
            resolvedName = primaryParty.name;
            const pCid = primaryParty.clientId
              ? typeof primaryParty.clientId === "object"
                ? primaryParty.clientId._id
                : primaryParty.clientId
              : null;
            if (pCid && clientsMap.has(pCid)) {
              resolvedId = pCid;
              resolvedPhone = clientsMap.get(pCid)?.phone;
            } else if (pCid) {
              resolvedId = pCid;
            } else {
              resolvedId = `party_${primaryParty.name}`;
            }
          }
        }
      }

      // If task direct clientName
      if (!resolvedName && task.clientName) {
        resolvedName = task.clientName;
        for (const cl of clientsMap.values()) {
          if (cl.name.toLowerCase() === resolvedName.toLowerCase()) {
            resolvedId = cl._id;
            if (!resolvedPhone) resolvedPhone = cl.phone;
            break;
          }
        }
        if (!resolvedId) resolvedId = `name_${resolvedName}`;
      }

      // Fallback: unlinked
      if (!resolvedName || !resolvedName.trim()) {
        resolvedId = "__unlinked__";
        resolvedName = "Unlinked Tasks";
      }

      if (!groupsMap.has(resolvedId)) {
        groupsMap.set(resolvedId, {
          clientId: resolvedId,
          clientName: resolvedName,
          clientPhone: resolvedPhone,
          tasks: [],
          caseCount: 0,
        });
      }

      const grp = groupsMap.get(resolvedId)!;
      grp.tasks.push(task);
      if (!grp.clientPhone && resolvedPhone) {
        grp.clientPhone = resolvedPhone;
      }
    }

    // Compute distinct cases per client and sort tasks
    const list: ClientTaskGroup[] = [];
    groupsMap.forEach((grp) => {
      const caseSet = new Set<string>();
      for (const t of grp.tasks) {
        if (t.caseId) {
          const cid = typeof t.caseId === "object" ? t.caseId._id || t.caseId.title : t.caseId;
          if (cid) caseSet.add(cid);
        } else if (t.caseName) {
          caseSet.add(t.caseName);
        }
      }
      grp.caseCount = caseSet.size;

      // Sort tasks by deadline ascending (nearest deadline first)
      grp.tasks.sort((a, b) => {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      });

      list.push(grp);
    });

    // Sort client groups alphabetically, unlinked at bottom
    list.sort((a, b) => {
      if (a.clientId === "__unlinked__") return 1;
      if (b.clientId === "__unlinked__") return -1;
      return a.clientName.localeCompare(b.clientName);
    });

    return list;
  }, [tasks, clientsMap]);

  // Track collapsed state per client card
  const [collapsedClients, setCollapsedClients] = useState<Set<string>>(new Set());

  const toggleClientCollapse = (clientId: string) => {
    setCollapsedClients((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  };

  const handleCopyTaskId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast.success("Task ID copied to clipboard");
  };

  if (tasks.length === 0 || clientGroups.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center shadow-soft">
        <FolderOpen size={40} className="mx-auto text-muted-foreground/60 mb-3" />
        <h3 className="text-base font-semibold text-foreground">No upcoming tasks found</h3>
        <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
          There are no upcoming tasks matching the current filters or date range.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {clientGroups.map((group) => {
        const isCollapsed = collapsedClients.has(group.clientId);
        const accent = getClientAccent(group.clientId);
        const initials =
          group.clientId === "__unlinked__" ? "UT" : getInitials(group.clientName);
        const formattedPhone = formatPhoneNumber(group.clientPhone);

        return (
          <div
            key={group.clientId}
            className={`rounded-xl border ${accent.cardBorder} bg-card shadow-xs transition-shadow duration-200 overflow-hidden`}
          >
            {/* ── Client Card Header ── */}
            <button
              type="button"
              onClick={() => toggleClientCollapse(group.clientId)}
              aria-expanded={!isCollapsed}
              className={`w-full flex items-center justify-between p-4 sm:px-5 sm:py-3.5 ${accent.headerBg} border-b border-border/50 text-left cursor-pointer transition-colors duration-150 hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                {/* Client Avatar / Initials */}
                <div
                  className={`h-10 w-10 sm:h-11 sm:w-11 rounded-full ${accent.avatarBg} font-semibold text-xs sm:text-sm flex items-center justify-center shrink-0 shadow-xs`}
                >
                  {initials}
                </div>

                {/* Client Name & Summary Line */}
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-foreground truncate">
                    {group.clientName}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium flex-wrap mt-0.5">
                    <span>
                      {group.tasks.length} upcoming task{group.tasks.length === 1 ? "" : "s"}
                    </span>
                    {group.caseCount > 0 && (
                      <>
                        <span className="text-muted-foreground/40 font-normal">|</span>
                        <span>
                          {group.caseCount} {group.caseCount === 1 ? "case" : "cases"}
                        </span>
                      </>
                    )}
                    {formattedPhone && (
                      <>
                        <span className="text-muted-foreground/40 font-normal">|</span>
                        <span className="text-foreground/80 font-medium">{formattedPhone}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Expand / Collapse Chevron */}
              <div className="flex items-center gap-1.5 pl-3 text-muted-foreground shrink-0">
                {isCollapsed ? (
                  <ChevronDown size={18} strokeWidth={2} />
                ) : (
                  <ChevronUp size={18} strokeWidth={2} />
                )}
              </div>
            </button>

            {/* ── Tasks Content inside Client Card ── */}
            {!isCollapsed && (
              <ClientGroupTaskTable
                group={group}
                onSelectTask={onSelectTask}
                onCompleteTask={onCompleteTask}
                onCopyTaskId={handleCopyTaskId}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Client Group Task Table with 3-State Column Sorting
// ---------------------------------------------------------------------------
interface ClientGroupTaskTableProps {
  group: ClientTaskGroup;
  onSelectTask: (task: TaskRecord) => void;
  onCompleteTask?: (task: TaskRecord) => void;
  onCopyTaskId: (id: string) => void;
}

function ClientGroupTaskTable({
  group,
  onSelectTask,
  onCompleteTask,
  onCopyTaskId,
}: ClientGroupTaskTableProps) {
  const {
    sortedData: sortedTasks,
    sortKey,
    sortDirection,
    onSort,
  } = useTableSorting(group.tasks, {
    customAccessors: {
      title: (t) => t.title,
      description: (t) => t.description || "",
      assignedTo: (t) => {
        const assignees =
          Array.isArray(t.assignedUsers) && t.assignedUsers.length > 0
            ? t.assignedUsers
            : t.assignedTo
            ? [t.assignedTo]
            : [];
        return assignees.map((a: any) => a.name).join(", ");
      },
      deadline: (t) => t.deadline,
      createdBy: (t) =>
        typeof t.createdBy === "object" && t.createdBy?.name
          ? t.createdBy.name
          : typeof t.createdBy === "string"
          ? t.createdBy
          : "",
    },
  });

  return (
    <div>
      {/* Desktop & Tablet Table (>= 768px) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-border/60 text-[11px] font-semibold text-muted-foreground bg-muted/20">
              <th className="py-2.5 px-4">
                <SortHeaderButton
                  sortKey="title"
                  currentSortKey={sortKey}
                  currentDirection={sortDirection}
                  onSort={onSort}
                >
                  TASK TITLE
                </SortHeaderButton>
              </th>
              <th className="py-2.5 px-4">
                <SortHeaderButton
                  sortKey="description"
                  currentSortKey={sortKey}
                  currentDirection={sortDirection}
                  onSort={onSort}
                >
                  DESCRIPTION
                </SortHeaderButton>
              </th>
              <th className="py-2.5 px-4">
                <SortHeaderButton
                  sortKey="assignedTo"
                  currentSortKey={sortKey}
                  currentDirection={sortDirection}
                  onSort={onSort}
                >
                  ASSIGNED TO
                </SortHeaderButton>
              </th>
              <th className="py-2.5 px-4">
                <SortHeaderButton
                  sortKey="deadline"
                  currentSortKey={sortKey}
                  currentDirection={sortDirection}
                  onSort={onSort}
                >
                  DEADLINE
                </SortHeaderButton>
              </th>
              <th className="py-2.5 px-4">
                <SortHeaderButton
                  sortKey="createdBy"
                  currentSortKey={sortKey}
                  currentDirection={sortDirection}
                  onSort={onSort}
                >
                  CREATED BY
                </SortHeaderButton>
              </th>
              <th className="py-2.5 px-3 w-10 text-right">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {sortedTasks.map((task) => {
              const caseTitle = getTaskCaseDisplay(task);
              const deadlineInfo = getRelativeDeadline(task.deadline);
              const creatorName =
                typeof task.createdBy === "object" && task.createdBy?.name
                  ? task.createdBy.name
                  : typeof task.createdBy === "string"
                  ? task.createdBy
                  : "Unknown";
              const creatorInitials = getInitials(creatorName);

              // Assigned users list
              const assignees =
                Array.isArray(task.assignedUsers) && task.assignedUsers.length > 0
                  ? task.assignedUsers
                  : task.assignedTo
                  ? [task.assignedTo]
                  : [];

              // Priority dot color
              const priorityColor =
                task.priority === "High"
                  ? "bg-rose-500"
                  : task.priority === "Medium"
                  ? "bg-amber-500"
                  : "bg-emerald-500";

              return (
                <tr
                  key={task._id}
                  onClick={() => onSelectTask(task)}
                  className="group hover:bg-muted/40 transition-colors duration-150 cursor-pointer"
                >
                  {/* 1. TASK TITLE */}
                  <td className="py-3 px-4 align-top">
                    <div className="flex items-start gap-2.5">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${priorityColor} shrink-0 mt-1`}
                        title={`${task.priority} Priority`}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-semibold text-foreground group-hover:text-primary transition-colors text-xs sm:text-sm">
                            {task.title}
                          </p>
                          {task.isCall && (
                            <span className="inline-flex items-center gap-1 rounded-pill bg-violet-500/10 text-violet-600 dark:text-violet-400 px-1.5 py-0.2 text-[10px] font-semibold">
                              <PhoneCall size={10} /> Call
                            </span>
                          )}
                        </div>
                        {caseTitle ? (
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                            Case: {caseTitle}
                          </p>
                        ) : (
                          <p className="text-[11px] text-muted-foreground/60 mt-0.5 italic">
                            General Work
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* 2. DESCRIPTION */}
                  <td className="py-3 px-4 align-top text-muted-foreground max-w-xs">
                    {task.description?.trim() ? (
                      <p className="line-clamp-2 text-xs leading-relaxed">
                        {task.description}
                      </p>
                    ) : (
                      <p className="text-xs italic text-muted-foreground/60">
                        No description provided
                      </p>
                    )}
                  </td>

                  {/* 3. ASSIGNED TO */}
                  <td className="py-3 px-4 align-top whitespace-nowrap">
                    {assignees.length > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 font-semibold text-[10px] flex items-center justify-center shrink-0">
                          {getInitials(assignees[0].name)}
                        </div>
                        <span className="font-medium text-foreground text-xs">
                          {assignees[0].name}
                          {assignees.length > 1 && (
                            <span className="ml-1 text-[10px] text-muted-foreground font-normal">
                              +{assignees.length - 1}
                            </span>
                          )}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-muted-foreground/80">
                        <User size={14} />
                        <span className="italic text-xs">Unassigned</span>
                      </div>
                    )}
                  </td>

                  {/* 4. DEADLINE */}
                  <td className="py-3 px-4 align-top whitespace-nowrap">
                    <div className="flex items-start gap-2">
                      <Calendar
                        size={15}
                        className={`shrink-0 mt-0.5 ${
                          deadlineInfo.isUrgent
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-muted-foreground"
                        }`}
                      />
                      <div>
                        <p
                          className={`font-semibold text-xs ${
                            deadlineInfo.isUrgent
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-foreground"
                          }`}
                        >
                          {formatSafeDate(task.deadline)}
                        </p>
                        <p
                          className={`text-[11px] font-medium ${
                            deadlineInfo.isUrgent
                              ? "text-rose-600 dark:text-rose-400 font-semibold"
                              : "text-muted-foreground"
                          }`}
                        >
                          {deadlineInfo.label}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* 5. CREATED BY */}
                  <td className="py-3 px-4 align-top whitespace-nowrap">
                    <div className="flex items-start gap-2">
                      <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                        {creatorInitials}
                      </div>
                      <div>
                        <p className="font-medium text-foreground text-xs">
                          {creatorName}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatSafeDate(task.createdAt)}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* 6. ACTIONS */}
                  <td
                    className="py-3 px-3 align-middle text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-md"
                        >
                          <MoreVertical size={16} />
                          <span className="sr-only">Task actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44 text-xs">
                        <DropdownMenuItem onClick={() => onSelectTask(task)}>
                          <Eye size={14} className="mr-2 text-muted-foreground" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onSelectTask(task)}>
                          <Edit2 size={14} className="mr-2 text-muted-foreground" />
                          Edit Task
                        </DropdownMenuItem>
                        {onCompleteTask && task.status !== "completed" && (
                          <DropdownMenuItem onClick={() => onCompleteTask(task)}>
                            <CheckCircle2 size={14} className="mr-2 text-success" />
                            Mark Completed
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onCopyTaskId(task._id)}>
                          <Copy size={14} className="mr-2 text-muted-foreground" />
                          Copy Task ID
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Responsive Cards (< 768px) */}
      <div className="md:hidden divide-y divide-border/60">
        {sortedTasks.map((task) => {
          const caseTitle = getTaskCaseDisplay(task);
          const deadlineInfo = getRelativeDeadline(task.deadline);
          const creatorName =
            typeof task.createdBy === "object" && task.createdBy?.name
              ? task.createdBy.name
              : typeof task.createdBy === "string"
              ? task.createdBy
              : "Unknown";

          const assignees =
            Array.isArray(task.assignedUsers) && task.assignedUsers.length > 0
              ? task.assignedUsers
              : task.assignedTo
              ? [task.assignedTo]
              : [];

          const priorityColor =
            task.priority === "High"
              ? "bg-rose-500"
              : task.priority === "Medium"
              ? "bg-amber-500"
              : "bg-emerald-500";

          return (
            <div
              key={task._id}
              onClick={() => onSelectTask(task)}
              className="p-4 space-y-2.5 hover:bg-muted/30 transition-colors cursor-pointer"
            >
              {/* Title and Action Menu */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${priorityColor} shrink-0 mt-1`}
                    title={`${task.priority} Priority`}
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground text-xs leading-snug">
                      {task.title}
                    </p>
                    {caseTitle && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        Case: {caseTitle}
                      </p>
                    )}
                  </div>
                </div>

                <div onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground -mr-2"
                      >
                        <MoreVertical size={16} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44 text-xs">
                      <DropdownMenuItem onClick={() => onSelectTask(task)}>
                        <Eye size={14} className="mr-2 text-muted-foreground" />
                        View Details
                      </DropdownMenuItem>
                      {onCompleteTask && task.status !== "completed" && (
                        <DropdownMenuItem onClick={() => onCompleteTask(task)}>
                          <CheckCircle2 size={14} className="mr-2 text-success" />
                          Mark Completed
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => onCopyTaskId(task._id)}>
                        <Copy size={14} className="mr-2 text-muted-foreground" />
                        Copy Task ID
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Description Preview */}
              {task.description?.trim() && (
                <p className="text-xs text-muted-foreground line-clamp-2 pl-4 leading-relaxed">
                  {task.description}
                </p>
              )}

              {/* Meta Grid: Assigned To, Deadline, Created By */}
              <div className="grid grid-cols-2 gap-2 pt-1 pl-4 text-xs text-muted-foreground">
                {/* Assigned To */}
                <div className="flex items-center gap-1.5">
                  <div className="h-5 w-5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 font-semibold text-[9px] flex items-center justify-center shrink-0">
                    {assignees.length > 0 ? getInitials(assignees[0].name) : "?"}
                  </div>
                  <span className="truncate text-foreground text-[11px] font-medium">
                    {assignees.length > 0 ? assignees[0].name : "Unassigned"}
                  </span>
                </div>

                {/* Deadline */}
                <div className="flex items-center gap-1.5">
                  <Calendar
                    size={13}
                    className={`shrink-0 ${
                      deadlineInfo.isUrgent
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-muted-foreground"
                    }`}
                  />
                  <span
                    className={`text-[11px] font-semibold truncate ${
                      deadlineInfo.isUrgent
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-foreground"
                    }`}
                  >
                    {formatSafeDate(task.deadline)} ({deadlineInfo.label})
                  </span>
                </div>
              </div>

              {/* Created By Line */}
              <div className="flex items-center gap-1.5 pl-4 text-[10px] text-muted-foreground">
                <span className="text-muted-foreground/80">Created by:</span>
                <span className="font-medium text-foreground">{creatorName}</span>
                <span className="text-muted-foreground/40">•</span>
                <span>{formatSafeDate(task.createdAt)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
