import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck, FileText, KeyRound, UserPlus, Briefcase, Loader2, AlertTriangle, Check, X, Inbox } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusPill } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { useApprovals, type ApprovalItem } from "@/services/admin";
import { useUpdateDocument, useReviewAccessRequest } from "@/services/documents";

export const Route = createFileRoute("/_admin/admin/approvals")({
  head: () => ({
    meta: [
      { title: "Approvals · StillWorks LegalOS" },
      {
        name: "description",
        content: "One approval centre for document uploads, access requests, case and client requests.",
      },
      { property: "og:title", content: "Approvals · StillWorks LegalOS" },
      {
        property: "og:description",
        content: "Document uploads, access, case and client requests in one queue.",
      },
    ],
  }),
  component: ApprovalsPage,
});

const FILTERS = ["All", "Documents", "Access", "Cases", "Clients"] as const;
type Filter = (typeof FILTERS)[number];

const iconFor = (kind: string) =>
  kind === "Document Upload"
    ? FileText
    : kind === "Access Request"
      ? KeyRound
      : kind === "Client Request"
        ? UserPlus
        : Briefcase;

function matchesFilter(a: ApprovalItem, filter: Filter): boolean {
  switch (filter) {
    case "Documents":
      return a.kind === "Document Upload";
    case "Access":
      return a.kind === "Access Request";
    case "Cases":
      return a.kind === "Case Request";
    case "Clients":
      return a.kind === "Client Request";
    default:
      return true;
  }
}

/** Resolve an approval `_id` back into the document + (optional) access-request ids. */
function parseTarget(a: ApprovalItem): { docId: string; requestId?: string } {
  if (a.kind === "Access Request") {
    const marker = "_access_";
    const idx = a._id.indexOf(marker);
    if (idx >= 0) {
      return { docId: a._id.slice(0, idx), requestId: a._id.slice(idx + marker.length) };
    }
  }
  return { docId: a._id };
}

function ApprovalsPage() {
  const { data, isLoading, isError } = useApprovals();
  const approvals = data?.approvals ?? [];

  const [filter, setFilter] = useState<Filter>("All");
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const updateDocument = useUpdateDocument();
  const reviewAccessRequest = useReviewAccessRequest();

  const visible = approvals.filter((a) => matchesFilter(a, filter));

  const run = (a: ApprovalItem, action: "approved" | "rejected") => {
    const target = parseTarget(a);
    setActingOn(a._id);
    setErrorMsg(null);

    const onSettled = () => setActingOn(null);
    const onError = () => setErrorMsg(`Could not ${action === "approved" ? "approve" : "reject"} this request. Please try again.`);

    if (target.requestId) {
      reviewAccessRequest.mutate(
        { docId: target.docId, requestId: target.requestId, status: action },
        { onSettled, onError },
      );
    } else {
      updateDocument.mutate(
        { id: target.docId, data: { state: action === "approved" ? "Approved" : "Rejected" } },
        { onSettled, onError },
      );
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "StillWorks", to: "/" }, { label: "Approvals" }]}
        title="Approval centre"
        subtitle={`${approvals.length} requests waiting.`}
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`min-h-11 rounded-pill px-4 text-helper font-medium transition-colors duration-150 ${
              filter === f
                ? "gradient-primary text-primary-foreground shadow-soft"
                : "border border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {errorMsg && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-helper text-destructive">
          <AlertTriangle size={16} className="shrink-0" />
          {errorMsg}
        </div>
      )}

      {isLoading && (
        <div className="grid gap-4 xl:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-6 shadow-soft animate-pulse">
              <div className="flex items-center gap-4">
                <div className="size-12 rounded-md bg-muted" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-24 rounded bg-muted" />
                  <div className="h-5 w-48 rounded bg-muted" />
                  <div className="h-3 w-36 rounded bg-muted" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-12 text-center">
          <AlertTriangle size={28} className="text-destructive" />
          <p className="font-medium">Failed to load approvals</p>
          <p className="text-helper text-muted-foreground">Check that the server is running and try again.</p>
        </div>
      )}

      {!isLoading && !isError && (
        <div className="grid gap-4 xl:grid-cols-2">
          {visible.length === 0 ? (
            <div className="col-span-full flex flex-col items-center gap-3 py-16 text-center">
              {filter === "All" ? (
                <ShieldCheck size={40} strokeWidth={1} className="text-muted-foreground/40" />
              ) : (
                <Inbox size={40} strokeWidth={1} className="text-muted-foreground/40" />
              )}
              <p className="font-medium text-muted-foreground">
                {filter === "All" ? "No pending approvals" : `No pending ${filter.toLowerCase()} requests`}
              </p>
              <p className="text-helper text-muted-foreground/70">
                {filter === "All" ? "Everything is up to date." : "Try another filter."}
              </p>
            </div>
          ) : (
            visible.map((a) => {
              const Icon = iconFor(a.kind);
              const busy = actingOn === a._id;
              return (
                <article key={a._id} className="lift rounded-lg border border-border bg-card p-6 shadow-soft">
                  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-4">
                    <span className="grid size-12 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                      <Icon size={20} strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0">
                      <StatusPill tone="primary">{a.kind}</StatusPill>
                      <h2 className="mt-2 truncate font-semibold">{a.title}</h2>
                      <p className="truncate text-helper text-muted-foreground">{a.context}</p>
                    </div>
                    <span className="shrink-0 text-caption text-muted-foreground">
                      {a.when ? new Date(a.when).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""}
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-border pt-4">
                    <p className="truncate text-helper text-muted-foreground">Pending review</p>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-sm"
                        onClick={() => run(a, "rejected")}
                        disabled={busy}
                      >
                        <X size={15} strokeWidth={1.75} />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        className="gradient-primary rounded-sm text-primary-foreground"
                        onClick={() => run(a, "approved")}
                        disabled={busy}
                      >
                        {busy ? <Loader2 size={15} strokeWidth={1.75} className="animate-spin" /> : <Check size={15} strokeWidth={1.75} />}
                        Approve
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
