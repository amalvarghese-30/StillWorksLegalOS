import { Link } from "@tanstack/react-router";
import { ArrowRight, Briefcase } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { useCaseStatusBreakdown } from "@/services/reports";

const STATUS_COLORS: Record<string, string> = {
  Active: "#3b82f6",    // Blue
  Urgent: "#ef4444",    // Red
  "On Hold": "#f59e0b", // Amber
  Closed: "#10b981",    // Emerald
};

export function AdminCaseOverviewChart() {
  const { data, isLoading } = useCaseStatusBreakdown();
  const breakdown = data?.breakdown ?? { Active: 0, Urgent: 0, "On Hold": 0, Closed: 0 };

  const chartData = [
    { name: "Active", value: breakdown.Active || 0, color: STATUS_COLORS.Active },
    { name: "Urgent", value: breakdown.Urgent || 0, color: STATUS_COLORS.Urgent },
    { name: "On Hold", value: breakdown["On Hold"] || 0, color: STATUS_COLORS["On Hold"] },
    { name: "Closed", value: breakdown.Closed || 0, color: STATUS_COLORS.Closed },
  ];

  const totalCases = chartData.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <section className="flex flex-col rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-soft transition-all duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-3 border-b border-border/60">
        <div>
          <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
            Case lifecycle overview
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Active and concluded matters firm-wide
          </p>
        </div>
        <Link
          to="/cases"
          className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group shrink-0"
        >
          <span>View all cases</span>
          <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* Donut Chart */}
      <div className="mt-2 min-h-[220px] flex-1 flex flex-col justify-center items-center">
        {isLoading ? (
          <div className="size-36 rounded-full border-4 border-muted border-t-primary animate-spin" />
        ) : totalCases === 0 ? (
          <div className="py-10 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 mx-auto mb-3">
              <Briefcase size={22} strokeWidth={1.75} />
            </div>
            <p className="text-sm font-semibold text-foreground">No case records found</p>
            <p className="text-xs text-muted-foreground mt-1">
              Matters created will appear across lifecycle states here.
            </p>
          </div>
        ) : (
          <div className="w-full h-56 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  stroke="none"
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: "0.75rem",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--card)",
                    fontSize: "12px",
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
                  }}
                  formatter={(value: any, name: any) => [`${value} cases`, `${name} Stage`]}
                />
                <Legend
                  verticalAlign="bottom"
                  height={32}
                  formatter={(val, entry: any) => {
                    const item = chartData.find((d) => d.name === val);
                    const pct = totalCases > 0 ? Math.round(((item?.value || 0) / totalCases) * 100) : 0;
                    return (
                      <span className="text-xs font-medium text-foreground mr-3">
                        {val}: <strong className="font-mono">{item?.value || 0}</strong>{" "}
                        <span className="text-[10px] text-muted-foreground">({pct}%)</span>
                      </span>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Center total summary pill */}
            <div className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
              <span className="block text-xl font-bold font-mono text-foreground leading-none">
                {totalCases}
              </span>
              <span className="text-[10px] font-medium text-muted-foreground">Total</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
