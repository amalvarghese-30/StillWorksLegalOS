import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  CheckSquare,
  FolderClosed,
  CalendarDays,
  MessageCircle,
  BarChart3,
  ShieldCheck,
  ShieldAlert,
  UserCog,
  ScrollText,
  Settings,
  Scale,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

const primary = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true, permission: "dashboard" as const },
  { to: "/cases", label: "Cases", icon: Briefcase, permission: "cases" as const },
  { to: "/clients", label: "Clients", icon: Users, permission: "clients" as const },
  { to: "/tasks", label: "Tasks", icon: CheckSquare, permission: "tasks" as const },
  { to: "/documents", label: "Documents", icon: FolderClosed, permission: "documents" as const },
  { to: "/calendar", label: "Calendar", icon: CalendarDays, permission: "calendar" as const },
  { to: "/chat", label: "Chat", icon: MessageCircle, permission: "chat" as const },
  { to: "/reports", label: "Reports", icon: BarChart3, permission: "reports" as const },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const visiblePrimary = primary.filter((item) => {
    if (user?.role === "admin") return true;
    if (!user?.permissions) return true;
    return (user.permissions as any)[item.permission] !== false;
  });

  const hasAnyAdminPerm =
    user?.role === "admin" ||
    !!(
      user?.permissions?.employees ||
      user?.permissions?.approvals ||
      user?.permissions?.auditLogs ||
      user?.permissions?.settings
    );

  const canEmployees = user?.role === "admin" || user?.permissions?.employees === true;
  const canApprovals = user?.role === "admin" || user?.permissions?.approvals === true;
  const canAudit = user?.role === "admin" || user?.permissions?.auditLogs === true;
  const canSettings = user?.role === "admin" || user?.permissions?.settings === true;

  const renderItem = (item: {
    to: string;
    label: string;
    icon: React.ComponentType<{ size?: number | string; strokeWidth?: number | string; className?: string }>;
    exact?: boolean;
    permission?: string;
  }) => {
    const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
    return (
      <li key={item.to}>
        <Link
          to={item.to}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={cn(
            "group flex min-h-11 items-center gap-3 rounded-md px-3.5 py-2.5 text-helper font-medium transition-all duration-200",
            active
              ? "gradient-primary text-primary-foreground shadow-soft"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          <item.icon size={19} strokeWidth={1.75} className="shrink-0" />
          <span className="truncate">{item.label}</span>
        </Link>
      </li>
    );
  };

  return (
    <div className="glass flex h-full w-[290px] flex-col rounded-2xl p-4">
      <div className="flex items-center gap-3 px-2 py-3">
        <span className="gradient-primary grid size-11 shrink-0 place-items-center rounded-md text-primary-foreground shadow-soft">
          <Scale size={21} strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-body font-semibold">S &amp; S Associates</p>
          <p className="truncate text-caption text-muted-foreground">Legal-Tech LLP</p>
        </div>
      </div>

      <nav className="mt-3 flex-1 overflow-y-auto pr-1" aria-label="Main">
        <ul className="space-y-1">{visiblePrimary.map(renderItem)}</ul>
        {hasAnyAdminPerm ? (
          <>
            <p className="px-3.5 pt-6 pb-2 text-caption font-medium tracking-wide text-muted-foreground/70 uppercase">
              Administration
            </p>
            <ul className="space-y-1">
              {renderItem({ to: "/admin", label: "Admin Console", icon: ShieldCheck, exact: true })}
              {canEmployees && renderItem({ to: "/admin/employees", label: "Employees", icon: UserCog })}
              {canApprovals && renderItem({ to: "/admin/approvals", label: "Approvals", icon: ShieldAlert })}
              {canAudit && renderItem({ to: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText })}
              {canSettings && renderItem({ to: "/admin/settings", label: "Firm Settings", icon: Settings })}
            </ul>
          </>
        ) : null}
        <ul className="mt-1 space-y-1">
          {renderItem({ to: "/settings", label: "Settings", icon: Settings })}
        </ul>
      </nav>

      <div className="mt-4 rounded-md border border-border/70 bg-card/70 p-3">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/12 font-display text-helper font-semibold text-primary">
            {user?.initials ?? "SW"}
          </span>
          <div className="min-w-0">
            <p className="truncate text-helper font-medium">{user?.name ?? "Signed out"}</p>
            <p className="truncate text-caption text-muted-foreground">{user?.title ?? "—"}</p>
          </div>
          <button
            type="button"
            aria-label="Sign out"
            onClick={async () => {
              await signOut();
              navigate({ to: "/login", replace: true });
            }}
            className="grid size-9 shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
          >
            <LogOut size={17} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* StillWorks attribution */}
      <div className="mt-3 flex items-center justify-center gap-2 rounded-md border border-border/40 bg-muted/30 px-3 py-1.5">
        <img
          src="/stillworks-logo-light.jpg"
          alt="StillWorks"
          className="h-5 w-auto object-contain dark:hidden"
        />
        <img
          src="/stillworks-logo-dark.jpg"
          alt="StillWorks"
          className="hidden h-5 w-auto object-contain dark:block"
        />
        <span className="text-[10px] font-medium tracking-wide text-muted-foreground">
          Powered by <span className="text-primary/70">stillworks.in</span>
        </span>
      </div>
    </div>
  );
}
