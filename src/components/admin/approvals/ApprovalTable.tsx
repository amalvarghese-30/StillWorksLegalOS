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
} from "lucide-react";
import type { ApprovalItem } from "@/services/admin";
import { StatusPill } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
}: ApprovalTableProps) {
  return (
    <div className="w-full">
      {/* Desktop Table View (>= md) */}
      <div className="hidden md:block rounded-xl border border-border/80 bg-card overflow-hidden shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {onToggleSelectAll && (
                  <th scope="col" className="w-10 px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={onToggleSelectAll}
                      aria-label="Select all requests"
                      className="size-4 rounded border-border text-primary focus:ring-primary/40 cursor-pointer"
                    />
                  </th>
                )}
                <th scope="col" className="px-4 py-3 min-w-[240px]">
                  Request
                </th>
                <th scope="col" className="px-3 py-3 w-32">
                  Type
                </th>
                <th scope="col" className="px-3 py-3 min-w-[140px]">
                  Submitted By
                </th>
                <th scope="col" className="px-3 py-3 min-w-[140px]">
                  Submitted On
                </th>
                <th scope="col" className="px-3 py-3 w-24">
                  Priority
                </th>
                <th scope="col" className="px-3 py-3 w-28">
                  Status
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

                const formattedDate = a.when
                  ? new Intl.DateTimeFormat("en-IN", {
                      timeZone: "Asia/Kolkata",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    }).format(new Date(a.when))
                  : "—";

                const displayStatus = a.status || "pending";

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
                        className="px-4 py-3 text-center"
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
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <span
                          className={cn(
                            "grid size-8 shrink-0 place-items-center rounded-lg mt-0.5",
                            a.kind === "Task Completion"
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                              : a.kind === "Document Upload"
                              ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          )}
                        >
                          <Icon size={16} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
                            {a.title}
                          </p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {a.context}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-foreground border border-border/80 whitespace-nowrap">
                        {a.kind}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        {a.submittedBy?.avatarUrl ? (
                          <img
                            src={a.submittedBy.avatarUrl}
                            alt={a.submittedBy.name}
                            className="size-6 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="size-6 rounded-full bg-primary/10 text-primary grid place-items-center text-[10px] font-bold shrink-0">
                            {a.submittedBy?.name
                              ? a.submittedBy.name
                                  .split(" ")
                                  .map((w) => w[0])
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase()
                              : "U"}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">
                            {a.submittedBy?.name || "Employee"}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate capitalize">
                            {a.submittedBy?.role?.replace(/_/g, " ") || "Staff"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-1 items-start">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formattedDate}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] px-1.5 py-0.2 rounded border whitespace-nowrap font-medium",
                            agingInfo.className
                          )}
                        >
                          {agingInfo.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border",
                          priorityInfo.className
                        )}
                      >
                        {priorityInfo.label}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {displayStatus === "pending" ? (
                        <StatusPill tone="amber">Pending</StatusPill>
                      ) : displayStatus === "approved" ? (
                        <StatusPill tone="emerald">Approved</StatusPill>
                      ) : (
                        <StatusPill tone="rose">Rejected</StatusPill>
                      )}
                    </td>
                    <td
                      className="px-4 py-3 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="size-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                          title="View Full Details"
                          onClick={() => onSelectItem(a)}
                        >
                          <Eye size={15} />
                          <span className="sr-only">View</span>
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

      {/* Mobile / Tablet List View (< md) */}
      <div className="md:hidden space-y-3">
        {approvals.map((a) => {
          const Icon = iconForKind(a.kind);
          const isSelected = selectedItem?._id === a._id;
          const isBusy = processingIds.has(a._id);
          const priorityInfo = priorityBadge(a.priority);
          const agingInfo = agingBadge(a.agingLabel, a.status);
          const displayStatus = a.status || "pending";

          return (
            <div
              key={a._id}
              onClick={() => onSelectItem(a)}
              className={cn(
                "p-4 rounded-xl border bg-card shadow-soft transition-all cursor-pointer",
                isSelected
                  ? "border-primary ring-1 ring-primary/20 bg-primary/5"
                  : "border-border/80 hover:border-border"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary mt-0.5">
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground text-sm truncate">
                      {a.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {a.context}
                    </p>
                  </div>
                </div>
                <div className="shrink-0">
                  {displayStatus === "pending" ? (
                    <StatusPill tone="amber">Pending</StatusPill>
                  ) : displayStatus === "approved" ? (
                    <StatusPill tone="emerald">Approved</StatusPill>
                  ) : (
                    <StatusPill tone="rose">Rejected</StatusPill>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-border/50 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {a.submittedBy?.name || "Employee"}
                </span>
                <span>•</span>
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
              </div>

              <div
                className="mt-3 flex items-center justify-between pt-2 border-t border-border/40"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => onSelectItem(a)}
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
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
