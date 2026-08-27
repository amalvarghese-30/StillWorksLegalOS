import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
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
        "rounded-lg border border-border bg-card p-6 shadow-soft transition-shadow duration-200",
        className,
      )}
    >
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {Icon ? (
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <Icon size={20} strokeWidth={1.75} />
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="truncate text-title font-semibold">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-helper text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {action}
      </header>
      <div className={cn("mt-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  accent?: boolean;
}) {
  return (
    <article
      className={cn(
        "lift rounded-lg border p-6",
        accent
          ? "gradient-primary border-transparent text-primary-foreground shadow-lift"
          : "border-border bg-card shadow-soft",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p
          className={cn(
            "text-helper font-medium",
            accent ? "opacity-90" : "text-muted-foreground",
          )}
        >
          {label}
        </p>
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-md",
            accent ? "bg-white/20" : "bg-primary/10 text-primary",
          )}
        >
          <Icon size={18} strokeWidth={1.75} />
        </span>
      </div>
      <p className="num mt-4 text-page font-semibold tracking-tight">{value}</p>
      {hint ? (
        <p className={cn("mt-1 text-caption", accent ? "opacity-85" : "text-muted-foreground")}>
          {hint}
        </p>
      ) : null}
    </article>
  );
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
