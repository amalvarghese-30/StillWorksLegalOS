import { useRef, useState, useEffect, useMemo } from "react";
import { Plus, Trash2, CheckSquare, PhoneCall, Loader2, ListChecks, AlertCircle, FolderOpen, CornerDownRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validatePhone, sanitizePhone } from "@/lib/validation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { useCreateTask, useTaskOptions, type CreateTaskPayload } from "@/services/tasks";
import { useCategories } from "@/services/categories";
import { useCases } from "@/services/cases";
import { useClients } from "@/services/clients";
import { AddCaseDialog } from "@/components/cases/AddCaseDialog";
import { DiscardConfirmationDialog } from "@/components/ui/discard-confirmation-dialog";
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

interface ChecklistSubLine {
  id: string;
  text: string;
}

interface ChecklistLine {
  id: string;
  text: string;
  subItems?: ChecklistSubLine[];
}

interface FormState {
  title: string;
  description: string;
  category: string;
  priority: "High" | "Medium" | "Low";
  deadline: string;
  localPath: string;
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
  category: "Other Work",
  priority: "Medium",
  deadline: "",
  localPath: "",
  caseId: "",
  clientId: "",
  assignedTo: "",
  callClientName: "",
  callPhone: "",
  callScheduledAt: "",
  callNotes: "",
};

interface TaskFieldErrors {
  title?: string;
  description?: string;
  agent?: string;
  callClientName?: string;
  callPhone?: string;
  callScheduledAt?: string;
}

interface AddTaskDialogProps {
  open: boolean;
  onClose: () => void;
  initialCaseId?: string;
  initialClientId?: string;
}

let checklistCounter = 0;
function nextId() {
  return `cl_${++checklistCounter}_${Date.now()}`;
}

export function AddTaskDialog({ open, onClose, initialCaseId, initialClientId }: AddTaskDialogProps) {
  const { user } = useAuth();
  const { data: options } = useTaskOptions();
  const { data: categories = [] } = useCategories();
  const { data: casesData } = useCases({ limit: "100" });
  const { data: clientsData } = useClients({ limit: "100" });

  const [form, setForm] = useState<FormState>({
    ...EMPTY_FORM,
    assignedTo: user?._id ?? "",
    caseId: initialCaseId ?? "",
    clientId: initialClientId ?? "",
  });

  const [checklist, setChecklist] = useState<ChecklistLine[]>([]);
  const [addCallReminder, setAddCallReminder] = useState(false);
  const [agentSelect, setAgentSelect] = useState("");
  const [agentCustom, setAgentCustom] = useState("");
  const [fieldErrors, setFieldErrors] = useState<TaskFieldErrors>({});
  const [appliedTemplates, setAppliedTemplates] = useState<string[]>([]);
  const [manualCase, setManualCase] = useState(false);
  const [manualClient, setManualClient] = useState(false);
  const [showCreateCaseDialog, setShowCreateCaseDialog] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const templateInsertions = useRef<Record<string, string[]>>({});

  const createTask = useCreateTask();
  const isPending = createTask.isPending;
  const isError = createTask.isError;

  const templates = options?.checklistTemplates ?? [];
  const agents = options?.agents ?? [];
  const staff = (options?.staff ?? []).filter((s) => s._id !== (user?._id ?? ""));
  const cases = casesData?.cases ?? [];
  const clients = clientsData?.clients ?? [];

  useEffect(() => {
    if (open) {
      if (initialCaseId) setForm((prev) => ({ ...prev, caseId: initialCaseId }));
      if (initialClientId) setForm((prev) => ({ ...prev, clientId: initialClientId }));
    }
  }, [open, initialCaseId, initialClientId]);

  // Form dirty check
  const isDirty = useMemo(() => {
    return (
      Boolean(form.title.trim()) ||
      Boolean(form.description.trim()) ||
      form.category !== "Other Work" ||
      form.priority !== "Medium" ||
      Boolean(form.deadline) ||
      Boolean(form.localPath.trim()) ||
      Boolean(form.caseId && form.caseId !== initialCaseId) ||
      Boolean(form.clientId && form.clientId !== initialClientId) ||
      checklist.length > 0 ||
      addCallReminder ||
      Boolean(agentSelect) ||
      Boolean(agentCustom)
    );
  }, [form, checklist, addCallReminder, agentSelect, agentCustom, initialCaseId, initialClientId]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key in fieldErrors) {
      setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  const addChecklistItem = () => {
    setChecklist((prev) => [...prev, { id: nextId(), text: "", subItems: [] }]);
  };

  const updateChecklistItem = (id: string, text: string) => {
    setChecklist((prev) => prev.map((cl) => (cl.id === id ? { ...cl, text } : cl)));
  };

  const removeChecklistItem = (id: string) => {
    setChecklist((prev) => prev.filter((cl) => cl.id !== id));
  };

  const addSubItemToChecklist = (parentId: string) => {
    setChecklist((prev) =>
      prev.map((cl) =>
        cl.id === parentId
          ? {
              ...cl,
              subItems: [...(cl.subItems || []), { id: nextId(), text: "" }],
            }
          : cl
      )
    );
  };

  const updateSubItem = (parentId: string, subId: string, text: string) => {
    setChecklist((prev) =>
      prev.map((cl) =>
        cl.id === parentId
          ? {
              ...cl,
              subItems: (cl.subItems || []).map((s) => (s.id === subId ? { ...s, text } : s)),
            }
          : cl
      )
    );
  };

  const removeSubItem = (parentId: string, subId: string) => {
    setChecklist((prev) =>
      prev.map((cl) =>
        cl.id === parentId
          ? {
              ...cl,
              subItems: (cl.subItems || []).filter((s) => s.id !== subId),
            }
          : cl
      )
    );
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
    const newLines: ChecklistLine[] = tpl.items.map((text) => ({ id: nextId(), text, subItems: [] }));
    templateInsertions.current[name] = newLines.map((l) => l.id);
    setChecklist((prev) => [...prev, ...newLines]);
    setAppliedTemplates((prev) => [...prev, name]);
  };

  const reset = () => {
    setForm({
      ...EMPTY_FORM,
      assignedTo: user?._id ?? "",
      caseId: initialCaseId ?? "",
      clientId: initialClientId ?? "",
    });
    setChecklist([]);
    setAddCallReminder(false);
    setAgentSelect("");
    setAgentCustom("");
    setFieldErrors({});
    setAppliedTemplates([]);
    setManualCase(false);
    setManualClient(false);
    setShowDiscardConfirm(false);
    templateInsertions.current = {};
  };

  const handleAttemptClose = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      handleForceClose();
    }
  };

  const handleForceClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = (e: React.FormEvent, isAddAnother = false) => {
    e.preventDefault();
    const errors: TaskFieldErrors = {};

    const cleanTitle = form.title.trim();
    if (!cleanTitle) {
      errors.title = "Task title is required";
    } else if (cleanTitle.length > 200) {
      errors.title = "Task title cannot exceed 200 characters";
    }

    if (form.description && form.description.length > 5000) {
      errors.description = "Task description cannot exceed 5000 characters";
    }

    let finalAgent = "";
    if (agentSelect === "__other__") {
      const cleanCustom = agentCustom.trim();
      if (!cleanCustom) {
        errors.agent = "Please enter the broker / agent name";
      } else if (cleanCustom.length > 100) {
        errors.agent = "Agent name cannot exceed 100 characters";
      } else {
        finalAgent = cleanCustom;
      }
    } else if (agentSelect) {
      finalAgent = agentSelect;
    }

    if (addCallReminder) {
      if (!form.callClientName.trim()) {
        errors.callClientName = "Client name is required for call reminder";
      }
      if (form.callPhone.trim()) {
        const pCheck = validatePhone(form.callPhone);
        if (!pCheck.valid) {
          errors.callPhone = pCheck.error ?? "Invalid phone number";
        }
      }
      if (!form.callScheduledAt) {
        errors.callScheduledAt = "Please select a date and time for the reminder";
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    const payload: CreateTaskPayload = {
      title: cleanTitle,
      ...(form.description && { description: form.description.trim() }),
      category: form.category || "Other Work",
      priority: form.priority,
      ...(form.deadline && { deadline: form.deadline }),
      ...(form.localPath && { localPath: form.localPath.trim() }),
      ...(form.caseId && { caseId: form.caseId }),
      ...(form.clientId && { clientId: form.clientId }),
      ...(form.assignedTo && { assignedTo: form.assignedTo }),
      ...(finalAgent && { agent: finalAgent }),
      ...(checklist.length > 0 && {
        checklist: checklist
          .filter((cl) => cl.text.trim())
          .map((cl) => ({
            text: cl.text.trim(),
            done: false,
            subItems: (cl.subItems || [])
              .filter((s) => s.text.trim())
              .map((s) => ({ text: s.text.trim(), done: false })),
          })),
      }),
      ...(addCallReminder && {
        callReminder: {
          clientName: form.callClientName.trim(),
          phone: form.callPhone.trim(),
          scheduledAt: form.callScheduledAt,
          notes: form.callNotes.trim(),
        },
      }),
    };

    createTask.mutate(payload, {
      onSuccess: () => {
        toast.success(isAddAnother ? "Task created. Add next task below." : "Task created successfully.");
        if (isAddAnother) {
          reset();
        } else {
          handleForceClose();
        }
      },
      onError: (err: any) => {
        const msg = err?.body?.message ?? err?.message ?? "Failed to create task";
        toast.error(msg);
      },
    });
  };

  if (!open) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={(val) => !val && handleAttemptClose()}>
        <DialogContent
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            handleAttemptClose();
          }}
          className="max-h-[90vh] overflow-y-auto sm:max-w-2xl rounded-xl border border-border bg-card p-6 shadow-lift"
        >
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <CheckSquare size={20} strokeWidth={1.75} />
                </span>
                <div>
                  <DialogTitle className="text-title font-semibold text-foreground">
                    Create new task
                  </DialogTitle>
                  <DialogDescription className="text-helper text-muted-foreground">
                    Define deliverables, assign staff, subtasks, and deadlines.
                  </DialogDescription>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAttemptClose}
                className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>
          </DialogHeader>

          <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-5 pt-2">
            {/* ── Title ── */}
            <div className="space-y-1.5">
              <Label htmlFor="task-title" className="text-helper">
                Task title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="task-title"
                value={form.title}
                maxLength={200}
                onChange={(e) => update("title", e.target.value)}
                placeholder="e.g. Draft Written Statement for High Court matter"
                required
                className={`h-11 rounded-md ${fieldErrors.title ? "border-destructive focus-visible:ring-destructive" : ""}`}
              />
              {fieldErrors.title && (
                <p className="text-caption text-destructive font-medium">{fieldErrors.title}</p>
              )}
            </div>

            {/* ── Description ── */}
            <div className="space-y-1.5">
              <Label htmlFor="task-desc" className="text-helper">Description</Label>
              <textarea
                id="task-desc"
                value={form.description}
                maxLength={5000}
                onChange={(e) => update("description", e.target.value)}
                placeholder="Key requirements, client instructions, or relevant context…"
                rows={3}
                className={`w-full rounded-md border border-border bg-card px-3 py-2 text-helper outline-none transition-colors focus:border-primary resize-none ${fieldErrors.description ? "border-destructive" : ""}`}
              />
              {fieldErrors.description && (
                <p className="text-caption text-destructive font-medium">{fieldErrors.description}</p>
              )}
            </div>

            {/* ── Category & Priority ── */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="task-cat" className="text-helper">Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(val) => update("category", val)}
                >
                  <SelectTrigger id="task-cat" className="h-11 rounded-md">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="task-priority" className="text-helper">Priority</Label>
                <div className="flex h-11 rounded-md border border-border overflow-hidden">
                  {(["High", "Medium", "Low"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => update("priority", p)}
                      className={`flex-1 text-caption font-medium transition-colors border-r border-border last:border-r-0 ${
                        form.priority === p
                          ? p === "High"
                            ? "bg-destructive/10 text-destructive font-semibold"
                            : p === "Medium"
                            ? "bg-warning/10 text-warning font-semibold"
                            : "bg-muted text-foreground font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Deadline & Assignee ── */}
            <div className="grid gap-4 sm:grid-cols-2">
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
                <Label htmlFor="task-assigned" className="text-helper">Assigned to</Label>
                <Select
                  value={form.assignedTo}
                  onValueChange={(val) => update("assignedTo", val)}
                >
                  <SelectTrigger id="task-assigned" className="h-11 rounded-md">
                    <SelectValue placeholder="Select staff member" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {user && (
                      <SelectItem value={user._id}>
                        Self ({user.name})
                      </SelectItem>
                    )}
                    {staff.map((s) => (
                      <SelectItem key={s._id} value={s._id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ── Local Folder / File Path ── */}
            <div className="space-y-1.5">
              <Label htmlFor="task-localpath" className="text-helper flex items-center gap-1.5">
                <FolderOpen size={14} className="text-muted-foreground" />
                Local Folder / Document Path (Optional)
              </Label>
              <Input
                id="task-localpath"
                value={form.localPath}
                onChange={(e) => update("localPath", e.target.value)}
                placeholder="e.g. C:\LegalFiles\Tasks\Task-402 or /Users/shared/brief.docx"
                className="h-11 rounded-md"
              />
              <p className="text-xs text-muted-foreground">
                In desktop mode, clicking this path will directly open the file or directory in File Explorer / Finder.
              </p>
            </div>

            {/* ── Case & Client Linkage ── */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="task-caseid" className="text-helper">Case (optional)</Label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateCaseDialog(true)}
                      className="text-xs text-primary hover:underline font-normal"
                    >
                      + New Case
                    </button>
                    <span className="text-muted-foreground/60 text-xs">•</span>
                    <button
                      type="button"
                      onClick={() => setManualCase((prev) => !prev)}
                      className="text-xs text-primary hover:underline font-normal"
                    >
                      {manualCase ? "Select from list" : "Enter manually"}
                    </button>
                  </div>
                </div>
                {manualCase ? (
                  <Input
                    id="task-caseid"
                    value={form.caseId}
                    onChange={(e) => update("caseId", e.target.value)}
                    placeholder="Case number or ID"
                    className="h-11 rounded-md"
                  />
                ) : (
                  <Select
                    value={form.caseId || "none"}
                    onValueChange={(val) => {
                      if (val === "__manual__") {
                        setManualCase(true);
                      } else {
                        const selectedId = val === "none" ? "" : val;
                        update("caseId", selectedId);
                        if (selectedId && !form.clientId) {
                          const matchedCase = cases.find((c) => c._id === selectedId);
                          const primaryParty = matchedCase?.parties?.find((p) => p.clientId);
                          if (primaryParty?.clientId) {
                            const cid = typeof primaryParty.clientId === "object" ? (primaryParty.clientId as any)._id : primaryParty.clientId;
                            update("clientId", cid);
                          }
                        }
                      }
                    }}
                  >
                    <SelectTrigger id="task-caseid" className="h-11 rounded-md">
                      <SelectValue placeholder="Select linked case" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      <SelectItem value="none">None (General task)</SelectItem>
                      {cases.map((c) => (
                        <SelectItem key={c._id} value={c._id}>
                          {c.number ? `${c.number} — ` : ""}{c.title}
                        </SelectItem>
                      ))}
                      <SelectItem value="__manual__">+ Enter manually...</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="task-clientid" className="text-helper">Client (optional)</Label>
                  <button
                    type="button"
                    onClick={() => setManualClient((prev) => !prev)}
                    className="text-xs text-primary hover:underline font-normal"
                  >
                    {manualClient ? "Select from list" : "Enter manually"}
                  </button>
                </div>
                {manualClient ? (
                  <Input
                    id="task-clientid"
                    value={form.clientId}
                    onChange={(e) => update("clientId", e.target.value)}
                    placeholder="Client name or ID"
                    className="h-11 rounded-md"
                  />
                ) : (
                  <Select
                    value={form.clientId || "none"}
                    onValueChange={(val) => {
                      if (val === "__manual__") {
                        setManualClient(true);
                      } else {
                        update("clientId", val === "none" ? "" : val);
                      }
                    }}
                  >
                    <SelectTrigger id="task-clientid" className="h-11 rounded-md">
                      <SelectValue placeholder="Select linked client" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      <SelectItem value="none">None (No client)</SelectItem>
                      {clients.map((cl) => (
                        <SelectItem key={cl._id} value={cl._id}>
                          {cl.name} {cl.phone ? `(${cl.phone})` : ""}
                        </SelectItem>
                      ))}
                      <SelectItem value="__manual__">+ Enter manually...</SelectItem>
                    </SelectContent>
                  </Select>
                )}
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
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-caption font-medium transition-colors ${
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        }`}
                      >
                        <Plus size={14} />
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Subtask Checklist with Nested Sub-items ── */}
            <div className="rounded-lg border border-border">
              <div className="flex items-center justify-between px-4 py-3">
                <p className="flex items-center gap-2 text-helper font-medium">
                  <CheckSquare size={16} strokeWidth={1.75} className="text-muted-foreground" />
                  Subtask checklist (with nested steps)
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
                <div className="border-t border-border p-4 space-y-3">
                  {checklist.map((cl) => (
                    <div key={cl.id} className="space-y-2 rounded-md border border-border/70 bg-card p-3">
                      <div className="flex items-center gap-2">
                        <Input
                          value={cl.text}
                          onChange={(e) => updateChecklistItem(cl.id, e.target.value)}
                          placeholder="Checklist item description"
                          className="h-10 flex-1 font-medium rounded-md"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => addSubItemToChecklist(cl.id)}
                          className="h-10 text-xs text-primary hover:bg-primary/10"
                        >
                          <Plus size={13} className="mr-1" /> Sub-item
                        </Button>
                        <button
                          type="button"
                          onClick={() => removeChecklistItem(cl.id)}
                          className="grid size-9 shrink-0 place-items-center rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Remove checklist item"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      {/* Nested sub-items */}
                      {Array.isArray(cl.subItems) && cl.subItems.length > 0 && (
                        <div className="pl-6 space-y-1.5 border-l-2 border-primary/20 ml-2 mt-2">
                          {cl.subItems.map((sub) => (
                            <div key={sub.id} className="flex items-center gap-2">
                              <CornerDownRight size={13} className="text-muted-foreground shrink-0" />
                              <Input
                                value={sub.text}
                                onChange={(e) => updateSubItem(cl.id, sub.id, e.target.value)}
                                placeholder="Sub-step detail…"
                                className="h-8 text-xs rounded-md"
                              />
                              <button
                                type="button"
                                onClick={() => removeSubItem(cl.id, sub.id)}
                                className="grid size-7 shrink-0 place-items-center text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
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
                      <Label htmlFor="call-name" className="text-helper">Client name *</Label>
                      <Input
                        id="call-name"
                        maxLength={200}
                        value={form.callClientName}
                        onChange={(e) => update("callClientName", e.target.value)}
                        placeholder="Who to call"
                        className={`h-11 rounded-md ${fieldErrors.callClientName ? "border-destructive focus-visible:ring-destructive" : ""}`}
                      />
                      {fieldErrors.callClientName && (
                        <p className="text-caption text-destructive font-medium">{fieldErrors.callClientName}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="call-phone" className="text-helper">Phone number</Label>
                      <Input
                        id="call-phone"
                        maxLength={50}
                        value={form.callPhone}
                        onChange={(e) => update("callPhone", sanitizePhone(e.target.value))}
                        placeholder="10-digit phone number"
                        className={`h-11 rounded-md ${fieldErrors.callPhone ? "border-destructive focus-visible:ring-destructive" : ""}`}
                      />
                      {fieldErrors.callPhone && (
                        <p className="text-caption text-destructive font-medium flex items-center gap-1">
                          <AlertCircle size={12} /> {fieldErrors.callPhone}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="call-schedule" className="text-helper">Scheduled for *</Label>
                      <Input
                        id="call-schedule"
                        type="datetime-local"
                        value={form.callScheduledAt}
                        onChange={(e) => update("callScheduledAt", e.target.value)}
                        className={`h-11 rounded-md ${fieldErrors.callScheduledAt ? "border-destructive focus-visible:ring-destructive" : ""}`}
                      />
                      {fieldErrors.callScheduledAt && (
                        <p className="text-caption text-destructive font-medium">{fieldErrors.callScheduledAt}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="call-notes" className="text-helper">Notes</Label>
                      <Input
                        id="call-notes"
                        maxLength={2000}
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
            <DialogFooter className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleAttemptClose}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isPending || !form.title.trim()}
                onClick={(e) => handleSubmit(e, true)}
                className="rounded-md"
              >
                {isPending ? <Loader2 size={16} className="animate-spin mr-1.5" /> : <Plus size={16} className="mr-1.5" />}
                Create &amp; Add Another
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

        <AddCaseDialog
          open={showCreateCaseDialog}
          onClose={() => setShowCreateCaseDialog(false)}
          onCaseCreated={(newCase) => {
            update("caseId", newCase._id);
            setShowCreateCaseDialog(false);
          }}
        />
      </Dialog>

      <DiscardConfirmationDialog
        open={showDiscardConfirm}
        onOpenChange={setShowDiscardConfirm}
        onConfirmDiscard={handleForceClose}
        title="Discard unsaved task?"
        description="You have entered details for this task. If you close now, your input will be discarded."
      />
    </>
  );
}