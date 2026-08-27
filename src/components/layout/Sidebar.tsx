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
  Settings,
  Scale,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

const primary = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/cases", label: "Cases", icon: Briefcase },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/documents", label: "Documents", icon: FolderClosed },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/chat", label: "Chat", icon: MessageCircle },
  { to: "/reports", label: "Reports", icon: BarChart3 },
];



export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const renderItem = (item: (typeof primary)[number]) => {
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
          <p className="truncate font-display text-body font-semibold">StillWorks</p>
          <p className="truncate text-caption text-muted-foreground">LegalOS · Mumbai</p>
        </div>
      </div>

      <nav className="mt-3 flex-1 overflow-y-auto pr-1" aria-label="Main">
        <ul className="space-y-1">{primary.map(renderItem)}</ul>
        {user?.role === "admin" ? (
          <>
            <p className="px-3.5 pt-6 pb-2 text-caption font-medium tracking-wide text-muted-foreground/70 uppercase">
              Administration
            </p>
            <ul className="space-y-1">
              {renderItem({ to: "/admin", label: "Admin Console", icon: ShieldCheck })}
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
            onClick={() => {
              signOut();
              navigate({ to: "/login", replace: true });
            }}
            className="grid size-9 shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
          >
            <LogOut size={17} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </div>
  );
}
