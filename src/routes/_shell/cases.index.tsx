import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Briefcase, Plus, Filter, Search, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusPill } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useCases, type CaseRecord } from "@/services/cases";
import { AddCaseDialog } from "@/components/cases/AddCaseDialog";

export const Route = createFileRoute("/_shell/cases/")({
  head: () => ({
    meta: [
      { title: "Cases · StillWorks LegalOS" },
      {
        name: "description",
        content: "Every matter in one workspace — status, priority, next hearing and assigned counsel.",
      },
      { property: "og:title", content: "Cases · StillWorks LegalOS" },
      {
        property: "og:description",
        content: "Every matter in one workspace with status, hearings and counsel.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    search: typeof search["search"] === "string" ? search["search"] : undefined,
  }),
  component: CasesPage,
});

const STATUS_FILTERS = ["All", "Active", "Urgent", "On Hold", "Closed"] as const;

function toneForStatus(s: string): "primary" | "success" | "warning" | "muted" | "destructive" | "indigo" | "violet" {
  const map: Record<string, "primary" | "success" | "warning" | "muted" | "destructive" | "indigo" | "violet"> = {
    Active: "success",
    Urgent: "destructive",
    "On Hold": "warning",
    Closed: "muted",
    High: "destructive",
    Medium: "warning",
    Low: "muted",
  };
  return map[s] ?? "primary";
}

function formatDate(iso: string | null): string {
  if (!iso) return "Not scheduled";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function CaseCard({ c }: { c: CaseRecord }) {
  return (
    <Link
      to="/cases/$caseId"
      params={{ caseId: c._id }}
      className="lift rounded-lg border border-border bg-card p-6 shadow-soft"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
        <div className="min-w-0">
          <p className="num text-caption text-muted-foreground">{c.number}</p>
          <h2 className="mt-1 truncate text-title font-semibold">{c.title}</h2>
          <p className="mt-1 truncate text-helper text-muted-foreground">
            {c.parties?.[0]?.name ?? "—"} · {c.court || "—"}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <StatusPill tone={toneForStatus(c.status)}>{c.status}</StatusPill>
          <StatusPill tone={toneForStatus(c.priority)}>{c.priority} priority</StatusPill>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-caption text-muted-foreground">Practice</dt>
          <dd className="mt-0.5 truncate text-helper font-medium">{c.practice}</dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">Assigned</dt>
          <dd className="mt-0.5 truncate text-helper font-medium">
            {c.assignedTo?.name ?? "Unassigned"}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">Next hearing</dt>
          <dd className="num mt-0.5 truncate text-helper font-medium">
            {formatDate(c.nextHearing)}
          </dd>
        </div>
      </dl>

      <div className="mt-5 flex items-center gap-3">
        <Progress value={c.progress} className="h-1.5" />
        <span className="num shrink-0 text-caption text-muted-foreground">{c.progress}%</span>
      </div>
    </Link>
  );
}

function CasesPage() {
  const routeSearch = Route.useSearch();
  const [search, setSearch] = useState(routeSearch.search ?? "");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [showAddDialog, setShowAddDialog] = useState(false);

  const filters: Record<string, string> = {};
  if (search.trim()) filters["search"] = search;
  if (statusFilter !== "All") filters["status"] = statusFilter;

  const { data, isLoading, isError, error } = useCases(filters);

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "StillWorks", to: "/" }, { label: "Cases" }]}
        title="Cases"
        subtitle={`${data?.total ?? "—"} matters across practice areas.`}
        actions={
          <Button
            className="gradient-primary rounded-md text-primary-foreground shadow-soft transition-transform duration-200 hover:-translate-y-0.5"
            onClick={() => setShowAddDialog(true)}
          >
            <Plus size={17} strokeWidth={2} />
            Add case
          </Button>
        }
      />

      <div className="mb-6 space-y-3">
        <div className="flex items-center gap-3">
          <label className="flex min-w-0 flex-1 items-center gap-3 rounded-pill border border-border bg-card px-4 py-2.5 shadow-soft">
            <Search size={18} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
            <input
              type="search"
              aria-label="Search cases"
              placeholder="Search by case number, title, court or party…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-helper outline-none"
            />
          </label>
          <Button variant="outline" size="icon" className="shrink-0 rounded-md" aria-label="More filters">
            <Filter size={18} strokeWidth={1.75} />
          </Button>
        </div>

        {/* Horizontally scrollable status filters on mobile */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`shrink-0 min-h-10 rounded-pill px-4 text-helper font-medium transition-colors duration-150 ${
                statusFilter === f
                  ? "gradient-primary text-primary-foreground shadow-soft"
                  : "border border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid gap-4 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-6 shadow-soft">
              <div className="space-y-3">
                <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                <div className="h-5 w-56 animate-pulse rounded bg-muted" />
                <div className="h-3 w-44 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {isError && !isLoading && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
          <p className="font-medium text-destructive">Failed to load cases</p>
          <p className="mt-1 text-helper text-muted-foreground">
            {error instanceof Error ? error.message : "Could not connect to the server."}
          </p>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && data?.cases.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-16 text-center shadow-soft">
          <p className="text-title font-semibold">No cases found</p>
          <p className="mt-2 text-helper text-muted-foreground">
            {search || statusFilter !== "All"
              ? "No cases match your filters. Try different keywords."
              : "Create your first case to get started."}
          </p>
        </div>
      )}

      {/* Data */}
      {!isLoading && !isError && data && (
        <div className="grid gap-4 xl:grid-cols-2">
          {data.cases.map((c) => (
            <CaseCard key={c._id} c={c} />
          ))}
        </div>
      )}

      {data && data.total > 0 && (
        <p className="mt-6 flex items-center gap-2 text-helper text-muted-foreground">
          <Briefcase size={16} strokeWidth={1.75} /> Showing {data.cases.length} of {data.total} matters
        </p>
      )}

      <AddCaseDialog open={showAddDialog} onClose={() => setShowAddDialog(false)} />
    </div>
  );
}
