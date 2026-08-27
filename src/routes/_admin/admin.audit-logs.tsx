import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Download, Loader2, AlertTriangle, ScrollText, Shield, AlertCircle, CheckCircle, RefreshCw, FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/common/StatusPill";
import { useAuditLogs, useVerifyAuditChain, useFileIntegrity, useVerifyAllFiles, useVerifyFile } from "@/services/admin";

export const Route = createFileRoute("/_admin/admin/audit-logs")({
  head: () => ({
    meta: [
      { title: "Audit Logs · StillWorks LegalOS" },
      {
        name: "description",
        content: "A searchable record of every action taken inside the firm's legal operating system. Includes tamper-evident chain verification and file integrity monitoring.",
      },
      { property: "og:title", content: "Audit Logs · StillWorks LegalOS" },
      { property: "og:description", content: "A searchable record of every action taken in the firm with integrity verification." },
    ],
  }),
  component: AuditLogsPage,
});

function AuditLogsPage() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"logs" | "chain" | "files">("logs");

  const { data, isLoading, isError } = useAuditLogs();
  const logs = data?.logs ?? [];

  const { data: chainData, isLoading: chainLoading, refetch: refetchChain } = useVerifyAuditChain();
  const { data: filesData, isLoading: filesLoading, refetch: refetchFiles } = useFileIntegrity();
  const verifyAllFiles = useVerifyAllFiles();
  const verifyFile = useVerifyFile();

  const filtered = search.trim()
    ? logs.filter(
        (l) =>
          l.userName.toLowerCase().includes(search.toLowerCase()) ||
          l.action.toLowerCase().includes(search.toLowerCase()) ||
          (l.resourceName ?? "").toLowerCase().includes(search.toLowerCase()),
      )
    : logs;

  const formatWhen = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHrs < 1) return "Just now";
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  const handleVerifyChain = async () => {
    await refetchChain();
  };

  const handleVerifyAllFiles = async () => {
    try {
      await verifyAllFiles.mutateAsync();
      await refetchFiles();
    } catch (err) {
      console.error("Verify all files failed:", err);
    }
  };

  const handleVerifySingleFile = async (fileId: string) => {
    try {
      await verifyFile.mutateAsync(fileId);
      await refetchFiles();
    } catch (err) {
      console.error("Verify file failed:", err);
    }
  };

  const renderLogsTab = () => (
    <>
      <label className="mb-6 flex items-center gap-3 rounded-pill border border-border bg-card px-4 py-2.5 shadow-soft">
        <Search size={18} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
        <input
          type="search"
          aria-label="Search logs"
          placeholder="Search by user, action or record…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-helper outline-none"
        />
      </label>

      {isLoading && (
        <div className="rounded-lg border border-border bg-card p-8 shadow-soft animate-pulse">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-6">
                <div className="h-4 w-28 rounded bg-muted" />
                <div className="h-4 w-32 rounded bg-muted" />
                <div className="h-4 w-40 rounded bg-muted" />
                <div className="h-4 w-24 rounded bg-muted" />
                <div className="h-4 w-20 rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-12 text-center">
          <AlertTriangle size={28} className="text-destructive" />
          <p className="font-medium">Failed to load audit logs</p>
          <p className="text-helper text-muted-foreground">Check that the server is running and try again.</p>
        </div>
      )}

      {!isLoading && !isError && (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-soft">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <ScrollText size={40} strokeWidth={1} className="text-muted-foreground/40" />
              <p className="font-medium text-muted-foreground">
                {search.trim() ? "No matching log entries" : "No audit logs yet"}
              </p>
              <p className="text-helper text-muted-foreground/70">
                {search.trim() ? "Try adjusting your search." : "Activity will appear here as the team works."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-separate border-spacing-y-1 p-2 text-left">
                <thead>
                  <tr className="text-caption text-muted-foreground">
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                    <th className="px-4 py-3 font-medium">Details</th>
                    <th className="px-4 py-3 font-medium">Device</th>
                    <th className="px-4 py-3 font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l) => (
                    <tr
                      key={l._id}
                      className="rounded-md text-helper transition-colors duration-150 hover:bg-accent/60"
                    >
                      <td className="rounded-l-md px-4 py-4 font-medium">{l.userName}</td>
                      <td className="px-4 py-4 capitalize">{l.action.replace(/_/g, " ")}</td>
                      <td className="px-4 py-4 text-muted-foreground">
                        {l.resourceName ?? l.resource} {l.details ? `· ${l.details}` : ""}
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">{l.userAgent ?? "—"}</td>
                      <td className="num rounded-r-md px-4 py-4 text-muted-foreground">{formatWhen(l.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );

  const renderChainTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Audit Log Chain Integrity</h3>
          <p className="text-helper text-muted-foreground">
            Verifies the SHA-256 hash chain linking all audit log entries. A broken chain indicates tampering.
          </p>
        </div>
        <Button onClick={handleVerifyChain} disabled={chainLoading} className="rounded-md">
          <RefreshCw size={17} strokeWidth={1.75} className={chainLoading ? "animate-spin" : ""} />
          Verify Chain
        </Button>
      </div>

      {chainLoading ? (
        <div className="rounded-lg border border-border bg-card p-8 shadow-soft animate-pulse">
          <div className="h-8 w-48 rounded bg-muted" />
        </div>
      ) : chainData ? (
        <div className="rounded-lg border border-border bg-card p-6 shadow-soft">
          {chainData.valid ? (
            <div className="flex items-center gap-4 p-4 rounded-md bg-green-50 border border-green-200">
              <CheckCircle size={28} className="text-green-600 shrink-0" />
              <div>
                <p className="font-medium text-green-800">Audit chain is intact</p>
                <p className="text-sm text-green-700">
                  All {chainData.totalChecked} log entries verified — no tampering detected.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 p-4 rounded-md bg-red-50 border border-red-200">
              <AlertCircle size={28} className="text-red-600 shrink-0" />
              <div>
                <p className="font-medium text-red-800">Chain integrity compromised</p>
                <p className="text-sm text-red-700">
                  Chain broken at sequence #{chainData.brokenAt} — {chainData.totalChecked} entries checked.
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card p-8 shadow-soft text-center">
          <Shield size={40} strokeWidth={1} className="text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-medium text-muted-foreground">Click "Verify Chain" to check integrity</p>
        </div>
      )}
    </div>
  );

  const renderFilesTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">File Integrity Records</h3>
          <p className="text-helper text-muted-foreground">
            SHA-256 hashes for all uploaded documents. Verify files against stored hashes to detect tampering.
          </p>
        </div>
        <Button onClick={handleVerifyAllFiles} disabled={verifyAllFiles.isPending} className="rounded-md">
          <RefreshCw size={17} strokeWidth={1.75} className={verifyAllFiles.isPending ? "animate-spin" : ""} />
          Verify All Files
        </Button>
      </div>

      {filesLoading ? (
        <div className="rounded-lg border border-border bg-card p-8 shadow-soft animate-pulse">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-6">
                <div className="h-4 w-28 rounded bg-muted" />
                <div className="h-4 w-32 rounded bg-muted" />
                <div className="h-4 w-40 rounded bg-muted" />
                <div className="h-4 w-24 rounded bg-muted" />
                <div className="h-4 w-20 rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      ) : filesData ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-soft">
          {filesData.records.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <FileText size={40} strokeWidth={1} className="text-muted-foreground/40" />
              <p className="font-medium text-muted-foreground">No file integrity records</p>
              <p className="text-helper text-muted-foreground/70">Upload documents to create integrity records.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-separate border-spacing-y-1 p-2 text-left">
                <thead>
                  <tr className="text-caption text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Document</th>
                    <th className="px-4 py-3 font-medium">Case</th>
                    <th className="px-4 py-3 font-medium">Size</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Last Verified</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filesData.records.map((r) => {
                    const statusColor = r.status === "verified" ? "success" : r.status === "tampered" ? "destructive" : "muted";
                    return (
                      <tr
                        key={r._id}
                        className="rounded-md text-helper transition-colors duration-150 hover:bg-accent/60"
                      >
                        <td className="rounded-l-md px-4 py-4 font-medium">{r.originalName}</td>
                        <td className="px-4 py-4 text-muted-foreground">
                          {r.caseId ? `${r.caseId.number} · ${r.caseId.title}` : "—"}
                        </td>
                        <td className="px-4 py-4 text-muted-foreground">
                          {(r.size / 1024).toFixed(1)} KB
                        </td>
                        <td className="px-4 py-4">
                          <StatusPill tone={statusColor}>{r.status}</StatusPill>
                        </td>
                        <td className="px-4 py-4 text-muted-foreground">
                          {r.lastVerifiedAt ? new Date(r.lastVerifiedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Never"}
                        </td>
                        <td className="rounded-r-md px-4 py-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleVerifySingleFile(r._id)}
                            disabled={verifyFile.isPending}
                            className="rounded-md"
                          >
                            {verifyFile.isPending ? (
                              <RefreshCw size={15} strokeWidth={1.75} className="animate-spin" />
                            ) : (
                              <Shield size={15} strokeWidth={1.75} />
                            )}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card p-8 shadow-soft text-center">
          <FileText size={40} strokeWidth={1} className="text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-medium text-muted-foreground">Click "Verify All Files" to load records</p>
        </div>
      )}
    </div>
  );

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "StillWorks", to: "/" }, { label: "Admin", to: "/admin" }, { label: "Audit Logs" }]}
        title="Audit logs"
        subtitle="Every action, with who did it, when, from where — plus tamper-evident verification."
        actions={
          <Button variant="outline" className="rounded-md">
            <Download size={17} strokeWidth={1.75} />
            Export
          </Button>
        }
      />

      <div className="mb-6 border-b border-border">
        <nav className="flex gap-1 p-1 bg-muted/50 rounded-lg" role="tablist" aria-label="Audit log views">
          <button
            role="tab"
            aria-selected={activeTab === "logs"}
            onClick={() => setActiveTab("logs")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "logs" ? "bg-background shadow-soft text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-2">
              <ScrollText size={16} strokeWidth={1.75} />
              Logs ({data?.total ?? 0})
            </span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "chain"}
            onClick={() => setActiveTab("chain")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "chain" ? "bg-background shadow-soft text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-2">
              <Shield size={16} strokeWidth={1.75} />
              Chain Verification
            </span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "files"}
            onClick={() => setActiveTab("files")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "files" ? "bg-background shadow-soft text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-2">
              <FileText size={16} strokeWidth={1.75} />
              File Integrity
            </span>
          </button>
        </nav>
      </div>

      {activeTab === "logs" && renderLogsTab()}
      {activeTab === "chain" && renderChainTab()}
      {activeTab === "files" && renderFilesTab()}
    </div>
  );
}