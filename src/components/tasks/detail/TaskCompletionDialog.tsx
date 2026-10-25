import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2,
  AlertTriangle,
  Upload,
  FileText,
  X,
  Loader2,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { uploadDocumentStream } from "@/services/documents";
import type { TaskRecord } from "@/services/tasks";
import { useQueryClient } from "@tanstack/react-query";
import { taskKeys } from "@/services/tasks";

interface TaskCompletionDialogProps {
  open: boolean;
  onClose: () => void;
  task: TaskRecord;
  isAdmin: boolean;
  onConfirmComplete: (completionNote: string, documentIds: string[]) => Promise<void>;
  isSubmitting?: boolean;
}

export function TaskCompletionDialog({
  open,
  onClose,
  task,
  isAdmin,
  onConfirmComplete,
  isSubmitting = false,
}: TaskCompletionDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [note, setNote] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const checklist = task.checklist || [];
  const totalSteps = checklist.length;
  const completedSteps = checklist.filter((c) => c.done).length;
  const hasIncompleteSteps = totalSteps > 0 && completedSteps < totalSteps;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const arr = Array.from(files);
    setSelectedFiles((prev) => [...prev, ...arr]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);
    const uploadedDocIds: string[] = [];

    try {
      const caseId =
        task.caseId && typeof task.caseId === "object"
          ? (task.caseId as any)._id
          : task.caseId || undefined;
      const clientId =
        task.clientId && typeof task.clientId === "object"
          ? (task.clientId as any)._id
          : task.clientId || undefined;

      // Upload any attached supporting documents
      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append("name", file.name);
        formData.append("taskId", task._id);
        if (caseId) formData.append("caseId", caseId);
        if (clientId) formData.append("clientId", clientId);
        formData.append("file", file);

        try {
          const res = await uploadDocumentStream(formData);
          if (res?.document?._id) {
            uploadedDocIds.push(res.document._id);
          }
        } catch (uploadErr) {
          console.error(`Failed to upload ${file.name}:`, uploadErr);
          toast.error(`Failed to attach ${file.name}`);
        }
      }

      await onConfirmComplete(note.trim(), uploadedDocIds);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(task._id) });
      onClose();
    } catch (err: any) {
      console.error("Completion submission error:", err);
      toast.error(err?.message || "Failed to submit task completion");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && !isSubmitting && !isUploading && onClose()}>
      <DialogContent className="max-w-lg rounded-xl border border-border bg-card p-5 shadow-lift">
        <DialogHeader className="space-y-1.5 pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <CheckCircle2 size={18} />
            </span>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground">
                {isAdmin ? "Complete Task" : "Submit Task for Approval"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {task.title}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Checklist progress status */}
          {totalSteps > 0 && (
            <div
              className={`rounded-lg border p-3 text-xs flex items-start gap-2.5 ${
                hasIncompleteSteps
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
              }`}
            >
              {hasIncompleteSteps ? (
                <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              ) : (
                <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              )}
              <div>
                <p className="font-semibold">
                  Checklist Progress: {completedSteps} / {totalSteps} items completed
                </p>
                {hasIncompleteSteps && (
                  <p className="text-[11px] mt-0.5 opacity-90">
                    Some checklist steps remain unchecked. You can still submit this task for approval if the necessary work has been performed.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Optional Supporting Documents */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground">
                Supporting Documents (Optional)
              </Label>
              <span className="text-[11px] text-muted-foreground">
                Receipts, filings, acknowledgements, signed forms
              </span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-dashed border-border hover:border-primary/50 bg-muted/20 hover:bg-muted/40 p-4 text-center cursor-pointer transition-colors"
            >
              <Upload size={18} className="mx-auto text-muted-foreground mb-1" />
              <p className="text-xs font-medium text-foreground">
                Click to attach evidence or supporting files
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                PDF, JPG, PNG, DOCX up to 50MB
              </p>
            </div>

            {selectedFiles.length > 0 && (
              <div className="space-y-1.5 max-h-32 overflow-y-auto pt-1">
                {selectedFiles.map((f, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText size={14} className="text-primary shrink-0" />
                      <span className="truncate font-medium">{f.name}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        ({Math.round(f.size / 1024)} KB)
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="size-6 p-0 text-muted-foreground hover:text-destructive rounded"
                      onClick={() => removeFile(idx)}
                    >
                      <X size={12} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Completion Notes / Remarks */}
          <div className="space-y-1.5">
            <Label htmlFor="completion-note" className="text-xs font-semibold text-foreground">
              Completion Notes / Comments (Optional)
            </Label>
            <Textarea
              id="completion-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Application submitted to CIDCO office. Acknowledgement attached. Next follow-up in 7 days."
              rows={3}
              className="text-xs rounded-lg resize-none"
            />
          </div>

          <DialogFooter className="pt-2 border-t border-border flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSubmitting || isUploading}
              onClick={onClose}
              className="rounded-lg text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || isUploading}
              className="gradient-primary rounded-lg text-xs text-primary-foreground font-semibold shadow-soft"
            >
              {isSubmitting || isUploading ? (
                <Loader2 size={13} className="animate-spin mr-1.5" />
              ) : isAdmin ? (
                <CheckCircle2 size={13} className="mr-1.5" />
              ) : (
                <Clock size={13} className="mr-1.5" />
              )}
              {isSubmitting || isUploading
                ? "Submitting…"
                : isAdmin
                ? "Mark as Completed"
                : "Submit for Approval"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}