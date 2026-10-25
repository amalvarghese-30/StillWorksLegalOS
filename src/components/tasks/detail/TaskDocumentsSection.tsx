import React, { useRef, useState } from "react";
import {
  FileText,
  FileImage,
  FileCode,
  FileSpreadsheet,
  File,
  Upload,
  Download,
  Trash2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  useDocuments,
  uploadDocumentStream,
  downloadDocument,
  useDeleteDocument,
  type DocumentRecord,
} from "@/services/documents";
import { useQueryClient } from "@tanstack/react-query";
import { taskKeys } from "@/services/tasks";
import { formatReadableDate } from "@/lib/dates";

interface TaskDocumentsSectionProps {
  taskId: string;
  caseId?: string | null;
  clientId?: string | null;
  initialDocuments?: any[];
  canEdit?: boolean;
}

function getFileIcon(mime?: string, name?: string) {
  const ext = (name || "").split(".").pop()?.toLowerCase() || "";
  if (mime?.includes("pdf") || ext === "pdf") {
    return <FileText className="size-5 text-red-500 shrink-0" />;
  }
  if (mime?.includes("image") || ["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
    return <FileImage className="size-5 text-emerald-500 shrink-0" />;
  }
  if (["xls", "xlsx", "csv"].includes(ext)) {
    return <FileSpreadsheet className="size-5 text-green-600 shrink-0" />;
  }
  if (["doc", "docx"].includes(ext) || mime?.includes("word")) {
    return <FileText className="size-5 text-blue-500 shrink-0" />;
  }
  if (["zip", "rar", "7z"].includes(ext)) {
    return <FileCode className="size-5 text-amber-500 shrink-0" />;
  }
  return <File className="size-5 text-primary shrink-0" />;
}

export function TaskDocumentsSection({
  taskId,
  caseId,
  clientId,
  initialDocuments,
  canEdit = true,
}: TaskDocumentsSectionProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: docsData, isLoading } = useDocuments({ taskId });
  const deleteMutation = useDeleteDocument();

  // Combine query results with initial documents if query is still resolving
  const documents: DocumentRecord[] =
    docsData?.documents && docsData.documents.length > 0
      ? docsData.documents
      : (initialDocuments as DocumentRecord[]) || [];

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    let successCount = 0;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append("file", file);
        formData.append("name", file.name);
        formData.append("taskId", taskId);
        if (caseId) formData.append("caseId", caseId);
        if (clientId) formData.append("clientId", clientId);

        try {
          await uploadDocumentStream(formData);
          successCount++;
        } catch (uploadErr) {
          console.error(`Failed to upload ${file.name}:`, uploadErr);
          toast.error(`Failed to upload "${file.name}"`);
        }
      }

      if (successCount > 0) {
        toast.success(
          successCount === 1
            ? "Document uploaded successfully"
            : `${successCount} documents uploaded successfully`
        );
        queryClient.invalidateQueries({ queryKey: ["documents"] });
        queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDownload = async (doc: DocumentRecord) => {
    setDownloadingId(doc._id);
    try {
      await downloadDocument(doc._id);
      toast.success(`Downloaded "${doc.name}"`);
    } catch (err) {
      console.error("Download error:", err);
      toast.error("Failed to download document");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (docId: string, name: string) => {
    if (!window.confirm(`Delete document "${name}" from this task?`)) return;
    try {
      await deleteMutation.mutateAsync(docId);
      toast.success(`Removed "${name}"`);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Failed to remove document");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-xs text-foreground uppercase tracking-wider">
            Documents
          </span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
            {documents.length}
          </span>
        </div>

        {canEdit && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="h-7 text-xs gap-1.5 rounded-lg border-primary/20 text-primary hover:bg-primary/5 hover:border-primary/40 font-medium"
            >
              {isUploading ? (
                <Loader2 size={12} className="animate-spin text-primary" />
              ) : (
                <Upload size={12} className="text-primary" />
              )}
              {isUploading ? "Uploading…" : "+ Upload"}
            </Button>
          </div>
        )}
      </div>

      {isLoading && documents.length === 0 ? (
        <div className="flex items-center justify-center py-4 text-xs text-muted-foreground gap-1.5">
          <Loader2 size={14} className="animate-spin text-primary" />
          Loading documents…
        </div>
      ) : documents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 p-4 text-center">
          <p className="text-xs text-muted-foreground">No documents attached yet</p>
          {canEdit && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-1 text-[11px] text-primary hover:underline font-medium inline-flex items-center gap-1"
            >
              <Upload size={10} /> Attach document
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
          {documents.map((doc) => (
            <div
              key={doc._id}
              className="group flex items-center justify-between gap-2.5 rounded-lg border border-border/80 bg-muted/20 p-2.5 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {getFileIcon(doc.mimeType, doc.name)}
                <div className="min-w-0">
                  <p
                    className="text-xs font-medium text-foreground truncate cursor-pointer hover:text-primary transition-colors"
                    title={doc.name}
                    onClick={() => handleDownload(doc)}
                  >
                    {doc.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {doc.sizeFormatted || "File"} •{" "}
                    {formatReadableDate(doc.createdAt) || "Recent"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={downloadingId === doc._id}
                  onClick={() => handleDownload(doc)}
                  className="size-7 p-0 text-muted-foreground hover:text-primary rounded-md"
                  title="Download document"
                >
                  {downloadingId === doc._id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Download size={13} />
                  )}
                </Button>
                {canEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={deleteMutation.isPending}
                    onClick={() => handleDelete(doc._id, doc.name)}
                    className="size-7 p-0 text-muted-foreground hover:text-destructive rounded-md"
                    title="Delete document"
                  >
                    <Trash2 size={13} />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}