import { Gavel, Calendar, ArrowRight, Loader2, Clock } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import type { CalendarEvent } from "@/services/calendar";
import { formatSafeDateTime } from "@/lib/dates";

interface TodaysHearingsCardProps {
  hearings: CalendarEvent[];
  isLoading?: boolean;
}

export function TodaysHearingsCard({ hearings, isLoading = false }: TodaysHearingsCardProps) {
  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/40">
            <Gavel size={18} strokeWidth={2} />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Today's hearings</h2>
            <p className="text-xs text-muted-foreground">Your schedule in court today</p>
          </div>
        </div>
        <Link
          to="/calendar"
          className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 transition-colors"
        >
          View calendar <ArrowRight size={13} strokeWidth={2} />
        </Link>
      </div>

      {/* Body */}
      <div className="mt-3.5 flex-1 min-w-0 flex flex-col justify-center">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="animate-spin text-muted-foreground" size={20} />
          </div>
        ) : hearings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4 rounded-lg border border-dashed border-border/70 bg-muted/20">
            <span className="grid size-12 place-items-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/50 dark:border-blue-900/40 mb-3">
              <Calendar size={22} strokeWidth={1.75} />
            </span>
            <p className="text-sm font-semibold text-foreground">
              No hearings scheduled for today.
            </p>
            <p className="mt-1 text-xs text-muted-foreground max-w-[280px]">
              Enjoy your day! You can check upcoming hearings in the calendar.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {hearings.map((h) => {
              const startDate = new Date(h.start);
              const timeString = isNaN(startDate.getTime())
                ? "All day"
                : startDate.toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  });

              return (
                <div
                  key={h._id}
                  onClick={() => navigate({ to: "/calendar" })}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate({ to: "/calendar" });
                    }
                  }}
                  className="group flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/50 hover:bg-muted/40 p-3 transition-all duration-150 hover:border-primary/30 cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                      <Clock size={16} strokeWidth={2} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs sm:text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                        {h.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground truncate">
                        {h.description || "Court Hearing"}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-semibold">
                    {timeString}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
