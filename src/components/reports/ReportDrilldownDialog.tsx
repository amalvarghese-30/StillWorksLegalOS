import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  CheckSquare,
  Briefcase,
  Calendar,
  FileText,
  Search,
  ExternalLink,
  Plus,
} from "lucide-react";
import { StatusPill } from "@/components/common/StatusPill";
import { formatSafeDate } from "@/lib/dates";

interface ReportDrilldownDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  type: "tasks" | "cases" | "visits" | "documents";
  tasks?: any[];
  cases?: any[];
  visits?: any[];
  documents?: any[];
  onOpenTask?: (task: any) => void;
  onOpenCase?: (caseId: string) => void;
  onRecordVisit?: () => void;
}

function toneForStatus(status: string): "amber" | "emerald" | "rose" | "blue" | "default" {
  switch (status?.toLowerCase()) {
    case "completed":
    case "approved":
    case "closed":
      return "emerald";
    case "in_progress":
    case "active":
      return "blue";
    case "overdue":
    case "rejected":
      return "rose";
    case "pending":
    case "on_hold":
    default:
      return "amber";
  }
}

export function ReportDrilldownDialog({
  open,
  onClose,
  title,
  type,
  tasks = [],
  cases = [],
  visits = [],
  documents = [],
  onOpenTask,
  onOpenCase,
  onRecordVisit,
}: ReportDrilldownDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredTasks = useMemo(() => {
    if (type !== "tasks") return [];
    return tasks.filter((t) => {
      const matchSearch =
        !searchTerm.trim() ||
        (t.title && t.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.caseName && t.caseName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.caseId?.title && t.caseId.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.assignedTo?.name && t.assignedTo.name.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "pending" && t.status !== "completed") ||
        (statusFilter === "completed" && t.status === "completed") ||
        t.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [tasks, type, searchTerm, statusFilter]);

  const filteredCases = useMemo(() => {
    if (type !== "cases") return [];
    return cases.filter((c) => {
      const matchSearch =
        !searchTerm.trim() ||
        (c.title && c.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.number && c.number.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.court && c.court.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.assignedTo?.name && c.assignedTo.name.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && c.status?.toLowerCase() === "active") ||
        (statusFilter === "closed" && c.status?.toLowerCase() === "closed") ||
        c.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [cases, type, searchTerm, statusFilter]);

  const filteredVisits = useMemo(() => {
    if (type !== "visits") return [];
    return visits.filter((v) => {
      return (
        !searchTerm.trim() ||
        (v.purpose && v.purpose.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (v.notes && v.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (v.handledBy &&
          (typeof v.handledBy === "object" ? v.handledBy.name : String(v.handledBy))
            .toLowerCase()
            .includes(searchTerm.toLowerCase()))
      );
    });
  }, [visits, type, searchTerm]);

  const filteredDocuments = useMemo(() => {
    if (type !== "documents") return [];
    return documents.filter((d) => {
      return (
        !searchTerm.trim() ||
        (d.name && d.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (d.kind && d.kind.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    });
  }, [documents, type, searchTerm]);

  const totalCount =
    type === "tasks"
      ? tasks.length
      : type === "cases"
      ? cases.length
      : type === "visits"
      ? visits.length
      : documents.length;

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : null)}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl p-4 sm:p-6 shadow-lift border-border bg-card">
        <DialogHeader className="border-b border-border pb-3 shrink-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground min-w-0">
              {type === "tasks" && <CheckSquare className="size-5 text-amber-500 shrink-0" />}
              {type === "cases" && <Briefcase className="size-5 text-primary shrink-0" />}
              {type === "visits" && <Calendar className="size-5 text-emerald-500 shrink-0" />}
              {type === "documents" && <FileText className="size-5 text-blue-500 shrink-0" />}
              <span className="truncate">{title}</span>
              <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-semibold num shrink-0">
                {totalCount}
              </span>
            </DialogTitle>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                placeholder={`Search ${type}…`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-border bg-background/50 pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
              />
            </div>

            {(type === "tasks" || type === "cases") && (
              <div className="flex items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-lg border border-border bg-background/50 px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                >
                  <option value="all">All Statuses</option>
                  {type === "tasks" ? (
                    <>
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </>
                  ) : (
                    <>
                      <option value="active">Active</option>
                      <option value="closed">Closed</option>
                    </>
                  )}
                </select>
              </div>
            )}

            {type === "visits" && onRecordVisit && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRecordVisit}
                className="gap-1 h-8 text-xs rounded-lg"
              >
                <Plus size={13} />
                <span>Record Visit</span>
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto min-h-0 py-2">
          {/* TASKS VIEW */}
          {type === "tasks" && (
            filteredTasks.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                <CheckSquare className="size-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="font-semibold text-foreground">No tasks found</p>
                <p className="text-[11px] mt-0.5">No tasks match the active filters or scope.</p>
              </div>
            ) : (
              <div>
                {/* Desktop View */}
                <div className="hidden md:block rounded-xl border border-border">
                  <table className="w-full text-left text-xs table-fixed">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold text-[11px]">
                        <th className="py-2.5 px-3 w-[30%]">Task Title</th>
                        <th className="py-2.5 px-3 w-[22%]">Related Case</th>
                        <th className="py-2.5 px-3 w-[16%]">Assigned To</th>
                        <th className="py-2.5 px-3 w-[14%]">Deadline</th>
                        <th className="py-2.5 px-3 w-[10%]">Status</th>
                        <th className="py-2.5 px-3 text-right w-[8%]">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {filteredTasks.map((t) => {
                        const caseTitle = typeof t.caseId === "object" && t.caseId ? t.caseId.title : t.caseName || "—";
                        const caseNum = typeof t.caseId === "object" && t.caseId ? t.caseId.number : null;
                        const assignees = Array.isArray(t.assignedUsers) && t.assignedUsers.length > 0
                          ? t.assignedUsers.map((u: any) => u.name).join(", ")
                          : t.assignedTo?.name || "Unassigned";

                        return (
                          <tr
                            key={t._id}
                            onClick={() => onOpenTask?.(t)}
                            className="hover:bg-muted/30 cursor-pointer transition-colors"
                          >
                            <td className="py-2.5 px-3 align-top">
                              <p className="font-semibold text-foreground break-words">{t.title}</p>
                              {t.description && (
                                <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{t.description}</p>
                              )}
                            </td>
                            <td className="py-2.5 px-3 align-top text-muted-foreground">
                              <p className="break-words text-foreground font-medium">{caseTitle}</p>
                              {caseNum && <p className="font-mono text-[10px] text-muted-foreground">{caseNum}</p>}
                            </td>
                            <td className="py-2.5 px-3 align-top text-foreground font-medium">
                              <span className="truncate block">{assignees}</span>
                            </td>
                            <td className="py-2.5 px-3 align-top font-mono text-muted-foreground whitespace-nowrap">
                              {formatSafeDate(t.deadline)}
                            </td>
                            <td className="py-2.5 px-3 align-top">
                              <StatusPill tone={toneForStatus(t.status)} className="capitalize text-[10px]">
                                {(t.status || "pending").replace(/_/g, " ")}
                              </StatusPill>
                            </td>
                            <td className="py-2.5 px-3 align-top text-right" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onOpenTask?.(t)}
                                className="h-7 text-xs text-primary px-2"
                              >
                                Open <ExternalLink className="size-3 ml-1" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile / Tablet View */}
                <div className="md:hidden space-y-2">
                  {filteredTasks.map((t) => {
                    const caseTitle = typeof t.caseId === "object" && t.caseId ? t.caseId.title : t.caseName || "—";
                    const assignees = Array.isArray(t.assignedUsers) && t.assignedUsers.length > 0
                      ? t.assignedUsers.map((u: any) => u.name).join(", ")
                      : t.assignedTo?.name || "Unassigned";

                    return (
                      <div
                        key={t._id}
                        onClick={() => onOpenTask?.(t)}
                        className="rounded-xl border border-border/80 bg-card p-3 space-y-2 cursor-pointer hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-xs text-foreground">{t.title}</p>
                          <StatusPill tone={toneForStatus(t.status)} className="capitalize text-[10px] shrink-0">
                            {(t.status || "pending").replace(/_/g, " ")}
                          </StatusPill>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">Case: {caseTitle}</p>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                          <span>Assigned: {assignees}</span>
                          <span className="font-mono">{formatSafeDate(t.deadline)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          )}

          {/* CASES VIEW */}
          {type === "cases" && (
            filteredCases.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                <Briefcase className="size-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="font-semibold text-foreground">No cases found</p>
                <p className="text-[11px] mt-0.5">No active matters matching the criteria.</p>
              </div>
            ) : (
              <div>
                {/* Desktop View */}
                <div className="hidden md:block rounded-xl border border-border">
                  <table className="w-full text-left text-xs table-fixed">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold text-[11px]">
                        <th className="py-2.5 px-3 w-[15%]">Matter No</th>
                        <th className="py-2.5 px-3 w-[30%]">Case Title</th>
                        <th className="py-2.5 px-3 w-[18%]">Practice Area</th>
                        <th className="py-2.5 px-3 w-[15%]">Assigned To</th>
                        <th className="py-2.5 px-3 w-[12%]">Status</th>
                        <th className="py-2.5 px-3 text-right w-[10%]">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {filteredCases.map((c) => {
                        const assignees = Array.isArray(c.assignedUsers) && c.assignedUsers.length > 0
                          ? c.assignedUsers.map((u: any) => u.name).join(", ")
                          : c.assignedTo?.name || "Unassigned";

                        return (
                          <tr
                            key={c._id}
                            onClick={() => onOpenCase?.(c._id)}
                            className="hover:bg-muted/30 cursor-pointer transition-colors"
                          >
                            <td className="py-2.5 px-3 font-mono font-medium text-primary whitespace-nowrap">
                              {c.number}
                            </td>
                            <td className="py-2.5 px-3">
                              <p className="font-semibold text-foreground break-words">{c.title}</p>
                              {c.parties?.[0]?.name && (
                                <p className="text-[11px] text-muted-foreground truncate">
                                  Client: {c.parties[0].name}
                                </p>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground">
                              <span className="truncate block">{c.mainCategory || c.practice || "General Legal"}</span>
                            </td>
                            <td className="py-2.5 px-3 text-foreground font-medium">
                              <span className="truncate block">{assignees}</span>
                            </td>
                            <td className="py-2.5 px-3">
                              <StatusPill tone={toneForStatus(c.status)} className="capitalize text-[10px]">
                                {c.status}
                              </StatusPill>
                            </td>
                            <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onOpenCase?.(c._id)}
                                className="h-7 text-xs text-primary px-2"
                              >
                                View <ExternalLink className="size-3 ml-1" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile / Tablet View */}
                <div className="md:hidden space-y-2">
                  {filteredCases.map((c) => {
                    const assignees = Array.isArray(c.assignedUsers) && c.assignedUsers.length > 0
                      ? c.assignedUsers.map((u: any) => u.name).join(", ")
                      : c.assignedTo?.name || "Unassigned";

                    return (
                      <div
                        key={c._id}
                        onClick={() => onOpenCase?.(c._id)}
                        className="rounded-xl border border-border/80 bg-card p-3 space-y-2 cursor-pointer hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-mono text-[10px] text-primary block">{c.number}</span>
                            <p className="font-semibold text-xs text-foreground mt-0.5">{c.title}</p>
                          </div>
                          <StatusPill tone={toneForStatus(c.status)} className="capitalize text-[10px] shrink-0">
                            {c.status}
                          </StatusPill>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                          <span>{c.practice || "General"}</span>
                          <span>{assignees}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          )}

          {/* VISITS VIEW */}
          {type === "visits" && (
            filteredVisits.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                <Calendar className="size-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="font-semibold text-foreground">No visits recorded</p>
                <p className="text-[11px] mt-0.5">Use "+ Record Visit" to record client office attendance.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredVisits.map((v, idx) => (
                  <div
                    key={v._id || idx}
                    className="rounded-xl border border-border bg-card p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-xs text-foreground">{v.purpose}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">{formatSafeDate(v.visitedAt, "—")}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      <span>Handled by: </span>
                      <span className="font-medium text-foreground">
                        {typeof v.handledBy === "object" ? v.handledBy?.name : v.handledBy || "Partner / Staff"}
                      </span>
                    </div>
                    {v.notes && <p className="text-[11px] text-muted-foreground bg-muted/30 p-2 rounded-lg">{v.notes}</p>}
                  </div>
                ))}
              </div>
            )
          )}

          {/* DOCUMENTS VIEW */}
          {type === "documents" && (
            filteredDocuments.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                <FileText className="size-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="font-semibold text-foreground">No documents filed</p>
                <p className="text-[11px] mt-0.5">No associated documents found for this client scope.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredDocuments.map((d) => (
                  <div
                    key={d._id}
                    className="rounded-xl border border-border bg-card p-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-xs text-foreground truncate">{d.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {d.kind || "Document"} · {formatSafeDate(d.createdAt)}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground shrink-0">
                      {d.state || "Active"}
                    </span>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
