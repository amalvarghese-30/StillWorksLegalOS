import { useState, useEffect } from "react";
import {
  Bell,
  CheckCheck,
  Trash2,
  Volume2,
  VolumeX,
  CheckSquare,
  MessageCircle,
  Gavel,
  ShieldCheck,
  FileText,
  Briefcase,
  AlertTriangle,
  AtSign,
  X,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { useNotifications, type Notification } from "@/lib/notifications";
import { notifications, getNotificationPermissionStatus, isElectron } from "@/platform";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

// Format relative timestamps
function formatTimeAgo(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 45) return "Just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 172800) return "Yesterday";
    return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

// Map notification type to icon, styling, and human label
function getNotificationMeta(type: string, metadata?: Record<string, unknown>) {
  switch (type) {
    case "TASK_ASSIGNED":
    case "TASK_DUE":
    case "OVERDUE_TASK":
      return {
        icon: CheckSquare,
        bgColor: "bg-amber-500/10 dark:bg-amber-500/20",
        textColor: "text-amber-600 dark:text-amber-400",
        category: "tasks",
        label: "Task",
      };
    case "COMMENT_MENTION":
      return {
        icon: AtSign,
        bgColor: "bg-blue-500/10 dark:bg-blue-500/20",
        textColor: "text-blue-600 dark:text-blue-400",
        category: "chat",
        label: "Mention",
      };
    case "CUSTOM":
      if (metadata?.["groupType"]) {
        return {
          icon: MessageCircle,
          bgColor: "bg-sky-500/10 dark:bg-sky-500/20",
          textColor: "text-sky-600 dark:text-sky-400",
          category: "chat",
          label: "Chat",
        };
      }
      return {
        icon: Bell,
        bgColor: "bg-primary/10",
        textColor: "text-primary",
        category: "other",
        label: "Notice",
      };
    case "HEARING_REMINDER":
      return {
        icon: Gavel,
        bgColor: "bg-emerald-500/10 dark:bg-emerald-500/20",
        textColor: "text-emerald-600 dark:text-emerald-400",
        category: "calendar",
        label: "Hearing",
      };
    case "APPROVAL_REQUEST":
      return {
        icon: ShieldCheck,
        bgColor: "bg-violet-500/10 dark:bg-violet-500/20",
        textColor: "text-violet-600 dark:text-violet-400",
        category: "approvals",
        label: "Approval",
      };
    case "DOCUMENT_SHARED":
      return {
        icon: FileText,
        bgColor: "bg-purple-500/10 dark:bg-purple-500/20",
        textColor: "text-purple-600 dark:text-purple-400",
        category: "documents",
        label: "Document",
      };
    case "CASE_UPDATE":
      return {
        icon: Briefcase,
        bgColor: "bg-indigo-500/10 dark:bg-indigo-500/20",
        textColor: "text-indigo-600 dark:text-indigo-400",
        category: "cases",
        label: "Case",
      };
    default:
      return {
        icon: Bell,
        bgColor: "bg-muted",
        textColor: "text-muted-foreground",
        category: "other",
        label: "Alert",
      };
  }
}

type TabFilter = "all" | "unread" | "tasks" | "chat" | "approvals";

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabFilter>("all");
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    soundEnabled,
    toggleSound,
  } = useNotifications();
  const navigate = useNavigate();
  const [browserPerm, setBrowserPerm] = useState<string>(() => getNotificationPermissionStatus());

  // Route to the target resource
  const handleNotificationClick = (n: Notification) => {
    markAsRead(n._id);
    setOpen(false);

    if (n.relatedModel === "Case" && n.relatedId) {
      navigate({ to: "/cases/$caseId", params: { caseId: n.relatedId } });
    } else if (n.relatedModel === "Document") {
      navigate({ to: "/documents" });
    } else if (n.relatedModel === "Task") {
      navigate({ to: "/tasks" });
    } else if (n.relatedModel === "CalendarEvent") {
      navigate({ to: "/calendar" });
    } else if (n.type.startsWith("CHAT") || n.type === "COMMENT_MENTION" || n.relatedModel === "ChatGroup") {
      const gid = n.metadata?.["groupId"] || (n.relatedModel === "ChatGroup" ? n.relatedId : undefined);
      navigate({
        to: "/chat",
        search: { groupId: typeof gid === "string" ? gid : undefined },
      });
    } else if (n.type === "APPROVAL_REQUEST") {
      navigate({ to: "/admin/approvals" });
    }
  };

  // Listen for global toast click navigation
  useEffect(() => {
    const handleToastNav = (e: Event) => {
      const customEvent = e as CustomEvent<Notification>;
      if (customEvent.detail) {
        handleNotificationClick(customEvent.detail);
      }
    };

    window.addEventListener("stillworks:navigate-notification", handleToastNav);
    return () => {
      window.removeEventListener("stillworks:navigate-notification", handleToastNav);
    };
  }, []);

  // Filtered notifications
  const filteredNotifications = notifications.filter((n) => {
    if (tab === "unread") return !n.read;
    if (tab === "tasks") {
      return (
        n.type === "TASK_ASSIGNED" ||
        n.type === "TASK_DUE" ||
        n.type === "OVERDUE_TASK" ||
        n.relatedModel === "Task"
      );
    }
    if (tab === "chat") {
      return (
        n.type === "COMMENT_MENTION" ||
        n.type === "CUSTOM" ||
        n.relatedModel === "ChatGroup"
      );
    }
    if (tab === "approvals") {
      return (
        n.type === "APPROVAL_REQUEST" ||
        n.type === "DOCUMENT_SHARED"
      );
    }
    return true;
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-md hover:bg-muted/80"
          aria-label="Open notifications"
        >
          <Bell size={19} strokeWidth={1.75} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground ring-2 ring-background animate-in fade-in zoom-in duration-200">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-full sm:w-[420px] p-0 flex flex-col bg-background/95 backdrop-blur-xl border-l border-border shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/80 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <Bell size={17} strokeWidth={2} />
            </div>
            <div>
              <SheetTitle className="text-base font-semibold leading-none text-foreground">
                Notifications
              </SheetTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {unreadCount > 0
                  ? `${unreadCount} unread alert${unreadCount > 1 ? "s" : ""}`
                  : "All caught up"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Sound Mute/Unmute Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-md text-muted-foreground hover:text-foreground"
              onClick={toggleSound}
              title={soundEnabled ? "Notification sound: Enabled (Click to mute)" : "Notification sound: Muted (Click to enable)"}
            >
              {soundEnabled ? (
                <Volume2 size={16} strokeWidth={1.75} className="text-primary" />
              ) : (
                <VolumeX size={16} strokeWidth={1.75} className="text-muted-foreground" />
              )}
            </Button>

            {/* Mark all as read */}
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1"
                onClick={markAllAsRead}
                title="Mark all as read"
              >
                <CheckCheck size={14} strokeWidth={1.75} />
                <span>Read all</span>
              </Button>
            )}
          </div>
        </div>

        {/* Web Browser Notification Permission Banner */}
        {!isElectron() && browserPerm === "default" && (
          <div className="mx-5 my-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-2 rounded-full bg-primary animate-pulse shrink-0" />
              <p className="text-xs text-foreground font-medium">
                Allow desktop alerts for real-time cases, tasks & hearings
              </p>
            </div>
            <Button
              size="sm"
              className="gradient-primary text-primary-foreground h-7 px-3 text-xs rounded-md shrink-0 shadow-xs"
              onClick={async () => {
                const granted = await notifications.requestPermission();
                setBrowserPerm(getNotificationPermissionStatus());
                if (granted) {
                  toast.success("Desktop notifications enabled successfully");
                }
              }}
            >
              Enable
            </Button>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 border-b border-border/60 bg-muted/30 px-5 py-2 overflow-x-auto no-scrollbar">
          {(
            [
              ["all", "All"],
              ["unread", unreadCount > 0 ? `Unread (${unreadCount})` : "Unread"],
              ["tasks", "Tasks"],
              ["chat", "Chat"],
              ["approvals", "Approvals"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                tab === key
                  ? "bg-card text-foreground shadow-xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/40 p-2">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="grid size-12 place-items-center rounded-2xl bg-muted/60 text-muted-foreground mb-3">
                <Bell size={22} strokeWidth={1.5} />
              </div>
              <p className="text-sm font-medium text-foreground">
                {tab === "unread" ? "No unread alerts" : "No notifications yet"}
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
                {tab === "unread"
                  ? "You're completely up to date with your tasks, chats, and firm activities."
                  : "When colleagues assign tasks, mention you in chat, or schedule hearings, they'll appear here."}
              </p>
            </div>
          ) : (
            filteredNotifications.map((n) => {
              const meta = getNotificationMeta(n.type, n.metadata);
              const Icon = meta.icon;

              return (
                <div
                  key={n._id}
                  onClick={() => handleNotificationClick(n)}
                  className={`group relative flex items-start gap-3.5 rounded-xl p-3.5 transition-all cursor-pointer hover:bg-muted/60 ${
                    !n.read
                      ? "bg-primary/[0.04] dark:bg-primary/[0.07] font-medium"
                      : "opacity-85 hover:opacity-100"
                  }`}
                >
                  {/* Unread indicator pip */}
                  {!n.read && (
                    <span className="absolute left-1.5 top-5 size-1.5 rounded-full bg-primary ring-2 ring-background" />
                  )}

                  {/* Icon badge */}
                  <div
                    className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg ${meta.bgColor} ${meta.textColor}`}
                  >
                    <Icon size={17} strokeWidth={1.75} />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1 pl-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {n.title}
                      </p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {formatTimeAgo(n.createdAt)}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {n.message}
                    </p>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="inline-flex items-center rounded-pill bg-muted/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {meta.label}
                      </span>

                      {/* Quick action buttons on hover */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!n.read && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(n._id);
                            }}
                            className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground text-[11px]"
                            title="Mark as read"
                          >
                            <CheckCheck size={13} strokeWidth={1.75} />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(n._id);
                          }}
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive text-[11px]"
                          title="Delete notification"
                        >
                          <Trash2 size={13} strokeWidth={1.75} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {filteredNotifications.length > 0 && (
          <div className="border-t border-border/80 bg-muted/20 p-3 flex items-center justify-between text-xs text-muted-foreground px-5">
            <span>
              {notifications.length} total alert{notifications.length > 1 ? "s" : ""}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="font-medium text-primary hover:underline transition-colors"
              >
                Clear all unread
              </button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
