import { useState } from "react";
import { Mail, RefreshCw, Send, Paperclip, ExternalLink, Check, Trash2, Search, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useGmailStatus,
  useGmailMessages,
  useDisconnectGmail,
  useSendGmail,
  useAssociateEmail,
  type GmailMessage,
} from "@/services/gmail";
import { getApiBase, getAccessToken } from "@/services/api";
import { toast } from "sonner";
import { formatSafeDateTime } from "@/lib/dates";

export function GmailIntegrationSettings() {
  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = useGmailStatus();
  const disconnectMutation = useDisconnectGmail();
  const [searchQuery, setSearchQuery] = useState("");
  const { data: messagesData, isLoading: messagesLoading, refetch: refetchMessages } = useGmailMessages(searchQuery);
  const [selectedMessage, setSelectedMessage] = useState<GmailMessage | null>(null);

  // Compose modal state
  const [showCompose, setShowCompose] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const sendEmailMutation = useSendGmail();

  const handleConnectGmail = async () => {
    try {
      const token = getAccessToken();
      const res = await fetch(`${getApiBase()}/gmail/auth-url`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (data?.data?.url) {
        window.open(data.data.url, "_blank", "width=600,height=700");
      } else {
        toast.error("Failed to generate Google OAuth authorization URL");
      }
    } catch (err) {
      console.error("Connect Gmail error:", err);
      toast.error("Error initiating Gmail connection");
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectMutation.mutateAsync();
      toast.success("Gmail disconnected");
    } catch {
      toast.error("Failed to disconnect Gmail");
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim()) {
      toast.error("Please fill in recipient, subject, and message");
      return;
    }
    try {
      await sendEmailMutation.mutateAsync({
        to: composeTo.trim(),
        subject: composeSubject.trim(),
        body: composeBody.trim(),
      });
      toast.success("Email sent successfully");
      setShowCompose(false);
      setComposeTo("");
      setComposeSubject("");
      setComposeBody("");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to send email");
    }
  };

  return (
    <div className="space-y-6">
      {/* Account Status Card */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
              <Mail size={22} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                Google / Gmail Integration
                {status?.connected && (
                  <span className="rounded-pill bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold">
                    Connected
                  </span>
                )}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {status?.connected
                  ? `Active account: ${status.email} (${status.name || "Authorized"})`
                  : status?.clientIdConfigured
                  ? "Connect your firm's Gmail account to send and receive case emails directly."
                  : "Google OAuth credentials not configured on server (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {status?.connected ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    refetchStatus();
                    refetchMessages();
                  }}
                  className="rounded-md h-8 text-xs"
                >
                  <RefreshCw size={13} className="mr-1.5" /> Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={disconnectMutation.isPending}
                  className="rounded-md h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  Disconnect
                </Button>
                <Button
                  size="sm"
                  onClick={() => setShowCompose(true)}
                  className="gradient-primary text-primary-foreground rounded-md h-8 text-xs"
                >
                  <Send size={13} className="mr-1.5" /> Compose Email
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={handleConnectGmail}
                disabled={!status?.clientIdConfigured || statusLoading}
                className="gradient-primary text-primary-foreground rounded-md h-8 text-xs font-semibold"
              >
                <Mail size={14} className="mr-1.5" /> Connect Gmail
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Messages Viewer when connected */}
      {status?.connected && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-soft space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Recent Communications
            </h4>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search emails..."
                  className="h-8 pl-8 text-xs rounded-md w-56"
                />
              </div>
            </div>
          </div>

          {messagesLoading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">Loading recent messages...</div>
          ) : messagesData?.messages?.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
              No messages found.
            </div>
          ) : (
            <div className="divide-y divide-border/60 max-h-96 overflow-y-auto rounded-lg border border-border">
              {messagesData?.messages?.map((msg) => (
                <div
                  key={msg.id}
                  onClick={() => setSelectedMessage(msg)}
                  className="p-3 hover:bg-muted/40 cursor-pointer flex items-center justify-between gap-3 transition-colors text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground truncate">{msg.from}</span>
                      <span className="text-[11px] text-muted-foreground">• {formatSafeDateTime(msg.date)}</span>
                    </div>
                    <p className="font-medium text-foreground/90 truncate mt-0.5">{msg.subject || "(No Subject)"}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{msg.snippet}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Compose Email Modal */}
      {showCompose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-lift space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Send size={15} /> Compose Email
              </h3>
              <button
                type="button"
                onClick={() => setShowCompose(false)}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSendEmail} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">To</Label>
                <Input
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder="client@example.com"
                  className="h-8 text-xs rounded-md"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Subject</Label>
                <Input
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Regarding matter documents..."
                  className="h-8 text-xs rounded-md"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Message</Label>
                <textarea
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Dear Sir / Madam..."
                  rows={6}
                  className="w-full rounded-md border border-border bg-background p-2.5 text-xs text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCompose(false)}
                  className="rounded-md h-8 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={sendEmailMutation.isPending}
                  className="gradient-primary text-primary-foreground rounded-md h-8 text-xs font-semibold"
                >
                  <Send size={13} className="mr-1.5" /> Send Message
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
