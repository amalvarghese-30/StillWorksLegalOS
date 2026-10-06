import { useState, useEffect, useMemo } from "react";
import {
  X,
  Plus,
  Trash2,
  Briefcase,
  Users,
  Loader2,
  CheckSquare,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateCase, type CreateCasePayload, type CaseRecord } from "@/services/cases";
import { useClients } from "@/services/clients";
import { useTaskOptions } from "@/services/tasks";
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
  assignedTo: string;
  checklist: string[];
}

interface PartyEntry {
  name: string;
  role: string;
  type: "client" | "sub_client" | "opposing_party" | "counsel" | "other";
  clientId?: string | undefined;
}

interface FormState {
  title: string;
  description: string;
  practice: string;
  court: string;
  judge: string;
  status: "Active" | "On Hold" | "Closed" | "Urgent";
  priority: "High" | "Medium" | "Low";
  nextHearing: string;
  tags: string;
}

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  practice: "",
  court: "",
  judge: "",
  status: "Active",
  priority: "Medium",
  nextHearing: "",
  tags: "",
};

const PRACTICE_AREAS = [
  "Civil Litigation",
  "Criminal Law",
  "Family Law",
  "Property Law",
  "Corporate Law",
  "Tax Law",
  "Labour Law",
  "Consumer Protection",
  "Intellectual Property",
  "Constitutional Law",
  "Arbitration",
  "RERA",
  "NCLT / Insolvency",
  "Other",
];

const COURTS = [
  "Bombay High Court",
  "City Civil Court, Mumbai",
  "NCLT Mumbai",
  "NCLAT",
  "District Court, Thane",
  "District Court, Pune",
  "Family Court, Mumbai",
  "Consumer Forum",
  "RERA Tribunal",
  "Supreme Court",
  "Other",
];

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

  const { data: clientsData } = useClients({ limit: "100" });
  const { data: taskOptions } = useTaskOptions();

  const taskCategories = useMemo(() => {
    const list = [...(taskOptions?.categories ?? [
      "Court Case",
      "Agreement",
      "Sale Deed / Soc Doc",
      "Gift Deed",
      "Registration",
      "CIDCO Doc",
      "Other Work",
      "Meeting",
      "Personal",
    ])];
    const required = ["Gift Deed", "Registration"];
    for (const reqCat of required) {
      if (!list.includes(reqCat)) {
        list.push(reqCat);
      }
    }
    return list;
  }, [taskOptions?.categories]);

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
        category: "Court Case",
        priority: "Medium",
        deadline: "",
        assignedTo: "",
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

  const addSubtaskToTask = (idx: number) => {
    const text = (subtaskInput[idx] || "").trim();
    if (!text) return;
    setTasks((prev) =>
      prev.map((t, i) =>
        i === idx ? { ...t, checklist: [...t.checklist, text] } : t,
      ),
    );
    setSubtaskInput((prev) => ({ ...prev, [idx]: "" }));
  };

  const removeSubtaskFromTask = (taskIdx: number, subIdx: number) => {
    setTasks((prev) =>
      prev.map((t, i) =>
        i === taskIdx
          ? { ...t, checklist: t.checklist.filter((_, ci) => ci !== subIdx) }
          : t,
      ),
    );
  };

  const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);

  const addTag = () => {
    const val = tagInput.trim();
    if (!val) return;
    const current = tags;
    if (!current.includes(val)) {
      setForm((prev) => ({ ...prev, tags: [...current, val].join(", ") }));
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    const current = tags.filter((t) => t !== tag);
    setForm((prev) => ({ ...prev, tags: current.join(", ") }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    const validTasks = tasks
      .filter((t) => t.title.trim())
      .map((t) => ({
        title: t.title.trim(),
        category: t.category || "Court Case",
        priority: t.priority,
        ...(t.deadline ? { deadline: t.deadline } : {}),
        ...(t.assignedTo ? { assignedTo: t.assignedTo } : {}),
        ...(t.checklist.length > 0
          ? { checklist: t.checklist.map((text) => ({ text, done: false })) }
          : {}),
      }));

    const payload: CreateCasePayload = {
      title: form.title,
      status: form.status,
      priority: form.priority,
      ...(form.description && { description: form.description }),
      ...(form.practice && { practice: form.practice }),
      ...(form.court && { court: form.court }),
      ...(form.judge && { judge: form.judge }),
      ...(form.nextHearing && { nextHearing: form.nextHearing }),
      ...(tags.length > 0 && { tags }),
      ...(parties.length > 0 && { parties }),
      ...(validTasks.length > 0 && { tasks: validTasks }),
    };

    createCase.mutate(payload, {
      onSuccess: (data) => {
        toast.success(
          validTasks.length > 0
            ? `Case created with ${validTasks.length} task(s)`
            : "Case created successfully",
        );
        onCaseCreated?.(data.case);
        setForm(EMPTY_FORM);
        setParties([]);
        setTasks([]);
        setSubtaskInput({});
        setTagInput("");
        onClose();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto p-4 sm:p-6 rounded-2xl w-[95vw] sm:w-full ios-scroll">
        <DialogHeader>
          <DialogTitle>Add new case</DialogTitle>
          <DialogDescription>
            Create a new matter with parties, court info and metadata.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ── Basic Info ── */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="case-title" className="text-helper">Case title *</Label>
              <Input
                id="case-title"
                required
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="e.g. Mehra vs. Kapoor Estates"
                className="h-11 rounded-md"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="case-desc" className="text-helper">Description</Label>
              <Input
                id="case-desc"
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="Brief description of the matter"
                className="h-11 rounded-md"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="case-practice" className="text-helper">Practice area</Label>
              <select
                id="case-practice"
                value={form.practice}
                onChange={(e) => update("practice", e.target.value)}
                className="h-11 w-full rounded-md border border-border bg-card px-3 text-helper outline-none transition-colors focus:border-primary"
              >
                <option value="">Select practice area</option>
                {PRACTICE_AREAS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="case-court" className="text-helper">Court</Label>
              <select
                id="case-court"
                value={form.court}
                onChange={(e) => update("court", e.target.value)}
                className="h-11 w-full rounded-md border border-border bg-card px-3 text-helper outline-none transition-colors focus:border-primary"
              >
                <option value="">Select court</option>
                {COURTS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="case-judge" className="text-helper">Judge / Presiding Officer</Label>
              <Input
                id="case-judge"
                value={form.judge}
                onChange={(e) => update("judge", e.target.value)}
                placeholder="e.g. Justice A. M. Khanwilkar"
                className="h-11 rounded-md"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="case-hearing" className="text-helper">Next hearing</Label>
              <Input
                id="case-hearing"
                type="date"
                value={form.nextHearing}
                onChange={(e) => update("nextHearing", e.target.value)}
                className="h-11 rounded-md"
              />
            </div>
          </div>

          {/* ── Status & Priority ── */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-helper">Case status</Label>
              <div className="flex rounded-md border border-border">
                {(["Active", "Urgent", "On Hold", "Closed"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => update("status", s)}
                    className={`flex-1 px-2.5 py-2 text-caption font-medium transition-colors first:rounded-l-md last:rounded-r-md border-r border-border last:border-r-0 ${form.status === s
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
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
          </div>

          {/* ── Tags ── */}
          <div className="space-y-2">
            <Label htmlFor="case-tags" className="text-helper">Tags</Label>
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

          {/* ── Parties ── */}
          <div className="rounded-lg border border-border">
            <div className="flex items-center justify-between px-4 py-3">
              <p className="flex items-center gap-2 text-helper font-medium">
                <Users size={16} strokeWidth={1.75} className="text-muted-foreground" />
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
                  <div key={idx} className="rounded-md border border-border bg-muted/30 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-helper font-medium">Party #{idx + 1}</p>
                      <button
                        type="button"
                        onClick={() => removeParty(idx)}
                        className="grid size-8 place-items-center rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Remove party"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor={`party-type-${idx}`} className="text-helper">Type</Label>
                        <select
                          id={`party-type-${idx}`}
                          value={p.type}
                          onChange={(e) => {
                            const newType = e.target.value as PartyEntry["type"];
                            updateParty(idx, "type", newType);
                            if (newType !== "client") {
                              updateParty(idx, "clientId", undefined);
                            }
                          }}
                          className="h-10 w-full rounded-md border border-border bg-card px-3 text-helper outline-none transition-colors focus:border-primary"
                        >
                          <option value="client">Client</option>
                          <option value="sub_client">Sub-client</option>
                          <option value="opposing_party">Opposing Party</option>
                          <option value="counsel">Counsel</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`party-role-${idx}`} className="text-helper">Role</Label>
                        <Input
                          id={`party-role-${idx}`}
                          value={p.role}
                          onChange={(e) => updateParty(idx, "role", e.target.value)}
                          placeholder="Primary Client, Petitioner, Respondent..."
                          className="h-10 rounded-md"
                        />
                      </div>

                      {p.type === "client" && (
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label className="text-helper text-muted-foreground">Link Client Profile</Label>
                          <select
                            value={p.clientId || ""}
                            onChange={(e) => {
                              const selectedId = e.target.value;
                              const selectedClient = clientsData?.clients.find((c) => c._id === selectedId);
                              setParties((prev) =>
                                prev.map((item, i) =>
                                  i === idx
                                    ? {
                                        ...item,
                                        clientId: selectedId || undefined,
                                        name: selectedClient ? selectedClient.name : item.name,
                                      }
                                    : item
                                )
                              );
                            }}
                            className="h-10 w-full rounded-md border border-border bg-card px-3 text-helper outline-none transition-colors focus:border-primary"
                          >
                            <option value="">— Select an existing client or enter name below —</option>
                            {clientsData?.clients.map((c) => (
                              <option key={c._id} value={c._id}>
                                {c.name} {c.phone ? `(${c.phone})` : ""} {c.kyc === "Verified" ? "✓" : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor={`party-name-${idx}`} className="text-helper">Name *</Label>
                        <Input
                          id={`party-name-${idx}`}
                          value={p.name}
                          onChange={(e) => updateParty(idx, "name", e.target.value)}
                          placeholder="Party name"
                          className="h-10 rounded-md"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {parties.length === 0 && (
              <div className="border-t border-border px-4 py-6 text-center text-helper text-muted-foreground">
                No parties added yet. Click "Add party" to link clients, sub-clients, counsel or opposing parties.
              </div>
            )}
          </div>

          {/* ── Tasks ── */}
          <div className="rounded-lg border border-border">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <CheckSquare size={16} strokeWidth={1.75} className="text-muted-foreground" />
                <p className="text-helper font-medium">Tasks for this case (optional)</p>
                {tasks.length > 0 && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary font-semibold">
                    {tasks.length}
                  </span>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-md"
                onClick={addTask}
              >
                <Plus size={14} /> Add task
              </Button>
            </div>
            {tasks.length > 0 && (
              <div className="border-t border-border p-4 space-y-3">
                {tasks.map((t, idx) => (
                  <div key={idx} className="rounded-md border border-border bg-muted/30 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-helper font-medium flex items-center gap-1.5">
                        <span className="grid size-5 place-items-center rounded-full bg-primary/10 text-primary text-[11px] font-semibold">
                          {idx + 1}
                        </span>
                        Task #{idx + 1}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeTask(idx)}
                        className="grid size-8 place-items-center rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Remove task"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`task-title-${idx}`} className="text-helper">Task title *</Label>
                      <Input
                        id={`task-title-${idx}`}
                        value={t.title}
                        onChange={(e) => updateTask(idx, "title", e.target.value)}
                        placeholder="e.g. Draft petition, Collect documents, File Vakalatnama"
                        className="h-10 rounded-md"
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor={`task-cat-${idx}`} className="text-helper">Category</Label>
                        <select
                          id={`task-cat-${idx}`}
                          value={t.category}
                          onChange={(e) => updateTask(idx, "category", e.target.value)}
                          className="h-10 w-full rounded-md border border-border bg-card px-3 text-helper outline-none transition-colors focus:border-primary"
                        >
                          {taskCategories.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-helper">Priority</Label>
                        <div className="flex rounded-md border border-border">
                          {(["High", "Medium", "Low"] as const).map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => updateTask(idx, "priority", p)}
                              className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors ${
                                p === "High" ? "rounded-l-md border-r" : p === "Low" ? "rounded-r-md border-l" : "border-r"
                              } border-border ${
                                t.priority === p
                                  ? p === "High"
                                    ? "bg-destructive/10 text-destructive font-semibold"
                                    : p === "Medium"
                                      ? "bg-warning/10 text-warning font-semibold"
                                      : "bg-muted text-muted-foreground font-semibold"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor={`task-deadline-${idx}`} className="text-helper">Deadline (optional)</Label>
                        <Input
                          id={`task-deadline-${idx}`}
                          type="datetime-local"
                          value={t.deadline}
                          onChange={(e) => updateTask(idx, "deadline", e.target.value)}
                          className="h-10 rounded-md"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor={`task-assign-${idx}`} className="text-helper">Assign to (optional)</Label>
                        <select
                          id={`task-assign-${idx}`}
                          value={t.assignedTo}
                          onChange={(e) => updateTask(idx, "assignedTo", e.target.value)}
                          className="h-10 w-full rounded-md border border-border bg-card px-3 text-helper outline-none transition-colors focus:border-primary"
                        >
                          <option value="">Self (Default)</option>
                          {staffList.map((s) => (
                            <option key={s._id} value={s._id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Subtasks / Checklist */}
                    <div className="space-y-2 pt-2 border-t border-border/50">
                      <Label className="text-xs text-muted-foreground">Checklist / Subtasks (optional)</Label>
                      <div className="flex gap-2">
                        <Input
                          value={subtaskInput[idx] || ""}
                          onChange={(e) => setSubtaskInput((prev) => ({ ...prev, [idx]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addSubtaskToTask(idx);
                            }
                          }}
                          placeholder="Add subtask and press Enter"
                          className="h-9 text-xs rounded-md"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 px-2.5 text-xs rounded-md"
                          onClick={() => addSubtaskToTask(idx)}
                        >
                          <Plus size={13} className="mr-1" /> Add
                        </Button>
                      </div>

                      {t.checklist.length > 0 && (
                        <div className="space-y-1 mt-1.5">
                          {t.checklist.map((item, cIdx) => (
                            <div
                              key={cIdx}
                              className="flex items-center justify-between rounded bg-background px-2.5 py-1 text-xs border border-border/50"
                            >
                              <span className="text-muted-foreground truncate">{item}</span>
                              <button
                                type="button"
                                onClick={() => removeSubtaskFromTask(idx, cIdx)}
                                className="text-muted-foreground hover:text-destructive p-0.5 ml-2"
                                aria-label="Remove subtask"
                              >
                                <X size={12} />
                              </button>
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

          {/* ── Actions ── */}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !form.title.trim()}
              className="gradient-primary rounded-md text-primary-foreground shadow-soft"
            >
              {isPending ? <Loader2 size={17} className="animate-spin" /> : <Briefcase size={17} strokeWidth={2} />}
              {isPending ? "Saving…" : "Save case"}
            </Button>
          </DialogFooter>

          {isError && (
            <p className="text-caption text-destructive">
              {(createCase.error as any)?.body?.message || (createCase.error as any)?.message || "Failed to create case. Please try again."}
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}