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
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateCase, type CaseRecord } from "@/services/cases";
import { useClients } from "@/services/clients";
import { useTaskOptions, type ChecklistItem } from "@/services/tasks";
import { useCategoryTree, useCategories, extractCategoryName } from "@/services/categories";
import { DiscardConfirmationDialog } from "@/components/ui/discard-confirmation-dialog";
import { AssigneeMultiSelect } from "@/components/common/AssigneeMultiSelect";
import { toSafeIso } from "@/lib/dates";
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
  description?: string;
  notes?: string;
  mainCategory?: string;
  subCategory?: string;
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
  const [checkedSubCategoriesForTasks, setCheckedSubCategoriesForTasks] = useState<string[]>([]);
  const [expandedTaskIndexes, setExpandedTaskIndexes] = useState<Record<number, boolean>>({});
  const [subtaskInput, setSubtaskInput] = useState<Record<number, string>>({});
  const [tagInput, setTagInput] = useState("");
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const { data: clientsData } = useClients({ limit: "100" });
  const { data: taskOptions } = useTaskOptions();
  const { data: rawCategories = [] } = useCategories();
  const { data: categoryTree = [], isLoading: isCategoriesLoading, isError: isCategoriesError } = useCategoryTree();

  const categories = useMemo(() => {
    const rawObj = rawCategories && typeof rawCategories === "object" ? (rawCategories as Record<string, unknown>) : null;
    const list = Array.isArray(rawCategories)
      ? rawCategories
      : Array.isArray(rawObj?.categories)
      ? (rawObj?.categories as unknown[])
      : [];
    return list
      .map(extractCategoryName)
      .filter(Boolean);
  }, [rawCategories]);

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

  const toggleTaskExpand = (index: number) => {
    setExpandedTaskIndexes((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const handleAddSelectedSubCategoriesAsTasks = () => {
    if (checkedSubCategoriesForTasks.length === 0) return;
    const newTasks: CaseTaskEntry[] = [];
    const existingTitles = new Set(tasks.map((t) => t.title.toLowerCase()));

    for (const scName of checkedSubCategoriesForTasks) {
      if (!existingTitles.has(scName.toLowerCase())) {
        newTasks.push({
          title: scName,
          category: scName,
          mainCategory: form.mainCategory,
          subCategory: scName,
          priority: "Medium",
          deadline: "",
          assignedTo: form.assignedTo || [],
          notes: "",
          description: "",
          checklist: [],
        });
        existingTitles.add(scName.toLowerCase());
      }
    }

    if (newTasks.length > 0) {
      const startIdx = tasks.length;
      setTasks((prev) => [...prev, ...newTasks]);
      toast.success(`Added ${newTasks.length} task(s) from selected subcategories`);
      setExpandedTaskIndexes((prev) => {
        const next = { ...prev };
        for (let i = 0; i < newTasks.length; i++) {
          next[startIdx + i] = true;
        }
        return next;
      });
      setCheckedSubCategoriesForTasks([]);
    } else {
      toast.info("Selected subcategories are already added as tasks");
    }
  };

  const addTask = () => {
    const newIdx = tasks.length;
    setTasks((prev) => [
      ...prev,
      {
        title: "",
        category: form.category || "Other Work",
        mainCategory: form.mainCategory,
        subCategory: "",
        priority: "Medium",
        deadline: "",
        assignedTo: form.assignedTo || [],
        notes: "",
        description: "",
        checklist: [],
      },
    ]);
    setExpandedTaskIndexes((prev) => ({ ...prev, [newIdx]: true }));
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
          description: t.description?.trim() || undefined,
          notes: t.notes?.trim() || undefined,
          mainCategory: t.mainCategory || form.mainCategory || undefined,
          subCategory: t.subCategory || undefined,
          category: t.category || t.subCategory || "Other Work",
          priority: t.priority,
          deadline: t.deadline ? toSafeIso(t.deadline) ?? undefined : undefined,
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
                {categoryTree.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {categoryTree.map((c) => {
                      const isSelected = form.mainCategory === c.name;
                      return (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => {
                            const val = isSelected ? "" : c.name;
                            update("mainCategory", val);
                            update("subCategory", "");
                            update("selectedSubCategories", []);
                            if (val !== "__other__") update("customCategory", "");
                          }}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all ${
                            isSelected
                              ? "border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/40 font-bold"
                              : "border-border/80 bg-background text-foreground/80 hover:border-primary/50 hover:bg-muted/50"
                          }`}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => {
                        const val = form.mainCategory === "__other__" ? "" : "__other__";
                        update("mainCategory", val);
                        update("subCategory", "");
                        update("selectedSubCategories", []);
                      }}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all ${
                        form.mainCategory === "__other__"
                          ? "border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/40 font-bold"
                          : "border-dashed border-border/80 bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                      }`}
                    >
                      + Custom
                    </button>
                  </div>
                ) : (
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
                        : "Select main category…"}
                    </option>
                    <option value="__other__">+ Other Work / Custom Category...</option>
                  </select>
                )}
              </div>

              {/* ── Primary Subcategory (Optional) ── */}
              {form.mainCategory && form.mainCategory !== "__other__" && availableSubCategories.length > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor="case-sub-category" className="text-helper">Primary Case Subcategory (Optional)</Label>
                  <select
                    id="case-sub-category"
                    value={form.subCategory}
                    onChange={(e) => update("subCategory", e.target.value)}
                    className="h-11 w-full rounded-md border border-border bg-card px-3 text-helper outline-none transition-colors focus:border-primary"
                  >
                    <option value="">Select primary subcategory (or configure individual tasks below)…</option>
                    {availableSubCategories.map((sc) => (
                      <option key={sc._id || sc.name} value={sc.name}>
                        {sc.name}
                      </option>
                    ))}
                    <option value="__other__">+ Custom subcategory...</option>
                  </select>
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
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              {/* Top Info Banner */}
              <div className="rounded-lg border border-blue-200 bg-blue-50/70 dark:border-blue-900/60 dark:bg-blue-950/40 p-3.5 flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-900 dark:text-blue-200 space-y-0.5">
                  <p className="font-semibold text-blue-950 dark:text-blue-100">
                    Create Independent Tasks from Subcategories
                  </p>
                  <p className="text-[11px] leading-relaxed opacity-90">
                    Select subcategories to create separate tasks for this case. Each selected subcategory will be added as an independent task with its own assignees, deadline, instructions, and checklist steps.
                  </p>
                </div>
              </div>

              {/* Selected Main Category Badge */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-b border-border/50 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Selected Main Category:</span>
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20">
                    {form.mainCategory || "None selected (choose in Case Details above)"}
                  </span>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs text-primary border-primary/30 h-8 px-3 hover:bg-primary/10 font-semibold rounded-lg"
                  onClick={addTask}
                >
                  <Plus size={13} className="mr-1.5" /> Add Custom Task
                </Button>
              </div>

              {/* Available Subcategories Selector */}
              {form.mainCategory && availableSubCategories.length > 0 && (
                <div className="rounded-lg border border-border/80 bg-muted/20 p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <CheckSquare size={14} className="text-primary" />
                        Available Subcategories
                      </Label>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Check subcategories below to create independent tasks
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const allNames = availableSubCategories.map((s) => s.name);
                          setCheckedSubCategoriesForTasks(allNames);
                        }}
                        className="text-[11px] text-primary hover:underline font-medium"
                      >
                        Select all
                      </button>
                      <span className="text-muted-foreground text-xs">|</span>
                      <button
                        type="button"
                        onClick={() => setCheckedSubCategoriesForTasks([])}
                        className="text-[11px] text-muted-foreground hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                    {availableSubCategories.map((sc) => {
                      const isChecked = checkedSubCategoriesForTasks.includes(sc.name);
                      const isAlreadyCreated = tasks.some(
                        (t) => t.title.toLowerCase() === sc.name.toLowerCase()
                      );
                      return (
                        <label
                          key={sc._id || sc.name}
                          className={`flex items-start gap-2.5 rounded-lg border p-2 text-xs cursor-pointer transition-all ${
                            isAlreadyCreated
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 opacity-80"
                              : isChecked
                              ? "border-primary bg-primary/10 text-foreground font-semibold shadow-xs"
                              : "border-border/70 bg-card hover:bg-muted text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked || isAlreadyCreated}
                            disabled={isAlreadyCreated}
                            onChange={(e) => {
                              if (isAlreadyCreated) return;
                              const c = e.target.checked;
                              setCheckedSubCategoriesForTasks((prev) =>
                                c ? [...prev, sc.name] : prev.filter((name) => name !== sc.name)
                              );
                            }}
                            className="mt-0.5 size-3.5 rounded border-border text-primary focus:ring-primary shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <span className="leading-tight block truncate select-none">
                              {sc.name}
                            </span>
                            {isAlreadyCreated && (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal block mt-0.5">
                                ✓ Added as task
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-end pt-1">
                    <Button
                      type="button"
                      size="sm"
                      disabled={checkedSubCategoriesForTasks.length === 0}
                      onClick={handleAddSelectedSubCategoriesAsTasks}
                      className="h-8 text-xs font-semibold px-4 bg-primary text-primary-foreground rounded-lg shadow-xs hover:bg-primary/95"
                    >
                      <Plus size={13} className="mr-1.5" />
                      Add Selected as Tasks ({checkedSubCategoriesForTasks.length})
                    </Button>
                  </div>
                </div>
              )}

              {/* Created Tasks List */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    Created Tasks ({tasks.length})
                  </Label>
                  {tasks.length > 0 && (
                    <span className="text-[11px] text-muted-foreground">
                      Click any task card to expand and edit full details
                    </span>
                  )}
                </div>

                {tasks.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic bg-muted/20 rounded-xl p-5 border border-dashed border-border text-center space-y-1">
                    <p className="font-medium text-foreground/80">No initial tasks created yet</p>
                    <p className="text-[11px]">
                      Select subcategories above or click &quot;+ Add Custom Task&quot; to define tasks for this specific case right away.
                    </p>
                  </div>
                ) : (
                  tasks.map((t, idx) => {
                    const isExpanded = expandedTaskIndexes[idx] ?? true;
                    return (
                      <div
                        key={idx}
                        className={`rounded-xl border bg-card shadow-xs transition-all border-l-4 ${
                          t.priority === "High"
                            ? "border-l-destructive border-border"
                            : t.priority === "Medium"
                            ? "border-l-amber-500 border-border"
                            : "border-l-emerald-500 border-border"
                        }`}
                      >
                        {/* Card Header */}
                        <div className="flex items-center justify-between p-3.5 bg-muted/10 rounded-t-xl gap-2">
                          <div
                            onClick={() => toggleTaskExpand(idx)}
                            className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer"
                          >
                            {isExpanded ? (
                              <ChevronUp size={16} className="text-muted-foreground shrink-0" />
                            ) : (
                              <ChevronDown size={16} className="text-muted-foreground shrink-0" />
                            )}
                            <span className="font-semibold text-xs text-foreground truncate">
                              {t.title || `Task #${idx + 1}`}
                            </span>
                            {t.subCategory && (
                              <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-medium truncate hidden sm:inline-block">
                                {t.subCategory}
                              </span>
                            )}
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                t.priority === "High"
                                  ? "bg-destructive/15 text-destructive"
                                  : t.priority === "Medium"
                                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                  : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                              }`}
                            >
                              {t.priority}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {t.checklist.length > 0 && (
                              <span className="text-[10px] font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full border border-border">
                                {t.checklist.length} step{t.checklist.length !== 1 ? "s" : ""}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => removeTask(idx)}
                              className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-destructive/10"
                              title="Remove task"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>

                        {/* Card Body (Expanded) */}
                        {isExpanded && (
                          <div className="p-4 space-y-4 border-t border-border/50">
                            {/* Task Title */}
                            <div className="space-y-1.5">
                              <Label className="text-xs font-semibold text-foreground">
                                Task Title <span className="text-destructive">*</span>
                              </Label>
                              <Input
                                value={t.title}
                                onChange={(e) => updateTask(idx, "title", e.target.value)}
                                placeholder="Task title (e.g. CIDCO FINAL NOC) *"
                                className="h-9 text-xs rounded-lg font-medium bg-background"
                                required
                              />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <Label className="text-[11px] text-muted-foreground font-medium">Category</Label>
                                <select
                                  value={extractCategoryName(t.category)}
                                  onChange={(e) => updateTask(idx, "category", e.target.value)}
                                  className="h-9 w-full rounded-lg border border-border bg-background px-2 text-xs"
                                >
                                  {categories.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                  ))}
                                  <option value="Other Work">Other Work</option>
                                </select>
                              </div>

                              <div>
                                <Label className="text-[11px] text-muted-foreground font-medium">Priority</Label>
                                <select
                                  value={t.priority}
                                  onChange={(e) => updateTask(idx, "priority", e.target.value as any)}
                                  className="h-9 w-full rounded-lg border border-border bg-background px-2 text-xs font-medium"
                                >
                                  <option value="High">High Priority</option>
                                  <option value="Medium">Medium Priority</option>
                                  <option value="Low">Low Priority</option>
                                </select>
                              </div>

                              <div>
                                <Label className="text-[11px] text-muted-foreground font-medium">Deadline</Label>
                                <Input
                                  type="datetime-local"
                                  value={t.deadline}
                                  onChange={(e) => updateTask(idx, "deadline", e.target.value)}
                                  className="h-9 text-xs rounded-lg bg-background"
                                />
                              </div>
                            </div>

                            {/* Assignee Selector */}
                            <div className="space-y-1.5">
                              <Label className="text-[11px] font-semibold text-foreground">
                                Assigned Staff &amp; Counsel
                              </Label>
                              <AssigneeMultiSelect
                                value={Array.isArray(t.assignedTo) ? t.assignedTo : (t.assignedTo ? [t.assignedTo] : [])}
                                onChange={(val) => updateTask(idx, "assignedTo", val)}
                                placeholder="Select one or more assignees..."
                              />
                            </div>

                            {/* Task Description */}
                            <div className="space-y-1.5">
                              <Label className="text-[11px] font-semibold text-foreground">
                                Task Description &amp; Instructions
                              </Label>
                              <Input
                                value={t.description || ""}
                                onChange={(e) => updateTask(idx, "description", e.target.value)}
                                placeholder="Provide detailed instructions for this task..."
                                className="h-9 text-xs rounded-lg bg-background"
                              />
                            </div>

                            {/* Internal Notes */}
                            <div className="space-y-1.5">
                              <Label className="text-[11px] font-semibold text-foreground">
                                Additional Internal Notes
                              </Label>
                              <Input
                                value={t.notes || ""}
                                onChange={(e) => updateTask(idx, "notes", e.target.value)}
                                placeholder="Notes visible only to internal team members..."
                                className="h-9 text-xs rounded-lg bg-background"
                              />
                            </div>

                            {/* Subtasks / Checklist Items */}
                            <div className="space-y-2.5 pt-2 border-t border-border/50">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                  <CheckSquare size={13} className="text-primary" />
                                  Sub-tasks &amp; Checklist Steps ({t.checklist.length})
                                </Label>
                              </div>

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
                                  placeholder="Add custom checklist step and press Enter..."
                                  className="h-8 text-xs rounded-lg bg-background"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 px-3 text-xs rounded-lg font-medium"
                                  onClick={() => addChecklistItemToTask(idx)}
                                >
                                  <Plus size={12} className="mr-1" /> Add Step
                                </Button>
                              </div>

                              {t.checklist.length > 0 && (
                                <div className="space-y-1.5 mt-2">
                                  {t.checklist.map((item, cIdx) => (
                                    <div
                                      key={item.id || cIdx}
                                      className="space-y-1.5 rounded-lg border border-border/70 bg-muted/10 p-2.5 text-xs"
                                    >
                                      <div className="flex items-center gap-2">
                                        <Input
                                          value={item.text}
                                          onChange={(e) => updateChecklistItemText(idx, cIdx, e.target.value)}
                                          placeholder="Step description..."
                                          className="h-7 flex-1 text-xs font-medium rounded-md bg-background"
                                        />
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => addSubItemToTaskChecklist(idx, cIdx)}
                                          className="h-7 text-xs text-primary hover:bg-primary/10 px-2"
                                        >
                                          <Plus size={11} className="mr-1" /> Sub-item
                                        </Button>
                                        <button
                                          type="button"
                                          onClick={() => removeChecklistItemFromTask(idx, cIdx)}
                                          className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                          aria-label="Remove checklist item"
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </div>

                                      {/* Nested sub-items */}
                                      {Array.isArray(item.subItems) && item.subItems.length > 0 && (
                                        <div className="pl-3 space-y-1 border-l-2 border-primary/20 ml-2 mt-1">
                                          {item.subItems.map((sub, sIdx) => (
                                            <div key={sub.id || sIdx} className="flex items-center gap-1.5">
                                              <CornerDownRight size={11} className="text-muted-foreground shrink-0" />
                                              <Input
                                                value={sub.text}
                                                onChange={(e) => updateSubItemText(idx, cIdx, sIdx, e.target.value)}
                                                placeholder="Sub-step detail…"
                                                className="h-6 text-[11px] rounded-md bg-background"
                                              />
                                              <button
                                                type="button"
                                                onClick={() => removeSubItemFromTaskChecklist(idx, cIdx, sIdx)}
                                                className="grid size-5 shrink-0 place-items-center text-muted-foreground hover:text-destructive"
                                                aria-label="Remove sub-item"
                                              >
                                                <Trash2 size={11} />
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
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>{/* end inner tasks wrapper */}

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