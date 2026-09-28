import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  apiFetch,
  persistTokens,
  clearTokens,
  getAccessToken,
  refreshAccessToken,
  clientTypeHeaders,
  ApiError,
  isElectron,
} from "@/services/api";

export type Role = "admin" | "employee";

export interface UserPermissions {
  employees?: boolean;
  approvals?: boolean;
  auditLogs?: boolean;
  settings?: boolean;
  dashboard?: boolean;
  cases?: boolean;
  clients?: boolean;
  tasks?: boolean;
  documents?: boolean;
  calendar?: boolean;
  chat?: boolean;
  reports?: boolean;
  [key: string]: boolean | undefined;
}

export interface SessionUser {
  _id: string;
  name: string;
  email: string;
  role: Role;
  initials: string;
  title: string;
  avatarUrl?: string;
  phone?: string;
  status?: string;
  permissions?: UserPermissions;
  // Firm details
  firmName?: string;
  firmBarRegistration?: string;
  firmPrimaryCourt?: string;
  firmAddress?: string;
  firmLogoUrl?: string;
  // Notification preferences
  notifyHearingReminders?: boolean;
  notifyApprovalRequests?: boolean;
  notifyCallReminders?: boolean;
  notifyDailyDigest?: boolean;
  // Security preferences
  securityTwoFactor?: boolean;
  securitySessionTimeout?: boolean;
  securityLoginAlerts?: boolean;
}

const STORAGE_KEY = "stillworks.session";

/** Derive initials from a name string, skipping common title prefixes. */
function initials(name: string): string {
  const parts = name.split(/\s+/).filter((p) => !["Adv.", "Mr.", "Mrs.", "Ms.", "Dr.", "Shri", "Smt."].includes(p));
  return parts
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();
}

type RawUser = Record<string, unknown>;

function toSessionUser(apiUser: RawUser): SessionUser {
  const nameVal = typeof apiUser["name"] === "string" ? apiUser["name"] : "Unknown";
  const roleStr = typeof apiUser["role"] === "string" ? apiUser["role"] : "employee";
  const perms = apiUser["permissions"];
  return {
    _id: typeof apiUser["_id"] === "string" ? apiUser["_id"] : "",
    name: nameVal,
    email: typeof apiUser["email"] === "string" ? apiUser["email"] : "",
    role: (roleStr === "admin" ? "admin" : "employee") as Role,
    initials: initials(nameVal),
    title: typeof apiUser["title"] === "string" ? apiUser["title"] : "",
    ...(typeof apiUser["avatarUrl"] === "string" ? { avatarUrl: apiUser["avatarUrl"] } : {}),
    ...(typeof apiUser["phone"] === "string" ? { phone: apiUser["phone"] } : {}),
    ...(typeof apiUser["status"] === "string" ? { status: apiUser["status"] } : {}),
    ...(perms && typeof perms === "object" ? { permissions: perms as Record<string, boolean> } : {}),
    // Firm details
    ...(typeof apiUser["firmName"] === "string" ? { firmName: apiUser["firmName"] } : {}),
    ...(typeof apiUser["firmBarRegistration"] === "string" ? { firmBarRegistration: apiUser["firmBarRegistration"] } : {}),
    ...(typeof apiUser["firmPrimaryCourt"] === "string" ? { firmPrimaryCourt: apiUser["firmPrimaryCourt"] } : {}),
    ...(typeof apiUser["firmAddress"] === "string" ? { firmAddress: apiUser["firmAddress"] } : {}),
    ...(typeof apiUser["firmLogoUrl"] === "string" ? { firmLogoUrl: apiUser["firmLogoUrl"] } : {}),
    // Notification preferences
    ...(typeof apiUser["notifyHearingReminders"] === "boolean" ? { notifyHearingReminders: apiUser["notifyHearingReminders"] } : {}),
    ...(typeof apiUser["notifyApprovalRequests"] === "boolean" ? { notifyApprovalRequests: apiUser["notifyApprovalRequests"] } : {}),
    ...(typeof apiUser["notifyCallReminders"] === "boolean" ? { notifyCallReminders: apiUser["notifyCallReminders"] } : {}),
    ...(typeof apiUser["notifyDailyDigest"] === "boolean" ? { notifyDailyDigest: apiUser["notifyDailyDigest"] } : {}),
    // Security preferences
    ...(typeof apiUser["securityTwoFactor"] === "boolean" ? { securityTwoFactor: apiUser["securityTwoFactor"] } : {}),
    ...(typeof apiUser["securitySessionTimeout"] === "boolean" ? { securitySessionTimeout: apiUser["securitySessionTimeout"] } : {}),
    ...(typeof apiUser["securityLoginAlerts"] === "boolean" ? { securityLoginAlerts: apiUser["securityLoginAlerts"] } : {}),
  };
}

interface AuthValue {
  user: SessionUser | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<{ ok: true; user: SessionUser } | { ok: false; error: string; field?: "email" | "password" | undefined }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const queryClient = useQueryClient();

  // On mount, restore the session. The access token is in-memory only, so on a
  // fresh load we first refresh from the httpOnly cookie (web) or safeStorage
  // vault (Electron), then validate by fetching /me.
  useEffect(() => {
    const init = async () => {
      try {
        let token = getAccessToken();
        if (!token) {
          const hasSessionHint = isElectron() || !!window.localStorage.getItem(STORAGE_KEY);
          if (hasSessionHint) {
            token = await refreshAccessToken();
          }
        }
        if (!token) {
          setReady(true);
          return;
        }
        const res = await apiFetch<{ user: RawUser }>("/auth/me");
        const sessionUser = toSessionUser(res.user);
        setUser(sessionUser);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionUser));
      } catch {
        // Token is invalid or expired — clear everything
        await clearTokens();
        window.localStorage.removeItem(STORAGE_KEY);
      }
      setReady(true);
    };
    init();
  }, []);

  // 30-minute idle inactivity timeout when securitySessionTimeout is enabled (default on)
  useEffect(() => {
    if (!user || user.securitySessionTimeout === false) return;

    const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
    let timeoutId: ReturnType<typeof setTimeout>;

    const handleTimeout = async () => {
      setUser(null);
      window.localStorage.removeItem(STORAGE_KEY);
      await clearTokens();
      queryClient.cancelQueries();
      queryClient.clear();
      try {
        await apiFetch("/auth/logout", { method: "POST" });
      } catch {
        /* ignore */
      }
      window.dispatchEvent(new CustomEvent("session-expired", { detail: { reason: "inactivity" } }));
    };

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleTimeout, INACTIVITY_TIMEOUT_MS);
    };

    const activityEvents = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "wheel"];
    activityEvents.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      activityEvents.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, [user, queryClient]);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      ready,
      signIn: async (email, password) => {
        try {
          const res = await apiFetch<{ accessToken: string; refreshToken?: string; user: RawUser }>("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
            headers: clientTypeHeaders(),
          });

          await persistTokens(res.accessToken, res.refreshToken);

          const sessionUser = toSessionUser(res.user);
          setUser(sessionUser);
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionUser));
          return { ok: true as const, user: sessionUser };
        } catch (err) {
          if (err instanceof ApiError) {
            const errBody = err.body && typeof err.body === "object" ? (err.body as Record<string, unknown>) : null;
            const fieldVal = errBody ? errBody["field"] : null;
            const field = fieldVal === "email" || fieldVal === "password" ? fieldVal : undefined;
            const msg =
              errBody && typeof errBody["message"] === "string"
                ? String(errBody["message"])
                : err.status === 401
                  ? "Invalid email or password."
                  : typeof err.body === "string"
                    ? err.body
                    : "Login failed. Please try again.";
            return { ok: false as const, error: msg, field };
          }
          return { ok: false as const, error: "Network error. Is the server running?" };
        }
      },
      signOut: async () => {
        // 1. Clear local session immediately so React components unmount & stop querying
        setUser(null);
        window.localStorage.removeItem(STORAGE_KEY);
        await clearTokens();

        // 2. Cancel all pending in-flight queries and clear cache
        queryClient.cancelQueries();
        queryClient.clear();

        // 3. Notify the server to revoke the session in DB & clear the refresh cookie
        try {
          await apiFetch("/auth/logout", { method: "POST" });
        } catch {
          /* Ignore — local session is already cleared */
        }
      },
    }),
    [user, ready, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}