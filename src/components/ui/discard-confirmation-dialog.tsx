import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DiscardConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmDiscard?: () => void;
  onDiscard?: () => void;
  onKeepEditing?: () => void;
  title?: string;
  description?: string;
}

export const DiscardConfirmationDialog: React.FC<DiscardConfirmationDialogProps> = ({
  open,
  onOpenChange,
  onConfirmDiscard,
  onDiscard,
  onKeepEditing,
  title = "Discard unsaved changes?",
  description = "You have unsaved changes in this form. If you close now, your progress will be lost.",
}) => {
  const handleDiscard = () => {
    onOpenChange(false);
    if (typeof onConfirmDiscard === "function") {
      onConfirmDiscard();
    }
    if (typeof onDiscard === "function") {
      onDiscard();
    }
  };

  const handleKeepEditing = () => {
    onOpenChange(false);
    if (typeof onKeepEditing === "function") {
      onKeepEditing();
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="z-[70] max-w-md" overlayClassName="z-[65]">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base font-semibold text-foreground">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4 gap-2 sm:gap-0">
          <AlertDialogCancel onClick={handleKeepEditing}>
            Keep Editing
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDiscard}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Discard Changes
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
