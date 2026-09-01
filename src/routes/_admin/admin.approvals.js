import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck, FileText, KeyRound, UserPlus, Briefcase, Loader2, AlertTriangle, Check, X, Inbox } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusPill } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { useApprovals } from "@/services/admin";
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
const FILTERS = ["All", "Documents", "Access", "Cases", "Clients"];
const iconFor = (kind) => kind === "Document Upload"
    ? FileText
    : kind === "Access Request"
        ? KeyRound
        : kind === "Client Request"
            ? UserPlus
            : Briefcase;
function matchesFilter(a, filter) {
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
function parseTarget(a) {
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
    const [filter, setFilter] = useState("All");
    const [actingOn, setActingOn] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null);
    const updateDocument = useUpdateDocument();
    const reviewAccessRequest = useReviewAccessRequest();
    const visible = approvals.filter((a) => matchesFilter(a, filter));
    const run = (a, action) => {
        const target = parseTarget(a);
        setActingOn(a._id);
        setErrorMsg(null);
        const onSettled = () => setActingOn(null);
        const onError = () => setErrorMsg(`Could not ${action === "approved" ? "approve" : "reject"} this request. Please try again.`);
        if (target.requestId) {
            reviewAccessRequest.mutate({ docId: target.docId, requestId: target.requestId, status: action }, { onSettled, onError });
        }
        else {
            updateDocument.mutate({ id: target.docId, data: { state: action === "approved" ? "Approved" : "Rejected" } }, { onSettled, onError });
        }
    };
    return (_jsxs("div", { children: [_jsx(PageHeader, { breadcrumb: [{ label: "StillWorks", to: "/" }, { label: "Approvals" }], title: "Approval centre", subtitle: `${approvals.length} requests waiting.` }), _jsx("div", { className: "mb-6 flex flex-wrap gap-2", children: FILTERS.map((f) => (_jsx("button", { onClick: () => setFilter(f), className: `min-h-11 rounded-pill px-4 text-helper font-medium transition-colors duration-150 ${filter === f
                        ? "gradient-primary text-primary-foreground shadow-soft"
                        : "border border-border bg-card text-muted-foreground hover:text-foreground"}`, children: f }, f))) }), errorMsg && (_jsxs("div", { className: "mb-6 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-helper text-destructive", children: [_jsx(AlertTriangle, { size: 16, className: "shrink-0" }), errorMsg] })), isLoading && (_jsx("div", { className: "grid gap-4 xl:grid-cols-2", children: [1, 2].map((i) => (_jsx("div", { className: "rounded-lg border border-border bg-card p-6 shadow-soft animate-pulse", children: _jsxs("div", { className: "flex items-center gap-4", children: [_jsx("div", { className: "size-12 rounded-md bg-muted" }), _jsxs("div", { className: "space-y-2 flex-1", children: [_jsx("div", { className: "h-4 w-24 rounded bg-muted" }), _jsx("div", { className: "h-5 w-48 rounded bg-muted" }), _jsx("div", { className: "h-3 w-36 rounded bg-muted" })] })] }) }, i))) })), isError && (_jsxs("div", { className: "flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-12 text-center", children: [_jsx(AlertTriangle, { size: 28, className: "text-destructive" }), _jsx("p", { className: "font-medium", children: "Failed to load approvals" }), _jsx("p", { className: "text-helper text-muted-foreground", children: "Check that the server is running and try again." })] })), !isLoading && !isError && (_jsx("div", { className: "grid gap-4 xl:grid-cols-2", children: visible.length === 0 ? (_jsxs("div", { className: "col-span-full flex flex-col items-center gap-3 py-16 text-center", children: [filter === "All" ? (_jsx(ShieldCheck, { size: 40, strokeWidth: 1, className: "text-muted-foreground/40" })) : (_jsx(Inbox, { size: 40, strokeWidth: 1, className: "text-muted-foreground/40" })), _jsx("p", { className: "font-medium text-muted-foreground", children: filter === "All" ? "No pending approvals" : `No pending ${filter.toLowerCase()} requests` }), _jsx("p", { className: "text-helper text-muted-foreground/70", children: filter === "All" ? "Everything is up to date." : "Try another filter." })] })) : (visible.map((a) => {
                    const Icon = iconFor(a.kind);
                    const busy = actingOn === a._id;
                    return (_jsxs("article", { className: "lift rounded-lg border border-border bg-card p-6 shadow-soft", children: [_jsxs("div", { className: "grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-4", children: [_jsx("span", { className: "grid size-12 shrink-0 place-items-center rounded-md bg-primary/10 text-primary", children: _jsx(Icon, { size: 20, strokeWidth: 1.75 }) }), _jsxs("div", { className: "min-w-0", children: [_jsx(StatusPill, { tone: "primary", children: a.kind }), _jsx("h2", { className: "mt-2 truncate font-semibold", children: a.title }), _jsx("p", { className: "truncate text-helper text-muted-foreground", children: a.context })] }), _jsx("span", { className: "shrink-0 text-caption text-muted-foreground", children: a.when ? new Date(a.when).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "" })] }), _jsxs("div", { className: "mt-5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-border pt-4", children: [_jsx("p", { className: "truncate text-helper text-muted-foreground", children: "Pending review" }), _jsxs("div", { className: "flex shrink-0 gap-2", children: [_jsxs(Button, { variant: "outline", size: "sm", className: "rounded-sm", onClick: () => run(a, "rejected"), disabled: busy, children: [_jsx(X, { size: 15, strokeWidth: 1.75 }), "Reject"] }), _jsxs(Button, { size: "sm", className: "gradient-primary rounded-sm text-primary-foreground", onClick: () => run(a, "approved"), disabled: busy, children: [busy ? _jsx(Loader2, { size: 15, strokeWidth: 1.75, className: "animate-spin" }) : _jsx(Check, { size: 15, strokeWidth: 1.75 }), "Approve"] })] })] })] }, a._id));
                })) }))] }));
}
