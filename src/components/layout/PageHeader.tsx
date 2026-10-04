import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  breadcrumb,
  title,
  subtitle,
  actions,
  className,
}: {
  breadcrumb: { label: string; to?: string }[];
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-4 sm:mb-6 lg:mb-8", className)}>
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-[11px] sm:text-caption">
        {breadcrumb.map((crumb, i) => (
          <span key={crumb.label} className="flex items-center gap-1">
            {i > 0 ? (
              <ChevronRight size={13} strokeWidth={1.75} className="text-muted-foreground/60" />
            ) : null}
            {crumb.to ? (
              <Link
                to={crumb.to}
                className="rounded-sm px-1 py-0.5 text-muted-foreground transition-colors duration-150 hover:text-foreground"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className="px-1 py-0.5 text-muted-foreground/80">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>
      <div className="mt-2.5 sm:mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-page font-semibold tracking-tight leading-tight">{title}</h1>
          {subtitle ? (
            <p className="mt-1 max-w-2xl text-xs sm:text-sm lg:text-body text-muted-foreground leading-normal">{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div> : null}
      </div>
    </header>
  );
}
