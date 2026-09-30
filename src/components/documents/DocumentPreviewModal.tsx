import { useEffect, useState, useCallback } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadBlob } from "@/services/api";
import { downloadDocument } from "@/services/documents";

export interface DocumentPreviewModalProps {
  open: boolean;
  onClose: () => void;
  documentId: string | null;
  documentName?: string | undefined;
  documentMimeType?: string | undefined;
  documentSize?: number | string | undefined;
}

type PreviewType = "pdf" | "image" | "text" | "unsupported";

export function DocumentPreviewModal({
  open,
  onClose,
  documentId,
  documentName,
  documentMimeType,
  documentSize,
}: DocumentPreviewModalProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<PreviewType>("unsupported");
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [resolvedFileName, setResolvedFileName] = useState<string>(documentName || "Document");
  const [resolvedMime, setResolvedMime] = useState<string>(documentMimeType || "");

  const cleanupUrl = useCallback((url: string | null) => {
    if (url && url.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const loadPreview = useCallback(async () => {
    if (!documentId) return;

    setStatus("loading");
    setErrorMessage(null);

    try {
      const { blob, fileName } = await downloadBlob(`/documents/${documentId}/view`);
      setResolvedFileName(fileName || documentName || "Document");

      const mime = (blob.type || documentMimeType || "").toLowerCase();
      setResolvedMime(mime);

      const nameLower = (fileName || documentName || "").toLowerCase();

      // Determine preview strategy strictly by content type & safe extensions
      if (
        mime === "application/pdf" ||
        (!mime && nameLower.endsWith(".pdf"))
      ) {
        const url = URL.createObjectURL(blob);
        setObjectUrl(url);
        setPreviewType("pdf");
      } else if (
        mime.startsWith("image/") &&
        !mime.includes("svg") // Never render SVG as raw HTML/image to prevent XSS
      ) {
        const url = URL.createObjectURL(blob);
        setObjectUrl(url);
        setPreviewType("image");
      } else if (
        mime.startsWith("text/") ||
        mime === "application/json" ||
        nameLower.endsWith(".txt") ||
        nameLower.endsWith(".csv") ||
        nameLower.endsWith(".json")
      ) {
        const text = await blob.text();
        setTextContent(text);
        setPreviewType("text");
      } else {
        setPreviewType("unsupported");
      }

      setStatus("ready");
    } catch (err: any) {
      console.error("[DocumentPreview] Failed to load preview:", err);
      setStatus("error");
      const msg = err?.data?.message || err?.message || "Failed to load document preview.";
      setErrorMessage(msg);
    }
  }, [documentId, documentName, documentMimeType]);

  useEffect(() => {
    let active = true;

    if (open && documentId) {
      loadPreview();
    } else {
      setStatus("loading");
      setTextContent(null);
      setObjectUrl((prev) => {
        cleanupUrl(prev);
        return null;
      });
    }

    return () => {
      active = false;
      setObjectUrl((prev) => {
        cleanupUrl(prev);
        return null;
      });
    };
  }, [open, documentId, loadPreview, cleanupUrl]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open || !documentId) return null;

  const handleDownload = () => {
    downloadDocument(documentId);
  };

  const handleOpenExternal = () => {
    if (objectUrl) {
      window.open(objectUrl, "_blank");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog Window */}
      <div className="relative z-10 flex flex-col h-[90vh] w-full max-w-5xl rounded-xl border border-border bg-card shadow-lift overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/40">
          <div className="flex items-center gap-3 min-w-0 mr-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              {previewType === "image" ? (
                <FileImage size={18} strokeWidth={1.75} />
              ) : (
                <FileText size={18} strokeWidth={1.75} />
              )}
            </span>
            <div className="min-w-0">
              <h2 className="text-body font-semibold text-foreground truncate" title={resolvedFileName}>
                {resolvedFileName}
              </h2>
              <div className="flex items-center gap-2 text-caption text-muted-foreground mt-0.5">
                {resolvedMime && <span className="font-mono">{resolvedMime}</span>}
                {documentSize && (
                  <>
                    <span>•</span>
                    <span>{typeof documentSize === "number" ? `${(documentSize / 1024).toFixed(1)} KB` : documentSize}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {objectUrl && (
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:flex items-center gap-1.5 rounded-md h-9"
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
              className="flex items-center gap-1.5 rounded-md h-9"
              onClick={handleDownload}
              title="Download document"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Download</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="size-9 p-0 rounded-md text-muted-foreground hover:text-foreground"
              onClick={onClose}
              title="Close preview (Esc)"
            >
              <X size={18} />
            </Button>
          </div>
        </div>

        {/* Content Body */}
        <div className="relative flex-1 overflow-auto bg-muted/15 p-4 sm:p-6 flex flex-col justify-center">
          {status === "loading" && (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <Loader2 size={32} className="animate-spin text-primary" />
              <p className="text-helper font-medium text-muted-foreground">Loading document preview…</p>
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
                  {errorMessage || "You may not have permission to view this file, or the file is temporarily unavailable."}
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
              {previewType === "pdf" && objectUrl && (
                <div className="w-full h-full min-h-[60vh] rounded-md overflow-hidden border border-border shadow-soft bg-white">
                  <iframe
                    src={objectUrl}
                    title={resolvedFileName}
                    className="w-full h-full border-0"
                  />
                </div>
              )}

              {previewType === "image" && objectUrl && (
                <div className="flex items-center justify-center h-full w-full overflow-auto p-2">
                  <img
                    src={objectUrl}
                    alt={resolvedFileName}
                    className="max-h-full max-w-full object-contain rounded-md shadow-soft border border-border"
                  />
                </div>
              )}

              {previewType === "text" && textContent !== null && (
                <div className="w-full h-full overflow-auto rounded-md border border-border bg-card p-4 shadow-inner">
                  <pre className="font-mono text-caption sm:text-helper text-foreground whitespace-pre-wrap select-text break-words leading-relaxed">
                    {textContent}
                  </pre>
                </div>
              )}

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
    </div>
  );
}
