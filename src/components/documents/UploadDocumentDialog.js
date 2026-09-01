import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useState } from "react";
import { File, Loader2, CheckCircle, AlertCircle, Upload, } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { uploadDocumentStream, docKeys } from "@/services/documents";
import { useCases } from "@/services/cases";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from "@/components/ui/dialog";
export function UploadDocumentDialog({ open, onClose, preSelectedCaseId }) {
    const [file, setFile] = useState(null);
    const [caseId, setCaseId] = useState(preSelectedCaseId ?? "");
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadStatus, setUploadStatus] = useState("idle");
    const [errorMessage, setErrorMessage] = useState(null);
    const [uploadedSha256, setUploadedSha256] = useState(null);
    const fileInputRef = useRef(null);
    const qc = useQueryClient();
    const { data: casesData } = useCases({ limit: "200" });
    const cases = casesData?.cases ?? [];
    const locked = uploadStatus === "uploading" || uploadStatus === "complete";
    const handleFileSelect = (selectedFile) => {
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
        }
        catch (err) {
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
    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };
    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            handleFileSelect(droppedFile);
        }
    };
    const handleInputChange = (e) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            handleFileSelect(selectedFile);
        }
    };
    const statusIcons = {
        idle: _jsx(Upload, { size: 17, strokeWidth: 1.75 }),
        uploading: _jsx(Loader2, { size: 17, className: "animate-spin" }),
        complete: _jsx(CheckCircle, { size: 17, strokeWidth: 2, className: "text-success" }),
        error: _jsx(AlertCircle, { size: 17, strokeWidth: 2, className: "text-destructive" }),
    };
    const statusLabels = {
        idle: "Ready to upload",
        uploading: "Uploading to secure storage…",
        complete: "Upload complete!",
        error: "Upload failed",
    };
    if (!open)
        return null;
    return (_jsx(Dialog, { open: open, onOpenChange: onClose, children: _jsxs(DialogContent, { className: "max-w-md", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Upload document" }), _jsx(DialogDescription, { children: "Select a file and case. Files are streamed to the NAS and verified with SHA-256." })] }), _jsxs("form", { className: "space-y-6", onSubmit: (e) => e.preventDefault(), children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "upload-case", className: "text-helper", children: "Case *" }), _jsxs(Select, { value: caseId, onValueChange: setCaseId, children: [_jsx(SelectTrigger, { id: "upload-case", className: "h-11 rounded-md", disabled: locked, children: _jsx(SelectValue, { placeholder: "Select a case" }) }), _jsxs(SelectContent, { children: [cases?.map((c) => (_jsx(SelectItem, { value: c._id, children: _jsxs("div", { className: "flex flex-col", children: [_jsxs("span", { className: "font-medium", children: [c.number, " \u2014 ", c.title] }), _jsx("span", { className: "text-caption text-muted-foreground", children: c.court })] }) }, c._id))), (!cases?.length) && (_jsx("div", { className: "px-3 py-2 text-center text-helper text-muted-foreground", children: "No accessible cases found" }))] })] }), uploadStatus === "error" && !caseId && (_jsx("p", { className: "text-caption text-destructive", children: "Please select a case" }))] }), _jsxs("div", { className: `relative rounded-lg border-2 border-dashed transition-colors ${uploadStatus === "idle" || uploadStatus === "error"
                                ? "border-border hover:border-primary/50"
                                : "border-primary/50"} p-8 ${locked ? "opacity-60 pointer-events-none" : ""}`, onDragOver: handleDragOver, onDrop: handleDrop, children: [_jsx("input", { ref: fileInputRef, type: "file", className: "absolute inset-0 w-full h-full opacity-0 cursor-pointer", onChange: handleInputChange, disabled: locked, accept: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.jpg,.jpeg,.png,.tiff" }), file ? (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border", children: [_jsx(File, { size: 24, strokeWidth: 1.75, className: "text-primary flex-shrink-0" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-helper font-medium truncate", children: file.name }), _jsxs("p", { className: "text-caption text-muted-foreground", children: [(file.size / 1024 / 1024).toFixed(2), " MB \u2022 ", file.type || "Unknown type"] })] }), !locked && (_jsx("button", { type: "button", onClick: () => setFile(null), className: "grid size-8 place-items-center rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex-shrink-0", "aria-label": "Remove file", children: _jsx("svg", { className: "h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) }))] }), uploadStatus !== "idle" && (_jsxs("div", { className: "space-y-2", children: [_jsx(Progress, { value: uploadProgress, className: "h-2 rounded-full" }), _jsxs("div", { className: "flex items-center justify-between text-caption", children: [_jsx("span", { className: "text-muted-foreground", children: statusLabels[uploadStatus] }), _jsxs("span", { className: "font-mono", children: [uploadProgress, "%"] })] })] })), _jsxs("div", { className: "flex items-center justify-center gap-2 text-helper", children: [statusIcons[uploadStatus], _jsx("span", { children: statusLabels[uploadStatus] })] }), uploadedSha256 && (_jsxs("details", { className: "text-caption text-muted-foreground", children: [_jsxs("summary", { className: "cursor-pointer", children: ["SHA-256: ", uploadedSha256.substring(0, 16), "\u2026"] }), _jsx("pre", { className: "mt-2 p-2 rounded bg-muted overflow-x-auto text-[10px] font-mono", children: uploadedSha256 })] }))] })) : (_jsxs("div", { className: "text-center", children: [_jsx(Upload, { size: 32, strokeWidth: 1.75, className: "mx-auto text-muted-foreground mb-3" }), _jsx("p", { className: "text-helper font-medium", children: "Drag & drop a file here, or click to browse" }), _jsx("p", { className: "text-caption text-muted-foreground mt-1", children: "Max 100MB \u2022 PDF, DOC, XLS, PPT, TXT, CSV, ZIP, JPG, PNG, TIFF" })] }))] }), errorMessage && (_jsxs("div", { className: "rounded-md bg-destructive/10 border border-destructive/20 p-3 text-caption text-destructive flex items-center gap-2", children: [_jsx(AlertCircle, { size: 14, strokeWidth: 2 }), errorMessage] })), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: onClose, disabled: uploadStatus === "uploading" || uploadStatus === "complete", children: "Cancel" }), _jsxs(Button, { type: "button", onClick: handleUpload, disabled: !file || !caseId || uploadStatus !== "idle", className: "gradient-primary rounded-md text-primary-foreground shadow-soft", children: [uploadStatus === "uploading" ? (_jsx(Loader2, { size: 17, className: "animate-spin" })) : uploadStatus === "complete" ? (_jsx(CheckCircle, { size: 17, strokeWidth: 2 })) : (_jsx(Upload, { size: 17, strokeWidth: 1.75 })), uploadStatus === "idle" ? "Upload" : uploadStatus === "complete" ? "Done" : "Uploading…"] })] })] })] }) }));
}
