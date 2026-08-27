import { useState } from "react";
import {
  X,
  Loader2,
  CheckCircle2,
  Copy,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useVersionHistory } from "@/services/documents";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface VersionHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  documentId: string;
  documentName: string;
}

export function VersionHistoryDialog({ open, onClose, documentId, documentName }: VersionHistoryDialogProps) {
  const { data, isLoading, isError, error } = useVersionHistory(documentId);
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-10">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-lift">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-title font-semibold">Version History</h2>
            <p className="mt-1 text-helper text-muted-foreground">
              {documentName} • {data?.count ?? 0} version(s)
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid size-10 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X size={19} strokeWidth={1.75} />
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin text-muted-foreground" size={20} />
          </div>
        ) : isError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
            <p className="font-medium text-destructive">Failed to load version history</p>
            <p className="mt-1 text-helper text-muted-foreground">
              {error instanceof Error ? error.message : "Could not connect to the server."}
            </p>
          </div>
        ) : !data || data.versions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-helper text-muted-foreground">No version history available</p>
          </div>
        ) : (
          <div className="space-y-4">
            {data.versions.map((version) => (
              <div key={version._id} className="border rounded-lg overflow-hidden">
                {/* Version Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/50 cursor-pointer"
                   onClick={() => {
                     setExpandedVersion(expandedVersion === version._id ? null : version._id);
                   }}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <FileText size={18} className="text-primary" />
                      <div>
                        <p className="font-medium">{version.name}</p>
                        <p className="text-caption text-muted-foreground">
                          Version {version.version || 1} • {version.sizeFormatted || 'Unknown'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-caption text-muted-foreground">
                      <p>
                        Uploaded by: {typeof version.uploadedBy === 'string'
                          ? version.uploadedBy
                          : version.uploadedBy?.name || 'Unknown'}
                      </p>
                      <p>{new Date(version.createdAt).toLocaleDateString("en-IN", { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(version.sha256 || "");
                    }} title="Copy SHA-256">
                      <Copy size={16} />
                    </Button>
                    <button className={`text-caption text-muted-foreground hover:text-foreground ${
                      expandedVersion === version._id ? "rotate-180" : ""
                    }`} onClick={(e) => {
                      e.stopPropagation();
                      setExpandedVersion(expandedVersion === version._id ? null : version._id);
                    }}>
                      {expandedVersion === version._id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* Version Details (expandable) */}
                {expandedVersion === version._id && (
                  <div className="px-5 py-4 border-t border-border bg-muted/50">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <p className="text-caption text-muted-foreground">SHA-256:</p>
                        <p className="font-mono text-break">{version.sha256}</p>
                      </div>
                      {version.caseName && (
                        <div className="space-y-2">
                          <p className="text-caption text-muted-foreground">Case:</p>
                          <p className="font-medium">{version.caseName}</p>
                        </div>
                      )}
                      <div className="space-y-2">
                        <p className="text-caption text-muted-foreground">State:</p>
                        <span className={`px-2 py-1 rounded-sm text-xs font-medium ${
                          version.state === "Approved" ? "bg-success/20 text-success" :
                          version.state === "Rejected" ? "bg-destructive/20 text-destructive" :
                          version.state === "Pending" ? "bg-warning/20 text-warning" :
                          "bg-muted/20 text-muted-foreground"
                        }`}
                          >{version.state}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}