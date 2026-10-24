import { useRef, useState, useEffect, useMemo } from "react";
import { Plus, Trash2, CheckSquare, PhoneCall, Loader2, ListChecks, AlertCircle, FolderOpen, CornerDownRight, X, Search, Check, MessageSquare } from "lucide-react";
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
import { AssigneeMultiSelect } from "@/components/common/AssigneeMultiSelect";
import { toast } from "sonner";
import { useCreateTask, useTaskOptions, type CreateTaskPayload } from "@/services/tasks";
import { useCategories, useCategoryTree } from "@/services/categories";
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
  initialNote: string;
  mainCategory: string;
  subCategory: string;
  selectedSubCategories: string[];
  customCategory: string;
  category: string;
  priority: "High" | "Medium" | "Low";
  deadline: string;
  localPath: string;
  caseId: string;
  clientId: string;
  assignedTo: string[];
  callClientName: string;
  callPhone: string;
  callScheduledAt: string;
  callNotes: string;
}

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  initialNote: "",
  mainCategory: "",
  subCategory: "",
  selectedSubCategories: [],
  customCategory: "",
  category: "Other Work",
  priority: "Medium",
  deadline: "",
  localPath: "",
  caseId: "",
  clientId: "",
  assignedTo: [],
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
  const { data: treeData = [], isLoading: isCategoriesLoading, isError: isCategoriesError } = useCategoryTree();
  const { data: casesData } = useCases({ limit: "100" });
  const { data: clientsData } = useClients({ limit: "100" });

  const categoryTree = Array.isArray(treeData) ? treeData : ((treeData as any)?.tree ?? []);

  const [form, setForm] = useState<FormState>({
    ...EMPTY_FORM,
    assignedTo: user?._id ? [user._id] : [],
    caseId: initialCaseId ?? "",
    clientId: initialClientId ?? "",
  });

  const [checklist, setChecklist] = useState<ChecklistLine[]>([]);
  const [addCallReminder, setAddCallReminder] = useState(false);
  const [agentSelect, setAgentSelect] = useState("");
  const [agentCustom, setAgentCustom] = useState("");
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [fieldErrors, setFieldErrors] = useState<TaskFieldErrors>({});
  const [appliedTemplates, setAppliedTemplates] = useState<string[]>([]);
  const [manualCase, setManualCase] = useState(false);
  const [showCreateCaseDialog, setShowCreateCaseDialog] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const templateInsertions = useRef<Record<string, string[]>>({});

  const isAdmin = user?.role === "admin" || Boolean(user?.permissions?.approvals);
  const selectedCategoryNode = categoryTree.find((n) => n.name === form.mainCategory);
  const subCategories = selectedCategoryNode?.children ?? [];

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
      Boolean(form.mainCategory) ||
      Boolean(form.subCategory) ||
      form.selectedSubCategories.length > 0 ||
      Boolean(form.customCategory.trim()) ||
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

  const addSubCategoryToChecklist = (subCatName: string) => {
    const trimmed = subCatName.trim();
    if (!trimmed) return;
    // Prevent duplicate exact step if already in checklist
    if (checklist.some((c) => c.text.toLowerCase() === trimmed.toLowerCase())) {
      toast.info(`"${trimmed}" is already in the checklist`);
      return;
    }
    setChecklist((prev) => [...prev, { id: nextId(), text: trimmed, subItems: [] }]);
    toast.success(`Added "${trimmed}" to checklist`);
  };

  const addAllSubCategoriesToChecklist = () => {
    if (!subCategories || subCategories.length === 0) return;
    const existingTexts = new Set(checklist.map((c) => c.text.toLowerCase()));
    const toAdd = subCategories
      .map((sc) => sc.name.trim())
      .filter((name) => name && !existingTexts.has(name.toLowerCase()));
    if (toAdd.length === 0) {
      toast.info("All subcategories are already in the checklist");
      return;
    }
    const newItems: ChecklistLine[] = toAdd.map((text) => ({ id: nextId(), text, subItems: [] }));
    setChecklist((prev) => [...prev, ...newItems]);
    toast.success(`Added ${newItems.length} subcategory checklist step(s)`);
  };

  const addStandardMilestonesToChecklist = (workTypeName?: string) => {
    const target = (workTypeName || form.subCategory || form.mainCategory || "Standard").trim();
    const standardMilestones = [
      `1. Document & KYC Verification (${target})`,
      `2. Legal Drafting & Client Review (${target})`,
      `3. Stamp Duty, Fee & Franking Calculation`,
      `4. Execution & Signatures`,
      `5. Authority / Sub-Registrar / CIDCO Submission`,
      `6. Final Receipt, Index II / Order Verification & Delivery`,
    ];
    const existingTexts = new Set(checklist.map((c) => c.text.toLowerCase()));
    const toAdd = standardMilestones.filter((m) => !existingTexts.has(m.toLowerCase()));
    if (toAdd.length === 0) {
      toast.info("Standard milestones already present");
      return;
    }
    const newItems: ChecklistLine[] = toAdd.map((text) => ({ id: nextId(), text, subItems: [] }));
    setChecklist((prev) => [...prev, ...newItems]);
    toast.success(`Added ${newItems.length} procedural milestone checklist step(s)`);
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
    setClientSearchQuery("");
    setFieldErrors({});
    setAppliedTemplates([]);
    setManualCase(false);
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

    const chosenSubCategory =
      form.selectedSubCategories.length > 0
        ? form.selectedSubCategories.join(", ")
        : form.subCategory === "__other__"
        ? ""
        : form.subCategory;

    const chosenCategory =
      form.customCategory.trim() ||
      chosenSubCategory ||
      (form.mainCategory === "__other__" ? "Other Work" : form.mainCategory) ||
      form.category ||
      "Other Work";

    const payload: CreateTaskPayload = {
      title: cleanTitle,
      ...(form.description && { description: form.description.trim() }),
      mainCategory: form.mainCategory === "__other__" ? "Other Work" : (form.mainCategory || undefined),
      subCategory: chosenSubCategory || undefined,
      categoryPath: [form.mainCategory, ...form.selectedSubCategories].filter(Boolean),
      customCategory: form.customCategory.trim() || undefined,
      category: chosenCategory,
      priority: form.priority,
      ...(form.deadline && { deadline: form.deadline }),
      ...(form.localPath && { localPath: form.localPath.trim() }),
      ...(form.caseId && { caseId: form.caseId }),
      ...(form.clientId && { clientId: form.clientId }),
      ...(form.assignedTo && form.assignedTo.length > 0 && {
        assignedTo: form.assignedTo,
        assignedUsers: form.assignedTo,
      }),
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
      ...(form.initialNote?.trim() && { remark: form.initialNote.trim() }),
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
          className="max-h-[90vh] overflow-y-auto sm:max-w-3xl rounded-xl border border-border bg-card shadow-lift"
        >
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-6 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <CheckSquare size={18} strokeWidth={2} />
              </span>
              <div>
                <DialogTitle className="text-base font-semibold text-foreground leading-tight">
                  Create new task
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Define deliverables, assign staff, milestones, and deadlines.
                </DialogDescription>
              </div>
            </div>
          </div>

          <form onSubmit={(e) => handleSubmit(e, false)} className="divide-y divide-border">
            {/* ── TASK DETAILS SECTION ── */}
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Task Details</span>
                <div className="flex-1 h-px bg-border/60" />
              </div>

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

            {/* ── Important Message / Note / Remark ── */}
            <div className="space-y-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="task-initial-note" className="text-helper font-semibold flex items-center gap-1.5 text-foreground">
                  <MessageSquare size={14} className="text-amber-500" />
                  Important Message / Note / Remark (Optional)
                </Label>
                <span className="text-[11px] text-muted-foreground">Logged with staff name &amp; date/time</span>
              </div>
              <textarea
                id="task-initial-note"
                value={form.initialNote}
                maxLength={5000}
                onChange={(e) => update("initialNote", e.target.value)}
                placeholder="Add special instructions, client remarks, or urgent notes for staff members (visible in comment thread)…"
                rows={3}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-helper outline-none transition-colors focus:border-primary resize-none placeholder:text-muted-foreground/70"
              />
            </div>

            </div>{/* end TASK DETAILS section */}

            {/* ── CLASSIFICATION & SCHEDULE SECTION ── */}
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Classification &amp; Assignment</span>
                <div className="flex-1 h-px bg-border/60" />
              </div>

            {/* ── Category Hierarchy (Excel Master) ── */}
            <div className="space-y-4 rounded-lg border border-border/80 bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Category &amp; Classification
                </span>
                <span className="text-[11px] text-muted-foreground">Derived from Service Master</span>
              </div>

              {/* Main Category */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="task-main-cat" className="text-helper">Main Category</Label>
                  {isCategoriesLoading && (
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Loader2 size={11} className="animate-spin" /> Loading categories...
                    </span>
                  )}
                  {isCategoriesError && (
                    <span className="text-[11px] text-destructive">Failed to load categories</span>
                  )}
                </div>
                <select
                  id="task-main-cat"
                  value={form.mainCategory}
                  disabled={isCategoriesLoading}
                  onChange={(e) => {
                    const val = e.target.value;
                    update("mainCategory", val);
                    update("subCategory", "");
                    update("selectedSubCategories", []);
                    if (val !== "__other__") update("customCategory", "");
                  }}
                  className="h-11 w-full rounded-md border border-border bg-card px-3 text-helper outline-none transition-colors focus:border-primary disabled:opacity-50"
                >
                  <option value="">
                    {isCategoriesLoading
                      ? "Loading categories…"
                      : isCategoriesError
                      ? "Error loading categories (Select manual below)"
                      : categoryTree.length === 0
                      ? "No categories configured"
                      : "Select main category…"}
                  </option>
                  {categoryTree.map((cat) => (
                    <option key={cat._id || cat.name} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                  <option value="__other__">+ Other Work / Custom Category...</option>
                </select>
              </div>

              {/* Clean Single Subcategory Selector */}
              {form.mainCategory && form.mainCategory !== "__other__" && subCategories.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="task-sub-cat" className="text-helper">Subcategory / Work Type</Label>
                    <button
                      type="button"
                      onClick={() => {
                        const val = form.subCategory === "__other__" ? "" : "__other__";
                        update("subCategory", val);
                      }}
                      className="text-[11px] text-primary hover:underline font-medium"
                    >
                      {form.subCategory === "__other__" ? "← Select from list" : "+ Custom subcategory"}
                    </button>
                  </div>
                  {form.subCategory !== "__other__" && (
                    <select
                      id="task-sub-cat"
                      value={form.subCategory}
                      onChange={(e) => {
                        update("subCategory", e.target.value);
                        update("selectedSubCategories", e.target.value ? [e.target.value] : []);
                      }}
                      className="h-11 w-full rounded-md border border-border bg-card px-3 text-helper outline-none transition-colors focus:border-primary"
                    >
                      <option value="">Select subcategory / work type (optional)…</option>
                      {subCategories.map((sc) => (
                        <option key={sc._id || sc.name} value={sc.name}>
                          {sc.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Optional Custom Category */}
              {(form.mainCategory === "__other__" || form.subCategory === "__other__" || form.customCategory) && (
                <div className="space-y-1.5 pt-1">
                  <Label htmlFor="task-custom-cat" className="text-helper">
                    Custom Category / Specific Description {form.mainCategory === "__other__" && <span className="text-destructive">*</span>}
                  </Label>
                  <Input
                    id="task-custom-cat"
                    value={form.customCategory}
                    onChange={(e) => update("customCategory", e.target.value)}
                    placeholder="e.g. Special Revenue Registry, Court Inspection, or custom deed"
                    className="h-11 rounded-md bg-background text-sm"
                    maxLength={100}
                    required={form.mainCategory === "__other__"}
                  />
                </div>
              )}
            </div>

            {/* ── Priority & Deadline ── */}
            <div className="grid gap-4 sm:grid-cols-2">
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
            </div>

            {/* ── Assignee ── */}
            <div className="space-y-1.5">
              <Label className="text-helper">Assigned to</Label>
              <AssigneeMultiSelect
                value={form.assignedTo}
                onChange={(val) => update("assignedTo", val)}
                placeholder="Tick employees to assign..."
              />
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

              {/* ── Client Selection (Combobox strictly saving client._id) ── */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="task-client-search" className="text-helper">Client (optional)</Label>
                  {form.clientId && (
                    <button
                      type="button"
                      onClick={() => {
                        update("clientId", "");
                        setClientSearchQuery("");
                      }}
                      className="text-xs text-destructive hover:underline font-medium"
                    >
                      Clear Selection
                    </button>
                  )}
                </div>

                {form.clientId ? (
                  (() => {
                    const matched = clients.find((c) => c._id === form.clientId);
                    return (
                      <div className="flex h-11 items-center justify-between rounded-md border border-primary/40 bg-primary/5 px-3">
                        <div className="flex items-center gap-2 truncate">
                          <Check size={16} className="text-primary shrink-0" />
                          <span className="text-helper font-semibold text-foreground truncate">
                            {matched?.name || "Selected Client"}
                          </span>
                          {matched?.phone && (
                            <span className="text-xs text-muted-foreground font-mono">
                              ({matched.phone})
                            </span>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            update("clientId", "");
                            setClientSearchQuery("");
                          }}
                        >
                          Change
                        </Button>
                      </div>
                    );
                  })()
                ) : (
                  <div className="space-y-1.5">
                    <div className="relative">
                      <Search size={15} className="absolute left-3 top-3 text-muted-foreground" />
                      <Input
                        id="task-client-search"
                        value={clientSearchQuery}
                        onChange={(e) => setClientSearchQuery(e.target.value)}
                        placeholder="Search client by name or phone..."
                        className="h-11 pl-9 rounded-md"
                      />
                    </div>
                    {/* Live search match list */}
                    <div className="max-h-36 overflow-y-auto rounded-md border border-border bg-card p-1 shadow-sm text-xs space-y-0.5">
                      <button
                        type="button"
                        onClick={() => update("clientId", "")}
                        className="w-full text-left px-2.5 py-1.5 rounded hover:bg-muted text-muted-foreground font-medium"
                      >
                        None (No client)
                      </button>
                      {clients
                        .filter((c) => {
                          if (!clientSearchQuery.trim()) return true;
                          const q = clientSearchQuery.toLowerCase();
                          return (
                            c.name.toLowerCase().includes(q) ||
                            (c.phone && c.phone.includes(q))
                          );
                        })
                        .slice(0, 8)
                        .map((cl) => (
                          <button
                            key={cl._id}
                            type="button"
                            onClick={() => {
                              update("clientId", cl._id);
                              setClientSearchQuery("");
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded hover:bg-primary/10 flex items-center justify-between text-foreground"
                          >
                            <span className="font-medium truncate">{cl.name}</span>
                            {cl.phone && (
                              <span className="text-[11px] text-muted-foreground font-mono ml-2">
                                {cl.phone}
                              </span>
                            )}
                          </button>
                        ))}
                      {clientSearchQuery.trim() &&
                        clients.filter((c) => {
                          const q = clientSearchQuery.toLowerCase();
                          return (
                            c.name.toLowerCase().includes(q) ||
                            (c.phone && c.phone.includes(q))
                          );
                        }).length === 0 && (
                          <p className="p-2 text-muted-foreground text-center">
                            No clients match "{clientSearchQuery}".
                          </p>
                        )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            </div>{/* end CLASSIFICATION section */}

            {/* ── SUBTASKS & CHECKLIST SECTION ── */}
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Milestones &amp; Checklist</span>
                <div className="flex-1 h-px bg-border/60" />
              </div>

            {/* ── Subcategory Checklist & Action Steps ── */}
            {form.mainCategory && subCategories.length > 0 && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="flex items-center gap-2 text-helper font-semibold text-foreground">
                      <ListChecks size={16} strokeWidth={2} className="text-primary" />
                      Subcategory Checklist Steps ({form.mainCategory})
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Click any subcategory to add it as a checklist step, or load all at once.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addAllSubCategoriesToChecklist}
                      className="h-8 text-xs font-medium border-primary/40 text-primary hover:bg-primary/10"
                    >
                      <Plus size={13} className="mr-1" /> Add All Subcategories
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addStandardMilestonesToChecklist(form.subCategory || form.mainCategory)}
                      className="h-8 text-xs font-medium border-border text-foreground hover:bg-muted"
                      title="Add drafting, execution, registration & delivery milestones"
                    >
                      <CheckSquare size={13} className="mr-1 text-primary" /> + Standard Workflow Steps
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {subCategories.map((sc) => {
                    const alreadyInChecklist = checklist.some(
                      (c) => c.text.toLowerCase() === sc.name.toLowerCase()
                    );
                    return (
                      <button
                        key={sc._id || sc.name}
                        type="button"
                        onClick={() => addSubCategoryToChecklist(sc.name)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-caption font-medium transition-all ${
                          alreadyInChecklist
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold shadow-xs"
                            : "border-border/80 bg-background text-foreground/80 hover:border-primary hover:text-primary hover:bg-primary/5"
                        }`}
                        title={alreadyInChecklist ? "Already in checklist" : `Add "${sc.name}" as checklist step`}
                      >
                        {alreadyInChecklist ? <Check size={12} className="text-emerald-600" /> : <Plus size={12} />}
                        {sc.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

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

            </div>{/* end SUBTASKS section */}

            {/* ── Actions ── */}
            <div className="px-6 py-4 bg-muted/20 border-t border-border">
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
            </div>{/* end actions wrapper */}
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