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

interface EditClientDialogProps {
  open: boolean;
  onClose: () => void;
  record: ClientRecord;
}

export function EditClientDialog({ open, onClose, record }: EditClientDialogProps) {
  const [type, setType] = useState<"Individual" | "Corporate">(record.type as any || "Individual");
  const [tag, setTag] = useState<"Active" | "VIP" | "Corporate" | "Individual" | "Archived">(
    record.tag as any || "Active"
  );
  const [name, setName] = useState(record.name || "");
  const [phone, setPhone] = useState(record.phone || "");
  const [email, setEmail] = useState(record.email || "");
  const [address, setAddress] = useState(record.address || "");
  const [aadhar, setAadhar] = useState(record.aadhar || "");
  const [pan, setPan] = useState(record.pan || "");

  // Property Details
  const [propertyAddress, setPropertyAddress] = useState(record.propertyDetails?.address || "");
  const [surveyNo, setSurveyNo] = useState(record.propertyDetails?.surveyNo || "");
  const [chsName, setChsName] = useState(record.propertyDetails?.chsName || "");
  const [sector, setSector] = useState(record.propertyDetails?.sector || "");
  const [plot, setPlot] = useState(record.propertyDetails?.plot || "");
  const [area, setArea] = useState(record.propertyDetails?.area || "");

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const updateClient = useUpdateClient();

  useEffect(() => {
    if (open) {
      setType(record.type as any || "Individual");
      setTag(record.tag as any || "Active");
      setName(record.name || "");
      setPhone(record.phone || "");
      setEmail(record.email || "");
      setAddress(record.address || "");
      setAadhar(record.aadhar || "");
      setPan(record.pan || "");
      setPropertyAddress(record.propertyDetails?.address || "");
      setSurveyNo(record.propertyDetails?.surveyNo || "");
      setChsName(record.propertyDetails?.chsName || "");
      setSector(record.propertyDetails?.sector || "");
      setPlot(record.propertyDetails?.plot || "");
      setArea(record.propertyDetails?.area || "");
      setErrorMsg(null);
    }
  }, [open, record]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg("Client name is required.");
      return;
    }

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
        name: name.trim(),
      };
      if (phone.trim()) payload.phone = phone.trim();
      if (email.trim()) payload.email = email.trim();
      if (address.trim()) payload.address = address.trim();
      if (aadhar.trim()) payload.aadhar = aadhar.trim();
      if (pan.trim()) payload.pan = pan.trim();
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
                Update client contact, classification, identification, and property details.
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-helper font-medium">Client Type</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={type === "Individual" ? "default" : "outline"}
                  className="flex-1 rounded-md"
                  onClick={() => setType("Individual")}
                >
                  <Users size={14} className="mr-1.5" />
                  Individual
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={type === "Corporate" ? "default" : "outline"}
                  className="flex-1 rounded-md"
                  onClick={() => setType("Corporate")}
                >
                  <Building2 size={14} className="mr-1.5" />
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
                  Phone Number
                </Label>
                <Input
                  id="client-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="h-10 rounded-md"
                />
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
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="client@example.com"
                  className="h-10 rounded-md"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="client-address" className="text-helper font-medium flex items-center gap-1.5">
                <MapPin size={13} className="text-muted-foreground" />
                Physical Address
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

          {/* KYC Documents */}
          <div className="space-y-3 border-t border-border/50 pt-3">
            <h4 className="text-caption font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <FileBadge size={14} />
              KYC & Identification
            </h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="client-aadhar" className="text-helper font-medium">Aadhar Number</Label>
                <Input
                  id="client-aadhar"
                  value={aadhar}
                  onChange={(e) => setAadhar(e.target.value)}
                  placeholder="XXXX XXXX XXXX"
                  className="h-10 rounded-md"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="client-pan" className="text-helper font-medium">PAN Number</Label>
                <Input
                  id="client-pan"
                  value={pan}
                  onChange={(e) => setPan(e.target.value.toUpperCase())}
                  placeholder="ABCDE1234F"
                  className="h-10 rounded-md uppercase"
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
