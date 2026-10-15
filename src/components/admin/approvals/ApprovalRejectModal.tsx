import React, { useState, useEffect } from "react";
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
import { AlertTriangle, Loader2 } from "lucide-react";
import type { ApprovalItem } from "@/services/admin";

interface ApprovalRejectModalProps {
  item: ApprovalItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (item: ApprovalItem, reason: string) => Promise<void>;
  isSubmitting?: boolean;
}

export function ApprovalRejectModal({
  item,
  isOpen,
  onClose,
  onConfirm,
  isSubmitting = false,
}: ApprovalRejectModalProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setReason("");
      setError(null);
    }
  }, [isOpen, item]);

  if (!item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanReason = reason.trim();
    if (!cleanReason) {
      setError("Please provide a reason or instructions explaining why changes are requested.");
      return;
    }
    if (cleanReason.length > 1000) {
      setError("Rejection reason cannot exceed 1000 characters.");
      return;
    }

    try {
      await onConfirm(item, cleanReason);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to process rejection. Please try again.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <span className="grid size-8 place-items-center rounded-lg bg-rose-500/10">
                <AlertTriangle size={18} />
              </span>
              <DialogTitle className="text-lg font-semibold text-foreground">
                Request Changes / Reject
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Provide feedback or specific instructions so the requester can make necessary corrections.
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 space-y-3">
            <div className="rounded-lg border border-border/80 bg-muted/40 p-3 text-xs space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Request:</span>
                <span className="font-medium text-foreground">{item.kind}</span>
              </div>
              <p className="font-semibold text-foreground truncate">{item.title}</p>
              <div className="flex items-center justify-between text-muted-foreground pt-1 border-t border-border/50">
                <span>Submitted by:</span>
                <span className="text-foreground">{item.submittedBy?.name || "Employee"}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reject-reason" className="text-xs font-semibold text-foreground">
                Reason for Rejection / Instructions <span className="text-rose-500">*</span>
              </Label>
              <textarea
                id="reject-reason"
                rows={4}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (error) setError(null);
                }}
                disabled={isSubmitting}
                placeholder="e.g. Please verify the client affidavit signature and attach the stamped counter-deed before re-submitting."
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 disabled:opacity-50 resize-none"
              />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Required for transparency & audit compliance</span>
                <span>{reason.length}/1000</span>
              </div>
            </div>

            {error && (
              <p className="text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
                {error}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={onClose}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs shadow-soft"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="mr-1.5 animate-spin" />
                  Submitting…
                </>
              ) : (
                "Confirm Rejection"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
