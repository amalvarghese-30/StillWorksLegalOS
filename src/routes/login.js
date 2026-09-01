import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Scale, ArrowRight, ShieldAlert, UserCog, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth";
export const Route = createFileRoute("/login")({
    head: () => ({
        meta: [
            { title: "Sign in · StillWorks LegalOS" },
            {
                name: "description",
                content: "Sign in to StillWorks LegalOS — the calm operating system for modern law firms.",
            },
            { property: "og:title", content: "Sign in · StillWorks LegalOS" },
            { property: "og:description", content: "The calm operating system for modern law firms." },
        ],
    }),
    component: LoginPage,
});
function LoginPage() {
    const { user, ready, signIn } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState(null);
    useEffect(() => {
        if (ready && user)
            navigate({ to: user.role === "admin" ? "/admin" : "/", replace: true });
    }, [ready, user, navigate]);
    const [loading, setLoading] = useState(false);
    const submit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const result = await signIn(email, password);
            if (!result.ok) {
                setError(result.error);
                return;
            }
            navigate({ to: result.user.role === "admin" ? "/admin" : "/", replace: true });
        }
        finally {
            setLoading(false);
        }
    };
    const fill = (role) => {
        setEmail(`${role}@stillworks.legal`);
        setPassword(`${role}123`);
        setError(null);
    };
    return (_jsxs("div", { className: "app-canvas grid min-h-screen lg:grid-cols-2", children: [_jsx("div", { className: "page-enter flex items-center justify-center px-6 py-16", children: _jsxs("div", { className: "w-full max-w-sm", children: [_jsx("span", { className: "gradient-primary grid size-12 place-items-center rounded-md text-primary-foreground shadow-soft", children: _jsx(Scale, { size: 22, strokeWidth: 1.75 }) }), _jsx("h1", { className: "mt-6 text-hero font-semibold tracking-tight", children: "Welcome back" }), _jsx("p", { className: "mt-2 text-body text-muted-foreground", children: "Sign in to your firm's legal operating system." }), _jsxs("form", { className: "mt-8 space-y-5", onSubmit: submit, children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "email", className: "text-helper", children: "Email address" }), _jsx(Input, { id: "email", type: "email", autoComplete: "email", value: email, onChange: (e) => setEmail(e.target.value), placeholder: "you@firm.legal", className: "h-12 rounded-md" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "password", className: "text-helper", children: "Password" }), _jsx(Input, { id: "password", type: "password", autoComplete: "current-password", value: password, onChange: (e) => setPassword(e.target.value), placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", className: "h-12 rounded-md" })] }), error ? (_jsx("p", { role: "alert", className: "text-helper text-destructive", children: error })) : null, _jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsxs("label", { className: "flex items-center gap-2 text-helper text-muted-foreground", children: [_jsx(Checkbox, { id: "remember", defaultChecked: true }), " Remember me"] }), _jsx("button", { type: "button", className: "text-helper text-primary hover:underline", children: "Forgot password?" })] }), _jsxs(Button, { type: "submit", disabled: loading, className: "gradient-primary h-12 w-full rounded-md text-primary-foreground shadow-soft transition-transform duration-200 hover:-translate-y-0.5", children: [loading ? _jsx(Loader2, { size: 17, className: "animate-spin" }) : _jsx(ArrowRight, { size: 17, strokeWidth: 1.75 }), loading ? "Signing in…" : "Sign in"] })] }), _jsxs("div", { className: "mt-6 rounded-md border border-border/70 bg-card/70 p-3", children: [_jsx("p", { className: "text-caption font-medium tracking-wide text-muted-foreground uppercase", children: "Demo access" }), _jsxs("div", { className: "mt-3 grid gap-2 sm:grid-cols-2", children: [_jsxs("button", { type: "button", onClick: () => fill("admin"), className: "flex items-center gap-2 rounded-sm border border-border/70 px-3 py-2 text-helper transition-colors hover:bg-accent", children: [_jsx(ShieldAlert, { size: 16, strokeWidth: 1.75 }), " Admin"] }), _jsxs("button", { type: "button", onClick: () => fill("employee"), className: "flex items-center gap-2 rounded-sm border border-border/70 px-3 py-2 text-helper transition-colors hover:bg-accent", children: [_jsx(UserCog, { size: 16, strokeWidth: 1.75 }), " Employee"] })] }), _jsx("p", { className: "mt-3 text-caption text-muted-foreground", children: "admin@stillworks.legal / admin123 \u00B7 employee@stillworks.legal / employee123" })] })] }) }), _jsxs("div", { className: "relative hidden items-center justify-center overflow-hidden p-12 lg:flex", children: [_jsx("div", { className: "gradient-primary absolute inset-6 rounded-3xl opacity-95" }), _jsxs("div", { className: "glass relative w-full max-w-md rounded-2xl p-8", children: [_jsx("p", { className: "text-caption font-medium tracking-wide text-muted-foreground uppercase", children: "StillWorks LegalOS" }), _jsx("p", { className: "mt-4 font-display text-section leading-snug font-semibold", children: "\"Every hearing, every document, every client \u2014 in one calm place.\"" }), _jsx("div", { className: "mt-8 grid grid-cols-3 gap-4", children: [
                                    ["36", "Active cases"],
                                    ["128", "Clients"],
                                    ["1.2k", "Documents"],
                                ].map(([v, l]) => (_jsxs("div", { className: "rounded-md bg-card/70 p-4", children: [_jsx("p", { className: "num text-section font-semibold", children: v }), _jsx("p", { className: "text-caption text-muted-foreground", children: l })] }, l))) })] })] })] }));
}
