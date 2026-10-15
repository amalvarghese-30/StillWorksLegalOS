import React, { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Search, UserCheck, Users, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useEmployees, type EmployeeRecord } from "@/services/admin";
import { useTaskOptions } from "@/services/tasks";
import { cn } from "@/lib/utils";

export interface AssigneeOption {
  _id: string;
  name: string;
  email?: string;
  role?: string;
  avatar?: string;
}

export interface AssigneeMultiSelectProps {
  value: string[] | string;
  onChange: (selectedIds: string[]) => void;
  staffList?: AssigneeOption[];
  placeholder?: string;
  label?: string;
  className?: string;
  disabled?: boolean;
  variant?: "popover" | "inline";
  maxInlineHeight?: string;
}

export function AssigneeMultiSelect({
  value,
  onChange,
  staffList,
  placeholder = "Select assigned staff...",
  className,
  disabled = false,
  variant = "popover",
  maxInlineHeight = "max-h-48",
}: AssigneeMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: empData } = useEmployees(undefined, { enabled: !staffList });
  const { data: taskOptions } = useTaskOptions();

  // Normalize selected IDs to string[]
  const selectedIds: string[] = useMemo(() => {
    if (Array.isArray(value)) {
      return value.map((v) => (typeof v === "object" && v ? (v as any)._id || String(v) : String(v))).filter(Boolean);
    }
    if (typeof value === "string" && value.trim()) {
      if (value.includes(",")) {
        return value.split(",").map((s) => s.trim()).filter(Boolean);
      }
      return [value.trim()];
    }
    return [];
  }, [value]);

  // Combine and deduplicate available staff members
  const employees: AssigneeOption[] = useMemo(() => {
    if (staffList && staffList.length > 0) return staffList;

    const list: AssigneeOption[] = [];
    const seen = new Set<string>();

    if (empData?.employees && Array.isArray(empData.employees)) {
      for (const e of empData.employees) {
        if (!seen.has(e._id)) {
          seen.add(e._id);
          list.push({
            _id: e._id,
            name: e.name,
            email: e.email,
            role: e.role,
            avatar: e.avatar,
          });
        }
      }
    }

    if (taskOptions?.staff && Array.isArray(taskOptions.staff)) {
      for (const s of taskOptions.staff) {
        if (!seen.has(s._id)) {
          seen.add(s._id);
          list.push({
            _id: s._id,
            name: s.name,
          });
        }
      }
    }

    return list;
  }, [staffList, empData, taskOptions]);

  const filteredEmployees = useMemo(() => {
    if (!search.trim()) return employees;
    const q = search.toLowerCase().trim();
    return employees.filter(
      (emp) =>
        emp.name.toLowerCase().includes(q) ||
        (emp.role && emp.role.toLowerCase().includes(q)) ||
        (emp.email && emp.email.toLowerCase().includes(q))
    );
  }, [employees, search]);

  const toggleEmployee = (empId: string) => {
    if (disabled) return;
    const exists = selectedIds.includes(empId);
    const updated = exists ? selectedIds.filter((id) => id !== empId) : [...selectedIds, empId];
    onChange(updated);
  };

  const selectAll = () => {
    if (disabled) return;
    const allFilteredIds = filteredEmployees.map((e) => e._id);
    const combined = Array.from(new Set([...selectedIds, ...allFilteredIds]));
    onChange(combined);
  };

  const clearAll = () => {
    if (disabled) return;
    onChange([]);
  };

  const selectedStaffMembers = useMemo(() => {
    return selectedIds
      .map((id) => employees.find((e) => e._id === id))
      .filter(Boolean) as AssigneeOption[];
  }, [selectedIds, employees]);

  if (variant === "inline") {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center justify-between gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search staff to assign..."
              className="h-8 pl-8 text-xs rounded-md"
              disabled={disabled}
            />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={selectAll}
              disabled={disabled}
              className="text-[11px] font-medium text-primary hover:underline px-1"
            >
              Select All
            </button>
            <span className="text-muted-foreground text-[10px]">·</span>
            <button
              type="button"
              onClick={clearAll}
              disabled={disabled}
              className="text-[11px] font-medium text-muted-foreground hover:text-foreground hover:underline px-1"
            >
              Clear
            </button>
          </div>
        </div>

        <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-1.5 overflow-y-auto pr-1", maxInlineHeight)}>
          {filteredEmployees.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3 text-center col-span-2">No staff members found.</p>
          ) : (
            filteredEmployees.map((emp) => {
              const selected = selectedIds.includes(emp._id);
              return (
                <button
                  key={emp._id}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleEmployee(emp._id)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg border p-2 text-left text-xs transition-colors",
                    selected
                      ? "border-primary/60 bg-primary/10 text-primary font-medium shadow-xs"
                      : "border-border/80 bg-background text-foreground hover:bg-muted/60"
                  )}
                >
                  <span
                    className={cn(
                      "grid size-4 shrink-0 place-items-center rounded border transition-colors",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/50 bg-background"
                    )}
                  >
                    {selected && <Check size={11} strokeWidth={3} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-xs leading-tight font-medium">{emp.name}</p>
                    {emp.role && (
                      <p className="truncate text-[10px] text-muted-foreground capitalize leading-tight mt-0.5">
                        {emp.role.replace(/_/g, " ")}
                      </p>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // Default Popover Variant
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          role="combobox"
          aria-expanded={open}
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
            }
          }}
          className={cn(
            "w-full justify-between h-11 px-3 font-normal rounded-md border border-border bg-background hover:bg-muted/40 cursor-pointer flex items-center transition-colors select-none",
            disabled && "opacity-50 pointer-events-none cursor-not-allowed",
            selectedIds.length > 0 ? "text-foreground" : "text-muted-foreground",
            className
          )}
        >
          <div className="flex items-center gap-2 truncate flex-1 min-w-0 mr-2">
            <Users size={16} className="text-primary shrink-0" />
            {selectedStaffMembers.length === 0 && (
              <span className="truncate text-muted-foreground text-helper">{placeholder}</span>
            )}
            {selectedStaffMembers.length === 1 && (
              <span className="truncate text-helper font-medium text-foreground">
                {selectedStaffMembers[0].name}
                {selectedStaffMembers[0].role && (
                  <span className="text-muted-foreground font-normal ml-1.5 text-xs">
                    ({selectedStaffMembers[0].role.replace(/_/g, " ")})
                  </span>
                )}
              </span>
            )}
            {selectedStaffMembers.length > 1 && (
              <div className="flex items-center gap-1.5 truncate">
                <Badge variant="secondary" className="px-1.5 py-0 text-xs font-semibold shrink-0">
                  {selectedStaffMembers.length} selected
                </Badge>
                <span className="truncate text-xs text-muted-foreground">
                  {selectedStaffMembers.map((s) => s.name).join(", ")}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {selectedIds.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  clearAll();
                }}
                className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground cursor-pointer"
                title="Clear all"
              >
                <X size={13} />
              </button>
            )}
            <ChevronsUpDown size={15} className="text-muted-foreground shrink-0 opacity-60" />
          </div>
        </div>
      </PopoverTrigger>

      <PopoverContent className="w-[320px] sm:w-[380px] p-2.5 rounded-xl shadow-lift border-border bg-popover" align="start">
        {/* Header & Search */}
        <div className="space-y-2 mb-2">
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <UserCheck size={14} className="text-primary" />
              <span>Assign Staff Checklist</span>
            </div>
            <div className="flex items-center gap-1 text-[11px]">
              <button
                type="button"
                onClick={selectAll}
                className="text-primary hover:underline font-medium px-1"
              >
                Select All
              </button>
              <span className="text-muted-foreground text-[10px]">·</span>
              <button
                type="button"
                onClick={clearAll}
                className="text-muted-foreground hover:text-foreground hover:underline px-1"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or role..."
              className="h-8 pl-8 text-xs rounded-md bg-muted/40"
              autoFocus
            />
          </div>
        </div>

        {/* Staff Checklist Items */}
        <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
          {filteredEmployees.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No matching staff found.</p>
          ) : (
            filteredEmployees.map((emp) => {
              const selected = selectedIds.includes(emp._id);
              const initials = emp.name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")
                .toUpperCase();

              return (
                <button
                  key={emp._id}
                  type="button"
                  onClick={() => toggleEmployee(emp._id)}
                  className={cn(
                    "flex items-center gap-2.5 w-full rounded-lg px-2.5 py-2 text-left text-xs transition-colors",
                    selected
                      ? "bg-primary/10 text-primary font-medium border border-primary/30"
                      : "hover:bg-muted/60 text-foreground border border-transparent"
                  )}
                >
                  <span
                    className={cn(
                      "grid size-4 shrink-0 place-items-center rounded border transition-colors",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/60 bg-background"
                    )}
                  >
                    {selected && <Check size={11} strokeWidth={3} />}
                  </span>

                  <div className="size-6 shrink-0 rounded-full bg-primary/20 text-primary font-bold text-[10px] grid place-items-center">
                    {initials || "U"}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="truncate text-xs leading-tight font-medium text-foreground">{emp.name}</p>
                    {emp.role && (
                      <p className="truncate text-[10px] text-muted-foreground capitalize leading-tight mt-0.5">
                        {emp.role.replace(/_/g, " ")}
                      </p>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer info pill */}
        <div className="mt-2 pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground px-1">
          <span>{selectedIds.length} staff selected</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs font-medium text-primary hover:text-primary hover:bg-primary/10"
            onClick={() => setOpen(false)}
          >
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
