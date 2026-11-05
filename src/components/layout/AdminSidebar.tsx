import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Gauge,
  UserCog,
  ShieldCheck,
  ScrollText,
  Settings,
  ShieldAlert,
  Users,
  MessageCircle,
  CheckSquare,
  CalendarDays,
  LogOut,
  BarChart3,
} from "lucide-react";
import logoImg from "@/assets/logo.png";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { APP_VERSION } from "@/version";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { UserAvatar } from "@/components/common/UserAvatar";

type PermissionKey = keyof NonNullable<import("@/lib/auth").UserPermissions>;

interface NavItem {
  to: string;
  label: string;
  icon: typeof Gauge;
  exact?: boolean;
  permission?: PermissionKey;
}

const adminNav: NavItem[] = [
  { to: "/admin", label: "Admin Dashboard", icon: Gauge, exact: true },
  { to: "/admin/employees", label: "Members", icon: UserCog, permission: "employees" },
  { to: "/admin/approvals", label: "Approvals", icon: ShieldCheck, permission: "approvals" },
  { to: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText, permission: "auditLogs" },
  { to: "/admin/settings", label: "Firm Settings", icon: Settings, permission: "settings" },
];

const firmNav: NavItem[] = [
  { to: "/", label: "Dashboard", icon: Gauge, permission: "dashboard" },
  { to: "/clients", label: "Clients", icon: Users, permission: "clients" },
  { to: "/tasks", label: "Tasks", icon: CheckSquare, permission: "tasks" },
  { to: "/calendar", label: "Calendar", icon: CalendarDays, permission: "calendar" },
  { to: "/reports", label: "Reports", icon: BarChart3, permission: "reports" },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { visualTheme } = useTheme();
  const isSage = visualTheme === "sage";

  const visibleAdminNav = adminNav.filter((item) => {
    if (user?.role === "admin") return true;
    if (!item.permission) return true;
    return user?.permissions?.[item.permission] !== false;
  });

  const visibleFirmNav = firmNav.filter((item) => {
    if (user?.role === "admin") return true;
    if (!item.permission) return true;
    return user?.permissions?.[item.permission] !== false;
  });

  return (
    <div
      className={cn(
        "flex h-full w-[290px] flex-col rounded-2xl p-4",
        isSage ? "sidebar-glass" : "glass",
      )}
    >
      <div className="flex items-center gap-3 px-2 py-3">
        <div
          className={cn(
            "size-11 shrink-0 overflow-hidden rounded-xl border p-1 shadow-soft flex items-center justify-center",
            isSage ? "border-sidebar-border/60 bg-sidebar-accent/40" : "border-border/80 bg-white",
          )}
        >
          <img src={logoImg} alt="SS Associates" className="size-full object-contain" />
        </div>
        <div className="min-w-0">
          <p
            className={cn(
              "truncate font-display text-body font-semibold",
              isSage ? "text-sidebar-foreground" : "text-foreground",
            )}
          >
            Admin Console
          </p>
          <p
            className={cn(
              "truncate text-caption",
              isSage ? "text-sidebar-foreground/60" : "text-muted-foreground",
            )}
          >
            SS Associates Legal-Tech LLP
          </p>
        </div>
      </div>

      <nav className="mt-3 flex-1 overflow-y-auto pr-1" aria-label="Admin">
        <ul className="space-y-1">
          {visibleAdminNav.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-helper font-medium transition-all duration-200",
                    active
                      ? isSage
                        ? "bg-sidebar-primary/90 text-sidebar-primary-foreground shadow-soft"
                        : "gradient-primary text-primary-foreground shadow-soft"
                      : isSage
                        ? "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <item.icon size={19} strokeWidth={1.75} className="shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        <p
          className={cn(
            "px-3.5 pt-6 pb-2 text-caption font-medium tracking-wide uppercase",
            isSage ? "text-sidebar-foreground/50" : "text-muted-foreground/70",
          )}
        >
          Firm workspace
        </p>
        <ul className="space-y-1">
          {visibleFirmNav.map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to);
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-helper font-medium transition-all duration-200",
                    active
                      ? isSage
                        ? "bg-sidebar-primary/90 text-sidebar-primary-foreground shadow-soft"
                        : "gradient-primary text-primary-foreground shadow-soft"
                      : isSage
                        ? "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <item.icon size={19} strokeWidth={1.75} className="shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div
        className={cn(
          "mt-4 rounded-xl border p-3 transition-colors",
          isSage
            ? "border-sidebar-border/60 bg-sidebar-accent/40 text-sidebar-foreground"
            : "border-border/70 bg-card/70",
        )}
      >
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <UserAvatar
            avatarUrl={user?.avatarUrl}
            name={user?.name}
            initials={user?.initials ?? "AD"}
            className="size-10 text-helper"
          />
          <div className="min-w-0">
            <p
              className={cn(
                "truncate text-helper font-medium",
                isSage && "text-sidebar-foreground",
              )}
            >
              {user?.name ?? "Administrator"}
            </p>
            <p
              className={cn(
                "truncate text-caption",
                isSage ? "text-sidebar-foreground/60" : "text-muted-foreground",
              )}
            >
              {user?.title ?? "Administrator"}
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                aria-label="Sign out"
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-lg transition-colors duration-150 active:scale-95",
                  isSage
                    ? "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <LogOut size={17} strokeWidth={1.75} />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sign out of Admin Console?</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to end your administrator session? Ensure any administrative
                  approvals or user updates have been saved.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className={buttonVariants({ variant: "destructive" })}
                  onClick={async () => {
                    await signOut();
                    navigate({ to: "/login", replace: true });
                  }}
                >
                  Sign Out
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* StillWorks attribution & Version Badge */}
      <div
        className={cn(
          "mt-3 flex items-center justify-between rounded-xl border px-3 py-2 transition-colors",
          isSage
            ? "border-sidebar-border/40 bg-sidebar-accent/30 text-sidebar-foreground/80"
            : "border-border/40 bg-muted/30",
        )}
      >
        <span
          className={cn(
            "text-xs font-semibold tracking-wide",
            isSage ? "text-sidebar-foreground/70" : "text-muted-foreground",
          )}
        >
          Powered by{" "}
          <span className={cn(isSage ? "text-sidebar-primary" : "text-primary")}>
            stillworks.in
          </span>
        </span>
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            navigate({ to: "/admin/settings", search: { tab: "updates" } });
          }}
          title={`LegalOS Release v${APP_VERSION} · Click to check for updates`}
          className={cn(
            "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold shadow-2xs transition-colors cursor-pointer",
            isSage
              ? "bg-sidebar-accent/50 border-sidebar-border/60 text-sidebar-foreground/80 hover:text-sidebar-foreground hover:border-sidebar-primary/40"
              : "bg-background/80 border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40",
          )}
        >
          v{APP_VERSION}
        </button>
      </div>
    </div>
  );
}
