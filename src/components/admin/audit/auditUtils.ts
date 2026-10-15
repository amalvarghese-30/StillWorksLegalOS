import React from "react";
import {
  LogIn,
  LogOut,
  PlusCircle,
  Edit,
  Trash2,
  CheckCircle2,
  XCircle,
  Upload,
  Download,
  KeyRound,
  Sliders,
  FileSpreadsheet,
  Database,
  Activity,
  Shield,
  FileText,
  Briefcase,
  Users,
  CheckSquare,
  Calendar,
  MessageSquare,
} from "lucide-react";

export function formatAuditIST(val: unknown, fallback = "—"): string {
  if (!val) return fallback;
  const d = val instanceof Date ? val : new Date(val as string | number);
  if (isNaN(d.getTime())) return fallback;

  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export function formatRelativeTime(val: unknown): string {
  if (!val) return "";
  const d = val instanceof Date ? val : new Date(val as string | number);
  if (isNaN(d.getTime())) return "";

  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return "";
}

export function parseDeviceClient(ua?: string): { browser: string; os: string; summary: string } {
  if (!ua || typeof ua !== "string") {
    return { browser: "Unknown", os: "Client", summary: "Unknown Client" };
  }

  let os = "Device";
  if (/windows/i.test(ua)) os = "Windows";
  else if (/macintosh|mac os x/i.test(ua)) os = "macOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  else if (/linux/i.test(ua)) os = "Linux";

  let browser = "Browser";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) browser = "Chrome";
  else if (/firefox\//i.test(ua)) browser = "Firefox";
  else if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) browser = "Safari";
  else if (/postman/i.test(ua)) browser = "Postman";
  else if (/node/i.test(ua)) browser = "Node.js";

  return { browser, os, summary: `${browser} · ${os}` };
}

export interface ActionBadgeStyle {
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  className: string;
}

export function getActionBadge(action: string): ActionBadgeStyle {
  const norm = (action || "").toLowerCase().trim();

  switch (norm) {
    case "create":
      return {
        label: "Create",
        icon: PlusCircle,
        className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      };
    case "update":
      return {
        label: "Update",
        icon: Edit,
        className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      };
    case "delete":
      return {
        label: "Delete",
        icon: Trash2,
        className: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
      };
    case "approve":
      return {
        label: "Approve",
        icon: CheckCircle2,
        className: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
      };
    case "reject":
      return {
        label: "Reject",
        icon: XCircle,
        className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      };
    case "login":
      return {
        label: "Login",
        icon: LogIn,
        className: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
      };
    case "logout":
      return {
        label: "Logout",
        icon: LogOut,
        className: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
      };
    case "upload":
      return {
        label: "Upload",
        icon: Upload,
        className: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
      };
    case "download":
      return {
        label: "Download",
        icon: Download,
        className: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
      };
    case "access_request":
      return {
        label: "Access Request",
        icon: KeyRound,
        className: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
      };
    case "settings_change":
      return {
        label: "Settings",
        icon: Sliders,
        className: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
      };
    case "report":
      return {
        label: "Report",
        icon: FileSpreadsheet,
        className: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
      };
    case "seed":
      return {
        label: "System Seed",
        icon: Database,
        className: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
      };
    default:
      return {
        label: action.replace(/_/g, " "),
        icon: Activity,
        className: "bg-muted text-muted-foreground border-border/60",
      };
  }
}

export function getResourceBadge(resource: string): {
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  className: string;
} {
  const norm = (resource || "").toLowerCase().trim();

  switch (norm) {
    case "task":
      return {
        label: "Task",
        icon: CheckSquare,
        className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      };
    case "case":
      return {
        label: "Case",
        icon: Briefcase,
        className: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
      };
    case "client":
      return {
        label: "Client",
        icon: Users,
        className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      };
    case "document":
      return {
        label: "Document",
        icon: FileText,
        className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      };
    case "auth":
      return {
        label: "Auth",
        icon: Shield,
        className: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
      };
    case "user":
      return {
        label: "Employee",
        icon: Users,
        className: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
      };
    case "calendar":
      return {
        label: "Calendar",
        icon: Calendar,
        className: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
      };
    case "chat":
      return {
        label: "Chat",
        icon: MessageSquare,
        className: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
      };
    case "settings":
      return {
        label: "Settings",
        icon: Sliders,
        className: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
      };
    case "approval":
      return {
        label: "Approval",
        icon: CheckCircle2,
        className: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
      };
    default:
      return {
        label: resource || "System",
        icon: Activity,
        className: "bg-muted text-muted-foreground border-border/60",
      };
  }
}
