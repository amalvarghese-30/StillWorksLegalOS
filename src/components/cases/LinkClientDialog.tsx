import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusPill } from "@/components/common/StatusPill";
import {
  Link2,
  Search,
  UserCheck,
  Building,
  Mail,
  Phone,
  Plus,
  Loader2,
  Check,
  X,
  AlertCircle,
} from "lucide-react";
import { useClients, type ClientRecord } from "@/services/clients";
import { useLinkClientToCase, type CaseRecord } from "@/services/cases";
import { AddClientDialog } from "@/components/clients/AddClientDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const COMMON_CLIENT_ROLES = [
  "Primary Client",
  "Petitioner",
  "Applicant",
  "Plaintiff",
  "Respondent",
  "Defendant",
  "Buyer",
  "Seller",
] as const;

interface LinkClientDialogProps {
  open: boolean;
  onClose: () => void;
  caseRecord: CaseRecord | null;
  onSuccess?: () => void;
}

export function LinkClientDialog({
  open,
  onClose,
  caseRecord,
  onSuccess,
}: LinkClientDialogProps) {
  const [search, setSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [clientRole, setClientRole] = useState("Primary Client");
  const [showAddClient, setShowAddClient] = useState(false);

  const { data: clientsData, isLoading: isClientsLoading } = useClients({ limit: "150" });
  const linkClientMutation = useLinkClientToCase();

  // Determine currently linked client on this case if any
  const currentClientParty = useMemo(() => {
    if (!caseRecord?.parties) return null;
    return (
      caseRecord.parties.find((p) => p.type === "client" && (p.name || p.clientId)) ||
      caseRecord.parties.find((p) => Boolean(p.clientId)) ||
      null
    );
  }, [caseRecord]);

  const currentClientId = useMemo(() => {
    if (!currentClientParty?.clientId) return null;
    return typeof currentClientParty.clientId === "object"
      ? (currentClientParty.clientId as any)._id
      : currentClientParty.clientId;
  }, [currentClientParty]);

  const currentClientName = useMemo(() => {
    if (!currentClientParty) return null;
    return (
      (typeof currentClientParty.clientId === "object" && (currentClientParty.clientId as any)?.name) ||
      currentClientParty.name ||
      null
    );
  }, [currentClientParty]);

  // Pre-select current client if opening for the first time
  useState(() => {
    if (currentClientId) {
      setSelectedClientId(String(currentClientId));
    }
    if (currentClientParty?.role) {
      setClientRole(currentClientParty.role);
    }
  });

  const clients = useMemo(() => clientsData?.clients || [], [clientsData?.clients]);

  const filteredClients = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase().trim();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.tag?.toLowerCase().includes(q)
    );
  }, [clients, search]);

  const handleLink = async () => {
    if (!caseRecord) return;
    if (!selectedClientId) {
      toast.error("Please select a client to link to this case.");
      return;
    }

    try {
      await linkClientMutation.mutateAsync({
        caseId: caseRecord._id,
        clientId: selectedClientId,
        clientRole: clientRole.trim() || "Primary Client",
      });
      const selectedClient = clients.find((c) => c._id === selectedClientId);
      toast.success(
        `Case ${caseRecord.number} linked to ${selectedClient?.name || "client"} successfully!`
      );
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to link client to case.");
    }
  };

  if (!caseRecord) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="max-w-xl rounded-xl border border-border bg-card p-6 shadow-lift sm:max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2 text-primary">
              <Link2 size={20} />
              <DialogTitle className="text-title font-semibold text-foreground">
                Link Client to Case
              </DialogTitle>
            </div>
            <DialogDescription className="text-helper text-muted-foreground mt-1">
              Associate a registered client profile with matter{" "}
              <strong className="font-mono text-foreground font-semibold">
                {caseRecord.number}
              </strong>{" "}
              — <span className="text-foreground">{caseRecord.title}</span>.
            </DialogDescription>
          </DialogHeader>

          {/* Current Status Box */}
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Current Status:</span>
              {currentClientName ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                  <UserCheck size={14} className="text-success" />
                  Linked to <span className="font-semibold text-primary">{currentClientName}</span>
                  {currentClientParty?.role && ` (${currentClientParty.role})`}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded bg-muted/90 px-2 py-0.5 text-caption font-medium text-amber-600 dark:text-amber-400 italic">
                  <AlertCircle size={13} /> Unlinked Client (Created without client)
                </span>
              )}
            </div>
          </div>

          {/* Client Search and Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground">
                Select Client Profile <span className="text-destructive">*</span>
              </Label>
              <button
                type="button"
                onClick={() => setShowAddClient(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <Plus size={13} /> New Client Profile
              </button>
            </div>

            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="search"
                placeholder="Search clients by name, phone, email, corporate tag…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-xs"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Scrollable Client List */}
            <div className="max-h-56 overflow-y-auto rounded-lg border border-border bg-background divide-y divide-border/60">
              {isClientsLoading ? (
                <div className="flex items-center justify-center p-8 text-xs text-muted-foreground gap-2">
                  <Loader2 size={16} className="animate-spin text-primary" />
                  Loading client profiles…
                </div>
              ) : filteredClients.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No clients match "{search}".
                  <div className="mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => setShowAddClient(true)}
                    >
                      <Plus size={13} /> Create Client "{search}"
                    </Button>
                  </div>
                </div>
              ) : (
                filteredClients.map((client) => {
                  const isSelected = selectedClientId === client._id;
                  return (
                    <button
                      key={client._id}
                      type="button"
                      onClick={() => setSelectedClientId(client._id)}
                      className={cn(
                        "w-full text-left p-3 flex items-center justify-between gap-3 transition-colors text-xs",
                        isSelected
                          ? "bg-primary/10 border-l-4 border-l-primary"
                          : "hover:bg-muted/40"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground truncate">
                            {client.name}
                          </span>
                          {client.tag && (
                            <StatusPill tone="muted" className="text-[10px] px-1.5 py-0">
                              {client.tag}
                            </StatusPill>
                          )}
                          {client.type === "Corporate" && (
                            <Building size={12} className="text-muted-foreground shrink-0" />
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-caption text-muted-foreground">
                          {client.phone && (
                            <span className="flex items-center gap-1 truncate">
                              <Phone size={11} /> {client.phone}
                            </span>
                          )}
                          {client.email && (
                            <span className="flex items-center gap-1 truncate">
                              <Mail size={11} /> {client.email}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isSelected ? (
                          <span className="grid size-5 place-items-center rounded-full bg-primary text-primary-foreground shadow-2xs">
                            <Check size={13} strokeWidth={3} />
                          </span>
                        ) : (
                          <span className="size-5 rounded-full border border-border" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Client Role on Case */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground">
              Client Role on this Matter
            </Label>
            <Input
              type="text"
              placeholder="e.g., Primary Client, Petitioner, Applicant, Buyer"
              value={clientRole}
              onChange={(e) => setClientRole(e.target.value)}
              className="text-xs"
            />
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-muted-foreground mr-1">Quick roles:</span>
              {COMMON_CLIENT_ROLES.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setClientRole(role)}
                  className={cn(
                    "rounded px-2 py-0.5 text-[11px] transition-colors font-medium border",
                    clientRole === role
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted border-border"
                  )}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          <DialogFooter className="mt-4 flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={linkClientMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="gradient-primary text-primary-foreground gap-1.5"
              onClick={handleLink}
              disabled={!selectedClientId || linkClientMutation.isPending}
            >
              {linkClientMutation.isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Linking Client…
                </>
              ) : (
                <>
                  <Link2 size={14} />
                  Save & Link Client
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Embedded New Client Creation if needed */}
      {showAddClient && (
        <AddClientDialog
          open={showAddClient}
          onClose={() => setShowAddClient(false)}
        />
      )}
    </>
  );
}
