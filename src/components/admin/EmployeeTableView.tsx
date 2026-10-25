import React from "react";
import {
  BriefcaseBusiness,
  ClipboardList,
  CheckCircle2,
  Clock3,
  AlertTriangle,
  Mail,
  Phone,
  MessageSquare,
  Pencil,
  MoreVertical,
  User,
  Briefcase,
  CheckSquare,
  ChevronDown,
  ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmployeeAvatar } from "./EmployeeAvatar";
import { formatRole } from "./EmployeeCard";
import type { EmployeeRecord } from "@/services/admin";
import type { WorkloadItem } from "@/services/reports";
import { usePresence } from "@/lib/presence";
import { cn } from "@/lib/utils";

interface EmployeeTableViewProps {
  employees: EmployeeRecord[];
  workloadById: Map<string, WorkloadItem>;
  selectedIds?: string[];
  onToggleSelect?: (employeeId: string) => void;
  onSelectAll?: (selectAll: boolean) => void;
  canEdit?: boolean;
  onSelect: (employee: EmployeeRecord) => void;
  onEdit: (employee: EmployeeRecord) => void;
  onMessage: (employeeId: string) => void;
  onViewCases?: (employee: EmployeeRecord) => void;
  onViewTasks?: (employee: EmployeeRecord) => void;
  isMessagingPending?: boolean;
  sortOption?: string;
  onSort?: (sortKey: string) => void;
}

export function EmployeeTableView({
  employees,
  workloadById,
  selectedIds = [],
  onToggleSelect,
  onSelectAll,
  canEdit = true,
  onSelect,
  onEdit,
  onMessage,
  onViewCases,
  onViewTasks,
  isMessagingPending = false,
  sortOption,
  onSort,
}: EmployeeTableViewProps) {
  const { isOnline } = usePresence();

  const allSelected = employees.length > 0 && employees.every((e) => selectedIds.includes(e._id));
  const someSelected = selectedIds.length > 0 && !allSelected;

  return (
    <div className="w-full overflow-x-auto pb-2">
      <table className="w-full border-separate border-spacing-y-2 text-left">
        <thead>
          <tr className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            {/* 1. Selection Checkbox */}
            <th className="py-2.5 px-3 w-10 text-center">
              <Checkbox
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={(val) => onSelectAll?.(Boolean(val))}
                aria-label="Select all employees"
                className="translate-y-0.5"
              />
            </th>

            {/* 2. Employee */}
            <th className="py-2.5 px-3 min-w-[200px]">
              <button
                type="button"
                onClick={() => onSort?.(sortOption === "name_asc" ? "name_desc" : "name_asc")}
                className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
              >
                <span>Employee</span>
                <ArrowUpDown size={11} className="opacity-60" />
              </button>
            </th>

            {/* 3. Role / Designation */}
            <th className="py-2.5 px-3 min-w-[150px]">
              <button
                type="button"
                onClick={() => onSort?.("role")}
                className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
              >
                <span>Role / Designation</span>
                <ArrowUpDown size={11} className="opacity-60" />
              </button>
            </th>

            {/* 4. Employee Code */}
            <th className="py-2.5 px-3 whitespace-nowrap min-w-[110px]">Employee Code</th>

            {/* 5. Contact */}
            <th className="py-2.5 px-3 min-w-[180px]">Contact</th>

            {/* 6. Cases */}
            <th className="py-2.5 px-3 whitespace-nowrap">
              <button
                type="button"
                onClick={() => onSort?.("cases_desc")}
                className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
              >
                <span>Cases</span>
                <ArrowUpDown size={11} className="opacity-60" />
              </button>
            </th>

            {/* 7. Total Tasks */}
            <th className="py-2.5 px-3 whitespace-nowrap">Total Tasks</th>

            {/* 8. Completed */}
            <th className="py-2.5 px-3 whitespace-nowrap">Completed</th>

            {/* 9. Pending (softly highlighted) */}
            <th className="py-2.5 px-3 text-center whitespace-nowrap bg-amber-500/10 text-amber-900 dark:text-amber-200 font-bold rounded-t-lg border-b border-amber-300/40">
              <button
                type="button"
                onClick={() => onSort?.("tasks_desc")}
                className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity cursor-pointer"
              >
                <span>Pending</span>
                <ArrowUpDown size={11} className="opacity-70" />
              </button>
            </th>

            {/* 10. Overdue */}
            <th className="py-2.5 px-3 whitespace-nowrap">
              <button
                type="button"
                onClick={() => onSort?.("overdue_desc")}
                className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
              >
                <span>Overdue</span>
                <ArrowUpDown size={11} className="opacity-60" />
              </button>
            </th>

            {/* 11. Workload */}
            <th className="py-2.5 px-3 min-w-[110px] whitespace-nowrap">
              <button
                type="button"
                onClick={() => onSort?.(sortOption === "workload_desc" ? "workload_asc" : "workload_desc")}
                className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
              >
                <span>Workload</span>
                <ChevronDown size={12} className="opacity-70" />
              </button>
            </th>

            {/* 12. Status */}
            <th className="py-2.5 px-3 whitespace-nowrap">Status</th>

            {/* 13. Actions */}
            <th className="py-2.5 px-3 text-center whitespace-nowrap w-12">Actions</th>
          </tr>
        </thead>

        <tbody>
          {employees.map((emp) => {
            const workload = workloadById.get(emp._id);
            const activeCases = workload?.activeCases ?? 0;
            const pendingTasks = workload?.pendingTasks ?? 0;
            const completedTasks = workload?.completedTasks ?? 0;
            const totalTasks = workload?.totalTasks ?? (pendingTasks + completedTasks);
            const overdueTasks = workload?.overdueTasks ?? 0;
            const workloadScore = workload?.workload ?? (totalTasks > 0 ? Math.round((pendingTasks / totalTasks) * 100) : 0);

            const empCode = `EMP-${emp._id.slice(-4).toUpperCase()}`;
            const online = isOnline(emp._id);
            const effectiveStatus = online ? "online" : (emp.status === "online" ? "offline" : (emp.status || "offline"));
            const isSelected = selectedIds.includes(emp._id);

            return (
              <tr
                key={emp._id}
                onClick={() => onSelect(emp)}
                className={cn(
                  "group bg-card hover:bg-muted/30 transition-all shadow-2xs h-[64px] cursor-pointer",
                  isSelected && "bg-primary/5 hover:bg-primary/10"
                )}
              >
                {/* 1. Selection Checkbox */}
                <td
                  className="py-2.5 px-3 text-center first:rounded-l-xl first:border-l border-y border-border/70"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleSelect?.(emp._id)}
                    aria-label={`Select ${emp.name}`}
                    className="translate-y-0.5"
                  />
                </td>

                {/* 2. Employee (Avatar, Name, Email) */}
                <td className="py-2.5 px-3 border-y border-border/70">
                  <div className="flex items-center gap-3">
                    <EmployeeAvatar
                      name={emp.name}
                      avatarUrl={emp.avatarUrl}
                      size="sm"
                      status={effectiveStatus}
                      showStatus={true}
                    />
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors truncate">
                        {emp.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {emp.email}
                      </div>
                    </div>
                  </div>
                </td>

                {/* 3. Role / Designation */}
                <td className="py-2.5 px-3 border-y border-border/70">
                  <div className="flex flex-col items-start gap-0.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/80 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800 whitespace-nowrap">
                      {formatRole(emp.role)}
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate max-w-[140px]">
                      {emp.title || formatRole(emp.role)}
                    </span>
                  </div>
                </td>

                {/* 4. Employee Code */}
                <td className="py-2.5 px-3 border-y border-border/70 font-mono text-xs font-semibold text-foreground whitespace-nowrap tracking-tight">
                  {empCode}
                </td>

                {/* 5. Contact (Phone & Email) */}
                <td className="py-2.5 px-3 border-y border-border/70">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                      <Phone size={11} className="text-muted-foreground/60 shrink-0" />
                      <span>{emp.phone || "—"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/80 truncate max-w-[180px]">
                      <Mail size={11} className="text-muted-foreground/60 shrink-0" />
                      <span className="truncate">{emp.email}</span>
                    </div>
                  </div>
                </td>

                {/* 6. Cases */}
                <td className="py-2.5 px-3 border-y border-border/70 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewCases?.(emp);
                    }}
                    className="inline-flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer"
                    title={`View ${emp.name}'s assigned cases`}
                  >
                    <BriefcaseBusiness size={13} className="text-purple-600 dark:text-purple-400 shrink-0" />
                    <span className="font-semibold text-xs text-foreground">{activeCases}</span>
                  </button>
                </td>

                {/* 7. Total Tasks */}
                <td className="py-2.5 px-3 border-y border-border/70 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewTasks?.(emp);
                    }}
                    className="inline-flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer"
                    title={`View ${emp.name}'s tasks`}
                  >
                    <ClipboardList size={13} className="text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="font-semibold text-xs text-foreground">{totalTasks}</span>
                  </button>
                </td>

                {/* 8. Completed */}
                <td className="py-2.5 px-3 border-y border-border/70 whitespace-nowrap">
                  <div className="inline-flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="font-semibold text-xs text-emerald-700 dark:text-emerald-400">{completedTasks}</span>
                  </div>
                </td>

                {/* 9. Pending (softly highlighted with amber background) */}
                <td className="py-2.5 px-3 text-center border-y border-amber-200/50 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-950/20 group-hover:bg-amber-100/70 dark:group-hover:bg-amber-900/30 whitespace-nowrap transition-colors">
                  <div className="inline-flex items-center justify-center gap-1.5">
                    <Clock3 size={13} className="text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="font-bold text-xs text-amber-700 dark:text-amber-400">{pendingTasks}</span>
                  </div>
                </td>

                {/* 10. Overdue */}
                <td className="py-2.5 px-3 border-y border-border/70 whitespace-nowrap">
                  <div className="inline-flex items-center gap-1.5">
                    <AlertTriangle
                      size={13}
                      className={overdueTasks > 0 ? "text-destructive shrink-0" : "text-muted-foreground/40 shrink-0"}
                    />
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        overdueTasks > 0 ? "text-destructive font-bold" : "text-muted-foreground"
                      )}
                    >
                      {overdueTasks}
                    </span>
                  </div>
                </td>

                {/* 11. Workload */}
                <td className="py-2.5 px-3 border-y border-border/70 whitespace-nowrap">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground text-[11px]">{workloadScore}%</span>
                    </div>
                    <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          workloadScore < 40 ? "bg-emerald-500" : workloadScore < 70 ? "bg-amber-500" : "bg-destructive"
                        )}
                        style={{ width: `${Math.min(100, workloadScore)}%` }}
                      />
                    </div>
                  </div>
                </td>

                {/* 12. Status */}
                <td className="py-2.5 px-3 border-y border-border/70 whitespace-nowrap">
                  {effectiveStatus === "online" ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                      <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Online
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted/60 text-muted-foreground border border-border/70">
                      <span className="size-1.5 rounded-full bg-muted-foreground/60" />
                      Offline
                    </span>
                  )}
                </td>

                {/* 13. Actions */}
                <td
                  className="py-2.5 px-3 text-center last:rounded-r-xl last:border-r border-y border-border/70 whitespace-nowrap"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground rounded-lg"
                        title="Actions"
                      >
                        <MoreVertical size={16} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => onSelect(emp)} className="gap-2 cursor-pointer">
                        <User size={14} className="text-muted-foreground" />
                        <span>View Profile</span>
                      </DropdownMenuItem>

                      {canEdit && (
                        <DropdownMenuItem onClick={() => onEdit(emp)} className="gap-2 cursor-pointer">
                          <Pencil size={14} className="text-muted-foreground" />
                          <span>Edit Employee</span>
                        </DropdownMenuItem>
                      )}

                      <DropdownMenuSeparator />

                      <DropdownMenuItem
                        onClick={() => onViewCases?.(emp)}
                        className="gap-2 cursor-pointer"
                      >
                        <Briefcase size={14} className="text-muted-foreground" />
                        <span>Assigned Cases ({activeCases})</span>
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() => onViewTasks?.(emp)}
                        className="gap-2 cursor-pointer"
                      >
                        <CheckSquare size={14} className="text-muted-foreground" />
                        <span>Assigned Tasks ({totalTasks})</span>
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />

                      <DropdownMenuItem
                        onClick={() => onMessage(emp._id)}
                        disabled={isMessagingPending}
                        className="gap-2 cursor-pointer"
                      >
                        <MessageSquare size={14} className="text-muted-foreground" />
                        <span>Direct Message</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            );
          })}

          {employees.length === 0 && (
            <tr>
              <td colSpan={13} className="py-12 text-center text-muted-foreground rounded-xl border border-dashed border-border bg-card">
                No employees found matching the active filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
