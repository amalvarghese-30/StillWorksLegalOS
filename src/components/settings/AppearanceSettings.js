import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Sun, Moon, Monitor, Check } from "lucide-react";
import { useTheme } from "@/lib/theme";
const OPTIONS = [
    { value: "light", label: "Light", description: "Bright, airy and clean", icon: Sun },
    { value: "dark", label: "Dark", description: "Calm and easy on the eyes", icon: Moon },
    { value: "system", label: "System", description: "Match your OS setting", icon: Monitor },
];
function ThemePreview({ value }) {
    const isDark = value === "dark";
    const bg = isDark ? "var(--card)" : "#ffffff";
    const fg = isDark ? "var(--foreground)" : "var(--foreground)";
    const mutedBg = isDark ? "var(--muted)" : "var(--muted)";
    return (_jsxs("div", { className: "flex h-16 w-full items-end gap-1.5 rounded-lg border p-2", style: { background: bg, borderColor: "var(--border)" }, children: [_jsx("div", { className: "flex-1 rounded-sm", style: { background: mutedBg, height: "60%" } }), _jsx("div", { className: "h-[70%] w-1/3 rounded-sm", style: { background: "var(--primary)" } }), _jsx("div", { className: "h-6 w-6 shrink-0 rounded-full", style: { background: "var(--gradient-primary)" } })] }));
}
export function AppearanceSettings() {
    const { theme, setTheme } = useTheme();
    return (_jsxs("div", { className: "space-y-5", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-helper font-medium", children: "Theme" }), _jsx("p", { className: "mt-1 text-helper text-muted-foreground", children: "Choose how StillWorks looks across the whole app. Your choice is saved on this device." })] }), _jsx("div", { className: "grid gap-3 sm:grid-cols-3", children: OPTIONS.map((option) => {
                    const active = theme === option.value;
                    return (_jsxs("button", { type: "button", onClick: () => setTheme(option.value), "aria-pressed": active, className: `group relative rounded-xl border p-3 text-left transition-all duration-150 ${active
                            ? "border-primary bg-primary/5 shadow-soft ring-1 ring-primary"
                            : "border-border bg-card hover:border-primary/40 hover:bg-accent/40"}`, children: [active && (_jsx("span", { className: "absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground", children: _jsx(Check, { size: 12, strokeWidth: 2.5 }) })), _jsx(ThemePreview, { value: option.value }), _jsxs("span", { className: "mt-3 flex items-center gap-2", children: [_jsx(option.icon, { size: 16, strokeWidth: 1.75, className: "text-muted-foreground" }), _jsx("span", { className: "font-medium", children: option.label })] }), _jsx("span", { className: "mt-0.5 block text-caption text-muted-foreground", children: option.description })] }, option.value));
                }) })] }));
}
