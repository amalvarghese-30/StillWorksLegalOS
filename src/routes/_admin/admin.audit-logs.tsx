import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import {
  Search,
  Filter as FilterIcon,
  RotateCcw,
  RefreshCw,
  Download,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Calendar,
  Layers,
  ArrowUpDown,
  FileSpreadsheet,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAuditLogs,
  useAuditLogMetrics,
  downloadAuditLogsCsv,
  adminKeys,
  type AuditLogItem,
  type AuditLogQueryParams,
} from "@/services/admin";
import { AuditMetricsSummary } from "@/components/admin/audit/AuditMetricsSummary";
import { AuditLogTable } from "@/components/admin/audit/AuditLogTable";
import { AuditLogDetailDrawer } from "@/components/admin/audit/AuditLogDetailDrawer";

export const Route = createFileRoute("/_admin/admin/audit-logs")({
  head: () => ({
    meta: [
      { title: "Audit Logs · S & S Legal-Tech LLP" },
      {
        name: "description",
        content: "A tamper-evident audit record of every firm operation, case transition, and administrative sign-off.",
      },
      { property: "og:title", content: "Audit Logs · S & S Legal-Tech LLP" },
      { property: "og:description", content: "Firm-wide operational audit trail and cryptographic ledger." },
    ],
  }),
  component: AuditLogsPage,
});

const ACTION_OPTIONS = [
  { value: "all", label: "All Actions" },
  { value: "create", label: "Create" },
  { value: "update", label: "Update" },
  { value: "delete", label: "Delete" },
  { value: "approve", label: "Approve" },
  { value: "reject", label: "Reject" },
  { value: "login", label: "Login" },
  { value: "logout", label: "Logout" },
  { value: "upload", label: "Upload" },
  { value: "download", label: "Download" },
  { value: "access_request", label: "Access Request" },
  { value: "settings_change", label: "Settings Change" },
  { value: "report", label: "Report" },
  { value: "security", label: "Security & Critical" },
];

const RESOURCE_OPTIONS = [
  { value: "all", label: "All Resources" },
  { value: "case", label: "Cases" },
  { value: "task", label: "Tasks" },
  { value: "client", label: "Clients" },
  { value: "document", label: "Documents" },
  { value: "auth", label: "Auth / Sessions" },
  { value: "user", label: "Employees / Users" },
  { value: "calendar", label: "Calendar" },
  { value: "chat", label: "Chat" },
  { value: "settings", label: "Settings" },
  { value: "approval", label: "Approvals" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "action", label: "Action A–Z" },
  { value: "user", label: "User A–Z" },
];

function AuditLogsPage() {
  const queryClient = useQueryClient();

  // Filters State
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedAction, setSelectedAction] = useState("all");
  const [selectedResource, setSelectedResource] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [ipFilter, setIpFilter] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "action" | "user">("newest");
  const [todayOnly, setTodayOnly] = useState<boolean | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Detail Drawer State
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Query Params
  const queryParams: AuditLogQueryParams = useMemo(() => {
    const params: AuditLogQueryParams = {
      page: currentPage,
      limit: pageSize,
      sortBy,
    };
    if (debouncedSearch) params.search = debouncedSearch;
    if (selectedAction && selectedAction !== "all") params.action = selectedAction;
    if (selectedResource && selectedResource !== "all") params.resource = selectedResource;
    if (todayOnly) params.todayOnly = true;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (ipFilter.trim()) params.ip = ipFilter.trim();
    return params;
  }, [
    currentPage,
    pageSize,
    sortBy,
    debouncedSearch,
    selectedAction,
    selectedResource,
    todayOnly,
    startDate,
    endDate,
    ipFilter,
  ]);

  const { data: logsData, isLoading, isError, refetch } = useAuditLogs(queryParams);
  const { data: metrics, isLoading: isMetricsLoading, refetch: refetchMetrics } = useAuditLogMetrics();

  const logs = logsData?.logs ?? [];
  const total = logsData?.total ?? 0;
  const totalPages = logsData?.totalPages ?? 1;

  const hasActiveFilters =
    Boolean(debouncedSearch) ||
    selectedAction !== "all" ||
    selectedResource !== "all" ||
    Boolean(todayOnly) ||
    Boolean(startDate) ||
    Boolean(endDate) ||
    Boolean(ipFilter.trim());

  const handleResetFilters = () => {
    setSearchInput("");
    setDebouncedSearch("");
    setSelectedAction("all");
    setSelectedResource("all");
    setStartDate("");
    setEndDate("");
    setIpFilter("");
    setTodayOnly(undefined);
    setSortBy("newest");
    setCurrentPage(1);
  };

  const handleMetricCardFilter = (updates: Partial<AuditLogQueryParams>) => {
    if (updates.todayOnly !== undefined) {
      setTodayOnly(updates.todayOnly ? true : undefined);
      if (updates.todayOnly) {
        setStartDate("");
        setEndDate("");
      }
    }
    if (updates.action !== undefined) {
      setSelectedAction(updates.action || "all");
    }
    setCurrentPage(1);
  };

  const handleManualRefresh = async () => {
    try {
      setIsRefreshing(true);
      await Promise.all([refetch(), refetchMetrics()]);
      toast.success("Audit trail refreshed");
    } catch {
      toast.error("Failed to refresh audit logs");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      toast.info("Generating CSV export…");
      await downloadAuditLogsCsv(queryParams);
      toast.success("Audit log export downloaded successfully");
    } catch (err: any) {
      toast.error(err?.message || "Failed to download CSV export");
    } finally {
      setIsExporting(false);
    }
  };

  const startRecord = total > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endRecord = total > 0 ? Math.min(currentPage * pageSize, total) : 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <PageHeader
        breadcrumb={[
          { label: "S & S", to: "/" },
          { label: "Admin", to: "/admin" },
          { label: "Audit Logs" },
        ]}
        title="Audit Logs"
        subtitle="A clear, tamper-proof record of every firm action, document upload, status transition, and administrative sign-off"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              disabled={isRefreshing || isLoading}
              className="gap-1.5 rounded-xl border-border/80 shadow-soft"
            >
              <RefreshCw
                size={14}
                className={isRefreshing ? "animate-spin" : ""}
              />
              <span className="hidden sm:inline">Refresh</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={isExporting || total === 0}
              className="gap-1.5 rounded-xl border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary shadow-soft"
            >
              <Download size={14} className={isExporting ? "animate-bounce" : ""} />
              <span>{isExporting ? "Exporting…" : "Export CSV"}</span>
            </Button>
          </div>
        }
      />

      {/* Metrics Summary Cards */}
      <AuditMetricsSummary
        metrics={metrics}
        isLoading={isMetricsLoading}
        filters={queryParams}
        onFilterChange={handleMetricCardFilter}
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-soft">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          {/* Main Search Input */}
          <div className="relative col-span-1 sm:col-span-2 lg:col-span-5">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="search"
              aria-label="Search logs"
              placeholder="Search by user, action, IP, record title, or details…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full rounded-xl border border-border/80 bg-background/50 pl-9 pr-4 py-2 text-xs text-foreground placeholder:text-muted-foreground/70 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
          </div>

          {/* Action Filter */}
          <div className="col-span-1 sm:col-span-1 lg:col-span-3">
            <select
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-xl border border-border/80 bg-background/50 px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer transition-all"
            >
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Resource Filter */}
          <div className="col-span-1 sm:col-span-1 lg:col-span-2">
            <select
              value={selectedResource}
              onChange={(e) => {
                setSelectedResource(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-xl border border-border/80 bg-background/50 px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer transition-all"
            >
              {RESOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By Dropdown */}
          <div className="col-span-1 sm:col-span-2 lg:col-span-2">
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full rounded-xl border border-border/80 bg-background/50 px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer transition-all"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Secondary Row: Date Range & IP Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-border/50 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Start Date */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <span className="text-muted-foreground whitespace-nowrap">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setTodayOnly(undefined);
                  setCurrentPage(1);
                }}
                className="w-full sm:w-auto rounded-lg border border-border/80 bg-background/50 px-2.5 py-1 text-xs text-foreground outline-none focus:border-primary"
              />
            </div>

            {/* End Date */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <span className="text-muted-foreground whitespace-nowrap">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setTodayOnly(undefined);
                  setCurrentPage(1);
                }}
                className="w-full sm:w-auto rounded-lg border border-border/80 bg-background/50 px-2.5 py-1 text-xs text-foreground outline-none focus:border-primary"
              />
            </div>

            {/* IP Filter Input */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <span className="text-muted-foreground whitespace-nowrap">IP:</span>
              <input
                type="text"
                placeholder="Filter by IP…"
                value={ipFilter}
                onChange={(e) => {
                  setIpFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full sm:w-32 rounded-lg border border-border/80 bg-background/50 px-2.5 py-1 text-xs text-foreground font-mono outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Reset Filters CTA */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors self-start sm:self-auto"
            >
              <RotateCcw size={12} />
              <span>Reset filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {isError && (
        <div className="flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertTriangle size={18} className="shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">Failed to query audit trail</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Unable to reach the server. Please verify your connection or administrative permissions.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {/* Main Audit Log Table */}
      <AuditLogTable
        logs={logs}
        isLoading={isLoading}
        onSelectLog={(log) => setSelectedLog(log)}
        selectedLogId={selectedLog?._id}
        onResetFilters={handleResetFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Pagination Footer */}
      {!isLoading && total > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>
              Showing <span className="font-bold text-foreground">{startRecord}</span> to{" "}
              <span className="font-bold text-foreground">{endRecord}</span> of{" "}
              <span className="font-bold text-foreground">{total.toLocaleString()}</span> events
            </span>

            <span className="text-border">|</span>

            <div className="flex items-center gap-1.5">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-md border border-border/80 bg-card px-2 py-0.5 text-xs text-foreground outline-none"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="gap-1 rounded-xl text-xs"
            >
              <ChevronLeft size={14} />
              <span>Previous</span>
            </Button>

            <span className="px-2 font-medium text-foreground">
              Page {currentPage} of {Math.max(1, totalPages)}
            </span>

            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="gap-1 rounded-xl text-xs"
            >
              <span>Next</span>
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}

      {/* Right-Side Detail Drawer */}
      <AuditLogDetailDrawer
        log={selectedLog}
        isOpen={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
      />
    </div>
  );
}