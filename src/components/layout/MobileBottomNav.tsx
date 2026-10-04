import { useState } from "react";
import { Link, useRouterState, useLocation, useSearch } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Briefcase,
  CheckSquare,
  MessageCircle,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatGroups } from "@/services/chat";
import { MobileMoreSheet } from "./MobileMoreSheet";

export function MobileBottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const search = useSearch({ strict: false }) as Record<string, string | undefined>;

  // Total unread count for chat badge
  const { data: chatData } = useChatGroups();
  const totalUnread = (chatData?.groups ?? []).reduce(
    (sum, g) => sum + (g.unreadCount || 0),
    0
  );

  const pathname = location.pathname;

  // On active mobile chat conversation, hide the bottom nav to give full 100dvh to the message thread
  if (pathname === "/chat" && search?.groupId) {
    return null;
  }

  const navItems = [
    {
      to: "/",
      label: "Home",
      icon: LayoutDashboard,
      isActive: pathname === "/",
    },
    {
      to: "/cases",
      label: "Cases",
      icon: Briefcase,
      isActive: pathname.startsWith("/cases"),
    },
    {
      to: "/tasks",
      label: "Tasks",
      icon: CheckSquare,
      isActive: pathname.startsWith("/tasks"),
    },
    {
      to: "/chat",
      label: "Chat",
      icon: MessageCircle,
      isActive: pathname.startsWith("/chat"),
      badge: totalUnread > 0 ? (totalUnread > 99 ? "99+" : String(totalUnread)) : null,
    },
  ];

  return (
    <>
      <nav
        aria-label="Mobile Bottom Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 block lg:hidden border-t border-border/80 bg-background/90 backdrop-blur-lg shadow-lg"
        style={{
          paddingBottom: "max(env(safe-area-inset-bottom, 0px), 0.5rem)",
        }}
      >
        <div className="grid grid-cols-5 items-center justify-around px-1 pt-1.5">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-xl transition-all duration-150 active:scale-95",
                item.isActive
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground font-medium"
              )}
            >
              <div className="relative">
                <item.icon size={21} strokeWidth={item.isActive ? 2.2 : 1.8} />
                {item.badge && (
                  <span className="absolute -top-1.5 -right-2.5 flex min-w-4.5 h-4.5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-xs">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tight leading-none">
                {item.label}
              </span>
              {item.isActive && (
                <span className="absolute -bottom-1 h-0.75 w-5 rounded-full bg-primary" />
              )}
            </Link>
          ))}

          {/* More Action */}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "relative flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-xl transition-all duration-150 active:scale-95",
              moreOpen
                ? "text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground font-medium"
            )}
          >
            <MoreHorizontal size={21} strokeWidth={moreOpen ? 2.2 : 1.8} />
            <span className="text-[10px] tracking-tight leading-none">More</span>
            {moreOpen && (
              <span className="absolute -bottom-1 h-0.75 w-5 rounded-full bg-primary" />
            )}
          </button>
        </div>
      </nav>

      <MobileMoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  );
}
