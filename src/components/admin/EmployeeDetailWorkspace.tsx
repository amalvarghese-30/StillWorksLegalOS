import { useState, useMemo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Briefcase,
  CheckSquare,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  Mail,
  Phone,
  Shield,
  MessageSquare,
  Pencil,
  KeyRound,
  ExternalLink,
  Search,
  Filter,
  Activity,
  Layers,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  FileText,
  UserCheck,
  User,
  History,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusPill, toneForStatus } from "@/components/common/StatusPill";
import { EmployeeAvatar } from "./EmployeeAvatar";
import { formatRole } from "./EmployeeCard";
import { useEmployeeDetail, type EmployeeRecord } from "@/services/admin";
import { useCases, type CaseRecord } from "@/services/cases";
import { useTasks, type TaskRecord } from "@/services/tasks";
import { useDailyEmployeeReport } from "@/services/reports";
import { useCreateDirectChat } from "@/services/chat";
import { TaskDetailDialog } from "@/components/tasks/TaskDetailDialog";
import { cn } from "@/lib/utils";

interface EmployeeDetailWorkspaceProps {
  employeeId: string;
  initialEmployee?: EmployeeRecord;
  onBack: () => void;
  onEdit: (employee: EmployeeRecord) => void;
  canEdit?: boolean;
}

type TabKey = "overview" | "cases" | "tasks" | "activity" | "workload";

export function EmployeeDetailWorkspace({
  employeeId,
  initialEmployee,
  onBack,
  onEdit,
  canEdit = true,
}: EmployeeDetailWorkspaceProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null);

  // Cases filter state
  const [caseSearch, setCaseSearch] = useState("");
  const [caseStatusFilter, setCaseStatusFilter] = useState<string>("All");

  // Tasks filter state
  const [taskSearch, setTaskSearch] = useState("");
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>("all");

  // Fetch full employee detail and workload aggregates from backend
  const { data: detailData, isLoading: isDetailLoading, error: detailError } = useEmployeeDetail(employeeId);
  const employee = detailData?.employee ?? initialEmployee;
  const metrics = detailData?.metrics;
  const recentActivity = detailData?.recentActivity ?? [];

  // Fetch assigned cases
  const { data: casesData, isLoading: isCasesLoading } = useCases(
    { assignedTo: employeeId },
    { enabled: activeTab === "cases" || activeTab === "overview" }
  );
  const cases = casesData?.cases ?? [];

  // Fetch assigned tasks
  const { data: tasksData, isLoading: isTasksLoading } = useTasks(
    { assignedTo: employeeId },
  );
  const tasks = tasksData?.tasks ?? [];

  // Fetch daily report for workload insights
  const { data: dailyReportData } = useDailyEmployeeReport(
    { employeeId },
    activeTab === "workload" || activeTab === "overview"
  );
  const dailyReport = dailyReportData?.reports?.[0];

  // Messaging mutation
  const createDirectChat = useCreateDirectChat();
  const handleMessage = () => {
    if (!employee?._id) return;
    createDirectChat.mutate(
      { userId: employee._id },
      {
        onSuccess: (result) => {
          navigate({ to: "/chat", search: { groupId: result.group._id } });
        },
      }
    );
  };

  // Filtered cases
  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      if (caseStatusFilter !== "All" && c.status !== caseStatusFilter) {
        return false;
      }
      if (caseSearch.trim()) {
        const q = caseSearch.toLowerCase();
        const titleMatch = c.title?.toLowerCase().includes(q);
        const numberMatch = c.number?.toLowerCase().includes(q);
        const practiceMatch = (c.practice || c.category || "")?.toLowerCase().includes(q);
        return titleMatch || numberMatch || practiceMatch;
      }
      return true;
    });
  }, [cases, caseStatusFilter, caseSearch]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (taskStatusFilter !== "all") {
        if (taskStatusFilter === "overdue") {
          const isOverdue = t.status !== "completed" && t.deadline && new Date(t.deadline) < new Date();
          if (!isOverdue) return false;
        } else if (t.status !== taskStatusFilter) {
          return false;
        }
      }
      if (taskSearch.trim()) {
        const q = taskSearch.toLowerCase();
        const titleMatch = t.title?.toLowerCase().includes(q);
        const categoryMatch = t.category?.toLowerCase().includes(q);
        return titleMatch || categoryMatch;
      }
      return true;
    });
  }, [tasks, taskStatusFilter, taskSearch]);

  // Upcoming deadlines from tasks (next 7 days, non-completed)
  const upcomingDeadlinesList = useMemo(() => {
    const now = new Date();
    const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return tasks
      .filter((t) => t.status !== "completed" && t.deadline && new Date(t.deadline) >= now && new Date(t.deadline) <= inSevenDays)
      .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
      .slice(0, 5);
  }, [tasks]);

  const empCode = employee?._id ? `EMP-${employee._id.slice(-4).toUpperCase()}` : "EMP-USER";
  const displayRole = formatRole(employee?.role);

  if (isDetailLoading && !employee) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4">
        <Loader2 size={32} className="animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-medium">Loading employee profile & workload…</p>
      </div>
    );
  }

  if (detailError && !employee) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center max-w-xl mx-auto my-12">
        <AlertTriangle size={32} className="text-destructive mx-auto mb-3" />
        <h3 className="font-display font-semibold text-foreground text-base">Unable to load employee profile</h3>
        <p className="text-helper text-muted-foreground mt-1">
          The requested employee record could not be found or you do not have permission to view it.
        </p>
        <Button variant="outline" className="mt-4" onClick={onBack}>
          <ArrowLeft size={14} className="mr-1.5" /> Return to directory
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Breadcrumb & Return Action */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground -ml-2 h-8 px-2"
          >
            <ArrowLeft size={16} className="mr-1.5" />
            Employees
          </Button>
          <span className="text-muted-foreground/40">/</span>
          <span className="font-display font-medium text-sm text-foreground truncate max-w-[200px] sm:max-w-md">
            {employee?.name}
          </span>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          {canEdit && employee && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onEdit(employee)}
              className="rounded-lg h-8"
            >
              <Pencil size={13} className="mr-1.5" />
              Edit Employee
            </Button>
          )}

          {employee && (
            <Button
              type="button"
              size="sm"
              onClick={handleMessage}
              disabled={createDirectChat.isPending}
              className="gradient-primary text-primary-foreground rounded-lg h-8 shadow-soft"
            >
              <MessageSquare size={13} className="mr-1.5" />
              Direct Message
            </Button>
          )}
        </div>
      </div>

      {/* Main Profile Header Card */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-6 shadow-soft">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <EmployeeAvatar
              name={employee?.name}
              avatarUrl={employee?.avatarUrl}
              size="2xl"
              status={employee?.status}
              showStatus={Boolean(employee?.status)}
              className="shrink-0"
            />
            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  {employee?.name}
                </h1>
                <span className="font-mono text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  {empCode}
                </span>
                <StatusPill tone={toneForStatus(employee?.status)}>
                  {employee?.status || "offline"}
                </StatusPill>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{employee?.title || displayRole}</span>
                <span className="text-muted-foreground/40">•</span>
                <span>{displayRole}</span>
                {employee?.createdAt && (
                  <>
                    <span className="text-muted-foreground/40">•</span>
                    <span className="text-caption">
                      Joined {new Date(employee.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
                    </span>
                  </>
                )}
              </div>

              {/* Contact meta tags */}
              <div className="flex flex-wrap items-center gap-4 pt-1 text-caption text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Mail size={13} className="text-muted-foreground/70" />
                  <span>{employee?.email}</span>
                </div>
                {employee?.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone size={13} className="text-muted-foreground/70" />
                    <span>{employee.phone}</span>
                  </div>
                )}
                {employee?.lastActiveAt && (
                  <div className="flex items-center gap-1.5">
                    <Clock size={13} className="text-muted-foreground/70" />
                    <span>Active {new Date(employee.lastActiveAt).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick High-Level Workload Badges */}
          <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-border/60 pt-4 md:pt-0 md:pl-6 shrink-0">
            <div className="text-center px-2">
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Active Cases</div>
              <div className="font-display text-2xl font-bold text-foreground mt-0.5">
                {metrics?.activeCases ?? cases.length}
              </div>
            </div>
            <div className="h-8 w-px bg-border/60" />
            <div className="text-center px-2">
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Open Tasks</div>
              <div className="font-display text-2xl font-bold text-sky-400 mt-0.5">
                {metrics?.openTasks ?? tasks.filter((t) => t.status !== "completed").length}
              </div>
            </div>
            <div className="h-8 w-px bg-border/60" />
            <div className="text-center px-2">
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Overdue</div>
              <div className={cn(
                "font-display text-2xl font-bold mt-0.5",
                (metrics?.overdueTasks ?? 0) > 0 ? "text-rose-400" : "text-muted-foreground"
              )}>
                {metrics?.overdueTasks ?? 0}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation Strip */}
        <div className="mt-8 flex items-center gap-1 border-b border-border/80 -mx-6 px-6 overflow-x-auto">
          {[
            { key: "overview", label: "Overview", icon: Layers },
            { key: "cases", label: `Assigned Cases (${cases.length})`, icon: Briefcase },
            { key: "tasks", label: `Tasks (${tasks.length})`, icon: CheckSquare },
            { key: "activity", label: "Activity History", icon: Activity },
            { key: "workload", label: "Workload & Operations", icon: TrendingUp },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as TabKey)}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                )}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Operational Metrics Grid with Defined Periods */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-sm font-semibold text-foreground">Operational Workload Summary</h2>
              <span className="text-[11px] text-muted-foreground">Authoritative counts from database</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Active Cases */}
              <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-soft">
                <div className="flex items-center gap-1.5 text-caption font-medium text-muted-foreground">
                  <Briefcase size={13} className="text-indigo-400" />
                  <span>Active Cases</span>
                </div>
                <div className="mt-2 font-display text-2xl font-bold text-foreground">
                  {metrics?.activeCases ?? 0}
                </div>
                <div className="text-[10px] text-muted-foreground/80 mt-0.5">Total matters: {metrics?.totalCases ?? 0}</div>
              </div>

              {/* Open Tasks */}
              <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-soft">
                <div className="flex items-center gap-1.5 text-caption font-medium text-muted-foreground">
                  <CheckSquare size={13} className="text-sky-400" />
                  <span>Open Tasks</span>
                </div>
                <div className="mt-2 font-display text-2xl font-bold text-sky-400">
                  {metrics?.openTasks ?? 0}
                </div>
                <div className="text-[10px] text-muted-foreground/80 mt-0.5">In progress & pending</div>
              </div>

              {/* Overdue */}
              <div className={cn(
                "rounded-xl border p-3.5 shadow-soft transition-colors",
                (metrics?.overdueTasks ?? 0) > 0 ? "border-rose-500/30 bg-rose-500/5" : "border-border/70 bg-card"
              )}>
                <div className="flex items-center gap-1.5 text-caption font-medium text-muted-foreground">
                  <AlertTriangle size={13} className={(metrics?.overdueTasks ?? 0) > 0 ? "text-rose-400" : "text-muted-foreground"} />
                  <span>Overdue</span>
                </div>
                <div className={cn(
                  "mt-2 font-display text-2xl font-bold",
                  (metrics?.overdueTasks ?? 0) > 0 ? "text-rose-400" : "text-foreground"
                )}>
                  {metrics?.overdueTasks ?? 0}
                </div>
                <div className="text-[10px] text-muted-foreground/80 mt-0.5">Past target deadline</div>
              </div>

              {/* Completed Today */}
              <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-soft">
                <div className="flex items-center gap-1.5 text-caption font-medium text-muted-foreground">
                  <CheckCircle2 size={13} className="text-emerald-400" />
                  <span>Done Today</span>
                </div>
                <div className="mt-2 font-display text-2xl font-bold text-emerald-400">
                  {metrics?.completedToday ?? 0}
                </div>
                <div className="text-[10px] text-muted-foreground/80 mt-0.5">Last 24h completions</div>
              </div>

              {/* Completed This Week */}
              <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-soft">
                <div className="flex items-center gap-1.5 text-caption font-medium text-muted-foreground">
                  <TrendingUp size={13} className="text-emerald-400" />
                  <span>Done This Week</span>
                </div>
                <div className="mt-2 font-display text-2xl font-bold text-foreground">
                  {metrics?.completedThisWeek ?? 0}
                </div>
                <div className="text-[10px] text-muted-foreground/80 mt-0.5">Current week activity</div>
              </div>

              {/* Pending Approvals */}
              <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-soft">
                <div className="flex items-center gap-1.5 text-caption font-medium text-muted-foreground">
                  <UserCheck size={13} className="text-amber-400" />
                  <span>Approvals</span>
                </div>
                <div className="mt-2 font-display text-2xl font-bold text-amber-400">
                  {metrics?.pendingApprovals ?? 0}
                </div>
                <div className="text-[10px] text-muted-foreground/80 mt-0.5">Submitted for review</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Upcoming Deadlines Card */}
            <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-soft">
              <div className="flex items-center justify-between pb-3 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-amber-400" />
                  <h3 className="font-display font-semibold text-sm text-foreground">Upcoming Deadlines (Next 7 Days)</h3>
                </div>
                <span className="text-xs text-primary font-medium cursor-pointer" onClick={() => setActiveTab("tasks")}>
                  View all tasks →
                </span>
              </div>

              {upcomingDeadlinesList.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No impending deadlines scheduled for the next 7 days.
                </div>
              ) : (
                <div className="mt-3 divide-y divide-border/40">
                  {upcomingDeadlinesList.map((t) => (
                    <div
                      key={t._id}
                      onClick={() => setSelectedTask(t)}
                      className="py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-muted/20 px-2 rounded-lg transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-xs text-foreground truncate">{t.title}</div>
                        <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {t.caseId ? `Case: ${(t.caseId as any).title || "Matter"}` : t.clientName ? `Client: ${t.clientName}` : "General Task"}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="inline-flex items-center text-[11px] font-mono font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                          {t.deadline ? new Date(t.deadline).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Audit Activity Snapshot */}
            <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-soft">
              <div className="flex items-center justify-between pb-3 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-sky-400" />
                  <h3 className="font-display font-semibold text-sm text-foreground">Recent Activity Stream</h3>
                </div>
                <span className="text-xs text-primary font-medium cursor-pointer" onClick={() => setActiveTab("activity")}>
                  Full history →
                </span>
              </div>

              {recentActivity.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No recorded audit log events for this user yet.
                </div>
              ) : (
                <div className="mt-3 divide-y divide-border/40">
                  {recentActivity.slice(0, 5).map((log) => (
                    <div key={log._id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <div className="font-medium text-foreground">
                          <span className="capitalize font-semibold text-primary">{log.action}</span>
                          {" on "}
                          <span className="text-muted-foreground">{log.resource}</span>
                          {log.resourceName && <span className="text-foreground"> ({log.resourceName})</span>}
                        </div>
                        {log.details && <div className="text-[11px] text-muted-foreground/80 truncate mt-0.5">{log.details}</div>}
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                        {new Date(log.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ASSIGNED CASES */}
      {activeTab === "cases" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search assigned cases by name, number, or practice…"
                  value={caseSearch}
                  onChange={(e) => setCaseSearch(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {["All", "Active", "Urgent", "On Hold", "Closed"].map((st) => (
                <Button
                  key={st}
                  variant={caseStatusFilter === st ? "default" : "outline"}
                  size="sm"
                  className={cn("h-7 px-2.5 text-xs rounded-lg", caseStatusFilter === st && "gradient-primary text-primary-foreground")}
                  onClick={() => setCaseStatusFilter(st)}
                >
                  {st}
                </Button>
              ))}
            </div>
          </div>

          {isCasesLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Loader2 size={24} className="animate-spin text-primary mx-auto mb-2" />
              Loading assigned cases…
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="rounded-xl border border-border/80 bg-card p-12 text-center">
              <Briefcase size={28} className="text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="font-medium text-sm text-foreground">No cases found matching your filters</p>
              <p className="text-xs text-muted-foreground mt-1">This employee currently has no matching cases assigned.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border/80 bg-card overflow-x-auto shadow-soft">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border/80 bg-muted/40 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
                  <tr>
                    <th className="py-3 px-4">Case / Matter</th>
                    <th className="py-3 px-4">Case Number</th>
                    <th className="py-3 px-4">Practice Area</th>
                    <th className="py-3 px-4">Court</th>
                    <th className="py-3 px-4">Next Hearing</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredCases.map((c) => (
                    <tr
                      key={c._id}
                      onClick={() => navigate({ to: "/cases/$caseId", params: { caseId: c._id } })}
                      className="group cursor-pointer hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground group-hover:text-primary transition-colors max-w-xs truncate">
                          {c.title}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground">
                        {c.number}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {c.practice || c.category || "General"}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground max-w-[120px] truncate">
                        {c.court || "—"}
                      </td>
                      <td className="py-3 px-4">
                        {c.nextHearing ? (
                          <span className="font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded text-[11px]">
                            {new Date(c.nextHearing).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <StatusPill tone={toneForStatus(c.status)}>{c.status}</StatusPill>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-primary hover:bg-primary/10 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate({ to: "/cases/$caseId", params: { caseId: c._id } });
                          }}
                        >
                          View Case <ExternalLink size={12} className="ml-1" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ASSIGNED TASKS */}
      {activeTab === "tasks" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search assigned tasks by title or category…"
                  value={taskSearch}
                  onChange={(e) => setTaskSearch(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {[
                { key: "all", label: "All" },
                { key: "pending", label: "Pending" },
                { key: "in_progress", label: "In Progress" },
                { key: "pending_approval", label: "Approval" },
                { key: "completed", label: "Completed" },
                { key: "overdue", label: "Overdue" },
              ].map((st) => (
                <Button
                  key={st.key}
                  variant={taskStatusFilter === st.key ? "default" : "outline"}
                  size="sm"
                  className={cn("h-7 px-2.5 text-xs rounded-lg", taskStatusFilter === st.key && "gradient-primary text-primary-foreground")}
                  onClick={() => setTaskStatusFilter(st.key)}
                >
                  {st.label}
                </Button>
              ))}
            </div>
          </div>

          {isTasksLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Loader2 size={24} className="animate-spin text-primary mx-auto mb-2" />
              Loading assigned tasks…
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="rounded-xl border border-border/80 bg-card p-12 text-center">
              <CheckSquare size={28} className="text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="font-medium text-sm text-foreground">No tasks found matching your filters</p>
              <p className="text-xs text-muted-foreground mt-1">This employee has no matching tasks.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border/80 bg-card overflow-x-auto shadow-soft">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border/80 bg-muted/40 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
                  <tr>
                    <th className="py-3 px-4">Task Title</th>
                    <th className="py-3 px-4">Related Matter</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Deadline</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredTasks.map((t) => {
                    const isOverdue = t.status !== "completed" && t.deadline && new Date(t.deadline) < new Date();
                    return (
                      <tr
                        key={t._id}
                        onClick={() => setSelectedTask(t)}
                        className="group cursor-pointer hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="font-semibold text-foreground group-hover:text-primary transition-colors max-w-sm truncate">
                            {t.title}
                          </div>
                          {t.category && <div className="text-[10px] text-muted-foreground mt-0.5">{t.category}</div>}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground max-w-xs truncate">
                          {t.caseId ? (t.caseId as any).title || "Case Matter" : t.clientName || "—"}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-semibold",
                              t.priority === "High"
                                ? "bg-rose-500/10 text-rose-400"
                                : t.priority === "Medium"
                                ? "bg-amber-500/10 text-amber-400"
                                : "bg-blue-500/10 text-blue-400"
                            )}
                          >
                            {t.priority}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {t.deadline ? (
                            <span
                              className={cn(
                                "font-mono text-[11px] px-1.5 py-0.5 rounded",
                                isOverdue ? "bg-rose-500/10 text-rose-400 font-bold" : "text-muted-foreground bg-muted/60"
                              )}
                            >
                              {new Date(t.deadline).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <StatusPill tone={toneForStatus(t.status)}>{t.status}</StatusPill>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-primary hover:bg-primary/10 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTask(t);
                            }}
                          >
                            Details <ChevronRight size={13} className="ml-0.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ACTIVITY & WORK HISTORY */}
      {activeTab === "activity" && (
        <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-soft">
          <div className="flex items-center justify-between pb-4 border-b border-border/60 mb-4">
            <div>
              <h3 className="font-display font-semibold text-base text-foreground">Chronological Audit Activity</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Authoritative audit log actions associated with this employee account.</p>
            </div>
            <span className="text-xs font-mono text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-md">
              {recentActivity.length} Events Logged
            </span>
          </div>

          {recentActivity.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <History size={28} className="mx-auto mb-2 opacity-50" />
              <p>No audit trail activity recorded for this employee.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {recentActivity.map((log) => (
                <div key={log._id} className="py-3.5 flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-primary capitalize bg-primary/10 px-2 py-0.5 rounded">
                        {log.action}
                      </span>
                      <span className="text-xs font-medium text-foreground">
                        {log.resource}
                      </span>
                      {log.resourceName && (
                        <span className="text-xs text-muted-foreground truncate">
                          — {log.resourceName}
                        </span>
                      )}
                    </div>
                    {log.details && (
                      <p className="text-xs text-muted-foreground font-mono bg-muted/30 p-2 rounded-md">
                        {log.details}
                      </p>
                    )}
                    {log.ip && (
                      <div className="text-[10px] text-muted-foreground/60">
                        IP: {log.ip}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-mono text-muted-foreground">
                      {new Date(log.createdAt).toLocaleDateString()}
                    </div>
                    <div className="text-[10px] text-muted-foreground/60 font-mono">
                      {new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: WORKLOAD & PERFORMANCE */}
      {activeTab === "workload" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Task Completion Health */}
            <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-soft">
              <h3 className="font-display font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400" /> Task Completion Rate
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Completed Tasks</span>
                    <span className="font-semibold text-foreground">{metrics?.completedTasks ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Open / Outstanding</span>
                    <span className="font-semibold text-foreground">{metrics?.openTasks ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Overdue Items</span>
                    <span className={cn("font-semibold", (metrics?.overdueTasks ?? 0) > 0 ? "text-rose-400" : "text-foreground")}>
                      {metrics?.overdueTasks ?? 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Daily Report Breakdown */}
            <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-soft">
              <h3 className="font-display font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
                <Calendar size={16} className="text-indigo-400" /> Today's Operational Status
              </h3>
              {dailyReport ? (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Assigned Today:</span>
                    <span className="font-semibold text-foreground">{dailyReport.metrics?.assignedTodayCount ?? 0}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Completed Today:</span>
                    <span className="font-semibold text-emerald-400">{dailyReport.metrics?.completedTodayCount ?? 0}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Currently Pending:</span>
                    <span className="font-semibold text-foreground">{dailyReport.metrics?.pendingCount ?? 0}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Currently Overdue:</span>
                    <span className="font-semibold text-rose-400">{dailyReport.metrics?.overdueCount ?? 0}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-4">No daily report recorded for today.</p>
              )}
            </div>

            {/* Matter Capacity */}
            <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-soft">
              <h3 className="font-display font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
                <Briefcase size={16} className="text-sky-400" /> Practice Distribution
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Total Cases Assigned:</span>
                  <span className="font-semibold text-foreground">{cases.length}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Active Litigation:</span>
                  <span className="font-semibold text-foreground">
                    {cases.filter((c) => c.status === "Active" || c.status === "Urgent").length}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Closed / Concluded:</span>
                  <span className="font-semibold text-muted-foreground">
                    {cases.filter((c) => c.status === "Closed" || c.status === "Archived").length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Authoritative Task Detail Dialog when any task is clicked */}
      {selectedTask && (
        <TaskDetailDialog
          open={Boolean(selectedTask)}
          onClose={() => setSelectedTask(null)}
          task={selectedTask}
        />
      )}
    </div>
  );
}
