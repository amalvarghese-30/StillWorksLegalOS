import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckSquare } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { useTaskStatusBreakdown } from "@/services/reports";

const TASK_STATUS_COLORS: Record<string, string> = {
  "In Progress": "#3b82f6",       // Blue
  Pending: "#6366f1",             // Indigo
  "Pending Approval": "#8b5cf6",    // Purple
  Overdue: "#ef4444",             // Red
  Completed: "#10b981",           // Emerald
};

export function AdminTaskStatusChart() {
  const { data, isLoading } = useTaskStatusBreakdown();
  const breakdown = data?.breakdown ?? {
    pending: 0,
    in_progress: 0,
    pending_approval: 0,
    overdue: 0,
    completed: 0,
  };

  const chartData = [
    { name: "In Progress", value: breakdown.in_progress || 0, color: TASK_STATUS_COLORS["In Progress"] },
    { name: "Pending", value: breakdown.pending || 0, color: TASK_STATUS_COLORS.Pending },
    { name: "Pending Approval", value: breakdown.pending_approval || 0, color: TASK_STATUS_COLORS["Pending Approval"] },
    { name: "Overdue", value: breakdown.overdue || 0, color: TASK_STATUS_COLORS.Overdue },
    { name: "Completed", value: breakdown.completed || 0, color: TASK_STATUS_COLORS.Completed },
  ].filter((d) => d.value > 0 || true); // keep all for consistent legend

  const totalTasks = chartData.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <section className="flex flex-col rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-soft transition-all duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-3 border-b border-border/60">
        <div>
          <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
            Task execution status
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Firm-wide workflow distribution and urgency
          </p>
        </div>
        <Link
          to="/tasks"
          className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group shrink-0"
        >
          <span>View all tasks</span>
          <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* Donut Chart */}
      <div className="mt-2 min-h-[220px] flex-1 flex flex-col justify-center items-center">
        {isLoading ? (
          <div className="size-36 rounded-full border-4 border-muted border-t-primary animate-spin" />
        ) : totalTasks === 0 ? (
          <div className="py-10 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 mx-auto mb-3">
              <CheckSquare size={22} strokeWidth={1.75} />
            </div>
            <p className="text-sm font-semibold text-foreground">No tasks recorded yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Active and completed tasks across all workflows will appear here.
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
                  formatter={(value: any, name: any) => [`${value} tasks`, `${name}`]}
                />
                <Legend
                  verticalAlign="bottom"
                  height={32}
                  formatter={(val) => {
                    const item = chartData.find((d) => d.name === val);
                    const pct = totalTasks > 0 ? Math.round(((item?.value || 0) / totalTasks) * 100) : 0;
                    return (
                      <span className="text-xs font-medium text-foreground mr-2.5">
                        {val}: <strong className="font-mono">{item?.value || 0}</strong>{" "}
                        <span className="text-[10px] text-muted-foreground">({pct}%)</span>
                      </span>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Center total summary */}
            <div className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
              <span className="block text-xl font-bold font-mono text-foreground leading-none">
                {totalTasks}
              </span>
              <span className="text-[10px] font-medium text-muted-foreground">Tasks</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
