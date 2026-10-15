import React from "react";
import { Link } from "@tanstack/react-router";
import {
  ShieldCheck,
  UserCog,
  Briefcase,
  Users,
  FileText,
  Activity,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminKpiRowProps {
  pendingApprovalsCount: number | "…";
  teamMembersCount: number | "…";
  activeCasesCount: number | "…";
  clientsCount: number | "…";
  docsApprovedCount: number | "…";
  auditEventsCount: number | "…";
  periodHint?: string;
  isLoading?: boolean;
}

export function AdminKpiRow({
  pendingApprovalsCount,
  teamMembersCount,
  activeCasesCount,
  clientsCount,
  docsApprovedCount,
  auditEventsCount,
}: AdminKpiRowProps) {
  const cards = [
    {
      id: "approvals",
      title: "Pending Approvals",
      count: pendingApprovalsCount,
      to: "/admin/approvals",
      icon: ShieldCheck,
      iconContainer:
        "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/50",
    },
    {
      id: "team",
      title: "Team Members",
      count: teamMembersCount,
      to: "/admin/employees",
      icon: Users,
      iconContainer:
        "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/50",
    },
    {
      id: "cases",
      title: "Active Cases",
      count: activeCasesCount,
      to: "/cases",
      icon: Briefcase,
      iconContainer:
        "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/50",
    },
    {
      id: "clients",
      title: "Clients",
      count: clientsCount,
      to: "/clients",
      icon: UserCog,
      iconContainer:
        "bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/50",
    },
    {
      id: "docs",
      title: "Docs Approved",
      count: docsApprovedCount,
      to: "/documents",
      icon: FileText,
      iconContainer:
        "bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200/60 dark:border-purple-800/50",
    },
    {
      id: "audit",
      title: "Audit Events",
      count: auditEventsCount,
      to: "/admin/audit-logs",
      icon: Activity,
      iconContainer:
        "bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/50",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5 sm:gap-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Link
            key={c.id}
            to={c.to}
            className="group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            aria-label={`${c.title}: ${c.count}`}
          >
            {/* Top row: Icon + Number + Chevron */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-xl shadow-2xs transition-transform group-hover:scale-105",
                    c.iconContainer
                  )}
                >
                  <Icon size={18} strokeWidth={2.2} />
                </span>
                <span className="num text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-none">
                  {c.count}
                </span>
              </div>
              <ChevronRight
                size={16}
                className="text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground shrink-0"
              />
            </div>

            {/* Bottom row: Label */}
            <div className="mt-4">
              <span className="text-xs sm:text-sm font-semibold tracking-tight text-foreground/90 group-hover:text-foreground transition-colors block truncate">
                {c.title}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
