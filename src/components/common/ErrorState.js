import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
/**
 * Friendly, retryable error placeholder. Use this instead of an empty state
 * when a query fails, so a transient outage doesn't read as "your data is
 * gone" to a non-technical user.
 */
export function ErrorState({ title = "Couldn't load this data", description = "We couldn't reach the server. Check your connection and try again.", onRetry, }) {
    return (_jsxs("div", { className: "flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center", children: [_jsx(AlertTriangle, { size: 20, strokeWidth: 1.75, className: "text-destructive" }), _jsxs("div", { children: [_jsx("p", { className: "font-medium text-destructive", children: title }), _jsx("p", { className: "mt-1 text-helper text-muted-foreground", children: description })] }), onRetry && (_jsxs(Button, { variant: "outline", size: "sm", className: "rounded-md", onClick: onRetry, children: [_jsx(RotateCw, { size: 15, strokeWidth: 1.75 }), "Retry"] }))] }));
}
