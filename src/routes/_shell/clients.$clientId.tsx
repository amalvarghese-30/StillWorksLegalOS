import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import {
  LayoutDashboard, FileBadge, Home, Users,
  Phone, Mail, MapPin, Loader2, Edit3, ChevronDown,
  Send, Check, X, UserPlus, Building2, FileText,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/common/Surface";
import { StatusPill } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useClient, useUpdateClient,
  type ClientRecord,
} from "@/services/clients";

export const Route = createFileRoute("/_shell/clients/$clientId")({
  head: () => ({
    meta: [
      { title: "Client profile · StillWorks LegalOS" },
      { name: "description", content: "Client details, KYC, property, and sub-client records." },
      { property: "og:title", content: "Client profile · StillWorks LegalOS" },
      { property: "og:description", content: "Client details, KYC, property, and sub-client records." },
    ],
  }),
  component: ClientProfile,
});

const sections = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "kyc", label: "KYC", icon: FileBadge },
  { id: "property", label: "Property", icon: Home },
  { id: "subclients", label: "Sub-clients", icon: Users },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
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
          { label: "StillWorks", to: "/" },
          { label: "Clients", to: "/clients" },
          { label: record.name },
        ]}
        title={record.name}
        subtitle={`${record.type} · ${record.tag} · KYC ${record.kyc}`}
        actions={
          <QuickEditDropdown record={record} />
        }
      />

      {/* Hero card */}
      <div className="gradient-primary mb-6 rounded-lg p-6 text-primary-foreground shadow-lift">
        <div className="grid gap-6 md:grid-cols-4">
          {[
            ["Type", record.type],
            ["Tag", record.tag],
            ["KYC Status", record.kyc],
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
                  { label: "KYC Status", value: record.kyc, pill: kycTone[record.kyc] ?? "muted" },
                  { label: "PAN", value: record.pan || "—" },
                  { label: "Aadhar", value: record.aadhar || "—" },
                  { label: "Created", value: formatDate(record.createdAt) },
                  { label: "Updated", value: formatDate(record.updatedAt) },
                  { label: "Sub-clients", value: `${record.subClients?.length ?? 0}` },
                ].map(({ label, value, pill }) => (
                  <div key={label} className="space-y-1">
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

          {/* ── KYC ── */}
          {active === "kyc" && (
            <SectionCard title="KYC Verification" description="Aadhar, PAN and identity verification status." icon={FileBadge}>
              <div className="space-y-5">
                {/* KYC Status */}
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
                      <p className="mt-1 text-caption text-success">Both Aadhar and PAN verified.</p>
                    )}
                    {record.kyc === "Pending" && (
                      <p className="mt-1 text-caption text-warning">Awaiting Aadhar and/or PAN submission.</p>
                    )}
                    {record.kyc === "Rejected" && (
                      <p className="mt-1 text-caption text-destructive">KYC verification was rejected. Please review.</p>
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
    </div>
  );
}
