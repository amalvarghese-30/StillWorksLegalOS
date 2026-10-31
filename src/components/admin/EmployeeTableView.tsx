import React from "react";
import {
  MoreVertical,
  Mail,
  Phone,
  BriefcaseBusiness,
  ClipboardList,
  CheckCircle2,
  Clock3,
  AlertTriangle,
  User,
  Pencil,
  Briefcase,
  CheckSquare,
  MessageSquare,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmployeeAvatar } from "./EmployeeAvatar";
import { usePresence } from "@/lib/presence";
import { cn } from "@/lib/utils";
import { SortHeaderButton } from "@/components/common/table/SortableTableHeader";
import { type SortDirection } from "@/lib/sorting";
import type { EmployeeItem, EmployeeWorkload } from "@/services/admin";

interface EmployeeTableViewProps {
  employees: EmployeeItem[];
  workloadById: Map<string, EmployeeWorkload>;
  selectedIds: string[];
  onToggleSelect?: (id: string) => void;
  onSelectAll?: (selected: boolean) => void;
  canEdit?: boolean;
  onSelect: (emp: EmployeeItem) => void;
  onEdit: (emp: EmployeeItem) => void;
  onMessage: (empId: string) => void;
  onViewCases?: (emp: EmployeeItem) => void;
  onViewTasks?: (emp: EmployeeItem) => void;
  isMessagingPending?: boolean;
  sortOption?: string;
  sortKey?: string | null;
  sortDirection?: SortDirection;
  onSort?: (sortKey: string) => void;
}

function formatRole(role?: string): string {
  if (!role) return "Staff";
  if (role === "admin") return "Admin";
  if (role === "lawyer" || role === "advocate") return "Advocate";
  if (role === "paralegal") return "Paralegal";
  if (role === "clerk") return "Clerk";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function EmployeeTableView({
  employees,
  workloadById,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  canEdit,
  onSelect,
  onEdit,
  onMessage,
  onViewCases,
  onViewTasks,
  isMessagingPending,
  sortOption,
  sortKey,
  sortDirection,
  onSort,
}: EmployeeTableViewProps) {
  const { isOnline } = usePresence();

  const allSelected = employees.length > 0 && employees.every((e) => selectedIds.includes(e._id));
  const someSelected = selectedIds.length > 0 && !allSelected;

  return (
    <div className="w-full">
      {/* ─────────────────────────────────────────────────────────────
          1. DESKTOP VIEW (>= lg)
          Fluid columns without rigid min-w-[...] constraints.
          Fits cleanly across 1024px, 1280px, 1440px, 1920px.
         ───────────────────────────────────────────────────────────── */}
      <div className="hidden lg:block w-full">
        <table className="w-full border-separate border-spacing-y-2 text-left">
          <thead>
            <tr className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {/* 1. Selection Checkbox */}
              <th className="py-2.5 px-2 w-9 text-center">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={(val) => onSelectAll?.(Boolean(val))}
                  aria-label="Select all employees"
                  className="translate-y-0.5"
                />
              </th>

              {/* 2. Employee */}
              <th className="py-2.5 px-2">
                <SortHeaderButton
                  sortKey="name"
                  currentSortKey={sortKey}
                  currentDirection={sortDirection}
                  onSort={onSort}
                >
                  Employee
                </SortHeaderButton>
              </th>

              {/* 3. Role / Designation */}
              <th className="py-2.5 px-2">
                <SortHeaderButton
                  sortKey="role"
                  currentSortKey={sortKey}
                  currentDirection={sortDirection}
                  onSort={onSort}
                >
                  Role
                </SortHeaderButton>
              </th>

              {/* 4. Employee Code (Desktop wide only) */}
              <th className="py-2.5 px-2 whitespace-nowrap hidden xl:table-cell">
                <SortHeaderButton
                  sortKey="employeeCode"
                  currentSortKey={sortKey}
                  currentDirection={sortDirection}
                  onSort={onSort}
                >
                  Code
                </SortHeaderButton>
              </th>

              {/* 5. Contact */}
              <th className="py-2.5 px-2 whitespace-nowrap">
                <SortHeaderButton
                  sortKey="contact"
                  currentSortKey={sortKey}
                  currentDirection={sortDirection}
                  onSort={onSort}
                >
                  Contact
                </SortHeaderButton>
              </th>

              {/* 6. Cases */}
              <th className="py-2.5 px-2 whitespace-nowrap text-center">
                <SortHeaderButton
                  sortKey="cases"
                  currentSortKey={sortKey}
                  currentDirection={sortDirection}
                  onSort={onSort}
                  align="center"
                >
                  Cases
                </SortHeaderButton>
              </th>

              {/* 7. Total Tasks */}
              <th className="py-2.5 px-2 whitespace-nowrap text-center">
                <SortHeaderButton
                  sortKey="totalTasks"
                  currentSortKey={sortKey}
                  currentDirection={sortDirection}
                  onSort={onSort}
                  align="center"
                >
                  Total
                </SortHeaderButton>
              </th>

              {/* 8. Completed */}
              <th className="py-2.5 px-2 whitespace-nowrap text-center">
                <SortHeaderButton
                  sortKey="completedTasks"
                  currentSortKey={sortKey}
                  currentDirection={sortDirection}
                  onSort={onSort}
                  align="center"
                >
                  Done
                </SortHeaderButton>
              </th>

              {/* 9. Pending */}
              <th className="py-2.5 px-2 text-center whitespace-nowrap bg-amber-500/10 text-amber-900 dark:text-amber-200 font-bold rounded-t-lg border-b border-amber-300/40">
                <SortHeaderButton
                  sortKey="pendingTasks"
                  currentSortKey={sortKey}
                  currentDirection={sortDirection}
                  onSort={onSort}
                  align="center"
                >
                  Pending
                </SortHeaderButton>
              </th>

              {/* 10. Overdue */}
              <th className="py-2.5 px-2 whitespace-nowrap text-center">
                <SortHeaderButton
                  sortKey="overdueTasks"
                  currentSortKey={sortKey}
                  currentDirection={sortDirection}
                  onSort={onSort}
                  align="center"
                >
                  Overdue
                </SortHeaderButton>
              </th>

              {/* 11. Workload */}
              <th className="py-2.5 px-2 whitespace-nowrap">
                <SortHeaderButton
                  sortKey="workload"
                  currentSortKey={sortKey}
                  currentDirection={sortDirection}
                  onSort={onSort}
                >
                  Workload
                </SortHeaderButton>
              </th>

              {/* 12. Status */}
              <th className="py-2.5 px-2 whitespace-nowrap text-center">
                <SortHeaderButton
                  sortKey="status"
                  currentSortKey={sortKey}
                  currentDirection={sortDirection}
                  onSort={onSort}
                  align="center"
                >
                  Status
                </SortHeaderButton>
              </th>

              {/* 13. Actions */}
              <th className="py-2.5 px-2 text-center whitespace-nowrap w-10">Actions</th>
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
                    "group bg-card hover:bg-muted/30 transition-all shadow-2xs h-[60px] cursor-pointer",
                    isSelected && "bg-primary/5 hover:bg-primary/10"
                  )}
                >
                  {/* 1. Selection Checkbox */}
                  <td
                    className="py-2 px-2 text-center first:rounded-l-xl first:border-l border-y border-border/70"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleSelect?.(emp._id)}
                      aria-label={`Select ${emp.name}`}
                      className="translate-y-0.5"
                    />
                  </td>

                  {/* 2. Employee (Avatar, Name, Email, Code fallback) */}
                  <td className="py-2 px-2 border-y border-border/70">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <EmployeeAvatar
                        name={emp.name}
                        avatarUrl={emp.avatarUrl}
                        size="sm"
                        status={effectiveStatus}
                        showStatus={true}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors truncate">
                            {emp.name}
                          </span>
                          <span className="xl:hidden font-mono text-[9px] text-muted-foreground bg-muted/60 px-1 py-0.2 rounded">
                            {empCode}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {emp.email}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* 3. Role / Designation */}
                  <td className="py-2 px-2 border-y border-border/70">
                    <div className="flex flex-col items-start gap-0.5">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/80 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800 whitespace-nowrap">
                        {formatRole(emp.role)}
                      </span>
                      {emp.title && emp.title !== formatRole(emp.role) && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-[110px]">
                          {emp.title}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 4. Employee Code (xl desktop only) */}
                  <td className="py-2 px-2 border-y border-border/70 font-mono text-xs font-semibold text-foreground whitespace-nowrap tracking-tight hidden xl:table-cell">
                    {empCode}
                  </td>

                  {/* 5. Contact (Phone) */}
                  <td className="py-2 px-2 border-y border-border/70 whitespace-nowrap">
                    {emp.phone ? (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone size={10} className="text-muted-foreground/60 shrink-0" />
                        <span className="text-[11px]">{emp.phone}</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground/60">—</span>
                    )}
                  </td>

                  {/* 6. Cases */}
                  <td className="py-2 px-2 border-y border-border/70 whitespace-nowrap text-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewCases?.(emp);
                      }}
                      className="inline-flex items-center gap-1 hover:text-primary transition-colors cursor-pointer"
                      title={`View ${emp.name}'s assigned cases`}
                    >
                      <BriefcaseBusiness size={12} className="text-purple-600 dark:text-purple-400 shrink-0" />
                      <span className="font-semibold text-xs text-foreground">{activeCases}</span>
                    </button>
                  </td>

                  {/* 7. Total Tasks */}
                  <td className="py-2 px-2 border-y border-border/70 whitespace-nowrap text-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewTasks?.(emp);
                      }}
                      className="inline-flex items-center gap-1 hover:text-primary transition-colors cursor-pointer"
                      title={`View ${emp.name}'s tasks`}
                    >
                      <ClipboardList size={12} className="text-blue-600 dark:text-blue-400 shrink-0" />
                      <span className="font-semibold text-xs text-foreground">{totalTasks}</span>
                    </button>
                  </td>

                  {/* 8. Completed */}
                  <td className="py-2 px-2 border-y border-border/70 whitespace-nowrap text-center">
                    <div className="inline-flex items-center gap-1">
                      <CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="font-semibold text-xs text-emerald-700 dark:text-emerald-400">{completedTasks}</span>
                    </div>
                  </td>

                  {/* 9. Pending */}
                  <td className="py-2 px-2 text-center border-y border-amber-200/50 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-950/20 group-hover:bg-amber-100/70 dark:group-hover:bg-amber-900/30 whitespace-nowrap transition-colors">
                    <div className="inline-flex items-center justify-center gap-1">
                      <Clock3 size={12} className="text-amber-600 dark:text-amber-400 shrink-0" />
                      <span className="font-bold text-xs text-amber-700 dark:text-amber-400">{pendingTasks}</span>
                    </div>
                  </td>

                  {/* 10. Overdue */}
                  <td className="py-2 px-2 border-y border-border/70 whitespace-nowrap text-center">
                    <div className="inline-flex items-center gap-1">
                      <AlertTriangle
                        size={12}
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
                  <td className="py-2 px-2 border-y border-border/70 whitespace-nowrap">
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-semibold text-foreground">{workloadScore}%</span>
                      </div>
                      <div className="h-1.5 w-14 rounded-full bg-muted overflow-hidden">
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
                  <td className="py-2 px-2 border-y border-border/70 whitespace-nowrap text-center">
                    {effectiveStatus === "online" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Online
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted/60 text-muted-foreground border border-border/70">
                        <span className="size-1.5 rounded-full bg-muted-foreground/60" />
                        Offline
                      </span>
                    )}
                  </td>

                  {/* 13. Actions */}
                  <td
                    className="py-2 px-2 text-center last:rounded-r-xl last:border-r border-y border-border/70 whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground rounded-lg"
                          title="Actions"
                        >
                          <MoreVertical size={14} />
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

      {/* ─────────────────────────────────────────────────────────────
          2. TABLET & MOBILE RESPONSIVE CARDS VIEW (< lg)
          Eliminates horizontal scrolling on mobile and tablet screens.
         ───────────────────────────────────────────────────────────── */}
      <div className="lg:hidden space-y-2.5">
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
            <div
              key={emp._id}
              onClick={() => onSelect(emp)}
              className={cn(
                "rounded-xl border border-border/80 bg-card p-3.5 shadow-soft transition-all cursor-pointer space-y-3",
                isSelected && "border-primary bg-primary/5"
              )}
            >
              {/* Top row: Checkbox, Avatar, Name, Role, Actions */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleSelect?.(emp._id)}
                      aria-label={`Select ${emp.name}`}
                    />
                  </div>
                  <EmployeeAvatar
                    name={emp.name}
                    avatarUrl={emp.avatarUrl}
                    size="sm"
                    status={effectiveStatus}
                    showStatus={true}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-xs text-foreground truncate">{emp.name}</span>
                      <span className="font-mono text-[9px] text-muted-foreground bg-muted px-1 rounded">{empCode}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">{emp.email}</div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/80 dark:bg-blue-950/50 dark:text-blue-300">
                    {formatRole(emp.role)}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground">
                        <MoreVertical size={14} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => onSelect(emp)} className="gap-2">
                        <User size={14} /> View Profile
                      </DropdownMenuItem>
                      {canEdit && (
                        <DropdownMenuItem onClick={() => onEdit(emp)} className="gap-2">
                          <Pencil size={14} /> Edit Employee
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onViewCases?.(emp)} className="gap-2">
                        <Briefcase size={14} /> Assigned Cases ({activeCases})
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onViewTasks?.(emp)} className="gap-2">
                        <CheckSquare size={14} /> Assigned Tasks ({totalTasks})
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onMessage(emp._id)} disabled={isMessagingPending} className="gap-2">
                        <MessageSquare size={14} /> Direct Message
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Middle row: Stats pills */}
              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border/50 text-center text-xs">
                <div
                  className="rounded-lg bg-muted/40 p-1.5 cursor-pointer hover:bg-muted/70 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewCases?.(emp);
                  }}
                >
                  <span className="text-[10px] text-muted-foreground block">Cases</span>
                  <span className="font-semibold text-foreground">{activeCases}</span>
                </div>
                <div
                  className="rounded-lg bg-amber-500/10 p-1.5 cursor-pointer hover:bg-amber-500/20 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewTasks?.(emp);
                  }}
                >
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 block font-medium">Pending</span>
                  <span className="font-bold text-amber-700 dark:text-amber-400">{pendingTasks}</span>
                </div>
                <div
                  className="rounded-lg bg-emerald-500/10 p-1.5 cursor-pointer hover:bg-emerald-500/20 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewTasks?.(emp);
                  }}
                >
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block font-medium">Done</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">{completedTasks}</span>
                </div>
                <div className="rounded-lg bg-muted/40 p-1.5">
                  <span className="text-[10px] text-muted-foreground block">Load</span>
                  <span className="font-semibold text-foreground">{workloadScore}%</span>
                </div>
              </div>

              {/* Bottom row: Contact & Status */}
              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                {emp.phone ? (
                  <div className="flex items-center gap-1">
                    <Phone size={10} className="text-muted-foreground/60" />
                    <span>{emp.phone}</span>
                  </div>
                ) : (
                  <span />
                )}
                {effectiveStatus === "online" ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Online
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground">Offline</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
