import { useState } from "react";
import { PhoneCall, Loader2, CalendarClock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateTask, type CreateTaskPayload } from "@/services/tasks";
import { validatePhone, sanitizePhone } from "@/lib/validation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface QuickCallDialogProps {
  open: boolean;
  onClose: () => void;
}

const EMPTY = {
  name: "",
  phone: "",
  note: "",
  scheduledAt: "",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QuickCallDialog({ open, onClose }: QuickCallDialogProps) {
  const [form, setForm] = useState(EMPTY);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const createTask = useCreateTask();
  const isPending = createTask.isPending;
  const isError = createTask.isError;

  const update = (key: keyof typeof EMPTY, value: string) => {
    if (key === "phone") {
      setPhoneError(null);
    }
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleClose = () => {
    setForm(EMPTY);
    setPhoneError(null);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError(null);

    if (!form.name.trim()) {
      return;
    }

    if (form.phone.trim()) {
      const pCheck = validatePhone(form.phone);
      if (!pCheck.valid) {
        setPhoneError(pCheck.error ?? "Invalid phone number");
        return;
      }
    }

    if (!form.scheduledAt || !form.scheduledAt.trim()) {
      return;
    }

    const parsedDate = new Date(form.scheduledAt);
    if (isNaN(parsedDate.getTime())) {
      return;
    }

    const payload: CreateTaskPayload = {
      title: `📞 CALL: ${form.name.trim()}`,
      category: "Other Work",
      isCall: true,
      callReminder: {
        clientName: form.name.trim(),
        phone: form.phone.trim(),
        scheduledAt: parsedDate.toISOString(),
        notes: form.note.trim(),
      },
    };

    createTask.mutate(payload, {
      onSuccess: () => {
        setForm(EMPTY);
        setPhoneError(null);
        onClose();
      },
    });
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            <PhoneCall size={19} strokeWidth={1.75} className="text-primary" />
            Quick call reminder
          </DialogTitle>
          <DialogDescription>
            Log a follow-up call in one tap.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="call-name" className="text-helper">Contact name *</Label>
            <Input
              id="call-name"
              required
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Who to call"
              className="h-11 rounded-md"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="call-phone" className="text-helper">Phone number</Label>
            <Input
              id="call-phone"
              value={form.phone}
              onChange={(e) => update("phone", sanitizePhone(e.target.value))}
              placeholder="10-digit phone number"
              className={`h-11 rounded-md ${phoneError ? "border-destructive focus-visible:ring-destructive" : ""}`}
            />
            {phoneError && (
              <p className="text-caption text-destructive flex items-center gap-1 font-medium">
                <AlertCircle size={12} /> {phoneError}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="call-schedule" className="text-helper flex items-center gap-1.5">
              <CalendarClock size={14} strokeWidth={1.75} className="text-muted-foreground" />
              Remind me at
            </Label>
            <Input
              id="call-schedule"
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(e) => update("scheduledAt", e.target.value)}
              className="h-11 rounded-md"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="call-note" className="text-helper">Note</Label>
            <Input
              id="call-note"
              value={form.note}
              onChange={(e) => update("note", e.target.value)}
              placeholder="What to discuss"
              className="h-11 rounded-md"
            />
          </div>

          {isError && (
            <p className="text-caption text-destructive">Failed to create reminder. Please try again.</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !form.name.trim()}
              className="gradient-primary rounded-md text-primary-foreground shadow-soft"
            >
              {isPending ? <Loader2 size={17} className="animate-spin" /> : <PhoneCall size={17} strokeWidth={2} />}
              {isPending ? "Saving…" : "Create reminder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}