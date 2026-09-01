import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Search, Mail, Phone, ShieldCheck, Briefcase } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusPill } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { useClients } from "@/services/clients";
import { AddClientDialog } from "@/components/clients/AddClientDialog";
export const Route = createFileRoute("/_shell/clients/")({
    head: () => ({
        meta: [
            { title: "Clients · StillWorks LegalOS" },
            {
                name: "description",
                content: "Premium client profiles with KYC status, matters and relationships in one place.",
            },
            { property: "og:title", content: "Clients · StillWorks LegalOS" },
            {
                property: "og:description",
                content: "Client profiles with KYC status, matters and relationships.",
            },
        ],
    }),
    component: ClientsPage,
});
function toneForTag(tag) {
    const map = {
        VIP: "violet",
        Corporate: "indigo",
        Active: "success",
        Individual: "primary",
        Archived: "muted",
    };
    return map[tag] ?? "muted";
}
function toneForKYC(kyc) {
    const map = {
        Verified: "success",
        Pending: "warning",
        Rejected: "destructive",
    };
    return map[kyc] ?? "warning";
}
function ClientCard({ c }) {
    return (_jsx(Link, { to: "/clients/$clientId", params: { clientId: c._id }, children: _jsxs("article", { className: "lift rounded-lg border border-border bg-card p-6 shadow-soft transition-colors hover:border-primary/30", children: [_jsxs("div", { className: "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3", children: [_jsx("span", { className: "gradient-primary grid size-12 shrink-0 place-items-center rounded-full font-display font-semibold text-primary-foreground", children: c.name.slice(0, 1) }), _jsxs("div", { className: "min-w-0", children: [_jsx("h2", { className: "truncate font-semibold", children: c.name }), _jsxs("p", { className: "truncate text-caption text-muted-foreground", children: [c.type, " \u00B7 Since ", new Date(c.createdAt).toLocaleDateString("en-IN", { year: "numeric", month: "short" })] })] }), _jsx(StatusPill, { tone: toneForTag(c.tag), children: c.tag })] }), _jsxs("ul", { className: "mt-5 space-y-2 text-helper text-muted-foreground", children: [_jsxs("li", { className: "flex items-center gap-2", children: [_jsx(Mail, { size: 16, strokeWidth: 1.75, className: "shrink-0" }), _jsx("span", { className: "truncate", children: c.email || "—" })] }), _jsxs("li", { className: "num flex items-center gap-2", children: [_jsx(Phone, { size: 16, strokeWidth: 1.75, className: "shrink-0" }), _jsx("span", { className: "truncate", children: c.phone || "—" })] })] }), _jsxs("div", { className: "mt-5 flex items-center justify-between border-t border-border pt-4", children: [_jsxs("span", { className: "flex items-center gap-2 text-helper", children: [_jsx(Briefcase, { size: 16, strokeWidth: 1.75, className: "text-muted-foreground" }), _jsx("span", { className: "num font-medium", children: c.subClients?.length ?? 0 }), " sub-clients"] }), _jsxs("span", { className: "flex items-center gap-1.5", children: [_jsx(ShieldCheck, { size: 16, strokeWidth: 1.75, className: c.kyc === "Verified" ? "text-success" : "text-warning" }), _jsxs("span", { className: "text-helper", children: ["KYC ", c.kyc] })] })] })] }) }));
}
function ClientsPage() {
    const [search, setSearch] = useState("");
    const [showAddDialog, setShowAddDialog] = useState(false);
    const { data, isLoading, isError, error } = useClients(search.trim() ? { search } : {});
    return (_jsxs("div", { children: [_jsx(PageHeader, { breadcrumb: [{ label: "StillWorks", to: "/" }, { label: "Clients" }], title: "Clients", subtitle: `${data?.total ?? "—"} relationships — individuals, corporates and their sub-clients.`, actions: _jsxs(Button, { className: "gradient-primary rounded-md text-primary-foreground shadow-soft transition-transform duration-200 hover:-translate-y-0.5", onClick: () => setShowAddDialog(true), children: [_jsx(Plus, { size: 17, strokeWidth: 2 }), "Add client"] }) }), _jsxs("label", { className: "mb-6 flex items-center gap-3 rounded-pill border border-border bg-card px-4 py-2.5 shadow-soft", children: [_jsx(Search, { size: 18, strokeWidth: 1.75, className: "shrink-0 text-muted-foreground" }), _jsx("input", { type: "search", "aria-label": "Search clients", placeholder: "Search clients by name, phone, PAN, Aadhar\u2026", value: search, onChange: (e) => setSearch(e.target.value), className: "min-w-0 flex-1 bg-transparent text-helper outline-none" })] }), isLoading && (_jsx("div", { className: "grid gap-4 sm:grid-cols-2 xl:grid-cols-3", children: Array.from({ length: 6 }).map((_, i) => (_jsxs("div", { className: "rounded-lg border border-border bg-card p-6 shadow-soft", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "size-12 animate-pulse rounded-full bg-muted" }), _jsxs("div", { className: "flex-1 space-y-2", children: [_jsx("div", { className: "h-4 w-32 animate-pulse rounded bg-muted" }), _jsx("div", { className: "h-3 w-24 animate-pulse rounded bg-muted" })] })] }), _jsxs("div", { className: "mt-5 space-y-2", children: [_jsx("div", { className: "h-3 w-48 animate-pulse rounded bg-muted" }), _jsx("div", { className: "h-3 w-40 animate-pulse rounded bg-muted" })] })] }, i))) })), isError && !isLoading && (_jsxs("div", { className: "rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center", children: [_jsx("p", { className: "font-medium text-destructive", children: "Failed to load clients" }), _jsx("p", { className: "mt-1 text-helper text-muted-foreground", children: error instanceof Error ? error.message : "Could not connect to the server." })] })), !isLoading && !isError && data?.clients.length === 0 && (_jsxs("div", { className: "rounded-lg border border-border bg-card p-16 text-center shadow-soft", children: [_jsx("p", { className: "text-title font-semibold", children: "No clients yet" }), _jsx("p", { className: "mt-2 text-helper text-muted-foreground", children: search ? "No clients match your search. Try different keywords." : "Add your first client to get started." })] })), !isLoading && !isError && data && (_jsx("div", { className: "grid gap-4 sm:grid-cols-2 xl:grid-cols-3", children: data.clients.map((c) => (_jsx(ClientCard, { c: c }, c._id))) })), _jsx(AddClientDialog, { open: showAddDialog, onClose: () => setShowAddDialog(false) })] }));
}
