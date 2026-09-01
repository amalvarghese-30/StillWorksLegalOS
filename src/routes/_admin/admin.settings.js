import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { User, Building2, Bell, Lock, Palette, HardDrive, ListChecks, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/common/Surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";
import { StorageSettings } from "@/components/settings/StorageSettings";
import { TaskOptionsSettings } from "@/components/settings/TaskOptionsSettings";
import { useUpdateProfile, useUpdateFirm, useUpdatePreferences } from "@/services/admin";
export const Route = createFileRoute("/_admin/admin/settings")({
    head: () => ({
        meta: [
            { title: "Settings · StillWorks LegalOS" },
            {
                name: "description",
                content: "Manage your profile, firm details, notifications, security and storage preferences.",
            },
            { property: "og:title", content: "Settings · StillWorks LegalOS" },
            {
                property: "og:description",
                content: "Profile, firm details, notifications, security and storage preferences.",
            },
        ],
    }),
    component: SettingsPage,
});
const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "firm", label: "Firm details", icon: Building2 },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "security", label: "Security", icon: Lock },
    { id: "storage", label: "Storage", icon: HardDrive },
    { id: "taskOptions", label: "Task options", icon: ListChecks },
];
function SettingsPage() {
    const { user } = useAuth();
    const [tab, setTab] = useState("profile");
    const updateProfile = useUpdateProfile();
    const updateFirm = useUpdateFirm();
    const updatePreferences = useUpdatePreferences();
    // Form state — initialised from auth user
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [title, setTitle] = useState("");
    // Firm details form state
    const [firmName, setFirmName] = useState("");
    const [firmBarRegistration, setFirmBarRegistration] = useState("");
    const [firmPrimaryCourt, setFirmPrimaryCourt] = useState("");
    const [firmAddress, setFirmAddress] = useState("");
    // Notification preferences
    const [notifyHearingReminders, setNotifyHearingReminders] = useState(true);
    const [notifyApprovalRequests, setNotifyApprovalRequests] = useState(true);
    const [notifyCallReminders, setNotifyCallReminders] = useState(true);
    const [notifyDailyDigest, setNotifyDailyDigest] = useState(false);
    // Security preferences
    const [securityTwoFactor, setSecurityTwoFactor] = useState(true);
    const [securitySessionTimeout, setSecuritySessionTimeout] = useState(true);
    const [securityLoginAlerts, setSecurityLoginAlerts] = useState(true);
    // Pre-defined arrays for notifications and security settings (typed outside render to avoid union inference)
    const notificationSettings = [
        { label: "Hearing reminders", description: "One day before, and one hour before", checked: notifyHearingReminders, setter: setNotifyHearingReminders },
        { label: "Approval requests", description: "Notify me as soon as something needs review", checked: notifyApprovalRequests, setter: setNotifyApprovalRequests },
        { label: "Call reminders", description: "Alert me 15 minutes before a scheduled call", checked: notifyCallReminders, setter: setNotifyCallReminders },
        { label: "Daily digest", description: "A calm morning summary at 8:00 AM", checked: notifyDailyDigest, setter: setNotifyDailyDigest },
    ];
    const securitySettings = [
        { label: "Two-factor authentication", description: "Ask for a code on every new device", checked: securityTwoFactor, setter: setSecurityTwoFactor },
        { label: "Session timeout", description: "Sign out after 30 minutes of inactivity", checked: securitySessionTimeout, setter: setSecuritySessionTimeout },
        { label: "Login alerts", description: "Email me when a new device signs in", checked: securityLoginAlerts, setter: setSecurityLoginAlerts },
    ];
    useEffect(() => {
        if (user) {
            setName(user.name ?? "");
            setPhone(user.phone ?? "");
            setTitle(user.title ?? "");
            setFirmName(user.firmName ?? "");
            setFirmBarRegistration(user.firmBarRegistration ?? "");
            setFirmPrimaryCourt(user.firmPrimaryCourt ?? "");
            setFirmAddress(user.firmAddress ?? "");
            setNotifyHearingReminders(user.notifyHearingReminders ?? true);
            setNotifyApprovalRequests(user.notifyApprovalRequests ?? true);
            setNotifyCallReminders(user.notifyCallReminders ?? true);
            setNotifyDailyDigest(user.notifyDailyDigest ?? false);
            setSecurityTwoFactor(user.securityTwoFactor ?? true);
            setSecuritySessionTimeout(user.securitySessionTimeout ?? true);
            setSecurityLoginAlerts(user.securityLoginAlerts ?? true);
        }
    }, [user]);
    const handleSave = (e) => {
        e.preventDefault();
        updateProfile.mutate({ name, phone, title });
    };
    const handleFirmSave = (e) => {
        e.preventDefault();
        updateFirm.mutate({ firmName, firmBarRegistration, firmPrimaryCourt, firmAddress });
    };
    const handlePreferencesSave = (e) => {
        e.preventDefault();
        updatePreferences.mutate({
            notifyHearingReminders,
            notifyApprovalRequests,
            notifyCallReminders,
            notifyDailyDigest,
            securityTwoFactor,
            securitySessionTimeout,
            securityLoginAlerts,
        });
    };
    const saved = updateProfile.isSuccess;
    const firmSaved = updateFirm.isSuccess;
    const prefsSaved = updatePreferences.isSuccess;
    return (_jsxs("div", { children: [_jsx(PageHeader, { breadcrumb: [{ label: "Admin", to: "/admin" }, { label: "Settings" }], title: "Settings", subtitle: "Preferences for you and for the firm." }), _jsxs("div", { className: "grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]", children: [_jsx("nav", { "aria-label": "Settings sections", className: "lg:sticky lg:top-28 lg:self-start", children: _jsx("ul", { className: "flex gap-1 overflow-x-auto rounded-lg border border-border bg-card p-2 shadow-soft lg:flex-col lg:overflow-visible", children: tabs.map((t) => (_jsx("li", { className: "shrink-0 lg:shrink", children: _jsxs("button", { onClick: () => setTab(t.id), "aria-current": tab === t.id ? "true" : undefined, className: `flex min-h-11 w-full items-center gap-2.5 rounded-sm px-3 text-helper font-medium transition-colors duration-150 ${tab === t.id
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground hover:bg-accent hover:text-foreground"}`, children: [_jsx(t.icon, { size: 18, strokeWidth: 1.75 }), t.label] }) }, t.id))) }) }), _jsx("div", { className: "min-w-0 space-y-6", children: tab === "notifications" || tab === "security" ? (_jsx(SectionCard, { title: tab === "security" ? "Security" : "Notifications", description: "Choose what reaches you, and how.", icon: tab === "security" ? Lock : Bell, children: _jsxs("form", { onSubmit: handlePreferencesSave, children: [_jsx("ul", { className: "divide-y divide-border", children: (tab === "security" ? securitySettings : notificationSettings).map((setting) => (_jsxs("li", { className: "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "truncate font-medium", children: setting.label }), _jsx("p", { className: "text-helper text-muted-foreground", children: setting.description })] }), _jsx(Switch, { checked: setting.checked, onCheckedChange: setting.setter, "aria-label": setting.label })] }, setting.label))) }), _jsxs("div", { className: "flex items-center gap-3 pt-4 border-t border-border", children: [_jsxs(Button, { type: "submit", disabled: updatePreferences.isPending, className: "gradient-primary rounded-md text-primary-foreground shadow-soft", children: [updatePreferences.isPending ? _jsx(Loader2, { size: 17, className: "animate-spin" }) : null, updatePreferences.isPending ? "Saving…" : prefsSaved ? "Saved ✓" : "Save changes"] }), updatePreferences.isError && (_jsx("span", { className: "text-caption text-destructive", children: "Failed to save. Please try again." }))] })] }) })) : (_jsx(SectionCard, { title: tabs.find((t) => t.id === tab)?.label ?? "Profile", description: tab === "appearance"
                                ? "Choose how StillWorks looks on this device."
                                : tab === "storage"
                                    ? "Manage NAS storage and usage."
                                    : tab === "taskOptions"
                                        ? "Manage task categories, checklist templates and agents."
                                        : "Keep these details current — they appear on filings and shared documents.", icon: tabs.find((t) => t.id === tab)?.icon ?? User, children: tab === "profile" ? (_jsxs("form", { className: "space-y-5 sm:grid sm:grid-cols-2 sm:gap-5", onSubmit: handleSave, children: [[
                                        { label: "Full name", value: name, setter: setName },
                                        { label: "Email", value: user?.email ?? "", readonly: true },
                                        { label: "Phone", value: phone, setter: setPhone },
                                        { label: "Designation", value: title, setter: setTitle },
                                    ].map(({ label, value, setter, readonly }) => (_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "text-helper", children: label }), _jsx(Input, { value: value, onChange: setter ? (e) => setter(e.target.value) : undefined, readOnly: readonly, className: `h-12 rounded-md ${readonly ? "bg-muted text-muted-foreground" : ""}` })] }, label))), _jsxs("div", { className: "flex items-center gap-3 sm:col-span-2", children: [_jsxs(Button, { type: "submit", disabled: updateProfile.isPending, className: "gradient-primary rounded-md text-primary-foreground shadow-soft", children: [updateProfile.isPending ? _jsx(Loader2, { size: 17, className: "animate-spin" }) : null, updateProfile.isPending ? "Saving…" : saved ? "Saved ✓" : "Save changes"] }), updateProfile.isError && (_jsx("span", { className: "text-caption text-destructive", children: "Failed to save. Please try again." }))] })] })) : tab === "firm" ? (_jsxs("form", { className: "grid gap-5 sm:grid-cols-2", onSubmit: handleFirmSave, children: [[
                                        { label: "Firm name", value: firmName, setter: setFirmName },
                                        { label: "Bar registration", value: firmBarRegistration, setter: setFirmBarRegistration },
                                        { label: "Primary court", value: firmPrimaryCourt, setter: setFirmPrimaryCourt },
                                        { label: "Office address", value: firmAddress, setter: setFirmAddress },
                                    ].map(({ label, value, setter }) => (_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "text-helper", children: label }), _jsx(Input, { value: value, onChange: (e) => setter(e.target.value), className: "h-12 rounded-md" })] }, label))), _jsxs("div", { className: "flex items-center gap-3 sm:col-span-2", children: [_jsxs(Button, { type: "submit", disabled: updateFirm.isPending, className: "gradient-primary rounded-md text-primary-foreground shadow-soft", children: [updateFirm.isPending ? _jsx(Loader2, { size: 17, className: "animate-spin" }) : null, updateFirm.isPending ? "Saving…" : firmSaved ? "Saved ✓" : "Save changes"] }), updateFirm.isError && (_jsx("span", { className: "text-caption text-destructive", children: "Failed to save. Please try again." }))] })] })) : tab === "appearance" ? (_jsx(AppearanceSettings, {})) : tab === "storage" ? (_jsx(StorageSettings, {})) : tab === "taskOptions" ? (_jsx(TaskOptionsSettings, {})) : null })) })] })] }));
}
