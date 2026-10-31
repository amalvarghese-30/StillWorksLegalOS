import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  ShieldCheck,
  Search,
  Filter as FilterIcon,
  RotateCcw,
  RefreshCw,
  Inbox,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  FileSpreadsheet,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import {
  useApprovals,
  useApprovalMetrics,
  useApproveRequest,
  useRejectRequest,
  adminKeys,
  type ApprovalItem,
  type ApprovalQueryParams,
} from "@/services/admin";
import { useUpdateDocument, useReviewAccessRequest } from "@/services/documents";
import { useReviewCaseAccessRequest } from "@/services/cases";
import { useApproveTask, useRejectTask, useUpdateTask, taskKeys } from "@/services/tasks";
import { reportKeys } from "@/services/reports";
import { toast } from "sonner";
import { useTableSorting } from "@/hooks/useTableSorting";
import {
  ApprovalMetricsSummary,
  type MetricFilter,
} from "@/components/admin/approvals/ApprovalMetricsSummary";
import { ApprovalTable } from "@/components/admin/approvals/ApprovalTable";
import { ApprovalDetailDrawer } from "@/components/admin/approvals/ApprovalDetailDrawer";
import { ApprovalRejectModal } from "@/components/admin/approvals/ApprovalRejectModal";
import { ErrorState } from "@/components/common/ErrorState";
import { StaleDataBanner } from "@/components/common/StaleDataBanner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_admin/admin/approvals")({
  head: () => ({
    meta: [
      { title: "Approval Centre · S & S Legal-Tech LLP" },
      {
        name: "description",
        content: "Professional approval queue for tasks, document uploads, access requests, and case operations.",
      },
      { property: "og:title", content: "Approval Centre · S & S Legal-Tech LLP" },
      {
        property: "og:description",
        content: "Review and manage firm-wide requests, task sign-offs, and administrative authorizations.",
      },
    ],
  }),
  component: ApprovalsPage,
});

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "tasks", label: "Tasks" },
  { id: "documents", label: "Documents" },
  { id: "access", label: "Access" },
  { id: "cases", label: "Cases" },
  { id: "clients", label: "Clients" },
] as const;

type CategoryId = (typeof CATEGORIES)[number]["id"];

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

  // State Filters
  const [activeMetric, setActiveMetric] = useState<MetricFilter | null>("awaiting");
  const [category, setCategory] = useState<CategoryId>("all");
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [submittedToday, setSubmittedToday] = useState<boolean>(false);
  const [thisMonth, setThisMonth] = useState<boolean>(false);
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "waiting" | "priority" | "title">("newest");
  const [page, setPage] = useState<number>(1);
  const pageSize = 25;

  // Drawer & Modal State
  const [selectedItem, setSelectedItem] = useState<ApprovalItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [rejectModalItem, setRejectModalItem] = useState<ApprovalItem | null>(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState<boolean>(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // Backend Metrics
  const { data: metricsData, isLoading: isMetricsLoading, refetch: refetchMetrics } = useApprovalMetrics();

  // Backend Approvals List Query
  const queryParams: ApprovalQueryParams = useMemo(() => {
    return {
      status,
      category,
      search: searchQuery.trim() || undefined,
      submittedToday: submittedToday || undefined,
      thisMonth: thisMonth || undefined,
      sortBy,
      page,
      limit: pageSize,
    };
  }, [status, category, searchQuery, submittedToday, thisMonth, sortBy, page]);

  const {
    data: approvalsData,
    isLoading: isApprovalsLoading,
    isError,
    refetch: refetchApprovals,
    isFetching,
  } = useApprovals(queryParams);

  const rawApprovals = approvalsData?.approvals ?? [];
  const totalItems = approvalsData?.total ?? 0;
  const totalPages = approvalsData?.totalPages ?? 1;
  const categoryCounts = approvalsData?.categoryCounts;

  // Filter client-side by priority if set
  const approvals = useMemo(() => {
    if (priorityFilter === "all") return rawApprovals;
    return rawApprovals.filter(
      (item) => (item.priority || "medium").toLowerCase() === priorityFilter.toLowerCase()
    );
  }, [rawApprovals, priorityFilter]);

  const {
    sortedData: sortedApprovals,
    sortKey: tableSortKey,
    sortDirection: tableSortDir,
    onSort: handleTableSort,
  } = useTableSorting(approvals, {
    accessors: {
      title: (a) => a.title,
      kind: (a) => a.kind,
      userName: (a) => a.userName,
      when: (a) => a.when,
      priority: (a) => a.priority,
      status: (a) => a.status,
    },
  });

  // Mutations
  const approveTask = useApproveTask();
  const rejectTask = useRejectTask();
  const updateTask = useUpdateTask();
  const approveRequest = useApproveRequest();
  const rejectRequest = useRejectRequest();
  const updateDocument = useUpdateDocument();
  const reviewAccessRequest = useReviewAccessRequest();
  const reviewCaseAccessRequest = useReviewCaseAccessRequest();

  // Invalidate queries after action
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["admin", "approvals"] });
    qc.invalidateQueries({ queryKey: taskKeys.all });
    qc.invalidateQueries({ queryKey: reportKeys.all });
    qc.invalidateQueries({ queryKey: ["cases"] });
    qc.invalidateQueries({ queryKey: ["documents"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
    refetchMetrics();
  };

  // Metric Click Handler (filters list)
  const handleSelectMetric = (metric: MetricFilter) => {
    if (activeMetric === metric) {
      // Toggle off -> reset to pending
      setActiveMetric("awaiting");
      setStatus("pending");
      setSubmittedToday(false);
      setThisMonth(false);
      setPage(1);
      return;
    }

    setActiveMetric(metric);
    setPage(1);

    if (metric === "awaiting") {
      setStatus("pending");
      setSubmittedToday(false);
      setThisMonth(false);
    } else if (metric === "today") {
      setStatus("pending");
      setSubmittedToday(true);
      setThisMonth(false);
    } else if (metric === "approved") {
      setStatus("approved");
      setSubmittedToday(false);
      setThisMonth(true);
    } else if (metric === "rejected") {
      setStatus("rejected");
      setSubmittedToday(false);
      setThisMonth(true);
    }
  };

  // Reset all filters
  const handleResetFilters = () => {
    setActiveMetric("awaiting");
    setCategory("all");
    setStatus("pending");
    setSubmittedToday(false);
    setThisMonth(false);
    setPriorityFilter("all");
    setSearchQuery("");
    setSortBy("newest");
    setPage(1);
  };

  const isFilterActive =
    category !== "all" ||
    status !== "pending" ||
    submittedToday ||
    thisMonth ||
    priorityFilter !== "all" ||
    searchQuery.trim().length > 0 ||
    sortBy !== "newest";

  // Detail Drawer Triggers
  const handleOpenDetail = (item: ApprovalItem) => {
    setSelectedItem(item);
    setIsDrawerOpen(true);
  };

  const handleCloseDetail = () => {
    setIsDrawerOpen(false);
  };

  // Quick or Drawer Approve
  const handleApprove = async (item: ApprovalItem) => {
    const itemId = item._id;
    setProcessingIds((prev) => new Set(prev).add(itemId));
    const toastId = `approve-${itemId}`;
    toast.loading("Approving and verifying sign-off…", { id: toastId });

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
            // Fallback to updateTask with status completed
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

      toast.success("Request successfully approved and completed!", { id: toastId });
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

  // Trigger Rejection Modal
  const handleOpenRejectModal = (item: ApprovalItem) => {
    setRejectModalItem(item);
    setIsRejectModalOpen(true);
  };

  // Execute Rejection with mandatory reason
  const handleConfirmReject = async (item: ApprovalItem, reason: string) => {
    const itemId = item._id;
    setProcessingIds((prev) => new Set(prev).add(itemId));
    const toastId = `reject-${itemId}`;
    toast.loading("Recording changes requested…", { id: toastId });

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
            data: { state: "Rejected", rejectedReason: reason } as any,
          });
        }
      }

      toast.success("Request returned with feedback.", { id: toastId });
      invalidateAll();
      setIsDrawerOpen(false);
      setIsRejectModalOpen(false);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Could not reject this request.";
      toast.error(msg, { id: toastId });
      throw err;
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const pendingCount = metricsData?.awaitingReview ?? rawApprovals.length;

  return (
    <div className="pb-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Page Header */}
      <PageHeader
        breadcrumb={[
          { label: "S & S", to: "/" },
          { label: "Admin Console", to: "/admin" },
          { label: "Approval Centre" },
        ]}
        title="Approval Centre"
        subtitle={`Review and manage requests submitted across the firm · ${pendingCount} awaiting sign-off.`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isFetching}
              onClick={() => {
                refetchApprovals();
                refetchMetrics();
              }}
              className="text-xs h-9 gap-1.5"
            >
              <RefreshCw size={13} className={cn(isFetching && "animate-spin")} />
              Refresh Queue
            </Button>
          </div>
        }
      />

      {/* Summary Metrics */}
      <ApprovalMetricsSummary
        metrics={metricsData}
        activeMetric={activeMetric}
        onSelectMetric={handleSelectMetric}
        isLoading={isMetricsLoading}
      />

      {/* Category Filter Pills */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {CATEGORIES.map((cat) => {
            const isActive = category === cat.id;
            const count = categoryCounts ? categoryCounts[cat.id as keyof typeof categoryCounts] : undefined;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setCategory(cat.id);
                  setPage(1);
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold shadow-soft"
                    : "bg-card border border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}
              >
                <span>{cat.label}</span>
                {count !== undefined && (
                  <span
                    className={cn(
                      "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
                      isActive
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {isFilterActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetFilters}
            className="text-xs text-muted-foreground hover:text-foreground h-8 gap-1"
          >
            <RotateCcw size={12} />
            Reset filters
          </Button>
        )}
      </div>

      {/* Search & Toolbar Controls */}
      <div className="mb-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl border border-border/80 bg-card shadow-soft">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search by title, requester, case number, or client…"
            className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-1.5 text-xs placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by priority"
            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="all">Priority: All</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Status Filter */}
          <select
            value={status}
            onChange={(e) => {
              const val = e.target.value as "pending" | "approved" | "rejected" | "all";
              setStatus(val);
              setActiveMetric(val === "pending" ? "awaiting" : null);
              setPage(1);
            }}
            aria-label="Filter by approval status"
            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="pending">Status: Pending</option>
            <option value="approved">Status: Approved</option>
            <option value="rejected">Status: Rejected</option>
            <option value="all">Status: All Records</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            aria-label="Sort approvals"
            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="newest">Sort: Newest First</option>
            <option value="oldest">Sort: Oldest First</option>
            <option value="waiting">Sort: Longest Waiting</option>
            <option value="priority">Sort: Highest Priority</option>
            <option value="title">Sort: Title (A–Z)</option>
          </select>
        </div>
      </div>

      {/* Main Request Table & Empty / Loading States */}
      {isApprovalsLoading && (
        <div className="rounded-xl border border-border bg-card p-8 shadow-soft space-y-4">
          <div className="h-6 w-48 bg-muted animate-pulse rounded" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 w-full bg-muted/60 animate-pulse rounded-lg" />
            ))}
          </div>
        </div>
      )}

      {isError && Boolean(approvalsData) && (
        <StaleDataBanner
          message="Could not refresh the latest approvals from the server. Showing cached queue."
          onRefresh={() => refetchApprovals()}
          isRefreshing={isFetching}
          className="mb-4"
        />
      )}

      {isError && !approvalsData && (
        <ErrorState
          title="Failed to load approvals queue"
          description="The server could not complete the request. Please verify connection and retry."
          onRetry={() => refetchApprovals()}
          isRetrying={isFetching}
          className="my-4"
        />
      )}

      {!isApprovalsLoading && (!isError || Boolean(approvalsData)) && (
        <>
          {approvals.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 rounded-xl border border-border/80 bg-card text-center shadow-soft">
              <div className="size-12 rounded-full bg-muted/60 grid place-items-center mb-3">
                <Inbox size={24} className="text-muted-foreground/60" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">No requests found</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                {isFilterActive
                  ? "No approval items match your current filter and search criteria."
                  : "Everything is up to date. There are no requests awaiting action."}
              </p>
              {isFilterActive && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetFilters}
                  className="mt-4 text-xs h-8 gap-1.5"
                >
                  <RotateCcw size={12} />
                  Reset all filters
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <ApprovalTable
                approvals={sortedApprovals}
                selectedItem={selectedItem}
                onSelectItem={handleOpenDetail}
                onQuickApprove={handleApprove}
                onQuickReject={handleOpenRejectModal}
                processingIds={processingIds}
                sortKey={tableSortKey}
                sortDirection={tableSortDir}
                onSort={handleTableSort}
              />

              {/* Pagination Controls */}
              <div className="flex items-center justify-between px-2 pt-2 text-xs text-muted-foreground">
                <span>
                  Showing {Math.min((page - 1) * pageSize + 1, totalItems)}–
                  {Math.min(page * pageSize, totalItems)} of {totalItems} requests
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="h-8 px-2.5 text-xs"
                  >
                    <ChevronLeft size={14} className="mr-1" />
                    Previous
                  </Button>
                  <span className="font-medium text-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="h-8 px-2.5 text-xs"
                  >
                    Next
                    <ChevronRight size={14} className="ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Right-Side Request Detail Drawer */}
      <ApprovalDetailDrawer
        item={selectedItem}
        isOpen={isDrawerOpen}
        onClose={handleCloseDetail}
        onApprove={handleApprove}
        onReject={handleOpenRejectModal}
        isProcessing={selectedItem ? processingIds.has(selectedItem._id) : false}
      />

      {/* Rejection Feedback Modal */}
      <ApprovalRejectModal
        item={rejectModalItem}
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        onConfirm={handleConfirmReject}
        isSubmitting={rejectModalItem ? processingIds.has(rejectModalItem._id) : false}
      />
    </div>
  );
}
