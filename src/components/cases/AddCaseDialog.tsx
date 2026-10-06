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
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateCase, type CaseRecord } from "@/services/cases";
import { useClients } from "@/services/clients";
import { useTaskOptions } from "@/services/tasks";
import { useCategories } from "@/services/categories";
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
  category: string;
  localPath: string;
  status: "Active" | "On Hold" | "Closed" | "Urgent";
  priority: "High" | "Medium" | "Low";
  tags: string;
}

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  category: "Other Work",
  localPath: "",
  status: "Active",
  priority: "Medium",
  tags: "",
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

  const addSubtaskToTask = (taskIdx: number) => {
    const input = (subtaskInput[taskIdx] || "").trim();
    if (!input) return;
    setTasks((prev) =>
      prev.map((t, i) =>
        i === taskIdx ? { ...t, checklist: [...t.checklist, input] } : t,
      ),
    );
    setSubtaskInput((prev) => ({ ...prev, [taskIdx]: "" }));
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
          assignedTo: t.assignedTo || undefined,
          checklist: t.checklist.map((item) => ({ text: item, done: false })),
        }));

      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        category: form.category || "Other Work",
        localPath: form.localPath.trim() || undefined,
        status: form.status,
        priority: form.priority,
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
          className="max-h-[90vh] overflow-y-auto sm:max-w-2xl rounded-xl border border-border bg-card p-6 shadow-lift"
        >
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Briefcase size={20} strokeWidth={1.75} />
                </span>
                <div>
                  <DialogTitle className="text-title font-semibold text-foreground">
                    Create new case
                  </DialogTitle>
                  <DialogDescription className="text-helper text-muted-foreground">
                    Add a new case, define initial details, and assign tasks.
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

          <form onSubmit={handleSubmit} className="space-y-5 pt-2">
            {/* ── Title ── */}
            <div className="space-y-1.5">
              <Label htmlFor="case-title" className="text-helper">
                Case title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="case-title"
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="e.g. Apex Enterprises vs City Corp"
                required
                className="h-11 rounded-md"
              />
            </div>

            {/* ── Description ── */}
            <div className="space-y-1.5">
              <Label htmlFor="case-desc" className="text-helper">Description</Label>
              <textarea
                id="case-desc"
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="Brief summary of the matter, facts, or dispute…"
                rows={3}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-helper outline-none transition-colors focus:border-primary resize-none"
              />
            </div>

            {/* ── Category ── */}
            <div className="space-y-1.5">
              <Label htmlFor="case-category" className="text-helper">Category</Label>
              <select
                id="case-category"
                value={form.category}
                onChange={(e) => update("category", e.target.value)}
                className="h-11 w-full rounded-md border border-border bg-card px-3 text-helper outline-none transition-colors focus:border-primary"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
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

            {/* ── Tasks Section ── */}
            <div className="rounded-lg border border-border">
              <div className="flex items-center justify-between px-4 py-3">
                <p className="flex items-center gap-2 text-helper font-medium">
                  <CheckSquare size={16} strokeWidth={1.75} className="text-muted-foreground" />
                  Initial Tasks for this Case
                </p>
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
                <div className="border-t border-border p-4 space-y-4">
                  {tasks.map((t, idx) => (
                    <div key={idx} className="flex flex-col gap-3 rounded-md border border-border bg-card p-3">
                      <div className="flex items-center justify-between gap-2">
                        <Input
                          placeholder="Task title *"
                          value={t.title}
                          onChange={(e) => updateTask(idx, "title", e.target.value)}
                          className="h-10 flex-1 font-medium rounded-md"
                          required
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-10 px-2 text-muted-foreground hover:text-destructive"
                          onClick={() => removeTask(idx)}
                        >
                          <Trash2 size={15} />
                        </Button>
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
              <Button type="button" variant="outline" onClick={handleAttemptClose}>
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