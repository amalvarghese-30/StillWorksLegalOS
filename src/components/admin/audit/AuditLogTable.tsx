import React, { useState } from "react";
import {
  Eye,
  Copy,
  Check,
  ScrollText,
  Clock,
  Laptop,
  Globe,
  CornerDownRight,
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

interface AuditLogTableProps {
  logs: AuditLogItem[];
  isLoading: boolean;
  onSelectLog: (log: AuditLogItem) => void;
  selectedLogId?: string;
  onResetFilters?: () => void;
  hasActiveFilters?: boolean;
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
        <div className="divide-y divide-border/60">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 animate-pulse">
              <div className="h-4 w-32 rounded bg-muted/60" />
              <div className="size-8 rounded-full bg-muted/60" />
              <div className="h-4 w-28 rounded bg-muted/60" />
              <div className="h-6 w-20 rounded-full bg-muted/50" />
              <div className="h-4 flex-1 rounded bg-muted/50" />
              <div className="h-4 w-24 rounded bg-muted/40" />
              <div className="h-4 w-28 rounded bg-muted/40" />
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
      <div className="overflow-x-auto touch-scroll">
        <table className="w-full min-w-[960px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border/70 bg-muted/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <th className="py-3.5 pl-4 pr-3">Timestamp (IST)</th>
              <th className="px-3 py-3.5">User / Actor</th>
              <th className="px-3 py-3.5">Action</th>
              <th className="px-3 py-3.5">Record & Details</th>
              <th className="px-3 py-3.5">IP Address</th>
              <th className="px-3 py-3.5">Client / Device</th>
              <th className="py-3.5 pl-3 pr-4 text-right">Details</th>
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
                  ? "127.0.0.1 (Local)"
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
                  <td className="py-3 pl-4 pr-3 align-middle">
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground whitespace-nowrap">
                        {formatAuditIST(log.createdAt)}
                      </span>
                      {relativeTime && (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono mt-0.5">
                          <Clock size={10} /> {relativeTime}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* User */}
                  <td className="px-3 py-3 align-middle">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={cn(
                          "grid size-7 shrink-0 place-items-center rounded-full border text-[11px] font-bold",
                          getUserColor(log.userName)
                        )}
                      >
                        {getUserInitials(log.userName)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate max-w-[140px]">
                          {log.userName}
                        </p>
                        {log.sequence != null && (
                          <span className="text-[10px] font-mono text-muted-foreground">
                            #{log.sequence}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Action Badge */}
                  <td className="px-3 py-3 align-middle whitespace-nowrap">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                        actionBadge.className
                      )}
                    >
                      <ActionIcon size={12} strokeWidth={2.2} />
                      {actionBadge.label}
                    </span>
                  </td>

                  {/* Record & Details */}
                  <td className="px-3 py-3 align-middle">
                    <div className="flex flex-col gap-1 max-w-[340px]">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                            resourceBadge.className
                          )}
                        >
                          <ResourceIcon size={10} />
                          {resourceBadge.label}
                        </span>
                        <span className="font-semibold text-foreground truncate text-xs">
                          {log.resourceName ?? log.resource}
                        </span>
                      </div>
                      {log.details ? (
                        <p className="text-[11px] text-muted-foreground truncate leading-relaxed">
                          {log.details}
                        </p>
                      ) : null}
                    </div>
                  </td>

                  {/* IP Address */}
                  <td className="px-3 py-3 align-middle whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-muted/30 px-2 py-1 font-mono text-[11px] text-muted-foreground">
                      <Globe size={11} className="text-muted-foreground/60" />
                      <span>{formattedIp}</span>
                      {log.ip && log.ip !== "—" && (
                        <button
                          type="button"
                          onClick={(e) => handleCopyIp(e, log.ip!)}
                          title="Copy IP address"
                          className="text-muted-foreground hover:text-foreground transition-colors ml-0.5"
                        >
                          {copiedIp === log.ip ? (
                            <Check size={11} className="text-emerald-500" />
                          ) : (
                            <Copy size={11} />
                          )}
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Device / Client */}
                  <td className="px-3 py-3 align-middle whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-card px-2 py-1 text-[11px] font-medium text-muted-foreground">
                      <Laptop size={12} className="text-muted-foreground/60" />
                      {device.summary}
                    </span>
                  </td>

                  {/* View Details Button */}
                  <td className="py-3 pl-3 pr-4 align-middle text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectLog(log);
                      }}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "border-border/80 bg-background text-foreground hover:border-primary/50 hover:bg-primary/5"
                      )}
                    >
                      <Eye size={12} />
                      <span>View</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
