import { useState, useMemo } from "react";
import {
  KeyRound,
  FileText,
  Briefcase,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  X,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatusPill } from "@/components/common/StatusPill";
import {
  useRequestableDocuments,
  useRequestAccess,
  type RequestableDocument,
} from "@/services/documents";
import {
  useRequestableCases,
  useRequestCaseAccess,
  type RequestableCase,
} from "@/services/cases";
import { toast } from "sonner";

interface RequestAccessDialogProps {
  open: boolean;
  onClose: () => void;
  defaultType?: "document" | "case";
  initialDocId?: string;
  initialCaseId?: string;
}

export function RequestAccessDialog({
  open,
  onClose,
  defaultType = "document",
  initialDocId,
  initialCaseId,
}: RequestAccessDialogProps) {
  const [activeTab, setActiveTab] = useState<"document" | "case">(defaultType);
  const [selectedDocId, setSelectedDocId] = useState<string>(initialDocId ?? "");
  const [selectedCaseId, setSelectedCaseId] = useState<string>(initialCaseId ?? "");
  const [reason, setReason] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: docData, isLoading: docsLoading } = useRequestableDocuments();
  const { data: caseData, isLoading: casesLoading } = useRequestableCases();

  const requestDocAccess = useRequestAccess();
  const requestCaseAccess = useRequestCaseAccess();

  const documents = docData?.documents ?? [];
  const cases = caseData?.cases ?? [];

  const filteredDocs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.caseName && d.caseName.toLowerCase().includes(q)) ||
        (d.uploadedByName && d.uploadedByName.toLowerCase().includes(q))
    );
  }, [documents, searchQuery]);

  const filteredCases = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return cases;
    return cases.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.number.toLowerCase().includes(q) ||
        (c.practice && c.practice.toLowerCase().includes(q))
    );
  }, [cases, searchQuery]);

  if (!open) return null;

  const selectedDoc = documents.find((d) => d._id === selectedDocId);
  const selectedCase = cases.find((c) => c._id === selectedCaseId);

  const isPending =
    activeTab === "document"
      ? requestDocAccess.isPending
      : requestCaseAccess.isPending;

  const canSubmit =
    (activeTab === "document" ? Boolean(selectedDocId) : Boolean(selectedCaseId)) &&
    reason.trim().length > 0 &&
    !isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    if (activeTab === "document") {
      requestDocAccess.mutate(
        { docId: selectedDocId, reason: reason.trim() },
        {
          onSuccess: (res: any) => {
            toast.success(res?.message || "Document access requested successfully!");
            onClose();
          },
          onError: (err: any) => {
            toast.error(err?.message || "Failed to request document access");
          },
        }
      );
    } else {
      requestCaseAccess.mutate(
        { caseId: selectedCaseId, reason: reason.trim() },
        {
          onSuccess: (res: any) => {
            toast.success(res?.message || "Case access requested successfully!");
            onClose();
          },
          onError: (err: any) => {
            toast.error(err?.message || "Failed to request case access");
          },
        }
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="relative z-10 flex flex-col max-h-[92vh] w-full max-w-xl rounded-xl border border-border bg-card shadow-lift overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-lg bg-warning/15 text-warning">
              <KeyRound size={18} strokeWidth={2} />
            </span>
            <div>
              <h2 className="text-body font-semibold text-foreground">Request Access</h2>
              <p className="text-caption text-muted-foreground">
                Request permission from firm administrators
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-md text-muted-foreground hover:text-foreground"
            onClick={onClose}
          >
            <X size={16} />
          </Button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden p-5 gap-4">
          {/* Tab Selector: Documents vs Cases */}
          <div className="grid grid-cols-2 rounded-lg border border-border bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab("document");
                setSearchQuery("");
              }}
              className={`flex items-center justify-center gap-2 rounded-md py-2 text-helper font-medium transition-all ${
                activeTab === "document"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText size={16} />
              <span>Document Access</span>
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.2 text-[11px]">
                {documents.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("case");
                setSearchQuery("");
              }}
              className={`flex items-center justify-center gap-2 rounded-md py-2 text-helper font-medium transition-all ${
                activeTab === "case"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Briefcase size={16} />
              <span>Case Access</span>
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.2 text-[11px]">
                {cases.length}
              </span>
            </button>
          </div>

          {/* Search Bar for Selection */}
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              placeholder={
                activeTab === "document"
                  ? "Search documents by filename or case…"
                  : "Search cases by matter title, number, or category…"
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 text-helper"
            />
          </div>

          {/* Selectable List */}
          <div className="flex-1 overflow-y-auto max-h-52 rounded-lg border border-border bg-background p-1 space-y-1">
            {activeTab === "document" ? (
              docsLoading ? (
                <div className="flex items-center justify-center py-8 gap-2 text-caption text-muted-foreground">
                  <Loader2 size={16} className="animate-spin text-primary" />
                  Loading documents…
                </div>
              ) : filteredDocs.length === 0 ? (
                <div className="py-8 text-center text-caption text-muted-foreground">
                  No documents found matching search
                </div>
              ) : (
                filteredDocs.map((doc) => {
                  const isSelected = selectedDocId === doc._id;
                  const isReqPending = doc.myRequestStatus === "pending";
                  const isApproved = doc.myRequestStatus === "approved";
                  return (
                    <div
                      key={doc._id}
                      onClick={() => !isReqPending && !isApproved && setSelectedDocId(doc._id)}
                      className={`flex items-center justify-between gap-3 p-2.5 rounded-md cursor-pointer transition-all ${
                        isSelected
                          ? "bg-primary/10 border border-primary/40 text-primary"
                          : isReqPending || isApproved
                          ? "opacity-60 bg-muted/40 cursor-default"
                          : "hover:bg-muted/60 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText size={17} className="shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="truncate text-helper font-medium text-foreground">
                            {doc.name}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {doc.caseName} · {doc.uploadedByName}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isReqPending ? (
                          <span className="flex items-center gap-1 rounded-pill bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-warning">
                            <Clock size={11} /> Pending
                          </span>
                        ) : isApproved ? (
                          <span className="flex items-center gap-1 rounded-pill bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                            <CheckCircle2 size={11} /> Granted
                          </span>
                        ) : (
                          <div
                            className={`size-4 rounded-full border flex items-center justify-center ${
                              isSelected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-muted-foreground/40"
                            }`}
                          >
                            {isSelected && <span className="size-1.5 rounded-full bg-white" />}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )
            ) : casesLoading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-caption text-muted-foreground">
                <Loader2 size={16} className="animate-spin text-primary" />
                Loading cases…
              </div>
            ) : filteredCases.length === 0 ? (
              <div className="py-8 text-center text-caption text-muted-foreground">
                No cases found matching search
              </div>
            ) : (
              filteredCases.map((c) => {
                const isSelected = selectedCaseId === c._id;
                const isReqPending = c.myRequestStatus === "pending";
                const isApproved = c.myRequestStatus === "approved";
                return (
                  <div
                    key={c._id}
                    onClick={() => !isReqPending && !isApproved && setSelectedCaseId(c._id)}
                    className={`flex items-center justify-between gap-3 p-2.5 rounded-md cursor-pointer transition-all ${
                      isSelected
                        ? "bg-primary/10 border border-primary/40 text-primary"
                        : isReqPending || isApproved
                        ? "opacity-60 bg-muted/40 cursor-default"
                        : "hover:bg-muted/60 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Briefcase size={17} className="shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate text-helper font-medium text-foreground">
                          {c.number} — {c.title}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {c.practice || "General Legal"} · Counsel: {c.assignedToName}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isReqPending ? (
                        <span className="flex items-center gap-1 rounded-pill bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-warning">
                          <Clock size={11} /> Pending
                        </span>
                      ) : isApproved ? (
                        <span className="flex items-center gap-1 rounded-pill bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                          <CheckCircle2 size={11} /> Granted
                        </span>
                      ) : (
                        <div
                          className={`size-4 rounded-full border flex items-center justify-center ${
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted-foreground/40"
                          }`}
                        >
                          {isSelected && <span className="size-1.5 rounded-full bg-white" />}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Reason Input */}
          <div className="space-y-1.5">
            <label className="block text-caption font-semibold text-foreground">
              Reason for Request <span className="text-destructive">*</span>
            </label>
            <Textarea
              placeholder={
                activeTab === "document"
                  ? "Explain why you need access to this document (e.g. required for preparing case defense, drafting petition, client conference)…"
                  : "Explain why you need access to this case (e.g. assisting senior counsel, preparing cross-examination, urgent hearing backup)…"
              }
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-20 resize-none text-helper leading-relaxed"
              required
            />
          </div>

          {/* Footer Actions */}
          <div className="mt-2 flex items-center justify-between border-t border-border pt-4">
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <AlertTriangle size={13} className="text-warning shrink-0" />
              <span>Admin review required before access is unlocked.</span>
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="gradient-primary text-primary-foreground shadow-soft"
                disabled={!canSubmit}
              >
                {isPending ? (
                  <>
                    <Loader2 size={14} className="animate-spin mr-1.5" />
                    Submitting…
                  </>
                ) : (
                  "Submit Request"
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
