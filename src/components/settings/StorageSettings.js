import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle, PlugZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStorageConfig, useUpdateStorageConfig, useTestStorageConnection } from "@/services/admin";
export function StorageSettings() {
    const configQuery = useStorageConfig();
    const saveMutation = useUpdateStorageConfig();
    const testMutation = useTestStorageConnection();
    const [url, setUrl] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [rootPath, setRootPath] = useState("/LegalOS");
    useEffect(() => {
        if (configQuery.data) {
            setUrl(configQuery.data.url);
            setUsername(configQuery.data.username);
            setRootPath(configQuery.data.rootPath);
            setPassword("");
        }
    }, [configQuery.data]);
    const handleTest = () => {
        testMutation.mutate({ url, username, password, rootPath });
    };
    const handleSave = (e) => {
        e.preventDefault();
        saveMutation.mutate({ url, username, password, rootPath });
    };
    if (configQuery.isLoading) {
        return (_jsxs("div", { className: "flex items-center gap-2 py-8 text-helper text-muted-foreground", children: [_jsx(Loader2, { size: 16, className: "animate-spin" }), "Loading storage configuration\u2026"] }));
    }
    if (configQuery.isError) {
        return (_jsx("div", { className: "rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-helper text-destructive", children: "Could not load storage configuration. Please try again." }));
    }
    const passwordSet = configQuery.data?.passwordSet ?? false;
    const testResult = testMutation.data;
    return (_jsxs("form", { className: "space-y-5", onSubmit: handleSave, children: [_jsxs("div", { className: "grid gap-5 sm:grid-cols-2", children: [_jsxs("div", { className: "space-y-2 sm:col-span-2", children: [_jsx(Label, { className: "text-helper", children: "WebDAV URL" }), _jsx(Input, { value: url, onChange: (e) => setUrl(e.target.value), placeholder: "https://nas.stillworks.legal", className: "h-12 rounded-md" }), _jsx("p", { className: "text-caption text-muted-foreground", children: "The HTTPS WebDAV endpoint for your office Synology NAS (e.g. via Cloudflare Tunnel)." })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "text-helper", children: "Username" }), _jsx(Input, { value: username, onChange: (e) => setUsername(e.target.value), placeholder: "legalos", className: "h-12 rounded-md" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "text-helper", children: "Password" }), _jsx(Input, { type: "password", value: password, onChange: (e) => setPassword(e.target.value), placeholder: passwordSet ? "•••••••• (leave blank to keep)" : "NAS password", autoComplete: "new-password", className: "h-12 rounded-md" })] }), _jsxs("div", { className: "space-y-2 sm:col-span-2", children: [_jsx(Label, { className: "text-helper", children: "Root folder" }), _jsx(Input, { value: rootPath, onChange: (e) => setRootPath(e.target.value), placeholder: "/LegalOS", className: "h-12 rounded-md" }), _jsx("p", { className: "text-caption text-muted-foreground", children: "Folder on the NAS where LegalOS stores case files." })] })] }), testResult ? (_jsxs("div", { className: `flex items-start gap-3 rounded-lg border p-4 ${testResult.ok
                    ? "border-green-500/30 bg-green-500/5"
                    : "border-destructive/30 bg-destructive/5"}`, children: [testResult.ok ? (_jsx(CheckCircle2, { size: 18, className: "mt-0.5 shrink-0 text-green-500", strokeWidth: 1.75 })) : (_jsx(XCircle, { size: 18, className: "mt-0.5 shrink-0 text-destructive", strokeWidth: 1.75 })), _jsx("div", { className: "min-w-0 text-helper", children: testResult.ok ? (_jsxs(_Fragment, { children: [_jsx("p", { className: "font-medium text-green-600 dark:text-green-400", children: "Connected" }), _jsxs("p", { className: "text-muted-foreground", children: ["Server: ", testResult.server ?? "Unknown", testResult.compliance?.length ? ` · ${testResult.compliance.join(", ")}` : ""] }), testResult.rootExists === false ? (_jsx("p", { className: "mt-1 font-medium text-amber-600 dark:text-amber-400", children: "Connected, but the root folder was not found \u2014 create it on the NAS or check the path." })) : null] })) : (_jsxs(_Fragment, { children: [_jsx("p", { className: "font-medium text-destructive", children: "Connection failed" }), _jsx("p", { className: "break-words text-muted-foreground", children: testResult.error })] })) })] })) : null, _jsxs("div", { className: "flex flex-wrap items-center gap-3 border-t border-border pt-4", children: [_jsxs(Button, { type: "button", variant: "outline", onClick: handleTest, disabled: testMutation.isPending || !url.trim(), children: [testMutation.isPending ? _jsx(Loader2, { size: 17, className: "animate-spin" }) : _jsx(PlugZap, { size: 17, strokeWidth: 1.75 }), testMutation.isPending ? "Testing…" : "Test connection"] }), _jsxs(Button, { type: "submit", disabled: saveMutation.isPending, className: "gradient-primary rounded-md text-primary-foreground shadow-soft", children: [saveMutation.isPending ? _jsx(Loader2, { size: 17, className: "animate-spin" }) : null, saveMutation.isPending ? "Saving…" : saveMutation.isSuccess ? "Saved ✓" : "Save configuration"] }), saveMutation.isError ? (_jsx("span", { className: "text-caption text-destructive", children: "Failed to save. Please try again." })) : null] })] }));
}
