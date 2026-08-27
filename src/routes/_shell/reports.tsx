import { createFileRoute } from "@tanstack/react-router";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
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
      { title: "Reports · StillWorks LegalOS" },
      { name: "description", content: "Operational insight for the firm: case mix, growth, workload and completion rates." },
      { property: "og:title", content: "Reports · StillWorks LegalOS" },
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
        breadcrumb={[{ label: "StillWorks", to: "/" }, { label: "Reports" }]}
        title="Reports"
        subtitle={
          isAdmin
            ? "Firm-wide operational analytics — case mix, growth, workload and top clients."
            : "Your personal performance and work completed. No financial data."
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
        <SectionCard title="Monthly case growth" description="New vs. closed matters." icon={TrendingUp}>
          <div className="h-64">
            {growthLoading ? (
              <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-muted-foreground" size={24} /></div>
            ) : growthError ? (
              <div className="flex h-full items-center justify-center"><ErrorState title="Couldn't load case growth" onRetry={refetchGrowth} /></div>
            ) : growth.length === 0 ? (
              <div className="flex h-full items-center justify-center text-muted-foreground text-helper">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growth} margin={{ left: -20, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="gNew" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} />
                  <Tooltip contentStyle={{ borderRadius: "var(--radius-medium)", border: "1px solid var(--border)", boxShadow: "var(--shadow-soft)" }} />
                  <Area type="monotone" dataKey="cases" stroke="var(--chart-1)" fill="url(#gNew)" strokeWidth={2} name="New Cases" />
                  <Area type="monotone" dataKey="closed" stroke="var(--chart-3)" fill="transparent" strokeWidth={2} name="Closed" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>

        {/* Practice areas */}
        <SectionCard title="Practice area distribution" description="Cases by practice area." icon={BarChart3}>
          <div className="h-64">
            {practiceLoading ? (
              <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-muted-foreground" size={24} /></div>
            ) : practiceError ? (
              <div className="flex h-full items-center justify-center"><ErrorState title="Couldn't load practice areas" onRetry={refetchPractice} /></div>
            ) : distribution.length === 0 ? (
              <div className="flex h-full items-center justify-center text-muted-foreground text-helper">No cases yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distribution} layout="vertical" margin={{ left: 24, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} fontSize={12} width={80} />
                  <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={{ borderRadius: "var(--radius-medium)", border: "1px solid var(--border)" }} />
                  <Bar dataKey="value" radius={[8, 8, 8, 8]} fill="var(--chart-2)" barSize={18} name="Cases" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
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
        <SectionCard title="Case status breakdown" description="Active · On Hold · Closed · Urgent" icon={PieIcon}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: "Active", value: caseStatusBreakdown.Active },
                    { name: "On Hold", value: caseStatusBreakdown["On Hold"] },
                    { name: "Closed", value: caseStatusBreakdown.Closed },
                    { name: "Urgent", value: caseStatusBreakdown.Urgent },
                  ]}
                  dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={3} stroke="none"
                >
                  <Cell fill="var(--chart-2)" />
                  <Cell fill="var(--chart-4)" />
                  <Cell fill="var(--chart-3)" />
                  <Cell fill="var(--chart-1)" />
                </Pie>
                <Tooltip contentStyle={{ borderRadius: "var(--radius-medium)", border: "1px solid var(--border)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
