import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { Gavel, FileText, CheckSquare, StickyNote, History, Users, LayoutDashboard, Loader2, ChevronDown, Clock, Send, Check, X, UserPlus, Activity as ActivityIcon, CalendarDays, Edit3, } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/common/Surface";
import { StatusPill, toneForStatus } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useCase, useUpdateCase, useAddCaseNote, useAddCaseParty, } from "@/services/cases";
import { useTasks } from "@/services/tasks";
import { useDocuments } from "@/services/documents";
import { useCalendarEvents } from "@/services/calendar";
export const Route = createFileRoute("/_shell/cases/$caseId")({
    head: () => ({
        meta: [
            { title: "Case workspace · StillWorks LegalOS" },
            { name: "description", content: "A single operating screen for a matter: hearings, documents, tasks, parties and timeline." },
            { property: "og:title", content: "Case workspace · StillWorks LegalOS" },
            { property: "og:description", content: "Hearings, documents, tasks, parties and timeline for one matter." },
        ],
    }),
    component: CaseWorkspace,
});
const sections = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "hearings", label: "Hearings", icon: Gavel },
    { id: "documents", label: "Documents", icon: FileText },
    { id: "tasks", label: "Tasks", icon: CheckSquare },
    { id: "notes", label: "Notes", icon: StickyNote },
    { id: "parties", label: "Parties", icon: Users },
    { id: "timeline", label: "Timeline", icon: History },
    { id: "activity", label: "Activity", icon: ActivityIcon },
];
function formatDate(iso) {
    if (!iso)
        return "Not scheduled";
    return new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}
function formatRelative(iso) {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1)
        return "Just now";
    if (diffMin < 60)
        return `${diffMin}m ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24)
        return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7)
        return `${diffDays}d ago`;
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
/** Inline status/priority/assigned editor dropdown */
function QuickEditDropdown({ record, caseId }) {
    const [open, setOpen] = useState(false);
    const updateCase = useUpdateCase();
    const statuses = ["Active", "Urgent", "On Hold", "Closed"];
    const priorities = ["High", "Medium", "Low"];
    return (_jsxs("div", { className: "relative", children: [_jsxs(Button, { variant: "outline", size: "sm", className: "rounded-md", onClick: () => setOpen(!open), children: [_jsx(Edit3, { size: 14, strokeWidth: 1.75 }), "Edit", _jsx(ChevronDown, { size: 14, strokeWidth: 1.75 })] }), open && (_jsxs(_Fragment, { children: [_jsx("div", { className: "fixed inset-0 z-10", onClick: () => setOpen(false) }), _jsxs("div", { className: "absolute right-0 z-20 mt-2 w-64 rounded-lg border border-border bg-card p-3 shadow-lift", children: [_jsx("p", { className: "mb-2 text-caption font-semibold text-muted-foreground", children: "Status" }), _jsx("div", { className: "mb-3 flex gap-1", children: statuses.map((s) => (_jsx("button", { onClick: () => { updateCase.mutate({ id: caseId, data: { status: s } }); setOpen(false); }, disabled: updateCase.isPending, className: `flex-1 rounded-sm px-2 py-1.5 text-caption font-medium transition-colors ${record.status === s ? "bg-primary/15 text-primary ring-1 ring-primary/30" : "bg-muted text-muted-foreground hover:bg-accent"}`, children: s }, s))) }), _jsx("p", { className: "mb-2 text-caption font-semibold text-muted-foreground", children: "Priority" }), _jsx("div", { className: "flex gap-1", children: priorities.map((p) => (_jsx("button", { onClick: () => { updateCase.mutate({ id: caseId, data: { priority: p } }); setOpen(false); }, disabled: updateCase.isPending, className: `flex-1 rounded-sm px-2 py-1.5 text-caption font-medium transition-colors ${record.priority === p ? "bg-primary/15 text-primary ring-1 ring-primary/30" : "bg-muted text-muted-foreground hover:bg-accent"}`, children: p }, p))) })] })] }))] }));
}
/** Add note form */
function AddNoteForm({ caseId }) {
    const [text, setText] = useState("");
    const addNote = useAddCaseNote();
    const inputRef = useRef(null);
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!text.trim() || addNote.isPending)
            return;
        addNote.mutate({ caseId, text: text.trim() }, { onSuccess: () => { setText(""); inputRef.current?.focus(); } });
    };
    return (_jsxs("form", { onSubmit: handleSubmit, className: "flex items-center gap-2", children: [_jsx(Input, { ref: inputRef, value: text, onChange: (e) => setText(e.target.value), placeholder: "Write a case note\u2026", className: "h-10 flex-1 rounded-md" }), _jsx(Button, { type: "submit", size: "sm", className: "gradient-primary rounded-md text-primary-foreground", disabled: !text.trim() || addNote.isPending, children: addNote.isPending ? _jsx(Loader2, { size: 15, className: "animate-spin" }) : _jsx(Send, { size: 15 }) })] }));
}
/** Add party form */
function AddPartyForm({ caseId }) {
    const [name, setName] = useState("");
    const [role, setRole] = useState("");
    const [type, setType] = useState("client");
    const [show, setShow] = useState(false);
    const addParty = useAddCaseParty();
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim() || addParty.isPending)
            return;
        addParty.mutate({ caseId, party: { name: name.trim(), role: role.trim() || "Party", type } }, {
            onSuccess: () => { setName(""); setRole(""); setShow(false); },
        });
    };
    if (!show) {
        return (_jsxs(Button, { variant: "outline", size: "sm", className: "rounded-md", onClick: () => setShow(true), children: [_jsx(UserPlus, { size: 14 }), " Add party"] }));
    }
    return (_jsxs("form", { onSubmit: handleSubmit, className: "rounded-md border border-border bg-muted/30 p-4", children: [_jsxs("div", { className: "grid gap-3 sm:grid-cols-3", children: [_jsxs("div", { className: "space-y-1.5 sm:col-span-3", children: [_jsx(Label, { className: "text-caption", children: "Name" }), _jsx(Input, { value: name, onChange: (e) => setName(e.target.value), placeholder: "Party name", className: "h-10 rounded-md" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { className: "text-caption", children: "Role" }), _jsx(Input, { value: role, onChange: (e) => setRole(e.target.value), placeholder: "Plaintiff, Defendant\u2026", className: "h-10 rounded-md" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { className: "text-caption", children: "Type" }), _jsxs("select", { value: type, onChange: (e) => setType(e.target.value), className: "h-10 w-full rounded-md border border-border bg-card px-3 text-helper outline-none", children: [_jsx("option", { value: "client", children: "Client" }), _jsx("option", { value: "sub_client", children: "Sub-client" }), _jsx("option", { value: "opposing_party", children: "Opposing Party" }), _jsx("option", { value: "counsel", children: "Counsel" }), _jsx("option", { value: "other", children: "Other" })] })] })] }), _jsxs("div", { className: "mt-3 flex justify-end gap-2", children: [_jsxs(Button, { type: "button", variant: "ghost", size: "sm", className: "rounded-md", onClick: () => setShow(false), children: [_jsx(X, { size: 14 }), " Cancel"] }), _jsxs(Button, { type: "submit", size: "sm", className: "gradient-primary rounded-md text-primary-foreground", disabled: !name.trim() || addParty.isPending, children: [addParty.isPending ? _jsx(Loader2, { size: 14, className: "animate-spin" }) : _jsx(Check, { size: 14 }), " Save"] })] })] }));
}
// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
function CaseWorkspace() {
    const { caseId } = Route.useParams();
    const { data, isLoading, isError } = useCase(caseId);
    const [active, setActive] = useState("overview");
    // Linked data — queried only when tab is active
    const { data: docsData } = useDocuments({ caseId });
    const { data: tasksData } = useTasks({ caseId });
    const { data: hearingsData } = useCalendarEvents({
        start: "1970-01-01",
        end: "2099-12-31",
        caseId,
    });
    const { data: auditData } = { data: null }; // activity tab replaced with note/timeline recap
    if (isLoading) {
        return (_jsx("div", { className: "flex min-h-[60vh] items-center justify-center", children: _jsxs("div", { className: "text-center", children: [_jsx(Loader2, { size: 32, className: "mx-auto animate-spin text-muted-foreground" }), _jsx("p", { className: "mt-4 text-helper text-muted-foreground", children: "Loading case workspace\u2026" })] }) }));
    }
    if (isError || !data) {
        return (_jsx("div", { className: "flex min-h-[60vh] items-center justify-center", children: _jsxs("div", { className: "max-w-sm text-center", children: [_jsx("h2", { className: "text-xl font-semibold", children: "Case not found" }), _jsx("p", { className: "mt-2 text-helper text-muted-foreground", children: "This case may have been deleted or you don't have access to it." })] }) }));
    }
    const record = data.case;
    const documents = docsData?.documents ?? [];
    const tasks = tasksData?.tasks ?? [];
    const hearings = (hearingsData?.events ?? []).filter((e) => e.type === "hearing");
    return (_jsxs("div", { children: [_jsx(PageHeader, { breadcrumb: [
                    { label: "StillWorks", to: "/" },
                    { label: "Cases", to: "/cases" },
                    { label: record.number },
                ], title: record.title, subtitle: `${record.parties?.[0]?.name ?? "No client"} · ${record.court || "No court"}`, actions: _jsxs(_Fragment, { children: [_jsx(Button, { variant: "outline", className: "rounded-md", asChild: true, children: _jsxs(Link, { to: "/calendar", children: [_jsx(CalendarDays, { size: 17, strokeWidth: 1.75 }), " View calendar"] }) }), _jsx(QuickEditDropdown, { record: record, caseId: caseId })] }) }), _jsxs("div", { className: "gradient-primary mb-6 rounded-lg p-6 text-primary-foreground shadow-lift", children: [_jsx("div", { className: "grid gap-6 md:grid-cols-4", children: [
                            ["Status", record.status],
                            ["Priority", record.priority],
                            ["Assigned", record.assignedTo?.name ?? "Unassigned"],
                            ["Next hearing", formatDate(record.nextHearing)],
                        ].map(([label, value]) => (_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-caption opacity-85", children: label }), _jsx("p", { className: "mt-1 truncate text-body font-semibold", children: value })] }, label))) }), _jsxs("div", { className: "mt-6 flex items-center gap-3", children: [_jsx(Progress, { value: record.progress, className: "h-1.5 bg-white/25" }), _jsxs("span", { className: "num shrink-0 text-caption", children: [record.progress, "% complete"] })] })] }), _jsxs("div", { className: "grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]", children: [_jsx("nav", { "aria-label": "Case sections", className: "lg:sticky lg:top-28 lg:self-start", children: _jsx("ul", { className: "flex gap-1 overflow-x-auto rounded-lg border border-border bg-card p-2 shadow-soft lg:flex-col lg:overflow-visible", children: sections.map((s) => (_jsx("li", { className: "shrink-0 lg:shrink", children: _jsxs("button", { onClick: () => setActive(s.id), "aria-current": active === s.id ? "true" : undefined, className: `flex min-h-11 w-full items-center gap-2.5 rounded-sm px-3 text-helper font-medium transition-colors duration-150 ${active === s.id
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground hover:bg-accent hover:text-foreground"}`, children: [_jsx(s.icon, { size: 18, strokeWidth: 1.75 }), s.label] }) }, s.id))) }) }), _jsxs("div", { className: "min-w-0 space-y-6", children: [active === "overview" && (_jsxs(_Fragment, { children: [_jsxs(SectionCard, { title: "Matter summary", description: "The essentials, nothing else.", icon: LayoutDashboard, children: [_jsx("p", { className: "text-body text-muted-foreground", children: record.description || "No description provided yet." }), _jsx("dl", { className: "mt-6 grid gap-4 sm:grid-cols-3", children: [
                                                    ["Practice area", record.practice],
                                                    ["Filed on", formatDate(record.createdAt)],
                                                    ["Case number", record.number],
                                                ].map(([k, v]) => (_jsxs("div", { className: "rounded-md bg-muted/60 p-4", children: [_jsx("dt", { className: "text-caption text-muted-foreground", children: k }), _jsx("dd", { className: "mt-1 truncate text-helper font-medium", children: v })] }, k))) }), record.tags && record.tags.length > 0 && (_jsx("div", { className: "mt-4 flex flex-wrap gap-1.5", children: record.tags.map((t) => (_jsx("span", { className: "rounded-pill bg-primary/10 px-3 py-1 text-caption font-medium text-primary", children: t }, t))) }))] }), record.timeline && record.timeline.length > 0 && (_jsx(SectionCard, { title: "Recent timeline", description: "How the matter progressed.", icon: History, children: _jsx("ol", { className: "relative space-y-5 border-l border-border pl-6", children: record.timeline.slice(-6).reverse().map((t) => (_jsxs("li", { className: "relative", children: [_jsx("span", { className: "absolute top-1.5 -left-[1.9rem] size-2.5 rounded-full bg-primary ring-4 ring-card" }), _jsx("p", { className: "font-medium", children: t.event }), _jsxs("p", { className: "text-helper text-muted-foreground", children: [formatDate(t.when), " \u00B7 ", t.by] })] }, t._id ?? t.event))) }) }))] })), active === "hearings" && (_jsx(SectionCard, { title: "Hearings", description: "Court dates and scheduled hearings for this matter.", icon: Gavel, children: hearings.length === 0 ? (_jsxs("div", { className: "rounded-lg border border-dashed p-12 text-center", children: [_jsx(Gavel, { size: 32, className: "mx-auto text-muted-foreground", strokeWidth: 1.5 }), _jsx("p", { className: "mt-4 font-medium", children: "No hearings scheduled" }), _jsx("p", { className: "mt-1 text-helper text-muted-foreground", children: "Schedule a hearing from the Calendar module to link it to this case." }), _jsx(Button, { className: "mt-4 gradient-primary rounded-md text-primary-foreground", asChild: true, children: _jsxs(Link, { to: "/calendar", children: [_jsx(CalendarDays, { size: 16 }), " Open calendar"] }) })] })) : (_jsx("ol", { className: "relative space-y-5 border-l border-border pl-6", children: hearings.map((h) => (_jsxs("li", { className: "relative", children: [_jsx("span", { className: "absolute top-2 -left-[1.9rem] size-2.5 rounded-full bg-primary ring-4 ring-card" }), _jsxs("div", { className: "rounded-md border border-border bg-card p-4", children: [_jsx("p", { className: "font-medium", children: h.title }), h.description && _jsx("p", { className: "mt-1 text-helper text-muted-foreground", children: h.description }), _jsxs("p", { className: "num mt-2 flex items-center gap-1 text-caption text-muted-foreground", children: [_jsx(Clock, { size: 12 }), formatDate(h.start), " · ", new Date(h.start).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })] })] })] }, h._id))) })) })), active === "documents" && (_jsx(SectionCard, { title: "Documents", description: "Files linked to this matter.", icon: FileText, children: documents.length === 0 ? (_jsxs("div", { className: "rounded-lg border border-dashed p-12 text-center", children: [_jsx(FileText, { size: 32, className: "mx-auto text-muted-foreground", strokeWidth: 1.5 }), _jsx("p", { className: "mt-4 font-medium", children: "No documents yet" }), _jsx("p", { className: "mt-1 text-helper text-muted-foreground", children: "Upload documents through the Documents module to link them to this case." })] })) : (_jsx("ul", { className: "divide-y divide-border/60", children: documents.map((d) => (_jsxs("li", { className: "flex items-center gap-3 py-3", children: [_jsx("span", { className: "num grid size-9 shrink-0 place-items-center rounded-sm bg-muted text-caption font-semibold text-muted-foreground", children: (d.kind ?? "DOC").slice(0, 3) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "truncate text-helper font-medium", children: d.name }), _jsx("p", { className: "truncate text-caption text-muted-foreground", children: d.size })] }), _jsx(StatusPill, { tone: toneForStatus(d.state), children: d.state })] }, d._id))) })) })), active === "tasks" && (_jsx(SectionCard, { title: "Tasks", description: "Work assigned on this matter.", icon: CheckSquare, children: tasks.length === 0 ? (_jsxs("div", { className: "rounded-lg border border-dashed p-12 text-center", children: [_jsx(CheckSquare, { size: 32, className: "mx-auto text-muted-foreground", strokeWidth: 1.5 }), _jsx("p", { className: "mt-4 font-medium", children: "No tasks yet" }), _jsx("p", { className: "mt-1 text-helper text-muted-foreground", children: "Create tasks and link them to this case from the Tasks module." })] })) : (_jsx("ul", { className: "divide-y divide-border/60", children: tasks.map((t) => (_jsxs("li", { className: "flex items-center gap-3 py-3", children: [_jsx("span", { className: "grid size-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground", children: _jsx(CheckSquare, { size: 17, strokeWidth: 1.75 }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "truncate text-helper font-medium", children: t.title }), _jsxs("p", { className: "truncate text-caption text-muted-foreground", children: [t.category?.replace(/_/g, " "), " \u00B7 Due ", formatDate(t.deadline)] })] }), _jsx(StatusPill, { tone: toneForStatus(t.status), children: t.status.replace(/_/g, " ") })] }, t._id))) })) })), active === "notes" && (_jsx(SectionCard, { title: "Notes", description: "Case notes and observations.", icon: StickyNote, action: _jsx(AddNoteForm, { caseId: caseId }), children: record.notes && record.notes.length > 0 ? (_jsx("ul", { className: "space-y-4", children: record.notes.map((n) => (_jsxs("li", { className: "rounded-md border border-border p-4", children: [_jsx("p", { className: "text-body", children: n.text }), _jsxs("p", { className: "mt-2 text-caption text-muted-foreground", children: [n.author, " \u00B7 ", formatRelative(n.createdAt)] })] }, n._id ?? n.text))) })) : (_jsxs("div", { className: "rounded-lg border border-dashed p-12 text-center", children: [_jsx(StickyNote, { size: 32, className: "mx-auto text-muted-foreground", strokeWidth: 1.5 }), _jsx("p", { className: "mt-4 font-medium", children: "No notes yet" }), _jsx("p", { className: "mt-1 text-helper text-muted-foreground", children: "Add a note above to start documenting this matter." })] })) })), active === "parties" && (_jsx(SectionCard, { title: "Parties", description: "Clients, sub-clients and relationships.", icon: Users, action: _jsx(AddPartyForm, { caseId: caseId }), children: record.parties && record.parties.length > 0 ? (_jsx("ul", { className: "grid gap-3 sm:grid-cols-2", children: record.parties.map((p) => (_jsxs("li", { className: "rounded-md border border-border p-4", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("p", { className: "truncate font-medium", children: p.name }), _jsx(StatusPill, { tone: p.type === "client" ? "primary" : p.type === "opposing_party" ? "destructive" : "muted", children: p.type.replace(/_/g, " ") })] }), _jsx("p", { className: "mt-1 truncate text-helper text-muted-foreground", children: p.role })] }, p._id ?? p.name))) })) : (_jsxs("div", { className: "rounded-lg border border-dashed p-12 text-center", children: [_jsx(Users, { size: 32, className: "mx-auto text-muted-foreground", strokeWidth: 1.5 }), _jsx("p", { className: "mt-4 font-medium", children: "No parties added" }), _jsx("p", { className: "mt-1 text-helper text-muted-foreground", children: "Add clients, sub-clients, opposing parties and counsel." })] })) })), active === "timeline" && (_jsx(SectionCard, { title: "Timeline", description: "Every milestone in this matter.", icon: History, children: record.timeline && record.timeline.length > 0 ? (_jsx("ol", { className: "relative space-y-5 border-l border-border pl-6", children: record.timeline.map((t) => (_jsxs("li", { className: "relative", children: [_jsx("span", { className: "absolute top-1.5 -left-[1.9rem] size-2.5 rounded-full bg-primary ring-4 ring-card" }), _jsx("p", { className: "font-medium", children: t.event }), _jsxs("p", { className: "text-helper text-muted-foreground", children: [formatDate(t.when), " \u00B7 ", t.by] })] }, t._id ?? t.event))) })) : (_jsxs("div", { className: "rounded-lg border border-dashed p-12 text-center", children: [_jsx(History, { size: 32, className: "mx-auto text-muted-foreground", strokeWidth: 1.5 }), _jsx("p", { className: "mt-4 font-medium", children: "No timeline entries" })] })) })), active === "activity" && (_jsx(SectionCard, { title: "Activity log", description: "Notes and timeline entries \u2014 everything that's happened.", icon: ActivityIcon, children: (() => {
                                    const items = [
                                        ...(record.timeline ?? []).map((t) => ({ kind: "timeline", text: t.event, by: t.by, when: t.when })),
                                        ...(record.notes ?? []).map((n) => ({ kind: "note", text: n.text, by: n.author, when: n.createdAt })),
                                    ].sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());
                                    if (items.length === 0) {
                                        return (_jsxs("div", { className: "rounded-lg border border-dashed p-12 text-center", children: [_jsx(ActivityIcon, { size: 32, className: "mx-auto text-muted-foreground", strokeWidth: 1.5 }), _jsx("p", { className: "mt-4 font-medium", children: "No activity yet" }), _jsx("p", { className: "mt-1 text-helper text-muted-foreground", children: "Notes and timeline events will appear here." })] }));
                                    }
                                    return (_jsx("ul", { className: "space-y-3", children: items.map((item, i) => (_jsxs("li", { className: "flex gap-3", children: [_jsx("span", { className: "mt-1 grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-caption font-semibold text-primary", children: item.kind === "timeline" ? _jsx(History, { size: 14 }) : _jsx(StickyNote, { size: 14 }) }), _jsxs("div", { className: "min-w-0", children: [_jsxs("p", { className: "text-helper", children: [_jsx("span", { className: "font-medium", children: item.by }), " ", _jsx("span", { className: "text-muted-foreground", children: item.text })] }), _jsx("p", { className: "text-caption text-muted-foreground", children: formatRelative(item.when) })] })] }, i))) }));
                                })() }))] })] })] }));
}
