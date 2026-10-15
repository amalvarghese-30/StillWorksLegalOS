import { ShieldCheck, UserCog, Briefcase, Users, FileText, ScrollText } from "lucide-react";
import { Link } from "@tanstack/react-router";
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
  periodHint = "30 days",
}: AdminKpiRowProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-6 gap-3.5 sm:gap-4">
      {/* 1. Pending Approvals — Hero Accent Card */}
      <Link
        to="/admin/approvals"
        className="group relative flex flex-col justify-between rounded-2xl bg-gradient-to-br from-[#4f46e5] via-[#5c56ec] to-[#7c3aed] p-4.5 sm:p-5 text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        aria-label="Pending approvals: needs your sign-off"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="text-xs sm:text-sm font-semibold tracking-tight text-white/95">
            Pending approvals
          </span>
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/20 text-white backdrop-blur-xs transition-transform group-hover:scale-105">
            <ShieldCheck size={17} strokeWidth={2} />
          </span>
        </div>
        <div className="mt-3.5 mb-1">
          <span className="num text-2xl sm:text-3xl lg:text-[2rem] font-bold tracking-tight text-white leading-none">
            {pendingApprovalsCount}
          </span>
        </div>
        <p className="text-xs font-medium text-white/80">
          Needs your sign-off
        </p>
      </Link>

      {/* 2. Team Members */}
      <Link
        to="/admin/employees"
        className="group flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-4.5 sm:p-5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        aria-label="Team members: roles and permissions"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="text-xs sm:text-sm font-semibold tracking-tight text-foreground/90 group-hover:text-foreground transition-colors">
            Team members
          </span>
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 transition-transform group-hover:scale-105">
            <UserCog size={17} strokeWidth={2} />
          </span>
        </div>
        <div className="mt-3.5 mb-1">
          <span className="num text-2xl sm:text-3xl lg:text-[2rem] font-bold tracking-tight text-foreground leading-none">
            {teamMembersCount}
          </span>
        </div>
        <p className="text-xs font-medium text-muted-foreground">
          Roles &amp; permissions
        </p>
      </Link>

      {/* 3. Active Cases */}
      <Link
        to="/cases"
        className="group flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-4.5 sm:p-5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        aria-label="Active cases: firm-wide"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="text-xs sm:text-sm font-semibold tracking-tight text-foreground/90 group-hover:text-foreground transition-colors">
            Active cases
          </span>
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 transition-transform group-hover:scale-105">
            <Briefcase size={17} strokeWidth={2} />
          </span>
        </div>
        <div className="mt-3.5 mb-1">
          <span className="num text-2xl sm:text-3xl lg:text-[2rem] font-bold tracking-tight text-foreground leading-none">
            {activeCasesCount}
          </span>
        </div>
        <p className="text-xs font-medium text-muted-foreground">
          Firm-wide
        </p>
      </Link>

      {/* 4. Clients */}
      <Link
        to="/clients"
        className="group flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-4.5 sm:p-5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        aria-label="Clients: on record"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="text-xs sm:text-sm font-semibold tracking-tight text-foreground/90 group-hover:text-foreground transition-colors">
            Clients
          </span>
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 transition-transform group-hover:scale-105">
            <Users size={17} strokeWidth={2} />
          </span>
        </div>
        <div className="mt-3.5 mb-1">
          <span className="num text-2xl sm:text-3xl lg:text-[2rem] font-bold tracking-tight text-foreground leading-none">
            {clientsCount}
          </span>
        </div>
        <p className="text-xs font-medium text-muted-foreground">
          On record
        </p>
      </Link>

      {/* 5. Docs Approved */}
      <Link
        to="/documents"
        className="group flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-4.5 sm:p-5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        aria-label="Documents approved: last 30 days"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="text-xs sm:text-sm font-semibold tracking-tight text-foreground/90 group-hover:text-foreground transition-colors">
            Docs approved
          </span>
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 transition-transform group-hover:scale-105">
            <FileText size={17} strokeWidth={2} />
          </span>
        </div>
        <div className="mt-3.5 mb-1">
          <span className="num text-2xl sm:text-3xl lg:text-[2rem] font-bold tracking-tight text-foreground leading-none">
            {docsApprovedCount}
          </span>
        </div>
        <p className="text-xs font-medium text-muted-foreground">
          {periodHint}
        </p>
      </Link>

      {/* 6. Audit Events */}
      <Link
        to="/admin/audit-logs"
        className="group flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-4.5 sm:p-5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        aria-label="Audit events: recent actions"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="text-xs sm:text-sm font-semibold tracking-tight text-foreground/90 group-hover:text-foreground transition-colors">
            Audit events
          </span>
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 transition-transform group-hover:scale-105">
            <ScrollText size={17} strokeWidth={2} />
          </span>
        </div>
        <div className="mt-3.5 mb-1">
          <span className="num text-2xl sm:text-3xl lg:text-[2rem] font-bold tracking-tight text-foreground leading-none">
            {auditEventsCount}
          </span>
        </div>
        <p className="text-xs font-medium text-muted-foreground">
          Recent
        </p>
      </Link>
    </div>
  );
}
