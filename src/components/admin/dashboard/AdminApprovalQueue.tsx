import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ShieldCheck,
  CheckSquare,
  FileText,
  KeyRound,
  Briefcase,
  ArrowRight,
  Loader2,
  Check,
  X,
  AlertTriangle,
  Inbox,
  Eye,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  useApprovals,
  useApproveRequest,
  useRejectRequest,
  adminKeys,
  type ApprovalItem,
} from "@/services/admin";
import { useUpdateDocument, useReviewAccessRequest } from "@/services/documents";
import { useReviewCaseAccessRequest } from "@/services/cases";
import { useUpdateTask, taskKeys, type TaskRecord } from "@/services/tasks";
import { reportKeys } from "@/services/reports";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import { cn } from "@/lib/utils";

type FilterTab = "All" | "Task Completions" | "Documents" | "Access & Other";

function iconFor(kind: string) {
  switch (kind) {
    case "Task Completion":
      return CheckSquare;
    case "Document Upload":
      return FileText;
    case "Access Request":
      return KeyRound;
    default:
      return ShieldCheck;
  }
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

  // Decision Modal State
  const [decisionModalItem, setDecisionModalItem] = useState<ApprovalItem | null>(null);
  const [decisionAction, setDecisionAction] = useState<"approved" | "rejected" | null>(null);
  const [decisionRemark, setDecisionRemark] = useState("");

  // Inspect Task Modal State
  const [inspectTask, setInspectTask] = useState<TaskRecord | null>(null);

  // Mutations
  const updateDocument = useUpdateDocument();
  const reviewAccessRequest = useReviewAccessRequest();
  const reviewCaseAccessRequest = useReviewCaseAccessRequest();
  const updateTask = useUpdateTask();
  const approveRequest = useApproveRequest();
  const rejectRequest = useRejectRequest();

  // Filter logic
  const filteredApprovals = approvals.filter((item) => {
    if (activeTab === "Task Completions") return item.kind === "Task Completion";
    if (activeTab === "Documents") return item.kind === "Document Upload";
    if (activeTab === "Access & Other") return item.kind !== "Task Completion" && item.kind !== "Document Upload";
    return true;
  });

  const handleOpenItem = (item: ApprovalItem) => {
    if (item.taskDetails) {
      // Open canonical TaskDetailDialog
      const rawTask: TaskRecord = {
        _id: item.taskDetails._id,
        title: item.taskDetails.title,
        description: item.taskDetails.description || "",
        category: item.taskDetails.category || "General",
        priority: (item.taskDetails.priority as any) || "Medium",
        status: (item.taskDetails.status as any) || "pending_approval",
        deadline: item.taskDetails.deadline || null,
        assignedTo: item.taskDetails.assignedTo as any,
        completedAt: item.taskDetails.completedAt || null,
        submittedForApprovalAt: item.taskDetails.submittedForApprovalAt || null,
        checklist: (item.taskDetails.checklist as any) || [],
        remarks: (item.taskDetails.remarks as any) || [],
        assignmentHistory: (item.taskDetails.assignmentHistory as any) || [],
        caseId: item.taskDetails.case ? { _id: item.taskDetails.case._id, title: item.taskDetails.case.title, number: item.taskDetails.case.number } : null,
        caseName: item.taskDetails.case?.title,
        clientId: item.taskDetails.client ? { _id: item.taskDetails.client._id, name: item.taskDetails.client.name, phone: item.taskDetails.client.phone } : null,
        clientName: item.taskDetails.client?.name,
        isCall: false,
        isDeleted: false,
        pendingDeletion: false,
        pendingReassignment: false,
        createdBy: "system",
        createdAt: item.when || new Date().toISOString(),
      };
      setInspectTask(rawTask);
    } else {
      // Default to review modal for raw approval requests or document uploads
      setDecisionModalItem(item);
      setDecisionAction("approved");
      setDecisionRemark("");
    }
  };

  const handleConfirmDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decisionModalItem || !decisionAction) return;

    const item = decisionModalItem;
    const action = decisionAction;
    const remark = decisionRemark.trim();

    setProcessingIds((prev) => new Set(prev).add(item._id));
    const toastId = `approval-dash-${item._id}`;
    toast.loading(action === "approved" ? "Approving request…" : "Rejecting request…", { id: toastId });

    const onSettled = () => {
      qc.invalidateQueries({ queryKey: adminKeys.approvals });
      qc.invalidateQueries({ queryKey: taskKeys.all });
      qc.invalidateQueries({ queryKey: reportKeys.all });
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(item._id);
        return next;
      });
      setDecisionModalItem(null);
      setDecisionAction(null);
      setDecisionRemark("");
    };

    const onSuccess = () => {
      toast.success(action === "approved" ? "Request approved successfully!" : "Request rejected.", { id: toastId });
      onSettled();
    };

    const onError = (err?: any) => {
      const msg = err?.response?.data?.message || err?.message || `Could not ${action === "approved" ? "approve" : "reject"} this request.`;
      toast.error(msg, { id: toastId });
      onSettled();
    };

    const rawId = item.rawApprovalId || (item._id.startsWith("approval_req_") ? item._id.replace(/^approval_req_/, "") : null);

    if (rawId) {
      try {
        if (action === "approved") {
          await approveRequest.mutateAsync({ id: rawId, decisionRemark: remark });
        } else {
          await rejectRequest.mutateAsync({ id: rawId, decisionRemark: remark });
        }
        onSuccess();
      } catch (err) {
        onError(err);
      }
      return;
    }

    const target = parseTarget(item);

    if (target.taskId) {
      updateTask.mutate(
        {
          id: target.taskId,
          data: {
            status: action === "approved" ? "completed" : "in_progress",
            rejectionReason: action === "rejected" ? remark : undefined,
            reason: action === "rejected" ? remark : undefined,
          },
        },
        { onSuccess, onError, onSettled },
      );
    } else if (target.caseId && target.requestId) {
      reviewCaseAccessRequest.mutate(
        { caseId: target.caseId, requestId: target.requestId, status: action },
        { onSuccess, onError, onSettled },
      );
    } else if (target.requestId) {
      reviewAccessRequest.mutate(
        { docId: target.docId!, requestId: target.requestId, status: action },
        { onSuccess, onError, onSettled },
      );
    } else {
      updateDocument.mutate(
        { id: target.docId!, data: { state: action === "approved" ? "Approved" : "Rejected" } },
        { onSuccess, onError, onSettled },
      );
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
              Requests waiting for your review and action.
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
        ) : isError ? (
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
            {filteredApprovals.slice(0, 5).map((item) => {
              const Icon = iconFor(item.kind);
              const busy = processingIds.has(item._id);

              return (
                <li
                  key={item._id}
                  onClick={() => handleOpenItem(item)}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 px-2 -mx-2 rounded-xl transition-all hover:bg-muted/40 cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
                      <Icon size={17} strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-xs sm:text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                          {item.title}
                        </p>
                        {item.taskDetails?.priority && (
                          <span
                            className={cn(
                              "text-[10px] font-semibold px-1.5 py-0.2 rounded shrink-0",
                              item.taskDetails.priority === "High"
                                ? "bg-red-500/10 text-red-600 dark:text-red-400"
                                : item.taskDetails.priority === "Medium"
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "bg-slate-500/10 text-slate-600 dark:text-slate-400"
                            )}
                          >
                            {item.taskDetails.priority}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground mt-0.5">
                        {item.context}
                      </p>
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-2 shrink-0 self-end sm:self-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-800/40 px-2.5 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                      {item.kind}
                    </span>

                    {/* Quick review action */}
                    <div className="flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 rounded-md text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/50"
                        title="Approve request"
                        disabled={busy}
                        onClick={() => {
                          setDecisionModalItem(item);
                          setDecisionAction("approved");
                          setDecisionRemark("");
                        }}
                      >
                        <Check size={14} strokeWidth={2.5} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 rounded-md text-destructive hover:bg-destructive/10 hover:text-destructive"
                        title="Reject request"
                        disabled={busy}
                        onClick={() => {
                          setDecisionModalItem(item);
                          setDecisionAction("rejected");
                          setDecisionRemark("");
                        }}
                      >
                        <X size={14} strokeWidth={2.5} />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Decision Confirmation Modal */}
      <Dialog
        open={!!decisionModalItem}
        onOpenChange={(open) => {
          if (!open) {
            setDecisionModalItem(null);
            setDecisionAction(null);
            setDecisionRemark("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {decisionAction === "approved" ? "Approve Request" : "Reject Request"}
            </DialogTitle>
            <DialogDescription>
              {decisionAction === "approved"
                ? `Confirm approval for "${decisionModalItem?.title}".`
                : `Specify your reason for rejecting "${decisionModalItem?.title}".`}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmDecision} className="space-y-4 pt-2">
            <div>
              <Label htmlFor="decision-remark" className="text-xs font-medium">
                {decisionAction === "rejected" ? "Rejection Reason (Required)" : "Remark (Optional)"}
              </Label>
              <textarea
                id="decision-remark"
                value={decisionRemark}
                onChange={(e) => setDecisionRemark(e.target.value)}
                placeholder={
                  decisionAction === "rejected"
                    ? "Provide actionable feedback for the assigned member…"
                    : "Add any approval notes…"
                }
                required={decisionAction === "rejected"}
                rows={3}
                className="mt-1.5 w-full rounded-md border border-border bg-background p-2.5 text-xs text-foreground outline-none focus:border-primary"
              />
            </div>

            <DialogFooter className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDecisionModalItem(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className={cn(
                  "font-semibold",
                  decisionAction === "approved"
                    ? "gradient-primary text-primary-foreground"
                    : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                )}
                disabled={
                  processingIds.has(decisionModalItem?._id || "") ||
                  (decisionAction === "rejected" && !decisionRemark.trim())
                }
              >
                {decisionAction === "approved" ? "Confirm Approval" : "Confirm Rejection"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Task Inspection Dialog */}
      {inspectTask && (
        <TaskDetailDialog
          open={!!inspectTask}
          onClose={() => setInspectTask(null)}
          task={inspectTask}
        />
      )}
    </section>
  );
}
