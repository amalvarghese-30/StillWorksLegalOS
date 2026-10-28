import { useEffect, useState, useCallback, useRef } from "react";
import {
  X,
  Download,
  Loader2,
  AlertTriangle,
  FileQuestion,
  ExternalLink,
  RotateCw,
  FileText,
  FileImage,
  Trash2,
} from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadBlob } from "@/services/api";
import { downloadDocument, useDeleteDocument, docKeys } from "@/services/documents";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface DocumentPreviewModalProps {
  open: boolean;
  onClose: () => void;
  documentId: string | null;
  documentName?: string | undefined;
  documentMimeType?: string | undefined;
  documentSize?: number | string | undefined;
  canDelete?: boolean;
  onDeleteSuccess?: () => void;
  onDeleted?: (deletedDocId: string) => void;
}

type PreviewType = "pdf" | "image" | "text" | "unsupported";

export function DocumentPreviewModal({
  open,
  onClose,
  documentId,
  documentName,
  documentMimeType,
  documentSize,
  canDelete = true,
  onDeleteSuccess,
  onDeleted,
}: DocumentPreviewModalProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<PreviewType>("unsupported");
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [resolvedFileName, setResolvedFileName] = useState<string>(documentName || "Document");
  const [resolvedMime, setResolvedMime] = useState<string>(documentMimeType || "");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const previewRequestRef = useRef(0);

  const qc = useQueryClient();
  const deleteMutation = useDeleteDocument();

  const cleanupUrl = useCallback((url: string | null) => {
    if (url && url.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
    }
  }, []);

  // Blob URLs must be revoked when replaced or when the modal unmounts.
  useEffect(() => {
    const currentUrl = objectUrl;
    return () => cleanupUrl(currentUrl);
  }, [objectUrl, cleanupUrl]);

  const loadPreview = useCallback(async () => {
    if (!documentId) return;

    const requestId = ++previewRequestRef.current;
    setStatus("loading");
    setErrorMessage(null);
    setTextContent(null);
    setObjectUrl(null);

    try {
      const { blob, fileName } = await downloadBlob(`/documents/${documentId}/view`);
      if (requestId !== previewRequestRef.current) return;
      setResolvedFileName(fileName || documentName || "Document");

      const mime = (blob.type || documentMimeType || "").toLowerCase();
      setResolvedMime(mime);

      const nameLower = (fileName || documentName || "").toLowerCase();
      const extension = nameLower.includes(".") ? nameLower.slice(nameLower.lastIndexOf(".")) : "";
      const isPdf = mime === "application/pdf" || extension === ".pdf";
      const safeImageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff"]);
      const isSafeImage =
        !mime.includes("svg") &&
        (mime.startsWith("image/") || safeImageExtensions.has(extension));
      const isText =
        mime.startsWith("text/") ||
        mime === "application/json" ||
        [".txt", ".csv", ".json", ".log"].includes(extension);

      // Legacy files often have application/octet-stream or missing MIME metadata.
      // Use a strict safe extension allowlist, never preview SVG as active content.
      if (isPdf) {
        const url = URL.createObjectURL(blob);
        setObjectUrl(url);
        setPreviewType("pdf");
      } else if (isSafeImage) {
        const url = URL.createObjectURL(blob);
        setObjectUrl(url);
        setPreviewType("image");
      } else if (isText) {
        const text = await blob.text();
        if (requestId !== previewRequestRef.current) return;
        setTextContent(text);
        setPreviewType("text");
      } else {
        setPreviewType("unsupported");
      }

      setStatus("ready");
    } catch (err: any) {
      if (requestId !== previewRequestRef.current) return;
      console.error("[DocumentPreview] Failed to load preview:", err);
      setStatus("error");
      const msg = err?.data?.message || err?.message || "Failed to load document preview.";
      setErrorMessage(msg);
    }
  }, [documentId, documentName, documentMimeType]);

  useEffect(() => {
    if (open && documentId) {
      loadPreview();
    } else {
      previewRequestRef.current += 1;
      setStatus("loading");
      setTextContent(null);
      setObjectUrl(null);
    }

    return () => {
      // Ignore an in-flight response if the modal closes or switches files.
      previewRequestRef.current += 1;
    };
  }, [open, documentId, loadPreview]);

  if (!open || !documentId) return null;

  const handleDownload = () => {
    if (documentId) {
      downloadDocument(documentId);
    }
  };

  const handleOpenExternal = () => {
    if (objectUrl) {
      window.open(objectUrl, "_blank");
    }
  };

  const handleConfirmDelete = async () => {
    if (!documentId) return;
    try {
      await deleteMutation.mutateAsync(documentId);
      toast.success(`Document "${resolvedFileName}" deleted permanently.`);
      setShowDeleteConfirm(false);
      qc.invalidateQueries({ queryKey: docKeys.all });
      qc.invalidateQueries({ queryKey: ["clients"] });
      onDeleteSuccess?.();
      onDeleted?.(documentId);
      onClose();
    } catch (err: any) {
      console.error("[DocumentPreview] Failed to delete document:", err);
      const msg = err?.data?.message || err?.message || "Failed to delete document. Please try again.";
      toast.error(msg);
    }
  };

  return (
    <>
      <DialogPrimitive.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogPrimitive.Portal>
          {/* Backdrop covering entire screen above topbar, sidebar, and layout */}
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

          {/* Dialog Container positioned in viewport */}
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          >
            <DialogPrimitive.Title className="sr-only">
              {resolvedFileName} Preview
            </DialogPrimitive.Title>

            {/* Dialog Window - Viewport constrained */}
            <div className="relative flex flex-col h-[90dvh] max-h-[90dvh] w-full max-w-5xl rounded-2xl border border-border bg-card shadow-lift overflow-hidden data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 duration-150">
              {/* Header - Fixed at top of window */}
              <div className="flex items-center justify-between px-3 sm:px-5 py-2.5 sm:py-3.5 border-b border-border bg-muted/40 shrink-0 min-w-0">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 mr-2 sm:mr-4 flex-1">
                  <span className="grid size-8 sm:size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                    {previewType === "image" ? (
                      <FileImage size={18} strokeWidth={1.75} />
                    ) : (
                      <FileText size={18} strokeWidth={1.75} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2
                      className="text-xs sm:text-body font-semibold text-foreground truncate"
                      title={resolvedFileName}
                    >
                      {resolvedFileName}
                    </h2>
                    <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-caption text-muted-foreground mt-0.5 truncate">
                      {resolvedMime && <span className="font-mono truncate">{resolvedMime}</span>}
                      {documentSize && (
                        <>
                          <span>•</span>
                          <span className="shrink-0">
                            {typeof documentSize === "number"
                              ? `${(documentSize / 1024).toFixed(1)} KB`
                              : documentSize}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                  {objectUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="hidden md:flex items-center gap-1.5 rounded-md h-8 sm:h-9 px-2.5 text-xs"
                      onClick={handleOpenExternal}
                      title="Open in new window"
                    >
                      <ExternalLink size={14} />
                      <span>Open in Tab</span>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1.5 rounded-md h-8 sm:h-9 px-2 sm:px-3 text-xs"
                    onClick={handleDownload}
                    title="Download document"
                  >
                    <Download size={14} />
                    <span className="hidden sm:inline">Download</span>
                  </Button>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-8 sm:size-9 p-0 rounded-md text-destructive/80 hover:text-destructive hover:bg-destructive/10 transition-colors"
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={status === "loading" || deleteMutation.isPending}
                      title="Delete document"
                      aria-label="Delete document"
                    >
                      <Trash2 size={16} />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="size-8 sm:size-9 p-0 rounded-md text-muted-foreground hover:text-foreground"
                    onClick={onClose}
                    title="Close preview (Esc)"
                    aria-label="Close preview"
                  >
                    <X size={18} />
                  </Button>
                </div>
              </div>

              {/* Content Body - Viewport aware with independent scrolling */}
              <div className="relative flex-1 min-h-0 w-full overflow-auto bg-muted/15 p-2 sm:p-6 flex flex-col justify-center">
                {status === "loading" && (
                  <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                    <Loader2 size={32} className="animate-spin text-primary" />
                    <p className="text-helper font-medium text-muted-foreground">
                      Loading document preview…
                    </p>
                  </div>
                )}

                {status === "error" && (
                  <div className="mx-auto max-w-md rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center space-y-4">
                    <div className="grid size-12 mx-auto place-items-center rounded-full bg-destructive/20 text-destructive">
                      <AlertTriangle size={24} />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Unable to load document</p>
                      <p className="text-helper text-muted-foreground mt-1">
                        {errorMessage ||
                          "You may not have permission to view this file, or the file is temporarily unavailable."}
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-2 pt-2">
                      <Button variant="outline" size="sm" onClick={loadPreview} className="gap-1.5 rounded-md">
                        <RotateCw size={14} /> Retry
                      </Button>
                      <Button size="sm" onClick={handleDownload} className="gap-1.5 rounded-md">
                        <Download size={14} /> Download File
                      </Button>
                    </div>
                  </div>
                )}

                {status === "ready" && (
                  <>
                    {/* PDF Viewer: Fills available container safely */}
                    {previewType === "pdf" && objectUrl && (
                      <div className="w-full h-full min-h-0 flex-1 rounded-md overflow-hidden border border-border shadow-soft bg-white">
                        <iframe
                          src={objectUrl}
                          title={resolvedFileName}
                          className="w-full h-full border-0 block"
                        />
                      </div>
                    )}

                    {/* Image Viewer: Cleanly constrained, object-contain, centered, preserves aspect ratio */}
                    {previewType === "image" && objectUrl && (
                      <div className="flex-1 min-h-0 w-full h-full flex items-center justify-center overflow-auto p-1 sm:p-2">
                        <img
                          src={objectUrl}
                          alt={resolvedFileName}
                          className="max-h-full max-w-full object-contain mx-auto my-auto rounded-md shadow-sm border border-border select-none"
                        />
                      </div>
                    )}

                    {/* Text Viewer: Wrap long lines, independent scrolling */}
                    {previewType === "text" && textContent !== null && (
                      <div className="w-full h-full min-h-0 flex-1 overflow-auto rounded-md border border-border bg-card p-4 shadow-inner">
                        <pre className="font-mono text-xs sm:text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed select-text">
                          {textContent}
                        </pre>
                      </div>
                    )}

                    {/* Unsupported format: Friendly notice + download */}
                    {previewType === "unsupported" && (
                      <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-8 text-center space-y-4 shadow-soft">
                        <div className="grid size-14 mx-auto place-items-center rounded-full bg-muted text-muted-foreground">
                          <FileQuestion size={28} strokeWidth={1.5} />
                        </div>
                        <div>
                          <p className="text-body font-semibold text-foreground">Inline preview unavailable</p>
                          <p className="text-helper text-muted-foreground mt-1">
                            This file type cannot be rendered directly in the browser safely. You can download the file to view it on your device.
                          </p>
                        </div>
                        <div className="pt-2">
                          <Button onClick={handleDownload} className="gap-1.5 rounded-md">
                            <Download size={14} /> Download File
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="z-[60] w-[calc(100vw-1.5rem)] sm:w-full max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 size={18} /> Delete Document?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-helper text-muted-foreground space-y-2">
              <span>You are about to permanently delete this document from LegalOS. This action cannot be undone.</span>
              <span className="block font-medium text-foreground bg-muted/60 p-2.5 rounded border border-border text-xs break-all mt-2">
                {resolvedFileName}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0 sm:space-x-2 pt-2">
            <AlertDialogCancel disabled={deleteMutation.isPending} className="w-full sm:w-auto">
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={handleConfirmDelete}
              className="w-full sm:w-auto gap-1.5"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Deleting…</span>
                </>
              ) : (
                <>
                  <Trash2 size={15} />
                  <span>Delete Document</span>
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
