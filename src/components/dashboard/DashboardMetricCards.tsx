import { Gavel, AlertTriangle, Clock, Briefcase, Users, CheckCircle2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

interface DashboardMetricCardsProps {
  hearingsCount: number;
  overdueCount: number;
  pendingTasksCount: number;
  activeCasesCount: number;
  totalClientsCount: number;
  tasksCompletedCount: number;
  periodLabel?: string;
  loading?: boolean;
}

export function DashboardMetricCards({
  hearingsCount,
  overdueCount,
  pendingTasksCount,
  activeCasesCount,
  totalClientsCount,
  tasksCompletedCount,
  periodLabel = "30 days",
  loading = false,
}: DashboardMetricCardsProps) {
  const navigate = useNavigate();

  const cards = [
    {
      label: "Today's hearings",
      value: hearingsCount,
      hint: "Court appearances",
      icon: Gavel,
      isGradient: true,
      onClick: () => navigate({ to: "/calendar" }),
    },
    {
      label: "Overdue items",
      value: overdueCount,
      hint: "Tasks & Cases",
      icon: AlertTriangle,
      iconColor: "text-rose-600 dark:text-rose-400",
      iconBg: "bg-rose-50 dark:bg-rose-950/40 border border-rose-200/50 dark:border-rose-900/40",
      onClick: () => navigate({ to: "/tasks" }),
    },
    {
      label: "Pending tasks",
      value: pendingTasksCount,
      hint: "Awaiting completion",
      icon: Clock,
      iconColor: "text-amber-600 dark:text-amber-400",
      iconBg:
        "bg-amber-50 dark:bg-amber-950/40 border border-amber-200/50 dark:border-amber-900/40",
      onClick: () => navigate({ to: "/tasks" }),
    },
    {
      label: "Active cases",
      value: activeCasesCount,
      hint: "Firm-wide",
      icon: Briefcase,
      iconColor: "text-blue-600 dark:text-blue-400",
      iconBg: "bg-blue-50 dark:bg-blue-950/40 border border-blue-200/50 dark:border-blue-900/40",
      onClick: () => navigate({ to: "/cases" }),
    },
    {
      label: "Clients",
      value: totalClientsCount,
      hint: periodLabel,
      icon: Users,
      iconColor: "text-purple-600 dark:text-purple-400",
      iconBg:
        "bg-purple-50 dark:bg-purple-950/40 border border-purple-200/50 dark:border-purple-900/40",
      onClick: () => navigate({ to: "/clients" }),
    },
    {
      label: "Tasks done",
      value: tasksCompletedCount,
      hint: periodLabel,
      icon: CheckCircle2,
      iconColor: "text-emerald-600 dark:text-emerald-400",
      iconBg:
        "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/50 dark:border-emerald-900/40",
      onClick: () => navigate({ to: "/tasks" }),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
      {cards.map((c) => {
        const Icon = c.icon;
        if (c.isGradient) {
          return (
            <div
              key={c.label}
              onClick={c.onClick}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  c.onClick();
                }
              }}
              className="group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 p-4 text-white shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-medium text-white/90 truncate">{c.label}</span>
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/20 text-white backdrop-blur-xs transition-transform duration-200 group-hover:scale-105">
                  <Icon size={17} strokeWidth={2} />
                </span>
              </div>
              <div className="mt-2.5">
                <div className="text-2xl font-bold tracking-tight text-white">
                  {loading ? "…" : c.value}
                </div>
                <div className="mt-0.5 text-[11px] font-medium text-white/80">{c.hint}</div>
              </div>
            </div>
          );
        }

        return (
          <div
            key={c.label}
            onClick={c.onClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                c.onClick();
              }
            }}
            className="group relative flex cursor-pointer flex-col justify-between rounded-xl border border-border/80 bg-card p-4 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm active:translate-y-0"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground truncate">{c.label}</span>
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-lg transition-transform duration-200 group-hover:scale-105",
                  c.iconBg,
                  c.iconColor,
                )}
              >
                <Icon size={17} strokeWidth={2} />
              </span>
            </div>
            <div className="mt-2.5">
              <div className="text-2xl font-bold tracking-tight text-foreground">
                {loading ? "…" : c.value}
              </div>
              <div className="mt-0.5 text-[11px] font-medium text-muted-foreground">{c.hint}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
