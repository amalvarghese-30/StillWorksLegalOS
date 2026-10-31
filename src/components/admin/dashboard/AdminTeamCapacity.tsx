import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, AlertTriangle, Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEmployeeWorkload } from "@/services/reports";
import { cn } from "@/lib/utils";
import { EmployeeAvatar } from "../EmployeeAvatar";

export function AdminTeamCapacity() {
  const navigate = useNavigate();
  const { data, isLoading, isError, isFetching, refetch } = useEmployeeWorkload();
  const workloads = data?.workloads ?? [];

  // Sort descending by workload percentage, or active work
  const sortedWorkloads = [...workloads].sort((a, b) => b.workload - a.workload);

  return (
    <section className="flex flex-col rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-soft transition-all duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-border/60">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-900/50 shadow-2xs">
            <Users size={18} strokeWidth={2} />
          </span>
          <div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
              Team capacity
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Current workload across team members.
            </p>
          </div>
        </div>
        <Link
          to="/reports"
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline transition-colors group shrink-0"
        >
          <span>View Full Report</span>
          <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* Capacity Content */}
      <div className="mt-4 flex-1">
        {isLoading ? (
          <div className="space-y-4 py-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-2 animate-pulse">
                <div className="flex justify-between">
                  <div className="h-4 w-32 rounded bg-muted/60" />
                  <div className="h-4 w-10 rounded bg-muted/60" />
                </div>
                <div className="h-3 w-20 rounded bg-muted/40" />
                <div className="h-1.5 w-full rounded bg-muted/40" />
              </div>
            ))}
          </div>
        ) : isError && !data ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <AlertTriangle className="size-8 text-destructive/80 mb-2" />
            <p className="text-sm font-semibold text-foreground">Couldn't load team capacity</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Unable to aggregate employee workloads.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="mt-4 rounded-md"
            >
              {isFetching ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : null}
              {isFetching ? "Retrying..." : "Retry"}
            </Button>
          </div>
        ) : sortedWorkloads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 mb-3">
              <Users size={24} strokeWidth={1.75} />
            </div>
            <p className="text-sm font-semibold text-foreground">No team members found</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Add employees to track firm-wide capacity.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {isError && (
              <div className="mb-2 flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-700 dark:text-amber-300">
                <span>Sync failed. Showing cached capacity.</span>
                <button
                  type="button"
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="font-medium underline hover:text-amber-900 dark:hover:text-amber-100"
                >
                  {isFetching ? "Retrying..." : "Retry"}
                </button>
              </div>
            )}
            <ul className="space-y-3.5">
            {sortedWorkloads.slice(0, 6).map((emp) => {
              const initials = emp.name
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((n) => n[0].toUpperCase())
                .join("");

              const activeCases = emp.activeCases ?? 0;
              const openTasks = emp.pendingTasks ?? 0;
              const workloadPct = Math.min(100, Math.max(0, Math.round(emp.workload)));

              return (
                <li
                  key={emp._id}
                  onClick={() =>
                    navigate({
                      to: "/admin/employees",
                      search: { employeeId: emp._id },
                    })
                  }
                  className="group rounded-xl p-2 -mx-2 transition-all hover:bg-muted/40 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  tabIndex={0}
                  role="button"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate({
                        to: "/admin/employees",
                        search: { employeeId: emp._id },
                      });
                    }
                  }}
                  aria-label={`View ${emp.name}'s profile and workload`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <EmployeeAvatar
                        name={emp.name}
                        avatarUrl={emp.avatarUrl}
                        size="xs"
                        className="shrink-0"
                      />
                      <p className="truncate text-xs sm:text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                        {emp.name}
                      </p>
                    </div>
                    <span className="num text-xs font-bold text-foreground shrink-0 font-mono">
                      {workloadPct}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-1 pl-9">
                    <span className="capitalize text-[11px] font-medium text-muted-foreground truncate">
                      {emp.role.replace(/_/g, " ")}
                    </span>
                    <span className="text-[11px] text-muted-foreground/80 shrink-0">
                      {activeCases} {activeCases === 1 ? "case" : "cases"} · {openTasks} {openTasks === 1 ? "task" : "tasks"}
                    </span>
                  </div>

                  {/* Sleek Horizontal Capacity Bar */}
                  <div className="mt-1.5 pl-9">
                    <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          workloadPct >= 100
                            ? "bg-amber-600 dark:bg-amber-500"
                            : workloadPct >= 80
                            ? "bg-indigo-600 dark:bg-indigo-500"
                            : "bg-blue-600 dark:bg-blue-500"
                        )}
                        style={{ width: `${workloadPct}%` }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      </div>

      {/* Footer Info */}
      <div className="mt-4 pt-3 border-t border-border/50 text-[11px] text-muted-foreground/75 flex items-center justify-between">
        <span>Capacity: cases (12%) &amp; tasks (8%)</span>
        <Link
          to="/admin/employees"
          className="hover:text-foreground hover:underline transition-colors font-medium inline-flex items-center gap-1"
        >
          <span>View all employees</span>
          <ArrowRight size={12} />
        </Link>
      </div>
    </section>
  );
}
