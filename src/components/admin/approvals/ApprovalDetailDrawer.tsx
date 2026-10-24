import React, { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusPill } from "@/components/common/StatusPill";
import {
  Calendar,
  Clock,
  User,
  Briefcase,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Download,
  Check,
  X,
  Loader2,
  ListTodo,
  History,
  ShieldCheck,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import type { ApprovalItem } from "@/services/admin";
import { iconForKind, priorityBadge, agingBadge } from "./ApprovalTable";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

interface ApprovalDetailDrawerProps {
  item: ApprovalItem | null;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (item: ApprovalItem) => void;
  onReject: (item: ApprovalItem) => void;
  isProcessing?: boolean;
}

export function ApprovalDetailDrawer({
  item,
  isOpen,
  onClose,
  onApprove,
  onReject,
  isProcessing = false,
}: ApprovalDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<string>("overview");

  if (!item) return null;

  const Icon = iconForKind(item.kind);
  const priorityInfo = priorityBadge(item.priority);
  const agingInfo = agingBadge(item.agingLabel, item.status);
  const displayStatus = item.status || "pending";

  const task = item.taskDetails;
  const doc = item.documentDetails;
  const req = item.requestDetails;
  const caseData = task?.case || doc?.case || item.caseDetails || (item.requestDetails as any)?.case;
  const clientData = task?.client || doc?.client;

  // Subtask statistics
  const totalSubtasks = task?.checklist?.length ?? 0;
  const doneSubtasks = task?.checklist?.filter((c) => c.done).length ?? 0;
  const subtaskProgress = totalSubtasks > 0 ? Math.round((doneSubtasks / totalSubtasks) * 100) : 0;

  const formattedDate = item.when
    ? new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(item.when))
    : "—";

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl p-0 flex flex-col bg-card border-l border-border shadow-2xl z-50 overflow-hidden"
      >
        {/* Drawer Header */}
        <div className="p-5 sm:p-6 border-b border-border bg-card/60 backdrop-blur-sm shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                {item.kind}
              </span>
              <span
                className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border",
                  priorityInfo.className
                )}
              >
                {priorityInfo.label}
              </span>
            </div>
            <div>
              {displayStatus === "pending" ? (
                <StatusPill tone="amber">Pending Review</StatusPill>
              ) : displayStatus === "approved" ? (
                <StatusPill tone="emerald">Approved & Completed</StatusPill>
              ) : (
                <StatusPill tone="rose">Changes Requested</StatusPill>
              )}
            </div>
          </div>

          <SheetTitle className="text-lg sm:text-xl font-bold text-foreground tracking-tight leading-snug">
            {item.title}
          </SheetTitle>

          <SheetDescription className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1">
              <Clock size={13} className="text-muted-foreground/80" />
              {formattedDate}
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
            {item._id && (
              <>
                <span>•</span>
                <span className="font-mono text-[11px] text-muted-foreground/70">
                  ID: {item._id.slice(0, 16)}…
                </span>
              </>
            )}
          </SheetDescription>
        </div>

        {/* Navigation Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col min-h-0"
        >
          <div className="px-5 border-b border-border bg-muted/20 shrink-0">
            <TabsList className="bg-transparent p-0 h-10 gap-4">
              <TabsTrigger
                value="overview"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Overview
              </TabsTrigger>
              {totalSubtasks > 0 && (
                <TabsTrigger
                  value="subtasks"
                  className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-1 text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1.5"
                >
                  Subtasks
                  <span className="size-4 rounded-full bg-primary/10 text-primary text-[10px] font-bold grid place-items-center">
                    {totalSubtasks}
                  </span>
                </TabsTrigger>
              )}
              <TabsTrigger
                value="documents"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Documents
              </TabsTrigger>
              <TabsTrigger
                value="activity"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Activity
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
            {/* OVERVIEW TAB */}
            <TabsContent value="overview" className="mt-0 space-y-5">
              {/* Prior Rejection / Changes Requested Notice */}
              {item.rejectionReason && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-rose-700 dark:text-rose-300">
                    <AlertTriangle size={15} />
                    <span>Previous Feedback / Changes Requested</span>
                  </div>
                  <p className="text-rose-900 dark:text-rose-100 italic bg-background/50 p-2.5 rounded-lg border border-rose-500/20">
                    "{item.rejectionReason}"
                  </p>
                  {item.reviewedBy?.name && (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400">
                      Returned by {item.reviewedBy.name}
                    </p>
                  )}
                </div>
              )}

              {/* Description / Context */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Request Context
                </h4>
                <div className="p-3.5 rounded-xl border border-border/80 bg-muted/30 text-sm text-foreground">
                  <p className="whitespace-pre-wrap leading-relaxed">
                    {task?.description || req?.reason || item.context || "No additional description provided."}
                  </p>
                </div>
              </div>

              {/* People Involved Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 space-y-1">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Submitted By
                  </span>
                  <div className="flex items-center gap-2.5 pt-1">
                    {item.submittedBy?.avatarUrl ? (
                      <img
                        src={item.submittedBy.avatarUrl}
                        alt={item.submittedBy.name}
                        className="size-8 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="size-8 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-bold shrink-0">
                        {item.submittedBy?.name
                          ? item.submittedBy.name
                              .split(" ")
                              .map((w) => w[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()
                          : "U"}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {item.submittedBy?.name || "Employee"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.submittedBy?.email || item.submittedBy?.role || "Staff"}
                      </p>
                    </div>
                  </div>
                </div>

                {task?.assignedTo && (
                  <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 space-y-1">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      Assigned Assignee
                    </span>
                    <div className="flex items-center gap-2.5 pt-1">
                      <div className="size-8 rounded-full bg-blue-500/10 text-blue-600 grid place-items-center text-xs font-bold shrink-0">
                        {task.assignedTo.name
                          ? task.assignedTo.name
                              .split(" ")
                              .map((w) => w[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()
                          : "A"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {task.assignedTo.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate capitalize">
                          {task.assignedTo.role?.replace(/_/g, " ") || "Assignee"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Related Entity Links */}
              <div className="space-y-2 pt-1">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Associated Records
                </h4>

                <div className="space-y-2">
                  {caseData && caseData._id ? (
                    <Link
                      to="/cases/$caseId"
                      params={{ caseId: caseData._id }}
                      className="group flex items-center justify-between p-3 rounded-xl border border-border/80 bg-card hover:border-primary/40 hover:bg-muted/30 transition-all text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="grid size-7 place-items-center rounded-lg bg-blue-500/10 text-blue-600 shrink-0">
                          <Briefcase size={14} />
                        </span>
                        <div className="min-w-0">
                          <span className="font-semibold text-foreground group-hover:text-primary transition-colors truncate block">
                            {caseData.number} — {caseData.title}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            Click to open case dossier
                          </span>
                        </div>
                      </div>
                      <ExternalLink size={14} className="text-muted-foreground group-hover:text-primary shrink-0" />
                    </Link>
                  ) : null}

                  {clientData && clientData._id ? (
                    <Link
                      to="/clients/$clientId"
                      params={{ clientId: clientData._id }}
                      className="group flex items-center justify-between p-3 rounded-xl border border-border/80 bg-card hover:border-primary/40 hover:bg-muted/30 transition-all text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="grid size-7 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 shrink-0">
                          <User size={14} />
                        </span>
                        <div className="min-w-0">
                          <span className="font-semibold text-foreground group-hover:text-primary transition-colors truncate block">
                            {clientData.name}
                          </span>
                          {clientData.phone && (
                            <span className="text-[11px] text-muted-foreground">
                              {clientData.phone}
                            </span>
                          )}
                        </div>
                      </div>
                      <ExternalLink size={14} className="text-muted-foreground group-hover:text-primary shrink-0" />
                    </Link>
                  ) : null}
                </div>
              </div>

              {/* Task Details Metadata if Task */}
              {task && (
                <div className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Category:</span>
                    <span className="font-medium text-foreground">
                      {[task.mainCategory, task.category, task.subCategory].filter(Boolean).join(" › ") ||
                        task.category ||
                        "General Legal Work"}
                    </span>
                  </div>
                  {task.deadline && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Deadline:</span>
                      <span className="font-medium text-foreground">
                        {new Intl.DateTimeFormat("en-IN", {
                          timeZone: "Asia/Kolkata",
                          dateStyle: "medium",
                        }).format(new Date(task.deadline))}
                      </span>
                    </div>
                  )}
                  {task.completedAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Completed At:</span>
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">
                        {new Intl.DateTimeFormat("en-IN", {
                          timeZone: "Asia/Kolkata",
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(task.completedAt))}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* SUBTASKS TAB */}
            {totalSubtasks > 0 && (
              <TabsContent value="subtasks" className="mt-0 space-y-5">
                <div className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">Completion Progress</span>
                    <span className="font-bold text-primary">
                      {doneSubtasks} / {totalSubtasks} done ({subtaskProgress}%)
                    </span>
                  </div>
                  <Progress value={subtaskProgress} className="h-2" />
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Checklist Items
                  </h4>
                  <div className="space-y-2">
                    {task?.checklist?.map((item, idx) => (
                      <div
                        key={item._id || item.id || idx}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-xl border transition-all text-xs",
                          item.done
                            ? "border-emerald-500/30 bg-emerald-500/5 text-foreground"
                            : "border-border/80 bg-card text-muted-foreground"
                        )}
                      >
                        <span
                          className={cn(
                            "grid size-5 rounded shrink-0 place-items-center mt-0.5",
                            item.done
                              ? "bg-emerald-600 text-white"
                              : "border border-border bg-background"
                          )}
                        >
                          {item.done && <Check size={12} strokeWidth={3} />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "font-medium",
                              item.done && "line-through text-muted-foreground"
                            )}
                          >
                            {item.text}
                          </p>
                          {item.remarks && (
                            <p className="text-[11px] text-muted-foreground italic mt-0.5">
                              Note: {item.remarks}
                            </p>
                          )}
                        </div>
                        <span
                          className={cn(
                            "text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0",
                            item.done
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                              : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                          )}
                        >
                          {item.done ? "Done" : "Pending"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            )}

            {/* DOCUMENTS TAB */}
            <TabsContent value="documents" className="mt-0 space-y-4">
              {doc ? (
                <div className="p-4 rounded-xl border border-border/80 bg-card shadow-soft space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
                      <FileText size={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-sm text-foreground truncate">
                        {doc.name}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {doc.sizeFormatted || "Document"} • {doc.mimeType || "application/pdf"}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Status: <strong className="text-foreground">{doc.state || "Pending Review"}</strong>
                    </span>
                    <a
                      href={`/api/documents/${doc._id}/download`}
                      download
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-soft transition-colors"
                    >
                      <Download size={13} />
                      Download file
                    </a>
                  </div>
                </div>
              ) : (
                <div className="p-8 rounded-xl border border-dashed border-border text-center space-y-2">
                  <FileText size={32} className="mx-auto text-muted-foreground/40" />
                  <p className="text-xs font-medium text-muted-foreground">
                    No dedicated document upload attached to this request.
                  </p>
                  {caseData?._id && (
                    <Link
                      to="/cases/$caseId"
                      params={{ caseId: caseData._id }}
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
                    >
                      Inspect case documents <ArrowRight size={12} />
                    </Link>
                  )}
                </div>
              )}
            </TabsContent>

            {/* ACTIVITY TAB */}
            <TabsContent value="activity" className="mt-0 space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-xl border border-border/60 bg-muted/20 text-xs">
                  <span className="grid size-7 place-items-center rounded-full bg-blue-500/10 text-blue-600 shrink-0 mt-0.5">
                    <Calendar size={13} />
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">Request Submitted</p>
                    <p className="text-muted-foreground text-[11px] mt-0.5">
                      Submitted on {formattedDate} by {item.submittedBy?.name || "Employee"}
                    </p>
                  </div>
                </div>

                {task?.assignmentHistory?.map((hist, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 rounded-xl border border-border/60 bg-muted/20 text-xs"
                  >
                    <span className="grid size-7 place-items-center rounded-full bg-primary/10 text-primary shrink-0 mt-0.5">
                      <ArrowRight size={13} />
                    </span>
                    <div>
                      <p className="font-semibold text-foreground capitalize">
                        {hist.action || "Task Assignment"}
                      </p>
                      {hist.note && (
                        <p className="text-muted-foreground text-[11px] mt-0.5 italic">
                          "{hist.note}"
                        </p>
                      )}
                      <p className="text-muted-foreground text-[10px] mt-1">
                        {new Intl.DateTimeFormat("en-IN", {
                          timeZone: "Asia/Kolkata",
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(new Date(hist.timestamp))}
                      </p>
                    </div>
                  </div>
                ))}

                {task?.remarks?.map((rem, idx) => (
                  <div
                    key={rem._id || idx}
                    className="flex items-start gap-3 p-3 rounded-xl border border-border/60 bg-muted/20 text-xs"
                  >
                    <span className="grid size-7 place-items-center rounded-full bg-purple-500/10 text-purple-600 shrink-0 mt-0.5">
                      <History size={13} />
                    </span>
                    <div>
                      <p className="font-semibold text-foreground">{rem.author || "Comment"}</p>
                      <p className="text-muted-foreground text-[11px] mt-0.5">{rem.text}</p>
                      <p className="text-muted-foreground text-[10px] mt-1">
                        {new Intl.DateTimeFormat("en-IN", {
                          timeZone: "Asia/Kolkata",
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(new Date(rem.createdAt))}
                      </p>
                    </div>
                  </div>
                ))}

                {item.reviewedAt && (
                  <div className="flex items-start gap-3 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs">
                    <span className="grid size-7 place-items-center rounded-full bg-emerald-600 text-white shrink-0 mt-0.5">
                      <ShieldCheck size={13} />
                    </span>
                    <div>
                      <p className="font-semibold text-emerald-800 dark:text-emerald-200">
                        Administrative Decision Logged
                      </p>
                      <p className="text-emerald-700 dark:text-emerald-300 text-[11px] mt-0.5">
                        Status: <strong className="capitalize">{item.status}</strong> on{" "}
                        {new Intl.DateTimeFormat("en-IN", {
                          timeZone: "Asia/Kolkata",
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(item.reviewedAt))}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>

        {/* Sticky Action Footer */}
        <div className="p-4 sm:p-5 border-t border-border bg-card/95 backdrop-blur-sm shrink-0 flex items-center justify-between gap-3">
          {displayStatus === "pending" ? (
            <>
              <Button
                variant="outline"
                disabled={isProcessing}
                onClick={() => onReject(item)}
                className="text-xs h-10 px-4 border-rose-500/40 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
              >
                <X size={15} className="mr-1.5" />
                Reject / Request Changes
              </Button>
              <Button
                variant="default"
                disabled={isProcessing}
                onClick={() => onApprove(item)}
                className="text-xs h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-soft"
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={15} className="mr-1.5 animate-spin" />
                    Processing…
                  </>
                ) : (
                  <>
                    <Check size={15} className="mr-1.5" />
                    Approve & Sign Off
                  </>
                )}
              </Button>
            </>
          ) : (
            <div className="w-full flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                {displayStatus === "approved" ? (
                  <CheckCircle2 size={16} className="text-emerald-600" />
                ) : (
                  <XCircle size={16} className="text-rose-600" />
                )}
                This request has been {displayStatus}.
              </span>
              <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
                Close
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
