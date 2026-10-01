import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useRef } from "react";
import {
  LayoutDashboard, FileBadge, Home, Users, Briefcase, Plus,
  Phone, Mail, MapPin, Loader2, Edit3, ChevronDown,
  Send, Check, X, UserPlus, Building2, FileText, Trash2, Archive,
  Download, Eye, RefreshCw, ExternalLink,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/common/Surface";
import { StatusPill, toneForStatus } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  useClient, useUpdateClient, useDeleteClient,
  useClientCases, useClientDocuments,
  type ClientRecord,
} from "@/services/clients";
import { EditClientDialog } from "@/components/clients/EditClientDialog";
import { AddCaseDialog } from "@/components/cases/AddCaseDialog";
import { downloadDocument } from "@/services/documents";
import { DocumentPreviewModal } from "@/components/documents/DocumentPreviewModal";
import type { ClientDocument } from "@/services/clients";
import { formatSafeDate } from "@/lib/dates";

export const Route = createFileRoute("/_shell/clients/$clientId")({
  head: () => ({
    meta: [
      { title: "Client profile · S & S Legal-Tech LLP" },
      { name: "description", content: "Client details, Identity Verification, property, and sub-client records." },
      { property: "og:title", content: "Client profile · S & S Legal-Tech LLP" },
      { property: "og:description", content: "Client details, Identity Verification, property, and sub-client records." },
    ],
  }),
  component: ClientProfile,
});

const sections = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "cases", label: "Cases", icon: Briefcase },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "kyc", label: "Identity Verification", icon: FileBadge },
  { id: "property", label: "Property", icon: Home },
  { id: "subclients", label: "Sub-clients", icon: Users },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null | undefined): string {
  return formatSafeDate(iso, "—", { day: "numeric", month: "short", year: "numeric" });
}

const kycTone: Record<string, string> = { Verified: "success", Pending: "warning", Rejected: "destructive" };

const tagTone: Record<string, string> = { Active: "success", VIP: "primary", Corporate: "indigo", Individual: "muted", Archived: "muted" };

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Inline editor for client tag and type */
function QuickEditDropdown({ record }: { record: ClientRecord }) {
  const [open, setOpen] = useState(false);
  const updateClient = useUpdateClient();

  const tags = ["Active", "VIP", "Corporate", "Individual", "Archived"] as const;
  const types = ["Individual", "Corporate"] as const;

  return (
    <div className="relative">
      <Button variant="outline" size="sm" className="rounded-md" onClick={() => setOpen(!open)}>
        <Edit3 size={14} strokeWidth={1.75} />
        Edit
        <ChevronDown size={14} strokeWidth={1.75} />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-64 rounded-lg border border-border bg-card p-3 shadow-lift">
            {/* Tag */}
            <p className="mb-2 text-caption font-semibold text-muted-foreground">Tag</p>
            <div className="mb-3 flex gap-1 flex-wrap">
              {tags.map((t) => (
                <button
                  key={t}
                  onClick={() => { updateClient.mutate({ id: record._id, data: { tag: t } }); setOpen(false); }}
                  disabled={updateClient.isPending}
                  className={`rounded-sm px-2 py-1.5 text-caption font-medium transition-colors ${
                    record.tag === t ? "bg-primary/15 text-primary ring-1 ring-primary/30" : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Type */}
            <p className="mb-2 text-caption font-semibold text-muted-foreground">Type</p>
            <div className="flex gap-1">
              {types.map((t) => (
                <button
                  key={t}
                  onClick={() => { updateClient.mutate({ id: record._id, data: { type: t } }); setOpen(false); }}
                  disabled={updateClient.isPending}
                  className={`flex-1 rounded-sm px-2 py-1.5 text-caption font-medium transition-colors ${
                    record.type === t ? "bg-primary/15 text-primary ring-1 ring-primary/30" : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

function ClientProfile() {
  const { clientId } = Route.useParams();
  const { data, isLoading, isError } = useClient(clientId);
  const [active, setActive] = useState("overview");

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Loader2 size={32} className="mx-auto animate-spin text-muted-foreground" />
          <p className="mt-4 text-helper text-muted-foreground">Loading client profile…</p>
        </div>
      </div>
    );
  }

  const navigate = useNavigate();
  const deleteClient = useDeleteClient();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddCaseDialog, setShowAddCaseDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<ClientDocument | null>(null);

  const {
    data: casesData,
    isLoading: isCasesLoading,
    isError: isCasesError,
    refetch: refetchCases,
  } = useClientCases(clientId);

  const {
    data: docsData,
    isLoading: isDocsLoading,
    isError: isDocsError,
    refetch: refetchDocs,
  } = useClientDocuments(clientId);

  const handleDeleteClient = async () => {
    setIsDeleting(true);
    try {
      await deleteClient.mutateAsync(clientId);
      navigate({ to: "/clients" });
    } catch (err) {
      console.error("Failed to delete client:", err);
      setIsDeleting(false);
    }
  };

  if (isError || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-sm text-center">
          <h2 className="text-xl font-semibold">Client not found</h2>
          <p className="mt-2 text-helper text-muted-foreground">This client may have been deleted or you don't have access to it.</p>
        </div>
      </div>
    );
  }

  const record = data.client;
  const hasProperty = record.propertyDetails?.address;

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "S & S", to: "/" },
          { label: "Clients", to: "/clients" },
          { label: record.name },
        ]}
        title={record.name}
        subtitle={`${record.type} · ${record.tag} · Verification: ${record.kyc}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" className="rounded-md" onClick={() => setShowEditDialog(true)}>
              <Edit3 size={15} strokeWidth={1.75} />
              Edit Client
            </Button>
            <Button
              variant="outline"
              className="rounded-md text-amber-600 hover:bg-amber-500/10 hover:text-amber-700 hover:border-amber-500/30"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Archive size={15} strokeWidth={1.75} />
              Archive Client
            </Button>
          </div>
        }
      />

      {/* Hero card */}
      <div className="gradient-primary mb-6 rounded-lg p-6 text-primary-foreground shadow-lift">
        <div className="grid gap-6 md:grid-cols-4">
          {[
            ["Type", record.type],
            ["Tag", record.tag],
            ["Verification Status", record.kyc],
            ["Created", formatDate(record.createdAt)],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <p className="text-caption opacity-85">{label}</p>
              <p className="mt-1 truncate text-body font-semibold">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-caption opacity-85">
          {record.phone && (
            <span className="flex items-center gap-1"><Phone size={13} /> {record.phone}</span>
          )}
          {record.email && (
            <span className="flex items-center gap-1"><Mail size={13} /> {record.email}</span>
          )}
          {record.address && (
            <span className="flex items-center gap-1"><MapPin size={13} /> {record.address}</span>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Section nav */}
        <nav aria-label="Client sections" className="lg:sticky lg:top-28 lg:self-start">
          <ul className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-card p-2 shadow-soft lg:flex-col lg:overflow-visible">
            {sections.map((s) => (
              <li key={s.id} className="shrink-0 lg:shrink">
                <button
                  onClick={() => setActive(s.id)}
                  aria-current={active === s.id ? "true" : undefined}
                  className={`flex min-h-11 w-full items-center gap-2.5 rounded-sm px-3 text-helper font-medium transition-colors duration-150 ${
                    active === s.id
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
        </nav>

        {/* Content */}
        <div className="min-w-0 space-y-6">
          {/* ── Overview ── */}
          {active === "overview" && (
            <SectionCard title="Client details" description="Basic information and contact details." icon={LayoutDashboard}>
              <div className="grid gap-5 sm:grid-cols-2">
                {[
                  { label: "Full name", value: record.name },
                  { label: "Type", value: record.type },
                  { label: "Tag", value: record.tag },
                  { label: "Phone", value: record.phone || "—" },
                  { label: "Email", value: record.email || "—" },
                  { label: "Address", value: record.address || "—" },
                  { label: "Verification Status", value: record.kyc, pill: kycTone[record.kyc] ?? "muted" },
                  { label: "PAN", value: record.pan || "—" },
                  { label: "Aadhaar", value: record.aadhar || "—" },
                  {
                    label: "Assigned Staff",
                    value:
                      record.assignedTo && record.assignedTo.length > 0
                        ? record.assignedTo
                            .map((a: any) => (typeof a === "object" && a !== null ? a.name : a))
                            .join(", ")
                        : "Unassigned",
                  },
                  {
                    label: "Promised Completion Date",
                    value: record.promisedCompletionDate
                      ? new Date(record.promisedCompletionDate).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "Not set",
                  },
                  { label: "Sub-clients", value: `${record.subClients?.length ?? 0}` },
                  { label: "Onboarding Notes", value: record.notes || "No intake notes entered." },
                  { label: "Created", value: formatDate(record.createdAt) },
                  { label: "Updated", value: formatDate(record.updatedAt) },
                ].map(({ label, value, pill }) => (
                  <div key={label} className={`space-y-1 ${label === "Onboarding Notes" ? "sm:col-span-2 rounded-md bg-muted/30 p-3" : ""}`}>
                    <p className="text-caption text-muted-foreground">{label}</p>
                    {pill ? (
                      <StatusPill tone={pill as "success" | "warning" | "destructive"}>{value}</StatusPill>
                    ) : (
                      <p className="text-helper font-medium">{value}</p>
                    )}
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* ── Cases ── */}
          {active === "cases" && (
            <SectionCard
              title="Linked Cases"
              description="Matters and proceedings where this client is an active party."
              icon={Briefcase}
              action={
                <Button
                  size="sm"
                  className="rounded-md gap-1.5"
                  onClick={() => setShowAddCaseDialog(true)}
                >
                  <Plus size={14} /> Add Case
                </Button>
              }
            >
              {isCasesLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 size={28} className="animate-spin text-muted-foreground" />
                </div>
              ) : isCasesError ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center">
                  <p className="text-helper font-medium text-destructive">Failed to load client cases.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 gap-1.5 rounded-md"
                    onClick={() => refetchCases()}
                  >
                    <RefreshCw size={14} /> Retry
                  </Button>
                </div>
              ) : !casesData?.cases || casesData.cases.length === 0 ? (
                <div className="rounded-lg border border-dashed p-12 text-center">
                  <Briefcase size={32} className="mx-auto text-muted-foreground" strokeWidth={1.5} />
                  <p className="mt-4 font-medium">No cases linked to this client</p>
                  <p className="mt-1 text-helper text-muted-foreground">
                    Create a case linked to this client or add this client to an existing matter.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-4 gap-1.5 rounded-md"
                    onClick={() => setShowAddCaseDialog(true)}
                  >
                    <Plus size={14} /> Add first case
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {casesData.cases.map((c) => (
                    <div
                      key={c._id}
                      className="group flex flex-col justify-between rounded-lg border border-border p-4 transition-colors hover:border-primary/50 hover:bg-muted/30"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-caption text-muted-foreground font-semibold">
                            {c.number}
                          </span>
                          <StatusPill tone={toneForStatus(c.status)}>
                            {c.status}
                          </StatusPill>
                        </div>
                        <Link
                          to="/cases/$caseId"
                          params={{ caseId: c._id }}
                          className="mt-2 block font-semibold text-foreground group-hover:text-primary transition-colors"
                        >
                          {c.title}
                        </Link>
                        <p className="mt-1 text-caption text-muted-foreground">
                          {c.practice || "General Practice"}
                        </p>
                      </div>

                      <div className="mt-4 border-t border-border/60 pt-3 text-caption flex items-center justify-between text-muted-foreground">
                        <span>Assigned: {c.assignedTo?.name || "Unassigned"}</span>
                        <span>Hearing: {formatDate(c.nextHearing)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {/* ── Documents ── */}
          {active === "documents" && (
            <SectionCard
              title="Client Documents"
              description="Legal briefs, evidence, filings, and contracts associated with this client."
              icon={FileText}
            >
              {isDocsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 size={28} className="animate-spin text-muted-foreground" />
                </div>
              ) : isDocsError ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center">
                  <p className="text-helper font-medium text-destructive">Failed to load client documents.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 gap-1.5 rounded-md"
                    onClick={() => refetchDocs()}
                  >
                    <RefreshCw size={14} /> Retry
                  </Button>
                </div>
              ) : !docsData?.documents || docsData.documents.length === 0 ? (
                <div className="rounded-lg border border-dashed p-12 text-center">
                  <FileText size={32} className="mx-auto text-muted-foreground" strokeWidth={1.5} />
                  <p className="mt-4 font-medium">No documents linked to this client</p>
                  <p className="mt-1 text-helper text-muted-foreground">
                    Upload documents to matters linked to this client or via the document repository.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {docsData.documents.map((d) => {
                    const caseInfo = typeof d.caseId === "object" && d.caseId !== null ? d.caseId : null;
                    return (
                      <li key={d._id} className="flex flex-wrap items-center justify-between gap-4 py-3.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="num grid size-10 shrink-0 place-items-center rounded-md bg-muted text-caption font-semibold text-muted-foreground">
                            {(d.kind ?? "DOC").slice(0, 3).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-helper font-medium text-foreground">{d.name}</p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
                              <span>{d.sizeFormatted || `${(d.size / 1024).toFixed(1)} KB`}</span>
                              <span>•</span>
                              <span>v{d.version || 1}</span>
                              <span>•</span>
                              <span>{formatDate(d.createdAt)}</span>
                              {caseInfo && (
                                <>
                                  <span>•</span>
                                  <Link
                                    to="/cases/$caseId"
                                    params={{ caseId: caseInfo._id }}
                                    className="flex items-center gap-1 text-primary hover:underline"
                                  >
                                    <Briefcase size={12} />
                                    <span>{caseInfo.number || caseInfo.title}</span>
                                  </Link>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 rounded-md px-2 text-muted-foreground hover:text-foreground"
                            onClick={() => setPreviewDoc(d)}
                            title="Preview document"
                          >
                            <Eye size={15} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 rounded-md px-2 text-muted-foreground hover:text-foreground"
                            onClick={() => downloadDocument(d._id)}
                            title="Download document"
                          >
                            <Download size={15} />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </SectionCard>
          )}

          {/* ── Identity Verification ── */}
          {active === "kyc" && (
            <SectionCard title="Identity Verification" description="Aadhaar, PAN and client identity credentials." icon={FileBadge}>
              <div className="space-y-5">
                {/* Verification Status */}
                <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/30 p-4">
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-muted">
                    <FileBadge size={22} strokeWidth={1.5} className="text-muted-foreground" />
                  </span>
                  <div>
                    <p className="font-medium">Verification Status</p>
                    <StatusPill tone={(kycTone[record.kyc] ?? "muted") as "success" | "warning" | "destructive"}>
                      {record.kyc}
                    </StatusPill>
                    {record.kyc === "Verified" && (
                      <p className="mt-1 text-caption text-success">Both Aadhaar and PAN verified.</p>
                    )}
                    {record.kyc === "Pending" && (
                      <p className="mt-1 text-caption text-warning">Awaiting Aadhaar and/or PAN submission.</p>
                    )}
                    {record.kyc === "Rejected" && (
                      <p className="mt-1 text-caption text-destructive">Identity verification was rejected. Please review.</p>
                    )}
                  </div>
                </div>

                {/* KYC Fields */}
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-caption text-muted-foreground">Aadhar Number</p>
                    <p className="text-helper font-mono font-medium">{record.aadhar || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-caption text-muted-foreground">PAN Number</p>
                    <p className="text-helper font-mono font-medium">{record.pan || "—"}</p>
                  </div>
                </div>
              </div>
            </SectionCard>
          )}

          {/* ── Property ── */}
          {active === "property" && (
            <SectionCard title="Property Details" description="Property information associated with this client." icon={Home}>
              {!hasProperty ? (
                <div className="rounded-lg border border-dashed p-12 text-center">
                  <Home size={32} className="mx-auto text-muted-foreground" strokeWidth={1.5} />
                  <p className="mt-4 font-medium">No property on record</p>
                  <p className="mt-1 text-helper text-muted-foreground">
                    Add property details for this client from the client edit form.
                  </p>
                </div>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2">
                  {[
                    { label: "Property address", value: record.propertyDetails?.address ?? "—" },
                    { label: "Survey No.", value: record.propertyDetails?.surveyNo ?? "—" },
                    { label: "CHS / Building", value: record.propertyDetails?.chsName ?? "—" },
                    { label: "Sector / Area", value: record.propertyDetails?.sector ?? "—" },
                    { label: "Plot No.", value: record.propertyDetails?.plot ?? "—" },
                    { label: "Area (sq.ft.)", value: record.propertyDetails?.area ?? "—" },
                  ].map(({ label, value }) => (
                    <div key={label} className="space-y-1">
                      <p className="text-caption text-muted-foreground">{label}</p>
                      <p className="text-helper font-medium">{value}</p>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {/* ── Sub-clients ── */}
          {active === "subclients" && (
            <SectionCard
              title="Sub-clients"
              description={`${record.subClients?.length ?? 0} associated parties.`}
              icon={Users}
            >
              {!record.subClients?.length ? (
                <div className="rounded-lg border border-dashed p-12 text-center">
                  <Users size={32} className="mx-auto text-muted-foreground" strokeWidth={1.5} />
                  <p className="mt-4 font-medium">No sub-clients yet</p>
                  <p className="mt-1 text-helper text-muted-foreground">
                    Sub-clients can be added through the client edit form.
                  </p>
                </div>
              ) : (
                <ul className="space-y-4">
                  {record.subClients.map((sc, idx) => (
                    <li key={sc._id ?? idx} className="rounded-md border border-border p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-medium">{sc.name}</p>
                        <StatusPill tone="muted">{sc.relationship || "Related"}</StatusPill>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 text-helper">
                        {sc.phone && (
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Phone size={13} /> {sc.phone}
                          </span>
                        )}
                        {sc.email && (
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Mail size={13} /> {sc.email}
                          </span>
                        )}
                        {sc.aadhar && (
                          <span className="text-caption text-muted-foreground">Aadhar: {sc.aadhar}</span>
                        )}
                        {sc.pan && (
                          <span className="text-caption text-muted-foreground">PAN: {sc.pan}</span>
                        )}
                        {sc.notes && (
                          <span className="sm:col-span-2 text-helper text-muted-foreground">{sc.notes}</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          )}
        </div>
      </div>

      <EditClientDialog
        open={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        record={record}
      />

      <AddCaseDialog
        open={showAddCaseDialog}
        onClose={() => setShowAddCaseDialog(false)}
        preselectedClientId={record._id}
        preselectedClientName={record.name}
      />

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="rounded-xl border border-border bg-card p-6 shadow-lift max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-title font-semibold text-foreground flex items-center gap-2">
              <Archive size={18} className="text-amber-600" />
              Archive Client Profile
            </AlertDialogTitle>
            <AlertDialogDescription className="text-helper text-muted-foreground mt-2">
              Are you sure you want to archive client <span className="font-semibold text-foreground">"{record.name}"</span>?
              Historical cases, court proceedings, and verified documents will remain permanently preserved in firm archives.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-5 flex justify-end gap-2">
            <AlertDialogCancel className="rounded-md" disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-md bg-amber-600 text-white hover:bg-amber-700"
              onClick={handleDeleteClient}
              disabled={isDeleting}
            >
              {isDeleting ? "Archiving…" : "Archive Client"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {previewDoc && (
        <DocumentPreviewModal
          open={!!previewDoc}
          onClose={() => setPreviewDoc(null)}
          documentId={previewDoc._id}
          documentName={previewDoc.name}
          documentMimeType={previewDoc.mimeType}
          documentSize={previewDoc.sizeFormatted ?? previewDoc.size}
        />
      )}
    </div>
  );
}
