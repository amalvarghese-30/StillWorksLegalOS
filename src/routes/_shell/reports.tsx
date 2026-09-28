import { createFileRoute } from "@tanstack/react-router";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { BarChart3, TrendingUp, PieChart as PieIcon, Users, CheckSquare, Gavel, FileText, Star, Trophy, Loader2, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/common/Surface";
import { ErrorState } from "@/components/common/ErrorState";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/auth";
import {
  useReportsSummary,
  useCaseGrowth,
  usePracticeAreas,
  useEmployeeWorkload,
  useTopClients,
  useCaseStatusBreakdown,
  useMyPerformance,
} from "@/services/reports";

export const Route = createFileRoute("/_shell/reports")({
  head: () => ({
    meta: [
      { title: "Reports · S & S Legal-Tech LLP" },
      { name: "description", content: "Operational insight for the firm: case mix, growth, workload and completion rates." },
      { property: "og:title", content: "Reports · S & S Legal-Tech LLP" },
      { property: "og:description", content: "Case mix, growth, workload and completion rates at a glance." },
    ],
  }),
  component: ReportsPage,
});

const palette = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)",
];

function ReportsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data: summary } = useReportsSummary();
  const { data: caseGrowthData, isLoading: growthLoading, isError: growthError, refetch: refetchGrowth } = useCaseGrowth();
  const { data: practiceData, isLoading: practiceLoading, isError: practiceError, refetch: refetchPractice } = usePracticeAreas();
  const { data: workloadData, isLoading: workloadLoading, isError: workloadError, refetch: refetchWorkload } = useEmployeeWorkload();
  const { data: topClientsData } = useTopClients();
  const { data: statusBreakdownData } = useCaseStatusBreakdown();
  const { data: myPerformanceData, isLoading: performanceLoading, isError: performanceError, refetch: refetchPerformance } = useMyPerformance(!isAdmin);

  const growth = caseGrowthData?.growth ?? [];
  const distribution = practiceData?.distribution ?? [];
  const workloads = workloadData?.workloads ?? [];
  const topClients = topClientsData?.topClients ?? [];
  const caseStatusBreakdown = statusBreakdownData?.breakdown ?? { Active: 0, "On Hold": 0, Closed: 0, Urgent: 0 };
  const performance = myPerformanceData?.performance ?? [];

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "S & S", to: "/" }, { label: "Reports" }]}
        title="Reports"
        subtitle={
          isAdmin
            ? "Firm-wide operational analytics — case mix, growth, workload and top clients."
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

      {/* ── Work Completed ── */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Active Cases", value: summary?.activeCases ?? "—", icon: Gavel, change: summary?.period ?? "" },
          { label: "Total Clients", value: summary?.totalClients ?? "—", icon: TrendingUp, change: summary?.period ?? "" },
          { label: "Tasks Completed", value: summary?.tasksCompleted ?? "—", icon: CheckSquare, change: summary?.period ?? "" },
          { label: "Docs Approved", value: summary?.docsApproved ?? "—", icon: FileText, change: summary?.period ?? "" },
        ].map((item) => (
          <article key={item.label} className="rounded-lg border border-border bg-card p-5 shadow-soft">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
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

      {/* ── Charts ── */}
      <div className="grid gap-6 xl:grid-cols-2">
        {/* Case growth */}
        <SectionCard
          title="Monthly Case Trajectory"
          description="Comparison of newly instituted client matters vs. successfully resolved/closed matters."
          icon={TrendingUp}
        >
          <div className="h-72">
            {growthLoading ? (
              <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-muted-foreground" size={24} /></div>
            ) : growthError ? (
              <div className="flex h-full items-center justify-center"><ErrorState title="Couldn't load case growth" onRetry={refetchGrowth} /></div>
            ) : growth.length === 0 ? (
              <div className="flex h-full items-center justify-center text-muted-foreground text-helper">No historical case data available yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
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
            )}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground border-t border-border/40 pt-2">
            Tracks total intake of new client litigation &amp; advisory matters against matters completed or disposed during each calendar month.
          </p>
        </SectionCard>

        {/* Practice areas */}
        <SectionCard
          title="Practice Area Distribution"
          description="Active client matters categorized across specialized legal domains."
          icon={BarChart3}
        >
          <div className="h-72">
            {practiceLoading ? (
              <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-muted-foreground" size={24} /></div>
            ) : practiceError ? (
              <div className="flex h-full items-center justify-center"><ErrorState title="Couldn't load practice areas" onRetry={refetchPractice} /></div>
            ) : distribution.length === 0 ? (
              <div className="flex h-full items-center justify-center text-muted-foreground text-helper">No active practice area records yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distribution} layout="vertical" margin={{ left: 16, right: 24, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} fontSize={12} width={110} />
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

        {/* Admin: Employee workload */}
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
            <ResponsiveContainer width="100%" height="100%">
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
    </div>
  );
}
