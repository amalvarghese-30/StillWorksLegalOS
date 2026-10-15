import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  AlertTriangle,
  Users,
  UserCheck,
  RotateCcw,
  SlidersHorizontal,
  X,
  Loader2,
} from "lucide-react";
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
import { useAuth } from "@/lib/auth";
import { AddEmployeeDialog } from "@/components/admin/AddEmployeeDialog";
import { EditEmployeeDialog } from "@/components/admin/EditEmployeeDialog";
import { EmployeeCard } from "@/components/admin/EmployeeCard";
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
    sort?: string;
  } => ({
    ...(typeof search["employeeId"] === "string" ? { employeeId: search["employeeId"] } : {}),
    ...(typeof search["view"] === "string" && (search["view"] === "grid" || search["view"] === "table")
      ? { view: search["view"] as "grid" | "table" }
      : {}),
    ...(typeof search["search"] === "string" ? { search: search["search"] } : {}),
    ...(typeof search["role"] === "string" ? { role: search["role"] } : {}),
    ...(typeof search["status"] === "string" ? { status: search["status"] } : {}),
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

  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRecord | null>(null);

  // Filter state synced with or derived from search params
  const [searchQuery, setSearchQuery] = useState(routeSearch.search ?? "");
  const [roleFilter, setRoleFilter] = useState(routeSearch.role ?? "all");
  const [statusFilter, setStatusFilter] = useState(routeSearch.status ?? "all");
  const [sortOption, setSortOption] = useState(routeSearch.sort ?? "name_asc");
  const [viewMode, setViewMode] = useState<"grid" | "table">(routeSearch.view ?? "grid");

  const canManage = Boolean(user?.role === "admin" || user?.permissions?.employees);

  // Load employees and workload metrics
  const { data, isLoading, isError, refetch } = useEmployees();
  const { data: workloadData } = useEmployeeWorkload();

  const employees = data?.employees ?? [];
  const workloadById = useMemo(
    () => new Map((workloadData?.workloads ?? []).map((w) => [w._id, w])),
    [workloadData]
  );

  // Direct chat mutation
  const createDirectChat = useCreateDirectChat();
  const handleMessage = (userId: string) => {
    createDirectChat.mutate(
      { userId },
      {
        onSuccess: (result) => {
          navigate({ to: "/chat", search: { groupId: result.group._id } });
        },
      }
    );
  };

  // Profile opening handler — updates URL search param so refresh works!
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

  // Filter & sort logic
  const filteredEmployees = useMemo(() => {
    return employees
      .filter((e) => {
        // Search filter
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
        // Status filter
        if (statusFilter !== "all" && (e.status || "offline") !== statusFilter) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortOption === "name_desc") {
          return (b.name || "").localeCompare(a.name || "");
        }
        if (sortOption === "workload_desc") {
          const wA = (workloadById.get(a._id)?.activeCases ?? 0) + (workloadById.get(a._id)?.pendingTasks ?? 0);
          const wB = (workloadById.get(b._id)?.activeCases ?? 0) + (workloadById.get(b._id)?.pendingTasks ?? 0);
          return wB - wA;
        }
        if (sortOption === "tasks_desc") {
          const tA = workloadById.get(a._id)?.pendingTasks ?? 0;
          const tB = workloadById.get(b._id)?.pendingTasks ?? 0;
          return tB - tA;
        }
        if (sortOption === "role") {
          return (a.role || "").localeCompare(b.role || "");
        }
        // Default: name_asc
        return (a.name || "").localeCompare(b.name || "");
      });
  }, [employees, searchQuery, roleFilter, statusFilter, sortOption, workloadById]);

  // Counts
  const totalEmployees = employees.length;
  const activeEmployees = employees.filter((e) => e.status === "online").length;

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

  const hasActiveFilters = searchQuery !== "" || roleFilter !== "all" || statusFilter !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setRoleFilter("all");
    setStatusFilter("all");
    setSortOption("name_asc");
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <PageHeader
        breadcrumb={[{ label: "S & S", to: "/" }, { label: "Employees" }]}
        title="Employees"
        subtitle="Manage your team, monitor workloads, and access employee profiles."
        actions={
          <div className="flex items-center gap-2">
            {canManage && (
              <Button
                className="gradient-primary rounded-lg text-primary-foreground shadow-soft transition-transform duration-200 hover:-translate-y-0.5 h-9"
                onClick={() => setShowAddEmployee(true)}
              >
                <Plus size={16} strokeWidth={2} className="mr-1.5" />
                Add employee
              </Button>
            )}
          </div>
        }
      />

      {/* Directory Metrics & Quick Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-card p-3.5 shadow-soft">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Users size={18} />
          </div>
          <div>
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Total Team</div>
            <div className="font-display text-xl font-bold text-foreground mt-0.5">{totalEmployees}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-card p-3.5 shadow-soft">
          <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
            <UserCheck size={18} />
          </div>
          <div>
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Online Now</div>
            <div className="font-display text-xl font-bold text-emerald-400 mt-0.5">{activeEmployees}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-card p-3.5 shadow-soft">
          <div className="flex size-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
            <SlidersHorizontal size={18} />
          </div>
          <div>
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Advocates</div>
            <div className="font-display text-xl font-bold text-foreground mt-0.5">
              {employees.filter((e) => e.role?.includes("advocate")).length}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-card p-3.5 shadow-soft">
          <div className="flex size-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400">
            <Users size={18} />
          </div>
          <div>
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Support Staff</div>
            <div className="font-display text-xl font-bold text-foreground mt-0.5">
              {employees.filter((e) => !e.role?.includes("advocate") && e.role !== "admin").length}
            </div>
          </div>
        </div>
      </div>

      {/* Directory Filter, Search, Sort & View Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-xl border border-border/80 bg-card p-3 shadow-soft">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search team by name, designation, code or email…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8 h-9 text-xs"
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

        {/* Filters and View Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Role Filter */}
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="h-9 w-[150px] text-xs">
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
            <SelectTrigger className="h-9 w-[130px] text-xs">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="away">Away</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort Selector */}
          <Select value={sortOption} onValueChange={setSortOption}>
            <SelectTrigger className="h-9 w-[160px] text-xs">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name_asc">Name (A → Z)</SelectItem>
              <SelectItem value="name_desc">Name (Z → A)</SelectItem>
              <SelectItem value="workload_desc">Highest Workload</SelectItem>
              <SelectItem value="tasks_desc">Most Pending Tasks</SelectItem>
              <SelectItem value="role">Role Hierarchy</SelectItem>
            </SelectContent>
          </Select>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
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
              onClick={() => setViewMode("grid")}
              className={cn(
                "flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors cursor-pointer",
                viewMode === "grid" && "bg-card text-foreground shadow-xs font-semibold"
              )}
              title="Compact Card Grid View"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={cn(
                "flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors cursor-pointer",
                viewMode === "table" && "bg-card text-foreground shadow-xs font-semibold"
              )}
              title="Compact Table / List View"
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 shadow-soft animate-pulse space-y-3">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-muted" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 w-28 rounded bg-muted" />
                  <div className="h-3 w-16 rounded bg-muted" />
                </div>
              </div>
              <div className="h-3 w-36 rounded bg-muted mt-2" />
              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="h-12 rounded-lg bg-muted" />
                <div className="h-12 rounded-lg bg-muted" />
                <div className="h-12 rounded-lg bg-muted" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-12 text-center">
          <AlertTriangle size={28} className="text-destructive" />
          <p className="font-semibold text-foreground">Failed to load team directory</p>
          <p className="text-helper text-muted-foreground">Unable to fetch employee records from the server.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
            <RotateCcw size={14} className="mr-1.5" /> Retry
          </Button>
        </div>
      )}

      {/* Empty Filter State */}
      {!isLoading && !isError && filteredEmployees.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border/80 bg-card p-12 text-center shadow-soft">
          <Users size={32} className="text-muted-foreground/60" />
          <h3 className="font-display font-semibold text-foreground">No employees match your criteria</h3>
          <p className="text-xs text-muted-foreground max-w-sm">
            {hasActiveFilters
              ? "Try adjusting your search terms or clearing your role and status filters."
              : "No team members have been added to the firm yet."}
          </p>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters} className="mt-2">
              <RotateCcw size={14} className="mr-1.5" /> Clear filters
            </Button>
          )}
        </div>
      )}

      {/* Employee Presentation: Grid View vs Table View */}
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
              canEdit={canManage}
              onSelect={handleSelectEmployee}
              onEdit={(emp) => setEditingEmployee(emp)}
              onMessage={handleMessage}
              isMessagingPending={createDirectChat.isPending}
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
