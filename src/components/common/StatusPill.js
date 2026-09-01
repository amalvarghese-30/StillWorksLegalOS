import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from "@/lib/utils";
const tones = {
    neutral: "bg-muted text-muted-foreground",
    success: "bg-success/12 text-success",
    warning: "bg-warning/15 text-warning",
    danger: "bg-destructive/12 text-destructive",
    primary: "bg-primary/12 text-primary",
    violet: "bg-violet/18 text-indigo",
    destructive: "bg-destructive/12 text-destructive",
    indigo: "bg-indigo/12 text-indigo",
    muted: "bg-muted text-muted-foreground",
};
const toneLabels = {
    neutral: "Neutral",
    success: "Success",
    warning: "Warning",
    danger: "Danger",
    primary: "Primary",
    violet: "Violet",
    destructive: "Destructive",
    indigo: "Indigo",
    muted: "Muted",
};
export function StatusPill({ children, tone = "neutral", className, label, }) {
    const ariaLabel = label ?? toneLabels[tone];
    return (_jsx("span", { role: "status", "aria-live": "polite", "aria-label": `${ariaLabel} status: ${typeof children === "string" ? children : ""}`, className: cn("inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-caption font-medium", tones[tone], className), children: children }));
}
export function toneForStatus(status) {
    switch (status) {
        case "Active":
        case "Approved":
        case "Available":
        case "Verified":
        case "Completed":
            return "success";
        case "Urgent":
        case "Overdue":
        case "Rejected":
        case "High":
            return "danger";
        case "On Hold":
        case "Pending":
        case "Busy":
        case "Due Today":
        case "Medium":
            return "warning";
        case "VIP":
        case "Corporate":
        case "In Court":
            return "violet";
        case "Closed":
            return "neutral";
        default:
            return "primary";
    }
}
