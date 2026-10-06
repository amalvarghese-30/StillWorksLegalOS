import { useState, useEffect, useMemo } from "react";
import {
  Briefcase,
  Loader2,
  Sliders,
  Tag,
  Building,
  FolderOpen,
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
import { useCategories } from "@/services/categories";
import { useAuth } from "@/lib/auth";
import { DiscardConfirmationDialog } from "@/components/ui/discard-confirmation-dialog";

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
    (record.status as any) || "Active"
  );
  const [priority, setPriority] = useState<"High" | "Medium" | "Low">(
    record.priority || "Medium"
  );
  const [progress, setProgress] = useState<number>(record.progress ?? 0);
  const [assignedTo, setAssignedTo] = useState<string>(
    record.assignedTo?._id || ""
  );
  const [tags, setTags] = useState<string>((record.tags || []).join(", "));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data: empData } = useEmployees(undefined, { enabled: isAdmin });
  const { data: categories = [] } = useCategories();
  const employees = empData?.employees ?? [];

  const updateCase = useUpdateCase();

  useEffect(() => {
    if (open) {
      setTitle(record.title || "");
      setDescription(record.description || "");
      setCategory(record.category || record.practice || "Other Work");
      setLocalPath(record.localPath || "");
      setStatus((record.status as any) || "Active");
      setPriority(record.priority || "Medium");
      setProgress(record.progress ?? 0);
      setAssignedTo(record.assignedTo?._id || "");
      setTags((record.tags || []).join(", "));
      setErrorMsg(null);
      setShowDiscardConfirm(false);
    }
  }, [open, record]);

  const isDirty = useMemo(() => {
    const origTags = (record.tags || []).join(", ");
    return (
      title !== (record.title || "") ||
      description !== (record.description || "") ||
      category !== (record.category || record.practice || "Other Work") ||
      localPath !== (record.localPath || "") ||
      status !== (record.status || "Active") ||
      priority !== (record.priority || "Medium") ||
      progress !== (record.progress ?? 0) ||
      assignedTo !== (record.assignedTo?._id || "") ||
      tags !== origTags
    );
  }, [title, description, category, localPath, status, priority, progress, assignedTo, tags, record]);

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
        progress: Number(progress),
        tags: tagList,
      };
      if (assignedTo) payload.assignedTo = assignedTo;

      await updateCase.mutateAsync({
        id: caseId,
        data: payload,
      });

      handleForceClose();
    } catch (err: any) {
      console.error("Failed to update case:", err);
      setErrorMsg(err?.message || "Failed to update case. Please check all fields.");
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
          <DialogHeader className="border-b border-border/60 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                  <Briefcase size={18} strokeWidth={1.75} />
                </span>
                <div>
                  <DialogTitle className="text-title font-semibold text-foreground">
                    Edit Case Details
                  </DialogTitle>
                  <DialogDescription className="text-helper text-muted-foreground">
                    Matter {record.number} — update case information, status, priority, and counsel.
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

          {errorMsg && (
            <div className="mt-4 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-helper text-destructive">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="case-title" className="text-helper font-medium">
                Case Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="case-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Apex Enterprises vs City Corp"
                className="h-10 rounded-md"
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="case-desc" className="text-helper font-medium">
                Description / Summary
              </Label>
              <textarea
                id="case-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary of matter, facts, or disputes…"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-helper text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label htmlFor="case-category" className="text-helper font-medium">
                Category
              </Label>
              <select
                id="case-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-helper text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Local Folder / Document Path */}
            <div className="space-y-1.5">
              <Label htmlFor="case-localpath" className="text-helper font-medium flex items-center gap-1.5">
                <FolderOpen size={14} className="text-muted-foreground" />
                Local Folder / Document Path (Optional)
              </Label>
              <Input
                id="case-localpath"
                value={localPath}
                onChange={(e) => setLocalPath(e.target.value)}
                placeholder="e.g. C:\LegalFiles\Cases\Apex-2026 or /Users/shared/case-files"
                className="h-10 rounded-md"
              />
              <p className="text-xs text-muted-foreground">
                In desktop mode, clicking this path will directly open the folder in File Explorer / Finder.
              </p>
            </div>

            {/* Counsel Assignment */}
            <div className="space-y-1.5">
              <Label htmlFor="case-assignee" className="text-helper font-medium flex items-center gap-1.5">
                <Briefcase size={14} className="text-muted-foreground" />
                Assigned Counsel
              </Label>
              <select
                id="case-assignee"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-helper text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Unassigned</option>
                {employees.map((emp) => (
                  <option key={emp._id} value={emp._id}>
                    {emp.name} ({emp.title || emp.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Status & Priority */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="case-status" className="text-helper font-medium">
                  Case Status
                </Label>
                <select
                  id="case-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-helper text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Active">Active</option>
                  <option value="Urgent">Urgent</option>
                  <option value="On Hold">On Hold</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="case-priority" className="text-helper font-medium">
                  Priority
                </Label>
                <select
                  id="case-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-helper text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            {/* Progress Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="case-progress" className="text-helper font-medium flex items-center gap-1.5">
                  <Sliders size={14} className="text-muted-foreground" />
                  Matter Progress
                </Label>
                <span className="text-caption font-semibold text-primary">{progress}%</span>
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
              <Label htmlFor="case-tags" className="text-helper font-medium flex items-center gap-1.5">
                <Tag size={14} className="text-muted-foreground" />
                Tags (comma-separated)
              </Label>
              <Input
                id="case-tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Civil, Urgent, Injunction"
                className="h-10 rounded-md"
              />
            </div>

            <DialogFooter className="mt-6 border-t border-border/60 pt-4 flex gap-2">
              <Button type="button" variant="outline" onClick={handleAttemptClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateCase.isPending || !title.trim()}
                className="gradient-primary text-primary-foreground"
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
