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
  HardDrive,
  Lock,
  AlertTriangle,
  Loader2,
  Search,
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
import { useAuth } from "@/lib/auth";
import { useDocuments, useNasStructure, useRequestAccess, downloadDocument, type DocumentRecord, type NasFolder } from "@/services/documents";
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
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full rounded-lg border p-5 text-left transition-all duration-200 ${
        active
          ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20 shadow-soft"
          : "border-border bg-card shadow-soft hover:-translate-y-0.5 hover:border-primary/30"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-sm bg-primary/10 text-primary">
            <FileText size={22} strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-title font-semibold group-hover:text-primary transition-colors">
              {doc.name}
            </p>
            {doc.caseName ? (
              <p className="truncate text-helper text-muted-foreground">{doc.caseName}</p>
            ) : null}
          </div>
        </div>
        {onToggleFav && (
          <button
            type="button"
            onClick={onToggleFav}
            className={`p-1 transition-colors ${isFav ? "text-amber-500" : "text-muted-foreground/30 hover:text-muted-foreground"}`}
            title={isFav ? "Remove from favourites" : "Add to favourites"}
          >
            <Star size={16} fill={isFav ? "currentColor" : "none"} strokeWidth={1.75} />
          </button>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="num text-caption text-muted-foreground">
          {doc.sizeFormatted ?? doc.size} · {uploadedByName(doc)}
        </span>
        <StatusPill tone={toneForStatus(doc.state)}>{doc.state}</StatusPill>
      </div>
    </button>
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
  const [showNasPanel, setShowNasPanel] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showRequestAccess, setShowRequestAccess] = useState(false);
  const [requestAccessDocId, setRequestAccessDocId] = useState("");
  const [requestAccessReason, setRequestAccessReason] = useState("");
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versionHistoryDocId, setVersionHistoryDocId] = useState("");
  const [versionHistoryDocName, setVersionHistoryDocName] = useState("");
  const [search, setSearch] = useState("");
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

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
  const { data: nasData, isLoading: nasLoading, isError: nasError } = useNasStructure();

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

  const nasFolders: NasFolder[] = nasData?.folders ?? [];

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

  // Toast state for stub actions
  const [toast, setToast] = useState<{ message: string; type: "info" | "success" | "warning" | "error" } | null>(null);
  const showToast = (message: string, type: "info" | "success" | "warning" | "error" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleVersions = (doc: DocumentRecord) => {
    setVersionHistoryDocId(doc._id);
    setVersionHistoryDocName(doc.name);
    setShowVersionHistory(true);
  };

  const handleOpen = async (doc: DocumentRecord) => {
    try {
      await downloadDocument(doc._id);
    } catch (err) {
      showToast(
        err instanceof Error ? `Download failed: ${err.message}` : `Failed to download "${doc.name}"`,
        "error",
      );
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "StillWorks", to: "/" }, { label: "Documents" }]}
        title="Documents"
        subtitle={`${data?.total ?? "—"} files — securely stored on Synology NAS.`}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="rounded-md"
              onClick={() => setShowNasPanel(!showNasPanel)}
            >
              <HardDrive size={17} strokeWidth={1.75} />
              NAS
            </Button>
            <Button className="gradient-primary rounded-md text-primary-foreground shadow-soft transition-transform duration-200 hover:-translate-y-0.5" onClick={() => setShowUploadDialog(true)}>
              <UploadCloud size={17} strokeWidth={2} />
              Upload
            </Button>
          </div>
        }
      />

      {/* NAS folder browser panel */}
      {showNasPanel && (
        <div className="mb-6 rounded-lg border border-border bg-card p-5 shadow-soft">
          <div className="flex items-center gap-2 mb-4">
            <HardDrive size={18} strokeWidth={1.75} className="text-primary" />
            <h3 className="font-semibold">Synology NAS — Folder Browser</h3>
            <span className="text-caption text-muted-foreground">\\DS920\LegalOS</span>
          </div>
          {nasLoading && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-md border border-border bg-muted/30 p-3 animate-pulse">
                  <div className="h-5 w-3/4 bg-muted rounded mb-2" />
                  <div className="h-4 w-1/2 bg-muted rounded" />
                  <div className="h-4 w-1/2 bg-muted rounded" />
                </div>
              ))}
            </div>
          )}
          {nasError && !nasLoading && (
            <div className="text-center py-4 text-destructive text-caption">
              Failed to load NAS structure. Please try again.
            </div>
          )}
          {!nasLoading && !nasError && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {nasFolders.length === 0 ? (
                <div className="col-span-full text-center py-8 text-muted-foreground text-caption">
                  No NAS folders found
                </div>
              ) : (
                nasFolders.map((folder) => (
                  <div key={folder.path} className="rounded-md border border-border bg-muted/30 p-3">
                    <div className="flex items-center gap-2">
                      <FolderOpen size={16} className="shrink-0 text-warning" />
                      <span className="truncate text-helper font-medium">{folder.name}</span>
                    </div>
                    {folder.children && folder.children.length > 0 && (
                      <ul className="mt-2 ml-6 space-y-1">
                        {folder.children.map((child) => (
                          <li key={child.path} className="flex items-center gap-1.5">
                            <FolderOpen size={13} className="shrink-0 text-muted-foreground" />
                            <span className="truncate text-caption text-muted-foreground">{child.name}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="num mt-2 text-caption text-muted-foreground">{folder.path}</p>
                  </div>
                ))
              )}
            </div>
          )}
          <p className="mt-3 flex items-center gap-1.5 text-caption text-muted-foreground">
            <Lock size={12} /> NAS files are accessed via Electron IPC bridge for local network security.
          </p>
        </div>
      )}

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

          {/* Upload-to-approval flow info */}
          <div className="mt-4 hidden rounded-lg border border-border bg-muted/20 p-4 lg:block">
            <p className="flex items-center gap-1.5 text-helper font-medium">
              <ShieldCheck size={15} className="text-muted-foreground" /> Approval flow
            </p>
            <ol className="mt-2 space-y-2 text-caption text-muted-foreground">
              <li className="flex gap-2">
                <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold">1</span>
                Upload to NAS folder
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold">2</span>
                Document enters "Pending"
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold">3</span>
                Admin reviews & approves
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold">4</span>
                Available to linked case
              </li>
            </ol>
          </div>

          {/* Access requests */}
          <div className="mt-4 hidden rounded-lg border border-border bg-card p-4 lg:block">
            <p className="flex items-center gap-1.5 text-helper font-medium">
              <AlertTriangle size={15} className="text-warning" /> Access requests
            </p>
            <p className="mt-2 text-caption text-muted-foreground">
              Request access to documents outside your assigned cases. Admin approval required.
            </p>
            <Button variant="outline" size="sm" className="mt-3 w-full rounded-md" onClick={() => { setRequestAccessDocId(""); setRequestAccessReason(""); setShowRequestAccess(true); }}>
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
          <div className="mb-6 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-6 py-10 text-center transition-colors hover:border-primary/60">
            <UploadCloud size={26} strokeWidth={1.75} className="mx-auto text-primary" />
            <p className="mt-3 font-medium">Drop files here to upload</p>
            <p className="text-helper text-muted-foreground">
              PDF, DOC, XLSX, images and archives · up to 100 MB per file · Stored on Synology NAS
            </p>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className={grid ? "grid gap-4 sm:grid-cols-2 2xl:grid-cols-3" : "space-y-3"}>
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
            <div className={`${grid ? "grid gap-4 sm:grid-cols-2 2xl:grid-cols-3" : "space-y-3"} stagger-children`}>
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
                <div className="grid h-40 place-items-center rounded-md bg-muted/70">
                  <FileText size={34} strokeWidth={1.5} className="text-muted-foreground" />
                </div>
                <h2 className="mt-4 truncate text-title font-semibold">{previewDoc.name}</h2>
                {previewDoc.caseName && (
                  <p className="truncate text-helper text-muted-foreground">{previewDoc.caseName}</p>
                )}
                <dl className="mt-5 space-y-3 text-helper">
                  {[
                    ["Uploaded by", uploadedByName(previewDoc)],
                    ["Size", previewDoc.size],
                    ["Version", previewDoc.version || 1],
                    ["Folder", previewDoc.nasPath || "—"],
                    ["Updated", formatDate(previewDoc.updatedAt)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="truncate font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-5 flex gap-2">
                  <Button variant="outline" className="flex-1 rounded-md" onClick={() => handleVersions(previewDoc)}>
                    Versions
                  </Button>
                  <Button className="gradient-primary flex-1 rounded-md text-primary-foreground" onClick={() => handleOpen(previewDoc)}>
                    Open
                  </Button>
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
              <div className="grid h-32 place-items-center rounded-md bg-muted/70">
                <FileText size={34} strokeWidth={1.5} className="text-muted-foreground" />
              </div>
              <dl className="space-y-2.5 text-helper">
                {[
                  ["Uploaded by", uploadedByName(previewDoc)],
                  ["Size", previewDoc.size],
                  ["Version", previewDoc.version || 1],
                  ["Folder", previewDoc.nasPath || "—"],
                  ["Updated", formatDate(previewDoc.updatedAt)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-border/50 py-1.5">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="truncate font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-md"
                  onClick={() => {
                    setMobileDrawerOpen(false);
                    handleVersions(previewDoc);
                  }}
                >
                  Versions
                </Button>
                <Button
                  className="gradient-primary flex-1 rounded-md text-primary-foreground"
                  onClick={() => {
                    setMobileDrawerOpen(false);
                    handleOpen(previewDoc);
                  }}
                >
                  Download / Open
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {showUploadDialog && (
        <UploadDocumentDialog open={showUploadDialog} onClose={() => setShowUploadDialog(false)} />
      )}

      {showRequestAccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowRequestAccess(false)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lift">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-title font-semibold">Request Document Access</h2>
              <button onClick={() => setShowRequestAccess(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <p className="text-helper text-muted-foreground mb-4">
              Request access to a document outside your assigned cases. An admin will review and approve.
            </p>
            <div className="space-y-3">
              <select
                value={requestAccessDocId}
                onChange={(e) => setRequestAccessDocId(e.target.value)}
                className="h-11 w-full rounded-md border border-border bg-background px-3 text-helper text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Select document…</option>
                {rawDocs.filter((d) => d.state !== "Approved").map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name} ({d.caseName || "General"})
                  </option>
                ))}
              </select>
              <textarea
                placeholder="Reason for requesting access…"
                value={requestAccessReason}
                onChange={(e) => setRequestAccessReason(e.target.value)}
                className="h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-helper text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowRequestAccess(false)}>Cancel</Button>
              <Button
                className="gradient-primary text-primary-foreground"
                disabled={requestAccess.isPending || !requestAccessDocId || !requestAccessReason.trim()}
                onClick={() => {
                  if (!requestAccessDocId || !requestAccessReason.trim()) return;
                  requestAccess.mutate(
                    { docId: requestAccessDocId, reason: requestAccessReason.trim() },
                    {
                      onSuccess: () => {
                        setShowRequestAccess(false);
                        setRequestAccessDocId("");
                        setRequestAccessReason("");
                      },
                    },
                  );
                }}
              >
                {requestAccess.isPending ? "Requesting…" : "Submit Request"}
              </Button>
            </div>
            {requestAccess.isError && <p className="mt-2 text-caption text-destructive">Failed to submit request. Please try again.</p>}
          </div>
        </div>
      )}

      {showVersionHistory && (
        <VersionHistoryDialog
          open={showVersionHistory}
          onClose={() => setShowVersionHistory(false)}
          documentId={versionHistoryDocId}
          documentName={versionHistoryDocName}
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
    </div>
  );
}
