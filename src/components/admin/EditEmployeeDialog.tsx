import { useState, useEffect } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  useUpdateEmployee,
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
  const [role, setRole] = useState("junior_advocate");
  const [title, setTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("offline");
  const [permissions, setPermissions] = useState<UserPermissions>(DEFAULT_PERMISSIONS);

  const updateEmployee = useUpdateEmployee();
  const isPending = updateEmployee.isPending;
  const isError = updateEmployee.isError;

  useEffect(() => {
    if (employee) {
      setRole(employee.role);
      setTitle(employee.title ?? "");
      setPhone(employee.phone ?? "");
      setStatus(employee.status ?? "offline");
      setPermissions({
        ...DEFAULT_PERMISSIONS,
        ...(employee.permissions ?? {}),
      });
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
        data: { role, title: title.trim(), phone: phone.trim(), status, permissions },
      },
      {
        onSuccess: () => onClose(),
      },
    );
  };

  return (
    <Dialog open={!!employee} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit employee</DialogTitle>
          <DialogDescription>
            {employee.email}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-role" className="text-helper">Role</Label>
              <select
                id="edit-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="h-11 w-full rounded-md border border-border bg-background px-3 text-helper text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
                className="h-11 w-full rounded-md border border-border bg-background px-3 text-helper text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-title" className="text-helper">Title</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Senior Associate"
              className="h-11 rounded-md"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-phone" className="text-helper">Phone</Label>
            <Input
              id="edit-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91-XXXXXXXXXX"
              className="h-11 rounded-md"
            />
          </div>

          <div className="space-y-3">
            <Label className="text-helper">Module access</Label>
            <div className="rounded-md border border-border p-4">
              <p className="mb-3 text-caption font-medium text-muted-foreground">Core modules</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {CORE_PERMISSIONS.map((p) => (
                  <label key={p.key} className="flex items-center justify-between gap-2 py-0.5">
                    <span className="text-helper">{p.label}</span>
                    <Switch
                      checked={permissions[p.key]}
                      onCheckedChange={() => togglePermission(p.key)}
                    />
                  </label>
                ))}
              </div>
            </div>
            <div className="rounded-md border border-border p-4">
              <p className="mb-3 text-caption font-medium text-muted-foreground">Admin modules</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {ADMIN_PERMISSIONS.map((p) => (
                  <label key={p.key} className="flex items-center justify-between gap-2 py-0.5">
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="gradient-primary rounded-md text-primary-foreground shadow-soft"
            >
              {isPending ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} strokeWidth={2} />}
              {isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>

          {isError && (
            <p className="text-caption text-destructive">
              Failed to update employee. Please try again.
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}