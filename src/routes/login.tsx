import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Scale, ArrowRight, Loader2, ShieldCheck, Lock, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth";
import { ForgotPasswordDialog } from "@/components/auth/ForgotPasswordDialog";
import { validateEmail } from "@/lib/validation";

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
      const result = await signIn(cleanEmail, password);
      if (!result.ok) {
        const errLower = (result.error || "").toLowerCase();
        if (errLower.includes("user not found") || errLower.includes("email") || errLower.includes("no account")) {
          setEmailError(result.error);
        } else if (errLower.includes("password") || errLower.includes("incorrect") || errLower.includes("credential")) {
          setPasswordError(result.error);
        } else {
          setGeneralError(result.error);
        }
        return;
      }

      // Persist or clean up "Remember me"
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
    <div className="app-canvas grid min-h-screen lg:grid-cols-2">
      <div className="page-enter flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3">
            <span className="gradient-primary grid size-12 place-items-center rounded-xl text-primary-foreground shadow-soft">
              <Scale size={24} strokeWidth={1.8} />
            </span>
            <div>
              <p className="text-caption font-semibold tracking-wide text-primary uppercase">
                S &amp; S Associates
              </p>
              <p className="text-xs text-muted-foreground font-medium">Legal-Tech LLP</p>
            </div>
          </div>

          <h1 className="mt-8 text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-display">
            Welcome to LegalOS
          </h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Securely sign in to access firm matters, case proceedings, and confidential client records.
          </p>

          <form className="mt-8 space-y-4" onSubmit={submit} noValidate>
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
                className={`h-11 rounded-lg text-sm transition-colors ${
                  emailError
                    ? "border-destructive focus-visible:ring-destructive/30 bg-destructive/5"
                    : "focus:border-primary"
                }`}
              />
              {emailError && (
                <p role="alert" className="text-xs text-destructive flex items-center gap-1 font-medium mt-1">
                  <AlertCircle size={13} className="shrink-0" />
                  {emailError}
                </p>
              )}
            </div>

            {/* Password Field with specific validation */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold text-foreground">
                  Password
                </Label>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Forgot password?
                </button>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError) setPasswordError(null);
                }}
                placeholder="••••••••"
                className={`h-11 rounded-lg text-sm transition-colors ${
                  passwordError
                    ? "border-destructive focus-visible:ring-destructive/30 bg-destructive/5"
                    : "focus:border-primary"
                }`}
              />
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
              className="gradient-primary h-11 w-full rounded-lg text-primary-foreground font-medium shadow-soft transition-all duration-150 active:scale-[0.98] mt-2"
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

          {/* StillWorks attribution — clean text with single-line logo */}
          <div className="mt-10 flex items-center justify-center gap-2 border-t border-border/40 pt-6">
            <img
              src="/stillworks-logo-light.jpg"
              alt="StillWorks"
              className="h-6 w-auto object-contain dark:hidden"
              style={{ mixBlendMode: "multiply" }}
            />
            <img
              src="/stillworks-logo-dark.jpg"
              alt="StillWorks"
              className="hidden h-6 w-auto object-contain dark:block"
              style={{ mixBlendMode: "screen" }}
            />
            <span className="text-xs font-semibold text-muted-foreground tracking-wide">
              Developed by <strong className="text-foreground font-bold">stillworks.in</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Right Hero Panel */}
      <div className="relative hidden items-center justify-center overflow-hidden p-12 lg:flex">
        <div className="gradient-primary absolute inset-6 rounded-3xl opacity-95" />
        <div className="glass relative w-full max-w-lg rounded-2xl p-10 shadow-2xl backdrop-blur-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
            <ShieldCheck size={14} /> Enterprise Practice OS
          </div>

          <h2 className="mt-6 font-display text-2xl font-bold leading-snug text-white">
            Precision engineering for modern legal practices.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/80">
            Seamlessly coordinate court proceedings, document compliance, team messaging, and client onboarding within a single, secure environment.
          </p>

          <div className="mt-8 space-y-3.5 border-t border-white/15 pt-6 text-xs text-white/85">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-300" />
              <span>Comprehensive matter, hearing &amp; court milestone tracking</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-300" />
              <span>Real-time team chat and verified document history</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-300" />
              <span>Client onboarding, scheduled call alerts &amp; administrative controls</span>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between rounded-xl bg-black/20 p-4 border border-white/10">
            <div>
              <p className="text-xs text-white/60">Firm Jurisdiction</p>
              <p className="text-sm font-semibold text-white">Bombay High Court &amp; City Civil</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/60">Data Security</p>
              <p className="text-sm font-semibold text-emerald-300 flex items-center gap-1 justify-end">
                <Lock size={12} /> Confidential &amp; Verified
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
