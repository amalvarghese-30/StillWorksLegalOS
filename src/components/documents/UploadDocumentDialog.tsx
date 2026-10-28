import { useRef, useState, useEffect } from "react";
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
  preSelectedClientId?: string;
}

export function UploadDocumentDialog({
  open,
  onClose,
  preSelectedCaseId,
  preSelectedClientId,
}: UploadDocumentDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [caseId, setCaseId] = useState(preSelectedCaseId ?? (preSelectedClientId ? "none" : ""));
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "complete" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadedSha256, setUploadedSha256] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  useEffect(() => {
    if (open) {
      if (preSelectedCaseId) {
        setCaseId(preSelectedCaseId);
      } else if (preSelectedClientId) {
        setCaseId("none");
      }
    }
  }, [open, preSelectedCaseId, preSelectedClientId]);

  const { data: casesData } = useCases({ limit: "200" });
  const allCases = casesData?.cases ?? [];

  const displayedCases = preSelectedClientId
    ? allCases.filter((c: any) => {
        const normalizeId = (value: any) =>
          value && typeof value === "object" ? String(value._id ?? "") : String(value ?? "");
        const pMatch = c.parties?.some((p: any) => normalizeId(p.clientId) === String(preSelectedClientId));
        const cMatch = normalizeId(c.clientId) === String(preSelectedClientId);
        return pMatch || cMatch;
      })
    : allCases;

  // A client-scoped upload must not fall back to unrelated matters when the
  // client has no accessible linked cases. Direct-to-client upload remains available.
  const cases = preSelectedClientId ? displayedCases : allCases;

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
    if (!file) {
      setErrorMessage("Please select a file to upload");
      return;
    }

    if (!caseId && !preSelectedClientId) {
      setErrorMessage("Please select a case or client");
      return;
    }

    const cleanCaseId = caseId && caseId !== "none" ? caseId : undefined;

    setUploadStatus("uploading");
    setUploadProgress(0);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("name", file.name);
      if (cleanCaseId) formData.append("caseId", cleanCaseId);
      if (preSelectedClientId) formData.append("clientId", preSelectedClientId);
      formData.append("file", file);

      const { document } = await uploadDocumentStream(formData, (percent) => setUploadProgress(percent));

      setUploadedSha256(document.sha256 ?? null);
      setUploadStatus("complete");
      setUploadProgress(100);
      qc.invalidateQueries({ queryKey: docKeys.all });
      qc.invalidateQueries({ queryKey: ["clients"] });
      if (preSelectedClientId) {
        qc.invalidateQueries({ queryKey: ["clients", preSelectedClientId] });
        qc.invalidateQueries({ queryKey: ["clients", preSelectedClientId, "documents"] });
      }

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
    setCaseId(preSelectedCaseId ?? (preSelectedClientId ? "none" : ""));
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
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:w-full max-w-lg max-h-[calc(100dvh-2rem)] sm:max-h-[85dvh] p-4 sm:p-6 overflow-y-auto overflow-x-hidden min-w-0">
        <DialogHeader className="pr-8 text-left space-y-1.5 min-w-0">
          <DialogTitle className="text-base sm:text-lg font-semibold tracking-tight text-foreground truncate">
            Upload document
          </DialogTitle>
          <DialogDescription className="text-caption sm:text-helper text-muted-foreground break-words leading-relaxed">
            Select a file and case. Files are securely saved to firm storage and verified for tamper-proof integrity.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5 min-w-0 max-w-full" onSubmit={(e) => e.preventDefault()}>
          {/* ── Case Selector ── */}
          <div className="space-y-1.5 min-w-0 max-w-full">
            <Label htmlFor="upload-case" className="text-helper font-medium">
              {preSelectedClientId ? "Case / Matter (Optional)" : "Case *"}
            </Label>
            <Select value={caseId} onValueChange={setCaseId}>
              <SelectTrigger id="upload-case" className="h-10 sm:h-11 rounded-md min-w-0 w-full max-w-full text-xs sm:text-sm" disabled={locked}>
                <SelectValue placeholder={preSelectedClientId ? "Direct to Client Profile or Select Case" : "Select a case"} />
              </SelectTrigger>
              <SelectContent className="max-w-[calc(100vw-2rem)] sm:max-w-md w-full">
                {preSelectedClientId && (
                  <SelectItem value="none">
                    <span className="font-semibold text-primary truncate">Direct to Client Profile (No matter)</span>
                  </SelectItem>
                )}
                {cases?.map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    <div className="flex flex-col min-w-0 max-w-[280px] sm:max-w-[340px] truncate text-left">
                      <span className="font-medium truncate">{c.number} — {c.title}</span>
                      <span className="text-caption text-muted-foreground truncate">{c.category || c.practice || "General Legal"}</span>
                    </div>
                  </SelectItem>
                ))}
                {(!cases?.length && !preSelectedClientId) && (
                  <div className="px-3 py-2 text-center text-helper text-muted-foreground">
                    No accessible cases found
                  </div>
                )}
              </SelectContent>
            </Select>
            {uploadStatus === "error" && !caseId && !preSelectedClientId && (
              <p className="text-caption text-destructive">Please select a case</p>
            )}
          </div>

          {/* ── File Drop Zone ── */}
          <div
            className={`relative rounded-lg border-2 border-dashed transition-colors w-full min-w-0 max-w-full overflow-hidden ${uploadStatus === "idle" || uploadStatus === "error"
              ? "border-border hover:border-primary/50"
              : "border-primary/50"
              } p-4 sm:p-6 ${locked ? "opacity-60 pointer-events-none" : ""}`}
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
              <div className="space-y-3 min-w-0 w-full max-w-full">
                <div className="flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-lg bg-muted/30 border border-border min-w-0 max-w-full">
                  <File size={22} strokeWidth={1.75} className="text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-helper font-medium text-foreground truncate" title={file.name}>
                      {file.name}
                    </p>
                    <p className="text-[11px] sm:text-caption text-muted-foreground truncate">
                      {(file.size / 1024 / 1024).toFixed(2)} MB • {file.type || "Unknown type"}
                    </p>
                  </div>
                  {!locked && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="grid size-7 sm:size-8 place-items-center rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0"
                      aria-label="Remove file"
                      title="Remove selected file"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                {uploadStatus !== "idle" && (
                  <div className="space-y-1.5 min-w-0">
                    <Progress value={uploadProgress} className="h-2 rounded-full" />
                    <div className="flex items-center justify-between text-caption">
                      <span className="text-muted-foreground truncate">{statusLabels[uploadStatus]}</span>
                      <span className="font-mono shrink-0 ml-2">{uploadProgress}%</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-center gap-2 text-caption sm:text-helper">
                  {statusIcons[uploadStatus]}
                  <span className="truncate">{statusLabels[uploadStatus]}</span>
                </div>

                {uploadedSha256 && (
                  <details className="text-caption text-muted-foreground min-w-0">
                    <summary className="cursor-pointer truncate">Security Checksum: {uploadedSha256.substring(0, 16)}…</summary>
                    <pre className="mt-2 p-2 rounded bg-muted overflow-x-auto text-[10px] font-mono break-all whitespace-pre-wrap">
                      Digital Fingerprint: {uploadedSha256}
                    </pre>
                  </details>
                )}
              </div>
            ) : (
              <div className="text-center py-2 sm:py-3">
                <Upload size={28} strokeWidth={1.75} className="mx-auto text-muted-foreground mb-2 sm:mb-3" />
                <p className="text-xs sm:text-helper font-medium text-foreground">Drag & drop a file here, or click to browse</p>
                <p className="text-[11px] sm:text-caption text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">
                  Max 100MB • PDF, DOC, XLS, PPT, TXT, CSV, ZIP, JPG, PNG, TIFF
                </p>
              </div>
            )}
          </div>

          {errorMessage && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2.5 sm:p-3 text-caption text-destructive flex items-center gap-2 min-w-0">
              <AlertCircle size={14} strokeWidth={2} className="shrink-0" />
              <span className="break-words">{errorMessage}</span>
            </div>
          )}

          {/* ── Actions ── */}
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0 sm:space-x-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={uploadStatus === "uploading" || uploadStatus === "complete"}
              className="w-full sm:w-auto h-9 sm:h-10 text-xs sm:text-sm rounded-md"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleUpload}
              disabled={!file || (!caseId && !preSelectedClientId) || uploadStatus !== "idle"}
              className="gradient-primary w-full sm:w-auto h-9 sm:h-10 text-xs sm:text-sm rounded-md text-primary-foreground shadow-soft gap-1.5"
            >
              {uploadStatus === "uploading" ? (
                <Loader2 size={16} className="animate-spin" />
              ) : uploadStatus === "complete" ? (
                <CheckCircle size={16} strokeWidth={2} />
              ) : (
                <Upload size={16} strokeWidth={1.75} />
              )}
              <span>{uploadStatus === "idle" ? "Upload" : uploadStatus === "complete" ? "Done" : "Uploading…"}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
