import React from "react";
import { ScrollText, Calendar, Users, ShieldAlert, Sparkles } from "lucide-react";
import type { AuditLogMetrics, AuditLogQueryParams } from "@/services/admin";
import { cn } from "@/lib/utils";

interface AuditMetricsSummaryProps {
  metrics: AuditLogMetrics | undefined;
  isLoading: boolean;
  filters: AuditLogQueryParams;
  onFilterChange: (updates: Partial<AuditLogQueryParams>) => void;
}

export function AuditMetricsSummary({
  metrics,
  isLoading,
  filters,
  onFilterChange,
}: AuditMetricsSummaryProps) {
  const isTodayActive = Boolean(filters.todayOnly);
  const isSecurityActive = filters.action === "security";
  const isTotalActive = !isTodayActive && !isSecurityActive && !filters.action;

  const cards = [
    {
      id: "total",
      label: "Total Events",
      sublabel: "Firm-wide audit trail",
      value: metrics?.totalEvents ?? 0,
      icon: ScrollText,
      active: isTotalActive,
      color: "from-blue-500/10 to-indigo-500/5 text-blue-600 dark:text-blue-400 border-blue-500/20",
      activeRing: "ring-2 ring-blue-500/50 border-blue-500 bg-blue-50/50 dark:bg-blue-950/20",
      onClick: () => {
        onFilterChange({ todayOnly: undefined, action: undefined, page: 1 });
      },
    },
    {
      id: "today",
      label: "Events Today",
      sublabel: "Since 00:00 IST",
      value: metrics?.eventsToday ?? 0,
      icon: Calendar,
      active: isTodayActive,
      color: "from-emerald-500/10 to-teal-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      activeRing: "ring-2 ring-emerald-500/50 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20",
      onClick: () => {
        onFilterChange({
          todayOnly: isTodayActive ? undefined : true,
          action: undefined,
          page: 1,
        });
      },
    },
    {
      id: "users",
      label: "Active Users",
      sublabel: "Distinct team actors",
      value: metrics?.activeUsers ?? 0,
      icon: Users,
      active: false,
      color: "from-purple-500/10 to-pink-500/5 text-purple-600 dark:text-purple-400 border-purple-500/20",
      activeRing: "",
      onClick: undefined,
    },
    {
      id: "security",
      label: "Security Events",
      sublabel: "Logins, deletions & settings",
      value: metrics?.securityEvents ?? 0,
      icon: ShieldAlert,
      active: isSecurityActive,
      color: "from-amber-500/10 to-orange-500/5 text-amber-600 dark:text-amber-400 border-amber-500/20",
      activeRing: "ring-2 ring-amber-500/50 border-amber-500 bg-amber-50/50 dark:bg-amber-950/20",
      onClick: () => {
        onFilterChange({
          action: isSecurityActive ? undefined : "security",
          todayOnly: undefined,
          page: 1,
        });
      },
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {cards.map((c) => {
        const Icon = c.icon;
        const isInteractive = Boolean(c.onClick);

        return (
          <button
            key={c.id}
            type="button"
            disabled={!isInteractive || isLoading}
            onClick={c.onClick}
            className={cn(
              "group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-card p-4 text-left shadow-soft transition-all duration-200",
              c.active
                ? c.activeRing
                : "border-border/80 hover:border-border hover:shadow-md",
              isInteractive && "cursor-pointer active:scale-[0.99]",
              !isInteractive && "cursor-default"
            )}
          >
            {/* Background subtle gradient */}
            <div
              className={cn(
                "absolute -right-6 -top-6 size-24 rounded-full bg-gradient-to-br opacity-40 blur-xl transition-all duration-300 group-hover:scale-125",
                c.color
              )}
            />

            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {c.label}
              </span>
              <div
                className={cn(
                  "grid size-8 place-items-center rounded-xl border transition-colors",
                  c.color
                )}
              >
                <Icon size={16} strokeWidth={2} />
              </div>
            </div>

            <div className="mt-3 flex items-baseline justify-between">
              {isLoading ? (
                <div className="h-8 w-16 animate-pulse rounded bg-muted" />
              ) : (
                <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                  {c.value.toLocaleString()}
                </span>
              )}
              {c.active && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  <Sparkles size={10} /> Active filter
                </span>
              )}
            </div>

            <p className="mt-1 text-xs text-muted-foreground">{c.sublabel}</p>
          </button>
        );
      })}
    </div>
  );
}
