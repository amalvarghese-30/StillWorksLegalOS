import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  UploadCloud,
  Clock3,
  Star,
  Briefcase,
  Share2,
  ShieldCheck,
  LayoutGrid,
  List,
  FileText,
  FolderOpen,
  Lock,
  AlertTriangle,
  Loader2,
  Search,
  Eye,
  Trash2,
  Download,
  KeyRound,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusPill, toneForStatus } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
import { useAuth } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  useDocuments,
  useRequestAccess,
  useRevokeUserAccess,
  downloadDocument,
  useDeleteDocument,
  type DocumentRecord,
} from "@/services/documents";
import { UploadDocumentDialog } from "@/components/documents/UploadDocumentDialog";
import { VersionHistoryDialog } from "@/components/documents/VersionHistoryDialog";
import { DocumentPreviewModal } from "@/components/documents/DocumentPreviewModal";
import { DocumentInlinePreview } from "@/components/documents/DocumentInlinePreview";
import { RequestAccessDialog } from "@/components/documents/RequestAccessDialog";

export const Route = createFileRoute("/_shell/documents")({
  head: () => ({
    meta: [
      { title: "Documents · S & S Legal-Tech LLP" },
      {
        name: "description",
        content: "A Finder-calm document library with previews, approvals and version history.",
      },
      { property: "og:title", content: "Documents · S & S Legal-Tech LLP" },
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
  { key: "court", label: "Court filings", icon: ShieldCheck },
];

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function uploadedByName(doc: DocumentRecord): string {
  if (doc.uploadedByName) return doc.uploadedByName;
  if (typeof doc.uploadedBy === "object" && doc.uploadedBy?.name) return doc.uploadedBy.name;
  return "Colleague";
}

function DocumentCard({
  doc,
  active,
  onClick,
  isFav,
  onToggleFav,
}: {
  doc: DocumentRecord;
  active: boolean;
  onClick: () => void;
  isFav?: boolean;
  onToggleFav?: (e: React.MouseEvent) => void;
}) {
  const caseLabel =
    typeof doc.caseId === "object" && doc.caseId?.number
      ? `${doc.caseId.number} · ${doc.caseId.title || doc.caseName || ""}`
      : doc.caseName;

  const hasAccess = doc.canAccess !== false;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={`group flex flex-col justify-between min-h-[136px] h-auto w-full cursor-pointer rounded-xl border p-3.5 sm:p-4 text-left transition-all duration-200 select-none ${
        active
          ? "border-primary bg-primary/5 ring-1 ring-primary/30 shadow-md"
          : "border-border bg-card shadow-soft hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
      }`}
    >
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            className={`grid size-10 shrink-0 place-items-center rounded-lg ${
              !hasAccess
                ? "bg-destructive/10 text-destructive"
                : "bg-primary/10 text-primary"
            }`}
          >
            {!hasAccess ? (
              <Lock size={19} strokeWidth={1.75} />
            ) : (
              <FileText size={20} strokeWidth={1.75} />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p
                className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors"
                title={doc.name}
              >
                {doc.name}
              </p>
              {!hasAccess && (
                <span className="inline-flex items-center gap-0.5 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold text-destructive">
                  Restricted
                </span>
              )}
            </div>
            {caseLabel ? (
              <p
                className="truncate text-caption text-primary/80 font-medium mt-0.5 flex items-center gap-1"
                title={caseLabel}
              >
                <Briefcase size={12} className="shrink-0" />
                <span className="truncate">{caseLabel}</span>
              </p>
            ) : (
              <p className="truncate text-caption text-muted-foreground mt-0.5">
                General Firm Document
              </p>
            )}
          </div>
        </div>
        {onToggleFav && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFav(e);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                onToggleFav(e as any);
              }
            }}
            className={`shrink-0 p-1 rounded-sm transition-colors ${
              isFav
                ? "text-amber-500"
                : "text-muted-foreground/30 hover:text-muted-foreground hover:bg-muted/50"
            }`}
            title={isFav ? "Remove from favourites" : "Add to favourites"}
          >
            <Star size={16} fill={isFav ? "currentColor" : "none"} strokeWidth={1.75} />
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/40 pt-2.5 min-w-0 text-caption text-muted-foreground">
        <span
          className="truncate"
          title={`Uploaded ${formatDate(doc.createdAt)} by ${uploadedByName(doc)}`}
        >
          {doc.sizeFormatted ?? `${Math.round((doc.size || 0) / 1024)} KB`} · {uploadedByName(doc)}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {doc.authorizedUsers && doc.authorizedUsers.length > 0 && (
            <span
              className="text-[11px] font-medium text-muted-foreground hidden sm:inline"
              title={doc.authorizedUsers.map((u) => u.name).join(", ")}
            >
              {doc.authorizedUsers.length} user{doc.authorizedUsers.length > 1 ? "s" : ""}
            </span>
          )}
          <StatusPill tone={toneForStatus(doc.state)}>{doc.state}</StatusPill>
        </div>
      </div>
    </div>
  );
}

function DocumentsPage() {
  const { user } = useAuth();
  const [grid, setGrid] = useState(true);
  const [activeShelf, setActiveShelf] = useState("recent");
  const [favourites, setFavourites] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("stillworks_fav_docs");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showRequestAccess, setShowRequestAccess] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versionHistoryDocId, setVersionHistoryDocId] = useState("");
  const [versionHistoryDocName, setVersionHistoryDocName] = useState("");
  const [search, setSearch] = useState("");
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [previewModalDoc, setPreviewModalDoc] = useState<DocumentRecord | null>(null);

  const toggleFav = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavourites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem("stillworks_fav_docs", JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const requestAccess = useRequestAccess();
  const { data, isLoading, isError, error } = useDocuments();

  const rawDocs = data?.documents ?? [];

  const filtered = useMemo(() => {
    const shelfDocs = rawDocs.filter((d) => {
      if (activeShelf === "favourites") return favourites.has(d._id);
      if (activeShelf === "cases") return Boolean(d.caseId || d.caseName);
      if (activeShelf === "shared") {
        const uploaderId = typeof d.uploadedBy === "object" ? d.uploadedBy._id : d.uploadedBy;
        return user?._id ? uploaderId !== user._id : true;
      }
      if (activeShelf === "court") {
        const n = (d.name || "").toLowerCase();
        const k = (d.kind || "").toLowerCase();
        return k === "filing" || n.includes("petition") || n.includes("court") || n.includes("affidavit") || n.includes("order") || n.includes("notice");
      }
      return true; // "recent"
    });

    return search.trim()
      ? shelfDocs.filter((d) =>
          d.name.toLowerCase().includes(search.toLowerCase()) ||
          (d.caseName && d.caseName.toLowerCase().includes(search.toLowerCase()))
        )
      : shelfDocs;
  }, [rawDocs, activeShelf, search, favourites, user]);

  // Select first doc as default preview
  const [selected, setSelected] = useState<DocumentRecord | null>(null);
  const previewDoc = selected ?? filtered[0] ?? null;

  const handleDocSelect = (doc: DocumentRecord) => {
    setSelected(doc);
    // On screens < 1280px, open mobile drawer
    if (typeof window !== "undefined" && window.innerWidth < 1280) {
      setMobileDrawerOpen(true);
    }
  };

  const [requestAccessDocId, setRequestAccessDocId] = useState<string | undefined>(undefined);
  const [accessPromptDoc, setAccessPromptDoc] = useState<DocumentRecord | null>(null);
  const revokeUserAccessMutation = useRevokeUserAccess();

  // Toast state for stub actions
  const [toast, setToast] = useState<{ message: string; type: "info" | "success" | "warning" | "error" } | null>(null);
  const showToast = (message: string, type: "info" | "success" | "warning" | "error" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const deleteMutation = useDeleteDocument();
  const [docToDelete, setDocToDelete] = useState<DocumentRecord | null>(null);

  const promptAccessDenied = (doc: DocumentRecord) => {
    setAccessPromptDoc(doc);
  };

  const handleVersions = (doc: DocumentRecord) => {
    setVersionHistoryDocId(doc._id);
    setVersionHistoryDocName(doc.name);
    setShowVersionHistory(true);
  };

  const handleOpen = async (doc: DocumentRecord) => {
    if (doc.canAccess === false) {
      promptAccessDenied(doc);
      return;
    }
    try {
      await downloadDocument(doc._id);
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err || "");
      if (err?.status === 403 || msg.toLowerCase().includes("access") || msg.toLowerCase().includes("denied")) {
        promptAccessDenied(doc);
      } else {
        showToast(
          err instanceof Error ? `Download failed: ${err.message}` : `Failed to download "${doc.name}"`,
          "error",
        );
      }
    }
  };

  const handleView = (doc: DocumentRecord) => {
    if (doc.canAccess === false) {
      promptAccessDenied(doc);
      return;
    }
    setPreviewModalDoc(doc);
  };

  const handleRevokeUser = async (docId: string, userId: string, userName: string) => {
    try {
      await revokeUserAccessMutation.mutateAsync({
        docId,
        userId,
        reason: "Access revoked by firm administrator",
      });
      showToast(`Access revoked for ${userName}`, "success");
    } catch (err: any) {
      showToast(err?.message || "Failed to revoke access", "error");
    }
  };

  const confirmDelete = async () => {
    if (!docToDelete) return;
    try {
      await deleteMutation.mutateAsync(docToDelete._id);
      showToast(`Document "${docToDelete.name}" deleted successfully`, "success");
      setDocToDelete(null);
      if (selected?._id === docToDelete._id) setSelected(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete document", "error");
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "S & S", to: "/" }, { label: "Documents" }]}
        title="Documents"
        subtitle={`${data?.total ?? "—"} files — securely stored in LegalOS VPS storage.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="rounded-md border-border bg-card shadow-soft hover:bg-muted"
              onClick={() => setShowRequestAccess(true)}
            >
              <KeyRound size={16} strokeWidth={2} />
              Request access
            </Button>
            <Button
              className="gradient-primary rounded-md text-primary-foreground shadow-soft transition-transform duration-200 hover:-translate-y-0.5"
              onClick={() => setShowUploadDialog(true)}
            >
              <UploadCloud size={17} strokeWidth={2} />
              Upload
            </Button>
          </div>
        }
      />

      {/* Search */}
      <label className="mb-6 flex items-center gap-3 rounded-pill border border-border bg-card px-4 py-2.5 shadow-soft">
        <Search size={18} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
        <input
          type="search"
          aria-label="Search documents"
          placeholder="Search by filename, case or folder…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-helper outline-none"
        />
      </label>

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_300px]">
        {/* Left: Shelves nav */}
        <nav aria-label="Library" className="lg:sticky lg:top-28 lg:self-start">
          <ul className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-card p-2 shadow-soft lg:flex-col lg:overflow-visible">
            {SHELVES.map((s) => (
              <li key={s.key} className="shrink-0 lg:shrink">
                <button
                  onClick={() => setActiveShelf(s.key)}
                  className={`flex min-h-11 w-full items-center gap-2.5 rounded-sm px-3 text-helper font-medium transition-colors duration-150 ${
                    activeShelf === s.key
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <s.icon size={18} strokeWidth={1.75} />
                  {s.label}
                </button>
              </li>
            ))}
          </ul>

          {/* Access requests */}
          <div className="mt-4 hidden rounded-lg border border-border bg-card p-4 shadow-soft lg:block">
            <p className="flex items-center gap-1.5 text-helper font-semibold">
              <KeyRound size={15} className="text-warning" /> Access requests
            </p>
            <p className="mt-2 text-caption text-muted-foreground leading-relaxed">
              Request access to cases and documents outside your assigned permissions. Admin approval required.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3.5 w-full rounded-md font-medium hover:bg-muted"
              onClick={() => setShowRequestAccess(true)}
            >
              <KeyRound size={14} className="mr-1.5" />
              Request access
            </Button>
          </div>
        </nav>

        {/* Center: Document grid */}
        <div className="min-w-0">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-helper text-muted-foreground">
              {search.trim() ? `${filtered.length} results` : `${rawDocs.length} files`}
            </p>
            <div className="inline-flex rounded-pill border border-border bg-card p-1">
              <button
                aria-label="Grid view"
                onClick={() => setGrid(true)}
                className={`grid size-9 place-items-center rounded-pill transition-colors duration-150 ${
                  grid ? "gradient-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                <LayoutGrid size={17} strokeWidth={1.75} />
              </button>
              <button
                aria-label="List view"
                onClick={() => setGrid(false)}
                className={`grid size-9 place-items-center rounded-pill transition-colors duration-150 ${
                  !grid ? "gradient-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                <List size={17} strokeWidth={1.75} />
              </button>
            </div>
          </div>

          {/* Upload drop zone */}
          <div
            onClick={() => setShowUploadDialog(true)}
            className="mb-6 cursor-pointer rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-6 sm:px-6 sm:py-8 text-center transition-all duration-200 hover:border-primary hover:bg-primary/10"
          >
            <UploadCloud size={28} strokeWidth={1.75} className="mx-auto text-primary" />
            <p className="mt-2.5 font-medium text-foreground text-sm sm:text-base">Drop files here to upload</p>
            <p className="mt-1 text-caption sm:text-helper text-muted-foreground max-w-md mx-auto">
              PDF, DOC, XLSX, images and archives · up to 100 MB per file · Stored securely on LegalOS VPS storage
            </p>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className={grid ? "grid gap-4 sm:grid-cols-2" : "space-y-3"}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-border bg-card p-5">
                  <div className="flex items-center gap-3">
                    <div className="size-11 animate-pulse rounded-sm bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {isError && !isLoading && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
              <p className="font-medium text-destructive">Failed to load documents</p>
              <p className="mt-1 text-helper text-muted-foreground">
                {error instanceof Error ? error.message : "Could not connect to the server."}
              </p>
            </div>
          )}

          {/* Empty */}
          {!isLoading && !isError && filtered.length === 0 && (
            <div className="rounded-lg border border-border bg-card p-16 text-center shadow-soft">
              <p className="text-title font-semibold">No documents</p>
              <p className="mt-2 text-helper text-muted-foreground">
                {search.trim() ? "No documents match your search." : "Upload your first document to get started."}
              </p>
            </div>
          )}

          {/* Data */}
          {!isLoading && !isError && filtered.length > 0 && (
            <div className={`${grid ? "grid gap-4 sm:grid-cols-2" : "space-y-3"} stagger-children`}>
              {filtered.map((d) => (
                <DocumentCard
                  key={d._id}
                  doc={d}
                  active={previewDoc?._id === d._id}
                  onClick={() => handleDocSelect(d)}
                  isFav={favourites.has(d._id)}
                  onToggleFav={(e) => toggleFav(d._id, e)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: Desktop Preview panel */}
        <aside className="hidden xl:sticky xl:top-28 xl:block xl:self-start">
          <div className="rounded-lg border border-border bg-card p-6 shadow-soft">
            {previewDoc ? (
              <>
                <DocumentInlinePreview
                  documentId={previewDoc._id}
                  documentName={previewDoc.name}
                  mimeType={previewDoc.mimeType}
                  className="h-44 w-full shadow-inner"
                  onExpand={() => handleView(previewDoc)}
                />
                {/* Access Restriction Warning Banner */}
                {previewDoc.canAccess === false && (
                  <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <Lock size={15} />
                      <span>Access Restricted</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                      You don't have access to this document. Kindly ask for access request.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2.5 h-7 w-full text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        setRequestAccessDocId(previewDoc._id);
                        setShowRequestAccess(true);
                      }}
                    >
                      <KeyRound size={13} className="mr-1" />
                      Request Access
                    </Button>
                  </div>
                )}

                <h2 className="truncate text-title font-semibold">{previewDoc.name}</h2>
                {previewDoc.caseName && (
                  <p className="truncate text-helper text-primary/90 font-medium flex items-center gap-1.5 mt-0.5">
                    <Briefcase size={14} className="shrink-0" />
                    <span>{previewDoc.caseName}</span>
                  </p>
                )}
                <dl className="mt-4 space-y-2.5 text-helper">
                  {[
                    ["Case", previewDoc.caseName ? previewDoc.caseName : "General Firm Storage"],
                    ["Uploaded by", uploadedByName(previewDoc)],
                    ["Uploaded on", formatDate(previewDoc.createdAt)],
                    ["Size", previewDoc.sizeFormatted ?? previewDoc.size],
                    ["Version", `v${previewDoc.version || 1}`],
                    ["Access status", previewDoc.canAccess === false ? "Restricted" : "Approved"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="truncate font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>

                {/* Who has access list */}
                {previewDoc.authorizedUsers && previewDoc.authorizedUsers.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-border/50">
                    <p className="text-xs font-semibold text-foreground flex items-center justify-between mb-2">
                      <span>Who Has Access ({previewDoc.authorizedUsers.length})</span>
                      <ShieldCheck size={14} className="text-primary" />
                    </p>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                      {previewDoc.authorizedUsers.map((u) => (
                        <div key={u.id} className="flex items-center justify-between text-xs rounded-md bg-muted/40 px-2.5 py-1.5">
                          <span className="truncate font-medium text-foreground">{u.name}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] text-muted-foreground font-mono">{u.role || "User"}</span>
                            {user?.role === "admin" && (
                              <button
                                type="button"
                                onClick={() => handleRevokeUser(previewDoc._id, u.id, u.name)}
                                className="text-[10px] text-destructive hover:underline ml-1 font-semibold"
                                title={`Revoke ${u.name}'s access`}
                              >
                                Revoke
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-5 flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 rounded-md" onClick={() => handleView(previewDoc)}>
                      <Eye size={15} className="mr-1.5" />
                      Preview
                    </Button>
                    <Button className="gradient-primary flex-1 rounded-md text-primary-foreground" onClick={() => handleOpen(previewDoc)}>
                      <Download size={15} className="mr-1.5" />
                      Download
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 rounded-md" onClick={() => handleVersions(previewDoc)}>
                      Versions
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-md text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setDocToDelete(previewDoc)}
                    >
                      <Trash2 size={15} className="mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-12 text-center">
                <FileText size={34} strokeWidth={1.5} className="mx-auto text-muted-foreground/40" />
                <p className="mt-3 text-helper text-muted-foreground">Select a document to preview</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Mobile/Tablet Document Inspector Sheet */}
      <Sheet open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-xl p-6 xl:hidden">
          <SheetHeader className="text-left">
            <SheetTitle className="truncate text-title font-semibold">
              {previewDoc?.name ?? "Document Details"}
            </SheetTitle>
            {previewDoc?.caseName && (
              <SheetDescription className="truncate text-helper text-muted-foreground">
                {previewDoc.caseName}
              </SheetDescription>
            )}
          </SheetHeader>
          {previewDoc && (
            <div className="mt-4 space-y-4">
              <DocumentInlinePreview
                documentId={previewDoc._id}
                documentName={previewDoc.name}
                mimeType={previewDoc.mimeType}
                className="h-44 w-full shadow-inner"
                onExpand={() => {
                  setMobileDrawerOpen(false);
                  handleView(previewDoc);
                }}
              />

              {previewDoc.canAccess === false && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <Lock size={14} />
                    <span>Access Restricted</span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                    You don't have access to this document. Kindly ask for access request.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2.5 h-7 w-full text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      setMobileDrawerOpen(false);
                      setRequestAccessDocId(previewDoc._id);
                      setShowRequestAccess(true);
                    }}
                  >
                    <KeyRound size={13} className="mr-1" />
                    Request Access
                  </Button>
                </div>
              )}

              <dl className="space-y-2.5 text-helper">
                {[
                  ["Case", previewDoc.caseName ? previewDoc.caseName : "General Storage"],
                  ["Uploaded by", uploadedByName(previewDoc)],
                  ["Uploaded on", formatDate(previewDoc.createdAt)],
                  ["Size", previewDoc.sizeFormatted ?? previewDoc.size],
                  ["Version", `v${previewDoc.version || 1}`],
                  ["Access status", previewDoc.canAccess === false ? "Restricted" : "Approved"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-border/50 py-1.5">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="truncate font-medium">{v}</dd>
                  </div>
                ))}
              </dl>

              {previewDoc.authorizedUsers && previewDoc.authorizedUsers.length > 0 && (
                <div className="pt-2 border-t border-border/50">
                  <p className="text-xs font-semibold text-foreground flex items-center justify-between mb-2">
                    <span>Who Has Access ({previewDoc.authorizedUsers.length})</span>
                    <ShieldCheck size={14} className="text-primary" />
                  </p>
                  <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                    {previewDoc.authorizedUsers.map((u) => (
                      <div key={u.id} className="flex items-center justify-between text-xs rounded-md bg-muted/40 px-2 py-1">
                        <span className="truncate font-medium text-foreground">{u.name}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] text-muted-foreground font-mono">{u.role || "User"}</span>
                          {user?.role === "admin" && (
                            <button
                              type="button"
                              onClick={() => handleRevokeUser(previewDoc._id, u.id, u.name)}
                              className="text-[10px] text-destructive hover:underline ml-1 font-semibold"
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-2 pt-2">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 rounded-md"
                    onClick={() => {
                      setMobileDrawerOpen(false);
                      handleView(previewDoc);
                    }}
                  >
                    <Eye size={15} className="mr-1.5" />
                    Preview
                  </Button>
                  <Button
                    className="gradient-primary flex-1 rounded-md text-primary-foreground"
                    onClick={() => {
                      setMobileDrawerOpen(false);
                      handleOpen(previewDoc);
                    }}
                  >
                    <Download size={15} className="mr-1.5" />
                    Download
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 rounded-md"
                    onClick={() => {
                      setMobileDrawerOpen(false);
                      handleVersions(previewDoc);
                    }}
                  >
                    Versions
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-md text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => {
                      setMobileDrawerOpen(false);
                      setDocToDelete(previewDoc);
                    }}
                  >
                    <Trash2 size={15} className="mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {showUploadDialog && (
        <UploadDocumentDialog open={showUploadDialog} onClose={() => setShowUploadDialog(false)} />
      )}

      {showRequestAccess && (
        <RequestAccessDialog
          open={showRequestAccess}
          onClose={() => {
            setShowRequestAccess(false);
            setRequestAccessDocId(undefined);
          }}
          initialDocId={requestAccessDocId}
        />
      )}

      {/* Access Denied / Revoked Prompt Dialog */}
      <Dialog open={!!accessPromptDoc} onOpenChange={(open) => !open && setAccessPromptDoc(null)}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-destructive/10 text-destructive">
                <Lock size={22} />
              </span>
              <div>
                <DialogTitle className="text-lg font-bold">Access Restricted</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Confidential Document Protection
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3.5 text-xs text-foreground">
              <p className="font-semibold text-sm mb-1 text-foreground">{accessPromptDoc?.name}</p>
              <p className="text-muted-foreground leading-relaxed">
                You don’t have access to this document. Kindly ask for access request.
              </p>
            </div>
            {accessPromptDoc?.caseName && (
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Briefcase size={13} className="text-primary" />
                <span>Matter: <strong className="text-foreground">{accessPromptDoc.caseName}</strong></span>
              </div>
            )}
            {accessPromptDoc?.authorizedUsers && accessPromptDoc.authorizedUsers.length > 0 && (
              <div className="text-xs">
                <p className="font-medium text-muted-foreground mb-1.5">Document Custodians:</p>
                <div className="flex flex-wrap gap-1.5">
                  {accessPromptDoc.authorizedUsers.map((u) => (
                    <span key={u.id} className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                      {u.name} ({u.role || "Authorized"})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="mt-6 flex gap-2">
            <Button variant="outline" onClick={() => setAccessPromptDoc(null)}>
              Cancel
            </Button>
            <Button
              className="gradient-primary text-primary-foreground"
              onClick={() => {
                const targetDocId = accessPromptDoc?._id;
                setAccessPromptDoc(null);
                setRequestAccessDocId(targetDocId);
                setShowRequestAccess(true);
              }}
            >
              <KeyRound size={15} className="mr-1.5" />
              Request Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showVersionHistory && (
        <VersionHistoryDialog
          open={showVersionHistory}
          onClose={() => setShowVersionHistory(false)}
          documentId={versionHistoryDocId}
          documentName={versionHistoryDocName}
        />
      )}

      {previewModalDoc && (
        <DocumentPreviewModal
          open={!!previewModalDoc}
          onClose={() => setPreviewModalDoc(null)}
          documentId={previewModalDoc._id}
          documentName={previewModalDoc.name}
          documentMimeType={previewModalDoc.mimeType}
          documentSize={previewModalDoc.sizeFormatted ?? previewModalDoc.size}
        />
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 toast-enter">
          <div className={`rounded-lg border bg-card p-4 shadow-lift flex items-center gap-3 min-w-[280px] max-w-sm toast-enter ${
            toast.type === "success" ? "border-success/30" :
            toast.type === "error" ? "border-destructive/30" :
            toast.type === "warning" ? "border-warning/30" :
            "border-primary/30"
          }`}>
            <span className="flex-1 text-helper">{toast.message}</span>
            <button onClick={() => setToast(null)} className="text-muted-foreground hover:text-foreground">✕</button>
          </div>
        </div>
      )}

      {/* Delete document confirmation */}
      <AlertDialog open={!!docToDelete} onOpenChange={(open) => !open && setDocToDelete(null)}>
        <AlertDialogContent className="rounded-xl border border-border bg-card p-6 shadow-lift max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-title font-semibold text-destructive flex items-center gap-2">
              <Trash2 size={18} />
              Delete Document
            </AlertDialogTitle>
            <AlertDialogDescription className="text-helper text-muted-foreground mt-2">
              Are you sure you want to delete <span className="font-semibold text-foreground">"{docToDelete?.name}"</span>?
              This action permanently deletes the file from VPS disk storage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-5 flex justify-end gap-2">
            <AlertDialogCancel className="rounded-md">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete Document"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
