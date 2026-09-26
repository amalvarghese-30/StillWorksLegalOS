import { useState, useEffect } from "react";
import { Loader2, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  useUpdateEmployee,
  useDeleteEmployee,
  type EmployeeRecord,
  type UserPermissions,
} from "@/services/admin";
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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("junior_advocate");
  const [title, setTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("offline");
  const [permissions, setPermissions] = useState<UserPermissions>(DEFAULT_PERMISSIONS);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const updateEmployee = useUpdateEmployee();
  const deleteEmployee = useDeleteEmployee();
  const isPending = updateEmployee.isPending;
  const isError = updateEmployee.isError;

  useEffect(() => {
    if (employee) {
      setName(employee.name || "");
      setEmail(employee.email || "");
      setRole(employee.role);
      setTitle(employee.title ?? "");
      setPhone(employee.phone ?? "");
      setStatus(employee.status ?? "offline");
      setPermissions({
        ...DEFAULT_PERMISSIONS,
        ...(employee.permissions ?? {}),
      });
      setShowDeleteConfirm(false);
    }
  }, [employee]);

  if (!employee) return null;

  const togglePermission = (key: keyof UserPermissions) =>
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
        },
      },
      {
        onSuccess: () => {
          toast.success("Employee updated successfully");
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
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91-XXXXXXXXXX"
                  className="h-10 rounded-md"
                />
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

            <DialogFooter className="flex items-center justify-between border-t border-border/60 pt-4">
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive rounded-md"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 size={15} className="mr-1.5" />
                Delete Employee
              </Button>
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
    </>
  );
}