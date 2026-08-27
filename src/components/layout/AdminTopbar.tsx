import { useState } from "react";
import { Bell, Search, Menu, Sun, Moon, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { AdminSidebar } from "./AdminSidebar";
import { useAuth } from "@/lib/auth";

export function AdminTopbar() {
  const [dark, setDark] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const { user } = useAuth();

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  return (
    <header className="glass sticky top-4 z-30 flex h-18 items-center gap-3 rounded-2xl px-4">
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

      <span className="hidden items-center gap-2 rounded-full bg-foreground px-3 py-1.5 text-caption font-medium text-background sm:inline-flex">
        <ShieldAlert size={14} strokeWidth={2} />
        Admin mode
      </span>

      <div className="relative min-w-0 flex-1">
        <Search
          size={17}
          strokeWidth={1.75}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="search"
          placeholder="Search people, approvals, audit events…"
          aria-label="Search admin console"
          className="h-11 w-full rounded-md border border-border/70 bg-card/70 pr-3 pl-10 text-helper outline-none transition-colors focus:border-primary/50"
        />
      </div>

      <Button variant="ghost" size="icon" className="rounded-md" aria-label="Toggle theme" onClick={toggleTheme}>
        {dark ? <Sun size={19} strokeWidth={1.75} /> : <Moon size={19} strokeWidth={1.75} />}
      </Button>
      <Button variant="ghost" size="icon" className="relative rounded-md" aria-label="Notifications">
        <Bell size={19} strokeWidth={1.75} />
        <span className="absolute top-2 right-2 size-2 rounded-full bg-primary" />
      </Button>
      <span className="ml-1 hidden text-right sm:block">
        <span className="block truncate text-helper font-medium">{user?.name}</span>
        <span className="block truncate text-caption text-muted-foreground">Administrator</span>
      </span>
    </header>
  );
}
