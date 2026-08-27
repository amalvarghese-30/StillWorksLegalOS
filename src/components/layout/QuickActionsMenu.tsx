import { useState, type ReactNode } from "react";
import { Briefcase, UserPlus, UploadCloud, Gavel } from "lucide-react";
import { AddCaseDialog } from "@/components/cases/AddCaseDialog";
import { AddClientDialog } from "@/components/clients/AddClientDialog";
import { ScheduleHearingDialog } from "@/components/calendar/ScheduleHearingDialog";
import { UploadDocumentDialog } from "@/components/documents/UploadDocumentDialog";

/**
 * Reusable quick-actions menu + the dialogs it opens. The trigger is caller-
 * supplied via `renderTrigger` so each surface (dashboard header, top bar)
 * can style its own button while sharing the menu and dialog wiring.
 */
export function QuickActionsMenu({
  renderTrigger,
}: {
  renderTrigger: (toggle: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [showAddCase, setShowAddCase] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [showScheduleHearing, setShowScheduleHearing] = useState(false);
  const [showUploadDocument, setShowUploadDocument] = useState(false);

  return (
    <div className="relative">
      {renderTrigger(() => setOpen((o) => !o))}

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-border bg-card p-2 shadow-lift">
            <button
              className="flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-helper transition-colors hover:bg-accent"
              onClick={() => { setOpen(false); setShowAddCase(true); }}
            >
              <Briefcase size={17} strokeWidth={1.75} className="text-muted-foreground" /> Add New Case
            </button>
            <button
              className="flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-helper transition-colors hover:bg-accent"
              onClick={() => { setOpen(false); setShowAddClient(true); }}
            >
              <UserPlus size={17} strokeWidth={1.75} className="text-muted-foreground" /> Add New Client
            </button>
            <button
              className="flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-helper transition-colors hover:bg-accent"
              onClick={() => { setOpen(false); setShowUploadDocument(true); }}
            >
              <UploadCloud size={17} strokeWidth={1.75} className="text-muted-foreground" /> Upload Document
            </button>
            <button
              className="flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-helper transition-colors hover:bg-accent"
              onClick={() => { setOpen(false); setShowScheduleHearing(true); }}
            >
              <Gavel size={17} strokeWidth={1.75} className="text-muted-foreground" /> Schedule Hearing
            </button>
          </div>
        </>
      )}

      {showAddCase && <AddCaseDialog open={showAddCase} onClose={() => setShowAddCase(false)} />}
      {showAddClient && <AddClientDialog open={showAddClient} onClose={() => setShowAddClient(false)} />}
      {showScheduleHearing && <ScheduleHearingDialog open={showScheduleHearing} onClose={() => setShowScheduleHearing(false)} />}
      {showUploadDocument && <UploadDocumentDialog open={showUploadDocument} onClose={() => setShowUploadDocument(false)} />}
    </div>
  );
}
