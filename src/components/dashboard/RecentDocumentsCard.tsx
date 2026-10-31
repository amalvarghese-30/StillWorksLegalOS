import { FileText, ArrowRight, Loader2, FileCheck, FileCode, FileSpreadsheet, AlertTriangle, RotateCw } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { formatSafeRelative } from "@/lib/dates";
import type { DocumentRecord } from "@/services/documents";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RecentDocumentsCardProps {
  documents: DocumentRecord[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  isRetrying?: boolean;
  onPreviewDocument: (doc: DocumentRecord) => void;
}

function getFileBadgeInfo(fileName: string, mimeType?: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf" || mimeType?.includes("pdf")) {
    return {
      label: "PDF",
      bg: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-900/50",
      icon: FileText,
    };
  }
  if (["doc", "docx"].includes(ext) || mimeType?.includes("word")) {
    return {
      label: "DOC",
      bg: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-900/50",
      icon: FileText,
    };
  }
  if (
    ["xls", "xlsx", "csv"].includes(ext) ||
    mimeType?.includes("sheet") ||
    mimeType?.includes("csv")
  ) {
    return {
      label: "XLS",
      bg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50",
      icon: FileSpreadsheet,
    };
  }
  if (["png", "jpg", "jpeg", "webp"].includes(ext) || mimeType?.includes("image")) {
    return {
      label: "IMG",
      bg: "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 border-violet-200 dark:border-violet-900/50",
      icon: FileCheck,
    };
  }
  return {
    label: ext.slice(0, 3).toUpperCase() || "FILE",
    bg: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    icon: FileCode,
  };
}

export function RecentDocumentsCard({
  documents,
  isLoading = false,
  isError = false,
  onRetry,
  isRetrying = false,
  onPreviewDocument,
}: RecentDocumentsCardProps) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/40">
            <FileText size={18} strokeWidth={2} />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Recent documents</h2>
            <p className="text-xs text-muted-foreground">Recently uploaded and updated files</p>
          </div>
        </div>
        <Link
          to="/documents"
          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
        >
          View all <ArrowRight size={13} strokeWidth={2} />
        </Link>
      </div>

      {/* Body */}
      <div className="mt-3.5 flex-1 min-w-0">
        {isLoading && documents.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="animate-spin text-muted-foreground" size={20} />
          </div>
        ) : isError && documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4 rounded-lg border border-destructive/30 bg-destructive/5">
            <AlertTriangle size={24} className="text-destructive mb-2" />
            <p className="text-sm font-semibold text-destructive">Failed to load documents</p>
            <p className="mt-1 text-xs text-muted-foreground max-w-[280px]">
              Could not retrieve document list from the server.
            </p>
            {onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                disabled={isRetrying}
                className="mt-3 rounded-lg text-xs"
              >
                <RotateCw size={12} className={`mr-1.5 ${isRetrying ? "animate-spin" : ""}`} />
                {isRetrying ? "Retrying…" : "Retry"}
              </Button>
            )}
          </div>
        ) : documents.length === 0 ? (
          <div className="py-10 text-center text-xs text-muted-foreground">
            No documents uploaded yet.
          </div>
        ) : (
          <div className="space-y-2.5">
            {isError && (
              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-800 dark:text-amber-300">
                <span>Showing cached documents. Refresh failed.</span>
                {onRetry && (
                  <button onClick={onRetry} className="font-semibold underline hover:no-underline">
                    Retry
                  </button>
                )}
              </div>
            )}
            {documents.slice(0, 4).map((doc) => {
              const badge = getFileBadgeInfo(doc.name, doc.mimeType);
              const caseNumber =
                typeof doc.caseId === "object" && doc.caseId
                  ? doc.caseId.number || doc.caseId.title
                  : doc.caseName;

              return (
                <div
                  key={doc._id}
                  onClick={() => onPreviewDocument(doc)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onPreviewDocument(doc);
                    }
                  }}
                  className="group flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/50 hover:bg-muted/40 p-3 transition-all duration-150 hover:border-primary/30 cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span
                      className={cn(
                        "grid size-9 shrink-0 place-items-center rounded-lg border text-[10px] font-bold tracking-wider",
                        badge.bg,
                      )}
                    >
                      {badge.label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs sm:text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                        {doc.name}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span>{formatSafeRelative(doc.createdAt)}</span>
                        {caseNumber && (
                          <>
                            <span>•</span>
                            <span className="rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/40 px-1.5 py-0.2 font-mono text-[10px] font-medium truncate max-w-[140px]">
                              {caseNumber}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {doc.sizeFormatted || `${Math.round(doc.size / 1024)} KB`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
