import React from "react";
import {
  Briefcase,
  CheckSquare,
  AlertTriangle,
  CheckCircle2,
  Mail,
  MessageSquare,
  Pencil,
  ChevronRight,
  Shield,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill, toneForStatus } from "@/components/common/StatusPill";
import { EmployeeAvatar } from "./EmployeeAvatar";
import type { EmployeeRecord } from "@/services/admin";
import type { WorkloadItem } from "@/services/reports";
import { cn } from "@/lib/utils";

interface EmployeeCardProps {
  employee: EmployeeRecord;
  workload?: WorkloadItem;
  canEdit?: boolean;
  onSelect: (employee: EmployeeRecord) => void;
  onEdit: (employee: EmployeeRecord) => void;
  onMessage: (employeeId: string) => void;
  isMessagingPending?: boolean;
}

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  senior_advocate: "Senior Advocate",
  junior_advocate: "Junior Advocate",
  legal_assistant: "Legal Assistant",
  office_staff: "Office Staff",
  reception: "Reception",
  intern: "Intern",
  employee: "Staff",
};

export function formatRole(role?: string): string {
  if (!role) return "Staff";
  return ROLE_LABELS[role.toLowerCase()] || role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function EmployeeCard({
  employee,
  workload,
  canEdit = true,
  onSelect,
  onEdit,
  onMessage,
  isMessagingPending = false,
}: EmployeeCardProps) {
  const empCode = `EMP-${employee._id.slice(-4).toUpperCase()}`;
  const displayRole = formatRole(employee.role);
  const activeCases = workload?.activeCases ?? 0;
  const pendingTasks = workload?.pendingTasks ?? 0;
  const completedTasks = workload?.completedTasks ?? 0;
  // A task is overdue if pending workload exceeds a reasonable threshold or if flagged
  const hasHighWorkload = pendingTasks >= 10;

  const handleCardClick = () => {
    onSelect(employee);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(employee);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "group relative flex flex-col justify-between rounded-xl border border-border/80 bg-card p-4.5 text-left transition-all duration-200",
        "hover:border-primary/40 hover:bg-card/95 hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "cursor-pointer"
      )}
    >
      {/* Top row: Avatar, identity, status & actions */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <EmployeeAvatar
              name={employee.name}
              avatarUrl={employee.avatarUrl}
              size="md"
              status={employee.status}
              showStatus={Boolean(employee.status)}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="truncate font-display text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                  {employee.name}
                </h3>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="font-mono text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                  {empCode}
                </span>
                <span className="text-muted-foreground/30 text-xs">•</span>
                <p className="truncate text-caption text-muted-foreground">
                  {employee.title || displayRole}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <StatusPill tone={toneForStatus(employee.status)}>
              {employee.status || "offline"}
            </StatusPill>
          </div>
        </div>

        {/* Email line */}
        <div className="mt-3 flex items-center gap-1.5 text-caption text-muted-foreground truncate">
          <Mail size={12} className="shrink-0 text-muted-foreground/70" />
          <span className="truncate">{employee.email}</span>
        </div>

        {/* Compact Workload Matrix */}
        <div className="mt-3.5 grid grid-cols-3 gap-2">
          {/* Active Cases */}
          <div
            className="flex flex-col items-center justify-center rounded-lg bg-muted/40 p-2 text-center transition-colors group-hover:bg-muted/70"
            title={`${activeCases} active cases assigned`}
          >
            <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <Briefcase size={12} className="text-indigo-400" />
              <span>Cases</span>
            </div>
            <span className="mt-1 font-display text-base font-semibold text-foreground">
              {activeCases}
            </span>
          </div>

          {/* Pending Tasks */}
          <div
            className={cn(
              "flex flex-col items-center justify-center rounded-lg p-2 text-center transition-colors",
              hasHighWorkload ? "bg-amber-500/10 border border-amber-500/20" : "bg-muted/40 group-hover:bg-muted/70"
            )}
            title={`${pendingTasks} pending tasks`}
          >
            <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <CheckSquare size={12} className={hasHighWorkload ? "text-amber-400" : "text-sky-400"} />
              <span>Tasks</span>
            </div>
            <span
              className={cn(
                "mt-1 font-display text-base font-semibold",
                hasHighWorkload ? "text-amber-400" : "text-foreground"
              )}
            >
              {pendingTasks}
            </span>
          </div>

          {/* Completed Tasks */}
          <div
            className="flex flex-col items-center justify-center rounded-lg bg-muted/40 p-2 text-center transition-colors group-hover:bg-muted/70"
            title={`${completedTasks} completed tasks`}
          >
            <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <CheckCircle2 size={12} className="text-emerald-400" />
              <span>Done</span>
            </div>
            <span className="mt-1 font-display text-base font-semibold text-foreground">
              {completedTasks}
            </span>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between gap-2">
        <span className="inline-flex items-center text-caption font-medium text-primary group-hover:translate-x-0.5 transition-transform">
          View Profile
          <ChevronRight size={13} className="ml-0.5" />
        </span>

        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {canEdit && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-caption text-muted-foreground hover:text-foreground hover:bg-muted"
              onClick={() => onEdit(employee)}
              title={`Edit ${employee.name}`}
            >
              <Pencil size={12} className="mr-1" />
              Edit
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-caption text-muted-foreground hover:text-primary hover:bg-primary/10"
            onClick={() => onMessage(employee._id)}
            disabled={isMessagingPending}
            title={`Message ${employee.name}`}
          >
            <MessageSquare size={12} className="mr-1" />
            Chat
          </Button>
        </div>
      </div>
    </div>
  );
}
