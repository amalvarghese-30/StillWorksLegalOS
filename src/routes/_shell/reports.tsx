import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
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
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/common/Surface";
import { ErrorState } from "@/components/common/ErrorState";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import { useAuth } from "@/lib/auth";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  useReportsSummary,
  useCaseGrowth,
  usePracticeAreas,
  useEmployeeWorkload,
  useTopClients,
  useCaseStatusBreakdown,
  useMyPerformance,
  useDailyEmployeeReport,
  EmployeeDailyReport,
} from "@/services/reports";
import type { TaskRecord } from "@/services/tasks";

export const Route = createFileRoute("/_shell/reports")({
  head: () => ({
    meta: [
      { title: "Reports · S & S Legal-Tech LLP" },
      { name: "description", content: "Operational insight for the firm: employee daily reporting, case mix, growth, workload and completion rates." },
      { property: "og:title", content: "Reports · S & S Legal-Tech LLP" },
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
    return d.toLocaleDateString("en-IN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
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

  // Selected date & employee filter for daily reporting
  const [selectedDate, setSelectedDate] = useState(() => getTodayKolkata());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");

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
        breadcrumb={[{ label: "S & S", to: "/" }, { label: "Reports" }]}
        title="Reports & Daily Activity"
        subtitle={
          isAdmin
            ? "Operational monitoring of employee daily task activity, case mix, firm-wide workload, and growth."
            : "Your personal performance and work completed. No financial data."
        }
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/50 px-3 py-1 text-caption font-medium">
            <span
              className={`size-2 rounded-full ${isAdmin ? "bg-primary" : "bg-emerald-500"}`}
            />
            <span>Scope: {isAdmin ? "Entire Firm" : "Personal (You)"}</span>
          </span>
        }
      />

      {/* ── ADMIN FEATURED: Daily Employee Activity Report (Prominent Top Placement) ── */}
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
                    className="border-0 bg-transparent px-2 py-0.5 text-xs font-medium text-foreground focus:outline-none focus:ring-0"
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
                  />
                ))}
              </div>
            )}
          </SectionCard>
        </section>
      )}

      {/* ── Firm-wide Work Completed (High-level Summary) ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Active Cases", value: summary?.activeCases ?? "—", icon: Gavel, change: summary?.period ?? "" },
          { label: "Total Clients", value: summary?.totalClients ?? "—", icon: TrendingUp, change: summary?.period ?? "" },
          { label: "Tasks Completed", value: summary?.tasksCompleted ?? "—", icon: CheckSquare, change: summary?.period ?? "" },
          { label: "Docs Approved", value: summary?.docsApproved ?? "—", icon: FileText, change: summary?.period ?? "" },
        ].map((item) => (
          <article key={item.label} className="rounded-xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <item.icon size={18} strokeWidth={1.75} />
              </span>
              <div className="min-w-0">
                <p className="text-caption text-muted-foreground">{item.label}</p>
                <p className="num text-section font-semibold">{item.value}</p>
              </div>
            </div>
            <p className="mt-2 text-caption text-success">{item.change}</p>
          </article>
        ))}
      </div>

      {/* ── Analytical Charts Grid ── */}
      <div className="grid gap-6 xl:grid-cols-2">
        {/* Case growth */}
        <SectionCard
          title="Monthly Case Trajectory"
          description="Comparison of newly instituted client matters vs. successfully resolved/closed matters."
          icon={TrendingUp}
        >
          <div className="h-72">
            {growthLoading ? (
              <div key="growth-loading" className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-muted-foreground" size={24} /></div>
            ) : growthError ? (
              <div key="growth-error" className="flex h-full items-center justify-center"><ErrorState title="Couldn't load case growth" onRetry={refetchGrowth} /></div>
            ) : growth.length === 0 ? (
              <div key="growth-empty" className="flex h-full items-center justify-center text-muted-foreground text-helper">No historical case data available yet</div>
            ) : (
              <CaseGrowthChart key="growth-chart" growth={growth} />
            )}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground border-t border-border/40 pt-2">
            Tracks total intake of new client litigation &amp; advisory matters against matters completed or disposed during each calendar month.
          </p>
        </SectionCard>

        {/* Practice areas (Wide Label Width to Prevent Overlapping) */}
        <SectionCard
          title="Practice Area Distribution"
          description="Active client matters categorized across specialized legal domains."
          icon={BarChart3}
        >
          <div className="h-72">
            {practiceLoading ? (
              <div key="practice-loading" className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-muted-foreground" size={24} /></div>
            ) : practiceError ? (
              <div key="practice-error" className="flex h-full items-center justify-center"><ErrorState title="Couldn't load practice areas" onRetry={refetchPractice} /></div>
            ) : distribution.length === 0 ? (
              <div key="practice-empty" className="flex h-full items-center justify-center text-muted-foreground text-helper">No active practice area records yet</div>
            ) : (
              <PracticeAreaChart key="practice-chart" distribution={distribution} />
            )}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground border-t border-border/40 pt-2">
            Displays active matters concentration across practice areas to help partners allocate advocate resources and court appearances effectively.
          </p>
        </SectionCard>

        {/* Admin: Top Clients */}
        {isAdmin && topClients.length > 0 && (
          <SectionCard title="Top clients" description="Clients with most active matters." icon={Star}>
            <ul className="space-y-3">
              {topClients.map((c, i) => (
                <li key={c.name} className="flex items-center justify-between rounded-md border border-border p-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-caption font-semibold text-primary">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.name}</p>
                    </div>
                  </div>
                  <span className="num shrink-0 text-helper font-semibold">{c.cases} cases</span>
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {/* Admin: Employee workload / Non-admin: Personal performance */}
        {isAdmin ? (
          <SectionCard title="Employee workload" description="Capacity used this month." icon={Users}>
            {workloadLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" size={24} /></div>
            ) : workloadError ? (
              <ErrorState title="Couldn't load employee workload" onRetry={refetchWorkload} />
            ) : workloads.length === 0 ? (
              <div className="py-8 text-center text-helper text-muted-foreground">No workload data yet</div>
            ) : (
              <ul className="space-y-4">
                {workloads.map((w) => (
                  <li key={w._id}>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                      <p className="truncate text-helper font-medium">{w.name}</p>
                      <span className="num text-caption text-muted-foreground">{w.workload}%</span>
                    </div>
                    <Progress value={w.workload} className="mt-2 h-1.5" />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        ) : (
          <SectionCard title="Your performance" description="Your contributions so far." icon={Trophy}>
            {performanceLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" size={24} /></div>
            ) : performanceError ? (
              <ErrorState title="Couldn't load your performance" onRetry={refetchPerformance} />
            ) : performance.length === 0 ? (
              <div className="py-8 text-center text-helper text-muted-foreground">No activity recorded yet</div>
            ) : (
              <ul className="space-y-4">
                {performance.map((item) => (
                  <li key={item.label}>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                      <p className="truncate text-helper">{item.label}</p>
                      <span className="num text-caption text-muted-foreground">{item.done}/{item.total}</span>
                    </div>
                    <Progress value={item.total > 0 ? (item.done / item.total) * 100 : 0} className="mt-2 h-1.5" />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        )}

        {/* Case status pie */}
        <SectionCard
          title="Case Status Distribution"
          description="Firm matters partitioned by current lifecycle stage."
          icon={PieIcon}
        >
          <div className="h-72">
            <CaseStatusChart caseStatusBreakdown={caseStatusBreakdown} />
          </div>

          {/* Quick status summary count pill bar */}
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 border-t border-border/40 pt-3">
            {[
              { label: "Active", count: caseStatusBreakdown.Active, color: "text-emerald-600 dark:text-emerald-400" },
              { label: "Urgent", count: caseStatusBreakdown.Urgent, color: "text-rose-600 dark:text-rose-400" },
              { label: "On Hold", count: caseStatusBreakdown["On Hold"], color: "text-amber-600 dark:text-amber-400" },
              { label: "Closed", count: caseStatusBreakdown.Closed, color: "text-muted-foreground" },
            ].map((s) => (
              <div key={s.label} className="rounded-md bg-muted/40 p-2 text-center">
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
                <p className={`num text-base font-semibold ${s.color}`}>{s.count}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

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
// Charts
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

function PracticeAreaChart({ distribution }: { distribution: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={240}>
      <BarChart
        data={distribution}
        layout="vertical"
        margin={{ left: 24, right: 30, top: 8, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          fontSize={12}
          width={150}
          tickFormatter={(val: string) => (val && val.length > 22 ? `${val.slice(0, 20)}…` : val)}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          contentStyle={{
            borderRadius: "var(--radius-medium)",
            border: "1px solid var(--border)",
            backgroundColor: "var(--card)",
          }}
          formatter={(value: any) => [`${value} active matters`, "Active Matters"]}
        />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} fill="var(--chart-2)" barSize={16} name="Active Matters" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function CaseStatusChart({ caseStatusBreakdown }: { caseStatusBreakdown: any }) {
  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={240}>
      <PieChart>
        <Pie
          data={[
            { name: "Active", value: caseStatusBreakdown.Active, color: "var(--chart-2)" },
            { name: "Urgent", value: caseStatusBreakdown.Urgent, color: "var(--chart-1)" },
            { name: "On Hold", value: caseStatusBreakdown["On Hold"], color: "var(--chart-4)" },
            { name: "Closed", value: caseStatusBreakdown.Closed, color: "var(--chart-3)" },
          ]}
          dataKey="value"
          nameKey="name"
          innerRadius={62}
          outerRadius={92}
          paddingAngle={3}
          stroke="none"
        >
          <Cell fill="var(--chart-2)" />
          <Cell fill="var(--chart-1)" />
          <Cell fill="var(--chart-4)" />
          <Cell fill="var(--chart-3)" />
        </Pie>
        <Tooltip
          contentStyle={{
            borderRadius: "var(--radius-medium)",
            border: "1px solid var(--border)",
            backgroundColor: "var(--card)",
          }}
          formatter={(value: any, name: any) => [`${value} matters`, `${name} Stage`]}
        />
        <Legend
          verticalAlign="bottom"
          height={36}
          formatter={(val) => (
            <span className="text-caption font-medium text-foreground">
              {val} Matters
            </span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
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
}

function EmployeeDailyReportCard({ report, selectedDate, onOpenTask }: EmployeeDailyReportCardProps) {
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
            <span className="text-muted-foreground">Assigned:</span>
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
            <span>{expanded ? "Hide Report" : "View Report"}</span>
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
                                    <span>Due: {new Date(t.deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
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
                                    Next Hearing: {new Date(c.nextHearing).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
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
                            ? new Date(log.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
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
