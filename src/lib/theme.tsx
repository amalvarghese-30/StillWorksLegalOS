import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";
export type VisualTheme = "blue" | "sage";

const STORAGE_KEY = "stillworks.theme";
const VISUAL_THEME_KEY = "stillworks.visual_theme";
const VISUAL_THEME_CHANNEL = "stillworks_visual_theme_sync";

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  } catch {
    return "system";
  }
}

function readStoredVisualTheme(): VisualTheme {
  if (typeof window === "undefined") return "blue";
  try {
    const stored = window.localStorage.getItem(VISUAL_THEME_KEY);
    return stored === "blue" || stored === "sage" ? stored : "blue";
  } catch {
    return "blue";
  }
}

function applyTheme(resolved: ResolvedTheme): void {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved; // native scrollbars & form controls
}

function applyVisualTheme(vt: VisualTheme): void {
  document.documentElement.setAttribute("data-visual-theme", vt);
}

export function applyBrowserThemeColor(
  visualTheme: VisualTheme,
  resolvedTheme: ResolvedTheme,
): void {
  if (typeof document === "undefined") return;
  try {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    const color =
      visualTheme === "sage"
        ? resolvedTheme === "dark"
          ? "#122017"
          : "#F6F4EC"
        : resolvedTheme === "dark"
          ? "#172033"
          : "#F4F7FC";
    meta.setAttribute("content", color);
  } catch {
    /* ignore in non-DOM environments */
  }
}

interface ThemeValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  visualTheme: VisualTheme;
  setVisualTheme: (vt: VisualTheme) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);
  const [visualTheme, setVisualThemeState] = useState<VisualTheme>(readStoredVisualTheme);

  const resolvedTheme: ResolvedTheme = theme === "system" ? getSystemTheme() : theme;

  // Apply the resolved theme whenever it changes (and on first mount).
  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  // Apply visual theme on mount and whenever it changes.
  useEffect(() => {
    applyVisualTheme(visualTheme);
  }, [visualTheme]);

  // Synchronize browser theme-color meta tag
  useEffect(() => {
    applyBrowserThemeColor(visualTheme, resolvedTheme);
  }, [visualTheme, resolvedTheme]);

  // In "system" mode, follow OS changes live.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(mq.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  // Cross-tab visual theme sync via BroadcastChannel.
  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
    const channel = new BroadcastChannel(VISUAL_THEME_CHANNEL);
    const onMessage = (e: MessageEvent) => {
      const vt = e.data?.visualTheme;
      if (vt === "blue" || vt === "sage") {
        setVisualThemeState(vt);
        applyVisualTheme(vt);
      }
    };
    channel.addEventListener("message", onMessage);
    return () => {
      channel.removeEventListener("message", onMessage);
      channel.close();
    };
  }, []);

  const value = useMemo<ThemeValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme: (next) => {
        setThemeState(next);
        try {
          window.localStorage.setItem(STORAGE_KEY, next);
        } catch {
          /* ignore */
        }
      },
      visualTheme,
      setVisualTheme: (vt) => {
        setVisualThemeState(vt);
        try {
          window.localStorage.setItem(VISUAL_THEME_KEY, vt);
        } catch {
          /* ignore */
        }
        applyVisualTheme(vt);
        // Broadcast to other tabs
        try {
          if ("BroadcastChannel" in window) {
            const channel = new BroadcastChannel(VISUAL_THEME_CHANNEL);
            channel.postMessage({ visualTheme: vt });
            channel.close();
          }
        } catch {
          /* ignore */
        }
      },
    }),
    [theme, resolvedTheme, visualTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
