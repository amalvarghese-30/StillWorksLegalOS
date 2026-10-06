import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { User, Building2, Bell, Lock, Palette, HardDrive, Loader2, Laptop, LogOut, ShieldCheck, Camera, Trash2, RefreshCw, Mail } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/common/Surface";
import { MobileSectionNav } from "@/components/layout/MobileSectionNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";
import { DesktopUpdateSettings } from "@/components/settings/DesktopUpdateSettings";
import { GmailIntegrationSettings } from "@/components/settings/GmailIntegrationSettings";
import {
  useUpdateProfile,
  useUpdateFirm,
  useUpdatePreferences,
  useActiveSessions,
  useRevokeSession,
  useRevokeAllOtherSessions,
} from "@/services/admin";
import { validatePhone, sanitizePhone } from "@/lib/validation";
import { getAccessToken, getApiBase } from "@/services/api";
import { APP_VERSION } from "@/version";
import { isElectron } from "@/platform";

export const Route = createFileRoute("/_shell/settings")({
  validateSearch: (search: Record<string, unknown>): { tab?: string } => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Settings · S & S Legal-Tech LLP" },
      { name: "description", content: "Manage your profile, firm details, notifications, security and storage preferences." },
      { property: "og:title", content: "Settings · S & S Legal-Tech LLP" },
      { property: "og:description", content: "Profile, firm details, notifications, security and storage preferences." },
    ],
  }),
  component: SettingsPage,
});

const tabs = [
  { id: "profile", label: "Profile", icon: User },
  { id: "firm", label: "Firm details", icon: Building2 },
  { id: "gmail", label: "Gmail Integration", icon: Mail },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Lock },
  { id: "storage", label: "Storage", icon: HardDrive },
  { id: "updates", label: "App & Updates", icon: RefreshCw },
];

function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const search = Route.useSearch();
  const [tab, setTab] = useState(search?.tab || "profile");

  useEffect(() => {
    if (search?.tab) {
      setTab(search.tab);
    }
  }, [search?.tab]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isRemovingAvatar, setIsRemovingAvatar] = useState(false);

  const updateProfile = useUpdateProfile();
  const updateFirm = useUpdateFirm();
  const updatePreferences = useUpdatePreferences();

  const activeSessionsQuery = useActiveSessions();
  const revokeSessionMutation = useRevokeSession();
  const revokeAllOtherSessionsMutation = useRevokeAllOtherSessions();

  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file format. Please upload a JPEG, PNG, or WebP image.");
      e.target.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("File size exceeds 2MB limit. Please choose an image smaller than 2MB.");
      e.target.value = "";
      return;
    }

    try {
      setIsUploadingAvatar(true);
      const formData = new FormData();
      formData.append("avatar", file);

      const token = getAccessToken();
      const res = await fetch(`${getApiBase()}/auth/avatar`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to upload avatar");
      }

      await refreshUser();
      toast.success("Profile picture updated successfully");
    } catch (err: any) {
      console.error("Avatar upload error:", err);
      toast.error(err.message || "Failed to upload avatar");
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      setIsRemovingAvatar(true);
      const token = getAccessToken();
      const res = await fetch(`${getApiBase()}/auth/avatar`, {
        method: "DELETE",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to remove avatar");
      }

      await refreshUser();
      toast.success("Profile picture removed");
    } catch (err: any) {
      console.error("Avatar removal error:", err);
      toast.error(err.message || "Failed to remove avatar");
    } finally {
      setIsRemovingAvatar(false);
    }
  };

  // Form state — initialised from auth user
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);

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

  const securitySettings: {
    label: string;
    description: string;
    checked: boolean;
    setter: (val: boolean) => void;
    disabled?: boolean;
    badge?: string;
  }[] = [
    {
      label: "Session inactivity timeout",
      description: "Sign out automatically after 30 minutes of idle inactivity (Enforced)",
      checked: securitySessionTimeout,
      setter: setSecuritySessionTimeout,
    },
    {
      label: "Login alerts",
      description: "Real-time in-app notification when a new device signs in",
      checked: securityLoginAlerts,
      setter: setSecurityLoginAlerts,
    },
    {
      label: "Two-factor authentication",
      description: "Requires enterprise authenticator or SMS integration (Scheduled for next release)",
      checked: securityTwoFactor,
      setter: setSecurityTwoFactor,
      disabled: true,
      badge: "Enterprise Roadmap",
    },
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

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.trim()) {
      const pCheck = validatePhone(phone);
      if (!pCheck.valid) {
        setPhoneError(pCheck.error ?? "Invalid phone number format");
        return;
      }
    }
    setPhoneError(null);
    updateProfile.mutate({ name, phone: phone.trim(), title });
  };

  const handleFirmSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateFirm.mutate({ firmName, firmBarRegistration, firmPrimaryCourt, firmAddress });
  };

  const handlePreferencesSave = (e: React.FormEvent) => {
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

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "S & S", to: "/" }, { label: "Settings" }]}
        title="Settings"
        subtitle="Preferences for you and for the firm."
      />

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <MobileSectionNav
            sections={tabs}
            active={tab}
            onChange={(id) => setTab(id)}
            ariaLabel="Settings sections"
          />

          <div className="mt-4 hidden rounded-xl border border-border/70 bg-card/60 p-3.5 shadow-2xs lg:block">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-xs font-semibold text-foreground">S &amp; S LegalOS</p>
            </div>
            <div className="mt-2.5 space-y-1.5 text-[11px] text-muted-foreground border-t border-border/50 pt-2">
              <div className="flex items-center justify-between">
                <span>Release:</span>
                <span className="font-mono font-semibold text-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border/40">
                  v{APP_VERSION}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Environment:</span>
                <span className="font-medium text-foreground">
                  {isElectron() ? "Desktop (Windows)" : "Web Browser"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-6">
          {tab === "updates" ? (
            <DesktopUpdateSettings />
          ) : tab === "notifications" || tab === "security" ? (
            <div className="space-y-6">
              <SectionCard
                title={tab === "security" ? "Security Policies" : "Notifications"}
                description={tab === "security" ? "Configure session security and login alerts." : "Choose what reaches you, and how."}
                icon={tab === "security" ? Lock : Bell}
              >
                <form onSubmit={handlePreferencesSave}>
                  <ul className="divide-y divide-border">
                    {(tab === "security" ? securitySettings : notificationSettings).map((setting: any) => (
                      <li key={setting.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-medium">{setting.label}</p>
                            {setting.badge && (
                              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-border">
                                {setting.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-helper text-muted-foreground">{setting.description}</p>
                        </div>
                        <Switch
                          checked={setting.checked}
                          onCheckedChange={setting.setter}
                          disabled={Boolean(setting.disabled)}
                          aria-label={setting.label}
                        />
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center gap-3 pt-4 border-t border-border">
                    <Button
                      type="submit"
                      disabled={updatePreferences.isPending}
                      className="gradient-primary rounded-md text-primary-foreground shadow-soft"
                    >
                      {updatePreferences.isPending ? <Loader2 size={17} className="animate-spin" /> : null}
                      {updatePreferences.isPending ? "Saving…" : prefsSaved ? "Saved ✓" : "Save changes"}
                    </Button>
                    {updatePreferences.isError && (
                      <span className="text-caption text-destructive">Failed to save. Please try again.</span>
                    )}
                  </div>
                </form>
              </SectionCard>

              {tab === "security" && (
                <SectionCard
                  title="Active Sessions"
                  description="Devices and browsers currently authenticated to your account."
                  icon={ShieldCheck}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {activeSessionsQuery.data?.sessions.length ?? 0} active session(s)
                      </span>
                      {(activeSessionsQuery.data?.sessions.length ?? 0) > 1 && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={revokeAllOtherSessionsMutation.isPending}
                          onClick={() => revokeAllOtherSessionsMutation.mutate()}
                          className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <LogOut size={13} className="mr-1.5" /> Sign out all other sessions
                        </Button>
                      )}
                    </div>

                    <div className="divide-y divide-border rounded-lg border border-border bg-card">
                      {activeSessionsQuery.data?.sessions.map((s) => (
                        <div key={s._id} className="flex items-center justify-between p-3.5">
                          <div className="flex items-center gap-3">
                            <span className="grid size-9 place-items-center rounded-md bg-muted text-muted-foreground">
                              <Laptop size={18} />
                            </span>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-foreground">
                                  {s.userAgent.slice(0, 48)}...
                                </span>
                                {s.isCurrent && (
                                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                    Current session
                                  </span>
                                )}
                                {s.rememberMe && (
                                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                                    Remember Me
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                                <span>IP: {s.ip || "127.0.0.1"}</span>
                                <span>•</span>
                                <span>Active: {new Date(s.lastActiveAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</span>
                              </div>
                            </div>
                          </div>
                          {!s.isCurrent && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={revokeSessionMutation.isPending}
                              onClick={() => revokeSessionMutation.mutate(s._id)}
                              className="h-8 text-xs text-muted-foreground hover:text-destructive"
                            >
                              Revoke
                            </Button>
                          )}
                        </div>
                      ))}
                      {!activeSessionsQuery.data?.sessions?.length && (
                        <div className="p-4 text-center text-xs text-muted-foreground">
                          No active sessions found.
                        </div>
                      )}
                    </div>
                  </div>
                </SectionCard>
              )}
            </div>
          ) : (
            <SectionCard
              title={tabs.find((t) => t.id === tab)?.label ?? "Profile"}
              description={
                tab === "appearance"
                  ? "Choose how the app looks on this device."
                  : tab === "storage"
                    ? "Manage application filesystem storage, root directories, and write health."
                    : "Keep these details current — they appear on filings and shared documents."
              }
              icon={tabs.find((t) => t.id === tab)?.icon ?? User}
            >
              {tab === "profile" ? (
                <form className="space-y-5 sm:grid sm:grid-cols-2 sm:gap-5" onSubmit={handleSave}>
                  {/* Profile Picture Avatar Section */}
                  <div className="flex flex-col sm:flex-row items-center gap-5 sm:col-span-2 pb-4 border-b border-border/60">
                    <div className="relative group">
                      {user?.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.name}
                          className="size-20 rounded-full object-cover border-2 border-primary/20 shadow-soft"
                        />
                      ) : (
                        <span className="grid size-20 place-items-center rounded-full bg-primary/10 font-display text-xl font-bold text-primary border-2 border-primary/20">
                          {user?.initials ?? "SW"}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5 text-center sm:text-left">
                      <h4 className="text-helper font-semibold text-foreground">Profile Picture</h4>
                      <p className="text-caption text-muted-foreground">
                        JPEG, PNG or WebP, up to 2MB. Displayed across top navigation and chat.
                      </p>
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleAvatarFileSelect}
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isUploadingAvatar}
                          onClick={() => fileInputRef.current?.click()}
                          className="h-8 rounded-md text-xs"
                        >
                          {isUploadingAvatar ? (
                            <Loader2 size={13} className="animate-spin mr-1.5" />
                          ) : (
                            <Camera size={13} className="mr-1.5" />
                          )}
                          {user?.avatarUrl ? "Change Photo" : "Upload Photo"}
                        </Button>
                        {user?.avatarUrl && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={isRemovingAvatar}
                            onClick={handleRemoveAvatar}
                            className="h-8 rounded-md text-xs text-destructive hover:bg-destructive/10"
                          >
                            {isRemovingAvatar ? (
                              <Loader2 size={13} className="animate-spin mr-1.5" />
                            ) : (
                              <Trash2 size={13} className="mr-1.5" />
                            )}
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-helper">Full name</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-12 rounded-md"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-helper">Email</Label>
                    <Input
                      value={user?.email ?? ""}
                      readOnly
                      className="h-12 rounded-md bg-muted text-muted-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-helper">Phone (10-digit Mobile)</Label>
                    <Input
                      value={phone}
                      onChange={(e) => {
                        setPhone(sanitizePhone(e.target.value));
                        if (phoneError) setPhoneError(null);
                      }}
                      placeholder="e.g. 9876543210"
                      className={`h-12 rounded-md ${phoneError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    />
                    {phoneError && <p className="text-caption text-destructive font-medium">{phoneError}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-helper">Designation</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="h-12 rounded-md"
                    />
                  </div>
                  <div className="flex items-center gap-3 sm:col-span-2">
                    <Button
                      type="submit"
                      disabled={updateProfile.isPending}
                      className="gradient-primary rounded-md text-primary-foreground shadow-soft"
                    >
                      {updateProfile.isPending ? <Loader2 size={17} className="animate-spin" /> : null}
                      {updateProfile.isPending ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
                    </Button>
                    {updateProfile.isError && (
                      <span className="text-caption text-destructive">Failed to save. Please try again.</span>
                    )}
                  </div>
                </form>
              ) : tab === "firm" ? (
                <form className="grid gap-5 sm:grid-cols-2" onSubmit={handleFirmSave}>
                  {[
                    { label: "Firm name", value: firmName, setter: setFirmName },
                    { label: "Bar registration", value: firmBarRegistration, setter: setFirmBarRegistration },
                    { label: "Primary court", value: firmPrimaryCourt, setter: setFirmPrimaryCourt },
                    { label: "Office address", value: firmAddress, setter: setFirmAddress },
                  ].map(({ label, value, setter }) => (
                    <div key={label} className="space-y-2">
                      <Label className="text-helper">{label}</Label>
                      <Input
                        value={value}
                        onChange={(e) => setter(e.target.value)}
                        className="h-12 rounded-md"
                      />
                    </div>
                  ))}
                  <div className="flex items-center gap-3 sm:col-span-2">
                    <Button
                      type="submit"
                      disabled={updateFirm.isPending}
                      className="gradient-primary rounded-md text-primary-foreground shadow-soft"
                    >
                      {updateFirm.isPending ? <Loader2 size={17} className="animate-spin" /> : null}
                      {updateFirm.isPending ? "Saving…" : firmSaved ? "Saved ✓" : "Save changes"}
                    </Button>
                    {updateFirm.isError && (
                      <span className="text-caption text-destructive">Failed to save. Please try again.</span>
                    )}
                  </div>
                </form>
              ) : tab === "gmail" ? (
                <GmailIntegrationSettings />
              ) : tab === "appearance" ? (
                <AppearanceSettings />
              ) : tab === "storage" ? (
                <div className="rounded-lg border border-dashed p-12 text-center">
                  <HardDrive size={32} className="mx-auto text-muted-foreground" strokeWidth={1.5} />
                  <p className="mt-4 font-medium">Storage is managed by your administrator</p>
                  <p className="mt-1 text-helper text-muted-foreground">
                    Firm Document Storage configuration is managed from the administrative console.
                  </p>
                </div>
              ) : null}
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}
