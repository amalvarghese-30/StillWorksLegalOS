import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ShieldCheck,
  CheckSquare,
  FileText,
  KeyRound,
  Briefcase,
  ArrowRight,
  Check,
  X,
  AlertTriangle,
  Eye,
  User,
  ShieldAlert,
  Clock,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  useApprovals,
  useApproveRequest,
  useRejectRequest,
  type ApprovalItem,
} from "@/services/admin";
import { useUpdateDocument, useReviewAccessRequest } from "@/services/documents";
import { useReviewCaseAccessRequest } from "@/services/cases";
import { useApproveTask, useRejectTask, useUpdateTask, taskKeys } from "@/services/tasks";
import { reportKeys } from "@/services/reports";
import { ApprovalDetailDrawer } from "@/components/admin/approvals/ApprovalDetailDrawer";
import { ApprovalRejectModal } from "@/components/admin/approvals/ApprovalRejectModal";
import { cn } from "@/lib/utils";

type FilterTab = "All" | "Task Completions" | "Documents" | "Access & Other";

function iconFor(kind: string) {
  const k = kind?.toLowerCase() || "";
  if (k.includes("delete")) return ShieldAlert;
  if (k.includes("task") || k.includes("completion")) return CheckSquare;
  if (k.includes("doc") || k.includes("purge")) return FileText;
  if (k.includes("access")) return KeyRound;
  if (k.includes("reassign") || k.includes("forward")) return ArrowRight;
  return ShieldCheck;
}

function parseTarget(a: ApprovalItem): { docId?: string; caseId?: string; requestId?: string; taskId?: string } {
  if (a.kind === "Task Completion" || a._id.startsWith("task_")) {
    return { taskId: a._id.replace(/^task_/, "") };
  }
  if (a.kind === "Case Request" || a._id.startsWith("case_")) {
    const marker = "_access_";
    const withoutPrefix = a._id.replace(/^case_/, "");
    const idx = withoutPrefix.indexOf(marker);
    if (idx >= 0) {
      return { caseId: withoutPrefix.slice(0, idx), requestId: withoutPrefix.slice(idx + marker.length) };
    }
  }
  if (a.kind === "Access Request") {
    const marker = "_access_";
    const idx = a._id.indexOf(marker);
    if (idx >= 0) {
      return { docId: a._id.slice(0, idx), requestId: a._id.slice(idx + marker.length) };
    }
  }
  return { docId: a._id };
}

export function AdminApprovalQueue() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useApprovals();
  const approvals = data?.approvals ?? [];

  const [activeTab, setActiveTab] = useState<FilterTab>("All");
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // Detail Drawer State
  const [selectedDrawerItem, setSelectedDrawerItem] = useState<ApprovalItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Rejection Modal State
  const [rejectModalItem, setRejectModalItem] = useState<ApprovalItem | null>(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

  // Mutations
  const approveTask = useApproveTask();
  const rejectTask = useRejectTask();
  const updateTask = useUpdateTask();
  const approveRequest = useApproveRequest();
  const rejectRequest = useRejectRequest();
  const updateDocument = useUpdateDocument();
  const reviewAccessRequest = useReviewAccessRequest();
  const reviewCaseAccessRequest = useReviewCaseAccessRequest();

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["admin", "approvals"] });
    qc.invalidateQueries({ queryKey: taskKeys.all });
    qc.invalidateQueries({ queryKey: reportKeys.all });
    qc.invalidateQueries({ queryKey: ["cases"] });
    qc.invalidateQueries({ queryKey: ["documents"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  // Filter logic
  const filteredApprovals = approvals.filter((item) => {
    if (activeTab === "Task Completions") return item.kind === "Task Completion";
    if (activeTab === "Documents") return item.kind === "Document Upload";
    if (activeTab === "Access & Other") return item.kind !== "Task Completion" && item.kind !== "Document Upload";
    return true;
  });

  const handleOpenItem = (item: ApprovalItem) => {
    setSelectedDrawerItem(item);
    setIsDrawerOpen(true);
  };

  const handleApprove = async (item: ApprovalItem) => {
    const itemId = item._id;
    setProcessingIds((prev) => new Set(prev).add(itemId));
    const toastId = `approve-${itemId}`;
    toast.loading("Approving request…", { id: toastId });

    try {
      const rawId = item.rawApprovalId || (itemId.startsWith("approval_req_") ? itemId.replace(/^approval_req_/, "") : null);

      if (rawId) {
        await approveRequest.mutateAsync({ id: rawId, decisionRemark: "Approved by administrator" });
      } else {
        const target = parseTarget(item);

        if (target.taskId) {
          try {
            await approveTask.mutateAsync({ taskId: target.taskId });
          } catch {
            await updateTask.mutateAsync({
              id: target.taskId,
              data: { status: "completed" },
            });
          }
        } else if (target.caseId && target.requestId) {
          await reviewCaseAccessRequest.mutateAsync({
            caseId: target.caseId,
            requestId: target.requestId,
            status: "approved",
          });
        } else if (target.requestId) {
          await reviewAccessRequest.mutateAsync({
            docId: target.docId!,
            requestId: target.requestId,
            status: "approved",
          });
        } else {
          await updateDocument.mutateAsync({
            id: target.docId!,
            data: { state: "Approved" },
          });
        }
      }

      toast.success("Request successfully approved!", { id: toastId });
      invalidateAll();
      setIsDrawerOpen(false);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Could not approve this request.";
      toast.error(msg, { id: toastId });
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handleConfirmReject = async (item: ApprovalItem, reason: string) => {
    const itemId = item._id;
    setProcessingIds((prev) => new Set(prev).add(itemId));
    const toastId = `reject-${itemId}`;
    toast.loading("Recording rejection…", { id: toastId });

    try {
      const rawId = item.rawApprovalId || (itemId.startsWith("approval_req_") ? itemId.replace(/^approval_req_/, "") : null);

      if (rawId) {
        await rejectRequest.mutateAsync({ id: rawId, decisionRemark: reason });
      } else {
        const target = parseTarget(item);

        if (target.taskId) {
          try {
            await rejectTask.mutateAsync({ taskId: target.taskId, reason });
          } catch {
            await updateTask.mutateAsync({
              id: target.taskId,
              data: {
                status: "in_progress",
                rejectionReason: reason,
                reason,
              },
            });
          }
        } else if (target.caseId && target.requestId) {
          await reviewCaseAccessRequest.mutateAsync({
            caseId: target.caseId,
            requestId: target.requestId,
            status: "rejected",
          });
        } else if (target.requestId) {
          await reviewAccessRequest.mutateAsync({
            docId: target.docId!,
            requestId: target.requestId,
            status: "rejected",
          });
        } else {
          await updateDocument.mutateAsync({
            id: target.docId!,
            data: { state: "Rejected" },
          });
        }
      }

      toast.success("Request rejected.", { id: toastId });
      invalidateAll();
      setIsRejectModalOpen(false);
      setIsDrawerOpen(false);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Could not reject this request.";
      toast.error(msg, { id: toastId });
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  return (
    <section className="flex flex-col rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-soft transition-all duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-border/60">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-900/50 shadow-2xs">
            <FileText size={18} strokeWidth={2} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                Approval queue
              </h2>
              {approvals.length > 0 && (
                <span className="inline-flex items-center justify-center rounded-full bg-rose-500 text-white px-2 py-0.5 text-[11px] font-bold">
                  {approvals.length}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Requests waiting for your review and action. Click any item for full details.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl border-primary/30 text-primary hover:bg-primary/5 hover:text-primary gap-1.5 text-xs font-semibold shrink-0"
          asChild
        >
          <Link to="/admin/approvals">
            <span>Open Approval Centre</span>
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 py-3 overflow-x-auto no-scrollbar">
        {(["All", "Task Completions", "Documents", "Access & Other"] as FilterTab[]).map((tab) => {
          const count =
            tab === "All"
              ? approvals.length
              : tab === "Task Completions"
              ? approvals.filter((a) => a.kind === "Task Completion").length
              : tab === "Documents"
              ? approvals.filter((a) => a.kind === "Document Upload").length
              : approvals.filter((a) => a.kind !== "Task Completion" && a.kind !== "Document Upload").length;

          const active = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all duration-150 cursor-pointer shrink-0",
                active
                  ? "gradient-primary text-primary-foreground shadow-xs"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <span>{tab}</span>
              {count > 0 && (
                <span
                  className={cn(
                    "text-[10px] font-bold rounded-full px-1.5 py-0.2",
                    active ? "bg-white/20 text-white" : "bg-muted-foreground/20 text-muted-foreground"
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="mt-1 flex-1">
        {isLoading ? (
          <div className="space-y-3 py-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 animate-pulse">
                <div className="size-9 rounded-full bg-muted/60 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-48 rounded bg-muted/60" />
                  <div className="h-3 w-32 rounded bg-muted/40" />
                </div>
                <div className="h-6 w-24 rounded-full bg-muted/40" />
              </div>
            ))}
          </div>
        ) : isError && !data ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <AlertTriangle className="size-8 text-destructive/80 mb-2" />
            <p className="text-sm font-semibold text-foreground">Couldn't load approval queue</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Check server connection and try again.
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-4 rounded-md">
              Retry
            </Button>
          </div>
        ) : filteredApprovals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 mb-3">
              <ShieldCheck size={24} strokeWidth={1.75} />
            </div>
            <p className="text-sm font-semibold text-foreground">All clear — no pending requests</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              {activeTab === "All"
                ? "Every operational request has been reviewed and signed off."
                : `No pending items in the ${activeTab} category.`}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/50">
            {filteredApprovals.slice(0, 6).map((item) => {
              const Icon = iconFor(item.kind);
              const busy = processingIds.has(item._id);

              const isDelete =
                item.type?.includes("delete") ||
                item.kind?.toLowerCase().includes("delete") ||
                item.title?.toLowerCase().startsWith("delete");

              // Extract case, client, submitter, reason
              const caseNumber =
                item.caseDetails?.caseNumber ||
                item.taskDetails?.case?.number ||
                (item.context?.match(/Case:\s*([^\s·]+)/)?.[1]);
              const caseTitle =
                item.caseDetails?.title ||
                item.taskDetails?.case?.title ||
                item.taskDetails?.caseName;
              const caseDisplay = caseNumber
                ? `${caseNumber}${caseTitle ? ` · ${caseTitle}` : ""}`
                : caseTitle || null;

              const clientName =
                item.caseDetails?.client?.name ||
                item.taskDetails?.client?.name ||
                item.taskDetails?.clientName ||
                (item.context?.match(/Client:\s*([^·]+)/)?.[1]?.trim());

              const submitterName =
                item.submittedBy?.name ||
                item.requestDetails?.requestedByName ||
                (item.context?.match(/by\s+([^·$]+)/)?.[1]?.trim());

              const reason =
                item.requestDetails?.reason ||
                item.taskDetails?.rejectionReason ||
                (item.context?.match(/Reason:\s*"([^"]+)"/)?.[1]);

              return (
                <li
                  key={item._id}
                  onClick={() => handleOpenItem(item)}
                  className={cn(
                    "group flex flex-col gap-2 py-3 px-3 -mx-1 rounded-xl transition-all hover:bg-muted/50 cursor-pointer border",
                    isDelete
                      ? "border-rose-200/50 dark:border-rose-950/40 bg-rose-50/20 dark:bg-rose-950/10"
                      : "border-transparent hover:border-border/60"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <span
                        className={cn(
                          "grid size-9 shrink-0 place-items-center rounded-xl transition-transform group-hover:scale-105 shadow-2xs mt-0.5",
                          isDelete
                            ? "bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60"
                            : "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-900/50"
                        )}
                      >
                        <Icon size={17} strokeWidth={1.8} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs sm:text-sm font-semibold text-foreground group-hover:text-primary transition-colors leading-tight">
                            {item.title}
                          </p>
                          {isDelete && (
                            <span className="inline-flex items-center gap-1 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 text-[10px] font-bold shrink-0 border border-rose-200 dark:border-rose-900/50">
                              <ShieldAlert size={10} />
                              DELETION
                            </span>
                          )}
                          {item.taskDetails?.priority && (
                            <span
                              className={cn(
                                "text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0",
                                item.taskDetails.priority === "High"
                                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                  : item.taskDetails.priority === "Medium"
                                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                  : "bg-slate-500/10 text-slate-600 dark:text-slate-400"
                              )}
                            >
                              {item.taskDetails.priority}
                            </span>
                          )}
                        </div>

                        {/* Downward Row Metadata: Case, Client, Submitter */}
                        <div className="flex items-center gap-2.5 flex-wrap mt-1 text-[11px] text-muted-foreground">
                          {caseDisplay && (
                            <span className="inline-flex items-center gap-1 font-medium text-foreground/80 bg-muted/60 dark:bg-muted/40 px-2 py-0.5 rounded border border-border/40 max-w-[240px] truncate" title={caseDisplay}>
                              <Briefcase size={11} className="text-primary shrink-0" />
                              <span className="truncate">{caseDisplay}</span>
                            </span>
                          )}
                          {clientName && (
                            <span className="inline-flex items-center gap-1 font-medium text-foreground/80 bg-muted/60 dark:bg-muted/40 px-2 py-0.5 rounded border border-border/40 max-w-[200px] truncate" title={clientName}>
                              <User size={11} className="text-muted-foreground shrink-0" />
                              <span className="truncate">{clientName}</span>
                            </span>
                          )}
                          {submitterName && (
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              <Clock size={11} className="shrink-0" />
                              <span>by {submitterName}</span>
                            </span>
                          )}
                        </div>

                        {/* Reason / Note Callout */}
                        {reason && (
                          <div className="mt-1.5 text-[11px] text-amber-800 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-md px-2.5 py-1 flex items-start gap-1.5">
                            <span className="font-semibold shrink-0">Reason:</span>
                            <span className="italic line-clamp-2">{reason}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div
                      className="flex items-center gap-1 shrink-0 ml-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg gap-1"
                        title="View Full Details"
                        onClick={() => handleOpenItem(item)}
                      >
                        <Eye size={13} />
                        <span className="hidden sm:inline">Details</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 rounded-lg text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/50"
                        title="Approve request"
                        disabled={busy}
                        onClick={() => handleApprove(item)}
                      >
                        <Check size={15} strokeWidth={2.5} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 rounded-lg text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/50"
                        title="Reject request"
                        disabled={busy}
                        onClick={() => {
                          setRejectModalItem(item);
                          setIsRejectModalOpen(true);
                        }}
                      >
                        <X size={15} strokeWidth={2.5} />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Comprehensive Full Approval Detail Drawer */}
      <ApprovalDetailDrawer
        item={selectedDrawerItem}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedDrawerItem(null);
        }}
        onApprove={(item) => handleApprove(item)}
        onReject={(item) => {
          setRejectModalItem(item);
          setIsRejectModalOpen(true);
        }}
        isProcessing={processingIds.has(selectedDrawerItem?._id || "")}
      />

      {/* Rejection Modal with Mandatory Reason */}
      <ApprovalRejectModal
        item={rejectModalItem}
        isOpen={isRejectModalOpen}
        onClose={() => {
          setIsRejectModalOpen(false);
          setRejectModalItem(null);
        }}
        onConfirm={handleConfirmReject}
        isSubmitting={processingIds.has(rejectModalItem?._id || "")}
      />
    </section>
  );
}
