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
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-8", className)}>
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-caption">
        {breadcrumb.map((crumb, i) => (
          <span key={crumb.label} className="flex items-center gap-1">
            {i > 0 ? (
              <ChevronRight size={14} strokeWidth={1.75} className="text-muted-foreground/60" />
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
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          <h1 className="text-page font-semibold tracking-tight">{title}</h1>
          {subtitle ? (
            <p className="mt-1.5 max-w-2xl text-body text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
