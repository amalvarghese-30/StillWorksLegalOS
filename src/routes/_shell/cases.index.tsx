import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Briefcase, Plus, Filter, Search, Loader2, SlidersHorizontal, X, AlertCircle, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusPill } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useCases, useUpdateCase, type CaseRecord } from "@/services/cases";
import { useEmployees } from "@/services/admin";
import { AddCaseDialog } from "@/components/cases/AddCaseDialog";

export const Route = createFileRoute("/_shell/cases/")({
  head: () => ({
    meta: [
      { title: "Cases · S & S Legal-Tech LLP" },
      {
        name: "description",
        content: "Every matter in one workspace — status, priority, next hearing and assigned counsel.",
      },
      { property: "og:title", content: "Cases · S & S Legal-Tech LLP" },
      {
        property: "og:description",
        content: "Every matter in one workspace with status, hearings and counsel.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { search?: string } => ({
    ...(typeof search["search"] === "string" ? { search: search["search"] } : {}),
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

function CaseCard({
  c,
  onReopen,
}: {
  c: CaseRecord;
  onReopen?: (e: React.MouseEvent, id: string) => void;
}) {
  return (
    <Link
      to="/cases/$caseId"
      params={{ caseId: c._id }}
      className="lift group relative rounded-lg border border-border bg-card p-6 shadow-soft transition-all duration-150 hover:border-primary/40"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
        <div className="min-w-0">
          <p className="num text-caption text-muted-foreground font-mono">{c.number}</p>
          <h2 className="mt-1 truncate text-title font-semibold group-hover:text-primary transition-colors">
            {c.title}
          </h2>
          <p className="mt-1 truncate text-helper text-muted-foreground">
            {c.parties?.[0]?.name ?? "—"} · {c.court || "—"}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="flex items-center gap-1.5">
            <StatusPill tone={toneForStatus(c.status)}>{c.status}</StatusPill>
            {c.status === "Closed" && onReopen && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[10px] px-2 rounded-pill border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                onClick={(e) => onReopen(e, c._id)}
              >
                <RotateCcw size={11} className="mr-1" /> Reopen
              </Button>
            )}
          </div>
          <StatusPill tone={toneForStatus(c.priority)}>{c.priority} priority</StatusPill>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-caption text-muted-foreground">Practice</dt>
          <dd className="mt-0.5 truncate text-helper font-medium">{c.practice || "General Legal"}</dd>
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

const PRACTICE_OPTIONS = [
  "All",
  "Civil Litigation",
  "Criminal Law",
  "Family Law",
  "Property Law",
  "Corporate Law",
  "Tax Law",
  "Labour Law",
  "Consumer Protection",
  "RERA",
  "CIDCO",
  "Arbitration",
  "NCLT / Insolvency",
  "Other",
];

function CasesPage() {
  const routeSearch = Route.useSearch();
  const [search, setSearch] = useState(routeSearch.search ?? "");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [priorityFilter, setPriorityFilter] = useState<string>("All");
  const [practiceFilter, setPracticeFilter] = useState<string>("All");
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Fetch cases
  const { data, isLoading, isError, error } = useCases({ page: "1", limit: "150" });
  const updateCase = useUpdateCase();
  const { data: empData } = useEmployees();
  const employees = empData?.employees ?? [];

  const rawCases = data?.cases ?? [];

  // Compute stat counts across all matters
  const stats = useMemo(() => {
    const total = rawCases.length;
    const active = rawCases.filter((c) => c.status === "Active").length;
    const urgent = rawCases.filter((c) => c.status === "Urgent").length;
    const onHold = rawCases.filter((c) => c.status === "On Hold").length;
    const closed = rawCases.filter((c) => c.status === "Closed").length;
    return { total, active, urgent, onHold, closed };
  }, [rawCases]);

  const query = search.trim().toLowerCase();

  // Multi-attribute filtering matching the user's specification
  const filteredCases = useMemo(() => {
    return rawCases.filter((c) => {
      // 1. Keyword search (title, number, court, client/parties, practice, assigned staff)
      if (query) {
        const titleMatch = c.title.toLowerCase().includes(query);
        const numMatch = (c.number ?? "").toLowerCase().includes(query);
        const courtMatch = (c.court ?? "").toLowerCase().includes(query);
        const practiceMatch = (c.practice ?? "").toLowerCase().includes(query);
        const staffMatch = (c.assignedTo?.name ?? "").toLowerCase().includes(query);
        const partyMatch = (c.parties ?? []).some((p) => p.name.toLowerCase().includes(query));
        if (!titleMatch && !numMatch && !courtMatch && !practiceMatch && !staffMatch && !partyMatch) {
          return false;
        }
      }

      // 2. Status filter
      if (statusFilter !== "All" && c.status !== statusFilter) {
        return false;
      }

      // 3. Priority filter
      if (priorityFilter !== "All" && c.priority !== priorityFilter) {
        return false;
      }

      // 4. Practice / Category filter
      if (practiceFilter !== "All" && c.practice !== practiceFilter) {
        return false;
      }

      // 5. Staff multi-select filter
      if (selectedStaff.length > 0) {
        const staffId = c.assignedTo?._id ?? "";
        const staffName = c.assignedTo?.name ?? "";
        const match = selectedStaff.includes(staffId) || selectedStaff.includes(staffName);
        if (!match) return false;
      }

      return true;
    });
  }, [rawCases, query, statusFilter, priorityFilter, practiceFilter, selectedStaff]);

  const toggleStaff = (idOrName: string) => {
    setSelectedStaff((prev) =>
      prev.includes(idOrName) ? prev.filter((s) => s !== idOrName) : [...prev, idOrName]
    );
  };

  const handleReopen = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    updateCase.mutate({ id, data: { status: "Active" } });
  };

  const clearAllFilters = () => {
    setSearch("");
    setStatusFilter("All");
    setPriorityFilter("All");
    setPracticeFilter("All");
    setSelectedStaff([]);
  };

  const activeFilterCount =
    (statusFilter !== "All" ? 1 : 0) +
    (priorityFilter !== "All" ? 1 : 0) +
    (practiceFilter !== "All" ? 1 : 0) +
    selectedStaff.length +
    (search.trim() ? 1 : 0);

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "S & S", to: "/" }, { label: "Cases" }]}
        title="Cases"
        subtitle={`${filteredCases.length} matters visible · ${stats.active} active · ${stats.urgent} urgent · ${stats.closed} closed.`}
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

      {/* ── Interactive Stat Cards (Click to filter instantly) ── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <button
          type="button"
          onClick={() => setStatusFilter("All")}
          className={`lift flex flex-col items-start rounded-xl border p-4 text-left transition-all duration-150 ${
            statusFilter === "All"
              ? "border-primary bg-primary/10 shadow-sm"
              : "border-border bg-card hover:border-primary/40"
          }`}
        >
          <span className="text-caption font-medium text-muted-foreground">All Matters</span>
          <span className="num mt-1 text-section font-bold">{stats.total}</span>
          <span className="mt-1 text-[11px] text-muted-foreground">Entire firm repository</span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "Active" ? "All" : "Active")}
          className={`lift flex flex-col items-start rounded-xl border p-4 text-left transition-all duration-150 ${
            statusFilter === "Active"
              ? "border-success bg-success/10 shadow-sm"
              : "border-border bg-card hover:border-success/40"
          }`}
        >
          <span className="text-caption font-medium text-success">Active</span>
          <span className="num mt-1 text-section font-bold text-success">{stats.active}</span>
          <span className="mt-1 text-[11px] text-muted-foreground">Ongoing proceedings</span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "Urgent" ? "All" : "Urgent")}
          className={`lift flex flex-col items-start rounded-xl border p-4 text-left transition-all duration-150 ${
            statusFilter === "Urgent"
              ? "border-destructive bg-destructive/10 shadow-sm"
              : "border-border bg-card hover:border-destructive/40"
          }`}
        >
          <span className="text-caption font-medium text-destructive">Urgent</span>
          <span className="num mt-1 text-section font-bold text-destructive">{stats.urgent}</span>
          <span className="mt-1 text-[11px] text-muted-foreground">Immediate action</span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "On Hold" ? "All" : "On Hold")}
          className={`lift flex flex-col items-start rounded-xl border p-4 text-left transition-all duration-150 ${
            statusFilter === "On Hold"
              ? "border-warning bg-warning/10 shadow-sm"
              : "border-border bg-card hover:border-warning/40"
          }`}
        >
          <span className="text-caption font-medium text-warning">On Hold</span>
          <span className="num mt-1 text-section font-bold text-warning">{stats.onHold}</span>
          <span className="mt-1 text-[11px] text-muted-foreground">Awaiting documents</span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "Closed" ? "All" : "Closed")}
          className={`lift flex flex-col items-start rounded-xl border p-4 text-left transition-all duration-150 ${
            statusFilter === "Closed"
              ? "border-primary bg-muted shadow-sm ring-1 ring-primary/40"
              : "border-border bg-card hover:border-muted-foreground/40"
          }`}
        >
          <span className="text-caption font-medium text-muted-foreground">Closed</span>
          <span className="num mt-1 text-section font-bold text-muted-foreground">{stats.closed}</span>
          <span className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Reopen anytime</span>
        </button>
      </div>

      {/* ── Search Bar & Filter Controls ── */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex min-w-0 flex-1 items-center gap-3 rounded-pill border border-border bg-card px-4 py-2.5 shadow-soft">
          <Search size={18} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
          <input
            type="search"
            aria-label="Search cases"
            placeholder="Search by case number, title, court, client or staff…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-helper outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground">
              <X size={15} />
            </button>
          )}
        </label>

        <div className="flex items-center gap-2">
          <Button
            variant={showFilterPanel || activeFilterCount > 0 ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className="h-11 gap-2 rounded-pill px-4 text-xs font-medium"
          >
            <SlidersHorizontal size={15} />
            Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
          </Button>

          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-11 text-xs text-muted-foreground hover:text-destructive"
            >
              <X size={15} className="mr-1" /> Reset
            </Button>
          )}
        </div>
      </div>

      {/* ── Detailed Filter Drawer ── */}
      {showFilterPanel && (
        <div className="mb-6 rounded-xl border border-border bg-card/95 p-4 shadow-soft backdrop-blur-md animate-in fade-in-50 slide-in-from-top-2">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Status */}
            <div>
              <label className="mb-1.5 block text-caption font-semibold text-muted-foreground">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-xs outline-none focus:border-primary"
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Urgent">Urgent</option>
                <option value="On Hold">On Hold</option>
                <option value="Closed">Closed</option>
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="mb-1.5 block text-caption font-semibold text-muted-foreground">Priority</label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-xs outline-none focus:border-primary"
              >
                <option value="All">All Priorities</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            {/* Practice Area / Category */}
            <div>
              <label className="mb-1.5 block text-caption font-semibold text-muted-foreground">Practice / Category</label>
              <select
                value={practiceFilter}
                onChange={(e) => setPracticeFilter(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-xs outline-none focus:border-primary"
              >
                {PRACTICE_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Assigned Staff Multi-Select */}
            <div>
              <label className="mb-1.5 block text-caption font-semibold text-muted-foreground">
                Assigned Staff ({selectedStaff.length} selected)
              </label>
              <div className="max-h-28 overflow-y-auto rounded-md border border-border bg-background p-2 space-y-1.5 text-xs">
                {employees.length === 0 ? (
                  <span className="text-muted-foreground italic">No staff found</span>
                ) : (
                  employees.map((emp) => {
                    const checked = selectedStaff.includes(emp._id) || selectedStaff.includes(emp.name);
                    return (
                      <label key={emp._id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleStaff(emp._id)}
                          className="rounded border-border"
                        />
                        <span className="truncate">{emp.name}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
      {!isLoading && !isError && filteredCases.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-16 text-center shadow-soft">
          <p className="text-title font-semibold">No cases found</p>
          <p className="mt-2 text-helper text-muted-foreground">
            {search || activeFilterCount > 0
              ? "No matters match your filter criteria. Try adjusting keywords or clearing filters."
              : "Create your first case to get started."}
          </p>
          {activeFilterCount > 0 && (
            <Button variant="outline" size="sm" onClick={clearAllFilters} className="mt-4">
              Clear all filters
            </Button>
          )}
        </div>
      )}

      {/* Data */}
      {!isLoading && !isError && filteredCases.length > 0 && (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredCases.map((c) => (
            <CaseCard key={c._id} c={c} onReopen={handleReopen} />
          ))}
        </div>
      )}

      {filteredCases.length > 0 && (
        <p className="mt-6 flex items-center gap-2 text-helper text-muted-foreground">
          <Briefcase size={16} strokeWidth={1.75} /> Showing {filteredCases.length} of {rawCases.length} matters
        </p>
      )}

      <AddCaseDialog open={showAddDialog} onClose={() => setShowAddDialog(false)} />
    </div>
  );
}
