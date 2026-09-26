import { useState } from "react";
import { Phone, Mail, KeyRound, Lock, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/services/api";
import { toast } from "sonner";

interface ForgotPasswordDialogProps {
  open: boolean;
  onClose: () => void;
  onPasswordResetSuccess?: (emailOrPhone: string) => void;
}

export function ForgotPasswordDialog({
  open,
  onClose,
  onPasswordResetSuccess,
}: ForgotPasswordDialogProps) {
  const [step, setStep] = useState<"request" | "verify">("request");
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maskedDestination, setMaskedDestination] = useState<string>("");
  const [devCode, setDevCode] = useState<string | null>(null);

  const resetState = () => {
    setStep("request");
    setIdentifier("");
    setOtp("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setMaskedDestination("");
    setDevCode(null);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetState();
      onClose();
    }
  };

  // Step 1: Request 6-digit OTP via phone / email
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError("Please enter your registered phone number or email");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.post<{
        success: boolean;
        message: string;
        destination: string;
        devOtp?: string;
      }>("/auth/forgot-password", {
        identifier: identifier.trim(),
        phone: identifier.trim(),
      });

      setMaskedDestination(res.destination || identifier);
      if (res.devOtp) {
        setDevCode(res.devOtp);
      }
      setStep("verify");
      toast.success(res.message || "Verification code sent!");
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Could not find an account with that information.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP and set new password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!otp.trim()) {
      setError("Please enter the 6-digit verification code");
      return;
    }

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.post<{ success: boolean; message: string }>("/auth/reset-password", {
        identifier: identifier.trim(),
        phone: identifier.trim(),
        otp: otp.trim(),
        newPassword,
      });

      toast.success(res.message || "Password updated successfully!");
      onPasswordResetSuccess?.(identifier);
      handleOpenChange(false);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Failed to reset password. Please check your code.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl border border-border bg-card p-6 shadow-lift">
        <DialogHeader className="border-b border-border/60 pb-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <KeyRound size={20} strokeWidth={1.75} />
            </span>
            <div>
              <DialogTitle className="text-title font-semibold text-foreground">
                {step === "request" ? "Reset your password" : "Enter verification code"}
              </DialogTitle>
              <DialogDescription className="text-helper text-muted-foreground">
                {step === "request"
                  ? "Enter your registered mobile number or email address."
                  : `We sent a 6-digit code to ${maskedDestination}.`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {error ? (
          <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-helper text-destructive" role="alert">
            {error}
          </div>
        ) : null}

        {step === "request" ? (
          <form onSubmit={handleRequestOtp} className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-identifier" className="text-helper font-medium">
                Mobile number or email
              </Label>
              <div className="relative">
                <Phone
                  size={16}
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="reset-identifier"
                  type="text"
                  placeholder="+91 98765 43210 or name@firm.legal"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (error) setError(null);
                  }}
                  className="h-11 rounded-md pl-10"
                  autoFocus
                />
              </div>
              <p className="text-[12px] text-muted-foreground">
                We'll verify your mobile number on file and generate a secure OTP.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="rounded-md"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || !identifier.trim()}
                className="gradient-primary rounded-md text-primary-foreground shadow-soft"
              >
                {loading ? <Loader2 size={16} className="animate-spin mr-1.5" /> : null}
                Send verification code
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="mt-4 space-y-4">
            {devCode ? (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
                <span>Verification code generated: <strong>{devCode}</strong></span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setOtp(devCode)}
                >
                  Auto-fill
                </Button>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="reset-otp" className="text-helper font-medium">
                6-digit verification code
              </Label>
              <Input
                id="reset-otp"
                type="text"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={(e) => {
                  setOtp(e.target.value.replace(/\D/g, ""));
                  if (error) setError(null);
                }}
                className="h-11 tracking-widest text-center font-mono text-base font-semibold rounded-md"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reset-new-password" className="text-helper font-medium">
                New password
              </Label>
              <div className="relative">
                <Lock
                  size={16}
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="reset-new-password"
                  type="password"
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  className="h-11 rounded-md pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reset-confirm-password" className="text-helper font-medium">
                Confirm new password
              </Label>
              <div className="relative">
                <Lock
                  size={16}
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="reset-confirm-password"
                  type="password"
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  className="h-11 rounded-md pl-10"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setStep("request")}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ← Back
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  className="rounded-md"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading || otp.length < 6 || !newPassword || !confirmPassword}
                  className="gradient-primary rounded-md text-primary-foreground shadow-soft"
                >
                  {loading ? <Loader2 size={16} className="animate-spin mr-1.5" /> : null}
                  Reset password
                </Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
