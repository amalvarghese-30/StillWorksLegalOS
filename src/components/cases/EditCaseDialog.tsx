import { useState, useEffect, useMemo } from "react";
import {
  Briefcase,
  Loader2,
  Sliders,
  Tag,
  Building,
  FolderOpen,
  CalendarDays,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUpdateCase, type CaseRecord, type CreateCasePayload } from "@/services/cases";
import { useEmployees } from "@/services/admin";
import { useCategories, extractCategoryName } from "@/services/categories";
import { useAuth } from "@/lib/auth";
import { DiscardConfirmationDialog } from "@/components/ui/discard-confirmation-dialog";
import { AssigneeMultiSelect } from "@/components/common/AssigneeMultiSelect";
import { parseFlexibleDate, toSafeIso } from "@/lib/dates";

function toDateInputValue(val: unknown): string {
  if (!val) return "";
  const d = parseFlexibleDate(val);
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface EditCaseDialogProps {
  open: boolean;
  onClose: () => void;
  record: CaseRecord;
  caseId: string;
}

export function EditCaseDialog({ open, onClose, record, caseId }: EditCaseDialogProps) {
  const [title, setTitle] = useState(record.title || "");
  const [description, setDescription] = useState(record.description || "");
  const [category, setCategory] = useState(record.category || record.practice || "Other Work");
  const [localPath, setLocalPath] = useState(record.localPath || "");
  const [status, setStatus] = useState<"Active" | "Urgent" | "On Hold" | "Closed">(
    (record.status as "Active" | "Urgent" | "On Hold" | "Closed") || "Active",
  );
  const [priority, setPriority] = useState<"High" | "Medium" | "Low">(record.priority || "Medium");
  const [progress, setProgress] = useState<number>(record.progress ?? 0);
  const initialAssigned = useMemo(() => {
    if (record.assignedUsers && record.assignedUsers.length > 0) {
      return record.assignedUsers.map((u) => u._id);
    }
    return record.assignedTo?._id ? [record.assignedTo._id] : [];
  }, [record.assignedUsers, record.assignedTo]);
  const [assignedTo, setAssignedTo] = useState<string[]>(initialAssigned);
  const [tags, setTags] = useState<string>((record.tags || []).join(", "));
  const [nextHearing, setNextHearing] = useState<string>(() => toDateInputValue(record.nextHearing));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data: empData } = useEmployees(undefined, { enabled: isAdmin });
  const { data: rawCategories = [] } = useCategories();
  const categories = useMemo(() => {
    const rawObj =
      rawCategories && typeof rawCategories === "object"
        ? (rawCategories as Record<string, unknown>)
        : null;
    const list = Array.isArray(rawCategories)
      ? rawCategories
      : Array.isArray(rawObj?.categories)
        ? (rawObj?.categories as unknown[])
        : [];
    return list.map(extractCategoryName).filter(Boolean);
  }, [rawCategories]);
  const employees = empData?.employees ?? [];

  const updateCase = useUpdateCase();

  useEffect(() => {
    if (open) {
      setTitle(record.title || "");
      setDescription(record.description || "");
      setCategory(record.category || record.practice || "Other Work");
      setLocalPath(record.localPath || "");
      setStatus((record.status as "Active" | "Urgent" | "On Hold" | "Closed") || "Active");
      setPriority(record.priority || "Medium");
      setProgress(record.progress ?? 0);
      const freshAssigned =
        record.assignedUsers && record.assignedUsers.length > 0
          ? record.assignedUsers.map((u) => u._id)
          : record.assignedTo?._id
            ? [record.assignedTo._id]
            : [];
      setAssignedTo(freshAssigned);
      setTags((record.tags || []).join(", "));
      setNextHearing(toDateInputValue(record.nextHearing));
      setErrorMsg(null);
      setShowDiscardConfirm(false);
    }
  }, [open, record]);

  const isDirty = useMemo(() => {
    const origTags = (record.tags || []).join(", ");
    const origHearing = toDateInputValue(record.nextHearing);
    const assignedChanged =
      assignedTo.length !== initialAssigned.length ||
      assignedTo.some((id) => !initialAssigned.includes(id));
    return (
      title !== (record.title || "") ||
      description !== (record.description || "") ||
      category !== (record.category || record.practice || "Other Work") ||
      localPath !== (record.localPath || "") ||
      status !== (record.status || "Active") ||
      priority !== (record.priority || "Medium") ||
      nextHearing !== origHearing ||
      progress !== (record.progress ?? 0) ||
      assignedChanged ||
      tags !== origTags
    );
  }, [
    title,
    description,
    category,
    localPath,
    status,
    priority,
    nextHearing,
    progress,
    assignedTo,
    initialAssigned,
    tags,
    record,
  ]);

  const handleAttemptClose = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      handleForceClose();
    }
  };

  const handleForceClose = () => {
    setShowDiscardConfirm(false);
    onClose();
  };

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!title.trim()) {
      setErrorMsg("Case title is required.");
      return;
    }

    try {
      const tagList = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const payload: Partial<CreateCasePayload> = {
        title: title.trim(),
        description: description.trim(),
        category,
        localPath: localPath.trim(),
        status,
        priority,
        nextHearing: nextHearing ? (toSafeIso(nextHearing) ?? null) : null,
        progress: Number(progress),
        tags: tagList,
      };
      if (assignedTo && assignedTo.length > 0) {
        payload.assignedTo = assignedTo;
        payload.assignedUsers = assignedTo;
      } else {
        payload.assignedTo = null;
        payload.assignedUsers = [];
      }

      await updateCase.mutateAsync({
        id: caseId,
        data: payload,
      });

      handleForceClose();
    } catch (err: unknown) {
      console.error("Failed to update case:", err);
      const message =
        err instanceof Error ? err.message : "Failed to update case. Please check all fields.";
      setErrorMsg(message);
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
                  Edit Case Details
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Matter {record.number} — update case information, status, priority, and counsel.
                </DialogDescription>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="m-6 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-helper text-destructive">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="divide-y divide-border">
            {/* ── SECTION 1: CASE OVERVIEW ── */}
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                  Case Overview
                </span>
                <div className="flex-1 h-px bg-border/60" />
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <Label htmlFor="case-title" className="text-xs font-semibold text-foreground">
                  Case Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="case-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Apex Enterprises vs City Corp"
                  className="h-11 rounded-md"
                  required
                />
              </div>

              {/* Status & Priority Segmented Controls */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Case Status</Label>
                  <div className="flex rounded-lg border border-border overflow-hidden bg-muted/30">
                    {(["Active", "Urgent", "On Hold", "Closed"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStatus(s)}
                        className={`flex-1 px-2 py-2 text-[11px] font-semibold transition-all border-r border-border last:border-r-0 ${
                          status === s
                            ? s === "Urgent"
                              ? "bg-destructive/15 text-destructive font-bold"
                              : s === "On Hold"
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold"
                                : s === "Closed"
                                  ? "bg-muted text-muted-foreground font-bold"
                                  : "bg-primary/15 text-primary font-bold"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Priority</Label>
                  <div className="flex rounded-lg border border-border overflow-hidden bg-muted/30">
                    {(["High", "Medium", "Low"] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        className={`flex-1 px-2.5 py-2 text-[11px] font-semibold transition-all border-r border-border last:border-r-0 ${
                          priority === p
                            ? p === "High"
                              ? "bg-destructive/15 text-destructive font-bold"
                              : p === "Medium"
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold"
                                : "bg-muted text-foreground font-bold"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Next Hearing Date */}
              <div className="space-y-1.5 pt-1">
                <Label
                  htmlFor="case-next-hearing"
                  className="text-xs font-semibold text-foreground flex items-center gap-1.5"
                >
                  <CalendarDays size={14} className="text-primary" />
                  Next Hearing Date
                </Label>
                <Input
                  id="case-next-hearing"
                  type="date"
                  value={nextHearing}
                  onChange={(e) => setNextHearing(e.target.value)}
                  className="h-10 rounded-md"
                />
                <p className="text-[11px] text-muted-foreground">
                  Whenever this date is updated, it automatically synchronizes with the firm
                  calendar.
                </p>
              </div>
            </div>

            {/* ── SECTION 2: DETAILS & DOCUMENTS ── */}
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                  Details &amp; Documents
                </span>
                <div className="flex-1 h-px bg-border/60" />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor="case-category" className="text-xs font-semibold text-foreground">
                  Category
                </Label>
                {categories.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map((c) => {
                      const isSelected = category === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCategory(c)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all ${
                            isSelected
                              ? "border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/40 font-bold"
                              : "border-border/80 bg-background text-foreground/80 hover:border-primary/50 hover:bg-muted/50"
                          }`}
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <select
                    id="case-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="h-11 w-full rounded-md border border-border bg-background px-3 text-helper text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="case-desc" className="text-xs font-semibold text-foreground">
                  Description / Summary
                </Label>
                <textarea
                  id="case-desc"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief summary of matter, facts, or disputes…"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              {/* Local Folder / Document Path */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="case-localpath"
                  className="text-xs font-semibold text-foreground flex items-center gap-1.5"
                >
                  <FolderOpen size={14} className="text-muted-foreground" />
                  Local Folder / Document Path (Optional)
                </Label>
                <Input
                  id="case-localpath"
                  value={localPath}
                  onChange={(e) => setLocalPath(e.target.value)}
                  placeholder="e.g. C:\LegalFiles\Cases\Apex-2026 or /Users/shared/case-files"
                  className="h-11 rounded-md"
                />
                <p className="text-xs text-muted-foreground">
                  In desktop mode, clicking this path will directly open the folder in File Explorer
                  / Finder.
                </p>
              </div>
            </div>

            {/* ── SECTION 3: ASSIGNMENT & PROGRESS ── */}
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                  Assignment &amp; Progress
                </span>
                <div className="flex-1 h-px bg-border/60" />
              </div>

              {/* Counsel Assignment */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Briefcase size={14} className="text-muted-foreground" />
                  Assigned Counsel / Team
                </Label>
                <AssigneeMultiSelect
                  value={assignedTo}
                  onChange={setAssignedTo}
                  placeholder="Tick counsel to assign..."
                />
              </div>

              {/* Progress Slider */}
              <div className="space-y-1.5 rounded-lg border border-border bg-muted/20 p-3.5">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="case-progress"
                    className="text-xs font-semibold text-foreground flex items-center gap-1.5"
                  >
                    <Sliders size={14} className="text-primary" />
                    Matter Progress
                  </Label>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary border border-primary/20">
                    {progress}%
                  </span>
                </div>
                <input
                  id="case-progress"
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  className="w-full accent-primary cursor-pointer mt-2"
                />
              </div>

              {/* Tags */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="case-tags"
                  className="text-xs font-semibold text-foreground flex items-center gap-1.5"
                >
                  <Tag size={14} className="text-muted-foreground" />
                  Tags (comma-separated)
                </Label>
                <Input
                  id="case-tags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="Civil, Urgent, Injunction"
                  className="h-11 rounded-md"
                />
              </div>
            </div>

            {/* ── ACTIONS FOOTER ── */}
            <div className="px-6 py-4 bg-muted/20 border-t border-border">
              <DialogFooter className="flex gap-2">
                <Button type="button" variant="outline" onClick={handleAttemptClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateCase.isPending || !title.trim()}
                  className="gradient-primary text-primary-foreground px-6"
                >
                  {updateCase.isPending ? (
                    <>
                      <Loader2 size={16} className="animate-spin mr-1.5" />
                      Saving…
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </DialogFooter>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <DiscardConfirmationDialog
        open={showDiscardConfirm}
        onOpenChange={setShowDiscardConfirm}
        onConfirmDiscard={handleForceClose}
        title="Discard changes to case?"
        description="You have unsaved changes in this case. If you close now, your edits will not be saved."
      />
    </>
  );
}
