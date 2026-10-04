import { useState } from "react";
import {
  Bell,
  Dot,
  Search,
  Sparkles,
  Menu,
  Sun,
  Moon,
  Plus,
  X,
  Briefcase,
  User,
  FileText,
  CheckSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Sidebar } from "./Sidebar";
import { QuickActionsMenu } from "./QuickActionsMenu";
import { AddCaseDialog } from "@/components/cases/AddCaseDialog";
import { NotificationCenter } from "./NotificationCenter";
import { useAuth } from "@/lib/auth";
import { useSearch } from "@/lib/search";
import { useCreateDirectChat } from "@/services/chat";
import { useNavigate } from "@tanstack/react-router";
import { useTheme } from "@/lib/theme";
import { APP_VERSION } from "@/version";

export function Topbar() {
  const [showAddCase, setShowAddCase] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { user } = useAuth();
  const { searchResults, isLoading, isError } = useSearch(searchTerm, { limit: 8 });
  const createDirectChat = useCreateDirectChat();
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  const handleUserClick = (userId: string) => {
    setSearchTerm("");
    createDirectChat.mutate(
      { userId },
      {
        onSuccess: (res) => {
          navigate({ to: "/chat", search: { groupId: res.group._id } });
        },
      }
    );
  };

  return (
    <header className="glass sticky top-2 sm:top-4 z-30 flex h-14 sm:h-18 items-center gap-2 sm:gap-3 rounded-xl sm:rounded-2xl px-2.5 sm:px-4">
      {/* Navigation Sheet */}
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="size-9 sm:size-10 rounded-md lg:hidden shrink-0" aria-label="Open navigation">
            <Menu size={19} strokeWidth={1.75} />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[320px] border-none bg-transparent p-3">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar onNavigate={() => setNavOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Search Container */}
      <div className="relative min-w-0 flex-1">
        <Search
          size={17}
          strokeWidth={1.75}
          className="pointer-events-none absolute top-1/2 left-2.5 sm:left-3 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setSearchTerm("");
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder="Search workspace…"
          aria-label="Search"
          className="h-9 sm:h-10 w-full rounded-md border border-border/70 bg-card/70 pr-2.5 sm:pr-3 pl-8 sm:pl-10 text-xs sm:text-helper outline-none transition-colors focus:border-primary/50"
        />
        {/* Backdrop for click outside dismiss */}
        {searchTerm.trim() !== "" && (
          <div
            className="fixed inset-0 z-10"
            onClick={() => setSearchTerm("")}
          />
        )}
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
                    size="sm"
                    className="w-full text-left px-3 py-2 border-b border-border/50 hover:bg-muted"
                    onClick={() => {
                      setSearchTerm("");
                      navigate({ to: "/cases/$caseId", params: { caseId: caseItem._id } });
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="shrink-0">
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
                    size="sm"
                    className="w-full text-left px-3 py-2 border-b border-border/50 hover:bg-muted"
                    onClick={() => {
                      setSearchTerm("");
                      navigate({ to: "/clients/$clientId", params: { clientId: clientItem._id } });
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="shrink-0">
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
                    size="sm"
                    className="w-full text-left px-3 py-2 border-b border-border/50 hover:bg-muted"
                    onClick={() => {
                      setSearchTerm("");
                      navigate({ to: "/documents" });
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="shrink-0">
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
                  </Button>
                ))}
                {/* Tasks */}
                {searchResults.tasks.map((taskItem) => (
                  <Button
                    key={`task-${taskItem._id}`}
                    variant="ghost"
                    size="sm"
                    className="w-full text-left px-3 py-2 border-b border-border/50 hover:bg-muted"
                    onClick={() => {
                      setSearchTerm("");
                      navigate({ to: "/tasks" });
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="shrink-0">
                        <CheckSquare size={16} strokeWidth={1.75} className="text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium">{taskItem.title}</p>
                        {taskItem.status && (
                          <p className="text-xs text-muted-foreground">
                            {taskItem.status}
                          </p>
                        )}
                      </div>
                    </div>
                  </Button>
                ))}
                {/* Users */}
                {searchResults.users.map((userItem) => (
                  <Button
                    key={`user-${userItem._id}`}
                    variant="ghost"
                    size="sm"
                    className="w-full text-left px-3 py-2 border-b border-border/50 hover:bg-muted"
                    onClick={() => handleUserClick(userItem._id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="shrink-0">
                        <User size={16} strokeWidth={1.75} className="text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium">{userItem.name}</p>
                        {userItem.role && (
                          <p className="text-xs text-muted-foreground">
                            {userItem.role}
                          </p>
                        )}
                      </div>
                    </div>
                  </Button>
                ))}
              </>
            )}
          </div>
        ) : null}
      </div>

      {/* Right Side Controls */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        {/* App Version Indicator */}
        <div
          title={`LegalOS Release v${APP_VERSION}`}
          className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 font-mono text-[11px] font-medium text-muted-foreground shadow-2xs hover:bg-muted/70 transition-colors select-none"
        >
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>v{APP_VERSION}</span>
        </div>

        <div className="hidden sm:block">
          <QuickActionsMenu
            renderTrigger={(toggle) => (
              <Button variant="ghost" size="icon" className="rounded-md" aria-label="Quick actions" onClick={toggle}>
                <Sparkles size={19} strokeWidth={1.75} />
              </Button>
            )}
          />
        </div>
        {/* Notifications */}
        <NotificationCenter />
        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="hidden sm:inline-flex rounded-md"
          onClick={toggleTheme}
          aria-label="Toggle theme"
        >
          {resolvedTheme === "dark" ? <Sun size={19} strokeWidth={1.75} /> : <Moon size={19} strokeWidth={1.75} />}
        </Button>
        {/* New Case Button */}
        <Button
          className="gradient-primary hidden rounded-md text-primary-foreground shadow-soft transition-transform duration-200 hover:-translate-y-0.5 sm:inline-flex"
          onClick={() => setShowAddCase(true)}
        >
          <Plus size={17} strokeWidth={2} />
          New Case
        </Button>
        {/* User Avatar */}
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.name}
            className="size-8 sm:size-10 rounded-full object-cover border border-border shrink-0"
          />
        ) : (
          <span className="grid size-8 sm:size-10 place-items-center rounded-full bg-primary/12 font-display text-xs sm:text-helper font-semibold text-primary shrink-0">
            {user?.initials ?? "SW"}
          </span>
        )}
      </div>

      {/* Add Case Dialog */}
      {showAddCase && <AddCaseDialog open={showAddCase} onClose={() => setShowAddCase(false)} />}
    </header>
  );
}