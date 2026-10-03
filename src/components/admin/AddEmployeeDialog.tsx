import { useState } from "react";
import { UserPlus, Loader2, Copy, Check, KeyRound, ShieldCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateEmployee } from "@/services/admin";
import { validatePhone, sanitizePhone } from "@/lib/validation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const ROLES: { value: string; label: string }[] = [
  { value: "junior_advocate", label: "Junior Advocate" },
  { value: "senior_advocate", label: "Senior Advocate" },
  { value: "legal_assistant", label: "Legal Assistant" },
  { value: "office_staff", label: "Office Staff" },
  { value: "reception", label: "Reception" },
  { value: "intern", label: "Intern" },
  { value: "admin", label: "Administrator" },
];

interface FormState {
  name: string;
  email: string;
  role: string;
  title: string;
  phone: string;
  password: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  email: "",
  role: "junior_advocate",
  title: "",
  phone: "",
  password: "",
};

interface AddEmployeeDialogProps {
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AddEmployeeDialog({ open, onClose }: AddEmployeeDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{
    name: string;
    email: string;
    password: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const createEmployee = useCreateEmployee();
  const isPending = createEmployee.isPending;
  const isError = createEmployee.isError;

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    if (key === "phone") {
      setPhoneError(null);
    }
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleClose = () => {
    setForm(EMPTY_FORM);
    setPhoneError(null);
    setCreatedCredentials(null);
    setCopied(false);
    onClose();
  };

  const handleCopyCredentials = () => {
    if (!createdCredentials) return;
    const text = `LegalOS Account Credentials:\nEmail: ${createdCredentials.email}\nTemporary Password: ${createdCredentials.password}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Credentials copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;

    if (form.phone.trim()) {
      const pCheck = validatePhone(form.phone);
      if (!pCheck.valid) {
        setPhoneError(pCheck.error ?? "Invalid phone number");
        return;
      }
    }
    setPhoneError(null);

    createEmployee.mutate(
      {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        title: form.title.trim(),
        phone: form.phone.trim(),
        password: form.password.trim() || undefined,
      },
      {
        onSuccess: (data) => {
          const effectivePassword = data.tempPassword || form.password.trim();
          if (effectivePassword) {
            setCreatedCredentials({
              name: form.name.trim(),
              email: form.email.trim(),
              password: effectivePassword,
            });
          } else {
            handleClose();
          }
        },
      },
    );
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        {createdCredentials ? (
          /* Credentials Confirmation View */
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck size={22} />
              </span>
              <div>
                <DialogTitle className="text-lg font-semibold">Account Created</DialogTitle>
                <DialogDescription>
                  Team member account has been successfully provisioned.
                </DialogDescription>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
              <div className="text-xs space-y-1">
                <div className="text-muted-foreground font-medium">User</div>
                <div className="font-semibold text-foreground">{createdCredentials.name} ({createdCredentials.email})</div>
              </div>

              <div className="text-xs space-y-1">
                <div className="text-muted-foreground font-medium">Temporary Password</div>
                <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 font-mono text-sm font-semibold tracking-wider text-foreground">
                  <span>{createdCredentials.password}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyCredentials}
                    className="h-7 px-2 text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground"
                  >
                    {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Provide these initial credentials to the team member. For security, passwords should be kept strictly confidential.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                onClick={handleClose}
                className="gradient-primary w-full text-primary-foreground text-xs shadow-soft"
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          /* Create Form */
          <>
            <DialogHeader>
              <DialogTitle>Add employee</DialogTitle>
              <DialogDescription>
                Create a team member account with role permissions.
              </DialogDescription>
            </DialogHeader>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="emp-name" className="text-helper">Full name *</Label>
                <Input
                  id="emp-name"
                  required
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="e.g. Adv. Priya Nair"
                  className="h-10 rounded-md"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="emp-email" className="text-helper">Email *</Label>
                <Input
                  id="emp-email"
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="name@stillworks.legal"
                  className="h-10 rounded-md"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="emp-role" className="text-helper">Role</Label>
                  <select
                    id="emp-role"
                    value={form.role}
                    onChange={(e) => update("role", e.target.value)}
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="emp-title" className="text-helper">Title</Label>
                  <Input
                    id="emp-title"
                    value={form.title}
                    onChange={(e) => update("title", e.target.value)}
                    placeholder="e.g. Senior Associate"
                    className="h-10 rounded-md"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="emp-phone" className="text-helper">Phone</Label>
                <Input
                  id="emp-phone"
                  value={form.phone}
                  onChange={(e) => update("phone", sanitizePhone(e.target.value))}
                  placeholder="10-digit phone number"
                  className={`h-10 rounded-md ${phoneError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                />
                {phoneError && (
                  <p className="text-caption text-destructive flex items-center gap-1 font-medium">
                    <AlertCircle size={12} /> {phoneError}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="emp-password" className="text-helper">Initial password</Label>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <KeyRound size={11} /> Leave blank to auto-generate
                  </span>
                </div>
                <Input
                  id="emp-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  placeholder="Leave blank for secure auto-generation"
                  className="h-10 rounded-md font-mono text-xs"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" className="rounded-md" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isPending || !form.name.trim() || !form.email.trim()}
                  className="gradient-primary rounded-md text-primary-foreground shadow-soft"
                >
                  {isPending ? <Loader2 size={16} className="animate-spin mr-1.5" /> : <UserPlus size={16} strokeWidth={2} className="mr-1.5" />}
                  {isPending ? "Creating…" : "Create employee"}
                </Button>
              </DialogFooter>

              {isError && (
                <p className="text-caption text-destructive">
                  Failed to create employee. Check the email isn't already in use and try again.
                </p>
              )}
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}