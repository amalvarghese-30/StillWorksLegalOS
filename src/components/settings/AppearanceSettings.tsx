import { Sun, Moon, Monitor, Check } from "lucide-react";
import { useTheme, type Theme } from "@/lib/theme";

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

function ThemePreview({ value }: { value: Theme }) {
  const isDark = value === "dark";
  const bg = isDark ? "var(--card)" : "#ffffff";
  const fg = isDark ? "var(--foreground)" : "var(--foreground)";
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

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-helper font-medium">Theme</h3>
        <p className="mt-1 text-helper text-muted-foreground">
          Choose how StillWorks looks across the whole app. Your choice is saved on this device.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {OPTIONS.map((option) => {
          const active = theme === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setTheme(option.value)}
              aria-pressed={active}
              className={`group relative rounded-xl border p-3 text-left transition-all duration-150 ${
                active
                  ? "border-primary bg-primary/5 shadow-soft ring-1 ring-primary"
                  : "border-border bg-card hover:border-primary/40 hover:bg-accent/40"
              }`}
            >
              {active && (
                <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Check size={12} strokeWidth={2.5} />
                </span>
              )}
              <ThemePreview value={option.value} />
              <span className="mt-3 flex items-center gap-2">
                <option.icon size={16} strokeWidth={1.75} className="text-muted-foreground" />
                <span className="font-medium">{option.label}</span>
              </span>
              <span className="mt-0.5 block text-caption text-muted-foreground">
                {option.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
