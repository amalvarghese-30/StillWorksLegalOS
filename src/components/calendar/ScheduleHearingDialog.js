import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Gavel, Loader2, CalendarDays, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useCreateEvent } from "@/services/calendar";
import { useCases } from "@/services/cases";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from "@/components/ui/dialog";
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const EVENT_TYPES = [
    { value: "hearing", label: "Hearing" },
    { value: "call_reminder", label: "Call reminder" },
    { value: "task", label: "Task" },
    { value: "firm_event", label: "Firm event" },
    { value: "leave", label: "Leave" },
    { value: "personal", label: "Personal" },
];
export function ScheduleHearingDialog({ open, onClose }) {
    const createEvent = useCreateEvent();
    const { data: casesData } = useCases({ page: "1", limit: "50" });
    const cases = casesData?.cases ?? [];
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [type, setType] = useState("hearing");
    const [startDate, setStartDate] = useState("");
    const [startTime, setStartTime] = useState("10:30");
    const [endDate, setEndDate] = useState("");
    const [endTime, setEndTime] = useState("11:30");
    const [allDay, setAllDay] = useState(false);
    const [caseId, setCaseId] = useState("");
    if (!open)
        return null;
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!title.trim() || !startDate)
            return;
        const payload = {
            title: title.trim(),
            description,
            type,
            start: allDay ? `${startDate}T00:00:00` : `${startDate}T${startTime}:00`,
            allDay,
        };
        if (!allDay && (endDate || (startDate && startTime))) {
            payload.end = endDate
                ? `${endDate}T${endTime}:00`
                : `${startDate}T${endTime}:00`;
        }
        if (caseId)
            payload.caseId = caseId;
        createEvent.mutate(payload, {
            onSuccess: () => {
                setTitle("");
                setDescription("");
                setType("hearing");
                setStartDate("");
                setStartTime("10:30");
                setEndDate("");
                setEndTime("11:30");
                setAllDay(false);
                setCaseId("");
                onClose();
            },
        });
    };
    const isPending = createEvent.isPending;
    return (_jsx(Dialog, { open: open, onOpenChange: onClose, children: _jsxs(DialogContent, { className: "max-w-lg", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Schedule event" }), _jsx(DialogDescription, { children: "Add a hearing, call reminder, task or firm event to the calendar." })] }), _jsxs("form", { className: "space-y-5", onSubmit: handleSubmit, children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "text-helper", children: "Event type" }), _jsx("div", { className: "flex flex-wrap gap-2", children: EVENT_TYPES.map((t) => (_jsx("button", { type: "button", onClick: () => setType(t.value), className: `rounded-pill px-3 py-1.5 text-caption font-medium transition-colors ${type === t.value
                                            ? "gradient-primary text-primary-foreground"
                                            : "border border-border text-muted-foreground hover:text-foreground"}`, children: t.label }, t.value))) })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "event-title", className: "text-helper", children: "Title *" }), _jsx(Input, { id: "event-title", required: true, value: title, onChange: (e) => setTitle(e.target.value), placeholder: "e.g. Bail hearing \u2013 State v. Sharma", className: "h-11 rounded-md" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "event-desc", className: "text-helper", children: "Description" }), _jsx(Input, { id: "event-desc", value: description, onChange: (e) => setDescription(e.target.value), placeholder: "Brief notes on what this event covers", className: "h-11 rounded-md" })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx(Label, { className: "text-helper", children: "Date & time" }), _jsxs("label", { className: "flex items-center gap-2 text-caption text-muted-foreground cursor-pointer", children: [_jsx(Switch, { checked: allDay, onCheckedChange: setAllDay }), "All day"] })] }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsxs(Label, { htmlFor: "event-start-date", className: "text-caption text-muted-foreground", children: [_jsx(CalendarDays, { size: 13, className: "inline mr-1" }), "Start date *"] }), _jsx(Input, { id: "event-start-date", type: "date", required: true, value: startDate, onChange: (e) => {
                                                        setStartDate(e.target.value);
                                                        if (!endDate)
                                                            setEndDate(e.target.value);
                                                    }, className: "h-11 rounded-md" })] }), !allDay && (_jsxs("div", { className: "space-y-1.5", children: [_jsxs(Label, { htmlFor: "event-start-time", className: "text-caption text-muted-foreground", children: [_jsx(Clock, { size: 13, className: "inline mr-1" }), "Start time"] }), _jsx(Input, { id: "event-start-time", type: "time", value: startTime, onChange: (e) => setStartTime(e.target.value), className: "h-11 rounded-md" })] }))] }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsxs(Label, { htmlFor: "event-end-date", className: "text-caption text-muted-foreground", children: [_jsx(CalendarDays, { size: 13, className: "inline mr-1" }), "End date"] }), _jsx(Input, { id: "event-end-date", type: "date", value: endDate, onChange: (e) => setEndDate(e.target.value), className: "h-11 rounded-md" })] }), !allDay && (_jsxs("div", { className: "space-y-1.5", children: [_jsxs(Label, { htmlFor: "event-end-time", className: "text-caption text-muted-foreground", children: [_jsx(Clock, { size: 13, className: "inline mr-1" }), "End time"] }), _jsx(Input, { id: "event-end-time", type: "time", value: endTime, onChange: (e) => setEndTime(e.target.value), className: "h-11 rounded-md" })] }))] })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "event-case", className: "text-helper", children: "Linked case" }), _jsxs("select", { id: "event-case", value: caseId, onChange: (e) => setCaseId(e.target.value), className: "h-11 w-full rounded-md border border-border bg-background px-3 text-helper text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary", children: [_jsx("option", { value: "", children: "None" }), cases.map((c) => (_jsxs("option", { value: c._id, children: [c.number, " \u00B7 ", c.title] }, c._id)))] })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: onClose, children: "Cancel" }), _jsxs(Button, { type: "submit", disabled: isPending || !title.trim() || !startDate, className: "gradient-primary rounded-md text-primary-foreground shadow-soft", children: [isPending ? _jsx(Loader2, { size: 17, className: "animate-spin" }) : _jsx(Gavel, { size: 17, strokeWidth: 2 }), isPending ? "Scheduling…" : "Schedule event"] })] }), createEvent.isError && (_jsx("p", { className: "text-caption text-destructive", children: "Failed to schedule event. Please try again." }))] })] }) }));
}
