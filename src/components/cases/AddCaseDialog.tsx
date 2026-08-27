import { useState } from "react";
import {
  X,
  Plus,
  Trash2,
  Briefcase,
  Users,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateCase, type CreateCasePayload } from "@/services/cases";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PartyEntry {
  name: string;
  role: string;
  type: "client" | "sub_client" | "opposing_party" | "counsel" | "other";
}

interface FormState {
  title: string;
  description: string;
  practice: string;
  court: string;
  judge: string;
  status: "Active" | "On Hold" | "Closed" | "Urgent";
  priority: "High" | "Medium" | "Low";
  nextHearing: string;
  tags: string;
  nasPath: string;
}

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  practice: "",
  court: "",
  judge: "",
  status: "Active",
  priority: "Medium",
  nextHearing: "",
  tags: "",
  nasPath: "",
};

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
  "Bombay High Court",
  "City Civil Court, Mumbai",
  "NCLT Mumbai",
  "NCLAT",
  "District Court, Thane",
  "District Court, Pune",
  "Family Court, Mumbai",
  "Consumer Forum",
  "RERA Tribunal",
  "Supreme Court",
  "Other",
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AddCaseDialogProps {
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AddCaseDialog({ open, onClose }: AddCaseDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [parties, setParties] = useState<PartyEntry[]>([]);
  const [tagInput, setTagInput] = useState("");

  const createCase = useCreateCase();
  const isPending = createCase.isPending;
  const isError = createCase.isError;

  if (!open) return null;

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const addParty = () => {
    setParties((prev) => [
      ...prev,
      { name: "", role: "", type: "client" },
    ]);
  };

  const updateParty = (idx: number, key: keyof PartyEntry, value: string) => {
    setParties((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [key]: value } : p)),
    );
  };

  const removeParty = (idx: number) => {
    setParties((prev) => prev.filter((_, i) => i !== idx));
  };

  const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);

  const addTag = () => {
    const val = tagInput.trim();
    if (!val) return;
    const current = tags;
    if (!current.includes(val)) {
      setForm((prev) => ({ ...prev, tags: [...current, val].join(", ") }));
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    const current = tags.filter((t) => t !== tag);
    setForm((prev) => ({ ...prev, tags: current.join(", ") }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    const payload: CreateCasePayload = {
      title: form.title,
      status: form.status,
      priority: form.priority,
      ...(form.description && { description: form.description }),
      ...(form.practice && { practice: form.practice }),
      ...(form.court && { court: form.court }),
      ...(form.judge && { judge: form.judge }),
      ...(form.nextHearing && { nextHearing: form.nextHearing }),
      ...(tags.length > 0 && { tags }),
      ...(form.nasPath && { nasPath: form.nasPath }),
      ...(parties.length > 0 && { parties }),
    };

    createCase.mutate(payload, {
      onSuccess: () => {
        setForm(EMPTY_FORM);
        setParties([]);
        setTagInput("");
        onClose();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add new case</DialogTitle>
          <DialogDescription>
            Create a new matter with parties, court info and metadata.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ── Basic Info ── */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="case-title" className="text-helper">Case title *</Label>
              <Input
                id="case-title"
                required
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="e.g. Mehra vs. Kapoor Estates"
                className="h-11 rounded-md"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="case-desc" className="text-helper">Description</Label>
              <Input
                id="case-desc"
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="Brief description of the matter"
                className="h-11 rounded-md"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="case-practice" className="text-helper">Practice area</Label>
              <select
                id="case-practice"
                value={form.practice}
                onChange={(e) => update("practice", e.target.value)}
                className="h-11 w-full rounded-md border border-border bg-card px-3 text-helper outline-none transition-colors focus:border-primary"
              >
                <option value="">Select practice area</option>
                {PRACTICE_AREAS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="case-court" className="text-helper">Court</Label>
              <select
                id="case-court"
                value={form.court}
                onChange={(e) => update("court", e.target.value)}
                className="h-11 w-full rounded-md border border-border bg-card px-3 text-helper outline-none transition-colors focus:border-primary"
              >
                <option value="">Select court</option>
                {COURTS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="case-judge" className="text-helper">Judge / Presiding Officer</Label>
              <Input
                id="case-judge"
                value={form.judge}
                onChange={(e) => update("judge", e.target.value)}
                placeholder="e.g. Justice A. M. Khanwilkar"
                className="h-11 rounded-md"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="case-hearing" className="text-helper">Next hearing</Label>
              <Input
                id="case-hearing"
                type="date"
                value={form.nextHearing}
                onChange={(e) => update("nextHearing", e.target.value)}
                className="h-11 rounded-md"
              />
            </div>
          </div>

          {/* ── Status & Priority ── */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-helper">Case status</Label>
              <div className="flex rounded-md border border-border">
                {(["Active", "Urgent", "On Hold", "Closed"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => update("status", s)}
                    className={`flex-1 px-2.5 py-2 text-caption font-medium transition-colors first:rounded-l-md last:rounded-r-md border-r border-border last:border-r-0 ${form.status === s
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-helper">Priority</Label>
              <div className="flex rounded-md border border-border">
                {(["High", "Medium", "Low"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => update("priority", p)}
                    className={`flex-1 px-2.5 py-2 text-caption font-medium transition-colors ${p === "High" ? "rounded-l-md border-r" : p === "Low" ? "rounded-r-md border-l" : "border-r"
                      } border-border ${form.priority === p
                        ? p === "High"
                          ? "bg-destructive/10 text-destructive"
                          : p === "Medium"
                            ? "bg-warning/10 text-warning"
                            : "bg-muted text-muted-foreground"
                        : "text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Tags ── */}
          <div className="space-y-2">
            <Label htmlFor="case-tags" className="text-helper">Tags</Label>
            <div className="flex gap-2">
              <Input
                id="case-tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addTag(); }
                }}
                placeholder="Type a tag and press Enter"
                className="h-11 flex-1 rounded-md"
              />
              <Button type="button" variant="outline" className="rounded-md h-11" onClick={addTag}>
                <Plus size={15} />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="flex items-center gap-1 rounded-pill bg-muted px-3 py-1 text-caption font-medium"
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => removeTag(t)}
                      className="ml-0.5 grid size-4 place-items-center rounded-full text-muted-foreground hover:text-destructive"
                      aria-label={`Remove tag ${t}`}
                    >
                      <X size={11} strokeWidth={2.5} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ── NAS Path ── */}
          <div className="space-y-1.5">
            <Label htmlFor="case-nas" className="text-helper">NAS folder path</Label>
            <Input
              id="case-nas"
              value={form.nasPath}
              onChange={(e) => update("nasPath", e.target.value)}
              placeholder="e.g. /Cases/SW-2026-0148/"
              className="h-11 rounded-md"
            />
            <p className="text-caption text-muted-foreground">
              Synology NAS folder where case documents will be stored.
            </p>
          </div>

          {/* ── Parties ── */}
          <div className="rounded-lg border border-border">
            <div className="flex items-center justify-between px-4 py-3">
              <p className="flex items-center gap-2 text-helper font-medium">
                <Users size={16} strokeWidth={1.75} className="text-muted-foreground" />
                Parties
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-md"
                onClick={addParty}
              >
                <Plus size={14} /> Add party
              </Button>
            </div>
            {parties.length > 0 && (
              <div className="border-t border-border p-4 space-y-3">
                {parties.map((p, idx) => (
                  <div key={idx} className="rounded-md border border-border bg-muted/30 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-helper font-medium">Party #{idx + 1}</p>
                      <button
                        type="button"
                        onClick={() => removeParty(idx)}
                        className="grid size-8 place-items-center rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Remove party"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor={`party-name-${idx}`} className="text-helper">Name</Label>
                        <Input
                          id={`party-name-${idx}`}
                          value={p.name}
                          onChange={(e) => updateParty(idx, "name", e.target.value)}
                          placeholder="Party name"
                          className="h-10 rounded-md"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`party-role-${idx}`} className="text-helper">Role</Label>
                        <Input
                          id={`party-role-${idx}`}
                          value={p.role}
                          onChange={(e) => updateParty(idx, "role", e.target.value)}
                          placeholder="Petitioner, Respondent, etc."
                          className="h-10 rounded-md"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`party-type-${idx}`} className="text-helper">Type</Label>
                        <select
                          id={`party-type-${idx}`}
                          value={p.type}
                          onChange={(e) =>
                            updateParty(idx, "type", e.target.value as PartyEntry["type"])
                          }
                          className="h-10 w-full rounded-md border border-border bg-card px-3 text-helper outline-none transition-colors focus:border-primary"
                        >
                          <option value="client">Client</option>
                          <option value="sub_client">Sub-client</option>
                          <option value="opposing_party">Opposing Party</option>
                          <option value="counsel">Counsel</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {parties.length === 0 && (
              <div className="border-t border-border px-4 py-6 text-center text-helper text-muted-foreground">
                No parties added yet. Click "Add party" to link clients, sub-clients, counsel or opposing parties.
              </div>
            )}
          </div>

          {/* ── Actions ── */}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !form.title.trim()}
              className="gradient-primary rounded-md text-primary-foreground shadow-soft"
            >
              {isPending ? <Loader2 size={17} className="animate-spin" /> : <Briefcase size={17} strokeWidth={2} />}
              {isPending ? "Saving…" : "Save case"}
            </Button>
          </DialogFooter>

          {isError && (
            <p className="text-caption text-destructive">Failed to create case. Please try again.</p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}