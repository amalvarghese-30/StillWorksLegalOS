import { useState } from "react";
import {
  Search,
  Menu,
  Sun,
  Moon,
  Briefcase,
  User,
  FileText,
  CheckSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { AdminSidebar } from "./AdminSidebar";
import { NotificationCenter } from "./NotificationCenter";
import { useAuth } from "@/lib/auth";
import { useSearch } from "@/lib/search";
import { useCreateDirectChat } from "@/services/chat";
import { useNavigate } from "@tanstack/react-router";
import { useTheme } from "@/lib/theme";

export function AdminTopbar() {
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
                    size="sm"
                    className="w-full text-left px-3 py-2 border-b border-border/50 hover:bg-muted"
                    onClick={() => navigate({ to: "/cases/$caseId", params: { caseId: caseItem._id } })}
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
                    onClick={() => navigate({ to: "/clients/$clientId", params: { clientId: clientItem._id } })}
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
                    onClick={() => navigate({ to: "/documents" })}
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
                    onClick={() => navigate({ to: "/tasks" })}
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
                    onClick={() => navigate({ to: "/admin/employees" })}
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
      <div className="flex shrink-0 items-center gap-1.5">
        <NotificationCenter />
        <Button
          variant="ghost"
          size="icon"
          className="rounded-md"
          onClick={toggleTheme}
          aria-label="Toggle theme"
        >
          {resolvedTheme === "dark" ? <Sun size={19} strokeWidth={1.75} /> : <Moon size={19} strokeWidth={1.75} />}
        </Button>
        <span className="ml-1 hidden text-right sm:block">
          <span className="block truncate text-helper font-medium">{user?.name}</span>
          <span className="block truncate text-caption text-muted-foreground">Administrator</span>
        </span>
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.name}
            className="size-10 rounded-full object-cover border border-border shrink-0"
          />
        ) : (
          <span className="grid size-10 place-items-center rounded-full bg-primary/12 font-display text-helper font-semibold text-primary shrink-0">
            {user?.initials ?? "SW"}
          </span>
        )}
      </div>
    </header>
  );
}