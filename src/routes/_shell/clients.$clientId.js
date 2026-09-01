import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { LayoutDashboard, FileBadge, Home, Users, Phone, Mail, MapPin, Loader2, Edit3, ChevronDown, } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/common/Surface";
import { StatusPill } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { useClient, useUpdateClient, } from "@/services/clients";
export const Route = createFileRoute("/_shell/clients/$clientId")({
    head: () => ({
        meta: [
            { title: "Client profile · StillWorks LegalOS" },
            { name: "description", content: "Client details, KYC, property, and sub-client records." },
            { property: "og:title", content: "Client profile · StillWorks LegalOS" },
            { property: "og:description", content: "Client details, KYC, property, and sub-client records." },
        ],
    }),
    component: ClientProfile,
});
const sections = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "kyc", label: "KYC", icon: FileBadge },
    { id: "property", label: "Property", icon: Home },
    { id: "subclients", label: "Sub-clients", icon: Users },
];
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDate(iso) {
    if (!iso)
        return "—";
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
const kycTone = { Verified: "success", Pending: "warning", Rejected: "destructive" };
const tagTone = { Active: "success", VIP: "primary", Corporate: "indigo", Individual: "muted", Archived: "muted" };
// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
/** Inline editor for client tag and type */
function QuickEditDropdown({ record }) {
    const [open, setOpen] = useState(false);
    const updateClient = useUpdateClient();
    const tags = ["Active", "VIP", "Corporate", "Individual", "Archived"];
    const types = ["Individual", "Corporate"];
    return (_jsxs("div", { className: "relative", children: [_jsxs(Button, { variant: "outline", size: "sm", className: "rounded-md", onClick: () => setOpen(!open), children: [_jsx(Edit3, { size: 14, strokeWidth: 1.75 }), "Edit", _jsx(ChevronDown, { size: 14, strokeWidth: 1.75 })] }), open && (_jsxs(_Fragment, { children: [_jsx("div", { className: "fixed inset-0 z-10", onClick: () => setOpen(false) }), _jsxs("div", { className: "absolute right-0 z-20 mt-2 w-64 rounded-lg border border-border bg-card p-3 shadow-lift", children: [_jsx("p", { className: "mb-2 text-caption font-semibold text-muted-foreground", children: "Tag" }), _jsx("div", { className: "mb-3 flex gap-1 flex-wrap", children: tags.map((t) => (_jsx("button", { onClick: () => { updateClient.mutate({ id: record._id, data: { tag: t } }); setOpen(false); }, disabled: updateClient.isPending, className: `rounded-sm px-2 py-1.5 text-caption font-medium transition-colors ${record.tag === t ? "bg-primary/15 text-primary ring-1 ring-primary/30" : "bg-muted text-muted-foreground hover:bg-accent"}`, children: t }, t))) }), _jsx("p", { className: "mb-2 text-caption font-semibold text-muted-foreground", children: "Type" }), _jsx("div", { className: "flex gap-1", children: types.map((t) => (_jsx("button", { onClick: () => { updateClient.mutate({ id: record._id, data: { type: t } }); setOpen(false); }, disabled: updateClient.isPending, className: `flex-1 rounded-sm px-2 py-1.5 text-caption font-medium transition-colors ${record.type === t ? "bg-primary/15 text-primary ring-1 ring-primary/30" : "bg-muted text-muted-foreground hover:bg-accent"}`, children: t }, t))) })] })] }))] }));
}
// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
function ClientProfile() {
    const { clientId } = Route.useParams();
    const { data, isLoading, isError } = useClient(clientId);
    const [active, setActive] = useState("overview");
    if (isLoading) {
        return (_jsx("div", { className: "flex min-h-[60vh] items-center justify-center", children: _jsxs("div", { className: "text-center", children: [_jsx(Loader2, { size: 32, className: "mx-auto animate-spin text-muted-foreground" }), _jsx("p", { className: "mt-4 text-helper text-muted-foreground", children: "Loading client profile\u2026" })] }) }));
    }
    if (isError || !data) {
        return (_jsx("div", { className: "flex min-h-[60vh] items-center justify-center", children: _jsxs("div", { className: "max-w-sm text-center", children: [_jsx("h2", { className: "text-xl font-semibold", children: "Client not found" }), _jsx("p", { className: "mt-2 text-helper text-muted-foreground", children: "This client may have been deleted or you don't have access to it." })] }) }));
    }
    const record = data.client;
    const hasProperty = record.propertyDetails?.address;
    return (_jsxs("div", { children: [_jsx(PageHeader, { breadcrumb: [
                    { label: "StillWorks", to: "/" },
                    { label: "Clients", to: "/clients" },
                    { label: record.name },
                ], title: record.name, subtitle: `${record.type} · ${record.tag} · KYC ${record.kyc}`, actions: _jsx(QuickEditDropdown, { record: record }) }), _jsxs("div", { className: "gradient-primary mb-6 rounded-lg p-6 text-primary-foreground shadow-lift", children: [_jsx("div", { className: "grid gap-6 md:grid-cols-4", children: [
                            ["Type", record.type],
                            ["Tag", record.tag],
                            ["KYC Status", record.kyc],
                            ["Created", formatDate(record.createdAt)],
                        ].map(([label, value]) => (_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-caption opacity-85", children: label }), _jsx("p", { className: "mt-1 truncate text-body font-semibold", children: value })] }, label))) }), _jsxs("div", { className: "mt-4 flex flex-wrap gap-3 text-caption opacity-85", children: [record.phone && (_jsxs("span", { className: "flex items-center gap-1", children: [_jsx(Phone, { size: 13 }), " ", record.phone] })), record.email && (_jsxs("span", { className: "flex items-center gap-1", children: [_jsx(Mail, { size: 13 }), " ", record.email] })), record.address && (_jsxs("span", { className: "flex items-center gap-1", children: [_jsx(MapPin, { size: 13 }), " ", record.address] }))] })] }), _jsxs("div", { className: "grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]", children: [_jsx("nav", { "aria-label": "Client sections", className: "lg:sticky lg:top-28 lg:self-start", children: _jsx("ul", { className: "flex gap-1 overflow-x-auto rounded-lg border border-border bg-card p-2 shadow-soft lg:flex-col lg:overflow-visible", children: sections.map((s) => (_jsx("li", { className: "shrink-0 lg:shrink", children: _jsxs("button", { onClick: () => setActive(s.id), "aria-current": active === s.id ? "true" : undefined, className: `flex min-h-11 w-full items-center gap-2.5 rounded-sm px-3 text-helper font-medium transition-colors duration-150 ${active === s.id
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground hover:bg-accent hover:text-foreground"}`, children: [_jsx(s.icon, { size: 18, strokeWidth: 1.75 }), s.label] }) }, s.id))) }) }), _jsxs("div", { className: "min-w-0 space-y-6", children: [active === "overview" && (_jsx(SectionCard, { title: "Client details", description: "Basic information and contact details.", icon: LayoutDashboard, children: _jsx("div", { className: "grid gap-5 sm:grid-cols-2", children: [
                                        { label: "Full name", value: record.name },
                                        { label: "Type", value: record.type },
                                        { label: "Tag", value: record.tag },
                                        { label: "Phone", value: record.phone || "—" },
                                        { label: "Email", value: record.email || "—" },
                                        { label: "Address", value: record.address || "—" },
                                        { label: "KYC Status", value: record.kyc, pill: kycTone[record.kyc] ?? "muted" },
                                        { label: "PAN", value: record.pan || "—" },
                                        { label: "Aadhar", value: record.aadhar || "—" },
                                        { label: "Created", value: formatDate(record.createdAt) },
                                        { label: "Updated", value: formatDate(record.updatedAt) },
                                        { label: "Sub-clients", value: `${record.subClients?.length ?? 0}` },
                                    ].map(({ label, value, pill }) => (_jsxs("div", { className: "space-y-1", children: [_jsx("p", { className: "text-caption text-muted-foreground", children: label }), pill ? (_jsx(StatusPill, { tone: pill, children: value })) : (_jsx("p", { className: "text-helper font-medium", children: value }))] }, label))) }) })), active === "kyc" && (_jsx(SectionCard, { title: "KYC Verification", description: "Aadhar, PAN and identity verification status.", icon: FileBadge, children: _jsxs("div", { className: "space-y-5", children: [_jsxs("div", { className: "flex items-center gap-4 rounded-lg border border-border bg-muted/30 p-4", children: [_jsx("span", { className: "grid size-12 shrink-0 place-items-center rounded-full bg-muted", children: _jsx(FileBadge, { size: 22, strokeWidth: 1.5, className: "text-muted-foreground" }) }), _jsxs("div", { children: [_jsx("p", { className: "font-medium", children: "Verification Status" }), _jsx(StatusPill, { tone: (kycTone[record.kyc] ?? "muted"), children: record.kyc }), record.kyc === "Verified" && (_jsx("p", { className: "mt-1 text-caption text-success", children: "Both Aadhar and PAN verified." })), record.kyc === "Pending" && (_jsx("p", { className: "mt-1 text-caption text-warning", children: "Awaiting Aadhar and/or PAN submission." })), record.kyc === "Rejected" && (_jsx("p", { className: "mt-1 text-caption text-destructive", children: "KYC verification was rejected. Please review." }))] })] }), _jsxs("div", { className: "grid gap-5 sm:grid-cols-2", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("p", { className: "text-caption text-muted-foreground", children: "Aadhar Number" }), _jsx("p", { className: "text-helper font-mono font-medium", children: record.aadhar || "—" })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("p", { className: "text-caption text-muted-foreground", children: "PAN Number" }), _jsx("p", { className: "text-helper font-mono font-medium", children: record.pan || "—" })] })] })] }) })), active === "property" && (_jsx(SectionCard, { title: "Property Details", description: "Property information associated with this client.", icon: Home, children: !hasProperty ? (_jsxs("div", { className: "rounded-lg border border-dashed p-12 text-center", children: [_jsx(Home, { size: 32, className: "mx-auto text-muted-foreground", strokeWidth: 1.5 }), _jsx("p", { className: "mt-4 font-medium", children: "No property on record" }), _jsx("p", { className: "mt-1 text-helper text-muted-foreground", children: "Add property details for this client from the client edit form." })] })) : (_jsx("div", { className: "grid gap-5 sm:grid-cols-2", children: [
                                        { label: "Property address", value: record.propertyDetails?.address ?? "—" },
                                        { label: "Survey No.", value: record.propertyDetails?.surveyNo ?? "—" },
                                        { label: "CHS / Building", value: record.propertyDetails?.chsName ?? "—" },
                                        { label: "Sector / Area", value: record.propertyDetails?.sector ?? "—" },
                                        { label: "Plot No.", value: record.propertyDetails?.plot ?? "—" },
                                        { label: "Area (sq.ft.)", value: record.propertyDetails?.area ?? "—" },
                                    ].map(({ label, value }) => (_jsxs("div", { className: "space-y-1", children: [_jsx("p", { className: "text-caption text-muted-foreground", children: label }), _jsx("p", { className: "text-helper font-medium", children: value })] }, label))) })) })), active === "subclients" && (_jsx(SectionCard, { title: "Sub-clients", description: `${record.subClients?.length ?? 0} associated parties.`, icon: Users, children: !record.subClients?.length ? (_jsxs("div", { className: "rounded-lg border border-dashed p-12 text-center", children: [_jsx(Users, { size: 32, className: "mx-auto text-muted-foreground", strokeWidth: 1.5 }), _jsx("p", { className: "mt-4 font-medium", children: "No sub-clients yet" }), _jsx("p", { className: "mt-1 text-helper text-muted-foreground", children: "Sub-clients can be added through the client edit form." })] })) : (_jsx("ul", { className: "space-y-4", children: record.subClients.map((sc, idx) => (_jsxs("li", { className: "rounded-md border border-border p-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("p", { className: "font-medium", children: sc.name }), _jsx(StatusPill, { tone: "muted", children: sc.relationship || "Related" })] }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2 text-helper", children: [sc.phone && (_jsxs("span", { className: "flex items-center gap-1.5 text-muted-foreground", children: [_jsx(Phone, { size: 13 }), " ", sc.phone] })), sc.email && (_jsxs("span", { className: "flex items-center gap-1.5 text-muted-foreground", children: [_jsx(Mail, { size: 13 }), " ", sc.email] })), sc.aadhar && (_jsxs("span", { className: "text-caption text-muted-foreground", children: ["Aadhar: ", sc.aadhar] })), sc.pan && (_jsxs("span", { className: "text-caption text-muted-foreground", children: ["PAN: ", sc.pan] })), sc.notes && (_jsx("span", { className: "sm:col-span-2 text-helper text-muted-foreground", children: sc.notes }))] })] }, sc._id ?? idx))) })) }))] })] })] }));
}
