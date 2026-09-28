import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Scale, ArrowRight, Loader2, ShieldCheck, Lock, CheckCircle2, AlertCircle, Mail, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth";
import { ForgotPasswordDialog } from "@/components/auth/ForgotPasswordDialog";
import { validateEmail } from "@/lib/validation";
import stillworksLogoLight from "@/assets/stillworks-logo-light.jpg";
import stillworksLogoDark from "@/assets/stillworks-logo-dark.jpg";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in · S & S Legal-Tech LLP" },
      {
        name: "description",
        content: "Sign in to S & S Associates Legal-Tech LLP — Enterprise Legal Practice Management.",
      },
      { property: "og:title", content: "Sign in · S & S Legal-Tech LLP" },
      { property: "og:description", content: "Enterprise Legal Practice Management for modern law firms." },
    ],
  }),
  component: LoginPage,
});

const REMEMBER_KEY = "stillworks_remembered_user";

function LoginPage() {
  const { user, ready, signIn } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Restore remembered credentials on initial mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.email) setEmail(parsed.email);
        if (typeof parsed.rememberMe === "boolean") setRememberMe(parsed.rememberMe);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (ready && user) navigate({ to: user.role === "admin" ? "/admin" : "/", replace: true });
  }, [ready, user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setPasswordError(null);
    setGeneralError(null);

    // Form-level validation
    let hasValidationError = false;
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setEmailError("Email address or username is required.");
      hasValidationError = true;
    } else if (cleanEmail.includes("@")) {
      const check = validateEmail(cleanEmail);
      if (!check.valid) {
        setEmailError(check.error || "Please enter a valid email address.");
        hasValidationError = true;
      }
    }

    if (!password) {
      setPasswordError("Password is required.");
      hasValidationError = true;
    } else if (password.length < 4) {
      setPasswordError("Password must be at least 4 characters.");
      hasValidationError = true;
    }

    if (hasValidationError) return;

    setLoading(true);
    try {
      const result = await signIn(cleanEmail, password, rememberMe);
      if (!result.ok) {
        if (result.field === "email") {
          setEmailError(result.error);
        } else if (result.field === "password") {
          setPasswordError(result.error);
        } else {
          setGeneralError(result.error);
        }
        return;
      }

      // Persist or clean up "Remember me" (email only — passwords are NEVER stored in browser storage)
      if (rememberMe) {
        localStorage.setItem(REMEMBER_KEY, JSON.stringify({ email: cleanEmail, rememberMe: true }));
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }

      navigate({ to: result.user.role === "admin" ? "/admin" : "/", replace: true });
    } catch (err: unknown) {
      setGeneralError(err instanceof Error ? err.message : "An unexpected sign-in error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left Column: Focused Authentication Canvas */}
      <div className="page-enter flex flex-col justify-center items-center px-4 py-8 sm:px-8 sm:py-12 bg-slate-50/70 dark:bg-background relative">
        {/* Subtle decorative glow for light mode canvas */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent opacity-70" />

        <div className="w-full max-w-[440px] relative z-10 rounded-2xl border border-slate-200/90 dark:border-border/80 bg-card/95 backdrop-blur-xl shadow-xl shadow-slate-900/5 p-7 sm:p-9">
          <div className="flex items-center gap-3">
            <span className="gradient-primary grid size-11 place-items-center rounded-xl text-primary-foreground shadow-sm">
              <Scale size={22} strokeWidth={1.8} />
            </span>
            <div>
              <p className="text-xs font-bold tracking-wider text-primary uppercase font-display">
                S &amp; S Associates
              </p>
              <p className="text-[11px] text-muted-foreground font-medium">Legal-Tech LLP</p>
            </div>
          </div>

          <div className="mt-6">
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">
              Enterprise Practice Portal
            </h1>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              Welcome back. Authenticate your credentials to access court listings, confidential matter records, and client communications.
            </p>
          </div>

          <form className="mt-7 space-y-4" onSubmit={submit} noValidate>
            {/* General Banner Error */}
            {generalError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2 animate-in fade-in-50">
                <AlertCircle size={16} className="shrink-0" />
                <span>{generalError}</span>
              </div>
            )}

            {/* Email Field with specific validation */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-foreground">
                Email address or username
              </Label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none" />
                <Input
                  id="email"
                  type="text"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError(null);
                  }}
                  placeholder="advocate@firm.legal"
                  className={`h-11 rounded-lg text-sm pl-10 pr-3 transition-colors bg-background ${
                    emailError
                      ? "border-destructive focus-visible:ring-destructive/30 bg-destructive/5"
                      : "border-input focus:border-primary"
                  }`}
                />
              </div>
              {emailError && (
                <p role="alert" className="text-xs text-destructive flex items-center gap-1 font-medium mt-1">
                  <AlertCircle size={13} className="shrink-0" />
                  {emailError}
                </p>
              )}
            </div>

            {/* Password Field with specific validation and show/hide toggle */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold text-foreground">
                  Password
                </Label>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-xs text-primary hover:underline font-medium transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError(null);
                  }}
                  placeholder="••••••••"
                  className={`h-11 rounded-lg text-sm pl-10 pr-10 transition-colors bg-background ${
                    passwordError
                      ? "border-destructive focus-visible:ring-destructive/30 bg-destructive/5"
                      : "border-input focus:border-primary"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground transition-colors p-1.5 rounded-md"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {passwordError && (
                <p role="alert" className="text-xs text-destructive flex items-center gap-1 font-medium mt-1">
                  <AlertCircle size={13} className="shrink-0" />
                  {passwordError}
                </p>
              )}
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2.5 text-xs text-muted-foreground font-medium cursor-pointer select-none">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
                />
                Remember my login on this device
              </label>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="gradient-primary h-11 w-full rounded-lg text-primary-foreground font-semibold shadow-soft hover:opacity-95 transition-all duration-150 active:scale-[0.98] mt-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin mr-2" />
                  Verifying credentials…
                </>
              ) : (
                <>
                  Sign in to workspace
                  <ArrowRight size={16} strokeWidth={2} className="ml-2" />
                </>
              )}
            </Button>
          </form>

          <ForgotPasswordDialog
            open={showForgotPassword}
            onClose={() => setShowForgotPassword(false)}
            onPasswordResetSuccess={(id) => {
              setEmail(id);
              setPassword("");
            }}
          />

          {/* StillWorks attribution — bundled logo with reliable fallback */}
          <div className="mt-8 flex items-center justify-center gap-2.5 border-t border-border/60 pt-5">
            <div className="flex items-center h-5">
              <img
                src={stillworksLogoLight}
                alt="StillWorks"
                className="h-5 w-auto object-contain dark:hidden"
                style={{ mixBlendMode: "multiply" }}
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = "none";
                }}
              />
              <img
                src={stillworksLogoDark}
                alt="StillWorks"
                className="hidden h-5 w-auto object-contain dark:block"
                style={{ mixBlendMode: "screen" }}
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = "none";
                }}
              />
            </div>
            <span className="text-xs font-medium text-muted-foreground tracking-wide">
              Developed by{" "}
              <a
                href="https://stillworks.in"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-foreground hover:text-primary transition-colors hover:underline"
              >
                stillworks.in
              </a>
            </span>
          </div>
        </div>
      </div>

      {/* Right Hero Panel — Edge-to-edge luxury legal showcase */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-950 p-12 xl:p-16 text-white border-l border-border/20">
        {/* Ambient light glows */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-primary/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />

        {/* Top Header Badge */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white/90 backdrop-blur-md shadow-sm">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>Enterprise Practice OS</span>
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
          </div>
          <div className="text-xs font-medium text-white/60 tracking-wider uppercase font-mono">
            S &amp; S Legal-Tech
          </div>
        </div>

        {/* Middle Value Proposition */}
        <div className="relative z-10 my-auto py-8">
          <h2 className="font-display text-3xl xl:text-4xl font-bold leading-tight text-white tracking-tight">
            Precision engineering for modern legal practices.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-white/80 max-w-lg">
            Seamlessly coordinate court proceedings, document compliance, team messaging, and client onboarding within a single, secure environment.
          </p>

          <div className="mt-8 space-y-3.5 border-t border-white/15 pt-6 text-xs text-white/90">
            <div className="flex items-center gap-3">
              <div className="grid size-6 place-items-center rounded-full bg-emerald-500/20 text-emerald-300 shrink-0">
                <CheckCircle2 size={15} />
              </div>
              <span className="font-medium">Comprehensive matter, hearing &amp; court milestone tracking</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="grid size-6 place-items-center rounded-full bg-emerald-500/20 text-emerald-300 shrink-0">
                <CheckCircle2 size={15} />
              </div>
              <span className="font-medium">Real-time team chat and verified document history</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="grid size-6 place-items-center rounded-full bg-emerald-500/20 text-emerald-300 shrink-0">
                <CheckCircle2 size={15} />
              </div>
              <span className="font-medium">Client onboarding, scheduled call alerts &amp; administrative controls</span>
            </div>
          </div>
        </div>

        {/* Bottom Jurisdiction & Security Status Card */}
        <div className="relative z-10 flex items-center justify-between rounded-xl bg-white/10 backdrop-blur-md p-4 border border-white/15 shadow-lg">
          <div>
            <p className="text-[11px] text-white/60 uppercase tracking-wider font-semibold">Firm Jurisdiction</p>
            <p className="text-sm font-semibold text-white mt-0.5">Bombay High Court &amp; City Civil</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-white/60 uppercase tracking-wider font-semibold">Data Security</p>
            <p className="text-sm font-semibold text-emerald-300 flex items-center gap-1.5 justify-end mt-0.5">
              <Lock size={13} /> Confidential &amp; Verified
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
