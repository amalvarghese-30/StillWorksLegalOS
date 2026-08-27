import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Search, Mail, Phone, ShieldCheck, Briefcase, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusPill } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { useClients, type ClientRecord } from "@/services/clients";
import { AddClientDialog } from "@/components/clients/AddClientDialog";

export const Route = createFileRoute("/_shell/clients/")({
  head: () => ({
    meta: [
      { title: "Clients · StillWorks LegalOS" },
      {
        name: "description",
        content: "Premium client profiles with KYC status, matters and relationships in one place.",
      },
      { property: "og:title", content: "Clients · StillWorks LegalOS" },
      {
        property: "og:description",
        content: "Client profiles with KYC status, matters and relationships.",
      },
    ],
  }),
  component: ClientsPage,
});

function toneForTag(tag: string): "primary" | "indigo" | "violet" | "success" | "warning" | "muted" {
  const map: Record<string, "primary" | "indigo" | "violet" | "success" | "warning" | "muted"> = {
    VIP: "violet",
    Corporate: "indigo",
    Active: "success",
    Individual: "primary",
    Archived: "muted",
  };
  return map[tag] ?? "muted";
}

function toneForKYC(kyc: string): "primary" | "success" | "warning" | "destructive" {
  const map: Record<string, "primary" | "success" | "warning" | "destructive"> = {
    Verified: "success",
    Pending: "warning",
    Rejected: "destructive",
  };
  return map[kyc] ?? "warning";
}

function ClientCard({ c }: { c: ClientRecord }) {
  return (
    <Link to="/clients/$clientId" params={{ clientId: c._id }}>
      <article className="lift rounded-lg border border-border bg-card p-6 shadow-soft transition-colors hover:border-primary/30">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <span className="gradient-primary grid size-12 shrink-0 place-items-center rounded-full font-display font-semibold text-primary-foreground">
            {c.name.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-semibold">{c.name}</h2>
            <p className="truncate text-caption text-muted-foreground">
              {c.type} · Since {new Date(c.createdAt).toLocaleDateString("en-IN", { year: "numeric", month: "short" })}
            </p>
          </div>
          <StatusPill tone={toneForTag(c.tag)}>{c.tag}</StatusPill>
        </div>

        <ul className="mt-5 space-y-2 text-helper text-muted-foreground">
          <li className="flex items-center gap-2">
            <Mail size={16} strokeWidth={1.75} className="shrink-0" />
            <span className="truncate">{c.email || "—"}</span>
          </li>
          <li className="num flex items-center gap-2">
            <Phone size={16} strokeWidth={1.75} className="shrink-0" />
            <span className="truncate">{c.phone || "—"}</span>
          </li>
        </ul>

        <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
          <span className="flex items-center gap-2 text-helper">
            <Briefcase size={16} strokeWidth={1.75} className="text-muted-foreground" />
            <span className="num font-medium">{c.subClients?.length ?? 0}</span> sub-clients
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck
              size={16}
              strokeWidth={1.75}
              className={c.kyc === "Verified" ? "text-success" : "text-warning"}
            />
            <span className="text-helper">KYC {c.kyc}</span>
          </span>
        </div>
      </article>
    </Link>
  );
}

function ClientsPage() {
  const [search, setSearch] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const { data, isLoading, isError, error } = useClients(
    search.trim() ? { search } : {},
  );

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "StillWorks", to: "/" }, { label: "Clients" }]}
        title="Clients"
        subtitle={`${data?.total ?? "—"} relationships — individuals, corporates and their sub-clients.`}
        actions={
          <Button
            className="gradient-primary rounded-md text-primary-foreground shadow-soft transition-transform duration-200 hover:-translate-y-0.5"
            onClick={() => setShowAddDialog(true)}
          >
            <Plus size={17} strokeWidth={2} />
            Add client
          </Button>
        }
      />

      <label className="mb-6 flex items-center gap-3 rounded-pill border border-border bg-card px-4 py-2.5 shadow-soft">
        <Search size={18} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
        <input
          type="search"
          aria-label="Search clients"
          placeholder="Search clients by name, phone, PAN, Aadhar…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-helper outline-none"
        />
      </label>

      {/* Loading */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-6 shadow-soft">
              <div className="flex items-center gap-3">
                <div className="size-12 animate-pulse rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                </div>
              </div>
              <div className="mt-5 space-y-2">
                <div className="h-3 w-48 animate-pulse rounded bg-muted" />
                <div className="h-3 w-40 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {isError && !isLoading && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
          <p className="font-medium text-destructive">Failed to load clients</p>
          <p className="mt-1 text-helper text-muted-foreground">
            {error instanceof Error ? error.message : "Could not connect to the server."}
          </p>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && data?.clients.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-16 text-center shadow-soft">
          <p className="text-title font-semibold">No clients yet</p>
          <p className="mt-2 text-helper text-muted-foreground">
            {search ? "No clients match your search. Try different keywords." : "Add your first client to get started."}
          </p>
        </div>
      )}

      {/* Data */}
      {!isLoading && !isError && data && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.clients.map((c) => (
            <ClientCard key={c._id} c={c} />
          ))}
        </div>
      )}

      <AddClientDialog open={showAddDialog} onClose={() => setShowAddDialog(false)} />
    </div>
  );
}
