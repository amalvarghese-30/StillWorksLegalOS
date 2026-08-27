import { useRef, useState } from "react";
import {
  File,
  Loader2,
  CheckCircle,
  AlertCircle,
  Upload,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { uploadDocumentStream, docKeys } from "@/services/documents";
import { useCases } from "@/services/cases";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface UploadDocumentDialogProps {
  open: boolean;
  onClose: () => void;
  preSelectedCaseId?: string;
}

export function UploadDocumentDialog({ open, onClose, preSelectedCaseId }: UploadDocumentDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [caseId, setCaseId] = useState(preSelectedCaseId ?? "");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "complete" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadedSha256, setUploadedSha256] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const { data: casesData } = useCases({ limit: "200" });
  const cases = casesData?.cases ?? [];

  const locked = uploadStatus === "uploading" || uploadStatus === "complete";

  const handleFileSelect = (selectedFile: File) => {
    const maxSize = 100 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      setErrorMessage("File size exceeds 100MB limit");
      return;
    }

    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
      "text/csv",
      "application/zip",
      "application/x-zip-compressed",
      "image/jpeg",
      "image/png",
      "image/tiff",
    ];

    if (!allowedTypes.includes(selectedFile.type)) {
      setErrorMessage(`File type ${selectedFile.type} is not allowed`);
      return;
    }

    setFile(selectedFile);
    setErrorMessage(null);
    setUploadProgress(0);
    setUploadStatus("idle");
    setUploadedSha256(null);
  };

  const handleUpload = async () => {
    if (!file || !caseId) {
      setErrorMessage("Please select a file and a case");
      return;
    }

    setUploadStatus("uploading");
    setUploadProgress(0);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("caseId", caseId);
      formData.append("name", file.name);
      formData.append("file", file);

      const { document } = await uploadDocumentStream(formData, (percent) => setUploadProgress(percent));

      setUploadedSha256(document.sha256 ?? null);
      setUploadStatus("complete");
      setUploadProgress(100);
      qc.invalidateQueries({ queryKey: docKeys.all });

      setTimeout(() => {
        onClose();
        resetForm();
      }, 800);
    } catch (err) {
      setUploadStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Upload failed. Please try again.");
    }
  };

  const resetForm = () => {
    setFile(null);
    setCaseId("");
    setUploadProgress(0);
    setUploadStatus("idle");
    setErrorMessage(null);
    setUploadedSha256(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const statusIcons = {
    idle: <Upload size={17} strokeWidth={1.75} />,
    uploading: <Loader2 size={17} className="animate-spin" />,
    complete: <CheckCircle size={17} strokeWidth={2} className="text-success" />,
    error: <AlertCircle size={17} strokeWidth={2} className="text-destructive" />,
  };

  const statusLabels = {
    idle: "Ready to upload",
    uploading: "Uploading to secure storage…",
    complete: "Upload complete!",
    error: "Upload failed",
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload document</DialogTitle>
          <DialogDescription>
            Select a file and case. Files are streamed to the NAS and verified with SHA-256.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
          {/* ── Case Selector ── */}
          <div className="space-y-1.5">
            <Label htmlFor="upload-case" className="text-helper">Case *</Label>
            <Select value={caseId} onValueChange={setCaseId}>
              <SelectTrigger id="upload-case" className="h-11 rounded-md" disabled={locked}>
                <SelectValue placeholder="Select a case" />
              </SelectTrigger>
              <SelectContent>
                {cases?.map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{c.number} — {c.title}</span>
                      <span className="text-caption text-muted-foreground">{c.court}</span>
                    </div>
                  </SelectItem>
                ))}
                {(!cases?.length) && (
                  <div className="px-3 py-2 text-center text-helper text-muted-foreground">
                    No accessible cases found
                  </div>
                )}
              </SelectContent>
            </Select>
            {uploadStatus === "error" && !caseId && (
              <p className="text-caption text-destructive">Please select a case</p>
            )}
          </div>

          {/* ── File Drop Zone ── */}
          <div
            className={`relative rounded-lg border-2 border-dashed transition-colors ${uploadStatus === "idle" || uploadStatus === "error"
              ? "border-border hover:border-primary/50"
              : "border-primary/50"
              } p-8 ${locked ? "opacity-60 pointer-events-none" : ""}`}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleInputChange}
              disabled={locked}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.jpg,.jpeg,.png,.tiff"
            />
            {file ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                  <File size={24} strokeWidth={1.75} className="text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-helper font-medium truncate">{file.name}</p>
                    <p className="text-caption text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB • {file.type || "Unknown type"}
                    </p>
                  </div>
                  {!locked && (
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="grid size-8 place-items-center rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex-shrink-0"
                      aria-label="Remove file"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                {uploadStatus !== "idle" && (
                  <div className="space-y-2">
                    <Progress value={uploadProgress} className="h-2 rounded-full" />
                    <div className="flex items-center justify-between text-caption">
                      <span className="text-muted-foreground">{statusLabels[uploadStatus]}</span>
                      <span className="font-mono">{uploadProgress}%</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-center gap-2 text-helper">
                  {statusIcons[uploadStatus]}
                  <span>{statusLabels[uploadStatus]}</span>
                </div>

                {uploadedSha256 && (
                  <details className="text-caption text-muted-foreground">
                    <summary className="cursor-pointer">SHA-256: {uploadedSha256.substring(0, 16)}…</summary>
                    <pre className="mt-2 p-2 rounded bg-muted overflow-x-auto text-[10px] font-mono">{uploadedSha256}</pre>
                  </details>
                )}
              </div>
            ) : (
              <div className="text-center">
                <Upload size={32} strokeWidth={1.75} className="mx-auto text-muted-foreground mb-3" />
                <p className="text-helper font-medium">Drag & drop a file here, or click to browse</p>
                <p className="text-caption text-muted-foreground mt-1">
                  Max 100MB • PDF, DOC, XLS, PPT, TXT, CSV, ZIP, JPG, PNG, TIFF
                </p>
              </div>
            )}
          </div>

          {errorMessage && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-caption text-destructive flex items-center gap-2">
              <AlertCircle size={14} strokeWidth={2} />
              {errorMessage}
            </div>
          )}

          {/* ── Actions ── */}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={uploadStatus === "uploading" || uploadStatus === "complete"}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleUpload}
              disabled={!file || !caseId || uploadStatus !== "idle"}
              className="gradient-primary rounded-md text-primary-foreground shadow-soft"
            >
              {uploadStatus === "uploading" ? (
                <Loader2 size={17} className="animate-spin" />
              ) : uploadStatus === "complete" ? (
                <CheckCircle size={17} strokeWidth={2} />
              ) : (
                <Upload size={17} strokeWidth={1.75} />
              )}
              {uploadStatus === "idle" ? "Upload" : uploadStatus === "complete" ? "Done" : "Uploading…"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}