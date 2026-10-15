import React from "react";
import {
  Briefcase,
  CheckSquare,
  CheckCircle2,
  Mail,
  Phone,
  MessageSquare,
  Pencil,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill, toneForStatus } from "@/components/common/StatusPill";
import { EmployeeAvatar } from "./EmployeeAvatar";
import { formatRole } from "./EmployeeCard";
import type { EmployeeRecord } from "@/services/admin";
import type { WorkloadItem } from "@/services/reports";
import { cn } from "@/lib/utils";

interface EmployeeTableViewProps {
  employees: EmployeeRecord[];
  workloadById: Map<string, WorkloadItem>;
  canEdit?: boolean;
  onSelect: (employee: EmployeeRecord) => void;
  onEdit: (employee: EmployeeRecord) => void;
  onMessage: (employeeId: string) => void;
  isMessagingPending?: boolean;
}

export function EmployeeTableView({
  employees,
  workloadById,
  canEdit = true,
  onSelect,
  onEdit,
  onMessage,
  isMessagingPending = false,
}: EmployeeTableViewProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/80 bg-card shadow-soft">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border/80 bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="py-3 px-4">Employee</th>
            <th className="py-3 px-4">Role & Designation</th>
            <th className="py-3 px-4">Contact</th>
            <th className="py-3 px-4 text-center">Active Cases</th>
            <th className="py-3 px-4 text-center">Pending Tasks</th>
            <th className="py-3 px-4 text-center">Done</th>
            <th className="py-3 px-4">Status</th>
            <th className="py-3 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {employees.map((emp) => {
            const workload = workloadById.get(emp._id);
            const activeCases = workload?.activeCases ?? 0;
            const pendingTasks = workload?.pendingTasks ?? 0;
            const completedTasks = workload?.completedTasks ?? 0;
            const empCode = `EMP-${emp._id.slice(-4).toUpperCase()}`;

            return (
              <tr
                key={emp._id}
                onClick={() => onSelect(emp)}
                className="group cursor-pointer transition-colors hover:bg-muted/30 focus-within:bg-muted/30"
              >
                {/* Employee Name + Avatar + ID */}
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-3">
                    <EmployeeAvatar
                      name={emp.name}
                      avatarUrl={emp.avatarUrl}
                      size="sm"
                      status={emp.status}
                      showStatus={Boolean(emp.status)}
                    />
                    <div className="min-w-0">
                      <div className="font-display font-medium text-foreground group-hover:text-primary transition-colors truncate">
                        {emp.name}
                      </div>
                      <div className="font-mono text-[10px] text-primary/80 mt-0.5">
                        {empCode}
                      </div>
                    </div>
                  </div>
                </td>

                {/* Role & Designation */}
                <td className="py-3.5 px-4">
                  <div className="font-medium text-foreground text-xs truncate max-w-[180px]">
                    {emp.title || formatRole(emp.role)}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {formatRole(emp.role)}
                  </div>
                </td>

                {/* Contact */}
                <td className="py-3.5 px-4 text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground truncate max-w-[200px]">
                    <Mail size={12} className="shrink-0 text-muted-foreground/60" />
                    <span className="truncate">{emp.email}</span>
                  </div>
                  {emp.phone && (
                    <div className="flex items-center gap-1.5 text-muted-foreground/80 text-[11px] mt-0.5">
                      <Phone size={11} className="shrink-0 text-muted-foreground/60" />
                      <span>{emp.phone}</span>
                    </div>
                  )}
                </td>

                {/* Active Cases */}
                <td className="py-3.5 px-4 text-center font-display font-semibold text-foreground">
                  <span className="inline-flex items-center justify-center rounded-md bg-muted/60 px-2.5 py-1 text-xs">
                    {activeCases}
                  </span>
                </td>

                {/* Pending Tasks */}
                <td className="py-3.5 px-4 text-center font-display font-semibold">
                  <span
                    className={cn(
                      "inline-flex items-center justify-center rounded-md px-2.5 py-1 text-xs",
                      pendingTasks >= 10
                        ? "bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20"
                        : "bg-muted/60 text-foreground"
                    )}
                  >
                    {pendingTasks}
                  </span>
                </td>

                {/* Done Tasks */}
                <td className="py-3.5 px-4 text-center font-display font-semibold text-emerald-400">
                  <span className="inline-flex items-center justify-center rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs">
                    {completedTasks}
                  </span>
                </td>

                {/* Status */}
                <td className="py-3.5 px-4">
                  <StatusPill tone={toneForStatus(emp.status)}>
                    {emp.status || "offline"}
                  </StatusPill>
                </td>

                {/* Actions */}
                <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                      onClick={() => onSelect(emp)}
                      title="View Profile"
                    >
                      <ChevronRight size={16} />
                    </Button>

                    {canEdit && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => onEdit(emp)}
                        title="Edit Employee"
                      >
                        <Pencil size={13} />
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                      onClick={() => onMessage(emp._id)}
                      disabled={isMessagingPending}
                      title="Send Message"
                    >
                      <MessageSquare size={13} />
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
