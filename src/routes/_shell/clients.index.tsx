import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Plus,
  Search,
  Mail,
  Phone,
  ShieldCheck,
  Briefcase,
  Loader2,
  UserCheck,
  Calendar,
  Users,
  ChevronRight,
  Eye,
  Filter,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusPill } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useSocketEvent } from "@/lib/socket";
import { useClients, clientKeys, type ClientRecord } from "@/services/clients";
import { useCases, caseKeys, type CaseRecord } from "@/services/cases";
import { AddClientDialog } from "@/components/clients/AddClientDialog";
import { ErrorState } from "@/components/common/ErrorState";
import { StaleDataBanner } from "@/components/common/StaleDataBanner";
import { AddCaseDialog } from "@/components/cases/AddCaseDialog";
import { formatSafeDate } from "@/lib/dates";
import { ExportImportMenu } from "@/components/common/ExportImportMenu";
import { ExcelImportDialog } from "@/components/common/ExcelImportDialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/clients/")({
  head: () => ({
    meta: [
      { title: "Clients & Cases · S & S Legal-Tech LLP" },
      {
        name: "description",
        content: "Client profiles, linked cases, and legal relationships in one centralized workspace.",
      },
      { property: "og:title", content: "Clients & Cases · S & S Legal-Tech LLP" },
      {
        property: "og:description",
        content: "Client profiles, linked cases, and legal relationships in one centralized workspace.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { view?: "clients" | "cases"; search?: string; status?: string } => ({
    ...(search["view"] === "cases" ? { view: "cases" } : { view: "clients" }),
    ...(typeof search["search"] === "string" ? { search: search["search"] } : {}),
    ...(typeof search["status"] === "string" ? { status: search["status"] } : {}),
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

function toneForCaseStatus(s: string): "primary" | "success" | "warning" | "muted" | "destructive" | "indigo" | "violet" {
  const map: Record<string, "primary" | "success" | "warning" | "muted" | "destructive" | "indigo" | "violet"> = {
    Active: "success",
    Urgent: "destructive",
    "On Hold": "warning",
    Closed: "muted",
  };
  return map[s] ?? "primary";
}

function ClientCard({ c }: { c: ClientRecord }) {
  return (
    <article className="lift group flex flex-col justify-between rounded-xl sm:rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-soft transition-all duration-150 hover:border-primary/40">
      <div>
        <Link to="/clients/$clientId" params={{ clientId: c._id }}>
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
            <span className="gradient-primary grid size-12 shrink-0 place-items-center rounded-full font-display font-semibold text-primary-foreground shadow-xs">
              {c.name.slice(0, 1)}
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-semibold text-foreground group-hover:text-primary transition-colors">
                {c.name}
              </h2>
              <p className="truncate text-caption text-muted-foreground">
                {c.type} · Since {formatSafeDate(c.createdAt, "—")}
              </p>
            </div>
            <StatusPill tone={toneForTag(c.tag)}>{c.tag}</StatusPill>
          </div>
        </Link>

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

        {/* Assigned & Promised Delivery */}
        {(Boolean(c.assignedTo?.length) || Boolean(c.promisedCompletionDate)) && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-caption">
            {c.assignedTo && c.assignedTo.length > 0 && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <UserCheck size={13} className="text-primary" />
                <span className="font-medium text-foreground">
                  {typeof c.assignedTo[0] === "object" && c.assignedTo[0] !== null
                    ? (c.assignedTo[0] as any).name
                    : "Staff"}
                  {c.assignedTo.length > 1 ? ` +${c.assignedTo.length - 1}` : ""}
                </span>
              </span>
            )}
            {c.promisedCompletionDate && (
              <span className="flex items-center gap-1.5 text-muted-foreground ml-auto">
                <Calendar size={13} className="text-amber-600 dark:text-amber-400" />
                <span>
                  Due: {formatSafeDate(c.promisedCompletionDate, "—")}
                </span>
              </span>
            )}
          </div>
        )}
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-helper text-muted-foreground">
            <Users size={16} strokeWidth={1.75} />
            <span className="num font-medium text-foreground">{c.subClients?.length ?? 0}</span> sub-clients
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck
              size={16}
              strokeWidth={1.75}
              className={c.kyc === "Verified" ? "text-success" : "text-warning"}
            />
            <span className="text-helper">{c.kyc === "Verified" ? "Verified" : "Pending"}</span>
          </span>
        </div>

        {/* Direct access to this client's cases */}
        <div className="mt-3.5 flex items-center justify-between border-t border-border/50 pt-2.5">
          <span className="text-caption text-muted-foreground">Cases & matters</span>
          <Link
            to="/clients/$clientId"
            params={{ clientId: c._id }}
            search={{ tab: "cases" }}
            className="inline-flex items-center gap-1 text-caption font-semibold text-primary hover:underline transition-colors"
          >
            <Briefcase size={13} />
            View Cases <ChevronRight size={13} />
          </Link>
        </div>
      </div>
    </article>
  );
}

const CASE_STATUS_FILTERS = ["All", "Active", "Urgent", "On Hold", "Closed"] as const;

function ClientsPage() {
  const searchParams = Route.useSearch();
  const [viewMode, setViewMode] = useState<"clients" | "cases">(searchParams.view || "clients");
  const [clientSearch, setClientSearch] = useState(searchParams.search || "");
  const [caseSearch, setCaseSearch] = useState("");
  const [caseStatusFilter, setCaseStatusFilter] = useState<string>(searchParams.status || "All");

  const [showAddClientDialog, setShowAddClientDialog] = useState(false);
  const [showAddCaseDialog, setShowAddCaseDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const {
    data: clientsData,
    isLoading: isClientsLoading,
    isError: isClientsError,
    error: clientsError,
    refetch: refetchClients,
    isFetching: isClientsFetching,
  } = useClients(clientSearch.trim() ? { search: clientSearch } : {});

  const {
    data: casesData,
    isLoading: isCasesLoading,
    isError: isCasesError,
    error: casesError,
    refetch: refetchCases,
    isFetching: isCasesFetching,
  } = useCases(
    {
      search: caseSearch.trim() || undefined,
      status: caseStatusFilter === "All" ? undefined : caseStatusFilter,
    } as any,
    { enabled: true }
  );

  // Socket sync
  useSocketEvent("client:created", () => {
    queryClient.invalidateQueries({ queryKey: clientKeys.all });
  });
  useSocketEvent("client:updated", () => {
    queryClient.invalidateQueries({ queryKey: clientKeys.all });
  });
  useSocketEvent("client:deleted", () => {
    queryClient.invalidateQueries({ queryKey: clientKeys.all });
  });
  useSocketEvent("case:created", () => {
    queryClient.invalidateQueries({ queryKey: caseKeys.all });
  });
  useSocketEvent("case:updated", () => {
    queryClient.invalidateQueries({ queryKey: caseKeys.all });
  });
  useSocketEvent("case:deleted", () => {
    queryClient.invalidateQueries({ queryKey: caseKeys.all });
  });

  const totalClients = clientsData?.total ?? 0;
  const totalCases = casesData?.total ?? casesData?.cases?.length ?? 0;

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "S & S", to: "/" }, { label: "Clients & Cases" }]}
        title="Clients & Cases"
        subtitle={
          viewMode === "clients"
            ? `${totalClients} client profiles — individuals, corporates, and their legal matters.`
            : `${totalCases} active and scheduled legal cases across all client portfolios.`
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="rounded-md gap-1.5 shadow-2xs border-border text-foreground hover:bg-muted"
              onClick={() => setShowAddCaseDialog(true)}
            >
              <Briefcase size={16} strokeWidth={1.75} />
              Add Case
            </Button>
            <Button
              className="gradient-primary rounded-md text-primary-foreground shadow-soft transition-transform duration-200 hover:-translate-y-0.5"
              onClick={() => setShowAddClientDialog(true)}
            >
              <Plus size={17} strokeWidth={2} />
              Add Client
            </Button>
            <ExportImportMenu
              entityType={viewMode === "cases" ? "cases" : "clients"}
              data={viewMode === "cases" ? (casesData?.cases || []) : (clientsData?.clients || [])}
              onImportClick={() => setShowImportDialog(true)}
            />
          </div>
        }
      />

      {/* View Switcher Tabs */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1 shadow-2xs">
          <button
            type="button"
            onClick={() => setViewMode("clients")}
            className={cn(
              "flex items-center gap-2 rounded-md px-3.5 py-1.5 text-helper font-medium transition-colors",
              viewMode === "clients"
                ? "bg-card text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Users size={16} />
            Clients Directory ({totalClients})
          </button>
          <button
            type="button"
            onClick={() => setViewMode("cases")}
            className={cn(
              "flex items-center gap-2 rounded-md px-3.5 py-1.5 text-helper font-medium transition-colors",
              viewMode === "cases"
                ? "bg-card text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Briefcase size={16} />
            All Client Cases ({totalCases})
          </button>
        </div>

        {viewMode === "cases" && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-caption text-muted-foreground mr-1 flex items-center gap-1">
              <Filter size={13} /> Status:
            </span>
            {CASE_STATUS_FILTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setCaseStatusFilter(s)}
                className={cn(
                  "rounded-pill px-2.5 py-1 text-caption font-medium transition-colors",
                  caseStatusFilter === s
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── CLIENTS DIRECTORY VIEW ── */}
      {viewMode === "clients" && (
        <>
          <label className="mb-6 flex items-center gap-3 rounded-pill border border-border bg-card px-4 py-2.5 shadow-soft">
            <Search size={18} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
            <input
              type="search"
              aria-label="Search clients"
              placeholder="Search clients by name, phone, PAN, Aadhar…"
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-helper outline-none"
            />
          </label>

          {/* Loading */}
          {isClientsLoading && (
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

          {/* Stale data warning on background refetch failure */}
          {isClientsError && Boolean(clientsData) && (
            <StaleDataBanner
              message="Could not refresh the latest clients from the server. Showing cached clients."
              onRefresh={() => refetchClients()}
              isRefreshing={isClientsFetching}
              className="mb-4"
            />
          )}

          {/* Initial load error */}
          {isClientsError && !clientsData && !isClientsLoading && (
            <ErrorState
              title="Failed to load clients"
              description={clientsError instanceof Error ? clientsError.message : "Could not connect to the server."}
              onRetry={() => refetchClients()}
              isRetrying={isClientsFetching}
              className="my-4"
            />
          )}

          {/* Empty */}
          {!isClientsLoading && (!isClientsError || Boolean(clientsData)) && clientsData?.clients.length === 0 && (
            <div className="rounded-lg border border-border bg-card p-16 text-center shadow-soft">
              <Users size={36} className="mx-auto text-muted-foreground/60 mb-2" />
              <p className="text-title font-semibold">No clients found</p>
              <p className="mt-2 text-helper text-muted-foreground">
                {clientSearch ? "No clients match your search keywords." : "Add your first client to get started."}
              </p>
              <Button
                className="mt-4 gradient-primary rounded-md text-primary-foreground"
                onClick={() => setShowAddClientDialog(true)}
              >
                <Plus size={16} /> Add client
              </Button>
            </div>
          )}

          {/* Data */}
          {!isClientsLoading && (!isClientsError || Boolean(clientsData)) && clientsData && clientsData.clients.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {clientsData.clients.map((c) => (
                <ClientCard key={c._id} c={c} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── ALL CLIENT CASES VIEW ── */}
      {viewMode === "cases" && (
        <>
          <label className="mb-6 flex items-center gap-3 rounded-pill border border-border bg-card px-4 py-2.5 shadow-soft">
            <Search size={18} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
            <input
              type="search"
              aria-label="Search cases"
              placeholder="Search cases by case number, title, client party, counsel, or court…"
              value={caseSearch}
              onChange={(e) => setCaseSearch(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-helper outline-none"
            />
          </label>

          {/* Loading */}
          {isCasesLoading && (
            <div className="flex justify-center py-16">
              <Loader2 size={32} className="animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Stale data warning on background refetch failure */}
          {isCasesError && Boolean(casesData) && (
            <StaleDataBanner
              message="Could not refresh the latest client cases from the server. Showing cached cases."
              onRefresh={() => refetchCases()}
              isRefreshing={isCasesFetching}
              className="mb-4"
            />
          )}

          {/* Initial load error */}
          {isCasesError && !casesData && !isCasesLoading && (
            <ErrorState
              title="Failed to load cases"
              description={casesError instanceof Error ? casesError.message : "Could not connect to the server."}
              onRetry={() => refetchCases()}
              isRetrying={isCasesFetching}
              className="my-4"
            />
          )}

          {/* Empty */}
          {!isCasesLoading && (!isCasesError || Boolean(casesData)) && (!casesData?.cases || casesData.cases.length === 0) && (
            <div className="rounded-lg border border-border bg-card p-16 text-center shadow-soft">
              <Briefcase size={36} className="mx-auto text-muted-foreground/60 mb-2" />
              <p className="text-title font-semibold">No cases found</p>
              <p className="mt-2 text-helper text-muted-foreground">
                {caseSearch || caseStatusFilter !== "All"
                  ? "No cases match the selected filter criteria."
                  : "Create your first legal matter or link one to an existing client."}
              </p>
              <Button
                className="mt-4 gradient-primary rounded-md text-primary-foreground gap-1.5"
                onClick={() => setShowAddCaseDialog(true)}
              >
                <Plus size={16} /> Add Case
              </Button>
            </div>
          )}

          {/* Cases List */}
          {!isCasesLoading && !isCasesError && casesData?.cases && casesData.cases.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-helper">
                  <thead className="border-b border-border bg-muted/40 text-caption font-semibold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 sm:px-6">Case #</th>
                      <th className="px-4 py-3 sm:px-6">Matter Title & Forum</th>
                      <th className="px-4 py-3 sm:px-6">Client / Parties</th>
                      <th className="px-4 py-3 sm:px-6">Status</th>
                      <th className="px-4 py-3 sm:px-6">Assigned To</th>
                      <th className="px-4 py-3 sm:px-6">Next Hearing</th>
                      <th className="px-4 py-3 sm:px-6 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {casesData.cases.map((c) => {
                      const clientParty = c.parties?.find((p) => p.type === "client") || c.parties?.[0];
                      const clientPartyId =
                        clientParty?.clientId && typeof clientParty.clientId === "object"
                          ? (clientParty.clientId as any)._id
                          : clientParty?.clientId;

                      return (
                        <tr key={c._id} className="transition-colors hover:bg-muted/30">
                          <td className="px-4 py-3.5 sm:px-6 font-mono text-xs font-semibold text-foreground whitespace-nowrap">
                            <div>{c.number}</div>
                            {c.courtCaseId && (
                              <div className="text-[11px] font-normal text-muted-foreground">{c.courtCaseId}</div>
                            )}
                          </td>
                          <td className="px-4 py-3.5 sm:px-6 min-w-0">
                            <Link
                              to="/cases/$caseId"
                              params={{ caseId: c._id }}
                              className="font-medium text-foreground hover:text-primary transition-colors block truncate max-w-sm"
                            >
                              {c.title}
                            </Link>
                            <p className="text-caption text-muted-foreground truncate max-w-sm">
                              {c.court ? `${c.court} · ` : ""}
                              {c.mainCategory || c.practice || c.category || "General Legal"}
                            </p>
                          </td>
                          <td className="px-4 py-3.5 sm:px-6 whitespace-nowrap">
                            {clientParty ? (
                              clientPartyId ? (
                                <Link
                                  to="/clients/$clientId"
                                  params={{ clientId: String(clientPartyId) }}
                                  className="font-medium text-primary hover:underline"
                                >
                                  {clientParty.name}
                                </Link>
                              ) : (
                                <span className="text-foreground">{clientParty.name}</span>
                              )
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 sm:px-6 whitespace-nowrap">
                            <StatusPill tone={toneForCaseStatus(c.status)}>{c.status}</StatusPill>
                          </td>
                          <td className="px-4 py-3.5 sm:px-6 whitespace-nowrap text-muted-foreground">
                            {c.assignedTo?.name || "Unassigned"}
                          </td>
                          <td className="px-4 py-3.5 sm:px-6 whitespace-nowrap text-muted-foreground">
                            {formatSafeDate(c.nextHearing, "Not scheduled")}
                          </td>
                          <td className="px-4 py-3.5 sm:px-6 text-right whitespace-nowrap">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="rounded-md gap-1 h-8 px-2.5 text-caption"
                              onClick={() => navigate({ to: "/cases/$caseId", params: { caseId: c._id } })}
                            >
                              <Eye size={14} /> View
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add Client Dialog */}
      {showAddClientDialog && (
        <AddClientDialog open={showAddClientDialog} onClose={() => setShowAddClientDialog(false)} />
      )}

      {/* Add Case Dialog */}
      {showAddCaseDialog && (
        <AddCaseDialog
          open={showAddCaseDialog}
          onClose={() => setShowAddCaseDialog(false)}
          onCaseCreated={() => {
            queryClient.invalidateQueries({ queryKey: caseKeys.all });
            queryClient.invalidateQueries({ queryKey: clientKeys.all });
          }}
        />
      )}

      {/* Excel Import Dialog */}
      {showImportDialog && (
        <ExcelImportDialog
          open={showImportDialog}
          onClose={() => setShowImportDialog(false)}
          entityType={viewMode === "cases" ? "cases" : "clients"}
          existingRecords={viewMode === "cases" ? (casesData?.cases || []) : (clientsData?.clients || [])}
          onImportSuccess={() => {
            queryClient.invalidateQueries({ queryKey: clientKeys.all });
            queryClient.invalidateQueries({ queryKey: caseKeys.all });
          }}
        />
      )}
    </div>
  );
}
