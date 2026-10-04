import { useRef, useEffect } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MobileSectionItem<T extends string = string> {
  id: T;
  label: string;
  icon: LucideIcon;
  badge?: number | string | null;
}

interface MobileSectionNavProps<T extends string = string> {
  sections: readonly MobileSectionItem<T>[];
  active: T;
  onChange: (id: T) => void;
  ariaLabel?: string;
  className?: string;
}

export function MobileSectionNav<T extends string = string>({
  sections,
  active,
  onChange,
  ariaLabel = "Sections navigation",
  className,
}: MobileSectionNavProps<T>) {
  const containerRef = useRef<HTMLUListElement>(null);
  const activeBtnRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll the active tab into view smoothly on mobile
  useEffect(() => {
    if (activeBtnRef.current && containerRef.current) {
      const container = containerRef.current;
      const btn = activeBtnRef.current;

      const btnLeft = btn.offsetLeft;
      const btnRight = btnLeft + btn.offsetWidth;
      const scrollLeft = container.scrollLeft;
      const visibleWidth = container.clientWidth;

      if (btnLeft < scrollLeft) {
        container.scrollTo({ left: btnLeft - 16, behavior: "smooth" });
      } else if (btnRight > scrollLeft + visibleWidth) {
        container.scrollTo({ left: btnRight - visibleWidth + 16, behavior: "smooth" });
      }
    }
  }, [active]);

  return (
    <nav aria-label={ariaLabel} className={cn("lg:sticky lg:top-28 lg:self-start", className)}>
      <ul
        ref={containerRef}
        className="flex gap-1.5 overflow-x-auto no-scrollbar touch-scroll rounded-xl border border-border/80 bg-card p-1.5 sm:p-2 shadow-soft lg:flex-col lg:overflow-visible"
      >
        {sections.map((s) => {
          const isActive = active === s.id;
          return (
            <li key={s.id} className="shrink-0 lg:shrink">
              <button
                ref={isActive ? activeBtnRef : undefined}
                type="button"
                onClick={() => onChange(s.id)}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "flex min-h-10 sm:min-h-11 w-full items-center gap-2 sm:gap-2.5 rounded-lg px-3 py-2 text-xs sm:text-helper font-medium transition-all duration-150 select-none whitespace-nowrap",
                  isActive
                    ? "bg-primary/12 text-primary font-semibold shadow-xs"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground active:scale-[0.98]"
                )}
              >
                <s.icon size={17} strokeWidth={isActive ? 2 : 1.75} className="shrink-0" />
                <span>{s.label}</span>
                {s.badge !== undefined && s.badge !== null && (
                  <span
                    className={cn(
                      "ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {s.badge}
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
