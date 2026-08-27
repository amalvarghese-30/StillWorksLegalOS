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
} from "@/services/api";

export type Role = "admin" | "employee";

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
  permissions?: Record<string, boolean>;
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
  signIn: (email: string, password: string) => Promise<{ ok: true; user: SessionUser } | { ok: false; error: string }>;
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
          token = await refreshAccessToken();
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
            const msg =
              err.status === 401
                ? "Invalid email or password."
                : typeof err.body === "string"
                  ? err.body
                  : "Login failed. Please try again.";
            return { ok: false as const, error: msg };
          }
          return { ok: false as const, error: "Network error. Is the server running?" };
        }
      },
      signOut: async () => {
        try {
          await apiFetch("/auth/logout", { method: "POST" });
        } catch {
          /* Ignore — clear state regardless */
        }
        await clearTokens();
        setUser(null);
        window.localStorage.removeItem(STORAGE_KEY);
        // Clear all cached server data so the next login can't see another
        // user's chats/cases/documents (prevents cross-account leakage + 403s).
        queryClient.clear();
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