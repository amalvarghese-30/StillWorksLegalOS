import { useRef, useState } from "react";
import { Plus, Trash2, CheckSquare, PhoneCall, Loader2, ListChecks, UserRound, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useCreateTask, useTaskOptions, type CreateTaskPayload } from "@/services/tasks";
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

interface ChecklistLine {
  id: string;
  text: string;
}

interface FormState {
  title: string;
  description: string;
  category: string;
  priority: "High" | "Medium" | "Low";
  deadline: string;
  caseId: string;
  clientId: string;
  assignedTo: string;
  callClientName: string;
  callPhone: string;
  callScheduledAt: string;
  callNotes: string;
}

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  category: "",
  priority: "Medium",
  deadline: "",
  caseId: "",
  clientId: "",
  assignedTo: "",
  callClientName: "",
  callPhone: "",
  callScheduledAt: "",
  callNotes: "",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AddTaskDialogProps {
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

let checklistCounter = 0;
function nextId() {
  return `cl_${++checklistCounter}_${Date.now()}`;
}

export function AddTaskDialog({ open, onClose }: AddTaskDialogProps) {
  const { user } = useAuth();
  const { data: options } = useTaskOptions();

  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM, assignedTo: user?._id ?? "" });
  const [checklist, setChecklist] = useState<ChecklistLine[]>([]);
  const [addCallReminder, setAddCallReminder] = useState(false);
  const [agentSelect, setAgentSelect] = useState("");
  const [agentCustom, setAgentCustom] = useState("");
  const [appliedTemplates, setAppliedTemplates] = useState<string[]>([]);
  const templateInsertions = useRef<Record<string, string[]>>({});

  const createTask = useCreateTask();
  const isPending = createTask.isPending;
  const isError = createTask.isError;

  if (!open) return null;

  const categories = options?.categories ?? [];
  const templates = options?.checklistTemplates ?? [];
  const agents = options?.agents ?? [];
  const staff = (options?.staff ?? []).filter((s) => s._id !== (user?._id ?? ""));

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const addChecklistItem = () => {
    setChecklist((prev) => [...prev, { id: nextId(), text: "" }]);
  };

  const updateChecklistItem = (id: string, text: string) => {
    setChecklist((prev) => prev.map((cl) => (cl.id === id ? { ...cl, text } : cl)));
  };

  const removeChecklistItem = (id: string) => {
    setChecklist((prev) => prev.filter((cl) => cl.id !== id));
  };

  const toggleTemplate = (name: string) => {
    const isApplied = appliedTemplates.includes(name);
    if (isApplied) {
      const ids = templateInsertions.current[name] ?? [];
      setChecklist((prev) => prev.filter((cl) => !ids.includes(cl.id)));
      delete templateInsertions.current[name];
      setAppliedTemplates((prev) => prev.filter((t) => t !== name));
      return;
    }
    const tpl = templates.find((t) => t.name === name);
    if (!tpl) return;
    const newLines = tpl.items.map((text) => ({ id: nextId(), text }));
    templateInsertions.current[name] = newLines.map((l) => l.id);
    setChecklist((prev) => [...prev, ...newLines]);
    setAppliedTemplates((prev) => [...prev, name]);
  };

  const reset = () => {
    setForm({ ...EMPTY_FORM, assignedTo: user?._id ?? "" });
    setChecklist([]);
    setAddCallReminder(false);
    setAgentSelect("");
    setAgentCustom("");
    setAppliedTemplates([]);
    templateInsertions.current = {};
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    const finalAgent = agentSelect === "__other__" ? agentCustom.trim() : agentSelect;

    const payload: CreateTaskPayload = {
      title: form.title,
      ...(form.description && { description: form.description }),
      ...(form.category && { category: form.category }),
      priority: form.priority,
      ...(form.deadline && { deadline: form.deadline }),
      ...(form.caseId && { caseId: form.caseId }),
      ...(form.clientId && { clientId: form.clientId }),
      ...(form.assignedTo && { assignedTo: form.assignedTo }),
      ...(finalAgent && { agent: finalAgent }),
      ...(checklist.length > 0 && {
        checklist: checklist.map((cl) => ({ text: cl.text, done: false })),
      }),
      ...(addCallReminder && {
        callReminder: {
          clientName: form.callClientName,
          phone: form.callPhone,
          scheduledAt: form.callScheduledAt,
          notes: form.callNotes,
        },
      }),
    };

    createTask.mutate(payload, {
      onSuccess: () => {
        reset();
        onClose();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create task</DialogTitle>
          <DialogDescription>
            Add a task with subtasks and an optional call reminder.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-6" onSubmit={handleSubmit}>
          {/* ── Core details ── */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="task-title" className="text-helper">Task title *</Label>
              <Input
                id="task-title"
                required
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="e.g. File written statement"
                className="h-11 rounded-md"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="task-desc" className="text-helper">Description</Label>
              <Input
                id="task-desc"
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="What needs to be done"
                className="h-11 rounded-md"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-category" className="text-helper">Category</Label>
              <Select value={form.category} onValueChange={(v) => update("category", v)}>
                <SelectTrigger id="task-category" className="h-11 rounded-md">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-deadline" className="text-helper">Deadline</Label>
              <Input
                id="task-deadline"
                type="datetime-local"
                value={form.deadline}
                onChange={(e) => update("deadline", e.target.value)}
                className="h-11 rounded-md"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-assign" className="text-helper">Assign to</Label>
              <Select value={form.assignedTo} onValueChange={(v) => update("assignedTo", v)}>
                <SelectTrigger id="task-assign" className="h-11 rounded-md">
                  <SelectValue placeholder="Assign to" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={user?._id ?? "self"}>
                    <span className="flex items-center gap-2">
                      <UserRound size={14} /> Self
                    </span>
                  </SelectItem>
                  {staff.map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-helper">Priority</Label>
              <div className="flex rounded-md border border-border">
                {(["High", "Medium", "Low"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => update("priority", p)}
                    className={`flex-1 px-2.5 py-2 text-caption font-medium transition-colors ${p === "High" ? "rounded-l-md border-r" : p === "Low" ? "rounded-r-md border-l" : "border-r"
                      } border-border ${form.priority === p
                        ? p === "High"
                          ? "bg-destructive/10 text-destructive"
                          : p === "Medium"
                            ? "bg-warning/10 text-warning"
                            : "bg-muted text-muted-foreground"
                        : "text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="task-agent" className="text-helper">Broker / Agent (optional)</Label>
              <Select value={agentSelect} onValueChange={(v) => setAgentSelect(v)}>
                <SelectTrigger id="task-agent" className="h-11 rounded-md">
                  <SelectValue placeholder="Select an agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                  <SelectItem value="__other__">Other…</SelectItem>
                </SelectContent>
              </Select>
              {agentSelect === "__other__" && (
                <Input
                  value={agentCustom}
                  onChange={(e) => setAgentCustom(e.target.value)}
                  placeholder="Agent / broker name"
                  className="mt-2 h-11 rounded-md"
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-caseid" className="text-helper">Case ID (optional)</Label>
              <Input
                id="task-caseid"
                value={form.caseId}
                onChange={(e) => update("caseId", e.target.value)}
                placeholder="Link to a case"
                className="h-11 rounded-md"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-clientid" className="text-helper">Client ID (optional)</Label>
              <Input
                id="task-clientid"
                value={form.clientId}
                onChange={(e) => update("clientId", e.target.value)}
                placeholder="Link to a client"
                className="h-11 rounded-md"
              />
            </div>
          </div>

          {/* ── Quick checklist templates ── */}
          {templates.length > 0 && (
            <div className="rounded-lg border border-border p-4">
              <p className="mb-3 flex items-center gap-2 text-helper font-medium">
                <ListChecks size={16} strokeWidth={1.75} className="text-muted-foreground" />
                Quick checklist templates
              </p>
              <div className="flex flex-wrap gap-2">
                {templates.map((t) => {
                  const active = appliedTemplates.includes(t.name);
                  return (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => toggleTemplate(t.name)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-caption font-medium transition-colors ${active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        }`}
                    >
                      {active ? <BadgeCheck size={14} /> : <Plus size={14} />}
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Checklist ── */}
          <div className="rounded-lg border border-border">
            <div className="flex items-center justify-between px-4 py-3">
              <p className="flex items-center gap-2 text-helper font-medium">
                <CheckSquare size={16} strokeWidth={1.75} className="text-muted-foreground" />
                Subtask checklist
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-md"
                onClick={addChecklistItem}
              >
                <Plus size={14} /> Add item
              </Button>
            </div>
            {checklist.length > 0 && (
              <div className="border-t border-border p-4 space-y-2">
                {checklist.map((cl) => (
                  <div key={cl.id} className="flex items-center gap-2">
                    <Input
                      value={cl.text}
                      onChange={(e) => updateChecklistItem(cl.id, e.target.value)}
                      placeholder="Subtask description"
                      className="h-10 flex-1 rounded-md"
                    />
                    <button
                      type="button"
                      onClick={() => removeChecklistItem(cl.id)}
                      className="grid size-9 shrink-0 place-items-center rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Remove checklist item"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {checklist.length === 0 && (
              <div className="border-t border-border px-4 py-6 text-center text-helper text-muted-foreground">
                No subtasks yet. Add specific items that make up this task.
              </div>
            )}
          </div>

          {/* ── Call Reminder (optional) ── */}
          <div className="rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setAddCallReminder(!addCallReminder)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <p className="flex items-center gap-2 text-helper font-medium">
                <PhoneCall size={16} strokeWidth={1.75} className="text-muted-foreground" />
                Call reminder <span className="text-caption text-muted-foreground">(optional)</span>
              </p>
              <span className="text-caption text-muted-foreground">
                {addCallReminder ? "Added" : "Add"}
              </span>
            </button>
            {addCallReminder && (
              <div className="border-t border-border p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="call-name" className="text-helper">Client name</Label>
                    <Input
                      id="call-name"
                      value={form.callClientName}
                      onChange={(e) => update("callClientName", e.target.value)}
                      placeholder="Who to call"
                      className="h-11 rounded-md"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="call-phone" className="text-helper">Phone number</Label>
                    <Input
                      id="call-phone"
                      value={form.callPhone}
                      onChange={(e) => update("callPhone", e.target.value)}
                      placeholder="+91-XXXXXXXXXX"
                      className="h-11 rounded-md"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="call-schedule" className="text-helper">Scheduled for</Label>
                    <Input
                      id="call-schedule"
                      type="datetime-local"
                      value={form.callScheduledAt}
                      onChange={(e) => update("callScheduledAt", e.target.value)}
                      className="h-11 rounded-md"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="call-notes" className="text-helper">Notes</Label>
                    <Input
                      id="call-notes"
                      value={form.callNotes}
                      onChange={(e) => update("callNotes", e.target.value)}
                      placeholder="What to discuss"
                      className="h-11 rounded-md"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Actions ── */}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !form.title.trim()}
              className="gradient-primary rounded-md text-primary-foreground shadow-soft"
            >
              {isPending ? <Loader2 size={17} className="animate-spin" /> : <Plus size={17} strokeWidth={2} />}
              {isPending ? "Saving…" : "Create task"}
            </Button>
          </DialogFooter>

          {isError && (
            <p className="text-caption text-destructive">Failed to create task. Please try again.</p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}