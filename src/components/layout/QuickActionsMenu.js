import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { Briefcase, UserPlus, UploadCloud, Gavel } from "lucide-react";
import { AddCaseDialog } from "@/components/cases/AddCaseDialog";
import { AddClientDialog } from "@/components/clients/AddClientDialog";
import { ScheduleHearingDialog } from "@/components/calendar/ScheduleHearingDialog";
import { UploadDocumentDialog } from "@/components/documents/UploadDocumentDialog";
/**
 * Reusable quick-actions menu + the dialogs it opens. The trigger is caller-
 * supplied via `renderTrigger` so each surface (dashboard header, top bar)
 * can style its own button while sharing the menu and dialog wiring.
 */
export function QuickActionsMenu({ renderTrigger, }) {
    const [open, setOpen] = useState(false);
    const [showAddCase, setShowAddCase] = useState(false);
    const [showAddClient, setShowAddClient] = useState(false);
    const [showScheduleHearing, setShowScheduleHearing] = useState(false);
    const [showUploadDocument, setShowUploadDocument] = useState(false);
    return (_jsxs("div", { className: "relative", children: [renderTrigger(() => setOpen((o) => !o)), open && (_jsxs(_Fragment, { children: [_jsx("div", { className: "fixed inset-0 z-10", onClick: () => setOpen(false) }), _jsxs("div", { className: "absolute right-0 z-20 mt-2 w-56 rounded-lg border border-border bg-card p-2 shadow-lift", children: [_jsxs("button", { className: "flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-helper transition-colors hover:bg-accent", onClick: () => { setOpen(false); setShowAddCase(true); }, children: [_jsx(Briefcase, { size: 17, strokeWidth: 1.75, className: "text-muted-foreground" }), " Add New Case"] }), _jsxs("button", { className: "flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-helper transition-colors hover:bg-accent", onClick: () => { setOpen(false); setShowAddClient(true); }, children: [_jsx(UserPlus, { size: 17, strokeWidth: 1.75, className: "text-muted-foreground" }), " Add New Client"] }), _jsxs("button", { className: "flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-helper transition-colors hover:bg-accent", onClick: () => { setOpen(false); setShowUploadDocument(true); }, children: [_jsx(UploadCloud, { size: 17, strokeWidth: 1.75, className: "text-muted-foreground" }), " Upload Document"] }), _jsxs("button", { className: "flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-helper transition-colors hover:bg-accent", onClick: () => { setOpen(false); setShowScheduleHearing(true); }, children: [_jsx(Gavel, { size: 17, strokeWidth: 1.75, className: "text-muted-foreground" }), " Schedule Hearing"] })] })] })), showAddCase && _jsx(AddCaseDialog, { open: showAddCase, onClose: () => setShowAddCase(false) }), showAddClient && _jsx(AddClientDialog, { open: showAddClient, onClose: () => setShowAddClient(false) }), showScheduleHearing && _jsx(ScheduleHearingDialog, { open: showScheduleHearing, onClose: () => setShowScheduleHearing(false) }), showUploadDocument && _jsx(UploadDocumentDialog, { open: showUploadDocument, onClose: () => setShowUploadDocument(false) })] }));
}
