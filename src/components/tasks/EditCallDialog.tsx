import { useState, useEffect } from "react";
import {
  PhoneCall,
  Loader2,
  CalendarClock,
  Clock,
  Phone,
  User,
  CheckCircle2,
  Circle,
  Copy,
  Trash2,
  Check,
  Briefcase,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { validatePhone, sanitizePhone } from "@/lib/validation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { useUpdateTask, useDeleteTask, type TaskRecord } from "@/services/tasks";
import { useEmployees } from "@/services/admin";
import { useCases } from "@/services/cases";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface EditCallDialogProps {
  open: boolean;
  onClose: () => void;
  task: TaskRecord | null;
}

export function EditCallDialog({ open, onClose, task }: EditCallDialogProps) {
  if (!open || !task) return null;
  return <EditCallDialogInner key={task._id} open={open} onClose={onClose} task={task} />;
}

function EditCallDialogInner({ open, onClose, task }: { open: boolean; onClose: () => void; task: TaskRecord }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState("");
  const [completed, setCompleted] = useState(false);
  const [assignedTo, setAssignedTo] = useState("");
  const [caseId, setCaseId] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data: empData } = useEmployees(undefined, { enabled: isAdmin });
  const employees = empData?.employees ?? [];
  const { data: casesData } = useCases({ limit: "100" });
  const cases = casesData?.cases ?? [];

  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  useEffect(() => {
    if (task) {
      const cr = task.callReminder;
      setName(cr?.clientName || task.title.replace(/^📞\s*CALL:\s*/i, "") || "");
      setPhone(cr?.phone || "");

      const schedTime = cr?.scheduledAt ? new Date(cr.scheduledAt) : task.deadline ? new Date(task.deadline) : new Date();
      // Format to YYYY-MM-DDTHH:mm for datetime-local input
      const localIso = new Date(schedTime.getTime() - schedTime.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setScheduledAt(localIso);

      setNotes(cr?.notes || task.description || "");
      setCompleted(Boolean(cr?.completed || task.status === "completed"));
      setAssignedTo(task.assignedTo?._id || "");

      const cId =
        task.caseId && typeof task.caseId === "object"
          ? (task.caseId as { _id: string })._id
          : task.caseId || "";
      setCaseId(cId);
    }
  }, [task]);

  const applyQuickTime = (type: "15m" | "1h" | "tomorrow-10am" | "tomorrow-3pm") => {
    const now = new Date();
    let target = new Date();
    if (type === "15m") {
      target = new Date(now.getTime() + 15 * 60 * 1000);
    } else if (type === "1h") {
      target = new Date(now.getTime() + 60 * 60 * 1000);
    } else if (type === "tomorrow-10am") {
      target.setDate(target.getDate() + 1);
      target.setHours(10, 0, 0, 0);
    } else if (type === "tomorrow-3pm") {
      target.setDate(target.getDate() + 1);
      target.setHours(15, 0, 0, 0);
    }
    const localIso = new Date(target.getTime() - target.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setScheduledAt(localIso);
    toast.info("Rescheduled time set");
  };

  const applyDidNotPickUp = (mins = 30) => {
    const now = new Date();
    const target = new Date(now.getTime() + mins * 60 * 1000);
    const localIso = new Date(target.getTime() - target.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setScheduledAt(localIso);
    const noteLine = `[Did not pick up call on ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}]`;
    setNotes((prev) => (prev ? `${prev}\n${noteLine}` : noteLine));
    toast.info(`Rescheduled for +${mins}m (Did not pick up note added)`);
  };

  const handleCopyPhone = () => {
    if (phone) {
      navigator.clipboard.writeText(phone);
      toast.success("Phone number copied to clipboard");
    }
  };

  const handleToggleCompleted = async () => {
    const nextCompleted = !completed;
    setCompleted(nextCompleted);
    try {
      await updateTask.mutateAsync({
        id: task._id,
        data: {
          status: nextCompleted ? "completed" : "pending",
          callReminder: {
            clientName: name.trim() || task.title,
            phone: phone.trim(),
            scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : new Date().toISOString(),
            notes: notes.trim(),
            completed: nextCompleted,
          },
        },
      });
      toast.success(nextCompleted ? "Call marked as completed!" : "Call marked as pending");
    } catch {
      setCompleted(!nextCompleted);
      toast.error("Failed to update status");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter a contact or client name");
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

    if (!scheduledAt || !scheduledAt.trim()) {
      toast.error("Please select a date and time for the reminder.");
      return;
    }

    const parsedDate = new Date(scheduledAt);
    if (isNaN(parsedDate.getTime())) {
      toast.error("Please enter a valid date and time.");
      return;
    }

    try {
      const scheduledIso = parsedDate.toISOString();
      await updateTask.mutateAsync({
        id: task._id,
        data: {
          title: `📞 CALL: ${name.trim()}`,
          description: notes.trim(),
          deadline: scheduledIso,
          status: completed ? "completed" : "pending",
          assignedTo: assignedTo || undefined,
          caseId: caseId.trim() ? caseId.trim() : null,
          callReminder: {
            clientName: name.trim(),
            phone: phone.trim(),
            scheduledAt: scheduledIso,
            notes: notes.trim(),
            completed,
          },
        },
      });
      toast.success("Call reminder updated successfully");
      onClose();
    } catch (err: any) {
      console.error("[EditCallDialog] Failed to update call reminder:", err);
      toast.error(err?.message || "We couldn't update the reminder. Please try again.");
    }
  };

  const handleDelete = async () => {
    try {
      const res = await deleteTask.mutateAsync(task._id);
      if (res?.alreadyDeleted) {
        toast.info("Reminder was already deleted or is no longer available.");
      } else {
        toast.success("Call reminder deleted");
      }
      setShowDeleteConfirm(false);
      onClose();
    } catch (err: any) {
      if (err?.status === 404 || err?.message?.includes("not found")) {
        toast.info("Reminder was already deleted or is no longer available.");
        setShowDeleteConfirm(false);
        onClose();
        return;
      }
      toast.error("Failed to delete reminder");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto rounded-xl p-0 border border-border bg-card shadow-lift">
          <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent px-6 py-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-lg bg-amber-500 text-white shadow-sm">
                  <PhoneCall size={18} strokeWidth={2} />
                </span>
                <div>
                  <DialogTitle className="text-base font-semibold text-foreground leading-tight">
                    Edit Call Reminder
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Update scheduled time, client details, notes, or mark as done.
                  </DialogDescription>
                </div>
              </div>

              {/* Status quick toggle */}
              <button
                type="button"
                onClick={handleToggleCompleted}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                  completed
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                    : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                }`}
              >
                {completed ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                {completed ? "Completed" : "Pending"}
              </button>
            </div>
          </div>

          <form className="divide-y divide-border" onSubmit={handleSubmit}>
            {/* ── SECTION 1: CONTACT DETAILS ── */}
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Client Contact</span>
                <div className="flex-1 h-px bg-border/60" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-call-name" className="text-xs font-medium text-foreground">
                  Contact / Client Name *
                </Label>
                <div className="relative">
                  <User size={15} className="absolute left-3 top-3 text-muted-foreground" />
                  <Input
                    id="edit-call-name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="h-10 pl-9 rounded-md"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-call-phone" className="text-xs font-medium text-foreground">
                  Phone Number
                </Label>
                <div className="relative flex items-center">
                  <Phone size={15} className="absolute left-3 text-muted-foreground" />
                  <Input
                    id="edit-call-phone"
                    value={phone}
                    onChange={(e) => {
                      setPhone(sanitizePhone(e.target.value));
                      setPhoneError(null);
                    }}
                    placeholder="10-digit phone number"
                    className={`h-10 pl-9 pr-16 rounded-md font-mono ${phoneError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  />
                  {phone && (
                    <div className="absolute right-1.5 flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleCopyPhone}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        title="Copy phone"
                      >
                        <Copy size={13} />
                      </Button>
                      <a
                        href={`tel:${phone}`}
                        className="grid size-7 place-items-center rounded bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                        title="Call now"
                      >
                        <PhoneCall size={12} />
                      </a>
                    </div>
                  )}
                </div>
                {phoneError && (
                  <p className="text-caption text-destructive flex items-center gap-1 font-medium mt-1">
                    <AlertCircle size={12} /> {phoneError}
                  </p>
                )}
              </div>
            </div>

            </div>{/* end contact section */}

            {/* ── SECTION 2: SCHEDULE & AGENDA ── */}
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Schedule &amp; Discussion</span>
                <div className="flex-1 h-px bg-border/60" />
              </div>

            {/* Scheduled Date & Time */}
            <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-call-schedule" className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                  <CalendarClock size={15} className="text-amber-500" />
                  Scheduled Call Time
                </Label>
                <span className="text-[11px] text-muted-foreground">Exact beep alarm trigger</span>
              </div>
              <Input
                id="edit-call-schedule"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="h-10 rounded-md font-mono text-sm bg-card"
              />

              {/* Quick reschedule pills */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] text-muted-foreground mr-1">Quick reschedule:</span>
                <button
                  type="button"
                  onClick={() => applyDidNotPickUp(30)}
                  className="rounded-md border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-colors"
                >
                  📞 Didn&apos;t Pick Up (+30m)
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickTime("15m")}
                  className="rounded-md border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-foreground hover:border-primary/50 transition-colors"
                >
                  +15 min
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickTime("1h")}
                  className="rounded-md border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-foreground hover:border-primary/50 transition-colors"
                >
                  +1 hour
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickTime("tomorrow-10am")}
                  className="rounded-md border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-foreground hover:border-primary/50 transition-colors"
                >
                  Tomorrow 10 AM
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickTime("tomorrow-3pm")}
                  className="rounded-md border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-foreground hover:border-primary/50 transition-colors"
                >
                  Tomorrow 3 PM
                </button>
              </div>
            </div>

            {/* Notes / Agenda */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-call-notes" className="text-xs font-medium text-foreground">
                Discussion Agenda & Notes
              </Label>
              <Textarea
                id="edit-call-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Key points, settlement discussion, hearing update, or questions..."
                rows={3}
                className="rounded-md resize-none text-sm"
              />
            </div>

            </div>{/* end schedule section */}

            {/* ── SECTION 3: MATTER & COMPLETION ── */}
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Matter Linkage</span>
                <div className="flex-1 h-px bg-border/60" />
              </div>

            {/* Linked Case (optional) */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-call-case" className="text-xs font-medium text-foreground flex items-center gap-1">
                  <Briefcase size={13} className="text-muted-foreground" />
                  Linked Case (optional)
                </Label>
                <select
                  id="edit-call-case"
                  value={caseId}
                  onChange={(e) => setCaseId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-xs ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">None / Standalone Call</option>
                  {cases.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.number ? `${c.number} — ` : ""}{c.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Assignee (if admin) */}
              {isAdmin && (
                <div className="space-y-1.5">
                  <Label htmlFor="edit-call-assigned" className="text-xs font-medium text-foreground flex items-center gap-1">
                    <User size={13} className="text-muted-foreground" />
                    Assigned To
                  </Label>
                  <select
                    id="edit-call-assigned"
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-xs ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="">Unassigned</option>
                    {employees.map((emp) => (
                      <option key={emp._id} value={emp._id}>
                        {emp.name} ({emp.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Mark as Completed checkbox */}
            <div className="flex items-center gap-2 rounded-lg border border-border/80 bg-background/50 p-3">
              <Checkbox
                id="edit-call-done"
                checked={completed}
                onCheckedChange={(c) => setCompleted(Boolean(c))}
              />
              <Label
                htmlFor="edit-call-done"
                className="cursor-pointer text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Mark this call as completed
              </Label>
            </div>

            </div>{/* end matter section */}

            {/* ── ACTIONS FOOTER ── */}
            <div className="px-6 py-4 bg-muted/20 border-t border-border">
              <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                {isAdmin ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-destructive hover:bg-destructive/10 border-destructive/30"
                  >
                    <Trash2 size={14} className="mr-1.5" /> Delete
                  </Button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={updateTask.isPending}
                    className="gradient-primary text-primary-foreground min-w-24 shadow-soft"
                  >
                    {updateTask.isPending ? (
                      <>
                        <Loader2 size={14} className="mr-1.5 animate-spin" /> Saving...
                      </>
                    ) : (
                      <>
                        <Check size={14} className="mr-1.5" /> Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </DialogFooter>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation alert */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Call Reminder</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this call reminder for{" "}
              <strong className="text-foreground">{name || task.title}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
