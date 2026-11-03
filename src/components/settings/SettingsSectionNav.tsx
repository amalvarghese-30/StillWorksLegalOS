import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SettingsTabItem<T extends string = string> {
  id: T;
  label: string;
  icon: LucideIcon;
  badge?: number | string | null;
}

interface SettingsSectionNavProps<T extends string = string> {
  tabs: readonly SettingsTabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  ariaLabel?: string;
  className?: string;
}

/**
 * SettingsSectionNav — Responsive navigation selector for Settings
 * - Mobile (<640px): Compact 2-column grid. All categories visible immediately (no horizontal scrollbar).
 * - Tablet (640px-1023px): 4-column responsive grid above settings content card.
 * - Desktop (>=1024px): Vertical sidebar navigation inside 240px column.
 * - Minimum touch target of >= 44px across all breakpoints.
 */
export function SettingsSectionNav<T extends string = string>({
  tabs,
  active,
  onChange,
  ariaLabel = "Settings navigation",
  className,
}: SettingsSectionNavProps<T>) {
  return (
    <nav aria-label={ariaLabel} className={cn("w-full min-w-0", className)}>
      <ul
        className={cn(
          "grid grid-cols-2 sm:grid-cols-4 lg:flex lg:flex-col",
          "gap-1.5 sm:gap-2 lg:gap-1.5",
          "rounded-xl border border-border/80 bg-card p-1.5 sm:p-2 shadow-soft",
          "w-full min-w-0"
        )}
      >
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          const Icon = tab.icon;
          return (
            <li key={tab.id} className="min-w-0 w-full">
              <button
                type="button"
                onClick={() => onChange(tab.id)}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "flex min-h-[44px] w-full items-center gap-2 sm:gap-2.5 rounded-lg px-2.5 sm:px-3 py-2",
                  "text-xs sm:text-helper font-medium transition-all duration-150 select-none touch-manipulation",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                  isActive
                    ? "bg-primary/12 text-primary font-semibold shadow-xs border border-primary/25 dark:border-primary/30"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground active:scale-[0.98] border border-transparent"
                )}
              >
                <Icon
                  size={17}
                  strokeWidth={isActive ? 2.25 : 1.75}
                  className={cn(
                    "shrink-0 transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  )}
                />
                <span className="truncate text-left flex-1 leading-tight">{tab.label}</span>
                {tab.badge !== undefined && tab.badge !== null && (
                  <span
                    className={cn(
                      "ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none shrink-0",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
