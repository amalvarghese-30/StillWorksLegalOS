import React, { useState } from "react";
import {
  Eye,
  Copy,
  Check,
  ScrollText,
  Clock,
  Laptop,
  Globe,
  Shield,
  Layers,
} from "lucide-react";
import type { AuditLogItem } from "@/services/admin";
import {
  formatAuditIST,
  formatRelativeTime,
  parseDeviceClient,
  getActionBadge,
  getResourceBadge,
} from "./auditUtils";
import { cn } from "@/lib/utils";
import { SortHeaderButton } from "@/components/common/table/SortableTableHeader";
import { type SortDirection } from "@/lib/sorting";

interface AuditLogTableProps {
  logs: AuditLogItem[];
  isLoading: boolean;
  onSelectLog: (log: AuditLogItem) => void;
  selectedLogId?: string;
  onResetFilters?: () => void;
  hasActiveFilters?: boolean;
  sortKey?: string | null;
  sortDirection?: SortDirection;
  onSort?: (key: string) => void;
}

function getUserInitials(name: string): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getUserColor(name: string): string {
  const colors = [
    "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
    "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
    "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
    "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function AuditLogTable({
  logs,
  isLoading,
  onSelectLog,
  selectedLogId,
  onResetFilters,
  hasActiveFilters,
  sortKey,
  sortDirection,
  onSort,
}: AuditLogTableProps) {
  const [copiedIp, setCopiedIp] = useState<string | null>(null);

  const handleCopyIp = (e: React.MouseEvent, ip: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(ip);
    setCopiedIp(ip);
    setTimeout(() => setCopiedIp(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-soft">
        {/* Desktop skeleton */}
        <div className="hidden lg:block divide-y divide-border/60">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 animate-pulse">
              <div className="h-4 w-28 rounded bg-muted/60" />
              <div className="size-7 rounded-full bg-muted/60" />
              <div className="h-4 w-24 rounded bg-muted/60" />
              <div className="h-6 w-20 rounded-full bg-muted/50" />
              <div className="h-4 flex-1 rounded bg-muted/50" />
              <div className="h-4 w-24 rounded bg-muted/40" />
              <div className="h-4 w-20 rounded bg-muted/40" />
              <div className="h-6 w-12 rounded bg-muted/40" />
            </div>
          ))}
        </div>
        {/* Mobile/tablet card skeleton */}
        <div className="lg:hidden divide-y divide-border/60">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 space-y-3 animate-pulse">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-full bg-muted/60" />
                  <div className="h-3.5 w-24 rounded bg-muted/60" />
                </div>
                <div className="h-5 w-16 rounded-full bg-muted/50" />
              </div>
              <div className="h-4 w-3/4 rounded bg-muted/50" />
              <div className="h-3 w-1/2 rounded bg-muted/40" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border/80 bg-card p-12 text-center shadow-soft">
        <div className="grid size-14 place-items-center rounded-2xl bg-muted/60 text-muted-foreground/70 mb-4">
          <ScrollText size={28} strokeWidth={1.5} />
        </div>
        <h3 className="text-base font-bold text-foreground">No audit events found</h3>
        <p className="mt-1 text-xs text-muted-foreground max-w-sm">
          {hasActiveFilters
            ? "No activity logs match your current filter criteria. Try clearing or relaxing filters."
            : "No events have been recorded in the audit trail yet. As staff work, actions will be recorded here."}
        </p>
        {hasActiveFilters && onResetFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-sm"
          >
            Reset all filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-soft">
      {/* ─────────────────────────────────────────────────────────────
          1. DESKTOP RESPONSIVE TABLE VIEW (>= lg: 1024px and above)
          Uses full available width without hardcoded min-w-[960px].
          Balanced column proportions; Record & Details wraps naturally.
         ───────────────────────────────────────────────────────────── */}
      <div className="hidden lg:block w-full">
        <table className="w-full border-collapse text-left table-fixed">
          <thead>
            <tr className="border-b border-border/70 bg-muted/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <th scope="col" className="py-3.5 pl-4 pr-2 w-[15%]">
                <SortHeaderButton
                  sortKey="createdAt"
                  currentSortKey={sortKey}
                  currentDirection={sortDirection}
                  onSort={onSort}
                >
                  Timestamp (IST)
                </SortHeaderButton>
              </th>
              <th scope="col" className="px-2 py-3.5 w-[14%]">
                <SortHeaderButton
                  sortKey="userName"
                  currentSortKey={sortKey}
                  currentDirection={sortDirection}
                  onSort={onSort}
                >
                  User / Actor
                </SortHeaderButton>
              </th>
              <th scope="col" className="px-2 py-3.5 w-[12%]">
                <SortHeaderButton
                  sortKey="action"
                  currentSortKey={sortKey}
                  currentDirection={sortDirection}
                  onSort={onSort}
                >
                  Action
                </SortHeaderButton>
              </th>
              <th scope="col" className="px-3 py-3.5 w-[33%]">
                <SortHeaderButton
                  sortKey="resourceName"
                  currentSortKey={sortKey}
                  currentDirection={sortDirection}
                  onSort={onSort}
                >
                  Record &amp; Details
                </SortHeaderButton>
              </th>
              <th scope="col" className="px-2 py-3.5 w-[12%]">
                <SortHeaderButton
                  sortKey="ip"
                  currentSortKey={sortKey}
                  currentDirection={sortDirection}
                  onSort={onSort}
                >
                  IP Address
                </SortHeaderButton>
              </th>
              <th scope="col" className="px-2 py-3.5 w-[9%]">
                <SortHeaderButton
                  sortKey="userAgent"
                  currentSortKey={sortKey}
                  currentDirection={sortDirection}
                  onSort={onSort}
                >
                  Client
                </SortHeaderButton>
              </th>
              <th scope="col" className="py-3.5 pl-2 pr-4 text-right w-[5%]">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50 text-xs">
            {logs.map((log) => {
              const actionBadge = getActionBadge(log.action);
              const ActionIcon = actionBadge.icon;
              const resourceBadge = getResourceBadge(log.resource);
              const ResourceIcon = resourceBadge.icon;
              const device = parseDeviceClient(log.userAgent);
              const isSelected = selectedLogId === log._id;
              const relativeTime = formatRelativeTime(log.createdAt);

              const formattedIp =
                log.ip === "::1" || log.ip === "127.0.0.1"
                  ? "127.0.0.1"
                  : log.ip || "—";

              return (
                <tr
                  key={log._id}
                  onClick={() => onSelectLog(log)}
                  className={cn(
                    "group cursor-pointer transition-colors duration-150",
                    isSelected
                      ? "bg-primary/5 hover:bg-primary/10"
                      : "hover:bg-muted/40"
                  )}
                >
                  {/* Timestamp */}
                  <td className="py-3 pl-4 pr-2 align-top">
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground text-xs leading-snug">
                        {formatAuditIST(log.createdAt)}
                      </span>
                      {relativeTime && (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono mt-0.5">
                          <Clock size={10} className="shrink-0" />
                          <span className="truncate">{relativeTime}</span>
                        </span>
                      )}
                    </div>
                  </td>

                  {/* User / Actor */}
                  <td className="px-2 py-3 align-top">
                    <div className="flex items-start gap-2 min-w-0">
                      <div
                        className={cn(
                          "grid size-6 shrink-0 place-items-center rounded-full border text-[10px] font-bold mt-0.5",
                          getUserColor(log.userName)
                        )}
                      >
                        {getUserInitials(log.userName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground text-xs truncate" title={log.userName}>
                          {log.userName}
                        </p>
                        {log.sequence != null && (
                          <span className="inline-block text-[10px] font-mono text-muted-foreground/80">
                            #{log.sequence}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Action Badge */}
                  <td className="px-2 py-3 align-top">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                        actionBadge.className
                      )}
                    >
                      <ActionIcon size={11} strokeWidth={2.2} className="shrink-0" />
                      <span className="truncate">{actionBadge.label}</span>
                    </span>
                  </td>

                  {/* Record & Details — Fluid width, wraps naturally without truncation */}
                  <td className="px-3 py-3 align-top">
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider shrink-0",
                            resourceBadge.className
                          )}
                        >
                          <ResourceIcon size={9} />
                          {resourceBadge.label}
                        </span>
                        <span className="font-semibold text-foreground text-xs break-words">
                          {log.resourceName ?? log.resource}
                        </span>
                      </div>
                      {log.details ? (
                        <p className="text-[11px] text-muted-foreground leading-relaxed break-words line-clamp-2">
                          {log.details}
                        </p>
                      ) : null}
                    </div>
                  </td>

                  {/* IP Address */}
                  <td className="px-2 py-3 align-top">
                    <div className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/30 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground max-w-full">
                      <Globe size={10} className="text-muted-foreground/60 shrink-0" />
                      <span className="truncate" title={formattedIp}>{formattedIp}</span>
                      {log.ip && log.ip !== "—" && (
                        <button
                          type="button"
                          onClick={(e) => handleCopyIp(e, log.ip!)}
                          title="Copy IP address"
                          className="text-muted-foreground hover:text-foreground transition-colors ml-0.5 shrink-0"
                        >
                          {copiedIp === log.ip ? (
                            <Check size={10} className="text-emerald-500" />
                          ) : (
                            <Copy size={10} />
                          )}
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Client / Device */}
                  <td className="px-2 py-3 align-top">
                    <span
                      className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground max-w-full truncate"
                      title={device.summary}
                    >
                      <Laptop size={10} className="text-muted-foreground/60 shrink-0" />
                      <span className="truncate">{device.summary}</span>
                    </span>
                  </td>

                  {/* View Details CTA */}
                  <td className="py-3 pl-2 pr-4 align-top text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectLog(log);
                      }}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold transition-all",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "border-border/80 bg-background text-foreground hover:border-primary/50 hover:bg-primary/5"
                      )}
                    >
                      <Eye size={11} />
                      <span>View</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. TABLET & MOBILE RESPONSIVE STACKED CARD VIEW (< lg)
          Zero horizontal scrolling on tablet, small laptops, and phones.
          Displays all information cleanly in grouped, accessible cards.
         ───────────────────────────────────────────────────────────── */}
      <div className="lg:hidden divide-y divide-border/60">
        {logs.map((log) => {
          const actionBadge = getActionBadge(log.action);
          const ActionIcon = actionBadge.icon;
          const resourceBadge = getResourceBadge(log.resource);
          const ResourceIcon = resourceBadge.icon;
          const device = parseDeviceClient(log.userAgent);
          const isSelected = selectedLogId === log._id;
          const relativeTime = formatRelativeTime(log.createdAt);

          const formattedIp =
            log.ip === "::1" || log.ip === "127.0.0.1"
              ? "127.0.0.1"
              : log.ip || "—";

          return (
            <article
              key={log._id}
              onClick={() => onSelectLog(log)}
              className={cn(
                "p-3.5 sm:p-4 space-y-2.5 transition-colors cursor-pointer",
                isSelected
                  ? "bg-primary/5 hover:bg-primary/10"
                  : "hover:bg-muted/30"
              )}
            >
              {/* Row 1: Actor, Action badge & Timestamp */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full border text-[10px] font-bold",
                      getUserColor(log.userName)
                    )}
                  >
                    {getUserInitials(log.userName)}
                  </div>
                  <span className="font-semibold text-xs text-foreground truncate max-w-[150px]">
                    {log.userName}
                  </span>
                  {log.sequence != null && (
                    <span className="text-[10px] font-mono text-muted-foreground/80">
                      #{log.sequence}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                      actionBadge.className
                    )}
                  >
                    <ActionIcon size={10} strokeWidth={2.2} />
                    <span>{actionBadge.label}</span>
                  </span>

                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {formatAuditIST(log.createdAt)}
                  </span>
                </div>
              </div>

              {/* Row 2: Resource badge & details */}
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider shrink-0",
                      resourceBadge.className
                    )}
                  >
                    <ResourceIcon size={9} />
                    {resourceBadge.label}
                  </span>
                  <span className="font-semibold text-foreground text-xs break-words">
                    {log.resourceName ?? log.resource}
                  </span>
                </div>
                {log.details && (
                  <p className="text-[11px] text-muted-foreground leading-relaxed break-words">
                    {log.details}
                  </p>
                )}
              </div>

              {/* Row 3: IP address, device chip & View button */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40 text-[11px]">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  {/* IP Address */}
                  <div className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/30 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    <Globe size={10} className="text-muted-foreground/60 shrink-0" />
                    <span>{formattedIp}</span>
                    {log.ip && log.ip !== "—" && (
                      <button
                        type="button"
                        onClick={(e) => handleCopyIp(e, log.ip!)}
                        title="Copy IP"
                        className="text-muted-foreground hover:text-foreground transition-colors ml-0.5"
                      >
                        {copiedIp === log.ip ? (
                          <Check size={10} className="text-emerald-500" />
                        ) : (
                          <Copy size={10} />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Device */}
                  <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground truncate max-w-[140px]">
                    <Laptop size={10} className="text-muted-foreground/60 shrink-0" />
                    <span className="truncate">{device.summary}</span>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectLog(log);
                  }}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-all shrink-0",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border/80 bg-background text-foreground hover:border-primary/50 hover:bg-primary/5"
                  )}
                >
                  <Eye size={11} />
                  <span>View Details</span>
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
