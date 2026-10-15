import React from "react";
import { Clock, Calendar, CheckCircle2, XCircle, ChevronRight } from "lucide-react";
import type { ApprovalMetrics } from "@/services/admin";
import { cn } from "@/lib/utils";

export type MetricFilter = "awaiting" | "today" | "approved" | "rejected";

interface ApprovalMetricsSummaryProps {
  metrics?: ApprovalMetrics;
  activeMetric: MetricFilter | null;
  onSelectMetric: (metric: MetricFilter) => void;
  isLoading?: boolean;
}

export function ApprovalMetricsSummary({
  metrics,
  activeMetric,
  onSelectMetric,
  isLoading,
}: ApprovalMetricsSummaryProps) {
  const cards: Array<{
    id: MetricFilter;
    label: string;
    subtext: string;
    value: number;
    icon: React.ComponentType<{ className?: string; size?: number }>;
    colorClasses: {
      activeBorder: string;
      activeBg: string;
      iconBg: string;
      iconColor: string;
      badgeBg: string;
      badgeText: string;
    };
  }> = [
    {
      id: "awaiting",
      label: "Awaiting Review",
      subtext: "Needs administrative decision",
      value: metrics?.awaitingReview ?? 0,
      icon: Clock,
      colorClasses: {
        activeBorder: "border-amber-500/70 shadow-amber-500/10",
        activeBg: "bg-amber-50/50 dark:bg-amber-950/20",
        iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        iconColor: "text-amber-600 dark:text-amber-400",
        badgeBg: "bg-amber-500/15",
        badgeText: "text-amber-700 dark:text-amber-300",
      },
    },
    {
      id: "today",
      label: "Submitted Today",
      subtext: "Received in today's queue",
      value: metrics?.submittedToday ?? 0,
      icon: Calendar,
      colorClasses: {
        activeBorder: "border-blue-500/70 shadow-blue-500/10",
        activeBg: "bg-blue-50/50 dark:bg-blue-950/20",
        iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
        iconColor: "text-blue-600 dark:text-blue-400",
        badgeBg: "bg-blue-500/15",
        badgeText: "text-blue-700 dark:text-blue-300",
      },
    },
    {
      id: "approved",
      label: "Approved This Month",
      subtext: "Verified & completed",
      value: metrics?.approvedThisMonth ?? 0,
      icon: CheckCircle2,
      colorClasses: {
        activeBorder: "border-emerald-500/70 shadow-emerald-500/10",
        activeBg: "bg-emerald-50/50 dark:bg-emerald-950/20",
        iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        iconColor: "text-emerald-600 dark:text-emerald-400",
        badgeBg: "bg-emerald-500/15",
        badgeText: "text-emerald-700 dark:text-emerald-300",
      },
    },
    {
      id: "rejected",
      label: "Rejected This Month",
      subtext: "Returned for changes",
      value: metrics?.rejectedThisMonth ?? 0,
      icon: XCircle,
      colorClasses: {
        activeBorder: "border-rose-500/70 shadow-rose-500/10",
        activeBg: "bg-rose-50/50 dark:bg-rose-950/20",
        iconBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
        iconColor: "text-rose-600 dark:text-rose-400",
        badgeBg: "bg-rose-500/15",
        badgeText: "text-rose-700 dark:text-rose-300",
      },
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
      {cards.map((card) => {
        const Icon = card.icon;
        const isActive = activeMetric === card.id;

        return (
          <button
            key={card.id}
            type="button"
            onClick={() => onSelectMetric(card.id)}
            disabled={isLoading}
            className={cn(
              "group relative flex flex-col justify-between p-4 rounded-xl border text-left transition-all duration-200",
              "bg-card hover:bg-accent/40 shadow-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              isActive
                ? cn("border-2 ring-1 ring-primary/20 shadow-md", card.colorClasses.activeBorder, card.colorClasses.activeBg)
                : "border-border/80 hover:border-border"
            )}
          >
            <div className="flex items-start justify-between gap-3 w-full">
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-lg transition-transform duration-200 group-hover:scale-105",
                    card.colorClasses.iconBg
                  )}
                >
                  <Icon size={18} />
                </span>
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {card.label}
                  </h3>
                  <p className="text-[11px] text-muted-foreground/80 mt-0.5 line-clamp-1">
                    {card.subtext}
                  </p>
                </div>
              </div>
              <ChevronRight
                size={14}
                className={cn(
                  "text-muted-foreground/40 transition-transform duration-200 shrink-0 mt-1",
                  "group-hover:translate-x-0.5 group-hover:text-foreground",
                  isActive && "text-foreground translate-x-0.5"
                )}
              />
            </div>

            <div className="mt-3 flex items-baseline justify-between pt-2 border-t border-border/40">
              {isLoading ? (
                <div className="h-7 w-16 bg-muted/60 animate-pulse rounded" />
              ) : (
                <span className="text-2xl font-bold tracking-tight text-foreground">
                  {card.value.toLocaleString("en-IN")}
                </span>
              )}
              {isActive && (
                <span
                  className={cn(
                    "text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider",
                    card.colorClasses.badgeBg,
                    card.colorClasses.badgeText
                  )}
                >
                  Filtered
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
