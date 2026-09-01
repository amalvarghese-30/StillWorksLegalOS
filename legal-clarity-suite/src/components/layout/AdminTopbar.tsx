import { useState } from "react";
import { Bell, Dot, Search, Menu, Sun, Moon, ShieldAlert, X, Briefcase, User, FileText, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { AdminSidebar } from "./AdminSidebar";
import { useAuth } from "@/lib/auth";
import { useNotifications } from "@/lib/notifications";
import { useSearch } from "@/lib/search";
import { useNavigate } from "@tanstack/react-router";

export function AdminTopbar() {
  const [dark, setDark] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { user } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, refetch } = useNotifications();
  const { searchResults, isLoading, isError } = useSearch(searchTerm, { limit: 8 });
  const navigate = useNavigate();

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  return (
    <header className="glass sticky top-4 z-30 flex h-18 items-center gap-3 rounded-2xl px-4">
      {/* Navigation Sheet */}
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-md lg:hidden" aria-label="Open navigation">
            <Menu size={20} strokeWidth={1.75} />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[320px] border-none bg-transparent p-3">
          <SheetTitle className="sr-only">Admin navigation</SheetTitle>
          <AdminSidebar onNavigate={() => setNavOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Search Container */}
      <div className="relative min-w-0 flex-1">
        <Search
          size={18}
          strokeWidth={1.75}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search cases, clients, documents…"
          aria-label="Search"
          className="h-10 w-full rounded-md border border-border/70 bg-card/70 pr-3 pl-10 text-helper outline-none transition-colors focus:border-primary/50"
        />
        {/* Search Results Dropdown */}
        {!isLoading && !isError && searchTerm.trim() !== "" ? (
          <div className="absolute left-0 right-0 mt-2 w-full max-h-96 overflow-auto bg-card border border-border rounded-md shadow-lg z-20">
            {searchResults.cases.length === 0 &&
            searchResults.clients.length === 0 &&
            searchResults.documents.length === 0 &&
            searchResults.tasks.length === 0 &&
            searchResults.users.length === 0 ? (
              <div className="px-4 py-2 text-sm text-muted-foreground">
                No results found
              </div>
            ) : (
              <>
                {/* Cases */}
                {searchResults.cases.map((caseItem) => (
                  <Button
                    key={`case-${caseItem._id}`}
                    variant="ghost"
                    size="xs"
                    className="w-full text-left px-3 py-2 border-b border-border/50 hover:bg-muted"
                    onClick={() => navigate(`/cases/${caseItem._id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        <Briefcase size={16} strokeWidth={1.75} className="text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium">{caseItem.title}</p>
                        {caseItem.number && (
                          <p className="text-xs text-muted-foreground">
                            Case #{caseItem.number}
                          </p>
                        )}
                      </div>
                    </div>
                  </Button>
                ))}
                {/* Clients */}
                {searchResults.clients.map((clientItem) => (
                  <Button
                    key={`client-${clientItem._id}`}
                    variant="ghost"
                    size="xs"
                    className="w-full text-left px-3 py-2 border-b border-border/50 hover:bg-muted"
                    onClick={() => navigate(`/clients/${clientItem._id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        <User size={16} strokeWidth={1.75} className="text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium">{clientItem.name}</p>
                        {clientItem.kycStatus && (
                          <p className="text-xs text-muted-foreground">
                            {clientItem.kycStatus}
                          </p>
                        )}
                      </div>
                    </div>
                  </Button>
                ))}
                {/* Documents */}
                {searchResults.documents.map((docItem) => (
                  <Button
                    key={`doc-${docItem._id}`}
                    variant="ghost"
                    size="xs"
                    className="w-full text-left px-3 py-2 border-b border-border/50 hover:bg-muted"
                    onClick={() => navigate(`/documents/${docItem._id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        <FileText size={16} strokeWidth={1.75} className="text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium">{docItem.name}</p>
                        {docItem.state && (
                          <p className="text-xs text-muted-foreground">
                            {docItem.state}
                          </p>
                        )}
                      </div>
                    </div>
                  </Button
                ))}
                {/* Tasks */}
                {searchResults.tasks.map((taskItem) => (
                  <Button
                    key={`task-${taskItem._id}`}
                    variant="ghost"
                    size="xs"
                    className="w-full text-left px-3 py-2 border-b border-border/50 hover:bg-muted"
                    onClick={() => navigate(`/tasks/${taskItem._id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        <CheckSquare size={16} strokeWidth={1.75} className="text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium">{taskItem.title}</p>
                        {taskItem.status && (
                          <p className="text-xs text-muted-foreground>
                            {taskItem.status}
                          </p>
                        )}
                      </div>
                    </div>
                  </Button
                ))}
                {/* Users (placeholder) */}
                {searchResults.users.map((userItem) => (
                  <Button
                    key={`user-${userItem._id}`}
                    variant="ghost"
                    size="xs"
                    className="w-full text-left px-3 py-2 border-b border-border/50 hover:bg-muted"
                    onClick={() => {
                      // No user profile page yet, just log
                      console.log("User click:", userItem._id);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        <User size={16} strokeWidth={1.75} className="text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium">{userItem.name}</p>
                      </div>
                      {(userItem.name || userItem.role) && (
                        <>
                          {userItem.name && (
                            <p className="font-medium">{userItem.name}</p>
                          )}
                          {userItem.role && (
                            <p className="text-xs text-muted-foreground>
                              {userItem.role}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </Button
                ))}
              </>
            )}
          </div>
        ) : null}
      </div>

      {/* Right Side Controls */}
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-md"
          onClick={toggleTheme}
          aria-label="Toggle theme"
        >
          {dark ? <Sun size={19} strokeWidth={1.75} /> : <Moon size={19} strokeWidth={1.75} />}
        </Button>
        <Sheet open={notificationsOpen} onOpenChange={setNotificationsOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="relative rounded-md" aria-label="Notifications">
              <Bell size={19} strokeWidth={1.75} />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 size-2.5 rounded-full bg-destructive text-xs font-medium text-destructive-foreground flex items-center justify-center">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[360px] border-none bg-transparent p-4">
            <SheetTitle className="text-lg font-semibold mb-4">
              Notifications
            </SheetTitle>
            <div className="space-y-3">
              {notifications.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No notifications
                </p>
              ) : (
                <>
                  {notifications.map((notification) => (
                    <div
                      key={notification._id}
                      className={`flex flex-col gap-2 p-4 rounded-lg border border-border bg-card ${
                        !notification.read ? "bg-primary/5" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          <Bell size={18} strokeWidth={1.75} className="text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{notification.title}</p>
                          <p className="text-sm text-muted-foreground line-clamp-2>
                            {notification.message}
                          </p>
                          {p className="text-xs text-muted-foreground mt-1>
                            {new Date(notification.createdAt).toLocaleString(undefined, {
                              timeStyle: "short",
                              dateStyle: "short",
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-end gap-2>
                        {!notification.read && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => markAsRead(notification._id)}
                            aria-label="Mark as read"
                          >
                            {Dot size={12} />
                          </Button
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            // For now, we just mark as read on close
                            markAsRead(notification._id);
                          }}
                          aria-label="Close"
                        >
                          {X size={16} strokeWidth={1.75} />
                        </Button
                      </div>
                    </div>
                  ))}
                  <div className="pt-4 border-t border-border">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={markAllAsRead}
                      className="w-full"
                    >
                      Mark all as read
                    </Button>
                  </div>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}