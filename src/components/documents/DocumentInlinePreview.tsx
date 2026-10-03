import { useEffect, useState, useCallback } from "react";
import {
  FileText,
  FileImage,
  FileSpreadsheet,
  FileArchive,
  FileCode,
  Loader2,
  Maximize2,
  AlertCircle,
} from "lucide-react";
import { downloadBlob } from "@/services/api";

interface DocumentInlinePreviewProps {
  documentId: string;
  documentName: string;
  mimeType?: string;
  className?: string;
  onExpand?: () => void;
}

export function DocumentInlinePreview({
  documentId,
  documentName,
  mimeType,
  className = "h-44",
  onExpand,
}: DocumentInlinePreviewProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [textSnippet, setTextSnippet] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<"image" | "pdf" | "text" | "unsupported">("unsupported");

  const cleanupUrl = useCallback((url: string | null) => {
    if (url && url.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!documentId) return;
      setStatus("loading");
      setTextSnippet(null);

      try {
        const { blob, fileName } = await downloadBlob(`/documents/${documentId}/view`);
        if (!active) return;

        const effectiveMime = (blob.type || mimeType || "").toLowerCase();
        const nameLower = (fileName || documentName || "").toLowerCase();

        if (
          effectiveMime.startsWith("image/") &&
          !effectiveMime.includes("svg")
        ) {
          const url = URL.createObjectURL(blob);
          setObjectUrl((prev) => {
            cleanupUrl(prev);
            return url;
          });
          setPreviewType("image");
          setStatus("ready");
        } else if (
          effectiveMime === "application/pdf" ||
          nameLower.endsWith(".pdf")
        ) {
          const url = URL.createObjectURL(blob);
          setObjectUrl((prev) => {
            cleanupUrl(prev);
            return url;
          });
          setPreviewType("pdf");
          setStatus("ready");
        } else if (
          effectiveMime.startsWith("text/") ||
          effectiveMime === "application/json" ||
          nameLower.endsWith(".txt") ||
          nameLower.endsWith(".json") ||
          nameLower.endsWith(".csv")
        ) {
          const txt = await blob.text();
          if (!active) return;
          setTextSnippet(txt.slice(0, 300));
          setPreviewType("text");
          setStatus("ready");
        } else {
          setPreviewType("unsupported");
          setStatus("ready");
        }
      } catch (err) {
        if (!active) return;
        console.warn("[DocumentInlinePreview] Failed to load preview:", err);
        setStatus("error");
      }
    }

    load();

    return () => {
      active = false;
      setObjectUrl((prev) => {
        cleanupUrl(prev);
        return null;
      });
    };
  }, [documentId, documentName, mimeType, cleanupUrl]);

  const ext = (documentName.split(".").pop() || "").toUpperCase();

  const getGenericIcon = () => {
    const lower = documentName.toLowerCase();
    if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv")) {
      return <FileSpreadsheet size={32} className="text-emerald-500" />;
    }
    if (lower.endsWith(".zip") || lower.endsWith(".rar") || lower.endsWith(".7z") || lower.endsWith(".tar")) {
      return <FileArchive size={32} className="text-amber-500" />;
    }
    if (lower.endsWith(".js") || lower.endsWith(".ts") || lower.endsWith(".json") || lower.endsWith(".html")) {
      return <FileCode size={32} className="text-indigo" />;
    }
    return <FileText size={32} className="text-muted-foreground" />;
  };

  return (
    <div
      onClick={onExpand}
      className={`group relative overflow-hidden rounded-md border border-border/80 bg-muted/30 transition-all ${className} ${
        onExpand ? "cursor-pointer hover:border-primary/50" : ""
      }`}
    >
      {/* Loading State */}
      {status === "loading" && (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted/40 p-4 text-center">
          <Loader2 size={22} className="animate-spin text-primary" />
          <span className="text-caption text-muted-foreground">Rendering preview…</span>
        </div>
      )}

      {/* Error State */}
      {status === "error" && (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 p-4 text-center">
          <AlertCircle size={26} className="text-muted-foreground/60" />
          <span className="text-caption font-medium text-muted-foreground">Preview unavailable</span>
          <span className="text-[11px] text-muted-foreground/60 truncate max-w-[200px]">{documentName}</span>
        </div>
      )}

      {/* Ready States */}
      {status === "ready" && (
        <>
          {/* Image Preview */}
          {previewType === "image" && objectUrl && (
            <div className="flex h-full w-full items-center justify-center bg-black/10 dark:bg-black/40 p-1">
              <img
                src={objectUrl}
                alt={documentName}
                className="h-full w-full rounded object-contain transition-transform duration-200 group-hover:scale-[1.02]"
              />
            </div>
          )}

          {/* PDF Preview */}
          {previewType === "pdf" && objectUrl && (
            <div className="h-full w-full bg-white relative overflow-hidden">
              <iframe
                src={`${objectUrl}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`}
                title={documentName}
                className="pointer-events-none h-full w-full border-0 select-none scale-[1.01]"
              />
              <div className="absolute inset-0 bg-transparent" />
            </div>
          )}

          {/* Text Preview */}
          {previewType === "text" && textSnippet && (
            <div className="h-full w-full overflow-hidden bg-card p-3 font-mono text-[11px] leading-relaxed text-muted-foreground select-none">
              <pre className="whitespace-pre-wrap break-words">{textSnippet}</pre>
            </div>
          )}

          {/* Generic / Unsupported Preview */}
          {previewType === "unsupported" && (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
              <div className="grid size-12 place-items-center rounded-lg bg-primary/10">
                {getGenericIcon()}
              </div>
              <span className="rounded-full bg-muted px-2.5 py-0.5 font-mono text-[10px] font-semibold text-foreground border border-border">
                .{ext || "FILE"}
              </span>
            </div>
          )}

          {/* Hover Expand Overlay */}
          {onExpand && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 backdrop-blur-[2px] transition-opacity duration-150 group-hover:opacity-100">
              <span className="flex items-center gap-1.5 rounded-full bg-card/90 px-3 py-1.5 text-caption font-medium text-foreground shadow-md">
                <Maximize2 size={13} />
                Click to expand
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
