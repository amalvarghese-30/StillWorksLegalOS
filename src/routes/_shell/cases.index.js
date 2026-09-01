import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Briefcase, Plus, Filter, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusPill } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useCases } from "@/services/cases";
import { AddCaseDialog } from "@/components/cases/AddCaseDialog";
export const Route = createFileRoute("/_shell/cases/")({
    head: () => ({
        meta: [
            { title: "Cases · StillWorks LegalOS" },
            {
                name: "description",
                content: "Every matter in one workspace — status, priority, next hearing and assigned counsel.",
            },
            { property: "og:title", content: "Cases · StillWorks LegalOS" },
            {
                property: "og:description",
                content: "Every matter in one workspace with status, hearings and counsel.",
            },
        ],
    }),
    component: CasesPage,
});
const STATUS_FILTERS = ["All", "Active", "Urgent", "On Hold", "Closed"];
function toneForStatus(s) {
    const map = {
        Active: "success",
        Urgent: "destructive",
        "On Hold": "warning",
        Closed: "muted",
        High: "destructive",
        Medium: "warning",
        Low: "muted",
    };
    return map[s] ?? "primary";
}
function formatDate(iso) {
    if (!iso)
        return "Not scheduled";
    return new Date(iso).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}
function CaseCard({ c }) {
    return (_jsxs(Link, { to: "/cases/$caseId", params: { caseId: c._id }, className: "lift rounded-lg border border-border bg-card p-6 shadow-soft", children: [_jsxs("div", { className: "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "num text-caption text-muted-foreground", children: c.number }), _jsx("h2", { className: "mt-1 truncate text-title font-semibold", children: c.title }), _jsxs("p", { className: "mt-1 truncate text-helper text-muted-foreground", children: [c.parties?.[0]?.name ?? "—", " \u00B7 ", c.court || "—"] })] }), _jsxs("div", { className: "flex shrink-0 flex-col items-end gap-2", children: [_jsx(StatusPill, { tone: toneForStatus(c.status), children: c.status }), _jsxs(StatusPill, { tone: toneForStatus(c.priority), children: [c.priority, " priority"] })] })] }), _jsxs("dl", { className: "mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3", children: [_jsxs("div", { children: [_jsx("dt", { className: "text-caption text-muted-foreground", children: "Practice" }), _jsx("dd", { className: "mt-0.5 truncate text-helper font-medium", children: c.practice })] }), _jsxs("div", { children: [_jsx("dt", { className: "text-caption text-muted-foreground", children: "Assigned" }), _jsx("dd", { className: "mt-0.5 truncate text-helper font-medium", children: c.assignedTo?.name ?? "Unassigned" })] }), _jsxs("div", { children: [_jsx("dt", { className: "text-caption text-muted-foreground", children: "Next hearing" }), _jsx("dd", { className: "num mt-0.5 truncate text-helper font-medium", children: formatDate(c.nextHearing) })] })] }), _jsxs("div", { className: "mt-5 flex items-center gap-3", children: [_jsx(Progress, { value: c.progress, className: "h-1.5" }), _jsxs("span", { className: "num shrink-0 text-caption text-muted-foreground", children: [c.progress, "%"] })] })] }));
}
function CasesPage() {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [showAddDialog, setShowAddDialog] = useState(false);
    const filters = {};
    if (search.trim())
        filters["search"] = search;
    if (statusFilter !== "All")
        filters["status"] = statusFilter;
    const { data, isLoading, isError, error } = useCases(filters);
    return (_jsxs("div", { children: [_jsx(PageHeader, { breadcrumb: [{ label: "StillWorks", to: "/" }, { label: "Cases" }], title: "Cases", subtitle: `${data?.total ?? "—"} matters across practice areas.`, actions: _jsxs(Button, { className: "gradient-primary rounded-md text-primary-foreground shadow-soft transition-transform duration-200 hover:-translate-y-0.5", onClick: () => setShowAddDialog(true), children: [_jsx(Plus, { size: 17, strokeWidth: 2 }), "Add case"] }) }), _jsxs("div", { className: "mb-6 flex flex-wrap items-center gap-3", children: [_jsxs("label", { className: "flex min-w-0 flex-1 items-center gap-3 rounded-pill border border-border bg-card px-4 py-2.5 shadow-soft", children: [_jsx(Search, { size: 18, strokeWidth: 1.75, className: "shrink-0 text-muted-foreground" }), _jsx("input", { type: "search", "aria-label": "Search cases", placeholder: "Search by case number, title, court or party\u2026", value: search, onChange: (e) => setSearch(e.target.value), className: "min-w-0 flex-1 bg-transparent text-helper outline-none" })] }), STATUS_FILTERS.map((f, i) => (_jsx("button", { onClick: () => setStatusFilter(f), className: `min-h-11 rounded-pill px-4 text-helper font-medium transition-colors duration-150 ${statusFilter === f
                            ? "gradient-primary text-primary-foreground shadow-soft"
                            : "border border-border bg-card text-muted-foreground hover:text-foreground"}`, children: f }, f))), _jsx(Button, { variant: "outline", size: "icon", className: "rounded-md", "aria-label": "More filters", children: _jsx(Filter, { size: 18, strokeWidth: 1.75 }) })] }), isLoading && (_jsx("div", { className: "grid gap-4 xl:grid-cols-2", children: Array.from({ length: 4 }).map((_, i) => (_jsx("div", { className: "rounded-lg border border-border bg-card p-6 shadow-soft", children: _jsxs("div", { className: "space-y-3", children: [_jsx("div", { className: "h-3 w-24 animate-pulse rounded bg-muted" }), _jsx("div", { className: "h-5 w-56 animate-pulse rounded bg-muted" }), _jsx("div", { className: "h-3 w-44 animate-pulse rounded bg-muted" })] }) }, i))) })), isError && !isLoading && (_jsxs("div", { className: "rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center", children: [_jsx("p", { className: "font-medium text-destructive", children: "Failed to load cases" }), _jsx("p", { className: "mt-1 text-helper text-muted-foreground", children: error instanceof Error ? error.message : "Could not connect to the server." })] })), !isLoading && !isError && data?.cases.length === 0 && (_jsxs("div", { className: "rounded-lg border border-border bg-card p-16 text-center shadow-soft", children: [_jsx("p", { className: "text-title font-semibold", children: "No cases found" }), _jsx("p", { className: "mt-2 text-helper text-muted-foreground", children: search || statusFilter !== "All"
                            ? "No cases match your filters. Try different keywords."
                            : "Create your first case to get started." })] })), !isLoading && !isError && data && (_jsx("div", { className: "grid gap-4 xl:grid-cols-2", children: data.cases.map((c) => (_jsx(CaseCard, { c: c }, c._id))) })), data && data.total > 0 && (_jsxs("p", { className: "mt-6 flex items-center gap-2 text-helper text-muted-foreground", children: [_jsx(Briefcase, { size: 16, strokeWidth: 1.75 }), " Showing ", data.cases.length, " of ", data.total, " matters"] })), _jsx(AddCaseDialog, { open: showAddDialog, onClose: () => setShowAddDialog(false) })] }));
}
