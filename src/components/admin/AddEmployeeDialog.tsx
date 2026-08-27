import { useState } from "react";
import { UserPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateEmployee } from "@/services/admin";
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
  password: "password123",
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

  const createEmployee = useCreateEmployee();
  const isPending = createEmployee.isPending;
  const isError = createEmployee.isError;

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;

    createEmployee.mutate(
      {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        title: form.title.trim(),
        phone: form.phone.trim(),
        password: form.password || "password123",
      },
      {
        onSuccess: () => {
          setForm(EMPTY_FORM);
          onClose();
        },
      },
    );
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add employee</DialogTitle>
          <DialogDescription>
            Create a team member account. They can sign in with the email and password below.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="emp-name" className="text-helper">Full name *</Label>
            <Input
              id="emp-name"
              required
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. Adv. Priya Nair"
              className="h-11 rounded-md"
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
              className="h-11 rounded-md"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="emp-role" className="text-helper">Role</Label>
              <select
                id="emp-role"
                value={form.role}
                onChange={(e) => update("role", e.target.value)}
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
              <Label htmlFor="emp-title" className="text-helper">Title</Label>
              <Input
                id="emp-title"
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="e.g. Senior Associate"
                className="h-11 rounded-md"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emp-phone" className="text-helper">Phone</Label>
            <Input
              id="emp-phone"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="+91-XXXXXXXXXX"
              className="h-11 rounded-md"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emp-password" className="text-helper">Initial password</Label>
            <Input
              id="emp-password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              placeholder="password123"
              className="h-11 rounded-md"
            />
            <p className="text-caption text-muted-foreground">
              Share this with the employee — they can change it after their first sign-in.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-md" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !form.name.trim() || !form.email.trim()}
              className="gradient-primary rounded-md text-primary-foreground shadow-soft"
            >
              {isPending ? <Loader2 size={17} className="animate-spin" /> : <UserPlus size={17} strokeWidth={2} />}
              {isPending ? "Creating…" : "Create employee"}
            </Button>
          </DialogFooter>

          {isError && (
            <p className="text-caption text-destructive">
              Failed to create employee. Check the email isn't already in use and try again.
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}