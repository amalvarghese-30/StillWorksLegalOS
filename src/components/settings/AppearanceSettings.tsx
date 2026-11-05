import { Sun, Moon, Monitor, Check, Palette } from "lucide-react";
import { useTheme, type Theme, type VisualTheme } from "@/lib/theme";

const OPTIONS: {
  value: Theme;
  label: string;
  description: string;
  icon: typeof Sun;
}[] = [
  { value: "light", label: "Light", description: "Bright, airy and clean", icon: Sun },
  { value: "dark", label: "Dark", description: "Calm and easy on the eyes", icon: Moon },
  { value: "system", label: "System", description: "Match your OS setting", icon: Monitor },
];

const VISUAL_OPTIONS: {
  value: VisualTheme;
  label: string;
  badge: string;
  description: string;
  sidebarColor: string;
  mainColor: string;
  accentColor: string;
}[] = [
  {
    value: "blue",
    label: "Modern Blue",
    badge: "Professional",
    description: "Cool blue surfaces, royal blue accents, crisp modern contrast",
    sidebarColor: "#dbeafe",
    mainColor: "#f4f7fc",
    accentColor: "#0866e8",
  },
  {
    value: "sage",
    label: "Premium Sage",
    badge: "Forest Green",
    description: "Deep forest green sidebar, warm ivory canvas, organic luxury",
    sidebarColor: "#193324",
    mainColor: "#f6f4ec",
    accentColor: "#8aa875",
  },
];

function ThemePreview({ value }: { value: Theme }) {
  const isDark = value === "dark";
  const bg = isDark ? "var(--card)" : "#ffffff";
  const mutedBg = isDark ? "var(--muted)" : "var(--muted)";

  return (
    <div
      className="flex h-16 w-full items-end gap-1.5 rounded-lg border p-2"
      style={{ background: bg, borderColor: "var(--border)" }}
    >
      <div className="flex-1 rounded-sm" style={{ background: mutedBg, height: "60%" }} />
      <div className="h-[70%] w-1/3 rounded-sm" style={{ background: "var(--primary)" }} />
      <div
        className="h-6 w-6 shrink-0 rounded-full"
        style={{ background: "var(--gradient-primary)" }}
      />
    </div>
  );
}

function VisualThemePreview({
  sidebarColor,
  mainColor,
  accentColor,
}: {
  sidebarColor: string;
  mainColor: string;
  accentColor: string;
}) {
  return (
    <div
      className="flex h-20 w-full overflow-hidden rounded-lg border border-border"
      style={{ background: mainColor }}
    >
      <div
        className="w-1/4 shrink-0 flex flex-col justify-between p-1.5"
        style={{ background: sidebarColor }}
      >
        <div className="size-2 rounded-full" style={{ background: accentColor }} />
        <div className="space-y-1">
          <div className="h-1.5 w-full rounded" style={{ background: "rgba(255,255,255,0.2)" }} />
          <div className="h-1.5 w-3/4 rounded" style={{ background: "rgba(255,255,255,0.2)" }} />
        </div>
      </div>
      <div className="flex-1 p-2 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <div className="h-2 w-16 rounded bg-foreground/20" />
          <div className="size-3 rounded-full" style={{ background: accentColor }} />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="h-6 rounded bg-card/80 border border-border/40 p-1 flex items-center">
            <div className="h-1.5 w-8 rounded" style={{ background: accentColor }} />
          </div>
          <div className="h-6 rounded bg-card/80 border border-border/40 p-1 flex items-center">
            <div className="h-1.5 w-6 rounded bg-foreground/15" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppearanceSettings() {
  const { theme, setTheme, visualTheme, setVisualTheme } = useTheme();

  return (
    <div className="space-y-8 w-full min-w-0">
      {/* Visual Design Theme Selection */}
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <Palette size={18} className="text-primary" />
            <h3 className="text-helper font-medium">Design System & Visual Theme</h3>
          </div>
          <p className="mt-1 text-helper text-muted-foreground break-words">
            Switch between the client-approved Modern Blue and Premium Sage design aesthetics. All
            functions, data, and layouts remain completely identical.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full min-w-0">
          {VISUAL_OPTIONS.map((option) => {
            const active = visualTheme === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setVisualTheme(option.value)}
                aria-pressed={active}
                className={`group relative rounded-xl border p-4 text-left transition-all duration-150 touch-manipulation min-h-[44px] w-full min-w-0 ${
                  active
                    ? "border-primary bg-primary/5 shadow-soft ring-2 ring-primary"
                    : "border-border bg-card hover:border-primary/40 hover:bg-accent/40"
                }`}
              >
                {active && (
                  <span className="absolute right-3 top-3 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground z-10 shadow-xs">
                    <Check size={12} strokeWidth={2.5} />
                  </span>
                )}
                <VisualThemePreview
                  sidebarColor={option.sidebarColor}
                  mainColor={option.mainColor}
                  accentColor={option.accentColor}
                />
                <div className="mt-3.5 flex items-center justify-between">
                  <span className="font-semibold text-sm text-foreground">{option.label}</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {option.badge}
                  </span>
                </div>
                <span className="mt-1 block text-caption text-muted-foreground break-words">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Light / Dark Mode Preference */}
      <div className="space-y-4 pt-4 border-t border-border/60">
        <div>
          <h3 className="text-helper font-medium">Brightness Mode</h3>
          <p className="mt-1 text-helper text-muted-foreground break-words">
            Choose light or dark surface styling across your selected visual theme.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full min-w-0">
          {OPTIONS.map((option) => {
            const active = theme === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setTheme(option.value)}
                aria-pressed={active}
                className={`group relative rounded-xl border p-3.5 text-left transition-all duration-150 touch-manipulation min-h-[44px] w-full min-w-0 ${
                  active
                    ? "border-primary bg-primary/5 shadow-soft ring-1 ring-primary"
                    : "border-border bg-card hover:border-primary/40 hover:bg-accent/40"
                }`}
              >
                {active && (
                  <span className="absolute right-2.5 top-2.5 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Check size={12} strokeWidth={2.5} />
                  </span>
                )}
                <ThemePreview value={option.value} />
                <span className="mt-3 flex items-center gap-2">
                  <option.icon
                    size={16}
                    strokeWidth={1.75}
                    className="text-muted-foreground shrink-0"
                  />
                  <span className="font-medium text-sm text-foreground">{option.label}</span>
                </span>
                <span className="mt-0.5 block text-caption text-muted-foreground break-words">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
