import React from "react";
import {
  CheckSquare,
  FileText,
  KeyRound,
  UserPlus,
  Briefcase,
  Eye,
  Check,
  X,
  Clock,
  AlertTriangle,
  FolderLock,
  ArrowRight,
  ShieldAlert,
  User,
} from "lucide-react";
import type { ApprovalItem } from "@/services/admin";
import { resolveAvatarUrl } from "@/lib/avatarUrl";
import { StatusPill } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SortHeaderButton } from "@/components/common/table/SortableTableHeader";
import { type SortDirection } from "@/lib/sorting";

interface ApprovalTableProps {
  approvals: ApprovalItem[];
  selectedItem: ApprovalItem | null;
  onSelectItem: (item: ApprovalItem) => void;
  onQuickApprove: (item: ApprovalItem) => void;
  onQuickReject: (item: ApprovalItem) => void;
  processingIds: Set<string>;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
  allSelected?: boolean;
  sortKey?: string | null;
  sortDirection?: SortDirection;
  onSort?: (key: string) => void;
}

export function iconForKind(kind?: string) {
  switch (kind) {
    case "Task Completion":
      return CheckSquare;
    case "Document Upload":
      return FileText;
    case "Access Request":
      return KeyRound;
    case "Case Request":
      return FolderLock;
    case "Client Request":
      return UserPlus;
    case "Task Reassignment":
    case "Task Forward":
      return ArrowRight;
    case "Task Deletion":
    case "Case Deletion":
      return ShieldAlert;
    case "Case Completion":
      return CheckSquare;
    default:
      return Briefcase;
  }
}

export function priorityBadge(priority?: string) {
  const p = (priority || "medium").toLowerCase();
  switch (p) {
    case "urgent":
      return { label: "Urgent", className: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30" };
    case "high":
      return { label: "High", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" };
    case "medium":
    case "normal":
      return { label: "Medium", className: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30" };
    case "low":
    default:
      return { label: "Low", className: "bg-muted text-muted-foreground border-border" };
  }
}

export function agingBadge(label?: string, status?: string) {
  const l = (label || "Today").toLowerCase();
  const isPending = status === "pending" || !status;

  if (l.includes("today")) {
    return {
      label: "Today",
      className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    };
  }
  if (l.includes("1d")) {
    return {
      label: isPending ? "1d waiting" : "1d ago",
      className: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
    };
  }
  if (l.includes("overdue") || l.includes("7d+")) {
    return {
      label: isPending ? "7d+ overdue review" : "7d+ ago",
      className: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 font-medium",
    };
  }
  return {
    label: isPending ? (label || "Waiting") : (label || "Resolved"),
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  };
}

export function formatSafeDateTime(iso: any): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return "—";
  }
}

export function ApprovalTable({
  approvals,
  selectedItem,
  onSelectItem,
  onQuickApprove,
  onQuickReject,
  processingIds,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  allSelected,
  sortKey,
  sortDirection,
  onSort,
}: ApprovalTableProps) {
  return (
    <div className="w-full">
      {/* Desktop Table View (>= lg) — Zero horizontal scroll, consolidated row layout */}
      <div className="hidden lg:block rounded-xl border border-border/80 bg-card overflow-hidden shadow-soft">
        <div className="w-full">
          <table className="w-full text-left text-sm border-collapse table-auto">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {onToggleSelectAll && (
                  <th scope="col" className="w-10 px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={onToggleSelectAll}
                      aria-label="Select all requests"
                      className="size-4 rounded border-border text-primary focus:ring-primary/40 cursor-pointer"
                    />
                  </th>
                )}
                <th scope="col" className="px-4 py-3 min-w-0">
                  <SortHeaderButton
                    sortKey="title"
                    currentSortKey={sortKey ?? null}
                    currentDirection={sortDirection ?? "asc"}
                    onSort={onSort}
                  >
                    Request & Details
                  </SortHeaderButton>
                </th>
                <th scope="col" className="px-3 py-3 w-32">
                  <SortHeaderButton
                    sortKey="kind"
                    currentSortKey={sortKey ?? null}
                    currentDirection={sortDirection ?? "asc"}
                    onSort={onSort}
                  >
                    Type
                  </SortHeaderButton>
                </th>
                <th scope="col" className="px-3 py-3 w-48">
                  <SortHeaderButton
                    sortKey="userName"
                    currentSortKey={sortKey ?? null}
                    currentDirection={sortDirection ?? "asc"}
                    onSort={onSort}
                  >
                    Submitted By
                  </SortHeaderButton>
                </th>
                <th scope="col" className="px-3 py-3 w-36">
                  <SortHeaderButton
                    sortKey="status"
                    currentSortKey={sortKey ?? null}
                    currentDirection={sortDirection ?? "asc"}
                    onSort={onSort}
                  >
                    Status
                  </SortHeaderButton>
                </th>
                <th scope="col" className="px-4 py-3 text-right w-36">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {approvals.map((a) => {
                const Icon = iconForKind(a.kind);
                const isSelected = selectedItem?._id === a._id;
                const isChecked = selectedIds?.has(a._id) ?? false;
                const isBusy = processingIds.has(a._id);
                const priorityInfo = priorityBadge(a.priority);
                const agingInfo = agingBadge(a.agingLabel, a.status);

                const submittedDate = formatSafeDateTime(a.submittedAt || a.when);
                const displayStatus = a.status || "pending";

                const submitterName = a.submittedBy?.name || "Staff Submitter";
                const assigneeName = a.assignedTo?.name || (a.kind === "Task Completion" ? "Unassigned" : "—");
                const assignerName = a.assignedBy?.name || (a.kind === "Task Completion" ? "Historical info unavailable" : "—");

                const caseObj =
                  a.taskDetails?.case ||
                  (a.taskDetails as any)?.caseId ||
                  a.caseDetails ||
                  (a.documentDetails as any)?.case ||
                  (a.requestDetails as any)?.case;
                const caseNumber = caseObj?.number || "";
                const caseTitle = caseObj?.title || "";

                const clientObj =
                  a.taskDetails?.client ||
                  (a.taskDetails as any)?.clientId ||
                  (a.caseDetails as any)?.client ||
                  (a.documentDetails as any)?.client ||
                  (a.requestDetails as any)?.client;
                const clientName = clientObj?.name || "";

                const reasonText = a.requestDetails?.reason || a.rejectionReason || "";
                const isDelete = a.kind?.toLowerCase().includes("delete") || a.type?.toLowerCase().includes("delete");
                const isReassign = a.kind?.toLowerCase().includes("reassign") || a.type?.toLowerCase().includes("reassign");

                return (
                  <tr
                    key={a._id}
                    onClick={() => onSelectItem(a)}
                    className={cn(
                      "group cursor-pointer transition-colors duration-150",
                      isSelected
                        ? "bg-primary/5 hover:bg-primary/10 border-l-4 border-l-primary"
                        : "hover:bg-muted/30"
                    )}
                  >
                    {onToggleSelect && (
                      <td
                        className="px-4 py-3 text-center align-top pt-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => onToggleSelect(a._id)}
                          aria-label={`Select ${a.title}`}
                          className="size-4 rounded border-border text-primary focus:ring-primary/40 cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3.5">
                      <div className="flex items-start gap-3">
                        <span
                          className={cn(
                            "grid size-9 shrink-0 place-items-center rounded-lg mt-0.5 shadow-2xs",
                            isDelete
                              ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                              : a.kind === "Task Completion"
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                              : a.kind === "Document Upload"
                              ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                              : isReassign
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          )}
                        >
                          <Icon size={17} />
                        </span>
                        <div className="min-w-0 flex-1 space-y-1">
                          {/* Title & Badges */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <p
                              className="font-semibold text-foreground text-sm leading-snug group-hover:text-primary transition-colors cursor-pointer"
                              title={a.title}
                            >
                              {a.title}
                            </p>
                            <span
                              className={cn(
                                "text-[10px] font-semibold px-1.5 py-0.2 rounded border shrink-0",
                                priorityInfo.className
                              )}
                            >
                              {priorityInfo.label}
                            </span>
                            {agingInfo.label && (
                              <span
                                className={cn(
                                  "text-[10px] px-1.5 py-0.2 rounded border font-medium shrink-0",
                                  agingInfo.className
                                )}
                              >
                                {agingInfo.label}
                              </span>
                            )}
                          </div>

                          {/* Downward Row Metadata: Case, Client & Dates */}
                          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground pt-0.5">
                            {(caseNumber || caseTitle) && (
                              <span className="inline-flex items-center gap-1 font-medium text-foreground bg-muted/60 px-2 py-0.5 rounded border border-border/60">
                                <Briefcase size={12} className="text-primary shrink-0" />
                                <span className="truncate max-w-[260px]">
                                  {caseNumber ? `[${caseNumber}] ` : ""}{caseTitle || "Linked Case"}
                                </span>
                              </span>
                            )}
                            {clientName && (
                              <span className="inline-flex items-center gap-1 font-medium text-foreground bg-muted/60 px-2 py-0.5 rounded border border-border/60">
                                <User size={12} className="text-muted-foreground shrink-0" />
                                <span className="truncate max-w-[160px]">{clientName}</span>
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Clock size={11} className="shrink-0" />
                              {submittedDate}
                            </span>
                            {assigneeName && assigneeName !== "—" && (
                              <span className="text-[11px] text-muted-foreground">
                                · Assigned to: <strong className="font-medium text-foreground">{assigneeName}</strong>
                                {assignerName && assignerName !== "—" && assignerName !== "Historical info unavailable" ? ` by ${assignerName}` : ""}
                              </span>
                            )}
                          </div>

                          {/* Downward Row Reason Box (if provided) */}
                          {reasonText && (
                            <div className={cn(
                              "flex items-start gap-1.5 text-xs p-2 rounded-md mt-1 border",
                              isDelete
                                ? "bg-rose-500/10 border-rose-500/20 text-rose-900 dark:text-rose-200"
                                : "bg-muted/40 border-border/60 text-muted-foreground"
                            )}>
                              <span className="font-semibold shrink-0">
                                {isDelete ? "Deletion Reason:" : "Reason:"}
                              </span>
                              <span className="italic break-words line-clamp-2">
                                "{reasonText}"
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 align-top">
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap",
                        isDelete
                          ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30"
                          : a.kind === "Task Completion"
                          ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30"
                          : a.kind === "Document Upload"
                          ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30"
                          : "bg-muted text-foreground border-border/80"
                      )}>
                        {a.kind}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 align-top">
                      <div className="flex items-center gap-2 max-w-[180px]">
                        {resolveAvatarUrl(a.submittedBy?.avatarUrl) ? (
                          <img
                            src={resolveAvatarUrl(a.submittedBy?.avatarUrl)}
                            alt={submitterName}
                            className="size-7 rounded-full object-cover shrink-0"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="size-7 rounded-full bg-primary/10 text-primary grid place-items-center text-[10px] font-bold shrink-0">
                            {submitterName
                              ? submitterName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
                              : "U"}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-foreground truncate" title={submitterName}>
                            {submitterName}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate capitalize">
                            {a.submittedBy?.role?.replace(/_/g, " ") || "Staff"}
                          </p>
                        </div>
                      </div>
                      {isReassign && a.assignedTo?.name && (
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1.5 pl-9">
                          <ArrowRight size={11} className="text-primary shrink-0" />
                          <span className="truncate">To: <strong className="text-foreground">{a.assignedTo.name}</strong></span>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3.5 align-top">
                      <div className="space-y-1">
                        {displayStatus === "pending" ? (
                          <StatusPill tone="warning">Pending</StatusPill>
                        ) : displayStatus === "approved" ? (
                          <StatusPill tone="success">Approved</StatusPill>
                        ) : (
                          <StatusPill tone="destructive">Rejected</StatusPill>
                        )}
                        <span className="block text-[11px] text-muted-foreground">
                          {submittedDate}
                        </span>
                      </div>
                    </td>
                    <td
                      className="px-4 py-3.5 text-right align-top"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground gap-1"
                          title="View Full Details"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectItem(a);
                          }}
                        >
                          <Eye size={14} />
                          <span>View</span>
                        </Button>
                        {displayStatus === "pending" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isBusy}
                              className="size-8 p-0 rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 border-rose-500/30"
                              title="Reject / Request Changes"
                              onClick={() => onQuickReject(a)}
                            >
                              <X size={15} />
                              <span className="sr-only">Reject</span>
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              disabled={isBusy}
                              className="size-8 p-0 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-soft"
                              title="Approve & Sign Off"
                              onClick={() => onQuickApprove(a)}
                            >
                              <Check size={15} />
                              <span className="sr-only">Approve</span>
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile / Tablet List View (< lg) */}
      <div className="lg:hidden space-y-3">
        {approvals.map((a) => {
          const Icon = iconForKind(a.kind);
          const isSelected = selectedItem?._id === a._id;
          const isBusy = processingIds.has(a._id);
          const priorityInfo = priorityBadge(a.priority);
          const agingInfo = agingBadge(a.agingLabel, a.status);
          const displayStatus = a.status || "pending";

          const submitterName = a.submittedBy?.name || "Staff Submitter";
          const assigneeName = a.assignedTo?.name || (a.kind === "Task Completion" ? "Unassigned" : "—");
          const assignerName = a.assignedBy?.name || (a.kind === "Task Completion" ? "Historical info unavailable" : "—");
          const submittedDate = formatSafeDateTime(a.submittedAt || a.when);
          const assignedDate = formatSafeDateTime(a.assignedAt);

          const caseObj =
            a.taskDetails?.case ||
            (a.taskDetails as any)?.caseId ||
            a.caseDetails ||
            (a.documentDetails as any)?.case ||
            (a.requestDetails as any)?.case;
          const caseNumber = caseObj?.number || "";
          const caseTitle = caseObj?.title || "";

          const clientObj =
            a.taskDetails?.client ||
            (a.taskDetails as any)?.clientId ||
            (a.caseDetails as any)?.client ||
            (a.documentDetails as any)?.client ||
            (a.requestDetails as any)?.client;
          const clientName = clientObj?.name || "";

          const reasonText = a.requestDetails?.reason || a.rejectionReason || "";
          const isDelete = a.kind?.toLowerCase().includes("delete") || a.type?.toLowerCase().includes("delete");

          return (
            <div
              key={a._id}
              onClick={() => onSelectItem(a)}
              className={cn(
                "p-4 rounded-xl border bg-card shadow-soft transition-all cursor-pointer space-y-2.5",
                isSelected
                  ? "border-primary ring-1 ring-primary/20 bg-primary/5"
                  : "border-border/80 hover:border-border"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-lg mt-0.5",
                    isDelete
                      ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                      : "bg-primary/10 text-primary"
                  )}>
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground text-sm leading-snug">
                      {a.title}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                      <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded border bg-muted text-foreground">
                        {a.kind}
                      </span>
                      <span className={cn("text-[10px] font-semibold px-1.5 py-0.2 rounded border", priorityInfo.className)}>
                        {priorityInfo.label}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="shrink-0">
                  {displayStatus === "pending" ? (
                    <StatusPill tone="warning">Pending</StatusPill>
                  ) : displayStatus === "approved" ? (
                    <StatusPill tone="success">Approved</StatusPill>
                  ) : (
                    <StatusPill tone="destructive">Rejected</StatusPill>
                  )}
                </div>
              </div>

              {/* Case & Client tags */}
              {((caseNumber || caseTitle) || clientName) && (
                <div className="flex items-center gap-2 flex-wrap text-xs pt-1">
                  {(caseNumber || caseTitle) && (
                    <span className="inline-flex items-center gap-1 font-medium text-foreground bg-muted/60 px-2 py-0.5 rounded border border-border/60 text-[11px]">
                      <Briefcase size={11} className="text-primary shrink-0" />
                      <span className="truncate max-w-[200px]">
                        {caseNumber ? `[${caseNumber}] ` : ""}{caseTitle || "Linked Case"}
                      </span>
                    </span>
                  )}
                  {clientName && (
                    <span className="inline-flex items-center gap-1 font-medium text-foreground bg-muted/60 px-2 py-0.5 rounded border border-border/60 text-[11px]">
                      <User size={11} className="text-muted-foreground shrink-0" />
                      <span className="truncate max-w-[140px]">{clientName}</span>
                    </span>
                  )}
                </div>
              )}

              {/* Reason callout */}
              {reasonText && (
                <div className={cn(
                  "p-2 rounded-md text-xs border",
                  isDelete
                    ? "bg-rose-500/10 border-rose-500/20 text-rose-900 dark:text-rose-200"
                    : "bg-muted/40 border-border/60 text-muted-foreground"
                )}>
                  <span className="font-semibold mr-1">
                    {isDelete ? "Deletion Reason:" : "Reason:"}
                  </span>
                  <span className="italic">"{reasonText}"</span>
                </div>
              )}

              <div className="mt-3 grid grid-cols-2 gap-2 pt-2 border-t border-border/50 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                    Submitted By
                  </span>
                  <span className="font-medium text-foreground truncate block" title={submitterName}>
                    {submitterName}
                  </span>
                  <span className="text-[10px] text-muted-foreground block">
                    {submittedDate}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                    Assigned To
                  </span>
                  <span className="font-medium text-foreground truncate block" title={assigneeName}>
                    {assigneeName}
                  </span>
                  <span className="text-[10px] text-muted-foreground block">
                    By: {assignerName}
                  </span>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.2 rounded border font-medium",
                    agingInfo.className
                  )}
                >
                  {agingInfo.label}
                </span>
                <span>•</span>
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.2 rounded border font-medium",
                    priorityInfo.className
                  )}
                >
                  {priorityInfo.label}
                </span>
                {assignedDate !== "—" && (
                  <>
                    <span>•</span>
                    <span className="text-[10px]">Assigned: {assignedDate}</span>
                  </>
                )}
              </div>

              <div
                className="mt-3 flex items-center justify-between pt-2 border-t border-border/40"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => onSelectItem(a)}
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Eye size={14} />
                  View details
                </button>
                {displayStatus === "pending" && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isBusy}
                      className="h-8 px-2.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 border-rose-500/30"
                      onClick={() => onQuickReject(a)}
                    >
                      <X size={13} className="mr-1" />
                      Reject
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      disabled={isBusy}
                      className="h-8 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-soft"
                      onClick={() => onQuickApprove(a)}
                    >
                      <Check size={13} className="mr-1" />
                      Approve
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
