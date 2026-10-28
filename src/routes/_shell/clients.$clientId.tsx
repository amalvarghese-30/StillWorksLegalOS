import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useEffect, type ComponentType, type ReactNode } from "react";
import {
  LayoutDashboard, FileBadge, Home, Users, Briefcase, Plus,
  Phone, Mail, MapPin, Loader2, Edit3, ChevronDown,
  Building2, FileText, Trash2, Archive,
  Download, Eye, RefreshCw, ExternalLink, CheckSquare, AlertTriangle,
  Activity, List, LayoutGrid, Search, Filter,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/common/Surface";
import { StatusPill, toneForStatus } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MobileSectionNav } from "@/components/layout/MobileSectionNav";
import {
  useClient, useUpdateClient, useDeleteClient,
  useClientCases, useClientDocuments, useClientDeletionPreview,
  type ClientRecord, type ClientDocument,
} from "@/services/clients";
import { useAuth } from "@/lib/auth";
import { EditClientDialog } from "@/components/clients/EditClientDialog";
import { AddCaseDialog } from "@/components/cases/AddCaseDialog";
import { EditCaseDialog } from "@/components/cases/EditCaseDialog";
import { AddTaskDialog } from "@/components/tasks/AddTaskDialog";
import { UploadDocumentDialog } from "@/components/documents/UploadDocumentDialog";
import { DocumentInlinePreview } from "@/components/documents/DocumentInlinePreview";
import { downloadDocument } from "@/services/documents";
import { DocumentPreviewModal } from "@/components/documents/DocumentPreviewModal";
import { formatSafeDate, formatSafeDateTime } from "@/lib/dates";
import { useTasks, type TaskRecord } from "@/services/tasks";
import { type CaseRecord } from "@/services/cases";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_shell/clients/$clientId")({
  head: () => ({
    meta: [
      { title: "Client profile · S & S Legal-Tech LLP" },
      { name: "description", content: "Client details, Identity Verification, property, and sub-client records." },
      { property: "og:title", content: "Client profile · S & S Legal-Tech LLP" },
      { property: "og:description", content: "Client details, Identity Verification, property, and sub-client records." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { tab?: string } => ({
    ...(typeof search["tab"] === "string" ? { tab: search["tab"] } : {}),
  }),
  component: ClientProfile,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null | undefined): string {
  return formatSafeDate(iso, "—");
}

const kycTone: Record<string, string> = { Verified: "success", Pending: "warning", Rejected: "destructive" };

// ---------------------------------------------------------------------------
// Sub-components: Quick Property Modal
// ---------------------------------------------------------------------------

function PropertyModal({
  open,
  onClose,
  record,
}: {
  open: boolean;
  onClose: () => void;
  record: ClientRecord;
}) {
  const updateClient = useUpdateClient();
  const [address, setAddress] = useState(record.propertyDetails?.address || "");
  const [surveyNo, setSurveyNo] = useState(record.propertyDetails?.surveyNo || "");
  const [chsName, setChsName] = useState(record.propertyDetails?.chsName || "");
  const [sector, setSector] = useState(record.propertyDetails?.sector || "");
  const [plot, setPlot] = useState(record.propertyDetails?.plot || "");
  const [area, setArea] = useState(record.propertyDetails?.area || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setAddress(record.propertyDetails?.address || "");
      setSurveyNo(record.propertyDetails?.surveyNo || "");
      setChsName(record.propertyDetails?.chsName || "");
      setSector(record.propertyDetails?.sector || "");
      setPlot(record.propertyDetails?.plot || "");
      setArea(record.propertyDetails?.area || "");
    }
  }, [open, record.propertyDetails]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateClient.mutateAsync({
        id: record._id,
        data: {
          propertyDetails: {
            address: address.trim(),
            surveyNo: surveyNo.trim(),
            chsName: chsName.trim(),
            sector: sector.trim(),
            plot: plot.trim(),
            area: area.trim(),
          },
        },
      });
      toast.success("Property details updated successfully");
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to save property details");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Property Details</DialogTitle>
          <DialogDescription>
            Specify real estate, land survey, or society building information for {record.name}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="prop-address">Property Address</Label>
            <Input
              id="prop-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Flat 402, Royal Residency"
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="prop-survey">Survey No.</Label>
              <Input
                id="prop-survey"
                value={surveyNo}
                onChange={(e) => setSurveyNo(e.target.value)}
                placeholder="e.g. 124/2A"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="prop-chs">CHS / Building Name</Label>
              <Input
                id="prop-chs"
                value={chsName}
                onChange={(e) => setChsName(e.target.value)}
                placeholder="e.g. Greenfield CHS"
                className="mt-1"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="prop-sector">Sector / Area</Label>
              <Input
                id="prop-sector"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                placeholder="Sector 19"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="prop-plot">Plot No.</Label>
              <Input
                id="prop-plot"
                value={plot}
                onChange={(e) => setPlot(e.target.value)}
                placeholder="Plot 45"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="prop-area">Area (sq.ft.)</Label>
              <Input
                id="prop-area"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="950"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="gradient-primary text-primary-foreground">
              {saving ? <Loader2 size={16} className="animate-spin" /> : "Save Property"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Sub-components: Quick Sub-Client Modal
// ---------------------------------------------------------------------------

function SubClientModal({
  open,
  onClose,
  record,
}: {
  open: boolean;
  onClose: () => void;
  record: ClientRecord;
}) {
  const updateClient = useUpdateClient();
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("Co-owner");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [aadhar, setAadhar] = useState("");
  const [pan, setPan] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter sub-client name");
      return;
    }
    setSaving(true);
    try {
      const newEntry = {
        name: name.trim(),
        relationship: relationship.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        aadhar: aadhar.trim() || undefined,
        pan: pan.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      const existing = Array.isArray(record.subClients) ? record.subClients : [];
      await updateClient.mutateAsync({
        id: record._id,
        data: {
          subClients: [...existing, newEntry] as any,
        },
      });
      toast.success("Sub-client added successfully");
      setName("");
      setPhone("");
      setEmail("");
      setAadhar("");
      setPan("");
      setNotes("");
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to add sub-client");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Sub-Client / Related Party</DialogTitle>
          <DialogDescription>
            Attach a co-party, family member, guarantor, or authorized representative to {record.name}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="sc-name">Full Name *</Label>
            <Input
              id="sc-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Priya Sharma"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="sc-rel">Relationship</Label>
            <Input
              id="sc-rel"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              placeholder="e.g. Co-owner, Spouse, Guarantor, Partner"
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="sc-phone">Phone</Label>
              <Input
                id="sc-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit mobile"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="sc-email">Email</Label>
              <Input
                id="sc-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="priya@example.com"
                className="mt-1"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="sc-aadhar">Aadhaar (12 digits)</Label>
              <Input
                id="sc-aadhar"
                value={aadhar}
                onChange={(e) => setAadhar(e.target.value)}
                placeholder="123456789012"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="sc-pan">PAN (10 characters)</Label>
              <Input
                id="sc-pan"
                value={pan}
                onChange={(e) => setPan(e.target.value.toUpperCase())}
                placeholder="ABCDE1234F"
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="sc-notes">Notes</Label>
            <Input
              id="sc-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional remarks or authorization details"
              className="mt-1"
            />
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="gradient-primary text-primary-foreground">
              {saving ? <Loader2 size={16} className="animate-spin" /> : "Add Sub-client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

function ClientProfile() {
  const { clientId } = Route.useParams();
  const searchParams = Route.useSearch();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data, isLoading, isError } = useClient(clientId);
  const record = data?.client;
  const [active, setActive] = useState(searchParams.tab || "overview");

  useEffect(() => {
    if (searchParams.tab) {
      setActive(searchParams.tab);
    }
  }, [searchParams.tab]);

  // State for cases management inside client profile
  const [caseSearch, setCaseSearch] = useState("");
  const [caseStatusFilter, setCaseStatusFilter] = useState("All");
  const [caseViewMode, setCaseViewMode] = useState<"table" | "cards">("table");
  const [editingCase, setEditingCase] = useState<CaseRecord | null>(null);
  const [taskCaseId, setTaskCaseId] = useState<string | undefined>(undefined);

  const navigate = useNavigate();
  const deleteClient = useDeleteClient();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPermanentDeleteConfirm, setShowPermanentDeleteConfirm] = useState(false);
  const [confirmDeleteInput, setConfirmDeleteInput] = useState("");
  const { data: deletionPreview, isLoading: isPreviewLoading } = useClientDeletionPreview(clientId, showPermanentDeleteConfirm);
  const [showAddCaseDialog, setShowAddCaseDialog] = useState(false);
  const [showAddTaskDialog, setShowAddTaskDialog] = useState(false);
  const [showUploadDocDialog, setShowUploadDocDialog] = useState(false);
  const [showAddPropertyDialog, setShowAddPropertyDialog] = useState(false);
  const [showAddSubClientDialog, setShowAddSubClientDialog] = useState(false);
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

  const {
    data: tasksData,
    isLoading: isTasksLoading,
    isError: isTasksError,
    refetch: refetchTasks,
  } = useTasks({ clientId });

  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null);

  // Derive activity feed from client data (cases, tasks, docs)
  const activityItems = useMemo(() => {
    const items: Array<{
      id: string;
      type: "case" | "task" | "document";
      label: string;
      sub: string;
      date: string | null;
      link?: { to: string; params?: Record<string, string> };
      icon: ComponentType<{ size?: number; className?: string }>;
      color: string;
    }> = [];

    (casesData?.cases ?? []).forEach((c) => {
      items.push({
        id: `case-${c._id}`,
        type: "case",
        label: c.title,
        sub: `Case · ${(c as any).practice || "General"} · ${c.status}`,
        date: c.createdAt ?? null,
        link: { to: "/cases/$caseId", params: { caseId: c._id } },
        icon: Briefcase,
        color: "text-purple-500",
      });
    });

    (tasksData?.tasks ?? []).forEach((t) => {
      items.push({
        id: `task-${t._id}`,
        type: "task",
        label: t.title,
        sub: `Task · ${t.status.replace(/_/g, " ")} · ${t.priority} priority`,
        date: t.createdAt ?? null,
        link: undefined,
        icon: CheckSquare,
        color: "text-blue-500",
      });
    });

    (docsData?.documents ?? []).forEach((d) => {
      items.push({
        id: `doc-${d._id}`,
        type: "document",
        label: d.name,
        sub: `Document · ${d.kind || "General"} · ${d.sizeFormatted || ""}`,
        date: d.createdAt ?? null,
        icon: FileText,
        color: "text-amber-500",
      });
    });

    return items.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [casesData, tasksData, docsData]);

  const dynamicSections = useMemo(() => [
    { id: "overview" as const, label: "Overview", icon: LayoutDashboard },
    { id: "cases" as const, label: "Cases", icon: Briefcase, badge: casesData?.cases?.length ?? 0 },
    { id: "tasks" as const, label: "Tasks", icon: CheckSquare, badge: tasksData?.tasks?.length ?? 0 },
    { id: "documents" as const, label: "Documents", icon: FileText, badge: docsData?.documents?.length ?? 0 },
    { id: "kyc" as const, label: "Identity Verification", icon: FileBadge, badge: record?.kyc === "Verified" ? "Verified" : record?.kyc },
    { id: "property" as const, label: "Property", icon: Home, badge: record?.propertyDetails?.address ? 1 : null },
    { id: "subclients" as const, label: "Sub-clients", icon: Users, badge: record?.subClients?.length ? record.subClients.length : null },
    { id: "activity" as const, label: "Activity", icon: Activity, badge: activityItems.length },
  ], [casesData?.cases?.length, tasksData?.tasks?.length, docsData?.documents?.length, record?.kyc, record?.propertyDetails?.address, record?.subClients?.length, activityItems.length]);

  const filteredClientCases = useMemo(() => {
    let list = casesData?.cases || [];
    if (caseStatusFilter !== "All") {
      list = list.filter((c) => c.status === caseStatusFilter);
    }
    if (caseSearch.trim()) {
      const q = caseSearch.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.title?.toLowerCase().includes(q) ||
          c.number?.toLowerCase().includes(q) ||
          c.courtCaseId?.toLowerCase().includes(q) ||
          c.court?.toLowerCase().includes(q) ||
          c.practice?.toLowerCase().includes(q) ||
          c.assignedTo?.name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [casesData?.cases, caseStatusFilter, caseSearch]);

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

  if (isError || !data || !record) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-sm text-center">
          <h2 className="text-xl font-semibold">Client not found</h2>
          <p className="mt-2 text-helper text-muted-foreground">This client may have been deleted or you don't have access to it.</p>
        </div>
      </div>
    );
  }

  const hasProperty = Boolean(record.propertyDetails?.address);

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
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="default"
              className="gradient-primary text-primary-foreground shadow-soft rounded-md"
              onClick={() => setShowAddCaseDialog(true)}
            >
              <Briefcase size={15} strokeWidth={1.75} />
              Add Case
            </Button>
            <Button
              variant="outline"
              className="rounded-md"
              onClick={() => setShowAddTaskDialog(true)}
            >
              <CheckSquare size={15} strokeWidth={1.75} />
              Add Task
            </Button>
            <Button
              variant="outline"
              className="rounded-md"
              onClick={() => setShowUploadDocDialog(true)}
            >
              <FileText size={15} strokeWidth={1.75} />
              Upload Document
            </Button>
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
            {isAdmin && (
              <Button
                variant="outline"
                className="rounded-md text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                onClick={() => {
                  setConfirmDeleteInput("");
                  setShowPermanentDeleteConfirm(true);
                }}
              >
                <Trash2 size={15} strokeWidth={1.75} />
                Delete Client
              </Button>
            )}
          </div>
        }
      />

      {/* Hero card */}
      <div className="gradient-primary mb-6 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-primary-foreground shadow-lift">
        <div className="grid gap-3.5 sm:gap-6 grid-cols-2 sm:grid-cols-4">
          {[
            ["Type", record.type],
            ["Tag", record.tag],
            ["Verification Status", record.kyc],
            ["Created", formatDate(record.createdAt)],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <p className="text-[11px] sm:text-caption opacity-85">{label}</p>
              <p className="mt-0.5 sm:mt-1 truncate text-sm sm:text-body font-semibold">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-3.5 sm:mt-4 flex flex-wrap gap-2.5 sm:gap-3 text-caption opacity-85">
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
        <MobileSectionNav
          sections={dynamicSections}
          active={active}
          onChange={(id) => setActive(id as typeof active)}
          ariaLabel="Client sections"
        />

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
                    label: "Assigned To",
                    value:
                      record.assignedTo && record.assignedTo.length > 0
                        ? record.assignedTo
                            .map((a: any) => (typeof a === "object" && a !== null ? a.name : a))
                            .join(", ")
                        : "Unassigned",
                  },
                  {
                    label: "Promised Completion Date",
                    value: formatSafeDateTime(record.promisedCompletionDate, "Not set"),
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
              title="Associated Cases & Legal Matters"
              description="Matters, court proceedings, and legal filings linked to this client."
              icon={Briefcase}
              action={
                <Button
                  size="sm"
                  className="rounded-md gap-1.5 gradient-primary text-primary-foreground shadow-xs"
                  onClick={() => setShowAddCaseDialog(true)}
                >
                  <Plus size={14} /> Add Case
                </Button>
              }
            >
              {/* Summary stat cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                <div className="rounded-lg border border-border bg-card p-3 shadow-2xs">
                  <p className="text-caption text-muted-foreground font-medium">Total Matters</p>
                  <p className="num text-xl font-bold text-foreground mt-0.5">{casesData?.cases?.length ?? 0}</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3 shadow-2xs">
                  <p className="text-caption text-emerald-600 dark:text-emerald-400 font-medium">Active Matters</p>
                  <p className="num text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {casesData?.cases?.filter((c) => c.status === "Active").length ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3 shadow-2xs">
                  <p className="text-caption text-rose-600 dark:text-rose-400 font-medium">Urgent Matters</p>
                  <p className="num text-xl font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                    {casesData?.cases?.filter((c) => c.status === "Urgent" || c.priority === "High").length ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3 shadow-2xs">
                  <p className="text-caption text-muted-foreground font-medium">Closed / Resolved</p>
                  <p className="num text-xl font-bold text-muted-foreground mt-0.5">
                    {casesData?.cases?.filter((c) => c.status === "Closed").length ?? 0}
                  </p>
                </div>
              </div>

              {/* Toolbar: Search, Status Filter, View Toggle */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search cases by number, title, court, counsel..."
                    value={caseSearch}
                    onChange={(e) => setCaseSearch(e.target.value)}
                    className="pl-9 h-8 text-xs rounded-md"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 rounded-md border border-border bg-muted/40 p-0.5">
                    {["All", "Active", "Urgent", "On Hold", "Closed"].map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setCaseStatusFilter(st)}
                        className={cn(
                          "rounded px-2.5 py-1 text-caption font-medium transition-colors",
                          caseStatusFilter === st
                            ? "bg-card text-foreground shadow-2xs font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {st}
                      </button>
                    ))}
                  </div>

                  <div className="hidden sm:inline-flex rounded-md border border-border bg-muted/40 p-0.5">
                    <button
                      type="button"
                      onClick={() => setCaseViewMode("table")}
                      className={cn(
                        "rounded p-1 transition-colors",
                        caseViewMode === "table" ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                      )}
                      title="Table View"
                    >
                      <List size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCaseViewMode("cards")}
                      className={cn(
                        "rounded p-1 transition-colors",
                        caseViewMode === "cards" ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                      )}
                      title="Cards View"
                    >
                      <LayoutGrid size={16} />
                    </button>
                  </div>
                </div>
              </div>

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
              ) : filteredClientCases.length === 0 ? (
                <div className="rounded-lg border border-dashed p-12 text-center">
                  <Briefcase size={32} className="mx-auto text-muted-foreground" strokeWidth={1.5} />
                  <p className="mt-4 font-medium">No cases found</p>
                  <p className="mt-1 text-helper text-muted-foreground">
                    {caseSearch || caseStatusFilter !== "All"
                      ? "No cases match the selected filter criteria."
                      : "Create a case linked to this client or add this client to an existing matter."}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-4 gap-1.5 rounded-md"
                    onClick={() => setShowAddCaseDialog(true)}
                  >
                    <Plus size={14} /> Add Case
                  </Button>
                </div>
              ) : caseViewMode === "table" ? (
                <div className="overflow-hidden rounded-lg border border-border bg-card">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-helper">
                      <thead className="border-b border-border bg-muted/40 text-caption font-semibold uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="px-4 py-2.5">Case #</th>
                          <th className="px-4 py-2.5">Matter Title & Forum</th>
                          <th className="px-4 py-2.5">Category / Practice</th>
                          <th className="px-4 py-2.5">Client Role</th>
                          <th className="px-4 py-2.5">Status</th>
                          <th className="px-4 py-2.5">Assigned To</th>
                          <th className="px-4 py-2.5">Next Hearing</th>
                          <th className="px-4 py-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {filteredClientCases.map((c) => {
                          const clientParty = c.parties?.find(
                            (p) => p.clientId === clientId || p.name?.toLowerCase() === record.name.toLowerCase()
                          );
                          return (
                            <tr key={c._id} className="transition-colors hover:bg-muted/30">
                              <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground whitespace-nowrap">
                                <div>{c.number}</div>
                                {c.courtCaseId && (
                                  <div className="text-[11px] font-normal text-muted-foreground">{c.courtCaseId}</div>
                                )}
                              </td>
                              <td className="px-4 py-3 min-w-[200px]">
                                <Link
                                  to="/cases/$caseId"
                                  params={{ caseId: c._id }}
                                  className="font-medium text-foreground hover:text-primary transition-colors block truncate max-w-xs"
                                >
                                  {c.title}
                                </Link>
                                {c.court && <span className="text-caption text-muted-foreground block truncate">{c.court}</span>}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                                {c.practice || (c as any).category || "General Practice"}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                {clientParty?.role ? (
                                  <span className="inline-block rounded-md bg-muted px-2 py-0.5 text-caption font-medium text-foreground">
                                    {clientParty.role}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-caption">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <StatusPill tone={toneForStatus(c.status)}>{c.status}</StatusPill>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                                {c.assignedTo?.name || "Unassigned"}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                                {formatDate(c.nextHearing)}
                              </td>
                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-caption gap-1 text-primary hover:text-primary"
                                    asChild
                                  >
                                    <Link to="/cases/$caseId" params={{ caseId: c._id }}>
                                      <Eye size={13} /> View
                                    </Link>
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-caption gap-1 text-muted-foreground hover:text-foreground"
                                    onClick={() => setEditingCase(c as unknown as CaseRecord)}
                                  >
                                    <Edit3 size={13} /> Edit
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-caption gap-1 text-muted-foreground hover:text-foreground"
                                    onClick={() => {
                                      setTaskCaseId(c._id);
                                      setShowAddTaskDialog(true);
                                    }}
                                  >
                                    <CheckSquare size={13} /> Task
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {filteredClientCases.map((c) => {
                    const clientParty = c.parties?.find(
                      (p) => p.clientId === clientId || p.name?.toLowerCase() === record.name.toLowerCase()
                    );
                    return (
                      <div
                        key={c._id}
                        className="group flex flex-col justify-between rounded-lg border border-border p-4 transition-colors hover:border-primary/50 hover:bg-muted/30"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-caption text-muted-foreground font-semibold">
                              {c.number}
                            </span>
                            <StatusPill tone={toneForStatus(c.status)}>{c.status}</StatusPill>
                          </div>
                          <Link
                            to="/cases/$caseId"
                            params={{ caseId: c._id }}
                            className="mt-2 block font-semibold text-foreground group-hover:text-primary transition-colors"
                          >
                            {c.title}
                          </Link>
                          <p className="mt-1 text-caption text-muted-foreground">
                            {c.court ? `${c.court} · ` : ""}
                            {c.practice || (c as any).category || "General Practice"}
                          </p>
                          {clientParty?.role && (
                            <span className="mt-2 inline-block rounded-md bg-muted px-2 py-0.5 text-caption font-medium text-foreground">
                              Role: {clientParty.role}
                            </span>
                          )}
                        </div>

                        <div className="mt-4 border-t border-border/60 pt-3 flex flex-col gap-2">
                          <div className="text-caption flex items-center justify-between text-muted-foreground">
                            <span>Assigned To: {c.assignedTo?.name || "Unassigned"}</span>
                            <span>Hearing: {formatDate(c.nextHearing)}</span>
                          </div>
                          <div className="flex items-center justify-end gap-1.5 pt-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-caption gap-1 text-primary hover:text-primary"
                              asChild
                            >
                              <Link to="/cases/$caseId" params={{ caseId: c._id }}>
                                <Eye size={13} /> View
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-caption gap-1 text-muted-foreground hover:text-foreground"
                              onClick={() => setEditingCase(c as unknown as CaseRecord)}
                            >
                              <Edit3 size={13} /> Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-caption gap-1 text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                setTaskCaseId(c._id);
                                setShowAddTaskDialog(true);
                              }}
                            >
                              <CheckSquare size={13} /> Task
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          )}

          {/* ── Tasks ── */}
          {active === "tasks" && (
            <SectionCard
              title="Linked Tasks"
              description="Tasks associated with this client or their linked matters."
              icon={CheckSquare}
              action={
                <Button
                  size="sm"
                  className="rounded-md gap-1.5"
                  onClick={() => setShowAddTaskDialog(true)}
                >
                  <Plus size={14} /> Add Task
                </Button>
              }
            >
              {isTasksLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 size={28} className="animate-spin text-muted-foreground" />
                </div>
              ) : isTasksError ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center">
                  <p className="text-helper font-medium text-destructive">Failed to load tasks.</p>
                  <Button variant="outline" size="sm" className="mt-3 gap-1.5 rounded-md" onClick={() => refetchTasks()}>
                    <RefreshCw size={14} /> Retry
                  </Button>
                </div>
              ) : !tasksData?.tasks || tasksData.tasks.length === 0 ? (
                <div className="rounded-lg border border-dashed p-12 text-center">
                  <CheckSquare size={32} className="mx-auto text-muted-foreground" strokeWidth={1.5} />
                  <p className="mt-4 font-medium">No tasks linked to this client</p>
                  <p className="mt-1 text-helper text-muted-foreground">
                    Tasks assigned directly to this client or to their linked matters will appear here.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-4 gap-1.5 rounded-md"
                    onClick={() => setShowAddTaskDialog(true)}
                  >
                    <Plus size={14} /> Add first task
                  </Button>
                </div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {tasksData.tasks.map((task) => {
                    const isOverdue =
                      task.status !== "completed" &&
                      task.status !== "pending_approval" &&
                      task.deadline &&
                      new Date(task.deadline) < new Date();
                    const priorityColor =
                      task.priority === "High" || (task.priority as string) === "Urgent"
                        ? "text-destructive"
                        : task.priority === "Medium"
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-muted-foreground";
                    return (
                      <li
                        key={task._id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedTask(task)}
                        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelectedTask(task)}
                        className="flex flex-wrap items-start justify-between gap-3 py-3.5 cursor-pointer rounded-md px-2 -mx-2 hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-helper font-medium text-foreground truncate">{task.title}</p>
                            {isOverdue && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-destructive bg-destructive/10 rounded px-1.5 py-0.5">
                                <AlertTriangle size={10} /> Overdue
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
                            <StatusPill tone={toneForStatus(task.status)}>{task.status.replace(/_/g, " ")}</StatusPill>
                            {task.priority && (
                              <span className={`font-medium ${priorityColor}`}>{task.priority}</span>
                            )}
                            {task.deadline && (
                              <span>Due: {formatSafeDate(task.deadline, "—")}</span>
                            )}
                            {task.assignedTo && (
                              <span>
                                Assigned To:{" "}
                                {typeof task.assignedTo === "object" && task.assignedTo !== null
                                  ? (task.assignedTo as any).name
                                  : "Staff"}
                              </span>
                            )}
                          </div>
                        </div>
                        <ExternalLink size={14} className="mt-1 shrink-0 text-muted-foreground/50 group-hover:text-primary" />
                      </li>
                    );
                  })}
                </ul>
              )}
            </SectionCard>
          )}

          {/* ── Documents ── */}
          {active === "documents" && (
            <SectionCard
              title="Client Documents"
              description="Legal briefs, evidence, filings, and contracts associated with this client or their tasks."
              icon={FileText}
              action={
                <Button
                  size="sm"
                  className="rounded-md gap-1.5"
                  onClick={() => setShowUploadDocDialog(true)}
                >
                  <Plus size={14} /> Upload Document
                </Button>
              }
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
                    Upload documents directly to this client, or attach files to matters and tasks.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-4 gap-1.5 rounded-md"
                    onClick={() => setShowUploadDocDialog(true)}
                  >
                    <Plus size={14} /> Upload first document
                  </Button>
                </div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {docsData.documents.map((d) => {
                    const caseInfo = typeof d.caseId === "object" && d.caseId !== null ? d.caseId : null;
                    const taskInfo = typeof (d as any).taskId === "object" && (d as any).taskId !== null ? (d as any).taskId : null;
                    return (
                      <li key={d._id} className="flex flex-wrap items-center justify-between gap-4 py-3.5">
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          <div
                            className="size-12 shrink-0 rounded-md border border-border/80 overflow-hidden bg-muted/40 cursor-pointer flex items-center justify-center hover:opacity-90"
                            onClick={() => setPreviewDoc(d)}
                            title="Click to preview"
                          >
                            <DocumentInlinePreview
                              documentId={d._id}
                              documentName={d.name}
                              mimeType={d.mimeType}
                              className="size-12"
                              onExpand={() => setPreviewDoc(d)}
                            />
                          </div>
                          <div className="min-w-0">
                            <p
                              className="truncate text-helper font-semibold text-foreground hover:text-primary cursor-pointer transition-colors"
                              onClick={() => setPreviewDoc(d)}
                            >
                              {d.name}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
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
                              {taskInfo && (
                                <>
                                  <span>•</span>
                                  <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                                    <CheckSquare size={12} />
                                    <span>{taskInfo.title || "Task Document"}</span>
                                  </span>
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
            <SectionCard
              title="Property Details"
              description="Property information associated with this client."
              icon={Home}
              action={
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-md gap-1.5"
                  onClick={() => setShowAddPropertyDialog(true)}
                >
                  <Edit3 size={14} /> {hasProperty ? "Edit Property" : "Add Property"}
                </Button>
              }
            >
              {!hasProperty ? (
                <div className="rounded-lg border border-dashed p-12 text-center">
                  <Home size={32} className="mx-auto text-muted-foreground" strokeWidth={1.5} />
                  <p className="mt-4 font-medium">No property on record</p>
                  <p className="mt-1 text-helper text-muted-foreground">
                    Add property, land survey, or CHS building details for this client.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-4 gap-1.5 rounded-md"
                    onClick={() => setShowAddPropertyDialog(true)}
                  >
                    <Plus size={14} /> Add Property Details
                  </Button>
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
              action={
                <Button
                  size="sm"
                  className="rounded-md gap-1.5"
                  onClick={() => setShowAddSubClientDialog(true)}
                >
                  <Plus size={14} /> Add Sub-client
                </Button>
              }
            >
              {!record.subClients?.length ? (
                <div className="rounded-lg border border-dashed p-12 text-center">
                  <Users size={32} className="mx-auto text-muted-foreground" strokeWidth={1.5} />
                  <p className="mt-4 font-medium">No sub-clients yet</p>
                  <p className="mt-1 text-helper text-muted-foreground">
                    Attach associated co-parties, family members, or guarantors to this client.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-4 gap-1.5 rounded-md"
                    onClick={() => setShowAddSubClientDialog(true)}
                  >
                    <Plus size={14} /> Add Sub-client
                  </Button>
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

          {/* ── Activity ── */}
          {active === "activity" && (
            <SectionCard
              title="Client Activity"
              description="A chronological record of cases, tasks, and documents linked to this client."
              icon={Activity}
            >
              {isCasesLoading || isTasksLoading || isDocsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 size={28} className="animate-spin text-muted-foreground" />
                </div>
              ) : activityItems.length === 0 ? (
                <div className="rounded-lg border border-dashed p-12 text-center">
                  <Activity size={32} className="mx-auto text-muted-foreground" strokeWidth={1.5} />
                  <p className="mt-4 font-medium">No activity recorded yet</p>
                  <p className="mt-1 text-helper text-muted-foreground">
                    Activity will appear here as cases, tasks, and documents are added to this client.
                  </p>
                </div>
              ) : (
                <ol className="relative border-l border-border/60 ml-2 space-y-0">
                  {activityItems.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <li key={item.id} className="mb-6 ml-6">
                        <span className="absolute -left-3 flex size-6 items-center justify-center rounded-full border border-border bg-card shadow-sm">
                          <ItemIcon size={12} className={item.color} />
                        </span>
                        <div className="flex flex-col gap-0.5">
                          {item.link ? (
                            <Link
                              to={item.link.to as any}
                              params={item.link.params}
                              className="text-helper font-semibold text-foreground hover:text-primary hover:underline transition-colors"
                            >
                              {item.label}
                            </Link>
                          ) : (
                            <p className="text-helper font-semibold text-foreground">{item.label}</p>
                          )}
                          <p className="text-caption text-muted-foreground">{item.sub}</p>
                          {item.date && (
                            <time className="text-caption text-muted-foreground/70">
                              {formatDate(item.date)}
                            </time>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
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
        onCaseCreated={() => {
          refetchCases();
        }}
      />

      <AddTaskDialog
        open={showAddTaskDialog}
        onClose={() => {
          setShowAddTaskDialog(false);
          setTaskCaseId(undefined);
        }}
        initialCaseId={taskCaseId}
        initialClientId={record._id}
      />

      {editingCase && (
        <EditCaseDialog
          open={!!editingCase}
          onClose={() => {
            setEditingCase(null);
            refetchCases();
          }}
          record={{
            ...editingCase,
            description: (editingCase as any).description || "",
            notes: (editingCase as any).notes || [],
            timeline: (editingCase as any).timeline || [],
            tags: (editingCase as any).tags || [],
            progress: (editingCase as any).progress ?? 0,
            priority: (editingCase as any).priority || "Medium",
            court: (editingCase as any).court || "",
            practice: (editingCase as any).practice || "General",
            parties: (editingCase as any).parties || [],
          } as unknown as CaseRecord}
          caseId={editingCase._id}
        />
      )}

      <UploadDocumentDialog
        open={showUploadDocDialog}
        onClose={() => setShowUploadDocDialog(false)}
        preSelectedClientId={record._id}
      />

      <PropertyModal
        open={showAddPropertyDialog}
        onClose={() => setShowAddPropertyDialog(false)}
        record={record}
      />

      <SubClientModal
        open={showAddSubClientDialog}
        onClose={() => setShowAddSubClientDialog(false)}
        record={record}
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

      {/* Admin-only Permanent Cascade Deletion Dialog */}
      <AlertDialog open={showPermanentDeleteConfirm} onOpenChange={setShowPermanentDeleteConfirm}>
        <AlertDialogContent className="rounded-xl border border-destructive/30 bg-card p-6 shadow-lift max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-title font-semibold text-destructive flex items-center gap-2">
              <AlertTriangle size={20} className="text-destructive" />
              Permanent Client & Matter Deletion
            </AlertDialogTitle>
            <AlertDialogDescription className="text-helper text-muted-foreground mt-2 space-y-3">
              <p>
                You are about to permanently delete <strong className="text-foreground">{record.name}</strong> and all associated legal records.
                <span className="text-destructive font-medium block mt-1">This action is irreversible and cannot be undone.</span>
              </p>

              {isPreviewLoading ? (
                <div className="flex items-center gap-2 py-3 text-muted-foreground text-xs">
                  <Loader2 size={16} className="animate-spin" />
                  Calculating linked dependencies…
                </div>
              ) : deletionPreview ? (
                <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs space-y-1.5">
                  <p className="font-semibold text-foreground">Records that will be permanently destroyed:</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                    <li><strong className="text-foreground">{deletionPreview.caseCount}</strong> Linked Cases & Legal Matters</li>
                    <li><strong className="text-foreground">{deletionPreview.taskCount}</strong> Tasks & Task Reminders</li>
                    <li><strong className="text-foreground">{deletionPreview.documentCount}</strong> Uploaded Documents & Storage Files</li>
                  </ul>
                </div>
              ) : null}

              <div className="pt-2">
                <Label className="text-xs font-semibold text-foreground block mb-1">
                  Type <span className="text-destructive font-mono uppercase">{record.name}</span> to confirm permanent deletion:
                </Label>
                <Input
                  value={confirmDeleteInput}
                  onChange={(e) => setConfirmDeleteInput(e.target.value)}
                  placeholder={record.name}
                  className="text-xs rounded-md"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-5 flex justify-end gap-2">
            <AlertDialogCancel className="rounded-md" disabled={isDeleting}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              className="rounded-md"
              disabled={isDeleting || confirmDeleteInput.trim().toLowerCase() !== record.name.trim().toLowerCase()}
              onClick={async () => {
                setIsDeleting(true);
                try {
                  await deleteClient.mutateAsync({ id: clientId, permanent: true });
                  setShowPermanentDeleteConfirm(false);
                  navigate({ to: "/clients" });
                } catch (err) {
                  console.error("Failed to permanently delete client:", err);
                  setIsDeleting(false);
                }
              }}
            >
              {isDeleting ? "Deleting Permanently…" : "Delete Everything Permanently"}
            </Button>
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

      {selectedTask && (
        <TaskDetailDialog
          task={selectedTask}
          open={!!selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
}
