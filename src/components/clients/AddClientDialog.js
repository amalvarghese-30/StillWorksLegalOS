import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp, UserPlus, Building2, Users, FileBadge, Home, Loader2, } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateClient } from "@/services/clients";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from "@/components/ui/dialog";
const EMPTY_FORM = {
    type: "Individual",
    tag: "Active",
    name: "",
    phone: "",
    email: "",
    address: "",
    aadhar: "",
    pan: "",
    propertyAddress: "",
    surveyNo: "",
    chsName: "",
    sector: "",
    plot: "",
    area: "",
};
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function AddClientDialog({ open, onClose }) {
    const [form, setForm] = useState(EMPTY_FORM);
    const [subClients, setSubClients] = useState([]);
    const [showProperty, setShowProperty] = useState(false);
    const [showSubClient, setShowSubClient] = useState(false);
    const createClient = useCreateClient();
    const isPending = createClient.isPending;
    const isError = createClient.isError;
    if (!open)
        return null;
    const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
    const addSubClient = () => {
        setSubClients((prev) => [
            ...prev,
            { name: "", relationship: "", description: "", phone: "", email: "" },
        ]);
    };
    const updateSubClient = (idx, key, value) => {
        setSubClients((prev) => prev.map((sc, i) => (i === idx ? { ...sc, [key]: value } : sc)));
    };
    const removeSubClient = (idx) => {
        setSubClients((prev) => prev.filter((_, i) => i !== idx));
    };
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.name.trim())
            return;
        const payload = {
            type: form.type,
            tag: form.tag,
            name: form.name,
            ...(form.phone && { phone: form.phone }),
            ...(form.email && { email: form.email }),
            ...(form.address && { address: form.address }),
            ...(form.aadhar && { aadhar: form.aadhar }),
            ...(form.pan && { pan: form.pan }),
            ...(showProperty && {
                propertyDetails: {
                    address: form.propertyAddress,
                    surveyNo: form.surveyNo,
                    chsName: form.chsName,
                    sector: form.sector,
                    plot: form.plot,
                    area: form.area,
                },
            }),
            ...(subClients.length > 0 && {
                subClients: subClients.map((sc) => ({
                    name: sc.name,
                    relationship: sc.relationship,
                    phone: sc.phone,
                    email: sc.email,
                    notes: sc.description,
                })),
            }),
        };
        createClient.mutate(payload, {
            onSuccess: () => {
                setForm(EMPTY_FORM);
                setSubClients([]);
                setShowProperty(false);
                setShowSubClient(false);
                onClose();
            },
        });
    };
    return (_jsx(Dialog, { open: open, onOpenChange: onClose, children: _jsxs(DialogContent, { className: "max-w-2xl", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Add new client" }), _jsx(DialogDescription, { children: "Fill in the details below. KYC fields help auto-verify the profile." })] }), _jsxs("form", { className: "space-y-6", onSubmit: handleSubmit, children: [_jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "text-helper", children: "Client type" }), _jsx("div", { className: "flex rounded-md border border-border", children: ["Individual", "Corporate"].map((t) => (_jsx("button", { type: "button", onClick: () => update("type", t), className: `flex-1 px-3 py-2.5 text-helper font-medium transition-colors ${form.type === t
                                                    ? "bg-primary/10 text-primary"
                                                    : "text-muted-foreground hover:text-foreground"} ${t === "Individual" ? "rounded-l-md border-r" : "rounded-r-md"}`, children: t === "Individual" ? (_jsxs("span", { className: "flex items-center justify-center gap-2", children: [_jsx(UserPlus, { size: 15 }), " Individual"] })) : (_jsxs("span", { className: "flex items-center justify-center gap-2", children: [_jsx(Building2, { size: 15 }), " Corporate"] })) }, t))) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "text-helper", children: "Status tag" }), _jsx("div", { className: "flex flex-wrap gap-2", children: ["Active", "VIP", "Corporate", "Individual", "Archived"].map((t) => (_jsx("button", { type: "button", onClick: () => update("tag", t), className: `rounded-pill px-3 py-1.5 text-caption font-medium transition-colors ${form.tag === t
                                                    ? "gradient-primary text-primary-foreground"
                                                    : "border border-border text-muted-foreground hover:text-foreground"}`, children: t }, t))) })] })] }), _jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "client-name", className: "text-helper", children: "Full name *" }), _jsx(Input, { id: "client-name", required: true, value: form.name, onChange: (e) => update("name", e.target.value), placeholder: "e.g. Rupesh Patade", className: "h-11 rounded-md" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "client-phone", className: "text-helper", children: "Phone" }), _jsx(Input, { id: "client-phone", value: form.phone, onChange: (e) => update("phone", e.target.value), placeholder: "+91-XXXXXXXXXX", className: "h-11 rounded-md" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "client-email", className: "text-helper", children: "Email" }), _jsx(Input, { id: "client-email", type: "email", value: form.email, onChange: (e) => update("email", e.target.value), placeholder: "client@example.com", className: "h-11 rounded-md" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "client-address", className: "text-helper", children: "Address" }), _jsx(Input, { id: "client-address", value: form.address, onChange: (e) => update("address", e.target.value), placeholder: "Full address", className: "h-11 rounded-md" })] })] }), _jsxs("div", { className: "rounded-lg border border-border bg-muted/30 p-4", children: [_jsxs("p", { className: "flex items-center gap-2 text-helper font-medium", children: [_jsx(FileBadge, { size: 16, strokeWidth: 1.75, className: "text-muted-foreground" }), "KYC Details"] }), _jsxs("div", { className: "mt-3 grid gap-4 sm:grid-cols-2", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "client-aadhar", className: "text-helper", children: "Aadhar Number" }), _jsx(Input, { id: "client-aadhar", value: form.aadhar, onChange: (e) => update("aadhar", e.target.value), placeholder: "12-digit Aadhar", maxLength: 12, className: "h-11 rounded-md" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "client-pan", className: "text-helper", children: "PAN Number" }), _jsx(Input, { id: "client-pan", value: form.pan, onChange: (e) => update("pan", e.target.value), placeholder: "ABCDE1234F", maxLength: 10, className: "h-11 rounded-md" })] })] }), form.aadhar && form.pan && (_jsx("p", { className: "mt-2 text-caption text-success", children: "KYC will be auto-verified on submission." }))] }), _jsxs("div", { className: "rounded-lg border border-border", children: [_jsxs("button", { type: "button", onClick: () => setShowProperty(!showProperty), className: "flex w-full items-center justify-between px-4 py-3 text-left", children: [_jsxs("p", { className: "flex items-center gap-2 text-helper font-medium", children: [_jsx(Home, { size: 16, strokeWidth: 1.75, className: "text-muted-foreground" }), "Property Details ", _jsx("span", { className: "text-caption text-muted-foreground", children: "(optional)" })] }), showProperty ? _jsx(ChevronUp, { size: 17 }) : _jsx(ChevronDown, { size: 17 })] }), showProperty && (_jsx("div", { className: "border-t border-border p-4", children: _jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [_jsxs("div", { className: "space-y-1.5 sm:col-span-2", children: [_jsx(Label, { htmlFor: "prop-address", className: "text-helper", children: "Property address" }), _jsx(Input, { id: "prop-address", value: form.propertyAddress, onChange: (e) => update("propertyAddress", e.target.value), placeholder: "Full property address", className: "h-11 rounded-md" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "prop-survey", className: "text-helper", children: "Survey No." }), _jsx(Input, { id: "prop-survey", value: form.surveyNo, onChange: (e) => update("surveyNo", e.target.value), placeholder: "Survey number", className: "h-11 rounded-md" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "prop-chs", className: "text-helper", children: "CHS / Building name" }), _jsx(Input, { id: "prop-chs", value: form.chsName, onChange: (e) => update("chsName", e.target.value), placeholder: "e.g. Gurusamridhi CHS Ltd", className: "h-11 rounded-md" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "prop-sector", className: "text-helper", children: "Sector / Area" }), _jsx(Input, { id: "prop-sector", value: form.sector, onChange: (e) => update("sector", e.target.value), placeholder: "e.g. Sector 14, Sanpada", className: "h-11 rounded-md" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "prop-plot", className: "text-helper", children: "Plot No." }), _jsx(Input, { id: "prop-plot", value: form.plot, onChange: (e) => update("plot", e.target.value), placeholder: "Plot number", className: "h-11 rounded-md" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "prop-area", className: "text-helper", children: "Area (sq.ft.)" }), _jsx(Input, { id: "prop-area", value: form.area, onChange: (e) => update("area", e.target.value), placeholder: "e.g. 650", className: "h-11 rounded-md" })] })] }) }))] }), _jsxs("div", { className: "rounded-lg border border-border", children: [_jsxs("button", { type: "button", onClick: () => setShowSubClient(!showSubClient), className: "flex w-full items-center justify-between px-4 py-3 text-left", children: [_jsxs("p", { className: "flex items-center gap-2 text-helper font-medium", children: [_jsx(Users, { size: 16, strokeWidth: 1.75, className: "text-muted-foreground" }), "Sub-clients ", _jsx("span", { className: "text-caption text-muted-foreground", children: "(optional)" })] }), showSubClient ? _jsx(ChevronUp, { size: 17 }) : _jsx(ChevronDown, { size: 17 })] }), showSubClient && (_jsxs("div", { className: "border-t border-border p-4", children: [_jsx("p", { className: "text-helper text-muted-foreground", children: "Add sub-clients like buyers, sellers, family members, or related parties." }), subClients.map((sc, idx) => (_jsxs("div", { className: "mt-4 rounded-md border border-border bg-muted/30 p-4", children: [_jsxs("div", { className: "mb-3 flex items-center justify-between", children: [_jsxs("p", { className: "text-helper font-medium", children: ["Sub-client #", idx + 1] }), _jsx("button", { type: "button", onClick: () => removeSubClient(idx), className: "grid size-8 place-items-center rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive", "aria-label": "Remove sub-client", children: _jsx(Trash2, { size: 15 }) })] }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: `sc-name-${idx}`, className: "text-helper", children: "Name" }), _jsx(Input, { id: `sc-name-${idx}`, value: sc.name, onChange: (e) => updateSubClient(idx, "name", e.target.value), placeholder: "Full name", className: "h-10 rounded-md" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: `sc-rel-${idx}`, className: "text-helper", children: "Relationship" }), _jsx(Input, { id: `sc-rel-${idx}`, value: sc.relationship, onChange: (e) => updateSubClient(idx, "relationship", e.target.value), placeholder: "Buyer / Seller / Partner", className: "h-10 rounded-md" })] }), _jsxs("div", { className: "space-y-1.5 sm:col-span-2", children: [_jsx(Label, { htmlFor: `sc-desc-${idx}`, className: "text-helper", children: "Description / Notes" }), _jsx(Input, { id: `sc-desc-${idx}`, value: sc.description, onChange: (e) => updateSubClient(idx, "description", e.target.value), placeholder: "Who is this sub-client and their role in the matter", className: "h-10 rounded-md" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: `sc-phone-${idx}`, className: "text-helper", children: "Phone" }), _jsx(Input, { id: `sc-phone-${idx}`, value: sc.phone, onChange: (e) => updateSubClient(idx, "phone", e.target.value), placeholder: "+91-XXXXXXXXXX", className: "h-10 rounded-md" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: `sc-email-${idx}`, className: "text-helper", children: "Email" }), _jsx(Input, { id: `sc-email-${idx}`, value: sc.email, onChange: (e) => updateSubClient(idx, "email", e.target.value), placeholder: "email@example.com", className: "h-10 rounded-md" })] })] })] }, idx))), _jsxs("button", { type: "button", onClick: addSubClient, className: "mt-4 flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border py-3 text-helper text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary", children: [_jsx(Plus, { size: 16 }), " Add sub-client"] })] }))] }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: onClose, children: "Cancel" }), _jsxs(Button, { type: "submit", disabled: isPending || !form.name.trim(), className: "gradient-primary rounded-md text-primary-foreground shadow-soft", children: [isPending ? _jsx(Loader2, { size: 17, className: "animate-spin" }) : _jsx(UserPlus, { size: 17, strokeWidth: 2 }), isPending ? "Saving…" : "Save client"] })] }), isError && (_jsx("p", { className: "text-caption text-destructive", children: "Failed to create client. Please try again." }))] })] }) }));
}
