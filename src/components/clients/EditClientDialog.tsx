import { useState, useEffect } from "react";
import {
  Users,
  Loader2,
  Building2,
  FileBadge,
  Home,
  Phone,
  Mail,
  MapPin,
  Calendar,
  UserCheck,
  FileText,
  Check,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Trash2,
  Plus,
  AlertCircle,
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
import { useUpdateClient, type ClientRecord, type CreateClientPayload } from "@/services/clients";
import { useEmployees } from "@/services/admin";
import { toSafeIso } from "@/lib/dates";
import {
  validatePhone,
  validateAadhaar,
  validatePan,
  validateEmail,
  sanitizePhone,
  sanitizePan,
  sanitizeAadhaar,
} from "@/lib/validation";

interface EditClientDialogProps {
  open: boolean;
  onClose: () => void;
  record: ClientRecord;
}

interface FormErrors {
  name?: string;
  phone?: string;
  email?: string;
  aadhar?: string;
  pan?: string;
}

interface SubClientEntry {
  name: string;
  relationship: string;
  description: string;
  phone: string;
  email: string;
}

export function EditClientDialog({ open, onClose, record }: EditClientDialogProps) {
  const [type, setType] = useState<"Individual" | "Corporate">(record.type as any || "Individual");
  const [tag, setTag] = useState<"Active" | "VIP" | "Corporate" | "Individual" | "Archived">(
    record.tag as any || "Active"
  );
  const [kyc, setKyc] = useState<"Verified" | "Pending" | "Rejected">(
    record.kyc || "Pending"
  );
  const [name, setName] = useState(record.name || "");
  const [phone, setPhone] = useState(record.phone || "");
  const [email, setEmail] = useState(record.email || "");
  const [address, setAddress] = useState(record.address || "");
  const [aadhar, setAadhar] = useState(record.aadhar || "");
  const [pan, setPan] = useState(record.pan || "");
  const [notes, setNotes] = useState(record.notes || "");
  const [promisedCompletionDate, setPromisedCompletionDate] = useState<string>("");
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [subClients, setSubClients] = useState<SubClientEntry[]>([]);
  const [showSubClient, setShowSubClient] = useState(false);

  // Property Details
  const [propertyAddress, setPropertyAddress] = useState(record.propertyDetails?.address || "");
  const [surveyNo, setSurveyNo] = useState(record.propertyDetails?.surveyNo || "");
  const [chsName, setChsName] = useState(record.propertyDetails?.chsName || "");
  const [sector, setSector] = useState(record.propertyDetails?.sector || "");
  const [plot, setPlot] = useState(record.propertyDetails?.plot || "");
  const [area, setArea] = useState(record.propertyDetails?.area || "");

  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [subClientErrors, setSubClientErrors] = useState<{
    [idx: number]: { name?: string; relationship?: string; phone?: string; email?: string };
  }>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: empData } = useEmployees();
  const employees = empData?.employees ?? [];
  const updateClient = useUpdateClient();

  useEffect(() => {
    if (open) {
      setType(record.type as any || "Individual");
      setTag(record.tag as any || "Active");
      setKyc(record.kyc || "Pending");
      setName(record.name || "");
      setPhone(record.phone || "");
      setEmail(record.email || "");
      setAddress(record.address || "");
      setAadhar(record.aadhar || "");
      setPan(record.pan || "");
      setNotes(record.notes || "");
      const safeIso = toSafeIso(record.promisedCompletionDate);
      setPromisedCompletionDate(safeIso ? safeIso.slice(0, 16) : "");
      const initialAssigned = (record.assignedTo || []).map((a: any) =>
        typeof a === "object" && a !== null ? a._id : a
      );
      setAssignedTo(initialAssigned);

      const initialSubClients = (record.subClients || []).map((sc: any) => ({
        name: sc.name || "",
        relationship: sc.relationship || "",
        description: sc.description || sc.notes || "",
        phone: sc.phone || "",
        email: sc.email || "",
      }));
      setSubClients(initialSubClients);

      setPropertyAddress(record.propertyDetails?.address || "");
      setSurveyNo(record.propertyDetails?.surveyNo || "");
      setChsName(record.propertyDetails?.chsName || "");
      setSector(record.propertyDetails?.sector || "");
      setPlot(record.propertyDetails?.plot || "");
      setArea(record.propertyDetails?.area || "");
      setFieldErrors({});
      setSubClientErrors({});
      setErrorMsg(null);
    }
  }, [open, record]);

  const toggleStaff = (empId: string) => {
    setAssignedTo((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  const addSubClient = () => {
    setSubClients((prev) => [
      ...prev,
      { name: "", relationship: "", description: "", phone: "", email: "" },
    ]);
    setShowSubClient(true);
  };

  const removeSubClient = (idx: number) => {
    setSubClients((prev) => prev.filter((_, i) => i !== idx));
    setSubClientErrors((prev) => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
  };

  const updateSubClient = (
    idx: number,
    field: keyof SubClientEntry,
    val: string
  ) => {
    setSubClients((prev) =>
      prev.map((sc, i) => (i === idx ? { ...sc, [field]: val } : sc))
    );
    if (subClientErrors[idx]?.[field as keyof (typeof subClientErrors)[number]]) {
      setSubClientErrors((prev) => {
        const next = { ...prev };
        if (next[idx]) {
          const item = { ...next[idx] };
          delete item[field as keyof typeof item];
          next[idx] = item;
        }
        return next;
      });
    }
  };

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const errors: FormErrors = {};

    if (!name.trim()) {
      errors.name = "Client name is required.";
    }

    if (phone.trim()) {
      const pCheck = validatePhone(phone);
      if (!pCheck.valid) errors.phone = pCheck.error ?? "Invalid phone number";
    }

    if (email.trim()) {
      const eCheck = validateEmail(email);
      if (!eCheck.valid) errors.email = eCheck.error ?? "Invalid email format";
    }

    if (aadhar.trim()) {
      const aCheck = validateAadhaar(aadhar);
      if (!aCheck.valid) errors.aadhar = aCheck.error ?? "Invalid Aadhaar number";
    }

    if (pan.trim()) {
      const panCheck = validatePan(pan);
      if (!panCheck.valid) errors.pan = panCheck.error ?? "Invalid PAN format";
    }

    // Sub-client validation
    const scErrors: { [idx: number]: { name?: string; relationship?: string; phone?: string; email?: string } } = {};
    let hasScErrors = false;

    subClients.forEach((sc, idx) => {
      const hasAny =
        sc.name.trim() ||
        sc.relationship.trim() ||
        sc.phone.trim() ||
        sc.email.trim() ||
        sc.description.trim();

      if (hasAny) {
        const itemErrors: { name?: string; relationship?: string; phone?: string; email?: string } = {};
        if (!sc.name.trim()) {
          itemErrors.name = "Sub-client name is required";
          hasScErrors = true;
        }
        if (!sc.relationship.trim()) {
          itemErrors.relationship = "Relationship is required (e.g. Spouse, Director, Partner)";
          hasScErrors = true;
        }
        if (sc.phone.trim()) {
          const pCheck = validatePhone(sc.phone);
          if (!pCheck.valid) {
            itemErrors.phone = pCheck.error ?? "Invalid phone number";
            hasScErrors = true;
          }
        }
        if (sc.email.trim()) {
          const eCheck = validateEmail(sc.email);
          if (!eCheck.valid) {
            itemErrors.email = eCheck.error ?? "Invalid email format";
            hasScErrors = true;
          }
        }
        if (Object.keys(itemErrors).length > 0) {
          scErrors[idx] = itemErrors;
        }
      }
    });

    if (Object.keys(errors).length > 0 || hasScErrors) {
      setFieldErrors(errors);
      setSubClientErrors(scErrors);
      setErrorMsg("Please fix the errors in the form before saving.");
      return;
    }
    setFieldErrors({});
    setSubClientErrors({});

    try {
      const hasProperty =
        propertyAddress.trim() ||
        surveyNo.trim() ||
        chsName.trim() ||
        sector.trim() ||
        plot.trim() ||
        area.trim();

      const payload: Partial<CreateClientPayload> = {
        type,
        tag,
        kyc,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        aadhar: aadhar.trim(),
        pan: pan.trim().toUpperCase(),
        notes: notes.trim(),
        assignedTo,
        promisedCompletionDate: promisedCompletionDate
          ? toSafeIso(promisedCompletionDate)
          : null,
      };

      if (hasProperty) {
        payload.propertyDetails = {
          address: propertyAddress.trim(),
          surveyNo: surveyNo.trim(),
          chsName: chsName.trim(),
          sector: sector.trim(),
          plot: plot.trim(),
          area: area.trim(),
        };
      }

      payload.subClients = subClients
        .filter((sc) => sc.name.trim())
        .map((sc) => ({
          name: sc.name.trim(),
          relationship: sc.relationship.trim(),
          phone: sc.phone.trim(),
          email: sc.email.trim(),
          notes: sc.description.trim(),
        }));

      await updateClient.mutateAsync({
        id: record._id,
        data: payload,
      });

      onClose();
    } catch (err: any) {
      console.error("Failed to update client:", err);
      setErrorMsg(err?.message || "Failed to update client profile.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl rounded-xl border border-border bg-card p-6 shadow-lift">
        <DialogHeader className="border-b border-border/60 pb-4">
          <div className="flex items-center gap-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <Users size={18} strokeWidth={1.75} />
            </span>
            <div>
              <DialogTitle className="text-title font-semibold text-foreground">
                Edit Client Profile
              </DialogTitle>
              <DialogDescription className="text-helper text-muted-foreground">
                Update client contact, classification, assigned counsel, and property details.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {errorMsg && (
          <div className="mt-4 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-helper text-destructive">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-5">
          {/* Classification */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-helper font-medium">Client Type</Label>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={type === "Individual" ? "default" : "outline"}
                  className="flex-1 rounded-md px-2 text-caption"
                  onClick={() => setType("Individual")}
                >
                  <Users size={13} className="mr-1" />
                  Individual
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={type === "Corporate" ? "default" : "outline"}
                  className="flex-1 rounded-md px-2 text-caption"
                  onClick={() => setType("Corporate")}
                >
                  <Building2 size={13} className="mr-1" />
                  Corporate
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="client-tag" className="text-helper font-medium">Status Tag</Label>
              <select
                id="client-tag"
                value={tag}
                onChange={(e) => setTag(e.target.value as any)}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-helper text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="Active">Active</option>
                <option value="VIP">VIP</option>
                <option value="Corporate">Corporate</option>
                <option value="Individual">Individual</option>
                <option value="Archived">Archived</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="client-kyc" className="text-helper font-medium flex items-center gap-1">
                <ShieldCheck size={14} className="text-muted-foreground" />
                Identity Verification
              </Label>
              <select
                id="client-kyc"
                value={kyc}
                onChange={(e) => setKyc(e.target.value as any)}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-helper text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="Verified">Verified</option>
                <option value="Pending">Pending</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>

          {/* Primary Info */}
          <div className="space-y-3 border-t border-border/50 pt-3">
            <h4 className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">
              Contact Information
            </h4>
            <div className="space-y-1.5">
              <Label htmlFor="client-name" className="text-helper font-medium">
                Full Legal Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="client-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ramesh Chandra Sharma"
                className="h-10 rounded-md"
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="client-phone" className="text-helper font-medium flex items-center gap-1.5">
                  <Phone size={13} className="text-muted-foreground" />
                  Phone (10-digit Mobile)
                </Label>
                <Input
                  id="client-phone"
                  value={phone}
                  onChange={(e) => {
                    setPhone(sanitizePhone(e.target.value));
                    if (fieldErrors.phone) setFieldErrors((p) => ({ ...p, phone: "" }));
                  }}
                  placeholder="9876543210"
                  className={`h-10 rounded-md ${fieldErrors.phone ? "border-destructive focus-visible:ring-destructive" : ""}`}
                />
                {fieldErrors.phone && (
                  <p className="text-caption text-destructive font-medium">{fieldErrors.phone}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="client-email" className="text-helper font-medium flex items-center gap-1.5">
                  <Mail size={13} className="text-muted-foreground" />
                  Email Address
                </Label>
                <Input
                  id="client-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: "" }));
                  }}
                  placeholder="client@firm.com"
                  className={`h-10 rounded-md ${fieldErrors.email ? "border-destructive focus-visible:ring-destructive" : ""}`}
                />
                {fieldErrors.email && (
                  <p className="text-caption text-destructive font-medium">{fieldErrors.email}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="client-address" className="text-helper font-medium flex items-center gap-1.5">
                <MapPin size={13} className="text-muted-foreground" />
                Physical / Office Address
              </Label>
              <Input
                id="client-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Flat / Building, Street, City, State, PIN"
                className="h-10 rounded-md"
              />
            </div>
          </div>

          {/* Identity Verification Documents */}
          <div className="space-y-3 border-t border-border/50 pt-3">
            <h4 className="text-caption font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <FileBadge size={14} />
              Identity Verification Details
            </h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="client-aadhar" className="text-helper font-medium">Aadhaar Number (12 digits)</Label>
                <Input
                  id="client-aadhar"
                  value={aadhar}
                  onChange={(e) => {
                    setAadhar(sanitizeAadhaar(e.target.value));
                    if (fieldErrors.aadhar) setFieldErrors((p) => ({ ...p, aadhar: "" }));
                  }}
                  placeholder="123456789012"
                  maxLength={12}
                  className={`h-10 rounded-md ${fieldErrors.aadhar ? "border-destructive focus-visible:ring-destructive" : ""}`}
                />
                {fieldErrors.aadhar && (
                  <p className="text-caption text-destructive font-medium">{fieldErrors.aadhar}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="client-pan" className="text-helper font-medium">PAN Number (10 characters)</Label>
                <Input
                  id="client-pan"
                  value={pan}
                  onChange={(e) => {
                    setPan(sanitizePan(e.target.value));
                    if (fieldErrors.pan) setFieldErrors((p) => ({ ...p, pan: "" }));
                  }}
                  placeholder="ABCDE1234F"
                  maxLength={10}
                  className={`h-10 rounded-md uppercase ${fieldErrors.pan ? "border-destructive focus-visible:ring-destructive" : ""}`}
                />
                {fieldErrors.pan && (
                  <p className="text-caption text-destructive font-medium">{fieldErrors.pan}</p>
                )}
              </div>
            </div>
          </div>

          {/* Staff Assignment & Promised Delivery */}
          <div className="space-y-3 border-t border-border/50 pt-3">
            <h4 className="text-caption font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <UserCheck size={14} className="text-primary" />
              Staff Assignment &amp; Promised Delivery
            </h4>

            {/* Multi-staff Assignment */}
            <div className="space-y-1.5">
              <Label className="text-helper font-medium">Assigned Legal Staff / Advocates</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 max-h-32 overflow-y-auto pr-1">
                {employees.map((emp) => {
                  const selected = assignedTo.includes(emp._id);
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

            {/* Promised Completion & Notes */}
            <div className="grid gap-4 sm:grid-cols-2 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="client-completion" className="text-helper font-medium flex items-center gap-1.5">
                  <Calendar size={13} className="text-muted-foreground" />
                  Promised Completion Date &amp; Time
                </Label>
                <Input
                  id="client-completion"
                  type="datetime-local"
                  value={promisedCompletionDate}
                  onChange={(e) => setPromisedCompletionDate(e.target.value)}
                  className="h-10 rounded-md"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="client-notes" className="text-helper font-medium flex items-center gap-1.5">
                  <FileText size={13} className="text-muted-foreground" />
                  Client / Intake Notes
                </Label>
                <Input
                  id="client-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Intake notes, billing preferences…"
                  className="h-10 rounded-md"
                />
              </div>
            </div>
          </div>

          {/* Property Details */}
          <div className="space-y-3 border-t border-border/50 pt-3">
            <h4 className="text-caption font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Home size={14} />
              Property Details (Optional)
            </h4>
            <div className="space-y-1.5">
              <Label htmlFor="client-prop-addr" className="text-helper font-medium">Property Address</Label>
              <Input
                id="client-prop-addr"
                value={propertyAddress}
                onChange={(e) => setPropertyAddress(e.target.value)}
                placeholder="Property location / address"
                className="h-10 rounded-md"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="client-survey" className="text-helper font-medium">Survey No.</Label>
                <Input
                  id="client-survey"
                  value={surveyNo}
                  onChange={(e) => setSurveyNo(e.target.value)}
                  placeholder="Survey #"
                  className="h-10 rounded-md"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="client-chs" className="text-helper font-medium">CHS / Society</Label>
                <Input
                  id="client-chs"
                  value={chsName}
                  onChange={(e) => setChsName(e.target.value)}
                  placeholder="Society Name"
                  className="h-10 rounded-md"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="client-sector" className="text-helper font-medium">Sector</Label>
                <Input
                  id="client-sector"
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  placeholder="Sector #"
                  className="h-10 rounded-md"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="client-plot" className="text-helper font-medium">Plot / Flat</Label>
                <Input
                  id="client-plot"
                  value={plot}
                  onChange={(e) => setPlot(e.target.value)}
                  placeholder="Plot / Flat #"
                  className="h-10 rounded-md"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="client-area" className="text-helper font-medium">Area / Sq Ft</Label>
                <Input
                  id="client-area"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="e.g. 1,200 sq.ft."
                  className="h-10 rounded-md"
                />
              </div>
            </div>
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
                Sub-clients ({subClients.length}) <span className="text-caption text-muted-foreground">(optional)</span>
              </p>
              {showSubClient ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
            </button>
            {showSubClient && (
              <div className="border-t border-border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-helper text-muted-foreground">
                    Buyers, sellers, family members, or related parties for this client.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-caption"
                    onClick={addSubClient}
                  >
                    <Plus size={13} /> Add Sub-client
                  </Button>
                </div>

                {subClients.map((sc, idx) => (
                  <div key={idx} className="rounded-md border border-border bg-muted/30 p-4">
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
                        <Label htmlFor={`sc-name-${idx}`} className="text-helper">Name *</Label>
                        <Input
                          id={`sc-name-${idx}`}
                          value={sc.name}
                          onChange={(e) => updateSubClient(idx, "name", e.target.value)}
                          placeholder="Full name"
                          className={`h-10 rounded-md ${subClientErrors[idx]?.name ? "border-destructive focus-visible:ring-destructive/30 bg-destructive/5" : ""}`}
                        />
                        {subClientErrors[idx]?.name && (
                          <p className="text-caption text-destructive flex items-center gap-1 font-medium">
                            <AlertCircle size={12} /> {subClientErrors[idx].name}
                          </p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`sc-rel-${idx}`} className="text-helper">Relationship *</Label>
                        <Input
                          id={`sc-rel-${idx}`}
                          value={sc.relationship}
                          onChange={(e) => updateSubClient(idx, "relationship", e.target.value)}
                          placeholder="Buyer / Seller / Partner"
                          className={`h-10 rounded-md ${subClientErrors[idx]?.relationship ? "border-destructive focus-visible:ring-destructive/30 bg-destructive/5" : ""}`}
                        />
                        {subClientErrors[idx]?.relationship && (
                          <p className="text-caption text-destructive flex items-center gap-1 font-medium">
                            <AlertCircle size={12} /> {subClientErrors[idx].relationship}
                          </p>
                        )}
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor={`sc-desc-${idx}`} className="text-helper">Description / Notes</Label>
                        <Input
                          id={`sc-desc-${idx}`}
                          value={sc.description}
                          onChange={(e) => updateSubClient(idx, "description", e.target.value)}
                          placeholder="Notes or details about this sub-client"
                          className="h-10 rounded-md"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`sc-phone-${idx}`} className="text-helper">Phone Number</Label>
                        <Input
                          id={`sc-phone-${idx}`}
                          value={sc.phone}
                          onChange={(e) => updateSubClient(idx, "phone", sanitizePhone(e.target.value))}
                          placeholder="10-digit phone number"
                          className={`h-10 rounded-md ${subClientErrors[idx]?.phone ? "border-destructive focus-visible:ring-destructive/30 bg-destructive/5" : ""}`}
                        />
                        {subClientErrors[idx]?.phone && (
                          <p className="text-caption text-destructive flex items-center gap-1 font-medium">
                            <AlertCircle size={12} /> {subClientErrors[idx].phone}
                          </p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`sc-email-${idx}`} className="text-helper">Email Address</Label>
                        <Input
                          id={`sc-email-${idx}`}
                          value={sc.email}
                          onChange={(e) => updateSubClient(idx, "email", e.target.value)}
                          placeholder="email@domain.com"
                          className={`h-10 rounded-md ${subClientErrors[idx]?.email ? "border-destructive focus-visible:ring-destructive/30 bg-destructive/5" : ""}`}
                        />
                        {subClientErrors[idx]?.email && (
                          <p className="text-caption text-destructive flex items-center gap-1 font-medium">
                            <AlertCircle size={12} /> {subClientErrors[idx].email}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {subClients.length === 0 && (
                  <div className="rounded-md border border-dashed border-border/80 p-6 text-center">
                    <p className="text-helper text-muted-foreground">No sub-clients added yet.</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2 text-caption gap-1"
                      onClick={addSubClient}
                    >
                      <Plus size={13} /> Add first sub-client
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="mt-6 flex justify-end gap-2 border-t border-border/60 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-md">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateClient.isPending}
              className="gradient-primary rounded-md text-primary-foreground"
            >
              {updateClient.isPending ? (
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
