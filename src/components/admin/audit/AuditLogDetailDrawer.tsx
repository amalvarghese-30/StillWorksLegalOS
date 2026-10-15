import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Copy,
  Check,
  Globe,
  Laptop,
  ExternalLink,
  GitCommit,
  ArrowRight,
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

interface AuditLogDetailDrawerProps {
  log: AuditLogItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function AuditLogDetailDrawer({
  log,
  isOpen,
  onClose,
}: AuditLogDetailDrawerProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!log) return null;

  const actionBadge = getActionBadge(log.action);
  const ActionIcon = actionBadge.icon;
  const resourceBadge = getResourceBadge(log.resource);
  const ResourceIcon = resourceBadge.icon;
  const device = parseDeviceClient(log.userAgent);
  const relativeTime = formatRelativeTime(log.createdAt);

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const diffs = Array.isArray(log.metadata?.diffs) ? log.metadata.diffs : null;
  const otherMetadata =
    log.metadata &&
    Object.keys(log.metadata).filter((k) => k !== "diffs").length > 0
      ? Object.fromEntries(
          Object.entries(log.metadata).filter(([k]) => k !== "diffs")
        )
      : null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto p-0 bg-card border-l border-border/80 shadow-2xl"
      >
        {/* Drawer Header */}
        <div className="sticky top-0 z-20 border-b border-border/80 bg-card/95 backdrop-blur px-6 py-5">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold",
                  actionBadge.className
                )}
              >
                <ActionIcon size={13} strokeWidth={2.2} />
                {actionBadge.label}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wider",
                  resourceBadge.className
                )}
              >
                <ResourceIcon size={12} />
                {resourceBadge.label}
              </span>
            </div>

          </div>

          <SheetTitle className="text-lg font-bold text-foreground truncate">
            {log.resourceName ?? log.resource}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
            <span>{formatAuditIST(log.createdAt)}</span>
            {relativeTime && (
              <>
                <span>•</span>
                <span className="font-mono">{relativeTime}</span>
              </>
            )}
          </SheetDescription>
        </div>

        {/* Drawer Body */}
        <div className="space-y-6 px-6 py-6 text-sm">
          {/* Section 1: Event Summary */}
          <div className="rounded-2xl border border-border/80 bg-background/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Event Summary
              </h4>
              <span className="text-[11px] font-mono text-muted-foreground">
                ID: {log._id.slice(-8)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground">Action Verb</span>
                <p className="font-semibold text-foreground mt-0.5 capitalize">
                  {log.action.replace(/_/g, " ")}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Target Resource</span>
                <p className="font-semibold text-foreground mt-0.5 capitalize">
                  {log.resource}
                </p>
              </div>
              {log.resourceName && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Resource Title</span>
                  <p className="font-semibold text-foreground mt-0.5 break-words">
                    {log.resourceName}
                  </p>
                </div>
              )}
              {log.resourceId && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Resource Identifier</span>
                  <div className="flex items-center justify-between mt-0.5 rounded-lg border border-border/60 bg-card px-2.5 py-1.5 font-mono text-[11px] text-foreground">
                    <span className="truncate">{log.resourceId}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy("resourceId", log.resourceId!)}
                      className="text-muted-foreground hover:text-foreground transition-colors ml-2"
                    >
                      {copiedKey === "resourceId" ? (
                        <Check size={12} className="text-emerald-500" />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {log.details && (
              <div className="border-t border-border/60 pt-3 mt-3">
                <span className="text-xs text-muted-foreground">Recorded Details</span>
                <p className="mt-1 text-xs text-foreground bg-card p-3 rounded-xl border border-border/60 leading-relaxed font-normal">
                  {log.details}
                </p>
              </div>
            )}
          </div>

          {/* Section 2: Actor Details */}
          <div className="rounded-2xl border border-border/80 bg-background/50 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Actor & Attribution
            </h4>

            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary font-bold text-sm">
                {log.userName.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                  <p className="font-bold text-foreground text-sm">{log.userName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                    {log.action.replace(/_/g, " ")} · {log.resource}
                  </p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
              <div className="rounded-xl border border-border/60 bg-card p-2.5">
                <div className="flex items-center justify-between text-muted-foreground mb-1">
                  <span className="flex items-center gap-1 text-[11px]">
                    <Globe size={11} /> IP Address
                  </span>
                  {log.ip && (
                    <button
                      type="button"
                      onClick={() => handleCopy("ip", log.ip!)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {copiedKey === "ip" ? (
                        <Check size={11} className="text-emerald-500" />
                      ) : (
                        <Copy size={11} />
                      )}
                    </button>
                  )}
                </div>
                <p className="font-mono font-semibold text-foreground text-xs truncate">
                  {log.ip || "Unknown"}
                </p>
              </div>

              <div className="rounded-xl border border-border/60 bg-card p-2.5">
                <div className="text-muted-foreground mb-1 flex items-center gap-1 text-[11px]">
                  <Laptop size={11} /> Client Device
                </div>
                <p className="font-semibold text-foreground text-xs truncate">
                  {device.summary}
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Before-and-After Changes & Diffs */}
          <div className="rounded-2xl border border-border/80 bg-background/50 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <GitCommit size={13} />
              State Changes & Diff Trail
            </h4>

            {diffs && diffs.length > 0 ? (
              <div className="space-y-2">
                {diffs.map((diff, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 rounded-xl border border-blue-500/20 bg-blue-50/40 dark:bg-blue-950/20 p-2.5 text-xs text-foreground"
                  >
                    <span className="grid size-4 shrink-0 place-items-center rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 mt-0.5 text-[10px]">
                      •
                    </span>
                    <span className="leading-relaxed font-medium">{diff}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic bg-card p-3 rounded-xl border border-border/60">
                No detailed field changes recorded for this event.
              </p>
            )}
          </div>

          {/* Section 4: Related Records Link */}
          {log.resourceId && (
            <div className="rounded-2xl border border-border/80 bg-background/50 p-4 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Related Record Access
              </h4>
              <p className="text-xs text-muted-foreground">
                Inspect the affected entity directly in its operational workspace.
              </p>

              {log.resource === "case" ? (
                <Link
                  to="/cases/$caseId"
                  params={{ caseId: log.resourceId }}
                  className="mt-2 inline-flex items-center justify-between w-full rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 px-4 py-2.5 text-xs font-semibold text-primary transition-all group"
                >
                  <span className="flex items-center gap-2">
                    <ExternalLink size={13} />
                    Open Case File ({log.resourceName ?? log.resourceId})
                  </span>
                  <ArrowRight
                    size={14}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </Link>
              ) : log.resource === "task" ? (
                <Link
                  to="/tasks"
                  search={log.resourceName ? { q: log.resourceName } : {}}
                  className="mt-2 inline-flex items-center justify-between w-full rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 px-4 py-2.5 text-xs font-semibold text-primary transition-all group"
                >
                  <span className="flex items-center gap-2">
                    <ExternalLink size={13} />
                    View Task: {log.resourceName ?? "Open Tasks Board"}
                  </span>
                  <ArrowRight
                    size={14}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </Link>
              ) : log.resource === "client" ? (
                <Link
                  to="/clients/$clientId"
                  params={{ clientId: log.resourceId }}
                  className="mt-2 inline-flex items-center justify-between w-full rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 px-4 py-2.5 text-xs font-semibold text-primary transition-all group"
                >
                  <span className="flex items-center gap-2">
                    <ExternalLink size={13} />
                    Open Client Dossier ({log.resourceName ?? log.resourceId})
                  </span>
                  <ArrowRight
                    size={14}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </Link>
              ) : log.resource === "document" ? (
                <Link
                  to="/documents"
                  className="mt-2 inline-flex items-center justify-between w-full rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 px-4 py-2.5 text-xs font-semibold text-primary transition-all group"
                >
                  <span className="flex items-center gap-2">
                    <ExternalLink size={13} />
                    Open Document Vault
                  </span>
                  <ArrowRight
                    size={14}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </Link>
              ) : log.resource === "approval" ? (
                <Link
                  to="/admin/approvals"
                  className="mt-2 inline-flex items-center justify-between w-full rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 px-4 py-2.5 text-xs font-semibold text-primary transition-all group"
                >
                  <span className="flex items-center gap-2">
                    <ExternalLink size={13} />
                    Open Approval Centre
                  </span>
                  <ArrowRight
                    size={14}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </Link>
              ) : null}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
