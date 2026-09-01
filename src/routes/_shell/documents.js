import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { UploadCloud, Clock3, Star, Briefcase, Share2, ShieldCheck, LayoutGrid, List, FileText, FolderOpen, HardDrive, Lock, AlertTriangle, Search, } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusPill, toneForStatus } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { useDocuments, useNasStructure, useRequestAccess, downloadDocument } from "@/services/documents";
import { UploadDocumentDialog } from "@/components/documents/UploadDocumentDialog";
import { VersionHistoryDialog } from "@/components/documents/VersionHistoryDialog";
export const Route = createFileRoute("/_shell/documents")({
    head: () => ({
        meta: [
            { title: "Documents · StillWorks LegalOS" },
            {
                name: "description",
                content: "A Finder-calm document library with previews, approvals and version history.",
            },
            { property: "og:title", content: "Documents · StillWorks LegalOS" },
            {
                property: "og:description",
                content: "Document library with previews, approvals and version history.",
            },
        ],
    }),
    component: DocumentsPage,
});
const SHELVES = [
    { key: "recent", label: "Recent", icon: Clock3 },
    { key: "favourites", label: "Favourites", icon: Star },
    { key: "cases", label: "Assigned cases", icon: Briefcase },
    { key: "shared", label: "Shared with me", icon: Share2 },
    { key: "approvals", label: "Pending approval", icon: ShieldCheck },
];
function formatDate(iso) {
    return new Date(iso).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}
/** `uploadedBy` may be a populated `{ _id, name }` object (from `.populate`) or a raw id string. */
function uploadedByName(doc) {
    const by = doc.uploadedBy;
    if (!by)
        return "Unknown";
    return typeof by === "string" ? by : by.name ?? "Unknown";
}
function DocumentCard({ doc, active, onClick }) {
    return (_jsxs("button", { onClick: onClick, className: `lift card-hover pressable w-full rounded-lg border bg-card p-5 text-left shadow-soft transition-colors ${active ? "border-primary/50 ring-1 ring-primary/20" : "border-border"}`, children: [_jsxs("div", { className: "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3", children: [_jsx("span", { className: "num grid size-11 shrink-0 place-items-center rounded-sm bg-muted text-caption font-semibold text-muted-foreground", children: doc.kind }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "truncate font-medium", children: doc.name }), _jsx("p", { className: "truncate text-caption text-muted-foreground", children: doc.caseName || doc.nasFolder || "—" })] })] }), _jsxs("div", { className: "mt-4 flex items-center justify-between gap-3", children: [_jsxs("span", { className: "num text-caption text-muted-foreground", children: [doc.size, " \u00B7 ", uploadedByName(doc)] }), _jsx(StatusPill, { tone: toneForStatus(doc.state), children: doc.state })] })] }));
}
function DocumentsPage() {
    const [grid, setGrid] = useState(true);
    const [activeShelf, setActiveShelf] = useState("recent");
    const [showNasPanel, setShowNasPanel] = useState(false);
    const [showUploadDialog, setShowUploadDialog] = useState(false);
    const [showRequestAccess, setShowRequestAccess] = useState(false);
    const [requestAccessDocId, setRequestAccessDocId] = useState("");
    const [requestAccessReason, setRequestAccessReason] = useState("");
    const [showVersionHistory, setShowVersionHistory] = useState(false);
    const [versionHistoryDocId, setVersionHistoryDocId] = useState("");
    const [versionHistoryDocName, setVersionHistoryDocName] = useState("");
    const [search, setSearch] = useState("");
    const requestAccess = useRequestAccess();
    const { data, isLoading, isError, error } = useDocuments();
    const { data: nasData, isLoading: nasLoading, isError: nasError } = useNasStructure();
    const documents = data?.documents ?? [];
    const filtered = search.trim()
        ? documents.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()))
        : documents;
    const nasFolders = nasData?.folders ?? [];
    // Select first doc as default preview
    const [selected, setSelected] = useState(null);
    const previewDoc = selected ?? filtered[0] ?? null;
    // Toast state for stub actions
    const [toast, setToast] = useState(null);
    const showToast = (message, type = "info") => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };
    const handleVersions = (doc) => {
        setVersionHistoryDocId(doc._id);
        setVersionHistoryDocName(doc.name);
        setShowVersionHistory(true);
    };
    const handleOpen = async (doc) => {
        try {
            await downloadDocument(doc._id);
        }
        catch (err) {
            showToast(err instanceof Error ? `Download failed: ${err.message}` : `Failed to download "${doc.name}"`, "error");
        }
    };
    return (_jsxs("div", { children: [_jsx(PageHeader, { breadcrumb: [{ label: "StillWorks", to: "/" }, { label: "Documents" }], title: "Documents", subtitle: `${data?.total ?? "—"} files — securely stored on Synology NAS.`, actions: _jsxs("div", { className: "flex gap-2", children: [_jsxs(Button, { variant: "outline", className: "rounded-md", onClick: () => setShowNasPanel(!showNasPanel), children: [_jsx(HardDrive, { size: 17, strokeWidth: 1.75 }), "NAS"] }), _jsxs(Button, { className: "gradient-primary rounded-md text-primary-foreground shadow-soft transition-transform duration-200 hover:-translate-y-0.5", onClick: () => setShowUploadDialog(true), children: [_jsx(UploadCloud, { size: 17, strokeWidth: 2 }), "Upload"] })] }) }), showNasPanel && (_jsxs("div", { className: "mb-6 rounded-lg border border-border bg-card p-5 shadow-soft", children: [_jsxs("div", { className: "flex items-center gap-2 mb-4", children: [_jsx(HardDrive, { size: 18, strokeWidth: 1.75, className: "text-primary" }), _jsx("h3", { className: "font-semibold", children: "Synology NAS \u2014 Folder Browser" }), _jsx("span", { className: "text-caption text-muted-foreground", children: "\\\\DS920\\LegalOS" })] }), nasLoading && (_jsx("div", { className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-4", children: Array.from({ length: 4 }).map((_, i) => (_jsxs("div", { className: "rounded-md border border-border bg-muted/30 p-3 animate-pulse", children: [_jsx("div", { className: "h-5 w-3/4 bg-muted rounded mb-2" }), _jsx("div", { className: "h-4 w-1/2 bg-muted rounded" }), _jsx("div", { className: "h-4 w-1/2 bg-muted rounded" })] }, i))) })), nasError && !nasLoading && (_jsx("div", { className: "text-center py-4 text-destructive text-caption", children: "Failed to load NAS structure. Please try again." })), !nasLoading && !nasError && (_jsx("div", { className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-4", children: nasFolders.length === 0 ? (_jsx("div", { className: "col-span-full text-center py-8 text-muted-foreground text-caption", children: "No NAS folders found" })) : (nasFolders.map((folder) => (_jsxs("div", { className: "rounded-md border border-border bg-muted/30 p-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(FolderOpen, { size: 16, className: "shrink-0 text-warning" }), _jsx("span", { className: "truncate text-helper font-medium", children: folder.name })] }), folder.children && folder.children.length > 0 && (_jsx("ul", { className: "mt-2 ml-6 space-y-1", children: folder.children.map((child) => (_jsxs("li", { className: "flex items-center gap-1.5", children: [_jsx(FolderOpen, { size: 13, className: "shrink-0 text-muted-foreground" }), _jsx("span", { className: "truncate text-caption text-muted-foreground", children: child.name })] }, child.path))) })), _jsx("p", { className: "num mt-2 text-caption text-muted-foreground", children: folder.path })] }, folder.path)))) })), _jsxs("p", { className: "mt-3 flex items-center gap-1.5 text-caption text-muted-foreground", children: [_jsx(Lock, { size: 12 }), " NAS files are accessed via Electron IPC bridge for local network security."] })] })), _jsxs("label", { className: "mb-6 flex items-center gap-3 rounded-pill border border-border bg-card px-4 py-2.5 shadow-soft", children: [_jsx(Search, { size: 18, strokeWidth: 1.75, className: "shrink-0 text-muted-foreground" }), _jsx("input", { type: "search", "aria-label": "Search documents", placeholder: "Search by filename, case or folder\u2026", value: search, onChange: (e) => setSearch(e.target.value), className: "min-w-0 flex-1 bg-transparent text-helper outline-none" })] }), _jsxs("div", { className: "grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_300px]", children: [_jsxs("nav", { "aria-label": "Library", className: "lg:sticky lg:top-28 lg:self-start", children: [_jsx("ul", { className: "flex gap-1 overflow-x-auto rounded-lg border border-border bg-card p-2 shadow-soft lg:flex-col lg:overflow-visible", children: SHELVES.map((s) => (_jsx("li", { className: "shrink-0 lg:shrink", children: _jsxs("button", { onClick: () => setActiveShelf(s.key), className: `flex min-h-11 w-full items-center gap-2.5 rounded-sm px-3 text-helper font-medium transition-colors duration-150 ${activeShelf === s.key
                                            ? "bg-primary/10 text-primary"
                                            : "text-muted-foreground hover:bg-accent hover:text-foreground"}`, children: [_jsx(s.icon, { size: 18, strokeWidth: 1.75 }), s.label] }) }, s.key))) }), _jsxs("div", { className: "mt-4 hidden rounded-lg border border-border bg-muted/20 p-4 lg:block", children: [_jsxs("p", { className: "flex items-center gap-1.5 text-helper font-medium", children: [_jsx(ShieldCheck, { size: 15, className: "text-muted-foreground" }), " Approval flow"] }), _jsxs("ol", { className: "mt-2 space-y-2 text-caption text-muted-foreground", children: [_jsxs("li", { className: "flex gap-2", children: [_jsx("span", { className: "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold", children: "1" }), "Upload to NAS folder"] }), _jsxs("li", { className: "flex gap-2", children: [_jsx("span", { className: "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold", children: "2" }), "Document enters \"Pending\""] }), _jsxs("li", { className: "flex gap-2", children: [_jsx("span", { className: "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold", children: "3" }), "Admin reviews & approves"] }), _jsxs("li", { className: "flex gap-2", children: [_jsx("span", { className: "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold", children: "4" }), "Available to linked case"] })] })] }), _jsxs("div", { className: "mt-4 hidden rounded-lg border border-border bg-card p-4 lg:block", children: [_jsxs("p", { className: "flex items-center gap-1.5 text-helper font-medium", children: [_jsx(AlertTriangle, { size: 15, className: "text-warning" }), " Access requests"] }), _jsx("p", { className: "mt-2 text-caption text-muted-foreground", children: "Request access to documents outside your assigned cases. Admin approval required." }), _jsx(Button, { variant: "outline", size: "sm", className: "mt-3 w-full rounded-md", onClick: () => { setRequestAccessDocId(""); setRequestAccessReason(""); setShowRequestAccess(true); }, children: "Request access" })] })] }), _jsxs("div", { className: "min-w-0", children: [_jsxs("div", { className: "mb-4 flex items-center justify-between gap-3", children: [_jsx("p", { className: "text-helper text-muted-foreground", children: search.trim() ? `${filtered.length} results` : `${documents.length} files` }), _jsxs("div", { className: "inline-flex rounded-pill border border-border bg-card p-1", children: [_jsx("button", { "aria-label": "Grid view", onClick: () => setGrid(true), className: `grid size-9 place-items-center rounded-pill transition-colors duration-150 ${grid ? "gradient-primary text-primary-foreground" : "text-muted-foreground"}`, children: _jsx(LayoutGrid, { size: 17, strokeWidth: 1.75 }) }), _jsx("button", { "aria-label": "List view", onClick: () => setGrid(false), className: `grid size-9 place-items-center rounded-pill transition-colors duration-150 ${!grid ? "gradient-primary text-primary-foreground" : "text-muted-foreground"}`, children: _jsx(List, { size: 17, strokeWidth: 1.75 }) })] })] }), _jsxs("div", { className: "mb-6 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-6 py-10 text-center transition-colors hover:border-primary/60", children: [_jsx(UploadCloud, { size: 26, strokeWidth: 1.75, className: "mx-auto text-primary" }), _jsx("p", { className: "mt-3 font-medium", children: "Drop files here to upload" }), _jsx("p", { className: "text-helper text-muted-foreground", children: "PDF, DOC, XLSX, images and archives \u00B7 up to 100 MB per file \u00B7 Stored on Synology NAS" })] }), isLoading && (_jsx("div", { className: grid ? "grid gap-4 sm:grid-cols-2 2xl:grid-cols-3" : "space-y-3", children: Array.from({ length: 6 }).map((_, i) => (_jsx("div", { className: "rounded-lg border border-border bg-card p-5", children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "size-11 animate-pulse rounded-sm bg-muted" }), _jsxs("div", { className: "flex-1 space-y-2", children: [_jsx("div", { className: "h-4 w-32 animate-pulse rounded bg-muted" }), _jsx("div", { className: "h-3 w-24 animate-pulse rounded bg-muted" })] })] }) }, i))) })), isError && !isLoading && (_jsxs("div", { className: "rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center", children: [_jsx("p", { className: "font-medium text-destructive", children: "Failed to load documents" }), _jsx("p", { className: "mt-1 text-helper text-muted-foreground", children: error instanceof Error ? error.message : "Could not connect to the server." })] })), !isLoading && !isError && filtered.length === 0 && (_jsxs("div", { className: "rounded-lg border border-border bg-card p-16 text-center shadow-soft", children: [_jsx("p", { className: "text-title font-semibold", children: "No documents" }), _jsx("p", { className: "mt-2 text-helper text-muted-foreground", children: search.trim() ? "No documents match your search." : "Upload your first document to get started." })] })), !isLoading && !isError && filtered.length > 0 && (_jsx("div", { className: `${grid ? "grid gap-4 sm:grid-cols-2 2xl:grid-cols-3" : "space-y-3"} stagger-children`, children: filtered.map((d) => (_jsx(DocumentCard, { doc: d, active: previewDoc?._id === d._id, onClick: () => setSelected(d) }, d._id))) }))] }), _jsx("aside", { className: "hidden xl:sticky xl:top-28 xl:block xl:self-start", children: _jsx("div", { className: "rounded-lg border border-border bg-card p-6 shadow-soft", children: previewDoc ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "grid h-40 place-items-center rounded-md bg-muted/70", children: _jsx(FileText, { size: 34, strokeWidth: 1.5, className: "text-muted-foreground" }) }), _jsx("h2", { className: "mt-4 truncate text-title font-semibold", children: previewDoc.name }), previewDoc.caseName && (_jsx("p", { className: "truncate text-helper text-muted-foreground", children: previewDoc.caseName })), _jsx("dl", { className: "mt-5 space-y-3 text-helper", children: [
                                            ["Uploaded by", uploadedByName(previewDoc)],
                                            ["Size", previewDoc.size],
                                            ["Version", previewDoc.version || 1],
                                            ["Folder", previewDoc.nasPath || "—"],
                                            ["Updated", formatDate(previewDoc.updatedAt)],
                                        ].map(([k, v]) => (_jsxs("div", { className: "flex justify-between gap-3", children: [_jsx("dt", { className: "text-muted-foreground", children: k }), _jsx("dd", { className: "truncate font-medium", children: v })] }, k))) }), _jsxs("div", { className: "mt-5 flex gap-2", children: [_jsx(Button, { variant: "outline", className: "flex-1 rounded-md", onClick: () => handleVersions(previewDoc), children: "Versions" }), _jsx(Button, { className: "gradient-primary flex-1 rounded-md text-primary-foreground", onClick: () => handleOpen(previewDoc), children: "Open" })] })] })) : (_jsxs("div", { className: "py-12 text-center", children: [_jsx(FileText, { size: 34, strokeWidth: 1.5, className: "mx-auto text-muted-foreground/40" }), _jsx("p", { className: "mt-3 text-helper text-muted-foreground", children: "Select a document to preview" })] })) }) })] }), showUploadDialog && (_jsx(UploadDocumentDialog, { open: showUploadDialog, onClose: () => setShowUploadDialog(false) })), showRequestAccess && (_jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center", children: [_jsx("div", { className: "fixed inset-0 bg-background/80 backdrop-blur-sm", onClick: () => setShowRequestAccess(false) }), _jsxs("div", { className: "relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lift", children: [_jsxs("div", { className: "mb-4 flex items-center justify-between", children: [_jsx("h2", { className: "text-title font-semibold", children: "Request Document Access" }), _jsx("button", { onClick: () => setShowRequestAccess(false), className: "text-muted-foreground hover:text-foreground", children: "\u2715" })] }), _jsx("p", { className: "text-helper text-muted-foreground mb-4", children: "Request access to a document outside your assigned cases. An admin will review and approve." }), _jsxs("div", { className: "space-y-3", children: [_jsxs("select", { value: requestAccessDocId, onChange: (e) => setRequestAccessDocId(e.target.value), className: "h-11 w-full rounded-md border border-border bg-background px-3 text-helper text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary", children: [_jsx("option", { value: "", children: "Select document\u2026" }), documents.filter((d) => d.state !== "Approved").map((d) => (_jsxs("option", { value: d._id, children: [d.name, " (", d.caseName || "General", ")"] }, d._id)))] }), _jsx("textarea", { placeholder: "Reason for requesting access\u2026", value: requestAccessReason, onChange: (e) => setRequestAccessReason(e.target.value), className: "h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-helper text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none" })] }), _jsxs("div", { className: "mt-4 flex justify-end gap-2", children: [_jsx(Button, { variant: "outline", onClick: () => setShowRequestAccess(false), children: "Cancel" }), _jsx(Button, { className: "gradient-primary text-primary-foreground", disabled: requestAccess.isPending || !requestAccessDocId || !requestAccessReason.trim(), onClick: () => {
                                            if (!requestAccessDocId || !requestAccessReason.trim())
                                                return;
                                            requestAccess.mutate({ docId: requestAccessDocId, reason: requestAccessReason.trim() }, {
                                                onSuccess: () => {
                                                    setShowRequestAccess(false);
                                                    setRequestAccessDocId("");
                                                    setRequestAccessReason("");
                                                },
                                            });
                                        }, children: requestAccess.isPending ? "Requesting…" : "Submit Request" })] }), requestAccess.isError && _jsx("p", { className: "mt-2 text-caption text-destructive", children: "Failed to submit request. Please try again." })] })] })), showVersionHistory && (_jsx(VersionHistoryDialog, { open: showVersionHistory, onClose: () => setShowVersionHistory(false), documentId: versionHistoryDocId, documentName: versionHistoryDocName })), toast && (_jsx("div", { className: "fixed bottom-4 right-4 z-50 toast-enter", children: _jsxs("div", { className: `rounded-lg border bg-card p-4 shadow-lift flex items-center gap-3 min-w-[280px] max-w-sm toast-enter ${toast.type === "success" ? "border-success/30" :
                        toast.type === "error" ? "border-destructive/30" :
                            toast.type === "warning" ? "border-warning/30" :
                                "border-primary/30"}`, children: [_jsx("span", { className: "flex-1 text-helper", children: toast.message }), _jsx("button", { onClick: () => setToast(null), className: "text-muted-foreground hover:text-foreground", children: "\u2715" })] }) }))] }));
}
