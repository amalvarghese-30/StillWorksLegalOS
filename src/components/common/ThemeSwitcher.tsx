import { Check, Palette } from "lucide-react";
import { useState } from "react";
import { useTheme, type VisualTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

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
        <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-primary text-primary-foreground">
          <Check size={9} strokeWidth={3} />
        </span>
      )}
    </div>
  );
}

/**
 * ThemeSwitcher — compact popover to switch between Blue and Sage visual themes.
 * Place in Topbar or AdminTopbar right-side controls.
 */
export function ThemeSwitcher({ className }: { className?: string }) {
  const { visualTheme, setVisualTheme } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Switch visual theme"
        aria-expanded={open}
        aria-haspopup="listbox"
        className="grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Palette size={18} strokeWidth={1.75} />
      </button>

      {open && (
        <>
          {/* backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          {/* popover */}
          <div
            className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-border bg-card p-2 shadow-lift scale-in"
            role="listbox"
            aria-label="Visual theme options"
          >
            <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Visual Theme
            </p>
            <ul className="space-y-1">
              {OPTIONS.map((opt) => {
                const active = visualTheme === opt.value;
                return (
                  <li key={opt.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        setVisualTheme(opt.value);
                        setOpen(false);
                      }}
                      className={cn(
                        "w-full rounded-lg px-2 py-2 text-left transition-colors duration-150 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active && "bg-primary/8",
                      )}
                    >
                      <ThemeSwatch option={opt} active={active} />
                      <div className="mt-1.5 px-0.5">
                        <p className="text-xs font-semibold text-foreground">{opt.label}</p>
                        <p className="text-[11px] text-muted-foreground">{opt.description}</p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
