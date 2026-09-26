import { useState, useEffect } from "react";
import {
  X,
  Briefcase,
  Loader2,
  Calendar,
  User,
  Sliders,
  Tag,
  Building,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUpdateCase, type CaseRecord, type CreateCasePayload } from "@/services/cases";
import { useEmployees } from "@/services/admin";

const PRACTICE_AREAS = [
  "Civil Litigation",
  "Criminal Law",
  "Family Law",
  "Property Law",
  "Corporate Law",
  "Tax Law",
  "Labour Law",
  "Consumer Protection",
  "Intellectual Property",
  "Constitutional Law",
  "Arbitration",
  "RERA",
  "NCLT / Insolvency",
  "Other",
];

const COURTS = [
  "Supreme Court of India",
  "Bombay High Court",
  "City Civil Court, Mumbai",
  "Sessions Court, Mumbai",
  "NCLT Mumbai",
  "NCLAT",
  "District Court, Thane",
  "District Court, Pune",
  "Family Court, Mumbai",
  "Consumer Forum",
  "RERA Tribunal",
  "Other",
];

interface EditCaseDialogProps {
  open: boolean;
  onClose: () => void;
  record: CaseRecord;
  caseId: string;
}

export function EditCaseDialog({ open, onClose, record, caseId }: EditCaseDialogProps) {
  const [title, setTitle] = useState(record.title || "");
  const [description, setDescription] = useState(record.description || "");
  const [practice, setPractice] = useState(record.practice || "");
  const [court, setCourt] = useState(record.court || "");
  const [judge, setJudge] = useState(record.judge || "");
  const [status, setStatus] = useState<"Active" | "Urgent" | "On Hold" | "Closed">(
    record.status || "Active"
  );
  const [priority, setPriority] = useState<"High" | "Medium" | "Low">(
    record.priority || "Medium"
  );
  const [progress, setProgress] = useState<number>(record.progress ?? 0);
  const [nextHearing, setNextHearing] = useState<string>(
    record.nextHearing ? new Date(record.nextHearing).toISOString().slice(0, 16) : ""
  );
  const [assignedTo, setAssignedTo] = useState<string>(
    record.assignedTo?._id || ""
  );
  const [tags, setTags] = useState<string>((record.tags || []).join(", "));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: empData } = useEmployees();
  const employees = empData?.employees ?? [];

  const updateCase = useUpdateCase();

  useEffect(() => {
    if (open) {
      setTitle(record.title || "");
      setDescription(record.description || "");
      setPractice(record.practice || "");
      setCourt(record.court || "");
      setJudge(record.judge || "");
      setStatus(record.status || "Active");
      setPriority(record.priority || "Medium");
      setProgress(record.progress ?? 0);
      setNextHearing(
        record.nextHearing ? new Date(record.nextHearing).toISOString().slice(0, 16) : ""
      );
      setAssignedTo(record.assignedTo?._id || "");
      setTags((record.tags || []).join(", "));
      setErrorMsg(null);
    }
  }, [open, record]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!title.trim()) {
      setErrorMsg("Case title is required.");
      return;
    }

    try {
      const tagList = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const payload: Partial<CreateCasePayload> = {
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        progress: Number(progress),
        tags: tagList,
      };
      if (practice) payload.practice = practice;
      if (court.trim()) payload.court = court.trim();
      if (judge.trim()) payload.judge = judge.trim();
      if (nextHearing) payload.nextHearing = new Date(nextHearing).toISOString();
      if (assignedTo) payload.assignedTo = assignedTo;

      await updateCase.mutateAsync({
        id: caseId,
        data: payload,
      });

      onClose();
    } catch (err: any) {
      console.error("Failed to update case:", err);
      setErrorMsg(err?.message || "Failed to update case. Please check all fields.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl rounded-xl border border-border bg-card p-6 shadow-lift">
        <DialogHeader className="border-b border-border/60 pb-4">
          <div className="flex items-center gap-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <Briefcase size={18} strokeWidth={1.75} />
            </span>
            <div>
              <DialogTitle className="text-title font-semibold text-foreground">
                Edit Case Details
              </DialogTitle>
              <DialogDescription className="text-helper text-muted-foreground">
                Matter {record.number} — update case information, status, priority, and counsel.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {errorMsg && (
          <div className="mt-4 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-helper text-destructive">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="case-title" className="text-helper font-medium">
              Case Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="case-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Apex Enterprises vs City Corp"
              className="h-10 rounded-md"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="case-desc" className="text-helper font-medium">
              Description / Summary
            </Label>
            <textarea
              id="case-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief summary of matter, facts, or disputes…"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-helper text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          {/* Practice & Court */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="case-practice" className="text-helper font-medium">
                Practice Area
              </Label>
              <div className="relative">
                <input
                  id="case-practice"
                  list="practice-areas"
                  value={practice}
                  onChange={(e) => setPractice(e.target.value)}
                  placeholder="Select or enter practice area"
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-helper text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <datalist id="practice-areas">
                  {PRACTICE_AREAS.map((pa) => (
                    <option key={pa} value={pa} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="case-court" className="text-helper font-medium">
                Court / Tribunal
              </Label>
              <div className="relative">
                <input
                  id="case-court"
                  list="courts-list"
                  value={court}
                  onChange={(e) => setCourt(e.target.value)}
                  placeholder="Select or enter court"
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-helper text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <datalist id="courts-list">
                  {COURTS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </div>
          </div>

          {/* Judge & Assigned Counsel */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="case-judge" className="text-helper font-medium">
                Presiding Judge / Bench
              </Label>
              <Input
                id="case-judge"
                value={judge}
                onChange={(e) => setJudge(e.target.value)}
                placeholder="Hon'ble Justice Name"
                className="h-10 rounded-md"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="case-assignee" className="text-helper font-medium">
                Assigned Counsel
              </Label>
              <select
                id="case-assignee"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-helper text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Unassigned</option>
                {employees.map((emp) => (
                  <option key={emp._id} value={emp._id}>
                    {emp.name} ({emp.title || emp.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status & Priority */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="case-status" className="text-helper font-medium">
                Case Status
              </Label>
              <select
                id="case-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-helper text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="Active">Active</option>
                <option value="Urgent">Urgent</option>
                <option value="On Hold">On Hold</option>
                <option value="Closed">Closed</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="case-priority" className="text-helper font-medium">
                Priority
              </Label>
              <select
                id="case-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-helper text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          {/* Next Hearing & Progress */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="case-hearing" className="text-helper font-medium flex items-center gap-1.5">
                <Calendar size={14} className="text-muted-foreground" />
                Next Hearing Date & Time
              </Label>
              <Input
                id="case-hearing"
                type="datetime-local"
                value={nextHearing}
                onChange={(e) => setNextHearing(e.target.value)}
                className="h-10 rounded-md"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="case-progress" className="text-helper font-medium flex items-center gap-1.5">
                  <Sliders size={14} className="text-muted-foreground" />
                  Matter Progress
                </Label>
                <span className="text-caption font-semibold text-primary">{progress}%</span>
              </div>
              <input
                id="case-progress"
                type="range"
                min="0"
                max="100"
                step="5"
                value={progress}
                onChange={(e) => setProgress(Number(e.target.value))}
                className="w-full accent-primary cursor-pointer mt-2"
              />
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label htmlFor="case-tags" className="text-helper font-medium flex items-center gap-1.5">
              <Tag size={14} className="text-muted-foreground" />
              Tags (comma-separated)
            </Label>
            <Input
              id="case-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. Injunction, Commercial, High-Value"
              className="h-10 rounded-md"
            />
          </div>

          <DialogFooter className="mt-6 flex justify-end gap-2 border-t border-border/60 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-md">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateCase.isPending}
              className="gradient-primary rounded-md text-primary-foreground"
            >
              {updateCase.isPending ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
