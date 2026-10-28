import React, { useState, useMemo } from "react";
import {
  Briefcase,
  CheckSquare,
  Calendar,
  FileText,
  Search,
  ExternalLink,
  Clock,
  User,
  Shield,
  X,
  Plus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusPill, toneForStatus } from "@/components/common/StatusPill";
import { formatSafeDate } from "@/lib/dates";

export type DrilldownType = "tasks" | "cases" | "visits" | "documents";

interface ReportDrilldownDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  type: DrilldownType;
  tasks?: any[];
  cases?: any[];
  visits?: any[];
  documents?: any[];
  onOpenTask?: (task: any) => void;
  onOpenCase?: (caseId: string) => void;
  onRecordVisit?: () => void;
}

export function ReportDrilldownDialog({
  open,
  onClose,
  title,
  subtitle,
  type,
  tasks = [],
  cases = [],
  visits = [],
  documents = [],
  onOpenTask,
  onOpenCase,
  onRecordVisit,
}: ReportDrilldownDialogProps) {
  const [search, setSearch] = useState("");

  const filteredTasks = useMemo(() => {
    if (!search.trim()) return tasks;
    const q = search.toLowerCase().trim();
    return tasks.filter((t) => {
      const titleMatch = t.title?.toLowerCase().includes(q);
      const descMatch = t.description?.toLowerCase().includes(q);
      const caseMatch = typeof t.caseId === "object" ? t.caseId?.title?.toLowerCase().includes(q) : false;
      const clientMatch = typeof t.clientId === "object" ? t.clientId?.name?.toLowerCase().includes(q) : false;
      const staffMatch = Array.isArray(t.assignedUsers)
        ? t.assignedUsers.some((u: any) => u.name?.toLowerCase().includes(q))
        : t.assignedTo?.name?.toLowerCase().includes(q);
      return titleMatch || descMatch || caseMatch || clientMatch || staffMatch;
    });
  }, [tasks, search]);

  const filteredCases = useMemo(() => {
    if (!search.trim()) return cases;
    const q = search.toLowerCase().trim();
    return cases.filter((c) => {
      const titleMatch = c.title?.toLowerCase().includes(q);
      const numMatch = c.number?.toLowerCase().includes(q);
      const courtMatch = c.court?.toLowerCase().includes(q);
      const practiceMatch = (c.mainCategory || c.practice || "")?.toLowerCase().includes(q);
      const staffMatch = Array.isArray(c.assignedUsers)
        ? c.assignedUsers.some((u: any) => u.name?.toLowerCase().includes(q))
        : c.assignedTo?.name?.toLowerCase().includes(q);
      return titleMatch || numMatch || courtMatch || practiceMatch || staffMatch;
    });
  }, [cases, search]);

  const filteredVisits = useMemo(() => {
    if (!search.trim()) return visits;
    const q = search.toLowerCase().trim();
    return visits.filter((v) => {
      const purposeMatch = v.purpose?.toLowerCase().includes(q);
      const notesMatch = v.notes?.toLowerCase().includes(q);
      const handledMatch = typeof v.handledBy === "object" ? v.handledBy?.name?.toLowerCase().includes(q) : String(v.handledBy || "").toLowerCase().includes(q);
      return purposeMatch || notesMatch || handledMatch;
    });
  }, [visits, search]);

  const filteredDocuments = useMemo(() => {
    if (!search.trim()) return documents;
    const q = search.toLowerCase().trim();
    return documents.filter((d) => {
      const nameMatch = d.name?.toLowerCase().includes(q);
      const kindMatch = d.kind?.toLowerCase().includes(q);
      const caseMatch = typeof d.caseId === "object" ? d.caseId?.title?.toLowerCase().includes(q) : false;
      return nameMatch || kindMatch || caseMatch;
    });
  }, [documents, search]);

  const totalCount =
    type === "tasks"
      ? tasks.length
      : type === "cases"
      ? cases.length
      : type === "visits"
      ? visits.length
      : documents.length;

  const currentDisplayCount =
    type === "tasks"
      ? filteredTasks.length
      : type === "cases"
      ? filteredCases.length
      : type === "visits"
      ? filteredVisits.length
      : filteredDocuments.length;

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : null)}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col rounded-2xl p-6 shadow-lift border-border bg-card">
        <DialogHeader className="border-b border-border pb-3 shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2.5 text-base font-bold text-foreground">
              {type === "tasks" && <CheckSquare className="size-5 text-amber-500" />}
              {type === "cases" && <Briefcase className="size-5 text-primary" />}
              {type === "visits" && <Calendar className="size-5 text-emerald-500" />}
              {type === "documents" && <FileText className="size-5 text-blue-500" />}
              <span>{title}</span>
              <span className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-semibold num">
                {totalCount} matching {type}
              </span>
            </DialogTitle>
          </div>
          {subtitle && <DialogDescription className="text-xs text-muted-foreground">{subtitle}</DialogDescription>}

          {/* Search bar inside drilldown */}
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                placeholder={`Search ${type}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs rounded-md bg-muted/30 border-border/70"
              />
            </div>
            {type === "visits" && onRecordVisit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onRecordVisit();
                }}
                className="h-8 text-xs gap-1.5 rounded-md"
              >
                <Plus className="size-3.5" /> Record Visit
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
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold text-[11px]">
                      <th className="py-2.5 px-3">Task Title &amp; Description</th>
                      <th className="py-2.5 px-3">Related Case</th>
                      <th className="py-2.5 px-3">Assigned To</th>
                      <th className="py-2.5 px-3">Assigned By</th>
                      <th className="py-2.5 px-3">Deadline</th>
                      <th className="py-2.5 px-3">Priority</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredTasks.map((t) => {
                      const caseTitle = typeof t.caseId === "object" && t.caseId ? t.caseId.title : t.caseName || "—";
                      const caseNum = typeof t.caseId === "object" && t.caseId ? t.caseId.number : null;
                      const assignees = Array.isArray(t.assignedUsers) && t.assignedUsers.length > 0
                        ? t.assignedUsers.map((u: any) => u.name).join(", ")
                        : t.assignedTo?.name || "Unassigned";
                      const assignedBy = typeof t.assignedBy === "object" && t.assignedBy?.name
                        ? t.assignedBy.name
                        : t.createdBy?.name || "Administrator";

                      return (
                        <tr
                          key={t._id}
                          onClick={() => onOpenTask?.(t)}
                          className="hover:bg-muted/30 cursor-pointer transition-colors"
                        >
                          <td className="py-2.5 px-3 max-w-[200px]">
                            <p className="font-semibold text-foreground truncate">{t.title}</p>
                            {t.description && (
                              <p className="text-[11px] text-muted-foreground line-clamp-1">{t.description}</p>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground max-w-[140px]">
                            <p className="truncate text-foreground font-medium">{caseTitle}</p>
                            {caseNum && <p className="font-mono text-[10px] text-muted-foreground">{caseNum}</p>}
                          </td>
                          <td className="py-2.5 px-3 text-foreground font-medium whitespace-nowrap">
                            {assignees}
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                            {assignedBy}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-muted-foreground whitespace-nowrap">
                            {formatSafeDate(t.deadline)}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                t.priority === "High"
                                  ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                                  : t.priority === "Medium"
                                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {t.priority || "Medium"}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <StatusPill tone={toneForStatus(t.status)} className="capitalize text-[10px]">
                              {(t.status || "pending").replace(/_/g, " ")}
                            </StatusPill>
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
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
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold text-[11px]">
                      <th className="py-2.5 px-3">Matter No</th>
                      <th className="py-2.5 px-3">Case Title</th>
                      <th className="py-2.5 px-3">Practice / Category</th>
                      <th className="py-2.5 px-3">Court</th>
                      <th className="py-2.5 px-3">Assigned To</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Next Hearing</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
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
                          <td className="py-2.5 px-3 max-w-[200px]">
                            <p className="font-semibold text-foreground truncate">{c.title}</p>
                            {c.parties?.[0]?.name && (
                              <p className="text-[11px] text-muted-foreground truncate">
                                Client: {c.parties[0].name}
                              </p>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                            {c.mainCategory || c.practice || "General Legal"}
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                            {c.court || "—"}
                          </td>
                          <td className="py-2.5 px-3 text-foreground font-medium whitespace-nowrap">
                            {assignees}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <StatusPill tone={toneForStatus(c.status)} className="capitalize text-[10px]">
                              {c.status}
                            </StatusPill>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-muted-foreground whitespace-nowrap">
                            {formatSafeDate(c.nextHearing)}
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
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
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold text-[11px]">
                      <th className="py-2.5 px-3">Date &amp; Time</th>
                      <th className="py-2.5 px-3">Purpose</th>
                      <th className="py-2.5 px-3">Handled By</th>
                      <th className="py-2.5 px-3">Notes / Summary</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredVisits.map((v, idx) => (
                      <tr key={v._id || idx} className="hover:bg-muted/20">
                        <td className="py-2.5 px-3 font-mono text-muted-foreground whitespace-nowrap">
                          {formatSafeDate(v.visitedAt, "—")}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-foreground">
                          {v.purpose}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                          {typeof v.handledBy === "object" ? v.handledBy?.name : v.handledBy || "Partner / Staff"}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {v.notes || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold text-[11px]">
                      <th className="py-2.5 px-3">Document Name</th>
                      <th className="py-2.5 px-3">Kind / Type</th>
                      <th className="py-2.5 px-3">Related Matter</th>
                      <th className="py-2.5 px-3">Uploaded By</th>
                      <th className="py-2.5 px-3">Upload Date</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredDocuments.map((d) => (
                      <tr key={d._id} className="hover:bg-muted/20">
                        <td className="py-2.5 px-3 font-semibold text-foreground">
                          {d.name}
                        </td>
                        <td className="py-2.5 px-3 uppercase text-[10px] text-muted-foreground whitespace-nowrap">
                          {d.kind || "PDF"}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                          {typeof d.caseId === "object" ? d.caseId?.title : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                          {typeof d.uploadedBy === "object" ? d.uploadedBy?.name : "Staff"}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-muted-foreground whitespace-nowrap">
                          {formatSafeDate(d.createdAt)}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                            {d.state || "Active"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
