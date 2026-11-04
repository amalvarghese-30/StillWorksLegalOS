import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList,
} from "recharts";
import {
  BarChart3,
  TrendingUp,
  PieChart as PieIcon,
  Users,
  CheckSquare,
  Gavel,
  FileText,
  Star,
  Trophy,
  Loader2,
  AlertTriangle,
  Calendar,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Clock,
  RefreshCw,
  Briefcase,
  ExternalLink,
  User as UserIcon,
  Shield,
  Activity,
  Layers,
  History,
  FolderKanban,
  ArrowUpRight,
  Printer,
  Download,
  Search,
  Info,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/common/Surface";
import { ErrorState } from "@/components/common/ErrorState";
import { StaleDataBanner } from "@/components/common/StaleDataBanner";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import { ReportDrilldownDialog, type DrilldownType } from "@/components/reports/ReportDrilldownDialog";
import { formatSafeDate, formatSafeDateTime } from "@/lib/dates";
import { useAuth } from "@/lib/auth";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { UserAvatar } from "@/components/common/UserAvatar";
import {
  useReportsSummary,
  useCaseGrowth,
  usePracticeAreas,
  useEmployeeWorkload,
  useTopClients,
  useCaseStatusBreakdown,
  useMyPerformance,
  useDailyEmployeeReport,
  useClientReports,
  useClientDetailReport,
  useEmployeeDetailReport,
  useFirmAnalytics,
  type FirmAnalyticsResponse,
  type FirmAnalyticsFilters,
  EmployeeDailyReport,
} from "@/services/reports";
import { useRecordClientVisit } from "@/services/clients";
import type { TaskRecord } from "@/services/tasks";
import { SortHeaderButton } from "@/components/common/table/SortableTableHeader";
import { useTableSorting } from "@/hooks/useTableSorting";

export const Route = createFileRoute("/_shell/reports")({
  head: () => ({
    meta: [
      { title: "Reports · SS Associates Legal-Tech LLP" },
      { name: "description", content: "Operational insight for the firm: employee daily reporting, case mix, growth, workload and completion rates." },
      { property: "og:title", content: "Reports · SS Associates Legal-Tech LLP" },
      { property: "og:description", content: "Employee daily reporting, case mix, growth, workload and completion rates at a glance." },
    ],
  }),
  component: ReportsPage,
});

// ---------------------------------------------------------------------------
// Timezone Helpers (Asia/Kolkata / Local)
// ---------------------------------------------------------------------------

function getTodayKolkata(): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(new Date());
  } catch {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
}

function formatReadableDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    if (!year || !month || !day) return dateStr;
    const d = new Date(year, month - 1, day);
    return formatSafeDate(d);
  } catch {
    return dateStr;
  }
}

function shiftDate(dateStr: string, days: number): string {
  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    const d = new Date(year, month - 1, day);
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dt = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dt}`;
  } catch {
    return dateStr;
  }
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

function ReportsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const navigate = useNavigate();

  // Navigation Tabs: "employees" | "clients" | "firm_analytics"
  const [activeTab, setActiveTab] = useState<"employees" | "clients" | "firm_analytics">("employees");

  // Selected date & employee filter for daily reporting
  const [selectedDate, setSelectedDate] = useState(() => getTodayKolkata());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");

  // Drilldown states for detailed employee & client reports
  const [drilldownEmployeeId, setDrilldownEmployeeId] = useState<string | null>(null);
  const [drilldownClientId, setDrilldownClientId] = useState<string | null>(null);

  // Client Reports state & filters
  const [clientSearch, setClientSearch] = useState("");
  const [clientTagFilter, setClientTagFilter] = useState("All");

  // Visit recording modal in client drill-down
  const [showRecordVisitModal, setShowRecordVisitModal] = useState(false);
  const [visitPurpose, setVisitPurpose] = useState("");
  const [visitNotes, setVisitNotes] = useState("");

  // Task detail dialog modal state
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);

  // Queries
  const { data: summary } = useReportsSummary();
  const { data: caseGrowthData, isLoading: growthLoading, isError: growthError, refetch: refetchGrowth } = useCaseGrowth();
  const { data: practiceData, isLoading: practiceLoading, isError: practiceError, refetch: refetchPractice } = usePracticeAreas();
  const { data: workloadData, isLoading: workloadLoading, isError: workloadError, refetch: refetchWorkload } = useEmployeeWorkload();
  const { data: topClientsData } = useTopClients();
  const { data: statusBreakdownData } = useCaseStatusBreakdown();
  const { data: myPerformanceData, isLoading: performanceLoading, isError: performanceError, refetch: refetchPerformance } = useMyPerformance(!isAdmin);

  const {
    data: dailyReportData,
    isLoading: dailyReportLoading,
    isError: dailyReportError,
    refetch: refetchDailyReport,
  } = useDailyEmployeeReport(
    { date: selectedDate, employeeId: selectedEmployeeId || undefined },
    isAdmin
  );

  const { data: clientReportsData, isLoading: clientReportsLoading, refetch: refetchClientReports } = useClientReports({
    search: clientSearch,
    tag: clientTagFilter !== "All" ? clientTagFilter : undefined,
  });

  const { data: clientDetailData, isLoading: clientDetailLoading } = useClientDetailReport(drilldownClientId || undefined);
  const { data: employeeDetailData, isLoading: employeeDetailLoading } = useEmployeeDetailReport(drilldownEmployeeId || undefined);

  const rawClients = clientReportsData?.clients ?? [];
  const {
    sortedData: sortedClientReports,
    sortKey: clientReportSortKey,
    sortDirection: clientReportSortDir,
    onSort: handleClientReportSort,
  } = useTableSorting(rawClients, {
    accessors: {
      name: (c) => c.name,
      type: (c) => `${c.type} ${c.tag}`,
      contact: (c) => c.phone || c.email || "",
      activeCases: (c) => c.metrics?.activeCases ?? 0,
      pendingTasks: (c) => c.metrics?.pendingTasks ?? 0,
      visitCount: (c) => c.visitCount ?? 0,
      lastVisitAt: (c) => c.lastVisitAt || "",
    },
  });

  const recordVisitMutation = useRecordClientVisit();

  const growth = caseGrowthData?.growth ?? [];
  const distribution = practiceData?.distribution ?? [];
  const workloads = workloadData?.workloads ?? [];
  const topClients = topClientsData?.topClients ?? [];
  const caseStatusBreakdown = statusBreakdownData?.breakdown ?? { Active: 0, "On Hold": 0, Closed: 0, Urgent: 0 };
  const performance = myPerformanceData?.performance ?? [];
  const dailyReports = dailyReportData?.reports ?? [];

  // Compute Firm-wide Daily Aggregates from dailyReports
  const firmDailyTotals = useMemo(() => {
    let assignedOnDate = 0;
    let completedOnDate = 0;
    let pendingWorkload = 0;
    let overdueItems = 0;

    for (const r of dailyReports) {
      assignedOnDate += r.metrics.assignedTodayCount || 0;
      completedOnDate += r.metrics.completedTodayCount || 0;
      pendingWorkload += r.metrics.pendingCount || 0;
      overdueItems += r.metrics.overdueCount || 0;
    }

    return { assignedOnDate, completedOnDate, pendingWorkload, overdueItems };
  }, [dailyReports]);

  const handleOpenTask = (task: TaskRecord) => {
    setSelectedTask(task);
    setTaskDialogOpen(true);
  };

  const handleCloseTaskDialog = () => {
    setTaskDialogOpen(false);
    setSelectedTask(null);
  };

  const todayStr = getTodayKolkata();
  const isToday = selectedDate === todayStr;

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        breadcrumb={[{ label: "SS Associates", to: "/" }, { label: "Reports" }]}
        title="Reports & Daily Activity"
        subtitle={
          isAdmin
            ? "Operational monitoring of employee daily task activity, case mix, firm-wide workload, and growth."
            : "Your personal performance and work completed. No financial data."
        }
        actions={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/50 px-3 py-1 text-caption font-medium">
              <span
                className={`size-2 rounded-full ${isAdmin ? "bg-primary" : "bg-emerald-500"}`}
              />
              <span>Scope: {isAdmin ? "Entire Firm" : "Personal (You)"}</span>
            </span>
          </div>
        }
      />

      {/* ── Top-Level View Selector ── */}
      <div className="flex items-center border-b border-border/60 pb-1 gap-2 no-print">
        <button
          type="button"
          onClick={() => {
            setActiveTab("employees");
            setDrilldownEmployeeId(null);
          }}
          className={cn(
            "flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg transition-all",
            activeTab === "employees"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Users size={16} />
          <span>Employee Reports</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab("clients");
            setDrilldownClientId(null);
          }}
          className={cn(
            "flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg transition-all",
            activeTab === "clients"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Briefcase size={16} />
          <span>Client Reports</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("firm_analytics")}
          className={cn(
            "flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg transition-all",
            activeTab === "firm_analytics"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <BarChart3 size={16} />
          <span>Firm Analytics</span>
        </button>
      </div>

      {/* ── SECTION 1: EMPLOYEE REPORTS & DRILL-DOWN ── */}
      {activeTab === "employees" && (
        <>
          {drilldownEmployeeId ? (
            <EmployeeDetailReportView
              employeeId={drilldownEmployeeId}
              onBack={() => setDrilldownEmployeeId(null)}
              onOpenTask={handleOpenTask}
            />
          ) : (
            <>
              {/* Daily Employee Activity Report (Preserved & Enhanced with View Drill-Down) */}
              {isAdmin && (
                <section aria-label="Daily Employee Activity Report">
          <SectionCard
            title="Daily Employee Activity Report"
            description="Operational monitoring of employee daily workload, completed tasks, active pending workload, and overdue items."
            icon={Calendar}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center rounded-lg border border-border bg-card p-0.5 shadow-xs">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
                    title="Previous Day"
                    className="h-7 w-7 p-0"
                  >
                    <ChevronLeft size={15} />
                  </Button>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      if (e.target.value) setSelectedDate(e.target.value);
                    }}
                    className="border-0 bg-transparent px-2 py-0.5 text-xs font-medium text-foreground focus:outline-none focus:ring-0 min-w-[135px]"
                    aria-label="Select report date"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
                    title="Next Day"
                    className="h-7 w-7 p-0"
                  >
                    <ChevronRight size={15} />
                  </Button>
                </div>

                <Button
                  type="button"
                  variant={isToday ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setSelectedDate(todayStr)}
                  className="h-8 text-xs font-medium"
                >
                  Today
                </Button>

                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="h-8 rounded-lg border border-border bg-card px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                  aria-label="Filter by employee"
                >
                  <option value="">All Employees</option>
                  {workloads.map((w) => (
                    <option key={w._id} value={w._id}>
                      {w.name}
                    </option>
                  ))}
                </select>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => refetchDailyReport()}
                  disabled={dailyReportLoading}
                  className="h-8 text-xs"
                  title="Refresh Daily Report"
                >
                  <RefreshCw size={13} className={cn("mr-1.5", dailyReportLoading && "animate-spin")} />
                  Refresh
                </Button>
              </div>
            }
          >
            {/* Human Readable Date Header Banner */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-xs">
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-primary shrink-0" />
                <span className="text-muted-foreground">Report for:</span>
                <span className="font-semibold text-foreground">{formatReadableDate(selectedDate)}</span>
                {isToday && (
                  <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold text-primary uppercase tracking-wider">
                    Today
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-caption text-muted-foreground">
                <span>Timezone: <strong className="text-foreground">Asia/Kolkata (IST)</strong></span>
                <span>•</span>
                <span>Employees Tracked: <strong className="text-foreground">{dailyReports.length}</strong></span>
              </div>
            </div>

            {/* 4 Firm-wide Daily Summary Cards */}
            <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {/* Card 1: Assigned on Date */}
              <div className="rounded-xl border border-border/80 bg-card p-4 shadow-soft">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-caption font-medium text-muted-foreground">Assigned on Date</span>
                  <span className="grid size-7 place-items-center rounded-md bg-muted text-muted-foreground">
                    <CheckSquare size={14} />
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <span className="text-2xl font-bold tracking-tight text-foreground">{firmDailyTotals.assignedOnDate}</span>
                  <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Day Activity
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">Tasks delegated or created on selected date</p>
              </div>

              {/* Card 2: Completed on Date */}
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 shadow-soft">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-caption font-medium text-emerald-600 dark:text-emerald-400">Completed on Date</span>
                  <span className="grid size-7 place-items-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={14} />
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <span className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">{firmDailyTotals.completedOnDate}</span>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                    Day Activity
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">Tasks verified or marked done on date</p>
              </div>

              {/* Card 3: Current Pending Workload */}
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 shadow-soft">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-caption font-medium text-blue-600 dark:text-blue-400">Current Pending Workload</span>
                  <span className="grid size-7 place-items-center rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <Clock size={14} />
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <span className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">{firmDailyTotals.pendingWorkload}</span>
                  <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                    Outstanding
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">Active in-progress &amp; review items across firm</p>
              </div>

              {/* Card 4: Currently Overdue */}
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 shadow-soft">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-caption font-medium text-rose-600 dark:text-rose-400">Currently Overdue</span>
                  <span className="grid size-7 place-items-center rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400">
                    <AlertTriangle size={14} />
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <span className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">{firmDailyTotals.overdueItems}</span>
                  <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-600 dark:text-rose-400">
                    Needs Attention
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">Past-due tasks requiring immediate follow-up</p>
              </div>
            </div>

            {/* Employee Daily Activity List */}
            {dailyReportLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="animate-spin text-primary" size={28} />
              </div>
            ) : dailyReportError ? (
              <ErrorState title="Couldn't load daily employee reports" onRetry={refetchDailyReport} />
            ) : dailyReports.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-12 text-center bg-card/30">
                <Calendar size={32} className="mx-auto text-muted-foreground/60 mb-2" />
                <p className="text-sm font-medium text-foreground">No employee activity recorded for {formatReadableDate(selectedDate)}</p>
                <p className="text-xs text-muted-foreground mt-1">Try selecting another date or viewing all employees.</p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {dailyReports.map((report) => (
                  <EmployeeDailyReportCard
                    key={report.employee._id}
                    report={report}
                    selectedDate={selectedDate}
                    onOpenTask={handleOpenTask}
                    onDrilldown={() => setDrilldownEmployeeId(report.employee._id)}
                  />
                ))}
              </div>
            )}
          </SectionCard>
        </section>
      )}
            </>
          )}
        </>
      )}

      {/* ── SECTION 2: CLIENT REPORTS & DRILL-DOWN ── */}
      {activeTab === "clients" && (
        <>
          {drilldownClientId ? (
            <ClientDetailReportView
              clientId={drilldownClientId}
              onBack={() => setDrilldownClientId(null)}
              onOpenTask={handleOpenTask}
            />
          ) : (
            <section aria-label="Client Reports List" className="space-y-4">
              <SectionCard
                title="Client Reports & Matters Overview"
                description="Master client reporting register with active matter counts, task loads, and office visit histories."
                icon={Briefcase}
                actions={
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
                      <Input
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        placeholder="Search clients, phone, KYC..."
                        className="h-8 pl-8 text-xs w-48 sm:w-60 rounded-md"
                      />
                    </div>
                    <select
                      value={clientTagFilter}
                      onChange={(e) => setClientTagFilter(e.target.value)}
                      className="h-8 rounded-md border border-border bg-card px-2 text-xs"
                    >
                      <option value="All">All Tags</option>
                      <option value="Active">Active</option>
                      <option value="VIP">VIP</option>
                      <option value="Corporate">Corporate</option>
                      <option value="Individual">Individual</option>
                      <option value="Archived">Archived</option>
                    </select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.print()}
                      className="h-8 text-xs rounded-md"
                    >
                      <Printer size={14} className="mr-1.5" /> Print Register
                    </Button>
                  </div>
                }
              >
                {clientReportsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-muted-foreground" size={24} />
                  </div>
                ) : !clientReportsData?.clients || clientReportsData.clients.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-12 text-center bg-card/30">
                    <Briefcase size={32} className="mx-auto text-muted-foreground/60 mb-2" />
                    <p className="text-sm font-medium text-foreground">No clients found matching search criteria</p>
                  </div>
                ) : (
                  <>
                    {/* Desktop / Laptop Table View */}
                    <div className="hidden md:block overflow-hidden rounded-lg border border-border">
                      <table className="w-full table-fixed text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-border text-muted-foreground font-medium bg-muted/30">
                            <th className="py-2.5 px-3 w-[22%]">
                              <SortHeaderButton
                                sortKey="name"
                                currentSortKey={clientReportSortKey}
                                currentDirection={clientReportSortDir}
                                onSort={handleClientReportSort}
                              >
                                Client Name
                              </SortHeaderButton>
                            </th>
                            <th className="py-2.5 px-3 w-[15%]">
                              <SortHeaderButton
                                sortKey="type"
                                currentSortKey={clientReportSortKey}
                                currentDirection={clientReportSortDir}
                                onSort={handleClientReportSort}
                              >
                                Type / Tag
                              </SortHeaderButton>
                            </th>
                            <th className="py-2.5 px-3 w-[18%]">
                              <SortHeaderButton
                                sortKey="contact"
                                currentSortKey={clientReportSortKey}
                                currentDirection={clientReportSortDir}
                                onSort={handleClientReportSort}
                              >
                                Contact
                              </SortHeaderButton>
                            </th>
                            <th className="py-2.5 px-3 w-[9%] text-center">
                              <SortHeaderButton
                                sortKey="activeCases"
                                currentSortKey={clientReportSortKey}
                                currentDirection={clientReportSortDir}
                                onSort={handleClientReportSort}
                                align="center"
                              >
                                Active Matters
                              </SortHeaderButton>
                            </th>
                            <th className="py-2.5 px-3 w-[9%] text-center">
                              <SortHeaderButton
                                sortKey="pendingTasks"
                                currentSortKey={clientReportSortKey}
                                currentDirection={clientReportSortDir}
                                onSort={handleClientReportSort}
                                align="center"
                              >
                                Pending Tasks
                              </SortHeaderButton>
                            </th>
                            <th className="py-2.5 px-3 w-[7%] text-center">
                              <SortHeaderButton
                                sortKey="visitCount"
                                currentSortKey={clientReportSortKey}
                                currentDirection={clientReportSortDir}
                                onSort={handleClientReportSort}
                                align="center"
                              >
                                Visits
                              </SortHeaderButton>
                            </th>
                            <th className="py-2.5 px-3 w-[12%]">
                              <SortHeaderButton
                                sortKey="lastVisitAt"
                                currentSortKey={clientReportSortKey}
                                currentDirection={clientReportSortDir}
                                onSort={handleClientReportSort}
                              >
                                Last Visit
                              </SortHeaderButton>
                            </th>
                            <th className="py-2.5 px-3 w-[8%] text-right no-print">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {sortedClientReports.map((c) => (
                            <tr key={c._id} className="hover:bg-muted/20 transition-colors">
                              <td className="py-2.5 px-3 font-semibold text-foreground break-words">
                                {c.name}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary mr-1">
                                  {c.type}
                                </span>
                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                                  {c.tag}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-muted-foreground min-w-0">
                                <div className="truncate">{c.phone || "—"}</div>
                                <div className="text-[10px] truncate text-muted-foreground/80">{c.email || ""}</div>
                              </td>
                              <td className="py-2.5 px-3 text-center font-semibold num">
                                {c.metrics.activeCases}
                              </td>
                              <td className="py-2.5 px-3 text-center font-semibold num">
                                <span className={c.metrics.pendingTasks > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}>
                                  {c.metrics.pendingTasks}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center font-semibold num">
                                {c.visitCount}
                              </td>
                              <td className="py-2.5 px-3 text-muted-foreground">
                                {c.lastVisitAt ? formatSafeDate(c.lastVisitAt) : "—"}
                              </td>
                              <td className="py-2.5 px-3 text-right no-print">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setDrilldownClientId(c._id)}
                                  className="h-7 text-xs rounded-md"
                                >
                                  View
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile / Tablet Stacked Cards */}
                    <div className="md:hidden space-y-3">
                      {sortedClientReports.map((c) => (
                        <div
                          key={c._id}
                          className="rounded-xl border border-border bg-card p-3.5 shadow-soft space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <h4 className="font-semibold text-foreground text-sm leading-tight break-words">{c.name}</h4>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
                                  {c.type}
                                </span>
                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                                  {c.tag}
                                </span>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDrilldownClientId(c._id)}
                              className="h-7 text-xs rounded-md shrink-0 no-print"
                            >
                              View Report
                            </Button>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border/60">
                            <div>
                              <span className="text-[10px] text-muted-foreground uppercase block font-medium">Contact</span>
                              <div className="text-foreground truncate mt-0.5">{c.phone || "—"}</div>
                              {c.email && <div className="text-[10px] text-muted-foreground truncate">{c.email}</div>}
                            </div>
                            <div>
                              <span className="text-[10px] text-muted-foreground uppercase block font-medium">Last Visit</span>
                              <div className="text-foreground truncate mt-0.5">{c.lastVisitAt ? formatSafeDate(c.lastVisitAt) : "—"}</div>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-center bg-muted/20 rounded-lg p-2 border border-border/40">
                            <div>
                              <div className="text-sm font-bold text-foreground num">{c.metrics.activeCases}</div>
                              <span className="text-[10px] text-muted-foreground block font-medium">Matters</span>
                            </div>
                            <div>
                              <div className={`text-sm font-bold num ${c.metrics.pendingTasks > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                                {c.metrics.pendingTasks}
                              </div>
                              <span className="text-[10px] text-muted-foreground block font-medium">Pending Tasks</span>
                            </div>
                            <div>
                              <div className="text-sm font-bold text-foreground num">{c.visitCount}</div>
                              <span className="text-[10px] text-muted-foreground block font-medium">Visits</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </SectionCard>
            </section>
          )}
        </>
      )}

      {/* ── SECTION 3: FIRM ANALYTICS (Charts & High-level Overview) ── */}
      {activeTab === "firm_analytics" && (
        <FirmAnalyticsView
          isAdmin={isAdmin}
          onSelectEmployee={(id) => {
            setActiveTab("employees");
            setDrilldownEmployeeId(id);
          }}
          onSelectClient={(id) => {
            setActiveTab("clients");
            setDrilldownClientId(id);
          }}
        />
      )}

      {/* Authoritative Task Detail Dialog Modal */}
      {selectedTask && (
        <TaskDetailDialog
          open={taskDialogOpen}
          onClose={handleCloseTaskDialog}
          task={selectedTask}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CSV Export for Firm Analytics
// ---------------------------------------------------------------------------

function exportFirmAnalyticsCSV(analytics: FirmAnalyticsResponse) {
  const lines: string[] = [];
  lines.push(`SS ASSOCIATES LEGAL-TECH LLP — FIRM ANALYTICS REPORT`);
  lines.push(`Generated At,${analytics.generatedAt}`);
  lines.push(`Reporting Period,${analytics.filters.period} (${analytics.filters.startDate} to ${analytics.filters.endDate})`);
  lines.push(`Timezone,${analytics.filters.timezone}`);
  lines.push(``);
  lines.push(`EXECUTIVE OVERVIEW (SNAPSHOT & PERIOD METRICS)`);
  lines.push(`Metric,Value,Type,Period Comparison`);
  lines.push(`Active Matters,${analytics.overview.activeCases},Current Snapshot,—`);
  lines.push(`Active Clients,${analytics.overview.activeClients},Current Snapshot,—`);
  lines.push(`Open Tasks,${analytics.overview.openTasks},Current Snapshot,—`);
  lines.push(`Overdue Tasks,${analytics.overview.overdueTasks},Current Snapshot,—`);
  lines.push(`Pending Approvals,${analytics.overview.pendingApprovals},Current Snapshot,—`);
  lines.push(`Upcoming Hearings,${analytics.overview.upcomingHearings},Current Snapshot,—`);
  lines.push(`Tasks Completed,${analytics.overview.tasksCompleted},Selected Period,${analytics.overview.tasksCompletedDiffPct != null ? `${analytics.overview.tasksCompletedDiffPct}% vs prev` : "—"}`);
  lines.push(`Documents Approved,${analytics.overview.docsApproved},Selected Period,${analytics.overview.docsApprovedDiffPct != null ? `${analytics.overview.docsApprovedDiffPct}% vs prev` : "—"}`);
  lines.push(`New Matters Filed,${analytics.overview.newCases},Selected Period,${analytics.overview.newCasesDiffPct != null ? `${analytics.overview.newCasesDiffPct}% vs prev` : "—"}`);
  lines.push(`Matters Closed,${analytics.overview.closedCases},Selected Period,${analytics.overview.closedCasesDiffPct != null ? `${analytics.overview.closedCasesDiffPct}% vs prev` : "—"}`);
  lines.push(`New Clients Registered,${analytics.overview.newClients},Selected Period,${analytics.overview.newClientsDiffPct != null ? `${analytics.overview.newClientsDiffPct}% vs prev` : "—"}`);
  lines.push(`Hearings Held,${analytics.overview.hearingsHeld},Selected Period,${analytics.overview.hearingsHeldDiffPct != null ? `${analytics.overview.hearingsHeldDiffPct}% vs prev` : "—"}`);
  lines.push(``);
  lines.push(`PRACTICE AREA DISTRIBUTION`);
  lines.push(`Practice Area,Active Matters,Percentage`);
  analytics.cases.practiceDistribution.forEach((p) => {
    lines.push(`"${p.name.replace(/"/g, '""')}",${p.value},${p.percentage}%`);
  });
  lines.push(``);
  lines.push(`EMPLOYEE WORKLOAD & ACTIVITY`);
  lines.push(`Employee Name,Role,Active Cases,Assigned Tasks,Open Tasks,Completed in Period,Overdue Tasks`);
  analytics.employees.workload.forEach((e) => {
    lines.push(`"${e.name.replace(/"/g, '""')}",${e.role},${e.activeCases},${e.assignedTasks},${e.openTasks},${e.completedInPeriod},${e.overdueTasks}`);
  });

  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `SS_Associates_Firm_Analytics_${analytics.filters.startDate}_to_${analytics.filters.endDate}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Word-wrapping helper for Recharts SVG labels
// ---------------------------------------------------------------------------

function wrapText(text: string, maxCharsPerLine = 24): string[] {
  if (!text) return ["Unclassified"];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
    } else if ((currentLine + " " + word).length <= maxCharsPerLine) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

const CustomYAxisTick = (props: any) => {
  const { x, y, payload } = props;
  const lines = wrapText(payload.value, 26);
  const lineHeight = 13;
  const startY = y - ((lines.length - 1) * lineHeight) / 2;

  return (
    <g transform={`translate(${x},${startY})`}>
      <text
        x={-8}
        y={0}
        textAnchor="end"
        className="fill-foreground font-medium text-[11px] sm:text-xs"
        dominantBaseline="central"
      >
        {lines.map((line, idx) => (
          <tspan key={idx} x={-8} dy={idx === 0 ? 0 : lineHeight}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
};

// ---------------------------------------------------------------------------
// Practice Area Distribution Chart
// ---------------------------------------------------------------------------

function PracticeAreaChart({
  distribution,
  onSelectCategory,
}: {
  distribution: Array<{ name: string; value: number; percentage: number }>;
  onSelectCategory?: (category: string) => void;
}) {
  const sorted = useMemo(() => {
    return [...distribution].sort((a, b) => b.value - a.value);
  }, [distribution]);

  const maxVal = Math.max(1, ...sorted.map((s) => s.value));
  const rowHeight = 44;
  const dynamicHeight = Math.max(260, sorted.length * rowHeight);

  if (sorted.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-helper text-muted-foreground">
        No active practice area records yet
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Mobile Stacked View (< 640px) */}
      <div className="sm:hidden space-y-2.5">
        {sorted.map((item) => (
          <div
            key={item.name}
            onClick={() => onSelectCategory?.(item.name)}
            className="group rounded-lg border border-border/60 bg-muted/20 p-2.5 transition-colors hover:bg-muted/40 cursor-pointer active:scale-[0.99]"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors leading-tight">
                {item.name}
              </span>
              <span className="shrink-0 text-xs font-bold text-foreground num">
                {item.value} <span className="text-[10px] text-muted-foreground font-normal">({item.percentage}%)</span>
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${Math.round((item.value / maxVal) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop / Tablet Horizontal Bar Chart (>= 640px) */}
      <div className="hidden sm:block">
        <div className="max-h-[460px] overflow-y-auto pr-1">
          <ResponsiveContainer width="100%" height={dynamicHeight}>
            <BarChart
              data={sorted}
              layout="vertical"
              barCategoryGap={10}
              margin={{ left: 10, right: 36, top: 10, bottom: 10 }}
              onClick={(state) => {
                if (state && state.activePayload && state.activePayload.length > 0) {
                  const clickedName = state.activePayload[0].payload.name;
                  if (clickedName) onSelectCategory?.(clickedName);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                tickLine={false}
                axisLine={false}
                width={230}
                tick={<CustomYAxisTick />}
                interval={0}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                contentStyle={{
                  borderRadius: "var(--radius-medium)",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--card)",
                  boxShadow: "var(--shadow-soft)",
                }}
                formatter={(value: any, name: any, item: any) => [
                  `${value} active matters (${item?.payload?.percentage ?? 0}%)`,
                  "Specialization Scope",
                ]}
                labelFormatter={(label) => `Practice Area: ${label}`}
              />
              <Bar
                dataKey="value"
                radius={[0, 6, 6, 0]}
                fill="var(--chart-2)"
                barSize={18}
                name="Active Matters"
                className="cursor-pointer hover:opacity-85 transition-opacity"
              >
                <LabelList dataKey="value" position="right" className="fill-muted-foreground text-xs font-semibold" offset={8} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Case Growth Chart
// ---------------------------------------------------------------------------

function CaseGrowthChart({ growth }: { growth: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={240}>
      <AreaChart data={growth} margin={{ left: -10, right: 12, top: 12, bottom: 0 }}>
        <defs>
          <linearGradient id="gNew" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="gClosed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
        <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            borderRadius: "var(--radius-medium)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-soft)",
            backgroundColor: "var(--card)",
          }}
          formatter={(value: any, name: any) => [
            `${value} matters`,
            name === "New Cases" ? "Newly Filed Matters" : "Resolved & Closed Matters",
          ]}
        />
        <Legend
          verticalAlign="bottom"
          height={36}
          formatter={(val) => (
            <span className="text-caption font-medium text-foreground">
              {val === "New Cases" ? "Newly Filed Matters" : "Resolved & Closed Matters"}
            </span>
          )}
        />
        <Area type="monotone" dataKey="cases" stroke="var(--chart-1)" fill="url(#gNew)" strokeWidth={2.5} name="New Cases" />
        <Area type="monotone" dataKey="closed" stroke="var(--chart-3)" fill="url(#gClosed)" strokeWidth={2} name="Closed" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Case Status Distribution Chart
// ---------------------------------------------------------------------------

function CaseStatusChart({
  statusDistribution,
  onSelectStatus,
}: {
  statusDistribution: Array<{ name: string; value: number; color: string }>;
  onSelectStatus?: (status: string) => void;
}) {
  const total = useMemo(() => statusDistribution.reduce((acc, curr) => acc + curr.value, 0), [statusDistribution]);

  return (
    <div className="w-full">
      <div className="h-60 relative flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={statusDistribution}
              dataKey="value"
              nameKey="name"
              innerRadius={64}
              outerRadius={92}
              paddingAngle={3}
              stroke="none"
              onClick={(state) => {
                if (state && state.name) onSelectStatus?.(state.name);
              }}
              className="cursor-pointer"
            >
              {statusDistribution.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: "var(--radius-medium)",
                border: "1px solid var(--border)",
                backgroundColor: "var(--card)",
              }}
              formatter={(value: any, name: any) => [`${value} matters`, `${name} Stage`]}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Center Total Summary */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-bold font-display text-foreground num leading-none">{total}</span>
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mt-1">Total Matters</span>
        </div>
      </div>

      {/* Clickable Status Filter Badges */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2 border-t border-border/60 pt-3">
        {statusDistribution.map((s) => (
          <button
            key={s.name}
            type="button"
            onClick={() => onSelectStatus?.(s.name)}
            className="group rounded-lg border border-border/60 bg-muted/20 p-2 text-center transition-all hover:bg-muted/50 hover:border-border active:scale-95 cursor-pointer"
          >
            <p className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors font-medium">{s.name}</p>
            <p className="num text-base font-bold text-foreground mt-0.5">{s.value}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Consolidated Firm Analytics Management Dashboard Component
// ---------------------------------------------------------------------------

function FirmAnalyticsView({
  isAdmin,
  onSelectEmployee,
  onSelectClient,
}: {
  isAdmin: boolean;
  onSelectEmployee: (id: string) => void;
  onSelectClient: (id: string) => void;
}) {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<string>("30d");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");

  const { data: analytics, isLoading, isError, refetch, isRefetching } = useFirmAnalytics({
    period,
    startDate: period === "custom" && customStart ? customStart : undefined,
    endDate: period === "custom" && customEnd ? customEnd : undefined,
  });

  const handleRefresh = async () => {
    try {
      await refetch();
      toast.success("Firm analytics refreshed with authoritative records");
    } catch {
      toast.error("Failed to refresh analytics");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    if (!analytics) return;
    exportFirmAnalyticsCSV(analytics);
  };

  const PRESET_OPTIONS = [
    { id: "7d", label: "Last 7 Days" },
    { id: "30d", label: "Last 30 Days" },
    { id: "90d", label: "Last 90 Days" },
    { id: "month", label: "This Month" },
    { id: "last_month", label: "Last Month" },
    { id: "quarter", label: "This Quarter" },
    { id: "year", label: "This Year" },
    { id: "all", label: "All Time" },
    { id: "custom", label: "Custom Range" },
  ];

  return (
    <div className="space-y-6">
      {/* Printable Report Header (Print media only) */}
      <div className="hidden print:block border-b-2 border-gray-400 pb-4 mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-black">SS ASSOCIATES LEGAL-TECH LLP</h1>
        <h2 className="text-base font-semibold text-gray-700 mt-1 uppercase tracking-wide">
          Official Executive Firm Analytics &amp; Management Dashboard Report
        </h2>
        <div className="grid grid-cols-2 text-xs mt-3 text-gray-800">
          <div>
            <p><strong>Reporting Scope:</strong> Entire Firm · All Specializations &amp; Courts</p>
            <p><strong>Selected Period:</strong> {analytics?.filters.period.toUpperCase()} ({analytics?.filters.startDate} to {analytics?.filters.endDate})</p>
          </div>
          <div className="text-right">
            <p><strong>Generated On:</strong> {new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
            <p><strong>Timezone:</strong> Asia/Kolkata (IST)</p>
          </div>
        </div>
      </div>

      {/* Interactive Controls & Preset Filters Header (No print) */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-card/60 p-4 shadow-soft no-print">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
              <BarChart3 className="size-5 text-primary" />
              <span>Practice Analytics &amp; Firm Intelligence</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live operational monitoring backed by MongoDB records · Period: <span className="font-medium text-foreground">{analytics?.filters.startDate ?? "—"}</span> to <span className="font-medium text-foreground">{analytics?.filters.endDate ?? "—"}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefetching || isLoading}
              className="h-8.5 rounded-lg text-xs gap-1.5"
            >
              <RefreshCw className={cn("size-3.5", (isRefetching || isLoading) && "animate-spin")} />
              <span>Refresh</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={!analytics}
              className="h-8.5 rounded-lg text-xs gap-1.5"
            >
              <Download className="size-3.5" />
              <span>Export CSV</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              disabled={!analytics}
              className="h-8.5 rounded-lg text-xs gap-1.5"
            >
              <Printer className="size-3.5" />
              <span>Print Report</span>
            </Button>
          </div>
        </div>

        {/* Preset Range Selector Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/60">
          {PRESET_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setPeriod(opt.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                period === opt.id
                  ? "bg-primary text-primary-foreground shadow-2xs font-semibold"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}

          {period === "custom" && (
            <div className="flex items-center gap-2 ml-auto w-full sm:w-auto mt-2 sm:mt-0">
              <Input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="h-8 text-xs w-36 rounded-lg bg-background"
                placeholder="Start Date"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="h-8 text-xs w-36 rounded-lg bg-background"
                placeholder="End Date"
              />
            </div>
          )}
        </div>
      </div>

      {/* Main Analytics Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-3">
          <Loader2 className="animate-spin text-primary size-8" />
          <p className="text-sm font-medium text-muted-foreground">Aggregating live practice data across firm collections...</p>
        </div>
      ) : isError || !analytics ? (
        <ErrorState
          title="Could not load firm analytics"
          description="Failed to aggregate reporting metrics from the database."
          onRetry={handleRefresh}
        />
      ) : (
        <div className="space-y-6">
          {/* ── 1. EXECUTIVE OVERVIEW KPI GRID (8 ACTIONABLE CARDS) ── */}
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {/* Active Matters (Snapshot) */}
            <div
              onClick={() => navigate({ to: "/cases", search: { status: "Active" } })}
              className="group relative rounded-xl border border-border bg-card p-4.5 shadow-soft transition-all hover:border-primary/50 hover:shadow-md cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Gavel size={20} strokeWidth={1.8} />
                </span>
                <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Snapshot
                </span>
              </div>
              <div className="mt-3">
                <p className="text-xs font-medium text-muted-foreground">Active Matters</p>
                <div className="flex items-baseline justify-between mt-1">
                  <p className="num text-2xl font-bold text-foreground">{analytics.overview.activeCases}</p>
                  <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">Excludes closed &amp; archived matters</p>
              </div>
            </div>

            {/* Active Clients (Snapshot) */}
            <div
              onClick={() => navigate({ to: "/clients" })}
              className="group relative rounded-xl border border-border bg-card p-4.5 shadow-soft transition-all hover:border-primary/50 hover:shadow-md cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <span className="grid size-10 place-items-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Users size={20} strokeWidth={1.8} />
                </span>
                <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Snapshot
                </span>
              </div>
              <div className="mt-3">
                <p className="text-xs font-medium text-muted-foreground">Active Clients</p>
                <div className="flex items-baseline justify-between mt-1">
                  <p className="num text-2xl font-bold text-foreground">{analytics.overview.activeClients}</p>
                  <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-blue-500 transition-colors" />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {analytics.clients.summary.corporateClients} Corporate · {analytics.clients.summary.individualClients} Individual
                </p>
              </div>
            </div>

            {/* Open Tasks (Snapshot) */}
            <div
              onClick={() => navigate({ to: "/tasks" })}
              className="group relative rounded-xl border border-border bg-card p-4.5 shadow-soft transition-all hover:border-primary/50 hover:shadow-md cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <span className="grid size-10 place-items-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <CheckSquare size={20} strokeWidth={1.8} />
                </span>
                <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Snapshot
                </span>
              </div>
              <div className="mt-3">
                <p className="text-xs font-medium text-muted-foreground">Open Tasks</p>
                <div className="flex items-baseline justify-between mt-1">
                  <p className="num text-2xl font-bold text-foreground">{analytics.overview.openTasks}</p>
                  <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-indigo-500 transition-colors" />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {analytics.tasks.summary.in_progress} In Progress · {analytics.tasks.summary.pending} Pending
                </p>
              </div>
            </div>

            {/* Overdue Tasks (Snapshot Alert) */}
            <div
              onClick={() => navigate({ to: "/tasks", search: { tab: "Overdue" } })}
              className={cn(
                "group relative rounded-xl border p-4.5 shadow-soft transition-all hover:shadow-md cursor-pointer",
                analytics.overview.overdueTasks > 0
                  ? "border-rose-300 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20"
                  : "border-border bg-card hover:border-primary/50"
              )}
            >
              <div className="flex items-start justify-between">
                <span className={cn(
                  "grid size-10 place-items-center rounded-lg",
                  analytics.overview.overdueTasks > 0
                    ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                    : "bg-muted text-muted-foreground"
                )}>
                  <Clock size={20} strokeWidth={1.8} />
                </span>
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  analytics.overview.overdueTasks > 0
                    ? "bg-rose-500/15 text-rose-700 dark:text-rose-400"
                    : "bg-muted/60 text-muted-foreground"
                )}>
                  {analytics.overview.overdueTasks > 0 ? "Action Required" : "Snapshot"}
                </span>
              </div>
              <div className="mt-3">
                <p className="text-xs font-medium text-muted-foreground">Overdue Tasks</p>
                <div className="flex items-baseline justify-between mt-1">
                  <p className={cn(
                    "num text-2xl font-bold",
                    analytics.overview.overdueTasks > 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground"
                  )}>
                    {analytics.overview.overdueTasks}
                  </p>
                  <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-rose-500 transition-colors" />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {analytics.overview.overdueTasks > 0 ? "Past statutory deadline" : "All deadlines on schedule"}
                </p>
              </div>
            </div>

            {/* Tasks Completed (Period) */}
            <div
              onClick={() => navigate({ to: "/tasks", search: { tab: "Completed" } })}
              className="group relative rounded-xl border border-border bg-card p-4.5 shadow-soft transition-all hover:border-primary/50 hover:shadow-md cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <span className="grid size-10 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={20} strokeWidth={1.8} />
                </span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary uppercase tracking-wide">
                  Period Activity
                </span>
              </div>
              <div className="mt-3">
                <p className="text-xs font-medium text-muted-foreground">Tasks Completed</p>
                <div className="flex items-baseline justify-between mt-1">
                  <p className="num text-2xl font-bold text-foreground">{analytics.overview.tasksCompleted}</p>
                  {analytics.overview.tasksCompletedDiffPct != null && (
                    <span className={cn(
                      "text-xs font-semibold num",
                      analytics.overview.tasksCompletedDiffPct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                    )}>
                      {analytics.overview.tasksCompletedDiffPct >= 0 ? `+${analytics.overview.tasksCompletedDiffPct}%` : `${analytics.overview.tasksCompletedDiffPct}%`}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Prev period: {analytics.overview.tasksCompletedPrev} completed
                </p>
              </div>
            </div>

            {/* Pending Approvals (Snapshot) */}
            <div
              onClick={() => navigate({ to: "/admin/approvals" })}
              className="group relative rounded-xl border border-border bg-card p-4.5 shadow-soft transition-all hover:border-primary/50 hover:shadow-md cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <span className="grid size-10 place-items-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Shield size={20} strokeWidth={1.8} />
                </span>
                <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Snapshot
                </span>
              </div>
              <div className="mt-3">
                <p className="text-xs font-medium text-muted-foreground">Pending Approvals</p>
                <div className="flex items-baseline justify-between mt-1">
                  <p className="num text-2xl font-bold text-foreground">{analytics.overview.pendingApprovals}</p>
                  <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-purple-500 transition-colors" />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">Reassignments, sign-offs &amp; deletions</p>
              </div>
            </div>

            {/* Upcoming Hearings (Snapshot) */}
            <div
              onClick={() => navigate({ to: "/calendar" })}
              className="group relative rounded-xl border border-border bg-card p-4.5 shadow-soft transition-all hover:border-primary/50 hover:shadow-md cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <span className="grid size-10 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Calendar size={20} strokeWidth={1.8} />
                </span>
                <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Snapshot
                </span>
              </div>
              <div className="mt-3">
                <p className="text-xs font-medium text-muted-foreground">Upcoming Hearings</p>
                <div className="flex items-baseline justify-between mt-1">
                  <p className="num text-2xl font-bold text-foreground">{analytics.overview.upcomingHearings}</p>
                  <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-amber-500 transition-colors" />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {analytics.overview.hearingsHeld} held in selected period
                </p>
              </div>
            </div>

            {/* Documents Approved (Period) */}
            <div
              onClick={() => navigate({ to: "/documents" })}
              className="group relative rounded-xl border border-border bg-card p-4.5 shadow-soft transition-all hover:border-primary/50 hover:shadow-md cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <span className="grid size-10 place-items-center rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
                  <FileText size={20} strokeWidth={1.8} />
                </span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary uppercase tracking-wide">
                  Period Activity
                </span>
              </div>
              <div className="mt-3">
                <p className="text-xs font-medium text-muted-foreground">Documents Approved</p>
                <div className="flex items-baseline justify-between mt-1">
                  <p className="num text-2xl font-bold text-foreground">{analytics.overview.docsApproved}</p>
                  {analytics.overview.docsApprovedDiffPct != null && (
                    <span className={cn(
                      "text-xs font-semibold num",
                      analytics.overview.docsApprovedDiffPct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                    )}>
                      {analytics.overview.docsApprovedDiffPct >= 0 ? `+${analytics.overview.docsApprovedDiffPct}%` : `${analytics.overview.docsApprovedDiffPct}%`}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {analytics.documents.summary.uploadedInPeriod} uploaded in period
                </p>
              </div>
            </div>
          </div>

          {/* ── 2. DETERMINISTIC MANAGEMENT INSIGHTS (DERIVED FROM DATA) ── */}
          {analytics.insights && analytics.insights.length > 0 && (
            <div className="rounded-2xl border border-border/80 bg-card/70 p-4.5 shadow-soft space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4.5 text-primary" />
                <h4 className="text-sm font-semibold text-foreground">Operational Intelligence &amp; Observations</h4>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {analytics.insights.map((ins) => (
                  <div
                    key={ins.id}
                    className={cn(
                      "rounded-xl border p-3.5 space-y-1.5 transition-colors",
                      ins.type === "warning" && "border-amber-500/30 bg-amber-500/5 text-amber-900 dark:text-amber-200",
                      ins.type === "info" && "border-blue-500/30 bg-blue-500/5 text-blue-900 dark:text-blue-200",
                      ins.type === "success" && "border-emerald-500/30 bg-emerald-500/5 text-emerald-900 dark:text-emerald-200",
                      ins.type === "neutral" && "border-border/60 bg-muted/20 text-foreground"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold leading-tight flex items-center gap-1.5">
                        <Info className="size-3.5 shrink-0" />
                        <span>{ins.title}</span>
                      </p>
                      {ins.metricValue && (
                        <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-background/80 border border-border/40 shadow-2xs">
                          {ins.metricValue}
                        </span>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {ins.message}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 3. CASE & LEGAL MATTER ANALYTICS ── */}
          <div className="grid gap-6 xl:grid-cols-2">
            {/* Trajectory */}
            <SectionCard
              title="Monthly Matter Trajectory"
              description="New matters instituted vs. closed and resolved matters across trailing 7 months."
              icon={TrendingUp}
            >
              <div className="h-72">
                <CaseGrowthChart growth={analytics.cases.growth} />
              </div>
            </SectionCard>

            {/* Case Status Distribution */}
            <SectionCard
              title="Case Status Distribution"
              description="Current lifecycle stage breakdown of active, on-hold, and concluded matters."
              icon={PieIcon}
            >
              <CaseStatusChart
                statusDistribution={analytics.cases.statusDistribution}
                onSelectStatus={(status) => navigate({ to: "/cases", search: { status } })}
              />
            </SectionCard>

            {/* Practice Area Distribution — Multi-line wrapped & responsive */}
            <SectionCard
              title="Practice Area Distribution"
              description="Categorization across specialized legal domains. Bars show active matter counts."
              icon={BarChart3}
            >
              <PracticeAreaChart
                distribution={analytics.cases.practiceDistribution}
                onSelectCategory={(cat) => navigate({ to: "/cases", search: { category: cat } })}
              />
            </SectionCard>

            {/* Case Ageing Analysis */}
            <SectionCard
              title="Case Ageing &amp; Matter Duration"
              description="Active matters categorized by duration since institution date."
              icon={Clock}
            >
              <div className="space-y-4 py-2">
                {analytics.cases.ageing.map((item) => {
                  const pct = analytics.overview.activeCases > 0
                    ? Math.round((item.count / analytics.overview.activeCases) * 100)
                    : 0;
                  return (
                    <div key={item.range} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-foreground">{item.range} <span className="text-muted-foreground font-normal">({item.label})</span></span>
                        <span className="font-bold num text-foreground">{item.count} matters <span className="text-muted-foreground font-normal">({pct}%)</span></span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-300",
                            item.range.includes("180+") ? "bg-amber-500" : "bg-primary"
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          </div>

          {/* ── 4. TASK LIFECYCLE & PRODUCTIVITY ── */}
          <div className="grid gap-6 xl:grid-cols-2">
            {/* Task Status */}
            <SectionCard
              title="Task Operational Lifecycle"
              description="Mutually exclusive operational task stages. Total tasks: "
              icon={CheckSquare}
            >
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {analytics.tasks.statusDistribution.map((item) => (
                    <div
                      key={item.name}
                      onClick={() => navigate({ to: "/tasks", search: { tab: item.name } })}
                      className="rounded-lg border border-border/60 bg-muted/20 p-2.5 text-center cursor-pointer hover:bg-muted/40 transition-colors"
                    >
                      <span className="text-[11px] font-medium text-muted-foreground block truncate">{item.name}</span>
                      <span className="text-lg font-bold text-foreground num mt-0.5 block">{item.value}</span>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-border/60 bg-card p-3.5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-foreground">Task Completion Velocity</p>
                    <p className="text-[11px] text-muted-foreground">Based on completed tasks vs total active lifecycle work</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-bold font-display text-emerald-600 dark:text-emerald-400 num">
                      {analytics.tasks.summary.completionRate}%
                    </span>
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Task Priority Breakdown */}
            <SectionCard
              title="Task Priority Distribution"
              description="Open operational workload segmented by urgency level."
              icon={AlertTriangle}
            >
              <div className="grid grid-cols-3 gap-3 py-4">
                {analytics.tasks.priorityDistribution.map((p) => (
                  <div
                    key={p.priority}
                    className="rounded-xl border border-border/60 bg-muted/20 p-3.5 text-center space-y-1"
                  >
                    <span
                      className="inline-block size-2.5 rounded-full"
                      style={{ backgroundColor: p.color }}
                    />
                    <p className="text-xs font-semibold text-foreground">{p.priority} Priority</p>
                    <p className="text-2xl font-bold text-foreground num">{p.count}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          {/* ── 5. ADVOCATE & STAFF WORKLOAD ── */}
          <SectionCard
            title="Advocate &amp; Employee Workload Matrix"
            description="Measurable assignments, open work, period completions, and active cases per team member."
            icon={Users}
          >
            {analytics.employees.workload.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">No active employees found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/80 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      <th className="py-2.5 px-3">Team Member</th>
                      <th className="py-2.5 px-3 text-center">Active Cases</th>
                      <th className="py-2.5 px-3 text-center">Assigned Tasks</th>
                      <th className="py-2.5 px-3 text-center">Open Tasks</th>
                      <th className="py-2.5 px-3 text-center">Completed in Period</th>
                      <th className="py-2.5 px-3 text-center">Overdue</th>
                      <th className="py-2.5 px-3 text-right no-print">Full Report</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {analytics.employees.workload.map((emp) => (
                      <tr
                        key={emp._id}
                        className="transition-colors hover:bg-muted/40 cursor-pointer"
                        onClick={() => onSelectEmployee(emp._id)}
                      >
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2.5">
                            <UserAvatar
                              avatarUrl={emp.avatarUrl}
                              name={emp.name}
                              initials={emp.name.slice(0, 2).toUpperCase()}
                              className="size-7.5 text-[11px]"
                            />
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground truncate">{emp.name}</p>
                              <p className="text-[10px] text-muted-foreground capitalize">{emp.role}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center num font-medium text-foreground">{emp.activeCases}</td>
                        <td className="py-2.5 px-3 text-center num font-medium text-foreground">{emp.assignedTasks}</td>
                        <td className="py-2.5 px-3 text-center num font-semibold text-foreground">{emp.openTasks}</td>
                        <td className="py-2.5 px-3 text-center num font-medium text-emerald-600 dark:text-emerald-400">{emp.completedInPeriod}</td>
                        <td className="py-2.5 px-3 text-center num font-semibold">
                          <span className={emp.overdueTasks > 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"}>
                            {emp.overdueTasks}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right no-print">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectEmployee(emp._id);
                            }}
                            className="h-7 text-xs text-primary hover:text-primary"
                          >
                            <span>Inspect</span>
                            <ArrowUpRight className="size-3.5 ml-1" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* ── 6. CLIENT PORTFOLIO & TOP CLIENTS ── */}
          <div className="grid gap-6 xl:grid-cols-2">
            {/* Top Clients by Case Count */}
            <SectionCard
              title="Top Client Portfolios"
              description="Clients with the highest number of active and total firm matters."
              icon={Briefcase}
            >
              {analytics.clients.topClients.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">No linked client matter associations found.</p>
              ) : (
                <div className="space-y-2">
                  {analytics.clients.topClients.map((c) => (
                    <div
                      key={c._id}
                      onClick={() => onSelectClient(c._id)}
                      className="group flex items-center justify-between p-2.5 rounded-lg border border-border/60 hover:bg-muted/40 transition-colors cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                          {c.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-muted-foreground uppercase">{c.type}</span>
                          <span className="text-[10px] text-muted-foreground">·</span>
                          <span className="text-[10px] text-muted-foreground">{c.tag}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs font-bold text-foreground num">{c.activeCases} Active</p>
                          <p className="text-[10px] text-muted-foreground num">{c.totalCases} Total</p>
                        </div>
                        <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* Upcoming Court Hearings Docket */}
            <SectionCard
              title="Court Hearings Docket"
              description="Scheduled matters appearing before court benches in upcoming dates."
              icon={Calendar}
            >
              {analytics.hearings.upcoming.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">No upcoming court hearings currently scheduled.</p>
              ) : (
                <div className="space-y-2.5">
                  {analytics.hearings.upcoming.map((h) => (
                    <div
                      key={h._id}
                      onClick={() => h.caseId && navigate({ to: "/cases/$caseId", params: { caseId: h.caseId } })}
                      className="flex items-start justify-between p-2.5 rounded-lg border border-border/60 hover:bg-muted/40 transition-colors cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-foreground truncate">{h.caseTitle}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{h.court} · {h.judge}</p>
                        <span className="inline-block text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.2 rounded mt-1">
                          {h.caseNumber}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-foreground num">{formatSafeDate(h.date)}</p>
                        <p className="text-[10px] text-muted-foreground uppercase mt-0.5">Hearing Date</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Employee Daily & All-Time Report Card with Full-Box Clickable Expansion
// ---------------------------------------------------------------------------

function formatLogTime(isoDateStr?: string): { time: string; relative: string } {
  if (!isoDateStr) return { time: "—", relative: "" };
  try {
    const d = new Date(isoDateStr);
    if (isNaN(d.getTime())) return { time: "—", relative: "" };
    const time = d.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
    const now = Date.now();
    const diffSec = Math.max(0, Math.floor((now - d.getTime()) / 1000));
    let relative = "";
    if (diffSec < 60) relative = "just now";
    else if (diffSec < 3600) relative = `${Math.floor(diffSec / 60)}m ago`;
    else if (diffSec < 86400) relative = `${Math.floor(diffSec / 3600)}h ago`;
    else relative = `${Math.floor(diffSec / 86400)}d ago`;

    return { time, relative };
  } catch {
    return { time: "—", relative: "" };
  }
}

function getActionBadgeStyle(action: string): string {
  switch (action?.toLowerCase()) {
    case "create":
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25";
    case "update":
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25";
    case "delete":
      return "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/25";
    case "approve":
      return "bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border-emerald-600/25";
    case "reject":
      return "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25";
    case "login":
    case "logout":
      return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/25";
    case "upload":
    case "download":
      return "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/25";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

interface EmployeeDailyReportCardProps {
  report: EmployeeDailyReport;
  selectedDate: string;
  onOpenTask: (task: TaskRecord) => void;
  onDrilldown?: () => void;
}

function EmployeeDailyReportCard({ report, selectedDate, onOpenTask, onDrilldown }: EmployeeDailyReportCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [reportMode, setReportMode] = useState<"daily" | "allTime">("daily");
  const [dailySubTab, setDailySubTab] = useState<
    "auditLogs" | "completedToday" | "casesToday" | "assignedToday" | "pending" | "overdue"
  >("auditLogs");
  const [allTimeSubTab, setAllTimeSubTab] = useState<"activeCases" | "allTimeAudit">("activeCases");
  const navigate = useNavigate();

  const { employee, metrics, tasks, cases, auditLogs, allTime } = report;
  const currentTasks = tasks[dailySubTab as keyof typeof tasks] || [];
  const workedCases = cases?.workedOnToday || [];
  const completedCases = cases?.completedToday || [];
  const todayLogs = auditLogs || [];
  const allTimeRecentLogs = allTime?.recentAuditLogs || [];
  const activeCasesList = allTime?.activeCases || [];

  const todayStr = getTodayKolkata();
  const isSelectedToday = selectedDate === todayStr;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border transition-all duration-200 bg-card shadow-soft",
        expanded
          ? "border-primary/50 ring-1 ring-primary/25 shadow-md"
          : "border-border/80 hover:border-primary/40 hover:bg-muted/10"
      )}
    >
      {/* ── Entire Employee Box Header (Click anywhere to load/toggle the report) ── */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
        className="flex flex-col gap-3.5 p-4.5 lg:flex-row lg:items-center lg:justify-between cursor-pointer select-none transition-colors group"
        title={expanded ? "Click box to collapse report" : "Click box to view employee report"}
      >
        {/* Employee Identification */}
        <div className="min-w-0 flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary font-bold text-sm ring-1 ring-primary/20 group-hover:bg-primary/20 transition-colors">
            {employee.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="truncate font-display text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                {employee.name}
              </h4>
              <span className="rounded-md bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                {employee.role?.replace(/_/g, " ")}
              </span>
            </div>
            <p className="truncate text-caption text-muted-foreground mt-0.5">{employee.email}</p>
          </div>
        </div>

        {/* 4 Metric Badges + Expand Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Assigned on Date */}
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs">
            <span className="text-muted-foreground">Assigned Today:</span>
            <span className="font-semibold text-foreground">{metrics.assignedTodayCount}</span>
          </div>

          {/* Completed on Date */}
          <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={13} />
            <span>Completed:</span>
            <span className="font-semibold">{metrics.completedTodayCount}</span>
          </div>

          {/* Pending Active Workload */}
          <div className="flex items-center gap-1.5 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs text-blue-600 dark:text-blue-400">
            <Clock size={13} />
            <span>Pending:</span>
            <span className="font-semibold">{metrics.pendingCount}</span>
          </div>

          {/* Overdue Items */}
          {metrics.overdueCount > 0 ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-600 dark:text-rose-400">
              <AlertTriangle size={13} />
              <span>Overdue:</span>
              <span className="font-semibold">{metrics.overdueCount}</span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/20 px-2.5 py-1.5 text-xs text-muted-foreground">
              <span>Overdue: 0</span>
            </div>
          )}

          {onDrilldown && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDrilldown();
              }}
              className="h-8 gap-1.5 rounded-lg text-xs font-medium text-primary hover:bg-primary/10"
              title="Open full employee report and drill-down history"
            >
              <ExternalLink size={13} />
              <span>Full Report</span>
            </Button>
          )}

          {/* Toggle Indicator Button */}
          <Button
            type="button"
            variant={expanded ? "secondary" : "outline"}
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="h-8 gap-1.5 rounded-lg text-xs font-medium"
          >
            <span>{expanded ? "Hide" : "Expand"}</span>
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </Button>
        </div>
      </div>

      {/* ── Expanded Full Employee Report Drawer ── */}
      {expanded && (
        <div className="border-t border-border/70 bg-muted/10 p-4 sm:p-5 space-y-4">
          {/* Top Scope Switcher: Daily Report vs All-Time Total Report */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-2 sm:p-2.5 shadow-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setReportMode("daily")}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer",
                  reportMode === "daily"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Calendar size={14} />
                <span>Daily Activity ({formatReadableDate(selectedDate)})</span>
                {isSelectedToday && (
                  <span className="rounded bg-black/20 dark:bg-white/20 px-1 py-0.2 text-[9px] font-bold uppercase">
                    Today
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setReportMode("allTime")}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer",
                  reportMode === "allTime"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <BarChart3 size={14} />
                <span>All-Time Total Report</span>
              </button>
            </div>

            <div className="text-[11px] text-muted-foreground font-mono px-1">
              {reportMode === "daily"
                ? `Activity for ${employee.name} on ${selectedDate}`
                : `Lifetime performance & active matters for ${employee.name}`}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════
              MODE 1: DAILY ACTIVITY REPORT (TODAY / SELECTED DATE)
              ═══════════════════════════════════════════════════════════════════ */}
          {reportMode === "daily" && (
            <div className="space-y-4">
              {/* Daily KPI Metric Cards Strip */}
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <div className="rounded-lg border border-border bg-card p-2.5 text-center shadow-xs">
                  <span className="text-[11px] text-muted-foreground">Assigned Today</span>
                  <p className="num text-lg font-bold text-foreground mt-0.5">{metrics.assignedTodayCount}</p>
                </div>

                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5 text-center shadow-xs">
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Completed Today</span>
                  <p className="num text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{metrics.completedTodayCount}</p>
                </div>

                <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-2.5 text-center shadow-xs">
                  <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">Cases Worked/Done</span>
                  <p className="num text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">{workedCases.length}</p>
                </div>

                <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-2.5 text-center shadow-xs">
                  <span className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">Audit Log Actions</span>
                  <p className="num text-lg font-bold text-purple-600 dark:text-purple-400 mt-0.5">{todayLogs.length}</p>
                </div>

                <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-2.5 text-center shadow-xs">
                  <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">Active Pending</span>
                  <p className="num text-lg font-bold text-blue-600 dark:text-blue-400 mt-0.5">{metrics.pendingCount}</p>
                </div>

                <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-2.5 text-center shadow-xs">
                  <span className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">Overdue Items</span>
                  <p className="num text-lg font-bold text-rose-600 dark:text-rose-400 mt-0.5">{metrics.overdueCount}</p>
                </div>
              </div>

              {/* Daily Report Sub-Tabs Navigation */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
                <div className="flex flex-wrap gap-1.5">
                  {[
                    {
                      id: "auditLogs",
                      label: `Today's Audit Trail (${todayLogs.length})`,
                      icon: Shield,
                    },
                    {
                      id: "completedToday",
                      label: `Tasks Completed (${metrics.completedTodayCount})`,
                      icon: CheckCircle2,
                    },
                    {
                      id: "casesToday",
                      label: `Cases Worked / Completed (${workedCases.length})`,
                      icon: Briefcase,
                    },
                    {
                      id: "assignedToday",
                      label: `Assigned Today (${metrics.assignedTodayCount})`,
                      icon: CheckSquare,
                    },
                    {
                      id: "pending",
                      label: `Pending Active (${metrics.pendingCount})`,
                      icon: Clock,
                    },
                    {
                      id: "overdue",
                      label: `Overdue (${metrics.overdueCount})`,
                      icon: AlertTriangle,
                    },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setDailySubTab(tab.id as any)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
                          dailySubTab === tab.id
                            ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                            : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground border border-border/60"
                        )}
                      >
                        <Icon size={13} />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                <span className="text-[11px] text-muted-foreground font-mono">
                  {dailySubTab === "auditLogs"
                    ? "Chronological audit events recorded for employee"
                    : "Click any item to view matter or task details"}
                </span>
              </div>

              {/* Sub-Tab 1: Today's Audit Log Trail */}
              {dailySubTab === "auditLogs" && (
                <div className="rounded-xl border border-border/80 bg-card p-3 shadow-xs">
                  {todayLogs.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      <Shield size={24} className="mx-auto mb-1.5 text-muted-foreground/40" />
                      No system audit actions or status changes recorded by {employee.name} on {formatReadableDate(selectedDate)}.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1 flex items-center justify-between">
                        <span>Event Details &amp; Target Resource</span>
                        <span>Action &amp; Time (IST)</span>
                      </div>
                      <div className="divide-y divide-border/40">
                        {todayLogs.map((log) => {
                          const { time, relative } = formatLogTime(log.createdAt);
                          return (
                            <div
                              key={log._id}
                              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 p-2.5 transition-colors hover:bg-muted/30 rounded-lg"
                            >
                              {/* Left: Resource & Details */}
                              <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold text-foreground uppercase tracking-wide border border-border/80">
                                    {log.resource}
                                  </span>
                                  {log.resourceName && (
                                    <span className="font-medium text-xs text-foreground truncate max-w-md">
                                      {log.resourceName}
                                    </span>
                                  )}
                                  {log.resource === "case" && log.resourceId && (
                                    <button
                                      type="button"
                                      onClick={() => navigate({ to: "/cases/$caseId", params: { caseId: log.resourceId! } })}
                                      className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                                    >
                                      <span>View Case</span>
                                      <ExternalLink size={10} />
                                    </button>
                                  )}
                                </div>
                                {log.details && (
                                  <p className="text-caption text-muted-foreground break-words">{log.details}</p>
                                )}
                              </div>

                              {/* Right: Action Badge & Timestamp */}
                              <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                                <span
                                  className={cn(
                                    "rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase border",
                                    getActionBadgeStyle(log.action)
                                  )}
                                >
                                  {log.action}
                                </span>
                                <div className="text-right">
                                  <p className="font-mono text-xs font-medium text-foreground">{time}</p>
                                  {relative && <p className="text-[10px] text-muted-foreground">{relative}</p>}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Sub-Tab 2: Cases Worked On / Completed Today */}
              {dailySubTab === "casesToday" && (
                <div className="rounded-xl border border-border/80 bg-card p-3 shadow-xs">
                  {workedCases.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      <Briefcase size={24} className="mx-auto mb-1.5 text-muted-foreground/40" />
                      No case actions or closures recorded by {employee.name} on {formatReadableDate(selectedDate)}.
                    </div>
                  ) : (
                    <div className="divide-y divide-border/40 space-y-1.5">
                      {workedCases.map((c) => {
                        const isClosedToday = c.status === "Closed";
                        return (
                          <div
                            key={c._id}
                            onClick={() => navigate({ to: "/cases/$caseId", params: { caseId: c._id } })}
                            className="group flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg transition-colors hover:bg-muted/40 cursor-pointer"
                          >
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-semibold text-primary">{c.number}</span>
                                <h5 className="font-medium text-xs sm:text-sm text-foreground truncate max-w-lg group-hover:text-primary transition-colors">
                                  {c.title}
                                </h5>
                                <ExternalLink size={12} className="shrink-0 opacity-40 group-hover:opacity-100 text-primary" />
                              </div>

                              <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-muted-foreground">
                                {c.court && <span>Court: <strong className="text-foreground">{c.court}</strong></span>}
                                {c.practice && (
                                  <>
                                    <span>•</span>
                                    <span>{c.practice}</span>
                                  </>
                                )}
                                {c.parties?.[0]?.name && (
                                  <>
                                    <span>•</span>
                                    <span>Client: <strong className="text-foreground">{c.parties[0].name}</strong></span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                              {isClosedToday ? (
                                <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                  Closed / Disposed
                                </span>
                              ) : (
                                <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                  {c.status}
                                </span>
                              )}
                              {c.priority && (
                                <span className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                  {c.priority}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Sub-Tabs: Tasks (Completed Today, Assigned Today, Pending, Overdue) */}
              {["completedToday", "assignedToday", "pending", "overdue"].includes(dailySubTab) && (
                <div className="rounded-xl border border-border/80 bg-card p-2 sm:p-3 shadow-xs">
                  {currentTasks.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      No tasks in this category for {employee.name} on {formatReadableDate(selectedDate)}.
                    </div>
                  ) : (
                    <div className="divide-y divide-border/40 space-y-1.5">
                      {currentTasks.map((t) => {
                        const caseId = typeof t.caseId === "object" ? (t.caseId as any)?._id : t.caseId;
                        const caseTitle =
                          typeof t.caseId === "object"
                            ? (t.caseId as any)?.title || (t.caseId as any)?.number || "Matter Details"
                            : "Matter Details";

                        return (
                          <div
                            key={t._id}
                            onClick={() => onOpenTask(t as any as TaskRecord)}
                            className="group flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 rounded-lg p-2.5 transition-colors hover:bg-muted/40 cursor-pointer"
                          >
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenTask(t as any as TaskRecord);
                                  }}
                                  className="text-left font-medium text-foreground group-hover:text-primary transition-colors text-xs sm:text-sm truncate max-w-lg flex items-center gap-1.5 cursor-pointer"
                                  title="Open Task Details"
                                >
                                  <span className="truncate">{t.title}</span>
                                  <ExternalLink size={12} className="shrink-0 opacity-40 group-hover:opacity-100" />
                                </button>
                              </div>

                              <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-muted-foreground">
                                {caseId && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate({ to: "/cases/$caseId", params: { caseId: String(caseId) } });
                                    }}
                                    className="inline-flex items-center gap-1 rounded bg-muted/60 px-1.5 py-0.5 font-medium text-foreground hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                                    title="Navigate to Matter"
                                  >
                                    <Briefcase size={11} className="shrink-0 text-primary" />
                                    <span className="truncate max-w-[200px]">{caseTitle}</span>
                                    <ExternalLink size={10} className="shrink-0 opacity-60" />
                                  </button>
                                )}

                                {t.clientId && (
                                  <span className="inline-flex items-center gap-1">
                                    <span className="text-muted-foreground/60">Client:</span>
                                    <span className="font-medium text-foreground truncate max-w-[150px]">
                                      {typeof t.clientId === "object" ? (t.clientId as any).name : "Client"}
                                    </span>
                                  </span>
                                )}

                                {t.deadline && (
                                  <span className="inline-flex items-center gap-1">
                                    <Clock size={11} className="shrink-0 text-muted-foreground/70" />
                                    <span>Due: {formatSafeDate(t.deadline)}</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                              <span
                                className={cn(
                                  "rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                                  t.priority === "High"
                                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                    : t.priority === "Medium"
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                    : "bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20"
                                )}
                              >
                                {t.priority || "Normal"}
                              </span>
                              <span className="rounded-md border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground capitalize">
                                {t.status?.replace(/_/g, " ") || "Pending"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              MODE 2: ALL-TIME TOTAL REPORT (CUMULATIVE PERFORMANCE & CASES)
              ═══════════════════════════════════════════════════════════════════ */}
          {reportMode === "allTime" && (
            <div className="space-y-4">
              {/* Lifetime High-Level Metric Tiles */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {/* 1. Lifetime Tasks Completed */}
                <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-caption font-medium text-muted-foreground">Lifetime Tasks Completed</span>
                    <span className="grid size-7 place-items-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 size={14} />
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between gap-2">
                    <span className="text-2xl font-bold tracking-tight text-foreground">{allTime?.tasksCompleted ?? 0}</span>
                    <span className="text-caption text-muted-foreground">
                      of {allTime?.tasksAssigned ?? 0} assigned
                    </span>
                  </div>
                  <div className="mt-2.5">
                    <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                      <span>Completion Rate</span>
                      <span className="font-semibold text-foreground">{allTime?.completionRate ?? 0}%</span>
                    </div>
                    <Progress value={allTime?.completionRate ?? 0} className="h-1.5" />
                  </div>
                </div>

                {/* 2. Active Matters Currently Assigned */}
                <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-caption font-medium text-muted-foreground">Active Matters Handled</span>
                    <span className="grid size-7 place-items-center rounded-md bg-primary/10 text-primary">
                      <Briefcase size={14} />
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between gap-2">
                    <span className="text-2xl font-bold tracking-tight text-primary">{allTime?.activeCasesCount ?? 0}</span>
                    <span className="text-caption text-muted-foreground">
                      {allTime?.totalCasesCount ?? 0} total lifetime
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Currently Institute &amp; Active Matters assigned in firm
                  </p>
                </div>

                {/* 3. Matters Successfully Closed */}
                <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-caption font-medium text-muted-foreground">Matters Closed / Disposed</span>
                    <span className="grid size-7 place-items-center rounded-md bg-muted text-muted-foreground">
                      <FolderKanban size={14} />
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between gap-2">
                    <span className="text-2xl font-bold tracking-tight text-foreground">{allTime?.closedCasesCount ?? 0}</span>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                      Disposed
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Successfully concluded legal matters &amp; disputes
                  </p>
                </div>

                {/* 4. Total Lifetime Audit Actions */}
                <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-caption font-medium text-muted-foreground">Total Audit Actions Logged</span>
                    <span className="grid size-7 place-items-center rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400">
                      <Shield size={14} />
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between gap-2">
                    <span className="text-2xl font-bold tracking-tight text-foreground">{allTime?.totalAuditLogsCount ?? 0}</span>
                    <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-600 dark:text-purple-400">
                      Tamper-evident
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Total recorded system events and modifications
                  </p>
                </div>
              </div>

              {/* All-Time Sub-tabs Navigation */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAllTimeSubTab("activeCases")}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
                      allTimeSubTab === "activeCases"
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground border border-border/60"
                    )}
                  >
                    <Briefcase size={13} />
                    <span>Active Assigned Matters ({activeCasesList.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAllTimeSubTab("allTimeAudit")}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
                      allTimeSubTab === "allTimeAudit"
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground border border-border/60"
                    )}
                  >
                    <History size={13} />
                    <span>Recent Lifetime Audit Trail ({allTimeRecentLogs.length})</span>
                  </button>
                </div>

                <span className="text-[11px] text-muted-foreground font-mono">
                  {allTimeSubTab === "activeCases"
                    ? "Matters currently in progress with this employee"
                    : "Latest 25 chronological activity logs"}
                </span>
              </div>

              {/* All-Time Tab 1: Active Cases List */}
              {allTimeSubTab === "activeCases" && (
                <div className="rounded-xl border border-border/80 bg-card p-3 shadow-xs">
                  {activeCasesList.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      <Briefcase size={24} className="mx-auto mb-1.5 text-muted-foreground/40" />
                      No active matters currently assigned to {employee.name}.
                    </div>
                  ) : (
                    <div className="divide-y divide-border/40 space-y-1.5">
                      {activeCasesList.map((c) => (
                        <div
                          key={c._id}
                          onClick={() => navigate({ to: "/cases/$caseId", params: { caseId: c._id } })}
                          className="group flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg transition-colors hover:bg-muted/40 cursor-pointer"
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold text-primary">{c.number}</span>
                              <h5 className="font-medium text-xs sm:text-sm text-foreground truncate max-w-lg group-hover:text-primary transition-colors">
                                {c.title}
                              </h5>
                              <ExternalLink size={12} className="shrink-0 opacity-40 group-hover:opacity-100 text-primary" />
                            </div>

                            <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-muted-foreground">
                              {c.court && <span>Court: <strong className="text-foreground">{c.court}</strong></span>}
                              {c.practice && (
                                <>
                                  <span>•</span>
                                  <span>{c.practice}</span>
                                </>
                              )}
                              {c.parties?.[0]?.name && (
                                <>
                                  <span>•</span>
                                  <span>Client: <strong className="text-foreground">{c.parties[0].name}</strong></span>
                                </>
                              )}
                              {c.nextHearing && (
                                <>
                                  <span>•</span>
                                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                                    Next Hearing: {formatSafeDate(c.nextHearing)}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                            <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                              {c.status}
                            </span>
                            {c.priority && (
                              <span className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                {c.priority}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* All-Time Tab 2: Recent Lifetime Audit Trail */}
              {allTimeSubTab === "allTimeAudit" && (
                <div className="rounded-xl border border-border/80 bg-card p-3 shadow-xs">
                  {allTimeRecentLogs.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      <Shield size={24} className="mx-auto mb-1.5 text-muted-foreground/40" />
                      No audit events recorded for this employee.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1 flex items-center justify-between">
                        <span>Event &amp; Target</span>
                        <span>Action &amp; Date / Time (IST)</span>
                      </div>
                      <div className="divide-y divide-border/40">
                        {allTimeRecentLogs.map((log) => {
                          const { time, relative } = formatLogTime(log.createdAt);
                          const logDate = log.createdAt
                            ? formatSafeDate(log.createdAt)
                            : "";
                          return (
                            <div
                              key={log._id}
                              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 p-2.5 transition-colors hover:bg-muted/30 rounded-lg"
                            >
                              <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold text-foreground uppercase tracking-wide border border-border/80">
                                    {log.resource}
                                  </span>
                                  {log.resourceName && (
                                    <span className="font-medium text-xs text-foreground truncate max-w-md">
                                      {log.resourceName}
                                    </span>
                                  )}
                                  {log.resource === "case" && log.resourceId && (
                                    <button
                                      type="button"
                                      onClick={() => navigate({ to: "/cases/$caseId", params: { caseId: log.resourceId! } })}
                                      className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                                    >
                                      <span>View Case</span>
                                      <ExternalLink size={10} />
                                    </button>
                                  )}
                                </div>
                                {log.details && (
                                  <p className="text-caption text-muted-foreground break-words">{log.details}</p>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                                <span
                                  className={cn(
                                    "rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase border",
                                    getActionBadgeStyle(log.action)
                                  )}
                                >
                                  {log.action}
                                </span>
                                <div className="text-right">
                                  <p className="font-mono text-xs font-medium text-foreground">{logDate} {time}</p>
                                  {relative && <p className="text-[10px] text-muted-foreground">{relative}</p>}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Employee Detailed Report & Drilldown Component
// ---------------------------------------------------------------------------

function EmployeeDetailReportView({
  employeeId,
  onBack,
  onOpenTask,
}: {
  employeeId: string;
  onBack: () => void;
  onOpenTask: (task: TaskRecord) => void;
}) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const { data, isLoading, isError, refetch } = useEmployeeDetailReport(employeeId, {
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  const navigate = useNavigate();
  const [empDrilldownOpen, setEmpDrilldownOpen] = useState(false);
  const [empDrilldownType, setEmpDrilldownType] = useState<DrilldownType>("tasks");
  const [empDrilldownTitle, setEmpDrilldownTitle] = useState("");
  const [empDrilldownSubtitle, setEmpDrilldownSubtitle] = useState("");
  const [empCustomTasks, setEmpCustomTasks] = useState<any[] | undefined>(undefined);

  const rawTasks = useMemo(() => data?.tasks || [], [data?.tasks]);
  const {
    sortedData: sortedTasks,
    sortKey: empTaskSortKey,
    sortDirection: empTaskSortDir,
    onSort: handleEmpTaskSort,
  } = useTableSorting(rawTasks, {
    accessors: {
      title: (t) => t.title,
      caseTitle: (t) => t.caseId?.title || "",
      clientName: (t) => t.clientId?.name || "",
      priority: (t) => t.priority,
      deadline: (t) => t.deadline || "",
      status: (t) => t.status,
    },
  });

  const rawCases = useMemo(() => data?.cases || [], [data?.cases]);
  const {
    sortedData: sortedCases,
    sortKey: empCaseSortKey,
    sortDirection: empCaseSortDir,
    onSort: handleEmpCaseSort,
  } = useTableSorting(rawCases, {
    accessors: {
      number: (c) => c.number,
      title: (c) => c.title,
      practice: (c) => c.practice || c.category || "",
      court: (c) => c.court || "",
      nextHearing: (c) => c.nextHearing || "",
      status: (c) => c.status,
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  if (!data?.employee) {
    return (
      <div className="rounded-xl border border-border p-8 text-center bg-card">
        <AlertTriangle size={32} className="mx-auto text-destructive mb-2" />
        <p className="font-semibold text-foreground">Failed to load employee detailed report</p>
        <p className="mt-1 text-xs text-muted-foreground">Could not reach the server to retrieve detailed analytics.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  const { employee, metrics, auditLogs } = data;

  return (
    <div className="space-y-6 printable-report">
      {isError && (
        <StaleDataBanner
          message="Could not refresh the latest employee metrics from the server. Showing cached report."
          onRefresh={() => refetch()}
          className="mb-4 no-print"
        />
      )}
      {/* Header and Print Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4 no-print">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack} className="rounded-md h-8">
            <ChevronLeft size={16} className="mr-1" /> Back to List
          </Button>
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <span>{employee.name}</span>
              <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">
                {employee.role?.replace(/_/g, " ")}
              </span>
            </h2>
            <p className="text-xs text-muted-foreground">{employee.email}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 no-print">
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-md border border-border/60">
            <span className="font-medium text-foreground">Filter:</span>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8 text-xs min-w-[140px] w-36 rounded-md bg-background px-2.5"
            />
            <span className="px-0.5">to</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-8 text-xs min-w-[140px] w-36 rounded-md bg-background px-2.5"
            />
            {(startDate || endDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setStartDate(""); setEndDate(""); }}
                className="h-7 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                title="Clear dates"
              >
                Clear
              </Button>
            )}
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={() => window.print()}
            className="h-8 text-xs rounded-md shadow-xs"
          >
            <Printer size={14} className="mr-1.5" /> Print / Export PDF
          </Button>
        </div>
      </div>

      {/* Printable Report Header */}
      <div className="hidden print:block border-b border-gray-300 pb-4 mb-4">
        <h1 className="text-xl font-bold">SS ASSOCIATES LEGAL-TECH LLP</h1>
        <h2 className="text-sm font-semibold text-gray-700 mt-1">OFFICIAL EMPLOYEE WORKLOAD & PERFORMANCE AUDIT</h2>
        <div className="grid grid-cols-2 text-xs mt-3">
          <div>
            <p><strong>Employee:</strong> {employee.name} ({employee.role})</p>
            <p><strong>Email:</strong> {employee.email}</p>
          </div>
          <div className="text-right">
            <p><strong>Report Generated:</strong> {new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
            {startDate && endDate ? <p><strong>Date Filter:</strong> {startDate} to {endDate}</p> : null}
          </div>
        </div>
      </div>

      {/* Interactive KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => {
            setEmpDrilldownType("tasks");
            setEmpCustomTasks(undefined);
            setEmpDrilldownTitle(`All Assigned Tasks · ${employee.name}`);
            setEmpDrilldownSubtitle(`Showing all ${tasks.length} task(s) assigned to ${employee.name}`);
            setEmpDrilldownOpen(true);
          }}
          className="rounded-xl border border-border bg-card p-4 text-left transition-all duration-150 hover:border-primary/40 hover:shadow-xs group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground group-hover:text-primary transition-colors font-medium">Assigned Tasks</p>
            <ArrowUpRight size={14} className="text-muted-foreground opacity-40 group-hover:opacity-100 group-hover:text-primary transition-all" />
          </div>
          <p className="num text-xl font-bold text-foreground mt-1">{metrics.totalTasks}</p>
        </button>

        <button
          type="button"
          onClick={() => {
            setEmpDrilldownType("tasks");
            const completed = tasks.filter((t: any) => t.status === "completed" || t.status === "Closed");
            setEmpCustomTasks(completed);
            setEmpDrilldownTitle(`Completed Tasks · ${employee.name}`);
            setEmpDrilldownSubtitle(`Showing ${completed.length} completed task(s) for ${employee.name}`);
            setEmpDrilldownOpen(true);
          }}
          className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-left transition-all duration-150 hover:border-emerald-500/40 hover:shadow-xs group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Completed Tasks</p>
            <ArrowUpRight size={14} className="text-emerald-600 dark:text-emerald-400 opacity-40 group-hover:opacity-100 transition-all" />
          </div>
          <p className="num text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{metrics.completedTasks}</p>
        </button>

        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
          <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">Completion Rate</p>
          <p className="num text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">{metrics.completionRate}%</p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEmpDrilldownType("cases");
            setEmpCustomTasks(undefined);
            setEmpDrilldownTitle(`Assigned Matters & Cases · ${employee.name}`);
            setEmpDrilldownSubtitle(`Showing all ${cases.length} assigned matter(s) for ${employee.name}`);
            setEmpDrilldownOpen(true);
          }}
          className="rounded-xl border border-border bg-card p-4 text-left transition-all duration-150 hover:border-primary/40 hover:shadow-xs group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground group-hover:text-primary transition-colors font-medium">Active Matters</p>
            <ArrowUpRight size={14} className="text-muted-foreground opacity-40 group-hover:opacity-100 group-hover:text-primary transition-all" />
          </div>
          <p className="num text-xl font-bold text-foreground mt-1">{metrics.activeCases}</p>
        </button>
      </div>

      {/* Tasks Register */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <CheckSquare size={16} className="text-primary" />
            <span>Assigned Tasks Register ({tasks.length})</span>
          </h3>
        </div>
        {tasks.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">No tasks matching date filters</div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-hidden">
              <table className="w-full table-fixed text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground bg-muted/20 font-medium">
                    <th className="py-2.5 px-3 w-[28%]">
                      <SortHeaderButton
                        sortKey="title"
                        currentSortKey={empTaskSortKey}
                        currentDirection={empTaskSortDir}
                        onSort={handleEmpTaskSort}
                      >
                        Title
                      </SortHeaderButton>
                    </th>
                    <th className="py-2.5 px-3 w-[20%]">
                      <SortHeaderButton
                        sortKey="caseTitle"
                        currentSortKey={empTaskSortKey}
                        currentDirection={empTaskSortDir}
                        onSort={handleEmpTaskSort}
                      >
                        Case / Matter
                      </SortHeaderButton>
                    </th>
                    <th className="py-2.5 px-3 w-[18%]">
                      <SortHeaderButton
                        sortKey="clientName"
                        currentSortKey={empTaskSortKey}
                        currentDirection={empTaskSortDir}
                        onSort={handleEmpTaskSort}
                      >
                        Client
                      </SortHeaderButton>
                    </th>
                    <th className="py-2.5 px-3 w-[10%]">
                      <SortHeaderButton
                        sortKey="priority"
                        currentSortKey={empTaskSortKey}
                        currentDirection={empTaskSortDir}
                        onSort={handleEmpTaskSort}
                      >
                        Priority
                      </SortHeaderButton>
                    </th>
                    <th className="py-2.5 px-3 w-[12%]">
                      <SortHeaderButton
                        sortKey="deadline"
                        currentSortKey={empTaskSortKey}
                        currentDirection={empTaskSortDir}
                        onSort={handleEmpTaskSort}
                      >
                        Deadline
                      </SortHeaderButton>
                    </th>
                    <th className="py-2.5 px-3 w-[12%]">
                      <SortHeaderButton
                        sortKey="status"
                        currentSortKey={empTaskSortKey}
                        currentDirection={empTaskSortDir}
                        onSort={handleEmpTaskSort}
                      >
                        Status
                      </SortHeaderButton>
                    </th>
                    <th className="py-2.5 px-3 text-right no-print">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {sortedTasks.map((t) => (
                    <tr key={t._id} className="hover:bg-muted/15">
                      <td className="py-2.5 px-3 font-medium text-foreground break-words">{t.title}</td>
                      <td className="py-2.5 px-3 text-muted-foreground break-words">{t.caseId?.title || "—"}</td>
                      <td className="py-2.5 px-3 text-muted-foreground break-words">{t.clientId?.name || "—"}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          t.priority === "High" ? "bg-rose-500/10 text-rose-600" : "bg-muted text-muted-foreground"
                        }`}>
                          {t.priority}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {formatSafeDate(t.deadline)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="capitalize text-[11px] font-medium text-foreground">
                          {t.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right no-print">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onOpenTask(t as any)}
                          className="h-6 text-xs text-primary px-2"
                        >
                          Inspect
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile / Tablet Stacked Cards */}
            <div className="md:hidden divide-y divide-border/60">
              {tasks.map((t) => (
                <div key={t._id} className="p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-foreground text-xs leading-snug break-words flex-1">{t.title}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        t.priority === "High" ? "bg-rose-500/10 text-rose-600" : "bg-muted text-muted-foreground"
                      }`}>
                        {t.priority}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onOpenTask(t as any)}
                        className="h-6 text-xs text-primary px-1.5 no-print"
                      >
                        Inspect
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                    <div className="truncate">
                      <span className="font-medium text-foreground/70">Matter:</span> {t.caseId?.title || "—"}
                    </div>
                    <div className="truncate">
                      <span className="font-medium text-foreground/70">Client:</span> {t.clientId?.name || "—"}
                    </div>
                    <div>
                      <span className="font-medium text-foreground/70">Due:</span> {formatSafeDate(t.deadline)}
                    </div>
                    <div>
                      <span className="font-medium text-foreground/70">Status:</span>{" "}
                      <span className="capitalize text-foreground font-medium">{t.status.replace(/_/g, " ")}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Cases Assigned Register */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Briefcase size={16} className="text-primary" />
            <span>Assigned Matters & Cases ({cases.length})</span>
          </h3>
        </div>
        {cases.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">No matters currently assigned</div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-hidden">
              <table className="w-full table-fixed text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground bg-muted/20 font-medium">
                    <th className="py-2.5 px-3 w-[15%]">
                      <SortHeaderButton
                        sortKey="number"
                        currentSortKey={empCaseSortKey}
                        currentDirection={empCaseSortDir}
                        onSort={handleEmpCaseSort}
                      >
                        Matter No
                      </SortHeaderButton>
                    </th>
                    <th className="py-2.5 px-3 w-[30%]">
                      <SortHeaderButton
                        sortKey="title"
                        currentSortKey={empCaseSortKey}
                        currentDirection={empCaseSortDir}
                        onSort={handleEmpCaseSort}
                      >
                        Title
                      </SortHeaderButton>
                    </th>
                    <th className="py-2.5 px-3 w-[15%]">
                      <SortHeaderButton
                        sortKey="practice"
                        currentSortKey={empCaseSortKey}
                        currentDirection={empCaseSortDir}
                        onSort={handleEmpCaseSort}
                      >
                        Practice
                      </SortHeaderButton>
                    </th>
                    <th className="py-2.5 px-3 w-[15%]">
                      <SortHeaderButton
                        sortKey="court"
                        currentSortKey={empCaseSortKey}
                        currentDirection={empCaseSortDir}
                        onSort={handleEmpCaseSort}
                      >
                        Court
                      </SortHeaderButton>
                    </th>
                    <th className="py-2.5 px-3 w-[13%]">
                      <SortHeaderButton
                        sortKey="nextHearing"
                        currentSortKey={empCaseSortKey}
                        currentDirection={empCaseSortDir}
                        onSort={handleEmpCaseSort}
                      >
                        Next Hearing
                      </SortHeaderButton>
                    </th>
                    <th className="py-2.5 px-3 w-[12%]">
                      <SortHeaderButton
                        sortKey="status"
                        currentSortKey={empCaseSortKey}
                        currentDirection={empCaseSortDir}
                        onSort={handleEmpCaseSort}
                      >
                        Status
                      </SortHeaderButton>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {sortedCases.map((c) => (
                    <tr
                      key={c._id}
                      onClick={() => navigate({ to: "/cases/$caseId", params: { caseId: c._id } })}
                      className="hover:bg-muted/15 cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 px-3 font-mono font-medium text-primary break-all">{c.number}</td>
                      <td className="py-2.5 px-3 font-medium text-foreground break-words">{c.title}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">{c.practice || "General"}</td>
                      <td className="py-2.5 px-3 text-muted-foreground break-words">{c.court || "—"}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {formatSafeDate(c.nextHearing)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-foreground">
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile / Tablet Stacked Cards */}
            <div className="md:hidden divide-y divide-border/60">
              {cases.map((c) => (
                <div
                  key={c._id}
                  onClick={() => navigate({ to: "/cases/$caseId", params: { caseId: c._id } })}
                  className="p-3.5 space-y-2 hover:bg-muted/15 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-primary">{c.number}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-foreground">
                      {c.status}
                    </span>
                  </div>
                  <p className="font-medium text-foreground text-xs leading-snug break-words">{c.title}</p>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                    <div className="truncate">
                      <span className="font-medium text-foreground/70">Court:</span> {c.court || "—"}
                    </div>
                    <div className="truncate">
                      <span className="font-medium text-foreground/70">Practice:</span> {c.practice || "General"}
                    </div>
                    <div className="col-span-2">
                      <span className="font-medium text-foreground/70">Next Hearing:</span> {formatSafeDate(c.nextHearing)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Audit Trail */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Activity size={16} className="text-primary" />
            <span>Chronological Action Log ({auditLogs.length})</span>
          </h3>
        </div>
        {auditLogs.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">No activity logs recorded</div>
        ) : (
          <div className="divide-y divide-border/60 p-2">
            {auditLogs.map((log) => (
              <div key={log._id} className="p-2.5 flex items-center justify-between text-xs hover:bg-muted/10 rounded">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground uppercase text-[10px] bg-muted px-1.5 py-0.5 rounded">
                      {log.action}
                    </span>
                    <span className="font-medium text-foreground">{log.resource}</span>
                    {log.resourceName && <span className="text-muted-foreground">({log.resourceName})</span>}
                  </div>
                  {log.details && <p className="text-[11px] text-muted-foreground mt-0.5">{log.details}</p>}
                </div>
                <div className="text-right text-[11px] font-mono text-muted-foreground">
                  {new Date(log.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Drilldown Modal for Employee Details */}
      {empDrilldownOpen && (
        <ReportDrilldownDialog
          open={empDrilldownOpen}
          onClose={() => setEmpDrilldownOpen(false)}
          type={empDrilldownType}
          title={empDrilldownTitle}
          subtitle={empDrilldownSubtitle}
          tasks={empCustomTasks || (tasks as any[])}
          cases={cases as any[]}
          onOpenTask={(task) => {
            setEmpDrilldownOpen(false);
            onOpenTask(task);
          }}
          onOpenCase={(caseItem) => {
            setEmpDrilldownOpen(false);
            navigate({ to: "/cases/$caseId", params: { caseId: caseItem._id } });
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Client Detailed Report & Drilldown Component
// ---------------------------------------------------------------------------

function ClientDetailReportView({
  clientId,
  onBack,
  onOpenTask,
}: {
  clientId: string;
  onBack: () => void;
  onOpenTask: (task: TaskRecord) => void;
}) {
  const { data, isLoading, isError, refetch } = useClientDetailReport(clientId);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [visitPurpose, setVisitPurpose] = useState("");
  const [visitNotes, setVisitNotes] = useState("");
  const recordVisitMutation = useRecordClientVisit();

  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownType, setDrilldownType] = useState<DrilldownType>("tasks");
  const [drilldownTitle, setDrilldownTitle] = useState("");
  const [drilldownSubtitle, setDrilldownSubtitle] = useState("");
  const [selectedVisit, setSelectedVisit] = useState<any | null>(null);
  const navigate = useNavigate();

  const rawClientVisits = useMemo(() => data?.client?.visits || [], [data?.client?.visits]);
  const {
    sortedData: sortedVisits,
    sortKey: visitSortKey,
    sortDirection: visitSortDir,
    onSort: handleVisitSort,
  } = useTableSorting(rawClientVisits, {
    customAccessors: {
      visitedAt: (v) => v.visitedAt,
      purpose: (v) => v.purpose,
      handledBy: (v) => (v.handledBy ? (typeof v.handledBy === "object" ? v.handledBy.name : v.handledBy) : ""),
      notes: (v) => v.notes,
    },
  });

  const rawCases = useMemo(() => data?.cases || [], [data?.cases]);
  const {
    sortedData: sortedCases,
    sortKey: caseSortKey,
    sortDirection: caseSortDir,
    onSort: handleCaseSort,
  } = useTableSorting(rawCases, {
    customAccessors: {
      number: (c) => c.number,
      title: (c) => c.title,
      practice: (c) => c.practice,
      court: (c) => c.court,
      assignedTo: (c) => c.assignedTo?.name,
      status: (c) => c.status,
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  if (!data?.client) {
    return (
      <div className="rounded-xl border border-border p-8 text-center bg-card">
        <AlertTriangle size={32} className="mx-auto text-destructive mb-2" />
        <p className="font-semibold text-foreground">Failed to load client detailed report</p>
        <p className="mt-1 text-xs text-muted-foreground">Could not reach the server to retrieve detailed analytics.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  const { client, metrics, cases, tasks, documents, auditLogs } = data;

  const handleRecordVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitPurpose.trim()) return;
    try {
      await recordVisitMutation.mutateAsync({
        clientId: client._id,
        purpose: visitPurpose.trim(),
        notes: visitNotes.trim() || undefined,
      });
      toast.success("Client visit recorded successfully");
      setShowVisitModal(false);
      setVisitPurpose("");
      setVisitNotes("");
      refetch();
    } catch {
      toast.error("Failed to record visit");
    }
  };

  return (
    <div className="space-y-6 printable-report">
      {isError && (
        <StaleDataBanner
          message="Could not refresh the latest client metrics from the server. Showing cached report."
          onRefresh={() => refetch()}
          className="mb-4 no-print"
        />
      )}
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4 no-print">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack} className="rounded-md h-8">
            <ChevronLeft size={16} className="mr-1" /> Back to Register
          </Button>
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <span>{client.name}</span>
              <span className="text-xs font-normal text-primary bg-primary/10 px-2 py-0.5 rounded">
                {client.type} · {client.tag}
              </span>
            </h2>
            <p className="text-xs text-muted-foreground">{client.phone} {client.email ? `· ${client.email}` : ""}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowVisitModal(true)}
            className="h-8 text-xs rounded-md"
          >
            <Calendar size={14} className="mr-1.5" /> Record Office Visit
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => window.print()}
            className="h-8 text-xs rounded-md shadow-xs"
          >
            <Printer size={14} className="mr-1.5" /> Print / Export PDF
          </Button>
        </div>
      </div>

      {/* Printable Report Header */}
      <div className="hidden print:block border-b border-gray-300 pb-4 mb-4">
        <h1 className="text-xl font-bold">SS ASSOCIATES LEGAL-TECH LLP</h1>
        <h2 className="text-sm font-semibold text-gray-700 mt-1">CLIENT DOSSIER & COMPREHENSIVE MATTER REPORT</h2>
        <div className="grid grid-cols-2 text-xs mt-3">
          <div>
            <p><strong>Client Name:</strong> {client.name}</p>
            <p><strong>Classification:</strong> {client.type} · {client.tag}</p>
            <p><strong>Contact:</strong> {client.phone} | {client.email || "N/A"}</p>
          </div>
          <div className="text-right">
            <p><strong>Report Date:</strong> {formatSafeDate(new Date())}</p>
            <p><strong>Total Recorded Office Visits:</strong> {metrics.totalVisits}</p>
          </div>
        </div>
      </div>

      {/* Interactive Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => {
            setDrilldownType("cases");
            setDrilldownTitle(`Active Matters — ${client.name}`);
            setDrilldownSubtitle(`Active and instituted legal proceedings for ${client.name}`);
            setDrilldownOpen(true);
          }}
          className="lift text-left rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:bg-muted/10 cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground group-hover:text-primary transition-colors font-medium">Active Matters</p>
            <ArrowUpRight className="size-3.5 text-muted-foreground opacity-40 group-hover:opacity-100 group-hover:text-primary transition-all" />
          </div>
          <p className="num text-xl font-bold text-foreground mt-1">{metrics.activeCases}</p>
        </button>

        <button
          type="button"
          onClick={() => {
            setDrilldownType("tasks");
            setDrilldownTitle(`Pending Tasks — ${client.name}`);
            setDrilldownSubtitle(`Operational tasks pending execution or review for ${client.name}`);
            setDrilldownOpen(true);
          }}
          className="lift text-left rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 transition-all hover:border-amber-500/50 hover:bg-amber-500/10 cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-amber-600 dark:text-amber-400 group-hover:underline transition-colors font-medium">Pending Tasks</p>
            <ArrowUpRight className="size-3.5 text-amber-600 dark:text-amber-400 opacity-40 group-hover:opacity-100 transition-all" />
          </div>
          <p className="num text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">{metrics.pendingTasks}</p>
        </button>

        <button
          type="button"
          onClick={() => {
            setDrilldownType("visits");
            setDrilldownTitle(`Law-Firm Office Visits — ${client.name}`);
            setDrilldownSubtitle(`Log of in-person consultations and law-firm visits for ${client.name}`);
            setDrilldownOpen(true);
          }}
          className="lift text-left rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:bg-muted/10 cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground group-hover:text-primary transition-colors font-medium">Law-Firm Visits</p>
            <ArrowUpRight className="size-3.5 text-muted-foreground opacity-40 group-hover:opacity-100 group-hover:text-primary transition-all" />
          </div>
          <p className="num text-xl font-bold text-foreground mt-1">{metrics.totalVisits}</p>
        </button>

        <button
          type="button"
          onClick={() => {
            setDrilldownType("documents");
            setDrilldownTitle(`Documents Filed — ${client.name}`);
            setDrilldownSubtitle(`Legal filings, pleadings, and uploaded assets for ${client.name}`);
            setDrilldownOpen(true);
          }}
          className="lift text-left rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:bg-muted/10 cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground group-hover:text-primary transition-colors font-medium">Documents Filed</p>
            <ArrowUpRight className="size-3.5 text-muted-foreground opacity-40 group-hover:opacity-100 group-hover:text-primary transition-all" />
          </div>
          <p className="num text-xl font-bold text-foreground mt-1">{metrics.totalDocuments}</p>
        </button>
      </div>

      {/* Office Visits History */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Calendar size={16} className="text-primary" />
            <span>Law-Firm Visit History ({client.visits?.length || 0})</span>
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowVisitModal(true)}
            className="h-7 text-xs text-primary no-print"
          >
            + Record Visit
          </Button>
        </div>
        {!client.visits || client.visits.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">No law-firm office visits recorded yet</div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-hidden">
              <table className="w-full table-fixed text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground bg-muted/20 font-medium">
                    <th className="py-2.5 px-3 w-[20%]">
                      <SortHeaderButton
                        sortKey="visitedAt"
                        currentSortKey={visitSortKey}
                        currentDirection={visitSortDir}
                        onSort={handleVisitSort}
                      >
                        Date & Time
                      </SortHeaderButton>
                    </th>
                    <th className="py-2.5 px-3 w-[25%]">
                      <SortHeaderButton
                        sortKey="purpose"
                        currentSortKey={visitSortKey}
                        currentDirection={visitSortDir}
                        onSort={handleVisitSort}
                      >
                        Purpose
                      </SortHeaderButton>
                    </th>
                    <th className="py-2.5 px-3 w-[20%]">
                      <SortHeaderButton
                        sortKey="handledBy"
                        currentSortKey={visitSortKey}
                        currentDirection={visitSortDir}
                        onSort={handleVisitSort}
                      >
                        Handled By
                      </SortHeaderButton>
                    </th>
                    <th className="py-2.5 px-3 w-[35%]">
                      <SortHeaderButton
                        sortKey="notes"
                        currentSortKey={visitSortKey}
                        currentDirection={visitSortDir}
                        onSort={handleVisitSort}
                      >
                        Notes
                      </SortHeaderButton>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {sortedVisits.map((v, idx) => (
                    <tr
                      key={v._id || idx}
                      onClick={() => setSelectedVisit(v)}
                      className="hover:bg-muted/15 cursor-pointer transition-colors"
                      title="Click to view full visit details"
                    >
                      <td className="py-2.5 px-3 font-mono text-muted-foreground">
                        {formatSafeDate(v.visitedAt, "—")}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-foreground break-words">{v.purpose}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {v.handledBy ? (typeof v.handledBy === "object" ? v.handledBy.name : v.handledBy) : "Partner / Staff"}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground break-words">{v.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile / Tablet Stacked Cards */}
            <div className="md:hidden divide-y divide-border/60">
              {sortedVisits.map((v, idx) => (
                <div
                  key={v._id || idx}
                  onClick={() => setSelectedVisit(v)}
                  className="p-3.5 space-y-1.5 hover:bg-muted/15 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-xs text-foreground">{v.purpose}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{formatSafeDate(v.visitedAt, "—")}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground/70">Handled By:</span>{" "}
                    {v.handledBy ? (typeof v.handledBy === "object" ? v.handledBy.name : v.handledBy) : "Partner / Staff"}
                  </div>
                  {v.notes && (
                    <p className="text-[11px] text-muted-foreground bg-muted/20 p-2 rounded border border-border/40 line-clamp-2">
                      {v.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Linked Matters */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Briefcase size={16} className="text-primary" />
            <span>Client Matters & Cases Register ({cases.length})</span>
          </h3>
        </div>
        {cases.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">No cases linked to this client</div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-hidden">
              <table className="w-full table-fixed text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground bg-muted/20 font-medium">
                    <th className="py-2.5 px-3 w-[15%]">
                      <SortHeaderButton
                        sortKey="number"
                        currentSortKey={caseSortKey}
                        currentDirection={caseSortDir}
                        onSort={handleCaseSort}
                      >
                        Matter No
                      </SortHeaderButton>
                    </th>
                    <th className="py-2.5 px-3 w-[30%]">
                      <SortHeaderButton
                        sortKey="title"
                        currentSortKey={caseSortKey}
                        currentDirection={caseSortDir}
                        onSort={handleCaseSort}
                      >
                        Title
                      </SortHeaderButton>
                    </th>
                    <th className="py-2.5 px-3 w-[15%]">
                      <SortHeaderButton
                        sortKey="practice"
                        currentSortKey={caseSortKey}
                        currentDirection={caseSortDir}
                        onSort={handleCaseSort}
                      >
                        Practice
                      </SortHeaderButton>
                    </th>
                    <th className="py-2.5 px-3 w-[15%]">
                      <SortHeaderButton
                        sortKey="court"
                        currentSortKey={caseSortKey}
                        currentDirection={caseSortDir}
                        onSort={handleCaseSort}
                      >
                        Court
                      </SortHeaderButton>
                    </th>
                    <th className="py-2.5 px-3 w-[13%]">
                      <SortHeaderButton
                        sortKey="assignedTo"
                        currentSortKey={caseSortKey}
                        currentDirection={caseSortDir}
                        onSort={handleCaseSort}
                      >
                        Assigned To
                      </SortHeaderButton>
                    </th>
                    <th className="py-2.5 px-3 w-[12%]">
                      <SortHeaderButton
                        sortKey="status"
                        currentSortKey={caseSortKey}
                        currentDirection={caseSortDir}
                        onSort={handleCaseSort}
                      >
                        Status
                      </SortHeaderButton>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {sortedCases.map((c) => (
                    <tr
                      key={c._id}
                      onClick={() => navigate({ to: "/cases/$caseId", params: { caseId: c._id } })}
                      className="hover:bg-muted/15 cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 px-3 font-mono font-medium text-primary break-all">{c.number}</td>
                      <td className="py-2.5 px-3 font-medium text-foreground break-words">{c.title}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">{c.practice || "General"}</td>
                      <td className="py-2.5 px-3 text-muted-foreground break-words">{c.court || "—"}</td>
                      <td className="py-2.5 px-3 text-muted-foreground truncate">{c.assignedTo?.name || "Unassigned"}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-foreground">
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile / Tablet Stacked Cards */}
            <div className="md:hidden divide-y divide-border/60">
              {sortedCases.map((c) => (
                <div
                  key={c._id}
                  onClick={() => navigate({ to: "/cases/$caseId", params: { caseId: c._id } })}
                  className="p-3.5 space-y-2 hover:bg-muted/15 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-primary">{c.number}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-foreground">
                      {c.status}
                    </span>
                  </div>
                  <p className="font-medium text-foreground text-xs leading-snug break-words">{c.title}</p>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                    <div className="truncate">
                      <span className="font-medium text-foreground/70">Court:</span> {c.court || "—"}
                    </div>
                    <div className="truncate">
                      <span className="font-medium text-foreground/70">Practice:</span> {c.practice || "General"}
                    </div>
                    <div className="col-span-2 truncate">
                      <span className="font-medium text-foreground/70">Assigned To:</span> {c.assignedTo?.name || "Unassigned"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Drilldown Modal */}
      {drilldownOpen && (
        <ReportDrilldownDialog
          open={drilldownOpen}
          onClose={() => setDrilldownOpen(false)}
          title={drilldownTitle}
          subtitle={drilldownSubtitle}
          type={drilldownType}
          tasks={tasks.filter((t) => ["pending", "in_progress", "pending_approval"].includes(t.status))}
          cases={cases.filter((c) => !["Closed", "Archived"].includes(c.status))}
          visits={client.visits || []}
          documents={documents || []}
          onOpenTask={(t) => {
            setDrilldownOpen(false);
            onOpenTask(t);
          }}
          onOpenCase={(caseId) => {
            setDrilldownOpen(false);
            navigate({ to: "/cases/$caseId", params: { caseId } });
          }}
          onRecordVisit={() => {
            setDrilldownOpen(false);
            setShowVisitModal(true);
          }}
        />
      )}

      {/* Record Visit Modal */}
      {showVisitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full shadow-lift space-y-4">
            <h3 className="text-base font-bold text-foreground">Record Client Office Visit</h3>
            <form onSubmit={handleRecordVisit} className="space-y-3.5">
              <div className="space-y-1.5">
                <Label className="text-xs">Visit Purpose *</Label>
                <Input
                  value={visitPurpose}
                  onChange={(e) => setVisitPurpose(e.target.value)}
                  placeholder="e.g. Document signing, consultation, fee discussion"
                  className="text-xs rounded-md"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Notes / Consultation Summary</Label>
                <Input
                  value={visitNotes}
                  onChange={(e) => setVisitNotes(e.target.value)}
                  placeholder="Summary of meeting notes"
                  className="text-xs rounded-md"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowVisitModal(false)}
                  className="rounded-md"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!visitPurpose.trim() || recordVisitMutation.isPending}
                  className="rounded-md"
                >
                  {recordVisitMutation.isPending ? "Saving…" : "Save Visit Record"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Visit Detail Inspection Dialog */}
      {selectedVisit && (
        <Dialog open={Boolean(selectedVisit)} onOpenChange={(o) => (!o ? setSelectedVisit(null) : null)}>
          <DialogContent className="max-w-md rounded-xl p-6 shadow-lift border-border bg-card">
            <DialogHeader className="border-b border-border pb-3">
              <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Calendar className="size-4 text-primary" />
                <span>Office Visit Details</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                In-person law-firm consultation record for {client.name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-border bg-muted/20">
                <div>
                  <span className="text-[11px] text-muted-foreground block font-medium">Visit Date &amp; Time</span>
                  <span className="font-semibold text-foreground">
                    {formatSafeDate(selectedVisit.visitedAt, "—")}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground block font-medium">Handled By</span>
                  <span className="font-semibold text-foreground">
                    {selectedVisit.handledBy ? (typeof selectedVisit.handledBy === "object" ? selectedVisit.handledBy.name : selectedVisit.handledBy) : "Partner / Staff"}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[11px] text-muted-foreground block font-medium mb-1">Purpose / Matter Discussed</span>
                <div className="p-3 rounded-lg border border-border bg-background font-medium text-foreground">
                  {selectedVisit.purpose}
                </div>
              </div>

              {selectedVisit.notes && (
                <div>
                  <span className="text-[11px] text-muted-foreground block font-medium mb-1">Consultation Notes &amp; Action Points</span>
                  <div className="p-3 rounded-lg border border-border bg-muted/10 text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {selectedVisit.notes}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="border-t border-border pt-3">
              <Button size="sm" variant="outline" onClick={() => setSelectedVisit(null)} className="text-xs">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
