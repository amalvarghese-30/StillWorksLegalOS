import { useState, useEffect, useMemo } from "react";
import {
  X,
  Plus,
  Trash2,
  Briefcase,
  Users,
  Loader2,
  CheckSquare,
  FolderOpen,
  CornerDownRight,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateCase, type CaseRecord } from "@/services/cases";
import { useClients } from "@/services/clients";
import { useTaskOptions, type ChecklistItem } from "@/services/tasks";
import { useCategoryTree, useCategories } from "@/services/categories";
import { DiscardConfirmationDialog } from "@/components/ui/discard-confirmation-dialog";
import { AssigneeMultiSelect } from "@/components/common/AssigneeMultiSelect";
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

export interface CaseTaskEntry {
  title: string;
  category: string;
  priority: "High" | "Medium" | "Low";
  deadline: string;
  assignedTo: string[];
  checklist: ChecklistItem[];
}

interface PartyEntry {
  name: string;
  role: string;
  type: "client" | "sub_client" | "opposing_party" | "counsel" | "other";
  clientId?: string | undefined;
}

interface FormState {
  title: string;
  courtCaseId: string;
  countCaseNumber: string;
  nextHearing: string;
  description: string;
  category: string;
  mainCategory: string;
  subCategory: string;
  selectedSubCategories: string[];
  customCategory: string;
  localPath: string;
  status: "Active" | "On Hold" | "Closed" | "Urgent";
  priority: "High" | "Medium" | "Low";
  tags: string;
  assignedTo: string[];
}

const EMPTY_FORM: FormState = {
  title: "",
  courtCaseId: "",
  countCaseNumber: "",
  nextHearing: "",
  description: "",
  category: "Other Work",
  mainCategory: "",
  subCategory: "",
  selectedSubCategories: [],
  customCategory: "",
  localPath: "",
  status: "Active",
  priority: "Medium",
  tags: "",
  assignedTo: [],
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AddCaseDialogProps {
  open: boolean;
  onClose: () => void;
  preselectedClientId?: string;
  preselectedClientName?: string;
  onCaseCreated?: (newCase: CaseRecord) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AddCaseDialog({
  open,
  onClose,
  preselectedClientId,
  preselectedClientName,
  onCaseCreated,
}: AddCaseDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [parties, setParties] = useState<PartyEntry[]>([]);
  const [tasks, setTasks] = useState<CaseTaskEntry[]>([]);
  const [subtaskInput, setSubtaskInput] = useState<Record<number, string>>({});
  const [tagInput, setTagInput] = useState("");
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const { data: clientsData } = useClients({ limit: "100" });
  const { data: taskOptions } = useTaskOptions();
  const { data: categories = [] } = useCategories();
  const { data: categoryTree = [], isLoading: isCategoriesLoading, isError: isCategoriesError } = useCategoryTree();

  const selectedParent = categoryTree.find((c) => c.name === form.mainCategory);
  const availableSubCategories = selectedParent?.children ?? [];

  const staffList = taskOptions?.staff ?? [];

  useEffect(() => {
    if (open) {
      if (preselectedClientId) {
        setParties([
          {
            name: preselectedClientName || "",
            role: "Primary Client",
            type: "client",
            clientId: preselectedClientId,
          },
        ]);
      } else {
        setParties([]);
      }
      setTasks([]);
      setSubtaskInput({});
    }
  }, [open, preselectedClientId, preselectedClientName]);

  const createCase = useCreateCase();
  const isPending = createCase.isPending;
  const isError = createCase.isError;

  // Check if form has unsaved modifications
  const isDirty = useMemo(() => {
    return (
      Boolean(form.title.trim()) ||
      Boolean(form.courtCaseId.trim()) ||
      Boolean(form.mainCategory) ||
      Boolean(form.subCategory) ||
      form.selectedSubCategories.length > 0 ||
      Boolean(form.description.trim()) ||
      form.category !== "Other Work" ||
      Boolean(form.localPath.trim()) ||
      form.status !== "Active" ||
      form.priority !== "Medium" ||
      parties.length > (preselectedClientId ? 1 : 0) ||
      tasks.length > 0
    );
  }, [form, parties, tasks, preselectedClientId]);

  const handleAttemptClose = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      handleForceClose();
    }
  };

  const handleForceClose = () => {
    setForm(EMPTY_FORM);
    setParties([]);
    setTasks([]);
    setSubtaskInput({});
    setTagInput("");
    setShowDiscardConfirm(false);
    onClose();
  };

  if (!open) return null;

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const addParty = () => {
    setParties((prev) => [
      ...prev,
      { name: "", role: "", type: "client" },
    ]);
  };

  const updateParty = <K extends keyof PartyEntry>(idx: number, key: K, value: PartyEntry[K]) => {
    setParties((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [key]: value } : p)),
    );
  };

  const removeParty = (idx: number) => {
    setParties((prev) => prev.filter((_, i) => i !== idx));
  };

  const addTask = () => {
    setTasks((prev) => [
      ...prev,
      {
        title: "",
        category: form.category || "Other Work",
        priority: "Medium",
        deadline: "",
        assignedTo: [],
        checklist: [],
      },
    ]);
  };

  const updateTask = <K extends keyof CaseTaskEntry>(idx: number, key: K, value: CaseTaskEntry[K]) => {
    setTasks((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, [key]: value } : t)),
    );
  };

  const removeTask = (idx: number) => {
    setTasks((prev) => prev.filter((_, i) => i !== idx));
  };

  const addChecklistItemToTask = (taskIdx: number) => {
    const input = (subtaskInput[taskIdx] || "").trim();
    if (!input) return;
    const newItem: ChecklistItem = {
      id: Math.random().toString(36).substring(2, 9),
      text: input,
      done: false,
      subItems: [],
    };
    setTasks((prev) =>
      prev.map((t, i) =>
        i === taskIdx ? { ...t, checklist: [...t.checklist, newItem] } : t,
      ),
    );
    setSubtaskInput((prev) => ({ ...prev, [taskIdx]: "" }));
  };

  const addSubCategoryToTaskChecklist = (taskIdx: number, subCatName: string) => {
    const textToAdd = subCatName.trim();
    if (!textToAdd) return;
    setTasks((prev) =>
      prev.map((t, i) => {
        if (i !== taskIdx) return t;
        if (t.checklist.some((c) => c.text.toLowerCase() === textToAdd.toLowerCase())) {
          toast.info(`"${textToAdd}" is already in task checklist`);
          return t;
        }
        const newItem: ChecklistItem = {
          id: Math.random().toString(36).substring(2, 9),
          text: textToAdd,
          done: false,
          subItems: [],
        };
        return { ...t, checklist: [...t.checklist, newItem] };
      })
    );
    toast.success(`Added "${textToAdd}" to task checklist`);
  };

  const addAllSubCategoriesToTaskChecklist = (taskIdx: number) => {
    if (!availableSubCategories || availableSubCategories.length === 0) return;
    setTasks((prev) =>
      prev.map((t, i) => {
        if (i !== taskIdx) return t;
        const existingTexts = new Set(t.checklist.map((c) => c.text.toLowerCase()));
        const toAdd = availableSubCategories
          .map((sc) => sc.name.trim())
          .filter((name) => name && !existingTexts.has(name.toLowerCase()));
        if (toAdd.length === 0) {
          toast.info("All subcategories are already in the checklist");
          return t;
        }
        const newItems: ChecklistItem[] = toAdd.map((text) => ({
          id: Math.random().toString(36).substring(2, 9),
          text,
          done: false,
          subItems: [],
        }));
        toast.success(`Added ${newItems.length} subcategory step(s) to task`);
        return { ...t, checklist: [...t.checklist, ...newItems] };
      })
    );
  };

  const updateChecklistItemText = (taskIdx: number, itemIdx: number, text: string) => {
    setTasks((prev) =>
      prev.map((t, i) => {
        if (i !== taskIdx) return t;
        const nextCl = [...t.checklist];
        if (nextCl[itemIdx]) {
          nextCl[itemIdx] = { ...nextCl[itemIdx], text };
        }
        return { ...t, checklist: nextCl };
      }),
    );
  };

  const removeChecklistItemFromTask = (taskIdx: number, itemIdx: number) => {
    setTasks((prev) =>
      prev.map((t, i) =>
        i === taskIdx
          ? { ...t, checklist: t.checklist.filter((_, ci) => ci !== itemIdx) }
          : t,
      ),
    );
  };

  const addSubItemToTaskChecklist = (taskIdx: number, itemIdx: number) => {
    setTasks((prev) =>
      prev.map((t, i) => {
        if (i !== taskIdx) return t;
        const nextCl = [...t.checklist];
        const target = nextCl[itemIdx];
        if (target) {
          const newSub = {
            id: Math.random().toString(36).substring(2, 9),
            text: "",
            done: false,
          };
          nextCl[itemIdx] = {
            ...target,
            subItems: [...(target.subItems || []), newSub],
          };
        }
        return { ...t, checklist: nextCl };
      }),
    );
  };

  const updateSubItemText = (taskIdx: number, itemIdx: number, subIdx: number, text: string) => {
    setTasks((prev) =>
      prev.map((t, i) => {
        if (i !== taskIdx) return t;
        const nextCl = [...t.checklist];
        const target = nextCl[itemIdx];
        if (target && target.subItems && target.subItems[subIdx]) {
          const nextSubs = [...target.subItems];
          nextSubs[subIdx] = { ...nextSubs[subIdx], text };
          nextCl[itemIdx] = { ...target, subItems: nextSubs };
        }
        return { ...t, checklist: nextCl };
      }),
    );
  };

  const removeSubItemFromTaskChecklist = (taskIdx: number, itemIdx: number, subIdx: number) => {
    setTasks((prev) =>
      prev.map((t, i) => {
        if (i !== taskIdx) return t;
        const nextCl = [...t.checklist];
        const target = nextCl[itemIdx];
        if (target && target.subItems) {
          nextCl[itemIdx] = {
            ...target,
            subItems: target.subItems.filter((_, si) => si !== subIdx),
          };
        }
        return { ...t, checklist: nextCl };
      }),
    );
  };

  const tags = form.tags
    ? form.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
    : [];

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if (!tags.includes(t)) {
      update("tags", tags.concat(t).join(", "));
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    update("tags", tags.filter((t) => t !== tag).join(", "));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    try {
      const validParties = parties
        .filter((p) => p.name.trim())
        .map((p) => ({
          name: p.name.trim(),
          role: p.role.trim() || "Party",
          type: p.type,
          ...(p.clientId ? { clientId: p.clientId } : {}),
        }));

      const validTasks = tasks
        .filter((t) => t.title.trim())
        .map((t) => ({
          title: t.title.trim(),
          category: t.category || "Other Work",
          priority: t.priority,
          deadline: t.deadline ? new Date(t.deadline).toISOString() : undefined,
          assignedTo: t.assignedTo && t.assignedTo.length > 0 ? t.assignedTo : undefined,
          assignedUsers: t.assignedTo && t.assignedTo.length > 0 ? t.assignedTo : undefined,
          checklist: t.checklist
            .filter((item) => item.text && item.text.trim())
            .map((item) => ({
              text: item.text.trim(),
              done: Boolean(item.done),
              subItems: (item.subItems || [])
                .filter((sub) => sub.text && sub.text.trim())
                .map((sub) => ({
                  text: sub.text.trim(),
                  done: Boolean(sub.done),
                })),
            })),
        }));

      const subCatJoined = form.selectedSubCategories.length > 0
        ? form.selectedSubCategories.join(", ")
        : form.subCategory;

      const chosenCategory =
        (subCatJoined === "__other__" || form.mainCategory === "__other__"
          ? form.customCategory.trim()
          : subCatJoined) ||
        (form.mainCategory === "__other__" ? form.customCategory.trim() : form.mainCategory) ||
        form.category ||
        "Other Work";

      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        category: chosenCategory,
        mainCategory: form.mainCategory === "__other__" ? (form.customCategory.trim() || "Other Work") : (form.mainCategory || undefined),
        subCategory: subCatJoined === "__other__" ? (form.customCategory.trim() || undefined) : (subCatJoined || undefined),
        categoryPath: form.selectedSubCategories.length > 0 ? form.selectedSubCategories : undefined,
        courtCaseId: form.courtCaseId.trim() || undefined,
        countCaseNumber: form.countCaseNumber.trim() || form.courtCaseId.trim() || undefined,
        nextHearing: form.nextHearing ? new Date(form.nextHearing).toISOString() : undefined,
        localPath: form.localPath.trim() || undefined,
        status: form.status,
        priority: form.priority,
        assignedTo: form.assignedTo && form.assignedTo.length > 0 ? form.assignedTo : undefined,
        assignedUsers: form.assignedTo && form.assignedTo.length > 0 ? form.assignedTo : undefined,
        parties: validParties.length > 0 ? validParties : undefined,
        tags: tags.length > 0 ? tags : undefined,
        tasks: validTasks.length > 0 ? validTasks : undefined,
      };

      const result = await createCase.mutateAsync(payload);
      toast.success("Case created successfully");
      if (onCaseCreated && result.case) {
        onCaseCreated(result.case);
      }
      handleForceClose();
    } catch (err: any) {
      console.error("Failed to create case:", err);
      toast.error(err?.message || "Failed to create case");
    }
  };

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
                <Briefcase size={18} strokeWidth={2} />
              </span>
              <div>
                <DialogTitle className="text-base font-semibold text-foreground leading-tight">
                  Create new case
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Case details, parties, and initial tasks on one screen.
                </DialogDescription>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="divide-y divide-border">
            {/* ── CASE SECTION ── */}
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Case</span>
                <div className="flex-1 h-px bg-border/60" />
              </div>

            {/* Client Name / Title */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="case-title" className="text-xs font-medium text-foreground">
                  Client Name / Case Title <span className="text-destructive">*</span>
                </Label>
                {clientsData?.clients && clientsData.clients.length > 0 && (
                  <span className="text-[11px] text-muted-foreground">
                    Select existing or type client name
                  </span>
                )}
              </div>
              <div className="relative">
                <Input
                  id="case-title"
                  value={form.title}
                  onChange={(e) => {
                    const val = e.target.value;
                    update("title", val);
                  }}
                  placeholder="e.g. Ramesh Sharma / Apex Enterprises"
                  required
                  className="h-11 rounded-md"
                />
              </div>
              {/* Optional Quick Pick from existing clients */}
              {clientsData?.clients && clientsData.clients.length > 0 && (
                <div className="flex items-center gap-2 pt-0.5">
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">Quick fill client:</span>
                  <select
                    className="h-7 text-xs rounded border border-border bg-card px-2 text-muted-foreground outline-none focus:border-primary max-w-xs truncate"
                    onChange={(e) => {
                      const selId = e.target.value;
                      if (!selId) return;
                      const selectedClient = clientsData.clients.find((c) => c._id === selId);
                      if (selectedClient) {
                        update("title", selectedClient.name);
                        // Also automatically add / update the Primary Client party
                        setParties((prev) => {
                          const existingIndex = prev.findIndex((p) => p.role === "Primary Client");
                          if (existingIndex >= 0) {
                            return prev.map((p, i) =>
                              i === existingIndex
                                ? { ...p, name: selectedClient.name, clientId: selectedClient._id }
                                : p
                            );
                          }
                          return [
                            {
                              name: selectedClient.name,
                              role: "Primary Client",
                              type: "client",
                              clientId: selectedClient._id,
                            },
                            ...prev,
                          ];
                        });
                      }
                      e.target.value = "";
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>Choose existing client…</option>
                    {clientsData.clients.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name} {c.phone ? `(${c.phone})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* ── Case Number Identifiers ── */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="case-court-id" className="text-helper">
                  Court Case / CNR / Filing Number (Optional)
                </Label>
                <Input
                  id="case-court-id"
                  value={form.courtCaseId}
                  onChange={(e) => update("courtCaseId", e.target.value)}
                  placeholder="e.g. CNR: MHCC01-123456-2026 or Special Suit 45/2026"
                  className="h-11 rounded-md font-mono text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="case-count-number" className="text-helper">
                  Count Case Number / Internal Index (Optional)
                </Label>
                <Input
                  id="case-count-number"
                  value={form.countCaseNumber}
                  onChange={(e) => update("countCaseNumber", e.target.value)}
                  placeholder="e.g. Case Count #042 or CR-2026-99"
                  className="h-11 rounded-md font-mono text-sm"
                />
              </div>
            </div>


            {/* ── Status & Priority ── */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Case Status</Label>
                <div className="flex rounded-lg border border-border overflow-hidden bg-muted/30">
                  {(["Active", "Urgent", "On Hold", "Closed"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => update("status", s)}
                      className={`flex-1 px-2 py-2 text-[11px] font-semibold transition-all border-r border-border last:border-r-0 ${form.status === s
                        ? s === "Urgent" ? "bg-destructive/15 text-destructive"
                          : s === "On Hold" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                          : s === "Closed" ? "bg-muted text-muted-foreground"
                          : "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Priority</Label>
                <div className="flex rounded-lg border border-border overflow-hidden bg-muted/30">
                  {(["High", "Medium", "Low"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => update("priority", p)}
                      className={`flex-1 px-2.5 py-2 text-[11px] font-semibold transition-all border-r border-border last:border-r-0 ${form.priority === p
                          ? p === "High"
                            ? "bg-destructive/15 text-destructive"
                            : p === "Medium"
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                              : "bg-muted text-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Assigned Team / Counsel ── */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Assigned Team / Counsel</Label>
              <AssigneeMultiSelect
                value={form.assignedTo}
                onChange={(val) => update("assignedTo", val)}
                placeholder="Tick employees / counsel to assign..."
              />
            </div>

            {/* ── Tags ── */}
            <div className="space-y-2">
              <Label htmlFor="case-tags" className="text-xs font-medium text-foreground">Tags</Label>
              <div className="flex gap-2">
                <Input
                  id="case-tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); addTag(); }
                  }}
                  placeholder="Type a tag and press Enter"
                  className="h-11 flex-1 rounded-md"
                />
                <Button type="button" variant="outline" className="rounded-md h-11" onClick={addTag}>
                  <Plus size={15} />
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="flex items-center gap-1 rounded-pill bg-muted px-3 py-1 text-caption font-medium"
                    >
                      {t}
                      <button
                        type="button"
                        onClick={() => removeTag(t)}
                        className="ml-0.5 grid size-4 place-items-center rounded-full text-muted-foreground hover:text-destructive"
                        aria-label={`Remove tag ${t}`}
                      >
                        <X size={11} strokeWidth={2.5} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            </div>{/* end CASE section */}

            {/* ── DETAILS SECTION (Category, Court & Hearing, Description) ── */}
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Details &amp; Court</span>
                <div className="flex-1 h-px bg-border/60" />
                <span className="text-[10px] text-muted-foreground italic">Optional</span>
              </div>

            {/* ── Category Hierarchy ── */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="case-main-category" className="text-helper">Main Category</Label>
                  {isCategoriesLoading && (
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Loader2 size={11} className="animate-spin" /> Loading categories...
                    </span>
                  )}
                  {isCategoriesError && (
                    <span className="text-[11px] text-destructive">
                      Failed to load categories
                    </span>
                  )}
                </div>
                <select
                  id="case-main-category"
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
                  {categoryTree.map((c) => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                  <option value="__other__">+ Other Work / Custom Category...</option>
                </select>
              </div>

              {/* ── Subcategories Checklist (Select 1 or more) ── */}
              {form.mainCategory && form.mainCategory !== "__other__" && availableSubCategories.length > 0 && (
                <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-helper font-medium flex items-center gap-1.5">
                      <CheckSquare size={14} className="text-primary" />
                      Subcategories / Work Types (Check all that apply)
                    </Label>
                    <span className="text-[11px] text-muted-foreground">
                      {form.selectedSubCategories.length} selected
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {availableSubCategories.map((sc) => {
                      const isChecked = form.selectedSubCategories.includes(sc.name);
                      return (
                        <label
                          key={sc._id || sc.name}
                          className={`flex items-start gap-2.5 rounded-md border p-2 text-xs cursor-pointer transition-colors ${
                            isChecked
                              ? "border-primary bg-primary/10 text-foreground font-medium"
                              : "border-border/60 bg-card hover:bg-muted text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              const updated = checked
                                ? [...form.selectedSubCategories, sc.name]
                                : form.selectedSubCategories.filter((name) => name !== sc.name);
                              update("selectedSubCategories", updated);
                              // Sync primary subCategory to the first selected item or empty
                              update("subCategory", updated[0] || "");
                            }}
                            className="mt-0.5 size-3.5 rounded border-border text-primary focus:ring-primary"
                          />
                          <span className="leading-tight select-none">{sc.name}</span>
                        </label>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const allNames = availableSubCategories.map((s) => s.name);
                          update("selectedSubCategories", allNames);
                          update("subCategory", allNames[0] || "");
                        }}
                        className="text-[11px] text-primary hover:underline"
                      >
                        Select all
                      </button>
                      <span className="text-[11px] text-muted-foreground">|</span>
                      <button
                        type="button"
                        onClick={() => {
                          update("selectedSubCategories", []);
                          update("subCategory", "");
                        }}
                        className="text-[11px] text-muted-foreground hover:underline"
                      >
                        Clear
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const val = form.subCategory === "__other__" ? "" : "__other__";
                        update("subCategory", val);
                      }}
                      className="text-[11px] text-primary hover:underline font-medium"
                    >
                      + Add custom subcategory
                    </button>
                  </div>
                </div>
              )}
            </div>

            {(form.mainCategory === "__other__" || form.subCategory === "__other__") && (
              <div className="space-y-1.5">
                <Label htmlFor="case-custom-category" className="text-helper">
                  Custom Category / Work Type <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="case-custom-category"
                  value={form.customCategory}
                  onChange={(e) => update("customCategory", e.target.value)}
                  placeholder="Enter manual category name (e.g. Other Work / Specific Dispute)..."
                  className="h-11 rounded-md"
                  maxLength={100}
                  required
                />
              </div>
            )}

            {/* ── Next Hearing Date ── */}
            <div className="space-y-1.5">
              <Label htmlFor="case-next-hearing" className="text-helper flex items-center gap-1.5">
                <Calendar size={14} className="text-primary" />
                Initial / Next Hearing Date (Optional)
              </Label>
              <Input
                id="case-next-hearing"
                type="date"
                value={form.nextHearing}
                onChange={(e) => update("nextHearing", e.target.value)}
                className="h-11 rounded-md"
              />
              <p className="text-xs text-muted-foreground">
                Enter scheduled hearing date to synchronize with firm calendar and automated hearing reminders.
              </p>
            </div>

            {/* ── Description ── */}
            <div className="space-y-1.5">
              <Label htmlFor="case-desc" className="text-helper">Description</Label>
              <textarea
                id="case-desc"
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="Brief summary of the matter, facts, or dispute…"
                rows={2}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none transition-colors focus:border-primary resize-none"
              />
            </div>

            {/* ── Local File / Folder Path ── */}
            <div className="space-y-1.5">
              <Label htmlFor="case-localpath" className="text-helper flex items-center gap-1.5">
                <FolderOpen size={14} className="text-muted-foreground" />
                Local Folder / Document Path (Optional)
              </Label>
              <Input
                id="case-localpath"
                value={form.localPath}
                onChange={(e) => update("localPath", e.target.value)}
                placeholder="e.g. C:\LegalFiles\Cases\Apex-2026 or /Users/shared/case-files"
                className="h-11 rounded-md"
              />
              <p className="text-xs text-muted-foreground">
                In desktop mode, clicking this path will directly open the folder in File Explorer / Finder.
              </p>
            </div>

            {/* ── Parties ── */}
            <div className="rounded-lg border border-border">
              <div className="flex items-center justify-between px-4 py-3 bg-muted/20 rounded-t-lg">
                <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Users size={15} strokeWidth={1.75} className="text-muted-foreground" />
                  Parties
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-md"
                  onClick={addParty}
                >
                  <Plus size={14} /> Add party
                </Button>
              </div>
              {parties.length > 0 && (
                <div className="border-t border-border p-4 space-y-3">
                  {parties.map((p, idx) => (
                    <div key={idx} className="flex flex-col gap-2 rounded-md border border-border bg-card p-3">
                      <div className="grid gap-2 sm:grid-cols-3">
                        <Input
                          placeholder="Party name"
                          value={p.name}
                          onChange={(e) => updateParty(idx, "name", e.target.value)}
                          className="h-10 rounded-md"
                        />
                        <Input
                          placeholder="Role (e.g. Plaintiff, Respondent)"
                          value={p.role}
                          onChange={(e) => updateParty(idx, "role", e.target.value)}
                          className="h-10 rounded-md"
                        />
                        <div className="flex gap-2">
                          <select
                            value={p.type}
                            onChange={(e) => updateParty(idx, "type", e.target.value as any)}
                            className="h-10 flex-1 rounded-md border border-border bg-card px-2.5 text-helper outline-none transition-colors focus:border-primary"
                          >
                            <option value="client">Client</option>
                            <option value="sub_client">Sub-Client</option>
                            <option value="opposing_party">Opposing Party</option>
                            <option value="counsel">Counsel</option>
                            <option value="other">Other</option>
                          </select>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-10 px-2 text-muted-foreground hover:text-destructive"
                            onClick={() => removeParty(idx)}
                          >
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      </div>

                      {/* Client Link Selector */}
                      {(p.type === "client" || p.type === "sub_client") && (
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">Link Client:</span>
                          <select
                            value={p.clientId || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateParty(idx, "clientId", val || undefined);
                              if (val && !p.name) {
                                const found = (clientsData?.clients || []).find((c) => c._id === val);
                                if (found) updateParty(idx, "name", found.name);
                              }
                            }}
                            className="h-8 flex-1 rounded border border-border bg-card px-2 text-xs outline-none focus:border-primary"
                          >
                            <option value="">-- No direct client record link --</option>
                            {(clientsData?.clients || []).map((c) => (
                              <option key={c._id} value={c._id}>
                                {c.name} {c.company ? `(${c.company})` : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            </div>{/* end DETAILS section */}

            {/* ── PARTIES & TASKS SECTION ── */}
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Parties &amp; Tasks</span>
                <div className="flex-1 h-px bg-border/60" />
              </div>

            {/* ── TASKS (inner section) ── */}
            <div className="rounded-lg border border-border">
              <div className="flex items-center justify-between px-4 py-3 bg-muted/20 rounded-t-lg">
                <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <CheckSquare size={15} strokeWidth={1.75} className="text-muted-foreground" />
                  Initial Tasks for this Case
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-md h-8 text-xs"
                  onClick={addTask}
                >
                  <Plus size={13} /> Add task
                </Button>
              </div>

              {tasks.length > 0 && (
                <div className="border-t border-border p-4 space-y-4">
                  {tasks.map((t, idx) => (
                    <div key={idx} className={`flex flex-col gap-3 rounded-md border border-border bg-card p-3 border-l-4 ${t.priority === "High" ? "border-l-destructive" : t.priority === "Medium" ? "border-l-warning" : "border-l-muted-foreground/30"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Input
                            placeholder="Task title *"
                            value={t.title}
                            onChange={(e) => updateTask(idx, "title", e.target.value)}
                            className="h-9 flex-1 font-medium rounded-md text-sm"
                            required
                          />
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {t.checklist.length > 0 && (
                            <span className="text-[10px] font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full border border-border">
                              {t.checklist.length} step{t.checklist.length !== 1 ? "s" : ""}
                            </span>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"
                            onClick={() => removeTask(idx)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-2.5 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor={`task-cat-${idx}`} className="text-helper">Category</Label>
                          <select
                            id={`task-cat-${idx}`}
                            value={t.category}
                            onChange={(e) => updateTask(idx, "category", e.target.value)}
                            className="h-10 w-full rounded-md border border-border bg-card px-3 text-helper outline-none transition-colors focus:border-primary"
                          >
                            {categories.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor={`task-prio-${idx}`} className="text-helper">Priority</Label>
                          <select
                            id={`task-prio-${idx}`}
                            value={t.priority}
                            onChange={(e) => updateTask(idx, "priority", e.target.value as any)}
                            className="h-10 w-full rounded-md border border-border bg-card px-3 text-helper outline-none transition-colors focus:border-primary"
                          >
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor={`task-deadline-${idx}`} className="text-helper">Deadline</Label>
                          <Input
                            id={`task-deadline-${idx}`}
                            type="datetime-local"
                            value={t.deadline}
                            onChange={(e) => updateTask(idx, "deadline", e.target.value)}
                            className="h-10 w-full rounded-md text-xs sm:text-sm px-3 font-sans"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-helper">Assign to (optional)</Label>
                          <AssigneeMultiSelect
                            value={Array.isArray(t.assignedTo) ? t.assignedTo : (t.assignedTo ? [t.assignedTo] : [])}
                            onChange={(val) => updateTask(idx, "assignedTo", val)}
                            placeholder="Tick employees to assign..."
                          />
                        </div>
                      </div>

                      {/* Subtasks / Checklist */}
                      <div className="space-y-2 pt-2 border-t border-border/50">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                            <CheckSquare size={13} className="text-primary" />
                            Checklist & Sub-checklists
                          </Label>
                          <span className="text-caption text-muted-foreground">
                            {t.checklist.length} checklist item(s)
                          </span>
                        </div>
                        {/* Subcategory checklist chips */}
                        {form.mainCategory && availableSubCategories.length > 0 && (
                          <div className="rounded border border-primary/20 bg-primary/5 p-2 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-semibold text-foreground">
                                Subcategory Steps ({form.mainCategory}):
                              </span>
                              <button
                                type="button"
                                onClick={() => addAllSubCategoriesToTaskChecklist(idx)}
                                className="text-primary hover:underline font-medium text-[10px]"
                              >
                                + Add all subcategories
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {availableSubCategories.map((sc) => {
                                const alreadyAdded = t.checklist.some(
                                  (item) => item.text.toLowerCase() === sc.name.toLowerCase()
                                );
                                return (
                                  <button
                                    key={sc._id || sc.name}
                                    type="button"
                                    onClick={() => addSubCategoryToTaskChecklist(idx, sc.name)}
                                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
                                      alreadyAdded
                                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium"
                                        : "border-border/80 bg-background text-foreground/80 hover:border-primary hover:text-primary"
                                    }`}
                                    title={alreadyAdded ? "Already in checklist" : `Add "${sc.name}"`}
                                  >
                                    <Plus size={9} />
                                    {sc.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Input
                            value={subtaskInput[idx] || ""}
                            onChange={(e) => setSubtaskInput((prev) => ({ ...prev, [idx]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addChecklistItemToTask(idx);
                              }
                            }}
                            placeholder="Add custom checklist item and press Enter..."
                            className="h-9 text-xs rounded-md"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 px-3 text-xs rounded-md font-medium"
                            onClick={() => addChecklistItemToTask(idx)}
                          >
                            <Plus size={13} className="mr-1" /> Add item
                          </Button>
                        </div>

                        {t.checklist.length > 0 && (
                          <div className="space-y-2 mt-2">
                            {t.checklist.map((item, cIdx) => (
                              <div
                                key={item.id || cIdx}
                                className="space-y-2 rounded-md border border-border/70 bg-card p-2.5 text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <Input
                                    value={item.text}
                                    onChange={(e) => updateChecklistItemText(idx, cIdx, e.target.value)}
                                    placeholder="Checklist step description..."
                                    className="h-8 flex-1 text-xs font-medium rounded-md"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => addSubItemToTaskChecklist(idx, cIdx)}
                                    className="h-8 text-xs text-primary hover:bg-primary/10 px-2"
                                  >
                                    <Plus size={12} className="mr-1" /> Sub-item
                                  </Button>
                                  <button
                                    type="button"
                                    onClick={() => removeChecklistItemFromTask(idx, cIdx)}
                                    className="grid size-7 shrink-0 place-items-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                    aria-label="Remove checklist item"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>

                                {/* Nested sub-items */}
                                {Array.isArray(item.subItems) && item.subItems.length > 0 && (
                                  <div className="pl-4 space-y-1.5 border-l-2 border-primary/20 ml-2 mt-1.5">
                                    {item.subItems.map((sub, sIdx) => (
                                      <div key={sub.id || sIdx} className="flex items-center gap-2">
                                        <CornerDownRight size={12} className="text-muted-foreground shrink-0" />
                                        <Input
                                          value={sub.text}
                                          onChange={(e) => updateSubItemText(idx, cIdx, sIdx, e.target.value)}
                                          placeholder="Sub-step detail…"
                                          className="h-7 text-xs rounded-md"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => removeSubItemFromTaskChecklist(idx, cIdx, sIdx)}
                                          className="grid size-6 shrink-0 place-items-center text-muted-foreground hover:text-destructive"
                                          aria-label="Remove sub-item"
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {tasks.length === 0 && (
                <div className="border-t border-border px-4 py-6 text-center text-helper text-muted-foreground">
                  No tasks added yet. Click &quot;Add task&quot; to define tasks for this specific case right away.
                </div>
              )}
            </div>

            </div>{/* end PARTIES+TASKS section */}

            {/* ── Actions ── */}
            <div className="px-6 py-4 bg-muted/20 border-t border-border">
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleAttemptClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending || !form.title.trim()}
                className="gradient-primary rounded-lg text-primary-foreground shadow-soft px-6"
              >
                {isPending ? <Loader2 size={16} className="animate-spin" /> : <Briefcase size={16} strokeWidth={2} />}
                {isPending ? "Saving…" : "Save Case"}
              </Button>
            </DialogFooter>

            {isError && (
              <p className="text-caption text-destructive">
                {(createCase.error as any)?.body?.message || (createCase.error as any)?.message || "Failed to create case. Please try again."}
              </p>
            )}
            </div>{/* end actions wrapper */}
          </form>
        </DialogContent>
      </Dialog>

      <DiscardConfirmationDialog
        open={showDiscardConfirm}
        onOpenChange={setShowDiscardConfirm}
        onConfirmDiscard={handleForceClose}
        title="Discard unsaved case?"
        description="You have unsaved changes in this new case. If you close now, all entered details will be discarded."
      />
    </>
  );
}