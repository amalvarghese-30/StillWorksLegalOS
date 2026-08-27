import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Scale, ArrowRight, ShieldAlert, UserCog, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in · StillWorks LegalOS" },
      {
        name: "description",
        content: "Sign in to StillWorks LegalOS — the calm operating system for modern law firms.",
      },
      { property: "og:title", content: "Sign in · StillWorks LegalOS" },
      { property: "og:description", content: "The calm operating system for modern law firms." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { user, ready, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && user) navigate({ to: user.role === "admin" ? "/admin" : "/", replace: true });
  }, [ready, user, navigate]);

  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await signIn(email, password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      navigate({ to: result.user.role === "admin" ? "/admin" : "/", replace: true });
    } finally {
      setLoading(false);
    }
  };

  const fill = (role: "admin" | "employee") => {
    setEmail(`${role}@stillworks.legal`);
    setPassword(`${role}123`);
    setError(null);
  };

  return (
    <div className="app-canvas grid min-h-screen lg:grid-cols-2">
      <div className="page-enter flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <span className="gradient-primary grid size-12 place-items-center rounded-md text-primary-foreground shadow-soft">
            <Scale size={22} strokeWidth={1.75} />
          </span>
          <h1 className="mt-6 text-hero font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-body text-muted-foreground">
            Sign in to your firm's legal operating system.
          </p>

          <form className="mt-8 space-y-5" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-helper">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@firm.legal"
                className="h-12 rounded-md"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-helper">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-12 rounded-md"
              />
            </div>

            {error ? (
              <p role="alert" className="text-helper text-destructive">
                {error}
              </p>
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-helper text-muted-foreground">
                <Checkbox id="remember" defaultChecked /> Remember me
              </label>
              <button type="button" className="text-helper text-primary hover:underline">
                Forgot password?
              </button>
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="gradient-primary h-12 w-full rounded-md text-primary-foreground shadow-soft transition-transform duration-200 hover:-translate-y-0.5"
            >
              {loading ? <Loader2 size={17} className="animate-spin" /> : <ArrowRight size={17} strokeWidth={1.75} />}
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="mt-6 rounded-md border border-border/70 bg-card/70 p-3">
            <p className="text-caption font-medium tracking-wide text-muted-foreground uppercase">
              Demo access
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => fill("admin")}
                className="flex items-center gap-2 rounded-sm border border-border/70 px-3 py-2 text-helper transition-colors hover:bg-accent"
              >
                <ShieldAlert size={16} strokeWidth={1.75} /> Admin
              </button>
              <button
                type="button"
                onClick={() => fill("employee")}
                className="flex items-center gap-2 rounded-sm border border-border/70 px-3 py-2 text-helper transition-colors hover:bg-accent"
              >
                <UserCog size={16} strokeWidth={1.75} /> Employee
              </button>
            </div>
            <p className="mt-3 text-caption text-muted-foreground">
              admin@stillworks.legal / admin123 · employee@stillworks.legal / employee123
            </p>
          </div>
        </div>
      </div>

      <div className="relative hidden items-center justify-center overflow-hidden p-12 lg:flex">
        <div className="gradient-primary absolute inset-6 rounded-3xl opacity-95" />
        <div className="glass relative w-full max-w-md rounded-2xl p-8">
          <p className="text-caption font-medium tracking-wide text-muted-foreground uppercase">
            StillWorks LegalOS
          </p>
          <p className="mt-4 font-display text-section leading-snug font-semibold">
            "Every hearing, every document, every client — in one calm place."
          </p>
          <div className="mt-8 grid grid-cols-3 gap-4">
            {[
              ["36", "Active cases"],
              ["128", "Clients"],
              ["1.2k", "Documents"],
            ].map(([v, l]) => (
              <div key={l} className="rounded-md bg-card/70 p-4">
                <p className="num text-section font-semibold">{v}</p>
                <p className="text-caption text-muted-foreground">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
