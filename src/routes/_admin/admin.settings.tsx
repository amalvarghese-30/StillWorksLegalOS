import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { User, Building2, Bell, Lock, Palette, HardDrive, ListChecks, Loader2, RefreshCw, Camera, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch, getAccessToken, getApiBase } from "@/services/api";
import { adminKeys } from "@/services/admin";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/common/Surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";
import { StorageSettings } from "@/components/settings/StorageSettings";
import { TaskOptionsSettings } from "@/components/settings/TaskOptionsSettings";
import { DesktopUpdateSettings } from "@/components/settings/DesktopUpdateSettings";
import { useUpdateProfile, useUpdateFirm, useUpdatePreferences } from "@/services/admin";
import { validatePhone, sanitizePhone } from "@/lib/validation";
import { SettingsSectionNav } from "@/components/settings/SettingsSectionNav";
import { UserAvatar } from "@/components/common/UserAvatar";
import { isElectron } from "@/platform";
import { APP_VERSION } from "@/version";

export const Route = createFileRoute("/_admin/admin/settings")({
  validateSearch: (search: Record<string, unknown>): { tab?: string } => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Settings · S & S Legal-Tech LLP" },
      {
        name: "description",
        content: "Manage your profile, firm details, notifications, security and storage preferences.",
      },
      { property: "og:title", content: "Settings · S & S Legal-Tech LLP" },
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
  { id: "updates", label: "App & Updates", icon: RefreshCw },
];

function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const [tab, setTab] = useState(search?.tab || "profile");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isRemovingAvatar, setIsRemovingAvatar] = useState(false);

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

      await apiFetch("/auth/avatar", {
        method: "POST",
        body: formData,
      });

      await refreshUser();
      queryClient.invalidateQueries({ queryKey: adminKeys.all });
      queryClient.invalidateQueries({ queryKey: ["chat"] });
      toast.success("Profile picture updated successfully");
    } catch (err: any) {
      console.error("Avatar upload error:", err);
      toast.error(err?.message || "Failed to upload avatar");
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      setIsRemovingAvatar(true);
      await apiFetch("/auth/avatar", {
        method: "DELETE",
      });

      await refreshUser();
      queryClient.invalidateQueries({ queryKey: adminKeys.all });
      queryClient.invalidateQueries({ queryKey: ["chat"] });
      toast.success("Profile picture removed");
    } catch (err: any) {
      console.error("Avatar removal error:", err);
      toast.error(err?.message || "Failed to remove avatar");
    } finally {
      setIsRemovingAvatar(false);
    }
  };

  useEffect(() => {
    if (search?.tab) {
      setTab(search.tab);
    }
  }, [search?.tab]);
  const updateProfile = useUpdateProfile();
  const updateFirm = useUpdateFirm();
  const updatePreferences = useUpdatePreferences();

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
        breadcrumb={[{ label: "Admin", to: "/admin" }, { label: "Settings" }]}
        title="Settings"
        subtitle="Preferences for you and for the firm."
      />

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-[240px_minmax(0,1fr)] w-full min-w-0 max-w-full">
        <div className="w-full min-w-0 lg:sticky lg:top-28 lg:self-start">
          <SettingsSectionNav
            tabs={tabs}
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

        <div className="w-full min-w-0 max-w-full space-y-6">
          {tab === "updates" ? (
            <DesktopUpdateSettings />
          ) : tab === "notifications" || tab === "security" ? (
            <SectionCard
              title={tab === "security" ? "Security" : "Notifications"}
              description="Choose what reaches you, and how."
              icon={tab === "security" ? Lock : Bell}
            >
              <form onSubmit={handlePreferencesSave} className="w-full min-w-0 space-y-4">
                <ul className="divide-y divide-border w-full min-w-0">
                  {(tab === "security" ? securitySettings : notificationSettings).map((setting) => (
                    <li key={setting.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:gap-4 py-3.5 sm:py-4 w-full min-w-0">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm text-foreground break-words">{setting.label}</p>
                        <p className="text-xs sm:text-helper text-muted-foreground break-words mt-0.5">{setting.description}</p>
                      </div>
                      <Switch checked={setting.checked} onCheckedChange={setting.setter} aria-label={setting.label} />
                    </li>
                  ))}
                </ul>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-4 border-t border-border w-full">
                  <Button
                    type="submit"
                    disabled={updatePreferences.isPending}
                    className="gradient-primary rounded-md text-primary-foreground shadow-soft min-h-[44px] h-11 px-5 w-full sm:w-auto text-sm font-semibold"
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
          ) : (
            <SectionCard
              title={tabs.find((t) => t.id === tab)?.label ?? "Profile"}
              description={
                tab === "appearance"
                  ? "Choose how the app looks on this device."
                  : tab === "storage"
                    ? "Manage application filesystem storage, root directories, and write health."
                    : tab === "taskOptions"
                      ? "Manage task categories, checklist templates and agents."
                      : "Keep these details current — they appear on filings and shared documents."
              }
              icon={tabs.find((t) => t.id === tab)?.icon ?? User}
            >
              {tab === "profile" ? (
                <form className="space-y-4 sm:space-y-5 sm:grid sm:grid-cols-2 sm:gap-5 w-full min-w-0" onSubmit={handleSave}>
                  {/* Profile Picture Avatar Section */}
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 sm:col-span-2 pb-4 border-b border-border/60 text-center sm:text-left w-full min-w-0">
                    <div className="relative group shrink-0">
                      <UserAvatar
                        avatarUrl={user?.avatarUrl}
                        name={user?.name}
                        initials={user?.initials ?? "AD"}
                        className="size-20 border-2 border-primary/20 shadow-soft text-xl font-bold"
                      />
                    </div>
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <h4 className="text-helper font-semibold text-foreground">Profile Picture</h4>
                      <p className="text-caption text-muted-foreground break-words">
                        JPEG, PNG or WebP, up to 2MB. Displayed across top navigation, chat, and team directory.
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
                          className="h-9 min-h-[36px] rounded-md text-xs touch-manipulation"
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
                            className="h-9 min-h-[36px] rounded-md text-xs text-destructive hover:bg-destructive/10 touch-manipulation"
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
                  <div className="space-y-2 w-full min-w-0">
                    <Label className="text-helper font-medium">Full name</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-11 sm:h-12 rounded-md w-full"
                    />
                  </div>
                  <div className="space-y-2 w-full min-w-0">
                    <Label className="text-helper font-medium">Email</Label>
                    <Input
                      value={user?.email ?? ""}
                      readOnly
                      className="h-11 sm:h-12 rounded-md bg-muted text-muted-foreground w-full"
                    />
                  </div>
                  <div className="space-y-2 w-full min-w-0">
                    <Label className="text-helper font-medium">Phone (10-digit Mobile)</Label>
                    <Input
                      value={phone}
                      onChange={(e) => {
                        setPhone(sanitizePhone(e.target.value));
                        if (phoneError) setPhoneError(null);
                      }}
                      placeholder="e.g. 9876543210"
                      className={`h-11 sm:h-12 rounded-md w-full ${phoneError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    />
                    {phoneError && <p className="text-caption text-destructive font-medium">{phoneError}</p>}
                  </div>
                  <div className="space-y-2 w-full min-w-0">
                    <Label className="text-helper font-medium">Designation</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="h-11 sm:h-12 rounded-md w-full"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:col-span-2 pt-2 border-t border-border/50 w-full">
                    <Button
                      type="submit"
                      disabled={updateProfile.isPending}
                      className="gradient-primary rounded-md text-primary-foreground shadow-soft min-h-[44px] h-11 px-5 w-full sm:w-auto text-sm font-semibold touch-manipulation"
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
                <form className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 w-full min-w-0" onSubmit={handleFirmSave}>
                  <div className="space-y-2 w-full min-w-0 sm:col-span-1">
                    <Label className="text-helper font-medium">Firm name</Label>
                    <Input
                      value={firmName}
                      onChange={(e) => setFirmName(e.target.value)}
                      placeholder="e.g. S & S Legal-Tech LLP"
                      className="h-11 sm:h-12 rounded-md w-full"
                    />
                  </div>
                  <div className="space-y-2 w-full min-w-0 sm:col-span-1">
                    <Label className="text-helper font-medium">Bar registration</Label>
                    <Input
                      value={firmBarRegistration}
                      onChange={(e) => setFirmBarRegistration(e.target.value)}
                      placeholder="e.g. MAH/1234/2018"
                      className="h-11 sm:h-12 rounded-md w-full"
                    />
                  </div>
                  <div className="space-y-2 w-full min-w-0 sm:col-span-2">
                    <Label className="text-helper font-medium">Primary court</Label>
                    <Input
                      value={firmPrimaryCourt}
                      onChange={(e) => setFirmPrimaryCourt(e.target.value)}
                      placeholder="e.g. High Court of Judicature at Bombay"
                      className="h-11 sm:h-12 rounded-md w-full"
                    />
                  </div>
                  <div className="space-y-2 w-full min-w-0 sm:col-span-2">
                    <Label className="text-helper font-medium">Office address</Label>
                    <Textarea
                      value={firmAddress}
                      onChange={(e) => setFirmAddress(e.target.value)}
                      placeholder="Building name, Chamber/Suite number, Street, City, State, PIN"
                      rows={3}
                      className="min-h-[88px] rounded-md w-full resize-y text-sm p-3"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:col-span-2 pt-2 border-t border-border/50 w-full">
                    <Button
                      type="submit"
                      disabled={updateFirm.isPending}
                      className="gradient-primary rounded-md text-primary-foreground shadow-soft min-h-[44px] h-11 px-5 w-full sm:w-auto text-sm font-semibold touch-manipulation"
                    >
                      {updateFirm.isPending ? <Loader2 size={17} className="animate-spin" /> : null}
                      {updateFirm.isPending ? "Saving…" : firmSaved ? "Saved ✓" : "Save changes"}
                    </Button>
                    {updateFirm.isError && (
                      <span className="text-caption text-destructive">Failed to save. Please try again.</span>
                    )}
                  </div>
                </form>
              ) : tab === "appearance" ? (
                <AppearanceSettings />
              ) : tab === "storage" ? (
                <StorageSettings />
              ) : tab === "taskOptions" ? (
                <TaskOptionsSettings />
              ) : null}
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}
