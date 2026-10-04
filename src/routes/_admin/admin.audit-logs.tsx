import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Loader2, AlertTriangle, ScrollText } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuditLogs } from "@/services/admin";
import { formatSafeDateTime } from "@/lib/dates";

export const Route = createFileRoute("/_admin/admin/audit-logs")({
  head: () => ({
    meta: [
      { title: "Audit Logs · S & S Legal-Tech LLP" },
      {
        name: "description",
        content: "A searchable record of every action taken inside the firm's legal operating system.",
      },
      { property: "og:title", content: "Audit Logs · S & S Legal-Tech LLP" },
      { property: "og:description", content: "A searchable record of every action taken in the firm." },
    ],
  }),
  component: AuditLogsPage,
});

function AuditLogsPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading, isError } = useAuditLogs();
  const logs = data?.logs ?? [];

  const filtered = search.trim()
    ? logs.filter(
        (l) =>
          l.userName.toLowerCase().includes(search.toLowerCase()) ||
          l.action.toLowerCase().includes(search.toLowerCase()) ||
          (l.resourceName ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (l.ip ?? "").toLowerCase().includes(search.toLowerCase()),
      )
    : logs;

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "S & S", to: "/" }, { label: "Admin", to: "/admin" }, { label: "Audit Logs" }]}
        title="Audit logs"
        subtitle="A clear, tamper-proof record of every action, including who performed it, when it happened, and where it was performed"
      />

      <label className="mb-6 flex items-center gap-3 rounded-pill border border-border bg-card px-4 py-2.5 shadow-soft">
        <Search size={18} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
        <input
          type="search"
          aria-label="Search logs"
          placeholder="Search by user, action, IP or record…"
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
            <div className="overflow-x-auto touch-scroll">
              <table className="w-full min-w-[780px] border-separate border-spacing-y-1 p-2 text-left">
                <thead>
                  <tr className="text-caption text-muted-foreground">
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                    <th className="px-4 py-3 font-medium">Details</th>
                    <th className="px-4 py-3 font-medium">IP / Location</th>
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
                      <td className="px-4 py-4 font-mono text-xs text-muted-foreground">
                        {l.ip ? (l.ip === "::1" || l.ip === "127.0.0.1" ? "Local (127.0.0.1)" : l.ip) : "—"}
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">{l.userAgent ?? "—"}</td>
                      <td className="num rounded-r-md px-4 py-4 text-muted-foreground">
                        {formatSafeDateTime(l.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}