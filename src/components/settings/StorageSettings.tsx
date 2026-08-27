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

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({ url, username, password, rootPath });
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
        Could not load storage configuration. Please try again.
      </div>
    );
  }

  const passwordSet = configQuery.data?.passwordSet ?? false;
  const testResult = testMutation.data;

  return (
    <form className="space-y-5" onSubmit={handleSave}>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label className="text-helper">WebDAV URL</Label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://nas.stillworks.legal"
            className="h-12 rounded-md"
          />
          <p className="text-caption text-muted-foreground">
            The HTTPS WebDAV endpoint for your office Synology NAS (e.g. via Cloudflare Tunnel).
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-helper">Username</Label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="legalos"
            className="h-12 rounded-md"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-helper">Password</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={passwordSet ? "•••••••• (leave blank to keep)" : "NAS password"}
            autoComplete="new-password"
            className="h-12 rounded-md"
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label className="text-helper">Root folder</Label>
          <Input
            value={rootPath}
            onChange={(e) => setRootPath(e.target.value)}
            placeholder="/LegalOS"
            className="h-12 rounded-md"
          />
          <p className="text-caption text-muted-foreground">
            Folder on the NAS where LegalOS stores case files.
          </p>
        </div>
      </div>

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
                <p className="font-medium text-green-600 dark:text-green-400">Connected</p>
                <p className="text-muted-foreground">
                  Server: {testResult.server ?? "Unknown"}
                  {testResult.compliance?.length ? ` · ${testResult.compliance.join(", ")}` : ""}
                </p>
                {testResult.rootExists === false ? (
                  <p className="mt-1 font-medium text-amber-600 dark:text-amber-400">
                    Connected, but the root folder was not found — create it on the NAS or check the path.
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <p className="font-medium text-destructive">Connection failed</p>
                <p className="break-words text-muted-foreground">{testResult.error}</p>
              </>
            )}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={handleTest}
          disabled={testMutation.isPending || !url.trim()}
        >
          {testMutation.isPending ? <Loader2 size={17} className="animate-spin" /> : <PlugZap size={17} strokeWidth={1.75} />}
          {testMutation.isPending ? "Testing…" : "Test connection"}
        </Button>
        <Button
          type="submit"
          disabled={saveMutation.isPending}
          className="gradient-primary rounded-md text-primary-foreground shadow-soft"
        >
          {saveMutation.isPending ? <Loader2 size={17} className="animate-spin" /> : null}
          {saveMutation.isPending ? "Saving…" : saveMutation.isSuccess ? "Saved ✓" : "Save configuration"}
        </Button>
        {saveMutation.isError ? (
          <span className="text-caption text-destructive">Failed to save. Please try again.</span>
        ) : null}
      </div>
    </form>
  );
}
