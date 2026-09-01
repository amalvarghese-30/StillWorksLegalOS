import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useMemo, useState, } from "react";
const STORAGE_KEY = "stillworks.theme";
function getSystemTheme() {
    if (typeof window === "undefined")
        return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function readStoredTheme() {
    if (typeof window === "undefined")
        return "system";
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}
function applyTheme(resolved) {
    const root = document.documentElement;
    root.classList.toggle("dark", resolved === "dark");
    root.style.colorScheme = resolved; // native scrollbars & form controls
}
const ThemeContext = createContext(null);
export function ThemeProvider({ children }) {
    const [theme, setThemeState] = useState(readStoredTheme);
    const resolvedTheme = theme === "system" ? getSystemTheme() : theme;
    // Apply the resolved theme whenever it changes (and on first mount).
    useEffect(() => {
        applyTheme(resolvedTheme);
    }, [resolvedTheme]);
    // In "system" mode, follow OS changes live.
    useEffect(() => {
        if (theme !== "system")
            return;
        const mq = window.matchMedia("(prefers-color-scheme: dark)");
        const onChange = () => applyTheme(mq.matches ? "dark" : "light");
        mq.addEventListener("change", onChange);
        return () => mq.removeEventListener("change", onChange);
    }, [theme]);
    const value = useMemo(() => ({
        theme,
        resolvedTheme,
        setTheme: (next) => {
            setThemeState(next);
            window.localStorage.setItem(STORAGE_KEY, next);
        },
    }), [theme, resolvedTheme]);
    return _jsx(ThemeContext.Provider, { value: value, children: children });
}
export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx)
        throw new Error("useTheme must be used inside ThemeProvider");
    return ctx;
}
