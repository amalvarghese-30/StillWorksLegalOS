import { ShieldCheck, ArrowRight, Loader2, Clock, Check, X, MoreVertical } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { formatSafeRelative } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ApprovalItem } from "@/services/admin";

interface ItemsAwaitingApprovalCardProps {
  approvals: ApprovalItem[];
  isLoading?: boolean;
  onApprove?: (item: ApprovalItem) => void;
  onReject?: (item: ApprovalItem) => void;
  actingOn?: string | null;
}

export function ItemsAwaitingApprovalCard({
  approvals,
  isLoading = false,
  onApprove,
  onReject,
  actingOn,
}: ItemsAwaitingApprovalCardProps) {
  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/40">
            <ShieldCheck size={18} strokeWidth={2} />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Items awaiting approval</h2>
            <p className="text-xs text-muted-foreground">
              Cases, tasks or documents pending your review
            </p>
          </div>
        </div>
        <Link
          to="/admin/approvals"
          className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 transition-colors"
        >
          View all <ArrowRight size={13} strokeWidth={2} />
        </Link>
      </div>

      {/* Body */}
      <div className="mt-3.5 flex-1 min-w-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="animate-spin text-muted-foreground" size={20} />
          </div>
        ) : approvals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4 rounded-lg border border-dashed border-border/70 bg-muted/20">
            <span className="grid size-12 place-items-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/40 mb-3">
              <Check size={22} strokeWidth={2} />
            </span>
            <p className="text-sm font-semibold text-foreground">No items awaiting approval</p>
            <p className="mt-1 text-xs text-muted-foreground max-w-[280px]">
              All approvals and access requests are up to date.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {approvals.slice(0, 4).map((item) => {
              const isActing = actingOn === item._id;

              return (
                <div
                  key={item._id}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/50 hover:bg-muted/40 p-3 transition-all duration-150 hover:border-amber-300/40"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
                      <Clock size={16} strokeWidth={2} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs sm:text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                        {item.title}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className="truncate max-w-[140px]">{item.context || item.kind}</span>
                        <span>•</span>
                        <span>
                          {item.submittedBy?.name
                            ? `by ${item.submittedBy.name}`
                            : formatSafeRelative(item.when)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isActing}
                      onClick={() => navigate({ to: "/admin/approvals" })}
                      className="rounded-md border-amber-300/60 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-xs font-semibold h-8 px-3"
                    >
                      {isActing ? <Loader2 size={13} className="animate-spin" /> : "Review"}
                    </Button>

                    {(onApprove || onReject) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-foreground"
                          >
                            <MoreVertical size={15} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {onApprove && (
                            <DropdownMenuItem
                              onClick={() => onApprove(item)}
                              className="text-xs text-emerald-600 focus:text-emerald-700 gap-2 cursor-pointer"
                            >
                              <Check size={14} /> Quick Approve
                            </DropdownMenuItem>
                          )}
                          {onReject && (
                            <DropdownMenuItem
                              onClick={() => onReject(item)}
                              className="text-xs text-rose-600 focus:text-rose-700 gap-2 cursor-pointer"
                            >
                              <X size={14} /> Quick Reject
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
