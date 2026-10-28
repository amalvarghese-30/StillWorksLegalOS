import React from "react";
import { Check, Loader2, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AssigneeMultiSelect } from "@/components/common/AssigneeMultiSelect";
import { sanitizePhone } from "@/lib/validation";

interface TaskEditFormProps {
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  mainCategory: string;
  setMainCategory: (v: string) => void;
  subCategory: string;
  setSubCategory: (v: string) => void;
  customCategory: string;
  setCustomCategory: (v: string) => void;
  categoryTree: Array<{ name: string; children?: Array<{ _id?: string; name: string }> }>;
  availableSubCategories: Array<{ _id?: string; name: string }>;
  priority: "High" | "Medium" | "Low";
  setPriority: (v: "High" | "Medium" | "Low") => void;
  agentSelect: string;
  setAgentSelect: (v: string) => void;
  agentCustom: string;
  setAgentCustom: (v: string) => void;
  predefinedAgents: string[];
  assignedTo: string[];
  setAssignedTo: (v: string[]) => void;
  deadline: string;
  setDeadline: (v: string) => void;
  caseId: string;
  setCaseId: (v: string) => void;
  clientId: string;
  setClientId: (v: string) => void;
  manualCase: boolean;
  setManualCase: (v: boolean | ((p: boolean) => boolean)) => void;
  cases: any[];
  clients: any[];
  callClientName: string;
  setCallClientName: (v: string) => void;
  callPhone: string;
  setCallPhone: (v: string) => void;
  callScheduledAt: string;
  setCallScheduledAt: (v: string) => void;
  callNotes: string;
  setCallNotes: (v: string) => void;
  callCompleted: boolean;
  setCallCompleted: (v: boolean) => void;
  handleSaveDetails: () => void;
  handleCancelEdit: () => void;
  isPending: boolean;
}

export function TaskEditForm({
  title,
  setTitle,
  description,
  setDescription,
  mainCategory,
  setMainCategory,
  subCategory,
  setSubCategory,
  customCategory,
  setCustomCategory,
  categoryTree,
  availableSubCategories,
  priority,
  setPriority,
  agentSelect,
  setAgentSelect,
  agentCustom,
  setAgentCustom,
  predefinedAgents,
  assignedTo,
  setAssignedTo,
  deadline,
  setDeadline,
  caseId,
  setCaseId,
  clientId,
  setClientId,
  manualCase,
  setManualCase,
  cases,
  clients,
  callClientName,
  setCallClientName,
  callPhone,
  setCallPhone,
  callScheduledAt,
  setCallScheduledAt,
  callNotes,
  setCallNotes,
  callCompleted,
  setCallCompleted,
  handleSaveDetails,
  handleCancelEdit,
  isPending,
}: TaskEditFormProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="task-title" className="text-helper font-medium">Task Title</Label>
        <Input
          id="task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-10 rounded-md"
          placeholder="Task summary…"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="task-desc" className="text-helper font-medium">Description</Label>
        <textarea
          id="task-desc"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Additional context or instructions…"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-helper text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="task-main-cat" className="text-helper font-medium">Main Category</Label>
          <select
            id="task-main-cat"
            value={mainCategory}
            onChange={(e) => {
              setMainCategory(e.target.value);
              setSubCategory("");
              setCustomCategory("");
            }}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-helper text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Select main category…</option>
            {categoryTree.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="task-sub-cat" className="text-helper font-medium">Subcategory / Work Type</Label>
          <select
            id="task-sub-cat"
            value={subCategory}
            onChange={(e) => {
              setSubCategory(e.target.value);
              if (e.target.value !== "__other__") setCustomCategory("");
            }}
            disabled={!mainCategory || availableSubCategories.length === 0}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-helper text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          >
            <option value="">Select subcategory…</option>
            {availableSubCategories.map((sc) => (
              <option key={sc._id || sc.name} value={sc.name}>
                {sc.name}
              </option>
            ))}
            <option value="__other__">+ Other / Custom Subcategory...</option>
          </select>
        </div>
      </div>

      {subCategory === "__other__" && (
        <div className="space-y-1.5">
          <Label htmlFor="task-custom-cat" className="text-helper font-medium">Custom Work Type / Subcategory</Label>
          <Input
            id="task-custom-cat"
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value)}
            placeholder="Enter custom work type..."
            className="h-10 rounded-md"
            maxLength={100}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-foreground">Priority</Label>
        <div className="flex h-10 rounded-lg border border-border overflow-hidden bg-muted/30">
          {(["High", "Medium", "Low"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPriority(p)}
              className={`flex-1 text-[11px] font-semibold transition-all border-r border-border last:border-r-0 ${
                priority === p
                  ? p === "High"
                    ? "bg-destructive/15 text-destructive font-bold"
                    : p === "Medium"
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold"
                    : "bg-muted text-foreground font-bold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Agent / Broker Selector in Edit Mode */}
      <div className="space-y-1.5">
        <Label htmlFor="task-agent-select" className="text-helper font-medium">
          Broker / Agent (Optional)
        </Label>
        <div className="space-y-2">
          <select
            id="task-agent-select"
            value={agentSelect}
            onChange={(e) => setAgentSelect(e.target.value)}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-helper text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">None (Direct client / internal)</option>
            {predefinedAgents.map((ag) => (
              <option key={ag} value={ag}>
                {ag}
              </option>
            ))}
            <option value="__other__">+ Other custom broker / agent...</option>
          </select>
          {agentSelect === "__other__" && (
            <Input
              value={agentCustom}
              onChange={(e) => setAgentCustom(e.target.value)}
              placeholder="Enter agent / broker name or firm..."
              className="h-9 rounded-md text-xs"
              maxLength={100}
            />
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-helper font-medium">Assigned To</Label>
          <AssigneeMultiSelect
            value={assignedTo}
            onChange={setAssignedTo}
            placeholder="Tick employees to assign..."
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="task-dl" className="text-helper font-medium">Deadline</Label>
          <Input
            id="task-dl"
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="h-10 rounded-md"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="task-edit-case" className="text-helper font-medium">Linked Case</Label>
            <button
              type="button"
              onClick={() => setManualCase((prev: boolean) => !prev)}
              className="text-xs text-primary hover:underline font-normal"
            >
              {manualCase ? "Select from list" : "Enter manually"}
            </button>
          </div>
          {manualCase ? (
            <Input
              id="task-edit-case"
              value={caseId}
              onChange={(e) => setCaseId(e.target.value)}
              placeholder="Case number or ID (e.g. SW-2026-0001)"
              className="h-10 rounded-md"
            />
          ) : (
            <select
              id="task-edit-case"
              value={caseId || ""}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "__manual__") {
                  setManualCase(true);
                } else {
                  setCaseId(val);
                  if (val && !clientId) {
                    const matchedCase = cases.find((c) => c._id === val);
                    const primaryParty = matchedCase?.parties?.find((p: any) => p.clientId);
                    if (primaryParty?.clientId) {
                      const cid = typeof primaryParty.clientId === "object" ? primaryParty.clientId._id : primaryParty.clientId;
                      setClientId(cid);
                    }
                  }
                }
              }}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-helper text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">None (No case linked)</option>
              {cases.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.number ? `${c.number} — ` : ""}{c.title}
                </option>
              ))}
              <option value="__manual__">+ Enter Case Number / ID manually...</option>
            </select>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="task-edit-client" className="text-helper font-medium">Linked Client</Label>
          <select
            id="task-edit-client"
            value={clientId || ""}
            onChange={(e) => setClientId(e.target.value)}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-helper text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">None (No client linked)</option>
            {clients.map((cl) => (
              <option key={cl._id} value={cl._id}>
                {cl.name} {cl.phone ? `(${cl.phone})` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Call Reminder Details in Edit Mode */}
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
            <PhoneCall size={14} className="text-amber-500" />
            Call Reminder Details
          </Label>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer text-muted-foreground">
            <input
              type="checkbox"
              checked={callCompleted}
              onChange={(e) => setCallCompleted(e.target.checked)}
              className="rounded border-border text-primary"
            />
            Mark call completed
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="call-edit-client" className="text-xs text-muted-foreground">Contact / Client Name</Label>
            <Input
              id="call-edit-client"
              value={callClientName}
              onChange={(e) => setCallClientName(e.target.value)}
              placeholder="Who to call"
              className="h-9 rounded-md text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="call-edit-phone" className="text-xs text-muted-foreground">Phone Number</Label>
            <Input
              id="call-edit-phone"
              value={callPhone}
              onChange={(e) => setCallPhone(sanitizePhone(e.target.value))}
              placeholder="10-digit phone number"
              className="h-9 rounded-md text-xs font-mono"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="call-edit-sched" className="text-xs text-muted-foreground">Scheduled Time</Label>
            <Input
              id="call-edit-sched"
              type="datetime-local"
              value={callScheduledAt}
              onChange={(e) => setCallScheduledAt(e.target.value)}
              className="h-9 rounded-md text-xs font-mono"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="call-edit-notes" className="text-xs text-muted-foreground">Call Agenda / Notes</Label>
            <Input
              id="call-edit-notes"
              value={callNotes}
              onChange={(e) => setCallNotes(e.target.value)}
              placeholder="Discussion topic..."
              className="h-9 rounded-md text-xs"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCancelEdit}
          className="rounded-md"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          className="gradient-primary rounded-md text-primary-foreground font-semibold shadow-soft"
          onClick={handleSaveDetails}
          disabled={isPending}
        >
          {isPending ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Check size={14} className="mr-1.5" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
