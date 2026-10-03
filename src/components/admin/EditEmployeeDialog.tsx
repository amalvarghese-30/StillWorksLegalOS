import { useState, useEffect } from "react";
import { Loader2, Save, Trash2, KeyRound, Copy, Check, ShieldAlert, Eye, EyeOff, Sparkles, Lock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { validatePhone, sanitizePhone } from "@/lib/validation";
import {
  useUpdateEmployee,
  useDeleteEmployee,
  useResetEmployeePassword,
  type EmployeeRecord,
  type UserPermissions,
} from "@/services/admin";
import { useAuth } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ---------------------------------------------------------------------------
// Constants
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

const STATUSES: { value: string; label: string }[] = [
  { value: "offline", label: "Offline" },
  { value: "online", label: "Online" },
  { value: "away", label: "Away" },
];

const CORE_PERMISSIONS: { key: keyof UserPermissions; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "clients", label: "Clients" },
  { key: "cases", label: "Cases" },
  { key: "tasks", label: "Tasks" },
  { key: "documents", label: "Documents" },
  { key: "calendar", label: "Calendar" },
  { key: "chat", label: "Chat" },
  { key: "reports", label: "Reports" },
];

const ADMIN_PERMISSIONS: { key: keyof UserPermissions; label: string }[] = [
  { key: "employees", label: "Employees" },
  { key: "approvals", label: "Approvals" },
  { key: "auditLogs", label: "Audit logs" },
  { key: "settings", label: "Admin settings" },
];

const DEFAULT_PERMISSIONS: UserPermissions = {
  dashboard: true,
  clients: true,
  cases: true,
  tasks: true,
  documents: true,
  calendar: true,
  chat: true,
  reports: true,
  employees: false,
  approvals: false,
  auditLogs: false,
  settings: false,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface EditEmployeeDialogProps {
  employee: EmployeeRecord | null;
  onClose: () => void;
}

export function EditEmployeeDialog({ employee, onClose }: EditEmployeeDialogProps) {
  if (!employee) return null;
  return <EditEmployeeDialogInner key={employee._id} employee={employee} onClose={onClose} />;
}

function EditEmployeeDialogInner({ employee, onClose }: { employee: EmployeeRecord; onClose: () => void }) {
  const { user: currentUser } = useAuth();
  const [name, setName] = useState(employee.name || "");
  const [email, setEmail] = useState(employee.email || "");
  const [role, setRole] = useState(employee.role);
  const [title, setTitle] = useState(employee.title ?? "");
  const [phone, setPhone] = useState(employee.phone ?? "");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [status, setStatus] = useState(employee.status ?? "offline");
  const [permissions, setPermissions] = useState<UserPermissions>({
    ...DEFAULT_PERMISSIONS,
    ...(employee.permissions ?? {}),
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Inline password update state
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);

  // Password reset modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetMode, setResetMode] = useState<"generate" | "manual">("generate");
  const [customPassword, setCustomPassword] = useState("");
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);

  const updateEmployee = useUpdateEmployee();
  const deleteEmployee = useDeleteEmployee();
  const resetPassword = useResetEmployeePassword();
  const isPending = updateEmployee.isPending;
  const isError = updateEmployee.isError;

  useEffect(() => {
    setName(employee.name || "");
    setEmail(employee.email || "");
    setRole(employee.role);
    setTitle(employee.title ?? "");
    setPhone(employee.phone ?? "");
    setPhoneError(null);
    setStatus(employee.status ?? "offline");
    setPermissions({
      ...DEFAULT_PERMISSIONS,
      ...(employee.permissions ?? {}),
    });
    setShowDeleteConfirm(false);
    setShowResetModal(false);
    setGeneratedPassword(null);
    setCustomPassword("");
    setHasCopied(false);
    setNewPassword("");
    setShowNewPassword(false);
    setPasswordCopied(false);
  }, [employee]);

  const togglePermission = (key: keyof UserPermissions) =>
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleGenerateRandomPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%*";
    const array = new Uint8Array(12);
    window.crypto.getRandomValues(array);
    const pass = Array.from(array, (byte) => chars[byte % chars.length]).join("");
    setNewPassword(pass);
    setShowNewPassword(true);
    setPasswordCopied(false);
    toast.info("Generated new temporary password");
  };

  const handleCopyNewPassword = () => {
    if (!newPassword) return;
    navigator.clipboard.writeText(newPassword);
    setPasswordCopied(true);
    toast.success("Password copied to clipboard");
    setTimeout(() => setPasswordCopied(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.trim() && newPassword.trim().length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }

    if (phone.trim()) {
      const pCheck = validatePhone(phone);
      if (!pCheck.valid) {
        setPhoneError(pCheck.error ?? "Invalid phone number");
        toast.error(pCheck.error ?? "Invalid phone number");
        return;
      }
    }
    setPhoneError(null);

    updateEmployee.mutate(
      {
        id: employee._id,
        data: {
          name: name.trim(),
          email: email.toLowerCase().trim(),
          role,
          title: title.trim(),
          phone: phone.trim(),
          status,
          permissions,
          ...(newPassword.trim() ? { password: newPassword.trim() } : {}),
        },
      },
      {
        onSuccess: () => {
          if (newPassword.trim()) {
            toast.success("Employee profile and password updated successfully");
          } else {
            toast.success("Employee updated successfully");
          }
          onClose();
        },
        onError: (err: any) => {
          toast.error(err?.message || "Failed to update employee");
        },
      },
    );
  };

  const handleDeleteEmployee = async () => {
    try {
      await deleteEmployee.mutateAsync(employee._id);
      toast.success("Employee removed successfully");
      setShowDeleteConfirm(false);
      onClose();
    } catch (err: any) {
      console.error("Failed to delete employee:", err);
      toast.error(err?.message || "Failed to delete employee");
    }
  };

  const handleResetPasswordSubmit = async () => {
    if (resetMode === "manual") {
      if (!customPassword || customPassword.length < 8) {
        toast.error("Password must be at least 8 characters");
        return;
      }
    }

    try {
      const res = await resetPassword.mutateAsync({
        id: employee._id,
        payload:
          resetMode === "manual"
            ? { mode: "manual", newPassword: customPassword }
            : { mode: "generate" },
      });
      setGeneratedPassword(res.temporaryPassword ?? customPassword);
      toast.success("Password reset successfully. Active sessions revoked.");
    } catch (err: any) {
      console.error("Failed to reset password:", err);
      toast.error(err?.message || "Failed to reset password");
    }
  };

  const handleCopyPassword = () => {
    if (generatedPassword) {
      navigator.clipboard.writeText(generatedPassword);
      setHasCopied(true);
      toast.success("Password copied to clipboard");
      setTimeout(() => setHasCopied(false), 2000);
    }
  };

  const isSelf = currentUser?._id === employee._id;

  return (
    <>
      <Dialog open={!!employee} onOpenChange={onClose}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-xl">
          <DialogHeader>
            <DialogTitle>Edit employee</DialogTitle>
            <DialogDescription>
              Update employee profile, contact details, and module access permissions.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-name" className="text-helper">Full Name</Label>
                <Input
                  id="edit-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  className="h-10 rounded-md"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-email" className="text-helper">Email Address</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="employee@stillworks.legal"
                  className="h-10 rounded-md"
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-role" className="text-helper">Role</Label>
                <select
                  id="edit-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-helper text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-status" className="text-helper">Status</Label>
                <select
                  id="edit-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-helper text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-title" className="text-helper">Title</Label>
                <Input
                  id="edit-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Senior Associate"
                  className="h-10 rounded-md"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-phone" className="text-helper">Phone</Label>
                <Input
                  id="edit-phone"
                  value={phone}
                  onChange={(e) => {
                    setPhone(sanitizePhone(e.target.value));
                    setPhoneError(null);
                  }}
                  placeholder="10-digit phone number"
                  className={`h-10 rounded-md ${phoneError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                />
                {phoneError && (
                  <p className="text-caption text-destructive flex items-center gap-1 font-medium">
                    <AlertCircle size={12} /> {phoneError}
                  </p>
                )}
              </div>
            </div>

            {/* Update Password Card */}
            <div className="rounded-lg border border-border/80 bg-muted/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="grid size-7 place-items-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <KeyRound size={15} />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-foreground">Update Password</Label>
                    <p className="text-[11px] text-muted-foreground">
                      Set a new login password for this employee
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1 px-2.5 text-muted-foreground hover:text-foreground"
                  onClick={handleGenerateRandomPassword}
                >
                  <Sparkles size={12} className="text-amber-500" />
                  Generate
                </Button>
              </div>

              <div className="space-y-1.5">
                <div className="relative">
                  <Input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setPasswordCopied(false);
                    }}
                    placeholder="Enter new password (min. 8 chars) or leave blank"
                    className="h-10 text-xs pr-20 font-mono bg-background"
                  />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                    {newPassword && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-foreground"
                        onClick={handleCopyNewPassword}
                        title="Copy password"
                      >
                        {passwordCopied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      title={showNewPassword ? "Hide password" : "Show password"}
                    >
                      {showNewPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </Button>
                  </div>
                </div>

                {newPassword ? (
                  <div className="flex items-center justify-between text-[11px] pt-0.5">
                    <span className={newPassword.length >= 8 ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-amber-600 dark:text-amber-400"}>
                      {newPassword.length >= 8 ? "✓ Ready to update (minimum 8 characters)" : "• Minimum 8 characters required"}
                    </span>
                    <span className="text-muted-foreground">
                      Will apply on Save changes
                    </span>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Leave blank to keep the current password unchanged.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-helper font-medium">Module Access Control</Label>
              <p className="text-caption text-muted-foreground">
                Unchecking any module will remove it from the employee's sidebar and block access.
              </p>
              <div className="rounded-md border border-border p-4 bg-background/50">
                <p className="mb-3 text-caption font-semibold text-muted-foreground uppercase tracking-wider">Core modules</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {CORE_PERMISSIONS.map((p) => (
                    <label key={p.key} className="flex items-center justify-between gap-2 py-0.5 cursor-pointer">
                      <span className="text-helper">{p.label}</span>
                      <Switch
                        checked={permissions[p.key]}
                        onCheckedChange={() => togglePermission(p.key)}
                      />
                    </label>
                  ))}
                </div>
              </div>
              <div className="rounded-md border border-border p-4 bg-background/50">
                <p className="mb-3 text-caption font-semibold text-muted-foreground uppercase tracking-wider">Admin modules</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {ADMIN_PERMISSIONS.map((p) => (
                    <label key={p.key} className="flex items-center justify-between gap-2 py-0.5 cursor-pointer">
                      <span className="text-helper">{p.label}</span>
                      <Switch
                        checked={permissions[p.key]}
                        onCheckedChange={() => togglePermission(p.key)}
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-border/60 pt-4">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive rounded-md"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 size={15} className="mr-1.5" />
                  Delete
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-md text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10 text-xs"
                  onClick={() => {
                    setGeneratedPassword(null);
                    setCustomPassword("");
                    setResetMode("generate");
                    setShowResetModal(true);
                  }}
                >
                  <KeyRound size={14} className="mr-1.5" />
                  Update Password (Modal)
                </Button>
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onClose} className="rounded-md">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  className="gradient-primary rounded-md text-primary-foreground shadow-soft"
                >
                  {isPending ? <Loader2 size={16} className="animate-spin mr-1.5" /> : <Save size={16} className="mr-1.5" />}
                  Save changes
                </Button>
              </div>
            </DialogFooter>

            {isError && (
              <p className="text-caption text-destructive">
                Failed to update employee. Please try again.
              </p>
            )}
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="rounded-xl border border-border bg-card p-6 shadow-lift max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-title font-semibold text-destructive flex items-center gap-2">
              <Trash2 size={18} />
              Delete Employee
            </AlertDialogTitle>
            <AlertDialogDescription className="text-helper text-muted-foreground mt-2">
              Are you sure you want to delete <span className="font-semibold text-foreground">"{employee.name}"</span>?
              This will remove their account and revoke all platform access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-5 flex justify-end gap-2">
            <AlertDialogCancel className="rounded-md" disabled={deleteEmployee.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteEmployee}
              disabled={deleteEmployee.isPending}
            >
              {deleteEmployee.isPending ? "Deleting…" : "Delete Employee"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Admin Update Password Dialog */}
      <Dialog open={showResetModal} onOpenChange={setShowResetModal}>
        <DialogContent className="max-w-md rounded-xl border border-border bg-card p-6 shadow-lift">
          <DialogHeader>
            <DialogTitle className="text-title font-semibold flex items-center gap-2">
              <KeyRound size={18} className="text-amber-500" />
              Update Password for {employee.name}
            </DialogTitle>
            <DialogDescription className="text-helper text-muted-foreground">
              This will update the login password for this employee and require them to sign in with new credentials.
            </DialogDescription>
          </DialogHeader>

          {generatedPassword ? (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-start gap-2.5">
                <ShieldAlert size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="text-xs text-foreground">
                  The password has been updated. Please share this new password securely with <span className="font-semibold">{employee.name}</span>. It will not be shown again.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">New Password</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={generatedPassword}
                    className="font-mono text-sm h-10 bg-muted/60"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    onClick={handleCopyPassword}
                    title="Copy password"
                  >
                    {hasCopied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                  </Button>
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  className="w-full gradient-primary text-primary-foreground rounded-md"
                  onClick={() => setShowResetModal(false)}
                >
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-xs font-medium">Password Option</Label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer">
                    <input
                      type="radio"
                      name="resetMode"
                      value="generate"
                      checked={resetMode === "generate"}
                      onChange={() => setResetMode("generate")}
                      className="text-primary"
                    />
                    Generate random secure password (Recommended)
                  </label>
                  <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer">
                    <input
                      type="radio"
                      name="resetMode"
                      value="manual"
                      checked={resetMode === "manual"}
                      onChange={() => setResetMode("manual")}
                      className="text-primary"
                    />
                    Set manual password
                  </label>
                </div>
              </div>

              {resetMode === "manual" && (
                <div className="space-y-1.5 pt-1">
                  <Label htmlFor="custom-pass" className="text-xs text-muted-foreground">
                    New Password (min 8 characters)
                  </Label>
                  <Input
                    id="custom-pass"
                    type="password"
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                    placeholder="Enter new password…"
                    className="h-9 rounded-md text-xs"
                  />
                </div>
              )}

              <DialogFooter className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowResetModal(false)}
                  disabled={resetPassword.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="gradient-primary text-primary-foreground rounded-md"
                  onClick={handleResetPasswordSubmit}
                  disabled={resetPassword.isPending}
                >
                  {resetPassword.isPending ? (
                    <Loader2 size={14} className="animate-spin mr-1.5" />
                  ) : (
                    <KeyRound size={14} className="mr-1.5" />
                  )}
                  Update Password
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}