import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Users,
  FolderClosed,
  CalendarDays,
  BarChart3,
  Settings,
  ShieldCheck,
  LogOut,
  Sun,
  Moon,
  Laptop,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { APP_VERSION } from "@/version";
import { isElectron } from "@/platform";
import { Button } from "@/components/ui/button";
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

interface MobileMoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileMoreSheet({ open, onOpenChange }: MobileMoreSheetProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();

  const isAdmin = user?.role === "admin";
  const permissions = (user?.permissions as Record<string, boolean> | undefined) ?? {};

  const handleNavigate = (to: string) => {
    onOpenChange(false);
    navigate({ to });
  };

  const navItems = [
    {
      to: "/clients",
      label: "Clients",
      desc: "Client directory & contacts",
      icon: Users,
      show: isAdmin || permissions["clients"] !== false,
    },
    {
      to: "/documents",
      label: "Documents",
      desc: "Storage, filings & legal drafts",
      icon: FolderClosed,
      show: isAdmin || permissions["documents"] !== false,
    },
    {
      to: "/calendar",
      label: "Calendar",
      desc: "Hearings, deadlines & meetings",
      icon: CalendarDays,
      show: isAdmin || permissions["calendar"] !== false,
    },
    {
      to: "/reports",
      label: "Reports",
      desc: "Practice insights & analytics",
      icon: BarChart3,
      show: isAdmin || permissions["reports"] !== false,
    },
    {
      to: "/admin",
      label: "Admin Console",
      desc: "Employees, firm policies & audits",
      icon: ShieldCheck,
      show: isAdmin,
    },
    {
      to: "/settings",
      label: "Settings",
      desc: "Profile, notifications & security",
      icon: Settings,
      show: true,
    },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[88dvh] overflow-y-auto rounded-t-2xl border-t border-border/80 bg-background/95 p-0 backdrop-blur-xl"
      >
        <SheetHeader className="border-b border-border/60 px-5 pt-4 pb-3 text-left">
          <div className="flex items-center justify-between">
            <SheetTitle className="font-display text-base font-semibold">More Services</SheetTitle>
            <span className="font-mono text-[11px] font-semibold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded border border-border/50">
              v{APP_VERSION}
            </span>
          </div>
          <SheetDescription className="text-xs text-muted-foreground">
            S &amp; S Associates Legal-Tech LLP
          </SheetDescription>
        </SheetHeader>

        {/* User Card */}
        <div className="mx-4 mt-4 rounded-xl border border-border/70 bg-card/70 p-3.5 shadow-2xs">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/15 font-display text-sm font-semibold text-primary">
              {user?.initials ?? "SW"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{user?.name ?? "Signed In"}</p>
              <p className="truncate text-xs text-muted-foreground capitalize">
                {user?.title || user?.role || "Staff"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 rounded-lg"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              {resolvedTheme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </Button>
          </div>
        </div>

        {/* Navigation Grid */}
        <div className="grid grid-cols-1 gap-1.5 p-4">
          {navItems
            .filter((item) => item.show)
            .map((item) => (
              <button
                key={item.to}
                type="button"
                onClick={() => handleNavigate(item.to)}
                className="flex w-full items-center gap-3.5 rounded-xl px-3.5 py-3 text-left transition-colors hover:bg-muted/70 active:bg-muted"
              >
                <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <item.icon size={20} strokeWidth={1.8} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{item.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </button>
            ))}
        </div>

        {/* Footer & Sign Out */}
        <div className="border-t border-border/60 p-4 safe-bottom">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="w-full h-11 justify-center rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20 font-medium text-sm"
              >
                <LogOut size={16} className="mr-2" />
                Sign Out
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl max-w-sm">
              <AlertDialogHeader>
                <AlertDialogTitle>Sign out of LegalOS?</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to end your session? Make sure any in-progress work is saved.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2 sm:gap-0">
                <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className={buttonVariants({ variant: "destructive", className: "rounded-xl" })}
                  onClick={async () => {
                    onOpenChange(false);
                    await signOut();
                    navigate({ to: "/login", replace: true });
                  }}
                >
                  Sign Out
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            Powered by <span className="font-semibold text-primary">stillworks.in</span> · {isElectron() ? "Desktop" : "Web App"}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
