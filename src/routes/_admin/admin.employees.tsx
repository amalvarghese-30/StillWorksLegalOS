import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  AlertTriangle,
  Users,
  UsersRound,
  Scale,
  ClipboardList,
  Clock3,
  Activity,
  RotateCcw,
  X,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEmployees, type EmployeeRecord } from "@/services/admin";
import { useEmployeeWorkload } from "@/services/reports";
import { useCreateDirectChat } from "@/services/chat";
import { useFloatingChat } from "@/lib/floatingChat";
import { useAuth } from "@/lib/auth";
import { usePresence } from "@/lib/presence";
import { AddEmployeeDialog } from "@/components/admin/AddEmployeeDialog";
import { EditEmployeeDialog } from "@/components/admin/EditEmployeeDialog";
import { EmployeeCard, formatRole } from "@/components/admin/EmployeeCard";
import { EmployeeTableView } from "@/components/admin/EmployeeTableView";
import { EmployeeDetailWorkspace } from "@/components/admin/EmployeeDetailWorkspace";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_admin/admin/employees")({
  validateSearch: (search: Record<string, unknown>): {
    employeeId?: string;
    view?: "grid" | "table";
    search?: string;
    role?: string;
    status?: string;
    team?: string;
    sort?: string;
  } => ({
    ...(typeof search["employeeId"] === "string" ? { employeeId: search["employeeId"] } : {}),
    ...(typeof search["view"] === "string" && (search["view"] === "grid" || search["view"] === "table")
      ? { view: search["view"] as "grid" | "table" }
      : {}),
    ...(typeof search["search"] === "string" ? { search: search["search"] } : {}),
    ...(typeof search["role"] === "string" ? { role: search["role"] } : {}),
    ...(typeof search["status"] === "string" ? { status: search["status"] } : {}),
    ...(typeof search["team"] === "string" ? { team: search["team"] } : {}),
    ...(typeof search["sort"] === "string" ? { sort: search["sort"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Employees · S & S Legal-Tech LLP" },
      {
        name: "description",
        content: "Team management for the firm — roles, workload, cases and profiles.",
      },
      { property: "og:title", content: "Employees · S & S Legal-Tech LLP" },
      { property: "og:description", content: "Roles, workload, cases and profiles for your team." },
    ],
  }),
  component: EmployeesPage,
});

function EmployeesPage() {
  const navigate = useNavigate();
  const routeSearch = Route.useSearch();
  const { user } = useAuth();
  const { isOnline } = usePresence();

  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRecord | null>(null);

  // Filter state synced with search params — default viewMode is "table"!
  const [searchQuery, setSearchQuery] = useState(routeSearch.search ?? "");
  const [roleFilter, setRoleFilter] = useState(routeSearch.role ?? "all");
  const [statusFilter, setStatusFilter] = useState(routeSearch.status ?? "all");
  const [teamFilter, setTeamFilter] = useState(routeSearch.team ?? "all");
  const [sortOption, setSortOption] = useState(routeSearch.sort ?? "name_asc");
  const [viewMode, setViewMode] = useState<"grid" | "table">(routeSearch.view ?? "table");

  // Selection state for bulk operations
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const canManage = Boolean(user?.role === "admin" || user?.permissions?.employees);

  // Load employees and workload metrics
  const { data, isLoading, isError, refetch } = useEmployees();
  const { data: workloadData } = useEmployeeWorkload();

  const employees = data?.employees ?? [];
  const workloadById = useMemo(
    () => new Map((workloadData?.workloads ?? []).map((w) => [w._id, w])),
    [workloadData]
  );

  // Direct chat mutation & floating widget integration
  const createDirectChat = useCreateDirectChat();
  const { open: openFloatingChat } = useFloatingChat();
  const handleMessage = (userId: string) => {
    createDirectChat.mutate(
      { userId },
      {
        onSuccess: (result) => {
          openFloatingChat(result.group._id);
          toast.success("Opened conversation in floating chat");
        },
        onError: (err: any) => {
          toast.error(err?.message || "Failed to start direct conversation");
        },
      }
    );
  };

  // Profile opening handler
  const handleSelectEmployee = (emp: EmployeeRecord) => {
    navigate({
      search: (prev) => ({
        ...prev,
        employeeId: emp._id,
      }),
    });
  };

  const handleBackToDirectory = () => {
    navigate({
      search: (prev) => ({
        ...prev,
        employeeId: undefined,
      }),
    });
  };

  // Navigation helpers for cases and tasks
  const handleViewCases = (_emp: EmployeeRecord) => {
    navigate({ to: "/cases" });
  };

  const handleViewTasks = (_emp: EmployeeRecord) => {
    navigate({ to: "/tasks" });
  };

  // Selection handlers
  const handleToggleSelect = (empId: string) => {
    setSelectedIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  // Filter & sort logic
  const filteredEmployees = useMemo(() => {
    return employees
      .filter((e) => {
        // Search filter: name, email, title, role, or employee code
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const nameMatch = e.name?.toLowerCase().includes(q);
          const emailMatch = e.email?.toLowerCase().includes(q);
          const titleMatch = e.title?.toLowerCase().includes(q);
          const roleMatch = e.role?.toLowerCase().includes(q);
          const empCodeMatch = `emp-${e._id.slice(-4)}`.toLowerCase().includes(q);
          if (!nameMatch && !emailMatch && !titleMatch && !roleMatch && !empCodeMatch) {
            return false;
          }
        }
        // Role filter
        if (roleFilter !== "all" && e.role !== roleFilter) {
          return false;
        }
        // Status filter (uses presence or stored status)
        if (statusFilter !== "all") {
          const online = isOnline(e._id);
          const effectiveStatus = online ? "online" : (e.status === "online" ? "offline" : (e.status || "offline"));
          if (effectiveStatus !== statusFilter) {
            return false;
          }
        }
        // Team filter (checks designation / title)
        if (teamFilter !== "all") {
          const titleLower = (e.title || "").toLowerCase();
          const roleLower = (e.role || "").toLowerCase();
          if (teamFilter === "litigation" && !titleLower.includes("litigation")) return false;
          if (teamFilter === "civil" && !titleLower.includes("civil")) return false;
          if (teamFilter === "documentation" && !titleLower.includes("doc")) return false;
          if (teamFilter === "court_filing" && !titleLower.includes("filing") && !titleLower.includes("court")) return false;
          if (teamFilter === "corporate" && !titleLower.includes("corporate")) return false;
          if (teamFilter === "admin" && !titleLower.includes("admin") && roleLower !== "admin") return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortOption === "name_desc") {
          return (b.name || "").localeCompare(a.name || "");
        }
        if (sortOption === "workload_desc") {
          const wA = workloadById.get(a._id)?.workload ?? 0;
          const wB = workloadById.get(b._id)?.workload ?? 0;
          return wB - wA;
        }
        if (sortOption === "workload_asc") {
          const wA = workloadById.get(a._id)?.workload ?? 0;
          const wB = workloadById.get(b._id)?.workload ?? 0;
          return wA - wB;
        }
        if (sortOption === "tasks_desc") {
          const tA = workloadById.get(a._id)?.pendingTasks ?? 0;
          const tB = workloadById.get(b._id)?.pendingTasks ?? 0;
          return tB - tA;
        }
        if (sortOption === "cases_desc") {
          const cA = workloadById.get(a._id)?.activeCases ?? 0;
          const cB = workloadById.get(b._id)?.activeCases ?? 0;
          return cB - cA;
        }
        if (sortOption === "overdue_desc") {
          const oA = workloadById.get(a._id)?.overdueTasks ?? 0;
          const oB = workloadById.get(b._id)?.overdueTasks ?? 0;
          return oB - oA;
        }
        if (sortOption === "role") {
          return (a.role || "").localeCompare(b.role || "");
        }
        // Default: name_asc
        return (a.name || "").localeCompare(b.name || "");
      });
  }, [employees, searchQuery, roleFilter, statusFilter, teamFilter, sortOption, workloadById, isOnline]);

  const handleSelectAll = (selectAll: boolean) => {
    if (selectAll) {
      setSelectedIds(filteredEmployees.map((e) => e._id));
    } else {
      setSelectedIds([]);
    }
  };

  // CSV Export logic
  const handleExport = (idsToExport?: string[]) => {
    const targetList =
      idsToExport && idsToExport.length > 0
        ? filteredEmployees.filter((e) => idsToExport.includes(e._id))
        : filteredEmployees;

    if (targetList.length === 0) {
      toast.error("No employees to export");
      return;
    }

    const headers = [
      "Employee Name",
      "Role",
      "Designation",
      "Employee Code",
      "Email",
      "Phone",
      "Cases",
      "Total Tasks",
      "Completed Tasks",
      "Pending Tasks",
      "Overdue Tasks",
      "Workload",
      "Status",
    ];

    const rows = targetList.map((e) => {
      const w = workloadById.get(e._id);
      const p = w?.pendingTasks ?? 0;
      const c = w?.completedTasks ?? 0;
      const t = w?.totalTasks ?? p + c;
      const o = w?.overdueTasks ?? 0;
      const s = w?.workload ?? (t > 0 ? Math.round((p / t) * 100) : 0);
      const online = isOnline(e._id);
      const effectiveStatus = online ? "Online" : "Offline";
      const empCode = `EMP-${e._id.slice(-4).toUpperCase()}`;

      return [
        `"${(e.name || "").replace(/"/g, '""')}"`,
        `"${formatRole(e.role)}"`,
        `"${(e.title || formatRole(e.role)).replace(/"/g, '""')}"`,
        `"${empCode}"`,
        `"${e.email || ""}"`,
        `"${e.phone || ""}"`,
        w?.activeCases ?? 0,
        t,
        c,
        p,
        o,
        `"${s}%"`,
        `"${effectiveStatus}"`,
      ].join(",");
    });

    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `employees_directory_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(`Exported ${targetList.length} employee record(s) to CSV`);
  };

  // 7 Summary Metrics calculations
  const totalEmployees = employees.length;
  const activeEmployees = employees.filter((e) => isOnline(e._id) || e.status === "online").length;
  const advocatesCount = employees.filter((e) => {
    const roleLower = (e.role || "").toLowerCase();
    const titleLower = (e.title || "").toLowerCase();
    return roleLower.includes("advocate") || titleLower.includes("advocate");
  }).length;
  const supportStaffCount = employees.filter((e) => {
    const roleLower = (e.role || "").toLowerCase();
    const titleLower = (e.title || "").toLowerCase();
    return !roleLower.includes("advocate") && !titleLower.includes("advocate") && e.role !== "admin";
  }).length;

  const totalTasksSum = Array.from(workloadById.values()).reduce(
    (sum, w) => sum + (w.totalTasks ?? w.pendingTasks + w.completedTasks),
    0
  );
  const pendingTasksSum = Array.from(workloadById.values()).reduce(
    (sum, w) => sum + (w.pendingTasks ?? 0),
    0
  );
  const overdueTasksSum = Array.from(workloadById.values()).reduce(
    (sum, w) => sum + (w.overdueTasks ?? 0),
    0
  );

  // If employeeId is in route search param, render EmployeeDetailWorkspace
  if (routeSearch.employeeId) {
    const selectedEmp = employees.find((e) => e._id === routeSearch.employeeId);
    return (
      <div className="space-y-6">
        <EmployeeDetailWorkspace
          employeeId={routeSearch.employeeId}
          initialEmployee={selectedEmp}
          onBack={handleBackToDirectory}
          onEdit={(emp) => setEditingEmployee(emp)}
          canEdit={canManage}
        />

        {editingEmployee && (
          <EditEmployeeDialog
            employee={editingEmployee}
            onClose={() => setEditingEmployee(null)}
          />
        )}
      </div>
    );
  }

  const hasActiveFilters =
    searchQuery !== "" || roleFilter !== "all" || statusFilter !== "all" || teamFilter !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setRoleFilter("all");
    setStatusFilter("all");
    setTeamFilter("all");
    setSortOption("name_asc");
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ── Page Header Matching Reference ── */}
      <PageHeader
        breadcrumb={[{ label: "Admin", to: "/admin" }, { label: "Members" }]}
        title="Members"
        subtitle="Manage your team members, monitor workloads, and access member profiles."
        actions={
          <div className="flex items-center gap-2">
            {canManage && (
              <Button
                className="gradient-primary rounded-lg text-primary-foreground shadow-soft transition-transform duration-200 hover:-translate-y-0.5 h-9 px-4 font-semibold hover:opacity-95"
                onClick={() => setShowAddEmployee(true)}
              >
                <Plus size={16} strokeWidth={2} className="mr-1.5" />
                Add Member
              </Button>
            )}
          </div>
        }
      />

      {/* ── 7 Summary Metric Cards in a Single Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* 1. Total Employees */}
        <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-2xs hover:shadow-xs transition-all">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-950/60 dark:text-blue-400 dark:border-blue-900/60">
            <UsersRound size={18} strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground truncate">Total Employees</p>
            <p className="font-display text-xl font-bold text-foreground mt-0.5 tracking-tight">{totalEmployees}</p>
          </div>
        </div>

        {/* 2. Online Now */}
        <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-2xs hover:shadow-xs transition-all">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-900/60">
            <Activity size={18} strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground truncate">Online Now</p>
            <p className="font-display text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 tracking-tight">{activeEmployees}</p>
          </div>
        </div>

        {/* 3. Advocates */}
        <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-2xs hover:shadow-xs transition-all">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 border border-violet-100 dark:bg-violet-950/60 dark:text-violet-400 dark:border-violet-900/60">
            <Scale size={18} strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground truncate">Advocates</p>
            <p className="font-display text-xl font-bold text-foreground mt-0.5 tracking-tight">{advocatesCount}</p>
          </div>
        </div>

        {/* 4. Support Staff */}
        <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-2xs hover:shadow-xs transition-all">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600 border border-purple-100 dark:bg-purple-950/60 dark:text-purple-400 dark:border-purple-900/60">
            <Users size={18} strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground truncate">Support Staff</p>
            <p className="font-display text-xl font-bold text-foreground mt-0.5 tracking-tight">{supportStaffCount}</p>
          </div>
        </div>

        {/* 5. Total Tasks */}
        <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-2xs hover:shadow-xs transition-all">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 border border-sky-100 dark:bg-sky-950/60 dark:text-sky-400 dark:border-sky-900/60">
            <ClipboardList size={18} strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground truncate">Total Tasks</p>
            <p className="font-display text-xl font-bold text-foreground mt-0.5 tracking-tight">{totalTasksSum}</p>
          </div>
        </div>

        {/* 6. Pending Tasks */}
        <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-2xs hover:shadow-xs transition-all">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-900/60">
            <Clock3 size={18} strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground truncate">Pending Tasks</p>
            <p className="font-display text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5 tracking-tight">{pendingTasksSum}</p>
          </div>
        </div>

        {/* 7. Overdue Tasks */}
        <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-2xs hover:shadow-xs transition-all">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-900/60">
            <AlertTriangle size={18} strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground truncate">Overdue Tasks</p>
            <p className="font-display text-xl font-bold text-rose-600 dark:text-rose-400 mt-0.5 tracking-tight">{overdueTasksSum}</p>
          </div>
        </div>
      </div>

      {/* ── Search, Filters, View Controls & Export Toolbar ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-2xs">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, designation, code or email…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8 h-9 text-xs rounded-lg"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filters and Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Role Filter */}
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="h-9 w-[140px] text-xs rounded-lg">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="senior_advocate">Senior Advocate</SelectItem>
              <SelectItem value="junior_advocate">Junior Advocate</SelectItem>
              <SelectItem value="legal_assistant">Legal Assistant</SelectItem>
              <SelectItem value="office_staff">Office Staff</SelectItem>
              <SelectItem value="reception">Reception</SelectItem>
              <SelectItem value="intern">Intern</SelectItem>
              <SelectItem value="admin">Administrator</SelectItem>
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[120px] text-xs rounded-lg">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
              <SelectItem value="away">Away</SelectItem>
            </SelectContent>
          </Select>

          {/* Team Filter */}
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger className="h-9 w-[130px] text-xs rounded-lg">
              <SelectValue placeholder="All Teams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              <SelectItem value="litigation">Litigation</SelectItem>
              <SelectItem value="civil">Civil Matters</SelectItem>
              <SelectItem value="documentation">Documentation</SelectItem>
              <SelectItem value="court_filing">Court Filing</SelectItem>
              <SelectItem value="corporate">Corporate</SelectItem>
              <SelectItem value="admin">Administration</SelectItem>
            </SelectContent>
          </Select>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground rounded-lg"
              title="Reset all filters"
            >
              <RotateCcw size={13} className="mr-1" />
              Reset
            </Button>
          )}

          <div className="h-5 w-px bg-border/60 mx-1 hidden sm:block" />

          {/* View Toggle */}
          <div className="flex items-center rounded-lg border border-border/80 bg-muted/30 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={cn(
                "flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors cursor-pointer",
                viewMode === "table" && "bg-card text-foreground shadow-xs font-semibold"
              )}
              title="Horizontal Table View"
            >
              <List size={14} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={cn(
                "flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors cursor-pointer",
                viewMode === "grid" && "bg-card text-foreground shadow-xs font-semibold"
              )}
              title="Card Grid View"
            >
              <LayoutGrid size={14} />
            </button>
          </div>

          {/* Export Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleExport()}
            className="h-9 px-3 text-xs gap-1.5 font-semibold rounded-lg hover:bg-muted"
          >
            <Download size={13} />
            Export
          </Button>
        </div>
      </div>

      {/* ── Selected Rows Banner (when checkboxes active) ── */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <span className="font-semibold text-primary">{selectedIds.length}</span> of {filteredEmployees.length} employees selected
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleExport(selectedIds)}
              className="h-7 text-xs gap-1.5 rounded-md"
            >
              <Download size={12} /> Export Selected ({selectedIds.length})
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds([])}
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear selection
            </Button>
          </div>
        </div>
      )}

      {/* ── Loading Skeleton ── */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-16 rounded-xl border border-border/70 bg-card p-4 shadow-2xs animate-pulse flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-full bg-muted" />
                <div className="space-y-1">
                  <div className="h-4 w-32 rounded bg-muted" />
                  <div className="h-3 w-20 rounded bg-muted" />
                </div>
              </div>
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="h-4 w-20 rounded bg-muted" />
              <div className="h-4 w-16 rounded bg-muted" />
            </div>
          ))}
        </div>
      )}

      {/* ── Error State ── */}
      {isError && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-12 text-center">
          <AlertTriangle size={28} className="text-destructive" />
          <p className="font-semibold text-foreground">Failed to load team directory</p>
          <p className="text-helper text-muted-foreground">Unable to fetch employee records from the server.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2 rounded-lg">
            <RotateCcw size={14} className="mr-1.5" /> Retry
          </Button>
        </div>
      )}

      {/* ── Empty Filter State ── */}
      {!isLoading && !isError && filteredEmployees.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/80 bg-card p-12 text-center shadow-soft">
          <Users size={32} className="text-muted-foreground/60" />
          <h3 className="font-display font-semibold text-foreground">No employees match your criteria</h3>
          <p className="text-xs text-muted-foreground max-w-sm">
            {hasActiveFilters
              ? "Try adjusting your search terms or clearing your role, status, and team filters."
              : "No team members have been added to the firm yet."}
          </p>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters} className="mt-2 rounded-lg">
              <RotateCcw size={14} className="mr-1.5" /> Clear filters
            </Button>
          )}
        </div>
      )}

      {/* ── Employee Table Presentation (Default) or Grid ── */}
      {!isLoading && !isError && filteredEmployees.length > 0 && (
        <>
          {viewMode === "grid" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredEmployees.map((e) => (
                <EmployeeCard
                  key={e._id}
                  employee={e}
                  workload={workloadById.get(e._id)}
                  canEdit={canManage}
                  onSelect={handleSelectEmployee}
                  onEdit={(emp) => setEditingEmployee(emp)}
                  onMessage={handleMessage}
                  isMessagingPending={createDirectChat.isPending}
                />
              ))}
            </div>
          ) : (
            <EmployeeTableView
              employees={filteredEmployees}
              workloadById={workloadById}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onSelectAll={handleSelectAll}
              canEdit={canManage}
              onSelect={handleSelectEmployee}
              onEdit={(emp) => setEditingEmployee(emp)}
              onMessage={handleMessage}
              onViewCases={handleViewCases}
              onViewTasks={handleViewTasks}
              isMessagingPending={createDirectChat.isPending}
              sortOption={sortOption}
              onSort={(sortKey) => setSortOption(sortKey)}
            />
          )}
        </>
      )}

      {/* Add Employee Dialog */}
      {showAddEmployee && (
        <AddEmployeeDialog open={showAddEmployee} onClose={() => setShowAddEmployee(false)} />
      )}

      {/* Edit Employee Dialog */}
      {editingEmployee && (
        <EditEmployeeDialog employee={editingEmployee} onClose={() => setEditingEmployee(null)} />
      )}
    </div>
  );
}
