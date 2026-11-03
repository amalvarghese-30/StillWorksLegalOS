import { Loader2, CheckCircle2, XCircle, HardDrive, ShieldCheck, FolderTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStorageConfig, useTestStorageConnection } from "@/services/admin";

export function StorageSettings() {
  const configQuery = useStorageConfig();
  const testMutation = useTestStorageConnection();

  const handleTest = () => {
    testMutation.mutate();
  };

  if (configQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-helper text-muted-foreground">
        <Loader2 size={16} className="animate-spin" />
        Loading storage configuration…
      </div>
    );
  }

  if (configQuery.isError) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-helper text-destructive">
        Could not load storage configuration. Please verify backend connection.
      </div>
    );
  }

  const config = configQuery.data;
  const storagePath = config?.storagePath || config?.url || "./uploads";
  const isWritable = config?.writable ?? true;
  const testResult = testMutation.data;

  const storageStructure = [
    { name: "documents/cases/", desc: "Case-associated filings, exhibits, and evidence" },
    { name: "documents/clients/", desc: "Client KYC, registration, and corporate records" },
    { name: "documents/general/", desc: "Firm templates and reference materials" },
    { name: "chat/", desc: "Team chat attachments and audio notes" },
    { name: "Avatars/", desc: "User profile pictures" },
    { name: "temp/", desc: "Secure upload streaming staging" },
  ];

  return (
    <div className="space-y-6 w-full min-w-0 max-w-full">
      {/* Overview Card */}
      <div className="rounded-lg border border-border bg-card p-4 sm:p-5 shadow-soft w-full min-w-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between w-full min-w-0">
          <div className="flex items-start gap-3 sm:gap-3.5 min-w-0 flex-1">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <HardDrive size={20} strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-body font-semibold text-foreground break-words">
                Application-Managed Filesystem Storage
              </h3>
              <p className="text-helper text-muted-foreground break-words mt-0.5">
                All confidential legal documents, chat attachments, and profile avatars are stored securely on the application server filesystem.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                isWritable
                  ? "bg-green-500/10 text-green-600 dark:text-green-400"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {isWritable ? (
                <>
                  <CheckCircle2 size={13} className="shrink-0" />
                  Storage Active &amp; Writable
                </>
              ) : (
                <>
                  <XCircle size={13} className="shrink-0" />
                  Storage Read-Only / Error
                </>
              )}
            </span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border pt-4 w-full min-w-0">
          <div className="space-y-1 min-w-0">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground block">
              Storage Root Directory
            </span>
            <p className="font-mono text-xs sm:text-helper text-foreground font-medium break-all bg-muted/30 p-2 rounded border border-border/40">
              {storagePath}
            </p>
          </div>
          <div className="space-y-1 min-w-0">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground block">
              Security Model
            </span>
            <p className="text-xs sm:text-helper text-foreground break-words">
              Application-Controlled (Zero direct client filesystem exposure)
            </p>
          </div>
        </div>
      </div>

      {/* Directory Hierarchy Breakdown */}
      <div className="rounded-lg border border-border bg-card p-4 sm:p-5 shadow-soft w-full min-w-0">
        <div className="flex items-center gap-2.5 mb-3">
          <FolderTree size={18} className="text-primary" strokeWidth={1.75} />
          <h4 className="text-helper font-medium text-foreground">Storage Hierarchy</h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full min-w-0">
          {storageStructure.map((item) => (
            <div key={item.name} className="rounded-md border border-border/60 bg-muted/20 p-3 min-w-0">
              <span className="font-mono text-xs font-semibold text-primary break-all block">{item.name}</span>
              <p className="mt-0.5 text-caption text-muted-foreground break-words">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Verification Results */}
      {testResult ? (
        <div
          className={`flex items-start gap-3 rounded-lg border p-4 ${
            testResult.ok
              ? "border-green-500/30 bg-green-500/5"
              : "border-destructive/30 bg-destructive/5"
          }`}
        >
          {testResult.ok ? (
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-green-500" strokeWidth={1.75} />
          ) : (
            <XCircle size={18} className="mt-0.5 shrink-0 text-destructive" strokeWidth={1.75} />
          )}
          <div className="min-w-0 text-helper">
            {testResult.ok ? (
              <>
                <p className="font-medium text-green-600 dark:text-green-400">
                  Filesystem Storage Verification Passed
                </p>
                <p className="text-muted-foreground mt-0.5">
                  Server: {testResult.server ?? "Application Server"}
                  {testResult.compliance?.length ? ` · ${testResult.compliance.join(" · ")}` : ""}
                </p>
                <p className="text-caption text-muted-foreground mt-1">
                  Directory creation, write permissions, and path traversal controls verified cleanly.
                </p>
              </>
            ) : (
              <>
                <p className="font-medium text-destructive">Storage verification failed</p>
                <p className="break-words text-muted-foreground mt-0.5">{testResult.error}</p>
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 border-t border-border pt-4 w-full">
        <Button
          type="button"
          variant="outline"
          onClick={handleTest}
          disabled={testMutation.isPending}
          className="min-h-[44px] h-11 px-4 text-xs font-semibold w-full sm:w-auto touch-manipulation"
        >
          {testMutation.isPending ? (
            <Loader2 size={17} className="animate-spin mr-1.5" />
          ) : (
            <ShieldCheck size={17} strokeWidth={1.75} className="mr-1.5" />
          )}
          {testMutation.isPending ? "Verifying Storage…" : "Verify Storage Health & Permissions"}
        </Button>
      </div>
    </div>
  );
}
