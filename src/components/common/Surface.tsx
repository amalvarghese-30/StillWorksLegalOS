import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function SectionCard({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl sm:rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-soft transition-shadow duration-200",
        className,
      )}
    >
      <header className="flex flex-col sm:grid sm:grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {Icon ? (
            <span className="grid size-9 sm:size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Icon size={19} strokeWidth={1.75} />
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="truncate text-base sm:text-title font-semibold">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-xs sm:text-helper text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {action ? <div className="w-full sm:w-auto shrink-0">{action}</div> : null}
      </header>
      <div className={cn("mt-4 sm:mt-5 min-w-0", bodyClassName)}>{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = false,
  to,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  accent?: boolean;
  to?: string;
}) {
  const content = (
    <article
      className={cn(
        "lift rounded-xl sm:rounded-2xl border p-3.5 sm:p-5 transition-all duration-200",
        to && "cursor-pointer group hover:border-primary/50 hover:shadow-lift",
        accent
          ? "gradient-primary border-transparent text-primary-foreground shadow-lift"
          : "border-border bg-card shadow-soft",
      )}
    >
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <p
          className={cn(
            "text-xs sm:text-helper font-medium transition-colors truncate",
            accent ? "opacity-90" : "text-muted-foreground group-hover:text-foreground",
          )}
        >
          {label}
        </p>
        <span
          className={cn(
            "grid size-8 sm:size-9 shrink-0 place-items-center rounded-lg transition-transform group-hover:scale-105",
            accent ? "bg-white/20" : "bg-primary/10 text-primary",
          )}
        >
          <Icon size={17} strokeWidth={1.75} />
        </span>
      </div>
      <p className="num mt-2 sm:mt-3 text-xl sm:text-page font-semibold tracking-tight truncate">{value}</p>
      {hint ? (
        <p className={cn("mt-0.5 sm:mt-1 text-[11px] sm:text-caption truncate", accent ? "opacity-85" : "text-muted-foreground")}>
          {hint}
        </p>
      ) : null}
    </article>
  );

  if (to) {
    return (
      <Link to={to} className="block rounded-xl sm:rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        {content}
      </Link>
    );
  }

  return content;
}

export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
}: {
  icon: LucideIcon;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-border bg-card/60 px-6 py-14 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon size={26} strokeWidth={1.75} />
      </span>
      <h3 className="mt-4 text-title font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-helper text-muted-foreground">{message}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
