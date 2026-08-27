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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateClient, type CreateClientPayload, type SubClient } from "@/services/clients";
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

export function AddClientDialog({ open, onClose }: AddClientDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [subClients, setSubClients] = useState<SubClientEntry[]>([]);
  const [showProperty, setShowProperty] = useState(false);
  const [showSubClient, setShowSubClient] = useState(false);

  const createClient = useCreateClient();
  const isPending = createClient.isPending;
  const isError = createClient.isError;

  if (!open) return null;

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

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
    if (!form.name.trim()) return;

    const payload: CreateClientPayload = {
      type: form.type,
      tag: form.tag,
      name: form.name,
      ...(form.phone && { phone: form.phone }),
      ...(form.email && { email: form.email }),
      ...(form.address && { address: form.address }),
      ...(form.aadhar && { aadhar: form.aadhar }),
      ...(form.pan && { pan: form.pan }),
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
            <div className="space-y-1.5">
              <Label htmlFor="client-name" className="text-helper">Full name *</Label>
              <Input
                id="client-name"
                required
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="e.g. Rupesh Patade"
                className="h-11 rounded-md"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="client-phone" className="text-helper">Phone</Label>
              <Input
                id="client-phone"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="+91-XXXXXXXXXX"
                className="h-11 rounded-md"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="client-email" className="text-helper">Email</Label>
              <Input
                id="client-email"
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="client@example.com"
                className="h-11 rounded-md"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="client-address" className="text-helper">Address</Label>
              <Input
                id="client-address"
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
                placeholder="Full address"
                className="h-11 rounded-md"
              />
            </div>
          </div>

          {/* ── KYC ── */}
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="flex items-center gap-2 text-helper font-medium">
              <FileBadge size={16} strokeWidth={1.75} className="text-muted-foreground" />
              KYC Details
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="client-aadhar" className="text-helper">Aadhar Number</Label>
                <Input
                  id="client-aadhar"
                  value={form.aadhar}
                  onChange={(e) => update("aadhar", e.target.value)}
                  placeholder="12-digit Aadhar"
                  maxLength={12}
                  className="h-11 rounded-md"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="client-pan" className="text-helper">PAN Number</Label>
                <Input
                  id="client-pan"
                  value={form.pan}
                  onChange={(e) => update("pan", e.target.value)}
                  placeholder="ABCDE1234F"
                  maxLength={10}
                  className="h-11 rounded-md"
                />
              </div>
            </div>
            {form.aadhar && form.pan && (
              <p className="mt-2 text-caption text-success">
                KYC will be auto-verified on submission.
              </p>
            )}
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