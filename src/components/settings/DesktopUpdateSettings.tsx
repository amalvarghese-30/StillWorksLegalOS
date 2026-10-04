import { useState, useEffect } from "react";
import { isElectron } from "@/platform";
import { APP_VERSION } from "@/version";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DownloadCloud,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Laptop,
  Globe,
} from "lucide-react";
import { toast } from "sonner";

interface UpdateProgressData {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

export function DesktopUpdateSettings() {
  const [checking, setChecking] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<UpdateProgressData | null>(null);
  const [updateReady, setUpdateReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const isDesktop = isElectron();

  useEffect(() => {
    if (!isDesktop || typeof window === "undefined" || !window.electronAPI) return;

    const cleanupAvailable = window.electronAPI.onUpdateAvailable((info) => {
      setUpdateAvailable(info?.version || "Newer version");
      setError(null);
    });

    const cleanupProgress = window.electronAPI.onDownloadProgress((progress) => {
      setDownloadProgress(progress);
      setError(null);
    });

    const cleanupDownloaded = window.electronAPI.onUpdateDownloaded((info) => {
      setUpdateReady(true);
      setDownloadProgress(null);
      setUpdateAvailable(info?.version || "Newer version");
      toast.success(`LegalOS version ${info?.version || "update"} is ready to install.`);
    });

    return () => {
      cleanupAvailable();
      cleanupProgress();
      cleanupDownloaded();
    };
  }, [isDesktop]);

  const handleCheckForUpdates = async () => {
    if (!isDesktop || !window.electronAPI?.checkForUpdates) {
      toast.info("You are using the web version of LegalOS, which updates automatically upon deployment.");
      return;
    }

    setChecking(true);
    setError(null);
    try {
      const res = await window.electronAPI.checkForUpdates();
      setLastChecked(new Date());

      if (res?.isDev) {
        toast.info("Auto-updater is disabled in local development mode.");
        setChecking(false);
        return;
      }

      if (!res?.success) {
        setError(res?.error || "Unable to reach update server.");
        toast.error(res?.error || "Failed to check for updates.");
      } else if (!res?.updateInfo || res?.updateInfo?.version === APP_VERSION) {
        toast.success("You are on the latest version of LegalOS.");
      } else {
        setUpdateAvailable(res.updateInfo.version);
        toast.info(`Version ${res.updateInfo.version} is available.`);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to check for updates");
      toast.error("Failed to check for updates.");
    } finally {
      setChecking(false);
    }
  };

  const handleInstallAndRestart = async () => {
    if (!isDesktop || !window.electronAPI?.installUpdate) return;
    try {
      await window.electronAPI.installUpdate();
    } catch (err: any) {
      toast.error(err?.message || "Failed to restart and install update.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border/80 bg-card p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                {isDesktop ? <Laptop size={18} strokeWidth={2} /> : <Globe size={18} strokeWidth={2} />}
              </span>
              <div>
                <h3 className="font-display text-base font-semibold text-foreground">
                  {isDesktop ? "Desktop Application Updates" : "Web Application Status"}
                </h3>
                <p className="text-caption text-muted-foreground">
                  {isDesktop
                    ? "Manage and install automated desktop release builds"
                    : "The web application continuously updates from the cloud"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-muted/60 border border-border/70 px-3 py-1 font-mono text-xs font-semibold text-foreground">
              Current: v{APP_VERSION}
            </span>
          </div>
        </div>

        {/* Desktop Specific Updater Controls */}
        {isDesktop ? (
          <div className="mt-5 space-y-4">
            {updateReady ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      Update Ready to Install
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Version <span className="font-mono font-semibold text-foreground">{updateAvailable}</span> has been downloaded and verified. Restart now to apply.
                    </p>
                    <div className="pt-2">
                      <Button
                        onClick={handleInstallAndRestart}
                        className="gradient-primary text-primary-foreground font-semibold shadow-soft rounded-lg h-9 px-4 text-xs"
                      >
                        <RefreshCw size={14} className="mr-1.5" />
                        Update to Latest Version &amp; Restart
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : downloadProgress ? (
              <div className="space-y-2 rounded-xl border border-primary/25 bg-primary/5 p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-primary">Downloading Update ({updateAvailable})...</span>
                  <span className="font-mono font-bold text-foreground">
                    {downloadProgress.percent.toFixed(1)}%
                  </span>
                </div>
                <Progress value={downloadProgress.percent} className="h-2 rounded-full" />
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>
                    {(downloadProgress.transferred / 1024 / 1024).toFixed(1)} MB /{" "}
                    {(downloadProgress.total / 1024 / 1024).toFixed(1)} MB
                  </span>
                  <span>
                    {(downloadProgress.bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s
                  </span>
                </div>
              </div>
            ) : updateAvailable ? (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={16} className="text-primary" />
                      <p className="text-sm font-semibold text-foreground">New Release Available</p>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-mono">
                      <span>v{APP_VERSION}</span>
                      <ArrowRight size={13} className="text-primary" />
                      <span className="font-bold text-primary">v{updateAvailable}</span>
                    </p>
                    <p className="text-xs text-muted-foreground pt-1">
                      Download will proceed automatically in the background.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    disabled={checking}
                    onClick={handleCheckForUpdates}
                    className="gradient-primary text-primary-foreground rounded-lg h-9 text-xs font-semibold shrink-0"
                  >
                    Check Status
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">Automatic Update Verification</p>
                  <p className="text-xs text-muted-foreground">
                    {lastChecked
                      ? `Last checked: ${lastChecked.toLocaleTimeString()}`
                      : "Checks GitHub Releases for verified desktop builds."}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={checking}
                  onClick={handleCheckForUpdates}
                  className="rounded-lg h-9 px-4 text-xs font-semibold shrink-0"
                >
                  <RefreshCw size={14} className={`mr-1.5 ${checking ? "animate-spin" : ""}`} />
                  {checking ? "Checking…" : "Check for Updates"}
                </Button>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
                <AlertCircle size={15} className="shrink-0" />
                <p className="min-w-0 truncate">{error}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-3 rounded-lg bg-muted/30 border border-border/50 p-3.5">
            <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">Continuous Cloud Deployment Active</p>
              <p className="text-caption text-muted-foreground">
                You are accessing LegalOS via modern web browser. All server updates and patches apply seamlessly on page reload.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
