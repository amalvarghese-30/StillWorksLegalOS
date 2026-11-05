import { Check, Palette } from "lucide-react";
import { useTheme, type VisualTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ThemeOption {
  value: VisualTheme;
  label: string;
  description: string;
  /** sidebar swatch color */
  sidebarColor: string;
  /** main area swatch color */
  mainColor: string;
}

const OPTIONS: ThemeOption[] = [
  {
    value: "blue",
    label: "Modern Blue",
    description: "Professional & clean",
    sidebarColor: "#dbeafe",
    mainColor: "#f4f7fc",
  },
  {
    value: "sage",
    label: "Premium Sage",
    description: "Forest green & warm",
    sidebarColor: "#1b3d28",
    mainColor: "#f6f4ec",
  },
];

function ThemeSwatch({ option, active }: { option: ThemeOption; active: boolean }) {
  return (
    <div
      className={cn(
        "relative flex overflow-hidden rounded-lg border-2 transition-all duration-200",
        active ? "border-primary shadow-soft" : "border-border hover:border-primary/40",
      )}
      style={{ height: 44 }}
    >
      {/* Sidebar strip */}
      <div className="shrink-0" style={{ width: 14, background: option.sidebarColor }} />
      {/* Main area */}
      <div className="flex-1" style={{ background: option.mainColor }} />
      {active && (
        <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-primary text-primary-foreground shadow-2xs">
          <Check size={9} strokeWidth={3} />
        </span>
      )}
    </div>
  );
}

/**
 * ThemeSwitcher — Accessible Radix DropdownMenu to switch between Blue and Sage visual themes.
 * Supports arrow keys, Enter/Space, Escape, click-outside, and screen-reader semantics.
 */
export function ThemeSwitcher({ className }: { className?: string }) {
  const { visualTheme, setVisualTheme } = useTheme();

  return (
    <div className={cn("relative inline-flex", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Switch visual theme (currently ${visualTheme === "sage" ? "Premium Sage" : "Modern Blue"})`}
            title={`Theme: ${visualTheme === "sage" ? "Premium Sage" : "Modern Blue"}`}
            className="grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Palette size={18} strokeWidth={1.75} />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="w-56 rounded-xl border border-border bg-card p-2 shadow-lift"
          role="radiogroup"
          aria-label="Select visual theme"
        >
          <DropdownMenuLabel className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Visual Theme
          </DropdownMenuLabel>
          <div className="space-y-1">
            {OPTIONS.map((opt) => {
              const active = visualTheme === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setVisualTheme(opt.value)}
                  className={cn(
                    "w-full rounded-lg px-2 py-2 text-left transition-colors duration-150 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
                    active && "bg-primary/8 ring-1 ring-primary/30",
                  )}
                >
                  <ThemeSwatch option={opt} active={active} />
                  <div className="mt-1.5 px-0.5">
                    <p className="text-xs font-semibold text-foreground flex items-center justify-between">
                      <span>{opt.label}</span>
                      {active && (
                        <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                          Active
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{opt.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
