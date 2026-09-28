import { useState } from "react";
import {
  X,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  UserPlus,
  Building2,
  Users,
  FileBadge,
  Home,
  Loader2,
  Calendar,
  Clock,
  UserCheck,
  FileText,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateClient, type CreateClientPayload, type SubClient } from "@/services/clients";
import { useEmployees } from "@/services/admin";
import {
  validatePhone,
  validateAadhaar,
  validatePan,
  validateEmail,
  sanitizePhone,
  sanitizePan,
  sanitizeAadhaar,
} from "@/lib/validation";
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

interface SubClientEntry {
  name: string;
  relationship: string;
  description: string;
  phone: string;
  email: string;
}

interface FormState {
  type: "Individual" | "Corporate";
  tag: "Active" | "VIP" | "Corporate" | "Individual" | "Archived";
  name: string;
  phone: string;
  email: string;
  address: string;
  aadhar: string;
  pan: string;
  notes: string;
  promisedCompletionDate: string;
  assignedTo: string[];
  propertyAddress: string;
  surveyNo: string;
  chsName: string;
  sector: string;
  plot: string;
  area: string;
}

const EMPTY_FORM: FormState = {
  type: "Individual",
  tag: "Active",
  name: "",
  phone: "",
  email: "",
  address: "",
  aadhar: "",
  pan: "",
  notes: "",
  promisedCompletionDate: "",
  assignedTo: [],
  propertyAddress: "",
  surveyNo: "",
  chsName: "",
  sector: "",
  plot: "",
  area: "",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AddClientDialogProps {
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface FormErrors {
  name?: string;
  phone?: string;
  email?: string;
  aadhar?: string;
  pan?: string;
}

export function AddClientDialog({ open, onClose }: AddClientDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [subClients, setSubClients] = useState<SubClientEntry[]>([]);
  const [showProperty, setShowProperty] = useState(false);
  const [showSubClient, setShowSubClient] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const { data: empData } = useEmployees();
  const employees = empData?.employees ?? [];

  const createClient = useCreateClient();
  const isPending = createClient.isPending;
  const isError = createClient.isError;

  if (!open) return null;

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    const errorKey = key as keyof FormErrors;
    if (fieldErrors[errorKey]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[errorKey];
        return next;
      });
    }
  };

  const toggleStaff = (empId: string) => {
    setForm((prev) => {
      const exists = prev.assignedTo.includes(empId);
      return {
        ...prev,
        assignedTo: exists
          ? prev.assignedTo.filter((id) => id !== empId)
          : [...prev.assignedTo, empId],
      };
    });
  };

  const addSubClient = () => {
    setSubClients((prev) => [
      ...prev,
      { name: "", relationship: "", description: "", phone: "", email: "" },
    ]);
  };

  const updateSubClient = (idx: number, key: keyof SubClientEntry, value: string) => {
    setSubClients((prev) =>
      prev.map((sc, i) => (i === idx ? { ...sc, [key]: value } : sc)),
    );
  };

  const removeSubClient = (idx: number) => {
    setSubClients((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: FormErrors = {};

    if (!form.name.trim()) {
      errors.name = "Client name is required";
    }

    if (form.phone.trim()) {
      const pCheck = validatePhone(form.phone);
      if (!pCheck.valid) errors.phone = pCheck.error ?? "Invalid phone number";
    }

    if (form.email.trim()) {
      const eCheck = validateEmail(form.email);
      if (!eCheck.valid) errors.email = eCheck.error ?? "Invalid email format";
    }

    if (form.aadhar.trim()) {
      const aCheck = validateAadhaar(form.aadhar);
      if (!aCheck.valid) errors.aadhar = aCheck.error ?? "Invalid Aadhaar number";
    }

    if (form.pan.trim()) {
      const panCheck = validatePan(form.pan);
      if (!panCheck.valid) errors.pan = panCheck.error ?? "Invalid PAN format";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    const payload: CreateClientPayload = {
      type: form.type,
      tag: form.tag,
      name: form.name.trim(),
      ...(form.phone && { phone: form.phone.trim() }),
      ...(form.email && { email: form.email.trim() }),
      ...(form.address && { address: form.address.trim() }),
      ...(form.aadhar && { aadhar: form.aadhar.trim() }),
      ...(form.pan && { pan: form.pan.trim().toUpperCase() }),
      ...(form.notes && { notes: form.notes.trim() }),
      ...(form.assignedTo.length > 0 && { assignedTo: form.assignedTo }),
      ...(form.promisedCompletionDate && {
        promisedCompletionDate: new Date(form.promisedCompletionDate).toISOString(),
      }),
      ...(showProperty && {
        propertyDetails: {
          address: form.propertyAddress,
          surveyNo: form.surveyNo,
          chsName: form.chsName,
          sector: form.sector,
          plot: form.plot,
          area: form.area,
        },
      }),
      ...(subClients.length > 0 && {
        subClients: subClients.map((sc): SubClient => ({
          name: sc.name,
          relationship: sc.relationship,
          phone: sc.phone,
          email: sc.email,
          notes: sc.description,
        })),
      }),
    };

    createClient.mutate(payload, {
      onSuccess: () => {
        setForm(EMPTY_FORM);
        setSubClients([]);
        setShowProperty(false);
        setShowSubClient(false);
        setFieldErrors({});
        onClose();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add new client</DialogTitle>
          <DialogDescription>
            Fill in the details below. KYC fields help auto-verify the profile.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-6" onSubmit={handleSubmit}>
          {/* ── Type & Tag ── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-helper">Client type</Label>
              <div className="flex rounded-md border border-border">
                {(["Individual", "Corporate"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => update("type", t)}
                    className={`flex-1 px-3 py-2.5 text-helper font-medium transition-colors ${form.type === t
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                      } ${t === "Individual" ? "rounded-l-md border-r" : "rounded-r-md"}`}
                  >
                    {t === "Individual" ? (
                      <span className="flex items-center justify-center gap-2">
                        <UserPlus size={15} /> Individual
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <Building2 size={15} /> Corporate
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-helper">Status tag</Label>
              <div className="flex flex-wrap gap-2">
                {(["Active", "VIP", "Corporate", "Individual", "Archived"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => update("tag", t)}
                    className={`rounded-pill px-3 py-1.5 text-caption font-medium transition-colors ${form.tag === t
                      ? "gradient-primary text-primary-foreground"
                      : "border border-border text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Basic Info ── */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="client-name" className="text-helper">Full name *</Label>
              <Input
                id="client-name"
                required
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="e.g. Adv. Rajesh Sharma"
                className={`h-11 rounded-md ${fieldErrors.name ? "border-destructive focus-visible:ring-destructive" : ""}`}
              />
              {fieldErrors.name && (
                <p className="text-caption text-destructive font-medium">{fieldErrors.name}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="client-phone" className="text-helper">Phone (10-digit Mobile)</Label>
              <Input
                id="client-phone"
                value={form.phone}
                onChange={(e) => update("phone", sanitizePhone(e.target.value))}
                placeholder="9876543210"
                className={`h-11 rounded-md ${fieldErrors.phone ? "border-destructive focus-visible:ring-destructive" : ""}`}
              />
              {fieldErrors.phone && (
                <p className="text-caption text-destructive font-medium">{fieldErrors.phone}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="client-email" className="text-helper">Email address</Label>
              <Input
                id="client-email"
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="client@firm.com"
                className={`h-11 rounded-md ${fieldErrors.email ? "border-destructive focus-visible:ring-destructive" : ""}`}
              />
              {fieldErrors.email && (
                <p className="text-caption text-destructive font-medium">{fieldErrors.email}</p>
              )}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="client-address" className="text-helper">Official / Residential Address</Label>
              <Input
                id="client-address"
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
                placeholder="Office #402, Nariman Point, Mumbai"
                className="h-11 rounded-md"
              />
            </div>
          </div>

          {/* ── Identity Verification ── */}
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="flex items-center gap-2 text-helper font-medium">
              <FileBadge size={16} strokeWidth={1.75} className="text-muted-foreground" />
              Identity Verification Details
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="client-aadhar" className="text-helper">Aadhaar Number (12 digits)</Label>
                <Input
                  id="client-aadhar"
                  value={form.aadhar}
                  onChange={(e) => update("aadhar", sanitizeAadhaar(e.target.value))}
                  placeholder="123456789012"
                  maxLength={12}
                  className={`h-11 rounded-md ${fieldErrors.aadhar ? "border-destructive focus-visible:ring-destructive" : ""}`}
                />
                {fieldErrors.aadhar && (
                  <p className="text-caption text-destructive font-medium">{fieldErrors.aadhar}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="client-pan" className="text-helper">PAN Number (10 characters)</Label>
                <Input
                  id="client-pan"
                  value={form.pan}
                  onChange={(e) => update("pan", sanitizePan(e.target.value))}
                  placeholder="ABCDE1234F"
                  maxLength={10}
                  className={`h-11 rounded-md uppercase ${fieldErrors.pan ? "border-destructive focus-visible:ring-destructive" : ""}`}
                />
                {fieldErrors.pan && (
                  <p className="text-caption text-destructive font-medium">{fieldErrors.pan}</p>
                )}
              </div>
            </div>
            {form.aadhar && form.pan && (
              <p className="mt-2 text-caption text-emerald-600 dark:text-emerald-400 font-medium">
                ✓ Aadhaar and PAN provided — Identity verification will be auto-completed on creation.
              </p>
            )}
          </div>

          {/* ── Staff Assignment & Promised Delivery ── */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            <p className="flex items-center gap-2 text-helper font-medium">
              <UserCheck size={16} strokeWidth={1.75} className="text-primary" />
              Staff Assignment &amp; Promised Delivery
            </p>

            {/* Multi-staff Assignment */}
            <div className="space-y-1.5">
              <Label className="text-helper">Assigned Team Members</Label>
              <p className="text-caption text-muted-foreground">Select one or more staff members responsible for handling this client:</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 max-h-36 overflow-y-auto pr-1">
                {employees.map((emp) => {
                  const selected = form.assignedTo.includes(emp._id);
                  return (
                    <button
                      key={emp._id}
                      type="button"
                      onClick={() => toggleStaff(emp._id)}
                      className={`flex items-center gap-2 rounded-md border p-2 text-left text-caption transition-colors ${
                        selected
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-border bg-background text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <span className={`grid size-4 shrink-0 place-items-center rounded border ${selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"}`}>
                        {selected && <Check size={12} strokeWidth={2.5} />}
                      </span>
                      <span className="truncate">{emp.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Promised Completion Date & Time and Notes */}
            <div className="grid gap-4 sm:grid-cols-2 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="client-completion" className="text-helper flex items-center gap-1.5">
                  <Calendar size={14} className="text-muted-foreground" />
                  Promised Completion Date &amp; Time
                </Label>
                <Input
                  id="client-completion"
                  type="datetime-local"
                  value={form.promisedCompletionDate}
                  onChange={(e) => update("promisedCompletionDate", e.target.value)}
                  className="h-11 rounded-md"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="client-notes" className="text-helper flex items-center gap-1.5">
                  <FileText size={14} className="text-muted-foreground" />
                  Onboarding &amp; Client Notes
                </Label>
                <Input
                  id="client-notes"
                  value={form.notes}
                  onChange={(e) => update("notes", e.target.value)}
                  placeholder="Intake notes, billing preferences, etc."
                  className="h-11 rounded-md"
                />
              </div>
            </div>
          </div>

          {/* ── Property Details (Optional) ── */}
          <div className="rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setShowProperty(!showProperty)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <p className="flex items-center gap-2 text-helper font-medium">
                <Home size={16} strokeWidth={1.75} className="text-muted-foreground" />
                Property Details <span className="text-caption text-muted-foreground">(optional)</span>
              </p>
              {showProperty ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
            </button>
            {showProperty && (
              <div className="border-t border-border p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="prop-address" className="text-helper">Property address</Label>
                    <Input
                      id="prop-address"
                      value={form.propertyAddress}
                      onChange={(e) => update("propertyAddress", e.target.value)}
                      placeholder="Full property address"
                      className="h-11 rounded-md"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="prop-survey" className="text-helper">Survey No.</Label>
                    <Input
                      id="prop-survey"
                      value={form.surveyNo}
                      onChange={(e) => update("surveyNo", e.target.value)}
                      placeholder="Survey number"
                      className="h-11 rounded-md"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="prop-chs" className="text-helper">CHS / Building name</Label>
                    <Input
                      id="prop-chs"
                      value={form.chsName}
                      onChange={(e) => update("chsName", e.target.value)}
                      placeholder="e.g. Gurusamridhi CHS Ltd"
                      className="h-11 rounded-md"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="prop-sector" className="text-helper">Sector / Area</Label>
                    <Input
                      id="prop-sector"
                      value={form.sector}
                      onChange={(e) => update("sector", e.target.value)}
                      placeholder="e.g. Sector 14, Sanpada"
                      className="h-11 rounded-md"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="prop-plot" className="text-helper">Plot No.</Label>
                    <Input
                      id="prop-plot"
                      value={form.plot}
                      onChange={(e) => update("plot", e.target.value)}
                      placeholder="Plot number"
                      className="h-11 rounded-md"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="prop-area" className="text-helper">Area (sq.ft.)</Label>
                    <Input
                      id="prop-area"
                      value={form.area}
                      onChange={(e) => update("area", e.target.value)}
                      placeholder="e.g. 650"
                      className="h-11 rounded-md"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Sub-Clients (Optional) ── */}
          <div className="rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setShowSubClient(!showSubClient)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <p className="flex items-center gap-2 text-helper font-medium">
                <Users size={16} strokeWidth={1.75} className="text-muted-foreground" />
                Sub-clients <span className="text-caption text-muted-foreground">(optional)</span>
              </p>
              {showSubClient ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
            </button>
            {showSubClient && (
              <div className="border-t border-border p-4">
                <p className="text-helper text-muted-foreground">
                  Add sub-clients like buyers, sellers, family members, or related parties.
                </p>

                {subClients.map((sc, idx) => (
                  <div key={idx} className="mt-4 rounded-md border border-border bg-muted/30 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-helper font-medium">Sub-client #{idx + 1}</p>
                      <button
                        type="button"
                        onClick={() => removeSubClient(idx)}
                        className="grid size-8 place-items-center rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Remove sub-client"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor={`sc-name-${idx}`} className="text-helper">Name</Label>
                        <Input
                          id={`sc-name-${idx}`}
                          value={sc.name}
                          onChange={(e) => updateSubClient(idx, "name", e.target.value)}
                          placeholder="Full name"
                          className="h-10 rounded-md"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`sc-rel-${idx}`} className="text-helper">Relationship</Label>
                        <Input
                          id={`sc-rel-${idx}`}
                          value={sc.relationship}
                          onChange={(e) => updateSubClient(idx, "relationship", e.target.value)}
                          placeholder="Buyer / Seller / Partner"
                          className="h-10 rounded-md"
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor={`sc-desc-${idx}`} className="text-helper">Description / Notes</Label>
                        <Input
                          id={`sc-desc-${idx}`}
                          value={sc.description}
                          onChange={(e) => updateSubClient(idx, "description", e.target.value)}
                          placeholder="Who is this sub-client and their role in the matter"
                          className="h-10 rounded-md"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`sc-phone-${idx}`} className="text-helper">Phone</Label>
                        <Input
                          id={`sc-phone-${idx}`}
                          value={sc.phone}
                          onChange={(e) => updateSubClient(idx, "phone", e.target.value)}
                          placeholder="+91-XXXXXXXXXX"
                          className="h-10 rounded-md"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`sc-email-${idx}`} className="text-helper">Email</Label>
                        <Input
                          id={`sc-email-${idx}`}
                          value={sc.email}
                          onChange={(e) => updateSubClient(idx, "email", e.target.value)}
                          placeholder="email@example.com"
                          className="h-10 rounded-md"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addSubClient}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border py-3 text-helper text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                >
                  <Plus size={16} /> Add sub-client
                </button>
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
              disabled={isPending || !form.name.trim()}
              className="gradient-primary rounded-md text-primary-foreground shadow-soft"
            >
              {isPending ? <Loader2 size={17} className="animate-spin" /> : <UserPlus size={17} strokeWidth={2} />}
              {isPending ? "Saving…" : "Save client"}
            </Button>
          </DialogFooter>

          {isError && (
            <p className="text-caption text-destructive">Failed to create client. Please try again.</p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}