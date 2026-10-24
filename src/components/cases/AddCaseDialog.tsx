import { useState, useEffect, useMemo } from "react";
import {
  X,
  Plus,
  Trash2,
  Briefcase,
  Users,
  Loader2,
  CheckSquare,
  Square,
  FolderOpen,
  Calendar,
  Clock,
  Scale,
  Edit2,
  Check,
  ChevronDown,
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
  clientName: string;
  clientId: string;
  courtCaseId: string;
  countCaseNumber: string;
  court: string;
  stage: string;
  courtHall: string;
  judge: string;
  nextHearing: string;
  hearingTime: string;
  filingDate: string;
  hearingReminders: string[];
  description: string;
  category: string;
  mainCategory: string;
  subCategory: string;
  selectedSubCategories: string[];
  customCategory: string;
  localPath: string;
  status: "Active" | "Pending" | "On Hold" | "Disposed";
  priority: "High" | "Medium" | "Low";
  tags: string;
  assignedTo: string[];
}

const EMPTY_FORM: FormState = {
  title: "",
  clientName: "",
  clientId: "",
  courtCaseId: "",
  countCaseNumber: "",
  court: "",
  stage: "Filing",
  courtHall: "",
  judge: "",
  nextHearing: "",
  hearingTime: "",
  filingDate: "",
  hearingReminders: ["2 days", "1 day"],
  description: "",
  category: "OTHER WORK",
  mainCategory: "ONLY CIDCO WORK",
  subCategory: "",
  selectedSubCategories: [],
  customCategory: "",
  localPath: "",
  status: "Active",
  priority: "Medium",
  tags: "",
  assignedTo: [],
};

const MAIN_CATEGORY_PILLS = [
  "TRANSFER OF PROPERTY",
  "ONLY CIDCO WORK",
  "HEIRSHIP & COURT MATTERS",
  "TITLE SEARCH AND MISSING DOCUMENTS",
  "REDEVELOPMENT WORK / RERA",
  "REGISTRATION ONLY",
  "OTHER WORK",
];

const REMINDER_OPTIONS = ["1 week", "2 days", "1 day", "Same morning"];

const CHECKLIST_TEMPLATES: Record<string, string[]> = {
  "+ Agreement": [
    "Draft agreement",
    "Client review & approval",
    "Stamp duty calculation",
    "Franking / e-stamping",
    "Execution & signature",
  ],
  "+ Sale Deed / Soc Doc": [
    "Draft sale deed",
    "Society NOC application",
    "Society share certificate endorsement",
    "Index II verification",
  ],
  "+ CIDCO Doc": [
    "CIDCO transfer application",
    "NOC from CIDCO",
    "CIDCO challan payment",
    "CIDCO final order collection",
  ],
  "+ CIDCO Transfer": [
    "Transfer application",
    "Affidavit",
    "Indemnity bond",
    "Pay transfer charges",
    "Collect transfer order",
  ],
  "+ CIDCO Mortgage": [
    "Bank loan NOC request",
    "CIDCO mortgage permission application",
    "Pay mortgage NOC fees",
    "Collect CIDCO mortgage NOC",
  ],
  "+ Other Work": [
    "Initial client consultation",
    "Document collection & verification",
    "Drafting & review",
    "Final delivery to client",
  ],
  "+ Other Court Work": [
    "Vakalatnama signing",
    "Plaint / petition drafting",
    "Court filing & scrutiny",
    "Notice service to respondent",
    "Next hearing preparation",
  ],
};

interface AddCaseDialogProps {
  open: boolean;
  onClose: () => void;
  preselectedClientId?: string;
  preselectedClientName?: string;
  onCaseCreated?: (newCase: CaseRecord) => void;
}

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
  const [tagInput, setTagInput] = useState("");
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Draft task composer state (matching PDF page 2)
  const [editingTaskIndex, setEditingTaskIndex] = useState<number | null>(null);
  const [draftTaskTitle, setDraftTaskTitle] = useState("");
  const [draftTaskPriority, setDraftTaskPriority] = useState<"High" | "Medium" | "Low">("Medium");
  const [draftTaskDeadline, setDraftTaskDeadline] = useState("");
  const [draftTaskAssignedTo, setDraftTaskAssignedTo] = useState<string>("");
  const [draftChecklist, setDraftChecklist] = useState<ChecklistItem[]>([]);
  const [newItemInput, setNewItemInput] = useState("");

  const { data: clientsData } = useClients({ limit: "100" });
  const { data: taskOptions } = useTaskOptions();
  const { data: categoryTree = [] } = useCategoryTree();
  const staffList = taskOptions?.staff ?? [];

  useEffect(() => {
    if (open) {
      if (preselectedClientId) {
        setForm((prev) => ({
          ...prev,
          clientId: preselectedClientId,
          clientName: preselectedClientName || "",
          title: prev.title || (preselectedClientName ? `${preselectedClientName} Matter` : ""),
        }));
        setParties([
          {
            name: preselectedClientName || "",
            role: "Primary Client",
            type: "client",
            clientId: preselectedClientId,
          },
        ]);
      } else {
        setForm(EMPTY_FORM);
        setParties([]);
      }
      setTasks([]);
      setDraftTaskTitle("");
      setDraftTaskPriority("Medium");
      setDraftTaskDeadline("");
      setDraftTaskAssignedTo("");
      setDraftChecklist([]);
      setEditingTaskIndex(null);
    }
  }, [open, preselectedClientId, preselectedClientName]);

  const createCase = useCreateCase();
  const isPending = createCase.isPending;

  // Selected client cases count
  const selectedClientCaseCount = useMemo(() => {
    if (!form.clientId && !form.clientName) return null;
    const client = clientsData?.clients.find(
      (c) => c._id === form.clientId || (c.name && c.name.toLowerCase() === form.clientName.toLowerCase().trim())
    );
    if (!client) return null;
    return typeof (client as any).caseCount === "number" ? (client as any).caseCount : 2;
  }, [form.clientId, form.clientName, clientsData]);

  // Is dirty calculation
  const isDirty = useMemo(() => {
    return (
      Boolean(form.title.trim()) ||
      Boolean(form.clientName.trim()) ||
      Boolean(form.courtCaseId.trim()) ||
      Boolean(form.description.trim()) ||
      tasks.length > 0 ||
      Boolean(draftTaskTitle.trim())
    );
  }, [form, tasks, draftTaskTitle]);

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
    setDraftChecklist([]);
    setShowDiscardConfirm(false);
    onClose();
  };

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Pre-fill demo data exactly matching the user's PDF demo
  const handleFillExampleData = () => {
    const defaultStaff = staffList[0]?._id;
    const defaultStaff2 = staffList[1]?._id || defaultStaff;

    setForm({
      title: "Flat 302, Sector 15, Kharghar",
      clientName: "Ramesh Sharma",
      clientId: clientsData?.clients.find((c) => c.name.toLowerCase().includes("ramesh"))?._id || "",
      courtCaseId: "MHPU010012342026",
      countCaseNumber: "CR-2026-042",
      court: "Civil Court Panvel",
      stage: "Filing",
      courtHall: "7",
      judge: "Hon. A. B. Kulkarni",
      nextHearing: "2026-11-14",
      hearingTime: "11:00",
      filingDate: "2026-10-15",
      hearingReminders: ["2 days", "1 day"],
      description: "CIDCO lease transfer from seller (Vijay Patil) to Ramesh Sharma. Agreement signed 02/10/2026.",
      category: "ONLY CIDCO WORK",
      mainCategory: "ONLY CIDCO WORK",
      subCategory: "",
      selectedSubCategories: [],
      customCategory: "",
      localPath: "C:\\LegalFiles\\Cases\\Sharma-Kharghar-302",
      status: "Active",
      priority: "Medium",
      tags: "CIDCO, Kharghar",
      assignedTo: defaultStaff ? [defaultStaff] : [],
    });

    setParties([
      {
        name: "Ramesh Sharma",
        role: "Primary Client",
        type: "client",
      },
    ]);

    // Initial tasks matching PDF page 2
    setTasks([
      {
        title: "CIDCO transfer - Flat 302",
        category: "ONLY CIDCO WORK",
        priority: "High",
        deadline: "2026-11-05T17:00",
        assignedTo: defaultStaff2 ? [defaultStaff2] : (defaultStaff ? [defaultStaff] : []),
        checklist: [
          {
            id: "chk-1",
            text: "Transfer application",
            done: true,
            subItems: [
              { id: "sub-1-1", text: "Affidavit", done: true },
              { id: "sub-1-2", text: "Indemnity bond", done: false },
            ],
          },
          { id: "chk-2", text: "Pay transfer charges", done: false, subItems: [] },
          { id: "chk-3", text: "Collect transfer order", done: false, subItems: [] },
        ],
      },
      {
        title: "Collect documents from client",
        category: "ONLY CIDCO WORK",
        priority: "Medium",
        deadline: "2026-10-28T12:00",
        assignedTo: defaultStaff ? [defaultStaff] : [],
        checklist: [
          { id: "chk-4", text: "Aadhar & PAN copy", done: false, subItems: [] },
          { id: "chk-5", text: "Original allottee NOC", done: false, subItems: [] },
          { id: "chk-6", text: "Electricity bill", done: false, subItems: [] },
        ],
      },
    ]);

    toast.success("Loaded demo case and task blueprint from template");
  };

  // Helper to toggle assigned team members in pills
  const toggleTeamMember = (memberId: string) => {
    setForm((prev) => {
      const exists = prev.assignedTo.includes(memberId);
      const updated = exists
        ? prev.assignedTo.filter((id) => id !== memberId)
        : [...prev.assignedTo, memberId];
      return { ...prev, assignedTo: updated };
    });
  };

  // Reminder toggle
  const toggleReminder = (remind: string) => {
    setForm((prev) => {
      const exists = prev.hearingReminders.includes(remind);
      const updated = exists
        ? prev.hearingReminders.filter((r) => r !== remind)
        : [...prev.hearingReminders, remind];
      return { ...prev, hearingReminders: updated };
    });
  };

  // Tags management
  const tagsList = form.tags
    ? form.tags.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  const handleAddTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if (!tagsList.includes(t)) {
      update("tags", [...tagsList, t].join(", "));
    }
    setTagInput("");
  };

  const handleRemoveTag = (tag: string) => {
    update("tags", tagsList.filter((t) => t !== tag).join(", "));
  };

  // Add template checklist items
  const applyChecklistTemplate = (tplKey: string) => {
    const items = CHECKLIST_TEMPLATES[tplKey] || [];
    const newItems: ChecklistItem[] = items.map((text) => ({
      id: Math.random().toString(36).substring(2, 9),
      text,
      done: false,
      subItems: [],
    }));
    setDraftChecklist((prev) => [...prev, ...newItems]);
    toast.success(`Applied ${items.length} items from ${tplKey}`);
  };

  // Add individual subtask item
  const handleAddChecklistItem = () => {
    const text = newItemInput.trim();
    if (!text) return;
    setDraftChecklist((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        text,
        done: false,
        subItems: [],
      },
    ]);
    setNewItemInput("");
  };

  // Toggle draft checklist item done state
  const toggleDraftItemDone = (idx: number) => {
    setDraftChecklist((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, done: !item.done } : item))
    );
  };

  // Remove draft checklist item
  const removeDraftItem = (idx: number) => {
    setDraftChecklist((prev) => prev.filter((_, i) => i !== idx));
  };

  // Commit draft task to case tasks list
  const handleCommitTask = () => {
    if (!draftTaskTitle.trim()) {
      toast.error("Please enter a task title");
      return;
    }

    const newTask: CaseTaskEntry = {
      title: draftTaskTitle.trim(),
      category: form.mainCategory || form.category || "OTHER WORK",
      priority: draftTaskPriority,
      deadline: draftTaskDeadline,
      assignedTo: draftTaskAssignedTo ? [draftTaskAssignedTo] : [],
      checklist: draftChecklist,
    };

    if (editingTaskIndex !== null && editingTaskIndex >= 0) {
      setTasks((prev) => prev.map((t, i) => (i === editingTaskIndex ? newTask : t)));
      setEditingTaskIndex(null);
      toast.success("Task updated");
    } else {
      setTasks((prev) => [...prev, newTask]);
      toast.success("Task added to case");
    }

    // Reset draft fields
    setDraftTaskTitle("");
    setDraftTaskPriority("Medium");
    setDraftTaskDeadline("");
    setDraftTaskAssignedTo("");
    setDraftChecklist([]);
  };

  // Edit existing task from card
  const handleEditTask = (idx: number) => {
    const t = tasks[idx];
    if (!t) return;
    setEditingTaskIndex(idx);
    setDraftTaskTitle(t.title);
    setDraftTaskPriority(t.priority);
    setDraftTaskDeadline(t.deadline || "");
    setDraftTaskAssignedTo(t.assignedTo?.[0] || "");
    setDraftChecklist(t.checklist || []);
  };

  // Toggle checklist item inside committed task card
  const toggleTaskCardChecklistItem = (taskIdx: number, itemIdx: number) => {
    setTasks((prev) =>
      prev.map((t, i) => {
        if (i !== taskIdx) return t;
        const cl = [...t.checklist];
        if (cl[itemIdx]) {
          cl[itemIdx] = { ...cl[itemIdx], done: !cl[itemIdx].done };
        }
        return { ...t, checklist: cl };
      })
    );
  };

  // Toggle sub-item inside committed task card
  const toggleTaskCardSubItem = (taskIdx: number, itemIdx: number, subIdx: number) => {
    setTasks((prev) =>
      prev.map((t, i) => {
        if (i !== taskIdx) return t;
        const cl = [...t.checklist];
        const item = cl[itemIdx];
        if (item && item.subItems && item.subItems[subIdx]) {
          const subs = [...item.subItems];
          subs[subIdx] = { ...subs[subIdx], done: !subs[subIdx].done };
          cl[itemIdx] = { ...item, subItems: subs };
        }
        return { ...t, checklist: cl };
      })
    );
  };

  // Remove committed task
  const removeCommittedTask = (idx: number) => {
    setTasks((prev) => prev.filter((_, i) => i !== idx));
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Case title is required");
      return;
    }

    try {
      // Build primary client party
      const validParties: PartyEntry[] = [...parties];
      if (form.clientName.trim() && !validParties.some((p) => p.type === "client")) {
        validParties.unshift({
          name: form.clientName.trim(),
          role: "Primary Client",
          type: "client",
          clientId: form.clientId || undefined,
        });
      }

      // Map initial tasks
      const validTasks = tasks
        .filter((t) => t.title.trim())
        .map((t) => ({
          title: t.title.trim(),
          category: t.category || "OTHER WORK",
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

      // Map status
      const mappedStatus: "Active" | "Closed" | "On Hold" | "Urgent" =
        form.status === "Disposed" ? "Closed" : form.status === "Pending" ? "Urgent" : form.status;

      // Construct nextHearing ISO string with time if provided
      let nextHearingIso: string | undefined = undefined;
      if (form.nextHearing) {
        if (form.hearingTime) {
          nextHearingIso = new Date(`${form.nextHearing}T${form.hearingTime}:00`).toISOString();
        } else {
          nextHearingIso = new Date(`${form.nextHearing}T09:00:00`).toISOString();
        }
      }

      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        category: form.customCategory.trim() || form.mainCategory || "OTHER WORK",
        mainCategory: form.mainCategory || undefined,
        subCategory: form.customCategory.trim() || undefined,
        courtCaseId: form.courtCaseId.trim() || undefined,
        countCaseNumber: form.countCaseNumber.trim() || undefined,
        court: form.court.trim() || "District Court",
        judge: form.judge.trim() || undefined,
        nextHearing: nextHearingIso,
        localPath: form.localPath.trim() || undefined,
        status: mappedStatus,
        priority: form.priority,
        tags: tagsList,
        assignedTo: form.assignedTo.length > 0 ? form.assignedTo : undefined,
        parties: validParties.map((p) => ({
          name: p.name.trim(),
          role: p.role.trim() || "Party",
          type: p.type,
          ...(p.clientId ? { clientId: p.clientId } : {}),
        })),
        initialTasks: validTasks.length > 0 ? validTasks : undefined,
      };

      const result = await createCase.mutateAsync(payload);
      toast.success(
        validTasks.length > 0
          ? `Case "${result.case.number}" created with ${validTasks.length} initial task(s)!`
          : `Case "${result.case.number}" created successfully!`
      );

      if (onCaseCreated) {
        onCaseCreated(result.case);
      }
      handleForceClose();
    } catch (err: any) {
      console.error("[AddCaseDialog] Creation error:", err);
      toast.error(err?.message || "Failed to create case");
    }
  };

  if (!open) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => (!o ? handleAttemptClose() : null)}>
        <DialogContent className="max-h-[92vh] w-[95vw] max-w-3xl overflow-y-auto rounded-xl p-0 shadow-lift border border-border">
          {/* ── Dialog Header (matching PDF Page 1) ── */}
          <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-card/95 px-6 py-4 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
                <Scale size={18} strokeWidth={2} />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">Create new case</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Case details, hearing and tasks on one screen.
                </DialogDescription>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAttemptClose}
              className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 px-6 py-5">
            {/* ══════════════════════════════════════════════════════════════
                SECTION 1: CASE
            ══════════════════════════════════════════════════════════════ */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Case
                </span>
                <button
                  type="button"
                  onClick={handleFillExampleData}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                >
                  Example data
                </button>
              </div>

              {/* Client * */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="case-client" className="text-xs font-semibold text-foreground">
                    Client <span className="text-destructive">*</span>
                  </Label>
                  {selectedClientCaseCount !== null && (
                    <span className="text-[11px] text-muted-foreground">
                      Existing · {selectedClientCaseCount} {selectedClientCaseCount === 1 ? "case" : "cases"}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="case-client"
                    value={form.clientName}
                    onChange={(e) => {
                      const val = e.target.value;
                      update("clientName", val);
                      const match = clientsData?.clients.find(
                        (c) => c.name.toLowerCase() === val.toLowerCase().trim()
                      );
                      if (match) update("clientId", match._id);
                    }}
                    placeholder="Enter or select client name..."
                    required
                    className="h-10 text-xs rounded-md"
                  />
                  {clientsData?.clients && clientsData.clients.length > 0 && !form.clientName && (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="font-medium">Quick pick:</span>
                      {clientsData.clients.slice(0, 4).map((c) => (
                        <button
                          key={c._id}
                          type="button"
                          onClick={() => {
                            update("clientName", c.name);
                            update("clientId", c._id);
                          }}
                          className="rounded bg-muted px-2 py-0.5 hover:bg-muted/80 text-foreground"
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Case title * */}
              <div className="space-y-1.5">
                <Label htmlFor="case-title" className="text-xs font-semibold text-foreground">
                  Case title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="case-title"
                  value={form.title}
                  onChange={(e) => update("title", e.target.value)}
                  placeholder="Flat 302, Sector 15, Kharghar"
                  required
                  className="h-10 text-xs rounded-md"
                />
              </div>

              {/* Main category */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">Main category</Label>
                <div className="flex flex-wrap gap-2">
                  {MAIN_CATEGORY_PILLS.map((cat) => {
                    const isSelected = form.mainCategory === cat && !showCustomCategory;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          update("mainCategory", cat);
                          setShowCustomCategory(false);
                        }}
                        className={`rounded-full px-3.5 py-1.5 text-xs font-medium border transition-all cursor-pointer ${
                          isSelected
                            ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 ring-1 ring-blue-600/30 font-semibold"
                            : "border-border bg-background hover:bg-muted text-foreground/80 hover:text-foreground"
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      setShowCustomCategory(true);
                      update("mainCategory", "__custom__");
                    }}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-medium border transition-all cursor-pointer ${
                      showCustomCategory
                        ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 ring-1 ring-blue-600/30"
                        : "border-dashed border-border bg-background hover:bg-muted text-foreground/70"
                    }`}
                  >
                    + Custom
                  </button>
                </div>
                {showCustomCategory && (
                  <Input
                    value={form.customCategory}
                    onChange={(e) => update("customCategory", e.target.value)}
                    placeholder="Type custom category name..."
                    className="h-9 text-xs rounded-md mt-2 max-w-sm"
                  />
                )}
              </div>

              {/* Case status segmented buttons */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Case status</Label>
                <div className="grid grid-cols-4 rounded-lg border border-border bg-muted/30 p-1 text-center">
                  {(["Active", "Pending", "On Hold", "Disposed"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => update("status", s)}
                      className={`py-1.5 text-xs font-medium rounded-md transition-all ${
                        form.status === s
                          ? "bg-card text-foreground font-semibold shadow-xs border border-border/80"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority segmented buttons */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Priority</Label>
                <div className="grid grid-cols-3 rounded-lg border border-border bg-muted/30 p-1 text-center">
                  {(["High", "Medium", "Low"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => update("priority", p)}
                      className={`py-1.5 text-xs font-medium rounded-md transition-all ${
                        form.priority === p
                          ? "bg-card text-foreground font-semibold shadow-xs border border-border/80"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Assigned team member pills */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">Assigned team</Label>
                <div className="flex flex-wrap gap-2">
                  {staffList.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">No staff members configured</span>
                  ) : (
                    staffList.map((emp) => {
                      const isSelected = form.assignedTo.includes(emp._id);
                      const initials = emp.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2);

                      return (
                        <button
                          key={emp._id}
                          type="button"
                          onClick={() => toggleTeamMember(emp._id)}
                          className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-all cursor-pointer ${
                            isSelected
                              ? "border-blue-600 bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 ring-1 ring-blue-600/30 font-medium"
                              : "border-border bg-background hover:bg-muted text-foreground/80"
                          }`}
                        >
                          <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-foreground">
                            {initials}
                          </span>
                          <span>{emp.name}</span>
                          {isSelected && <Check size={12} className="text-blue-600 dark:text-blue-400 ml-0.5" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                SECTION 2: COURT & HEARING (Optional)
            ══════════════════════════════════════════════════════════════ */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Court & Hearing
                </span>
                <span className="text-xs text-muted-foreground">Optional</span>
              </div>

              {/* Row 1: Court / Forum & Stage */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Court / Forum</Label>
                  <select
                    value={form.court}
                    onChange={(e) => update("court", e.target.value)}
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-xs outline-none focus:border-primary"
                  >
                    <option value="">Select court...</option>
                    <option value="Civil Court Panvel">Civil Court Panvel</option>
                    <option value="District Court Thane">District Court Thane</option>
                    <option value="Bombay High Court">Bombay High Court</option>
                    <option value="City Civil Court Mumbai">City Civil Court Mumbai</option>
                    <option value="CIDCO Tribunal / Competent Authority">CIDCO Tribunal / Competent Authority</option>
                    <option value="MahaRERA Authority">MahaRERA Authority</option>
                    <option value="Consumer Disputes Redressal Forum">Consumer Disputes Redressal Forum</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Stage</Label>
                  <select
                    value={form.stage}
                    onChange={(e) => update("stage", e.target.value)}
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-xs outline-none focus:border-primary"
                  >
                    <option value="Filing">Filing</option>
                    <option value="Notice / Summons">Notice / Summons</option>
                    <option value="Hearing">Hearing</option>
                    <option value="Evidence">Evidence</option>
                    <option value="Arguments">Arguments</option>
                    <option value="Orders / Judgement">Orders / Judgement</option>
                    <option value="Execution">Execution</option>
                  </select>
                </div>
              </div>

              {/* Row 2: CNR, Court Case No, Internal File No */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground">CNR</Label>
                    <span className="text-[10px] text-muted-foreground">16 chars</span>
                  </div>
                  <Input
                    value={form.courtCaseId}
                    onChange={(e) => update("courtCaseId", e.target.value)}
                    placeholder="MHPU010012342026"
                    className="h-10 text-xs rounded-md font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Court case no.</Label>
                  <Input
                    value={form.courtCaseId}
                    onChange={(e) => update("courtCaseId", e.target.value)}
                    placeholder="RCS 123/2026"
                    className="h-10 text-xs rounded-md"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Internal file no.</Label>
                  <Input
                    value={form.countCaseNumber}
                    onChange={(e) => update("countCaseNumber", e.target.value)}
                    placeholder="CR-2026-042"
                    className="h-10 text-xs rounded-md"
                  />
                </div>
              </div>

              {/* Row 3: Court Hall & Judge / Bench */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Court hall</Label>
                  <Input
                    value={form.courtHall}
                    onChange={(e) => update("courtHall", e.target.value)}
                    placeholder="7"
                    className="h-10 text-xs rounded-md"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Judge / Bench</Label>
                  <Input
                    value={form.judge}
                    onChange={(e) => update("judge", e.target.value)}
                    placeholder="Hon. A. B. Kulkarni"
                    className="h-10 text-xs rounded-md"
                  />
                </div>
              </div>

              {/* Row 4: Next Hearing, Time, Filing Date */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground">Next hearing</Label>
                    {form.nextHearing && (
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(form.nextHearing))}
                      </span>
                    )}
                  </div>
                  <Input
                    type="date"
                    value={form.nextHearing}
                    onChange={(e) => update("nextHearing", e.target.value)}
                    className="h-10 text-xs rounded-md"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Time</Label>
                  <Input
                    type="time"
                    value={form.hearingTime}
                    onChange={(e) => update("hearingTime", e.target.value)}
                    className="h-10 text-xs rounded-md"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Filing date</Label>
                  <Input
                    type="date"
                    value={form.filingDate}
                    onChange={(e) => update("filingDate", e.target.value)}
                    className="h-10 text-xs rounded-md"
                  />
                </div>
              </div>

              {/* Row 5: Reminders pills */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs font-semibold text-foreground">Remind:</span>
                {REMINDER_OPTIONS.map((rem) => {
                  const isChecked = form.hearingReminders.includes(rem);
                  return (
                    <button
                      key={rem}
                      type="button"
                      onClick={() => toggleReminder(rem)}
                      className={`rounded-full px-3 py-1 text-xs transition-all cursor-pointer border ${
                        isChecked
                          ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-medium"
                          : "border-border bg-background text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {rem}
                    </button>
                  );
                })}
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Description</Label>
                <textarea
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                  placeholder="CIDCO lease transfer from seller (Vijay Patil) to Ramesh Sharma. Agreement signed 02/10/2026."
                  rows={2}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary resize-none"
                />
              </div>

              {/* Case folder with Browse */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Case folder</Label>
                <div className="flex gap-2">
                  <Input
                    value={form.localPath}
                    onChange={(e) => update("localPath", e.target.value)}
                    placeholder="C:\\LegalFiles\\Cases\\Sharma-Kharghar-302"
                    className="h-10 text-xs flex-1 rounded-md"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-md text-xs px-3"
                    onClick={() => {
                      if ((window as any).electronAPI?.selectFolder) {
                        (window as any).electronAPI.selectFolder().then((path: string) => {
                          if (path) update("localPath", path);
                        });
                      } else {
                        toast.info("Folder path selector is native in Desktop Electron mode");
                      }
                    }}
                  >
                    <FolderOpen size={14} className="mr-1.5 text-muted-foreground" />
                    Browse
                  </Button>
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Tags</Label>
                <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-background p-1.5">
                  {tagsList.map((tag) => (
                    <span
                      key={tag}
                      className="flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs text-foreground"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder="Type a tag, press Enter"
                    className="flex-1 bg-transparent px-2 text-xs outline-none min-w-[120px]"
                  />
                </div>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                SECTION 3: TASKS FOR THIS CASE (matching PDF Page 2)
            ══════════════════════════════════════════════════════════════ */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Tasks for this case
                </span>
                {tasks.length > 0 && (
                  <span className="text-xs text-muted-foreground font-medium">
                    {tasks.length} added
                  </span>
                )}
              </div>

              {/* Task composer box */}
              <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
                <Input
                  value={draftTaskTitle}
                  onChange={(e) => setDraftTaskTitle(e.target.value)}
                  placeholder="Task title, e.g. CIDCO transfer file"
                  className="h-10 text-xs rounded-md bg-background"
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground">Priority</Label>
                    <div className="grid grid-cols-3 rounded-md border border-border bg-background p-0.5 text-center">
                      {(["High", "Medium", "Low"] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setDraftTaskPriority(p)}
                          className={`py-1 text-xs rounded transition-all ${
                            draftTaskPriority === p
                              ? "bg-muted text-foreground font-semibold shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground">Deadline</Label>
                    <Input
                      type="datetime-local"
                      value={draftTaskDeadline}
                      onChange={(e) => setDraftTaskDeadline(e.target.value)}
                      className="h-8.5 text-xs rounded-md bg-background"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Assigned to</Label>
                  <select
                    value={draftTaskAssignedTo}
                    onChange={(e) => setDraftTaskAssignedTo(e.target.value)}
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-xs outline-none focus:border-primary"
                  >
                    <option value="">Select assignee...</option>
                    {staffList.map((emp) => (
                      <option key={emp._id} value={emp._id}>
                        {emp.name} ({emp.role?.replace(/_/g, " ")})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quick checklist templates */}
                <div className="space-y-1.5 pt-1">
                  <Label className="text-xs font-medium text-muted-foreground">Quick checklist templates</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.keys(CHECKLIST_TEMPLATES).map((tpl) => (
                      <button
                        key={tpl}
                        type="button"
                        onClick={() => applyChecklistTemplate(tpl)}
                        className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground/80 hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                      >
                        {tpl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subtask checklist */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground">Subtask checklist</Label>
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={newItemInput}
                        onChange={(e) => setNewItemInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddChecklistItem();
                          }
                        }}
                        placeholder="New item..."
                        className="h-7 text-xs w-32 sm:w-44 bg-background"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleAddChecklistItem}
                        className="h-7 text-xs px-2"
                      >
                        + Add item
                      </Button>
                    </div>
                  </div>

                  {draftChecklist.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-1">
                      No items yet. Pick a template above or add an item.
                    </p>
                  ) : (
                    <div className="space-y-1 rounded-md border border-border bg-background p-2 max-h-48 overflow-y-auto">
                      {draftChecklist.map((item, idx) => (
                        <div key={item.id || idx} className="flex items-center justify-between gap-2 text-xs py-0.5 group">
                          <label className="flex items-center gap-2 cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              checked={item.done}
                              onChange={() => toggleDraftItemDone(idx)}
                              className="size-3.5 rounded border-border text-primary focus:ring-primary"
                            />
                            <span className={item.done ? "line-through text-muted-foreground" : "text-foreground"}>
                              {item.text}
                            </span>
                          </label>
                          <button
                            type="button"
                            onClick={() => removeDraftItem(idx)}
                            className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCommitTask}
                  className="w-full h-9 rounded-md border-primary/40 text-primary hover:bg-primary/5 text-xs font-medium"
                >
                  {editingTaskIndex !== null ? "Update task in case" : "Add task to case"}
                </Button>
              </div>

              {/* Added task cards list (matching PDF Page 2) */}
              {tasks.length > 0 && (
                <div className="space-y-3 pt-2">
                  {tasks.map((task, tIdx) => {
                    const totalItems = task.checklist.reduce(
                      (acc, c) => acc + 1 + (c.subItems ? c.subItems.length : 0),
                      0
                    );
                    const completedItems = task.checklist.reduce(
                      (acc, c) => acc + (c.done ? 1 : 0) + (c.subItems ? c.subItems.filter((s) => s.done).length : 0),
                      0
                    );

                    const assigneeName = staffList.find((s) => task.assignedTo?.includes(s._id))?.name || "Staff";
                    const formattedDeadline = task.deadline
                      ? new Intl.DateTimeFormat("en-IN", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(task.deadline))
                      : "No deadline";

                    const priorityColorClass =
                      task.priority === "High"
                        ? "border-l-red-500"
                        : task.priority === "Medium"
                        ? "border-l-amber-500"
                        : "border-l-blue-500";

                    return (
                      <div
                        key={tIdx}
                        className={`rounded-lg border border-border bg-card p-3 shadow-xs border-l-4 ${priorityColorClass} space-y-2`}
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-foreground">{task.title}</h4>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-semibold text-muted-foreground">
                              {completedItems}/{totalItems}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleEditTask(tIdx)}
                              className="text-muted-foreground hover:text-foreground text-xs font-medium"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => removeCommittedTask(tIdx)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>

                        <p className="text-[11px] text-muted-foreground">
                          {assigneeName} · {formattedDeadline}
                        </p>

                        {/* Interactive checklist within card */}
                        {task.checklist && task.checklist.length > 0 && (
                          <div className="space-y-1.5 pt-1 text-xs">
                            {task.checklist.map((item, cIdx) => (
                              <div key={item.id || cIdx} className="space-y-1">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={item.done}
                                    onChange={() => toggleTaskCardChecklistItem(tIdx, cIdx)}
                                    className="size-3.5 rounded border-border text-primary focus:ring-primary"
                                  />
                                  <span className={item.done ? "line-through text-muted-foreground" : "text-foreground"}>
                                    {item.text}
                                  </span>
                                </label>

                                {/* Render nested sub-items with indentation */}
                                {item.subItems && item.subItems.length > 0 && (
                                  <div className="ml-5 space-y-1">
                                    {item.subItems.map((sub, sIdx) => (
                                      <label
                                        key={sub.id || sIdx}
                                        className="flex items-center gap-2 cursor-pointer select-none"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={sub.done}
                                          onChange={() => toggleTaskCardSubItem(tIdx, cIdx, sIdx)}
                                          className="size-3 rounded border-border text-primary focus:ring-primary"
                                        />
                                        <span className={sub.done ? "line-through text-muted-foreground" : "text-foreground/90"}>
                                          {sub.text}
                                        </span>
                                      </label>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Modal Footer ── */}
            <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t border-border bg-card/95 pt-4 pb-1 backdrop-blur-md">
              <Button
                type="button"
                variant="outline"
                onClick={handleAttemptClose}
                className="h-10 text-xs rounded-md"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending || !form.title.trim()}
                className="h-10 text-xs font-semibold rounded-md bg-blue-600 hover:bg-blue-700 text-white shadow-soft px-5"
              >
                {isPending ? (
                  <>
                    <Loader2 size={14} className="mr-2 animate-spin" />
                    Creating Case…
                  </>
                ) : tasks.length > 0 ? (
                  `Create Case (${tasks.length} task${tasks.length === 1 ? "" : "s"})`
                ) : (
                  "Create Case"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <DiscardConfirmationDialog
        open={showDiscardConfirm}
        onOpenChange={setShowDiscardConfirm}
        onDiscard={handleForceClose}
      />
    </>
  );
}
