import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  ShieldCheck,
  FileText,
  KeyRound,
  UserPlus,
  Briefcase,
  CheckSquare,
  Loader2,
  AlertTriangle,
  Check,
  X,
  Inbox,
  Eye,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  ListTodo,
  MessageSquare,
  FileSpreadsheet,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusPill } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useApprovals, useApproveRequest, useRejectRequest, adminKeys, type ApprovalItem } from "@/services/admin";
import { useUpdateDocument, useReviewAccessRequest } from "@/services/documents";
import { useReviewCaseAccessRequest } from "@/services/cases";
import { useUpdateTask } from "@/services/tasks";
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

export const Route = createFileRoute("/_admin/admin/approvals")({
  head: () => ({
    meta: [
      { title: "Approvals · S & S Legal-Tech LLP" },
      {
        name: "description",
        content: "One approval centre for document uploads, access requests, case and client requests.",
      },
      { property: "og:title", content: "Approvals · S & S Legal-Tech LLP" },
      {
        property: "og:description",
        content: "Document uploads, access, case and client requests in one queue.",
      },
    ],
  }),
  component: ApprovalsPage,
});

const FILTERS = ["All", "Tasks", "Documents", "Access", "Cases", "Clients"] as const;
type Filter = (typeof FILTERS)[number];

const iconFor = (kind: string) => {
  switch (kind) {
    case "Task Completion":
      return CheckSquare;
    case "Document Upload":
      return FileText;
    case "Access Request":
      return KeyRound;
    case "Client Request":
      return UserPlus;
    default:
      return Briefcase;
  }
};

function matchesFilter(a: ApprovalItem, filter: Filter): boolean {
  switch (filter) {
    case "Tasks":
      return a.kind === "Task Completion";
    case "Documents":
      return a.kind === "Document Upload";
    case "Access":
      return a.kind === "Access Request";
    case "Cases":
      return a.kind === "Case Request";
    case "Clients":
      return a.kind === "Client Request";
    default:
      return true;
  }
}

/** Resolve an approval `_id` back into the task, document + (optional) access-request ids. */
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

function ApprovalsPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useApprovals();
  const approvals = data?.approvals ?? [];

  const [filter, setFilter] = useState<Filter>("All");
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const updateDocument = useUpdateDocument();
  const reviewAccessRequest = useReviewAccessRequest();
  const reviewCaseAccessRequest = useReviewCaseAccessRequest();
  const updateTask = useUpdateTask();

  const approveRequest = useApproveRequest();
  const rejectRequest = useRejectRequest();
  const [decisionModalItem, setDecisionModalItem] = useState<ApprovalItem | null>(null);
  const [decisionAction, setDecisionAction] = useState<"approved" | "rejected" | null>(null);
  const [decisionRemark, setDecisionRemark] = useState("");
  const [detailViewItem, setDetailViewItem] = useState<ApprovalItem | null>(null);

  const visible = approvals.filter((a) => matchesFilter(a, filter));

  const handleConfirmDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decisionModalItem || !decisionAction) return;
    const remark = decisionRemark.trim();

    const a = decisionModalItem;
    const action = decisionAction;
    setProcessingIds((prev) => new Set(prev).add(a._id));
    setErrorMsg(null);

    const toastId = `approval-${a._id}`;
    toast.loading(action === "approved" ? "Approving request…" : "Rejecting request…", { id: toastId });

    const onSettled = () => {
      qc.invalidateQueries({ queryKey: adminKeys.approvals });
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(a._id);
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
      setErrorMsg(msg);
      toast.error(msg, { id: toastId });
      onSettled();
    };

    const rawId = a.rawApprovalId || (a._id.startsWith("approval_req_") ? a._id.replace(/^approval_req_/, "") : null);

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

    const target = parseTarget(a);

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
    <div>
      <PageHeader
        breadcrumb={[{ label: "S & S", to: "/" }, { label: "Approvals" }]}
        title="Approval centre"
        subtitle={`${approvals.length} requests waiting.`}
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`min-h-11 rounded-pill px-4 text-helper font-medium transition-colors duration-150 ${
              filter === f
                ? "gradient-primary text-primary-foreground shadow-soft"
                : "border border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {errorMsg && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-helper text-destructive">
          <AlertTriangle size={16} className="shrink-0" />
          {errorMsg}
        </div>
      )}

      {isLoading && (
        <div className="grid gap-4 xl:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-6 shadow-soft animate-pulse">
              <div className="flex items-center gap-4">
                <div className="size-12 rounded-md bg-muted" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-24 rounded bg-muted" />
                  <div className="h-5 w-48 rounded bg-muted" />
                  <div className="h-3 w-36 rounded bg-muted" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-12 text-center">
          <AlertTriangle size={28} className="text-destructive" />
          <p className="font-medium">Failed to load approvals</p>
          <p className="text-helper text-muted-foreground">Check that the server is running and try again.</p>
        </div>
      )}

      {!isLoading && !isError && (
        <div className="grid gap-4 xl:grid-cols-2">
          {visible.length === 0 ? (
            <div className="col-span-full flex flex-col items-center gap-3 py-16 text-center">
              {filter === "All" ? (
                <ShieldCheck size={40} strokeWidth={1} className="text-muted-foreground/40" />
              ) : (
                <Inbox size={40} strokeWidth={1} className="text-muted-foreground/40" />
              )}
              <p className="font-medium text-muted-foreground">
                {filter === "All" ? "No pending approvals" : `No pending ${filter.toLowerCase()} requests`}
              </p>
              <p className="text-helper text-muted-foreground/70">
                {filter === "All" ? "Everything is up to date." : "Try another filter."}
              </p>
            </div>
          ) : (
            visible.map((a) => {
              const Icon = iconFor(a.kind);
              const busy = processingIds.has(a._id);
              return (
                <article
                  key={a._id}
                  className="lift rounded-xl border border-border bg-card p-4 sm:p-6 shadow-soft transition-all hover:border-primary/40 cursor-pointer"
                  onClick={() => setDetailViewItem(a)}
                >
                  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 sm:gap-4">
                    <span className="grid size-10 sm:size-12 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                      <Icon size={20} strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <StatusPill tone="primary">{a.kind}</StatusPill>
                        {a.taskDetails && (
                          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                            Click to inspect
                          </span>
                        )}
                      </div>
                      <h2 className="mt-2 truncate font-semibold hover:text-primary transition-colors">{a.title}</h2>
                      <p className="truncate text-helper text-muted-foreground">{a.context}</p>
                    </div>
                    <span className="shrink-0 text-caption text-muted-foreground">
                      {a.when ? new Date(a.when).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""}
                    </span>
                  </div>

                  <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border pt-4">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailViewItem(a);
                      }}
                      className="text-helper text-primary hover:underline flex items-center gap-1.5 font-medium"
                    >
                      <Eye size={14} />
                      View full details
                    </button>
                    <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-sm"
                        onClick={() => {
                          setDecisionModalItem(a);
                          setDecisionAction("rejected");
                          setDecisionRemark("");
                        }}
                        disabled={busy}
                      >
                        <X size={15} strokeWidth={1.75} />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        className="gradient-primary rounded-sm text-primary-foreground"
                        onClick={() => {
                          setDecisionModalItem(a);
                          setDecisionAction("approved");
                          setDecisionRemark("");
                        }}
                        disabled={busy}
                      >
                        {busy ? <Loader2 size={15} strokeWidth={1.75} className="animate-spin" /> : <Check size={15} strokeWidth={1.75} />}
                        Approve
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      )}

      {/* Mandatory Decision Remark Modal */}
      <Dialog
        open={Boolean(decisionModalItem && decisionAction)}
        onOpenChange={(open) => !open && setDecisionModalItem(null)}
      >
        <DialogContent className="rounded-xl border border-border bg-card p-6 shadow-lift max-w-md">
          <DialogHeader>
            <DialogTitle className="text-title font-semibold text-foreground flex items-center gap-2">
              {decisionAction === "approved" ? (
                <>
                  <Check size={18} className="text-emerald-500" />
                  Approve Request
                </>
              ) : (
                <>
                  <X size={18} className="text-destructive" />
                  Reject Request
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-helper text-muted-foreground mt-1">
              {decisionModalItem ? `${decisionModalItem.kind}: "${decisionModalItem.title}"` : ""}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmDecision} className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-helper font-medium">
                Decision Remark <span className="text-xs font-normal text-muted-foreground">(Optional)</span>
              </Label>
              <textarea
                value={decisionRemark}
                onChange={(e) => setDecisionRemark(e.target.value)}
                placeholder={
                  decisionAction === "approved"
                    ? "Enter optional remark or note confirming this approval (or leave blank)..."
                    : "Enter optional remark or feedback explaining the rejection (or leave blank)..."
                }
                rows={3}
                className="w-full rounded-md border border-border bg-background p-2.5 text-xs text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="text-[11px] text-muted-foreground">
                Optional note or remark. You can approve or reject with or without entering remarks.
              </p>
            </div>

            <DialogFooter className="mt-5 flex justify-end gap-2">
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
                variant={decisionAction === "approved" ? "default" : "destructive"}
                className={decisionAction === "approved" ? "gradient-primary text-primary-foreground font-semibold" : ""}
                disabled={approveRequest.isPending || rejectRequest.isPending}
              >
                {approveRequest.isPending || rejectRequest.isPending ? (
                  <Loader2 size={14} className="animate-spin mr-1" />
                ) : decisionAction === "approved" ? (
                  <Check size={14} className="mr-1" />
                ) : (
                  <X size={14} className="mr-1" />
                )}
                Confirm {decisionAction === "approved" ? "Approval" : "Rejection"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Comprehensive Details Inspection Modal */}
      <Dialog
        open={Boolean(detailViewItem)}
        onOpenChange={(open) => !open && setDetailViewItem(null)}
      >
        <DialogContent className="rounded-xl border border-border bg-card p-6 shadow-lift max-w-2xl max-h-[90vh] overflow-y-auto">
          {detailViewItem && (
            <div>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <StatusPill tone="primary">{detailViewItem.kind}</StatusPill>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock size={12} />
                    {detailViewItem.when ? new Date(detailViewItem.when).toLocaleString("en-IN") : ""}
                  </span>
                </div>
                <DialogTitle className="text-xl font-bold text-foreground mt-2">
                  {detailViewItem.title}
                </DialogTitle>
                <DialogDescription className="text-helper text-muted-foreground">
                  {detailViewItem.context}
                </DialogDescription>
              </DialogHeader>

              {/* Task Completion Specific Details */}
              {detailViewItem.taskDetails && (
                <div className="mt-5 space-y-5">
                  {/* Summary Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-lg border border-border bg-muted/20 p-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Priority</span>
                      <span className="font-semibold">{detailViewItem.taskDetails.priority || "Medium"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Category</span>
                      <span className="font-semibold">{detailViewItem.taskDetails.category || "General"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Assigned Employee</span>
                      <span className="font-semibold">{detailViewItem.taskDetails.assignedTo?.name || "Unassigned"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Completed At</span>
                      <span className="font-semibold">
                        {detailViewItem.taskDetails.completedAt
                          ? new Date(detailViewItem.taskDetails.completedAt).toLocaleDateString("en-IN")
                          : "Recently"}
                      </span>
                    </div>
                  </div>

                  {/* Associated Case / Client info */}
                  {(detailViewItem.taskDetails.case || detailViewItem.taskDetails.client) && (
                    <div className="rounded-lg border border-border bg-card p-3.5 space-y-2">
                      <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Briefcase size={14} className="text-primary" />
                        Case & Client Association
                      </h4>
                      <div className="grid sm:grid-cols-2 gap-2 text-xs">
                        {detailViewItem.taskDetails.case && (
                          <div className="rounded bg-muted/30 p-2 border border-border/60">
                            <span className="text-[11px] text-muted-foreground block">Case Title / File Number:</span>
                            <span className="font-medium text-foreground">
                              {detailViewItem.taskDetails.case.number} — {detailViewItem.taskDetails.case.title}
                            </span>
                            {detailViewItem.taskDetails.case.countCaseNumber && (
                              <span className="text-[11px] text-muted-foreground block mt-0.5">
                                Internal Count: {detailViewItem.taskDetails.case.countCaseNumber}
                              </span>
                            )}
                          </div>
                        )}
                        {detailViewItem.taskDetails.client && (
                          <div className="rounded bg-muted/30 p-2 border border-border/60">
                            <span className="text-[11px] text-muted-foreground block">Client:</span>
                            <span className="font-medium text-foreground">{detailViewItem.taskDetails.client.name}</span>
                            {detailViewItem.taskDetails.client.phone && (
                              <span className="text-[11px] text-muted-foreground block mt-0.5">
                                Phone: {detailViewItem.taskDetails.client.phone}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Subtask Checklist Breakdown */}
                  <div className="rounded-lg border border-border bg-card p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <ListTodo size={14} className="text-primary" />
                        Subtasks / Checklist Breakdown
                      </h4>
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {detailViewItem.taskDetails.checklist?.filter((c) => c.done).length || 0} /{" "}
                        {detailViewItem.taskDetails.checklist?.length || 0} completed
                      </span>
                    </div>

                    {detailViewItem.taskDetails.checklist && detailViewItem.taskDetails.checklist.length > 0 ? (
                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                        {detailViewItem.taskDetails.checklist.map((item, idx) => (
                          <div
                            key={idx}
                            className={`flex items-start gap-2.5 rounded-md border p-2 text-xs transition-colors ${
                              item.done
                                ? "border-emerald-500/30 bg-emerald-500/5 text-foreground"
                                : "border-border bg-muted/20 text-muted-foreground"
                            }`}
                          >
                            <span className="mt-0.5">
                              {item.done ? (
                                <CheckCircle2 size={14} className="text-emerald-500" />
                              ) : (
                                <div className="size-3.5 rounded-full border border-muted-foreground" />
                              )}
                            </span>
                            <div className="min-w-0 flex-1">
                              <span className={item.done ? "line-through opacity-80" : ""}>{item.text}</span>
                              {item.remarks && (
                                <p className="text-[11px] text-muted-foreground mt-0.5 italic">
                                  Remark: "{item.remarks}"
                                </p>
                              )}
                              {item.subItems && item.subItems.length > 0 && (
                                <div className="mt-1.5 space-y-1 pl-3 border-l-2 border-border/80">
                                  {item.subItems.map((sub, sIdx) => (
                                    <div key={sIdx} className="flex items-center gap-1.5 text-[11px]">
                                      {sub.done ? (
                                        <Check size={11} className="text-emerald-500" />
                                      ) : (
                                        <span className="size-1.5 rounded-full bg-muted-foreground/60" />
                                      )}
                                      <span className={sub.done ? "line-through opacity-75" : ""}>{sub.text}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No checklist items defined on this task.</p>
                    )}
                  </div>

                  {/* Task Remarks / Activity Notes */}
                  {detailViewItem.taskDetails.remarks && detailViewItem.taskDetails.remarks.length > 0 && (
                    <div className="rounded-lg border border-border bg-card p-3.5 space-y-2">
                      <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <MessageSquare size={14} className="text-primary" />
                        Task Remarks & Notes
                      </h4>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {detailViewItem.taskDetails.remarks.map((r, rIdx) => (
                          <div key={rIdx} className="rounded bg-muted/30 p-2 text-xs border border-border/60">
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                              <span className="font-medium text-foreground">{r.author}</span>
                              <span>{r.createdAt ? new Date(r.createdAt).toLocaleString("en-IN") : ""}</span>
                            </div>
                            <p className="text-foreground">{r.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  {detailViewItem.taskDetails.description && (
                    <div className="rounded-lg border border-border bg-card p-3.5 space-y-1">
                      <span className="text-[11px] text-muted-foreground block font-medium">Task Description</span>
                      <p className="text-xs text-foreground whitespace-pre-wrap">{detailViewItem.taskDetails.description}</p>
                    </div>
                  )}
                </div>
              )}

              {/* General Request Details (Deletion / Reassignment) */}
              {detailViewItem.requestDetails && (
                <div className="mt-5 space-y-4">
                  <div className="rounded-lg border border-border bg-muted/20 p-3.5 text-xs space-y-2">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Requested Action</span>
                      <span className="font-semibold text-foreground text-sm uppercase">{detailViewItem.requestDetails.type}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Submitted By</span>
                      <span className="font-medium text-foreground">{detailViewItem.requestDetails.requester?.name || "Employee"}</span>
                    </div>
                    {detailViewItem.requestDetails.targetUser && (
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Target Assignee</span>
                        <span className="font-medium text-foreground">{detailViewItem.requestDetails.targetUser.name}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Employee's Justification / Reason</span>
                      <p className="font-medium text-foreground italic mt-0.5">"{detailViewItem.requestDetails.reason}"</p>
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDetailViewItem(null)}
                >
                  Close
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const item = detailViewItem;
                      setDetailViewItem(null);
                      setDecisionModalItem(item);
                      setDecisionAction("rejected");
                      setDecisionRemark("");
                    }}
                  >
                    <X size={14} className="mr-1 text-destructive" /> Reject
                  </Button>
                  <Button
                    size="sm"
                    className="gradient-primary text-primary-foreground font-semibold"
                    onClick={() => {
                      const item = detailViewItem;
                      setDetailViewItem(null);
                      setDecisionModalItem(item);
                      setDecisionAction("approved");
                      setDecisionRemark("");
                    }}
                  >
                    <Check size={14} className="mr-1" /> Approve
                  </Button>
                </div>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
