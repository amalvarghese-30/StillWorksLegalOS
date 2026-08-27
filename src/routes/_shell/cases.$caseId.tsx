import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import {
  Gavel, FileText, CheckSquare, StickyNote, History, Users,
  LayoutDashboard, Plus, Loader2, ChevronDown, Clock,
  Send, Check, X, UserPlus, Activity as ActivityIcon,
  CalendarDays, Edit3,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/common/Surface";
import { StatusPill, toneForStatus } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  useCase, useUpdateCase, useAddCaseNote, useAddCaseParty,
  type CaseRecord, type CaseParty,
} from "@/services/cases";
import { useTasks } from "@/services/tasks";
import { useDocuments } from "@/services/documents";
import { useCalendarEvents } from "@/services/calendar";

export const Route = createFileRoute("/_shell/cases/$caseId")({
  head: () => ({
    meta: [
      { title: "Case workspace · StillWorks LegalOS" },
      { name: "description", content: "A single operating screen for a matter: hearings, documents, tasks, parties and timeline." },
      { property: "og:title", content: "Case workspace · StillWorks LegalOS" },
      { property: "og:description", content: "Hearings, documents, tasks, parties and timeline for one matter." },
    ],
  }),
  component: CaseWorkspace,
});

const sections = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "hearings", label: "Hearings", icon: Gavel },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "parties", label: "Parties", icon: Users },
  { id: "timeline", label: "Timeline", icon: History },
  { id: "activity", label: "Activity", icon: ActivityIcon },
] as const;

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "Not scheduled";
  return new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Inline status/priority/assigned editor dropdown */
function QuickEditDropdown({ record, caseId }: { record: CaseRecord; caseId: string }) {
  const [open, setOpen] = useState(false);
  const updateCase = useUpdateCase();

  const statuses = ["Active", "Urgent", "On Hold", "Closed"] as const;
  const priorities = ["High", "Medium", "Low"] as const;

  return (
    <div className="relative">
      <Button variant="outline" size="sm" className="rounded-md" onClick={() => setOpen(!open)}>
        <Edit3 size={14} strokeWidth={1.75} />
        Edit
        <ChevronDown size={14} strokeWidth={1.75} />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-64 rounded-lg border border-border bg-card p-3 shadow-lift">
            {/* Status */}
            <p className="mb-2 text-caption font-semibold text-muted-foreground">Status</p>
            <div className="mb-3 flex gap-1">
              {statuses.map((s) => (
                <button
                  key={s}
                  onClick={() => { updateCase.mutate({ id: caseId, data: { status: s } }); setOpen(false); }}
                  disabled={updateCase.isPending}
                  className={`flex-1 rounded-sm px-2 py-1.5 text-caption font-medium transition-colors ${
                    record.status === s ? "bg-primary/15 text-primary ring-1 ring-primary/30" : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Priority */}
            <p className="mb-2 text-caption font-semibold text-muted-foreground">Priority</p>
            <div className="flex gap-1">
              {priorities.map((p) => (
                <button
                  key={p}
                  onClick={() => { updateCase.mutate({ id: caseId, data: { priority: p } }); setOpen(false); }}
                  disabled={updateCase.isPending}
                  className={`flex-1 rounded-sm px-2 py-1.5 text-caption font-medium transition-colors ${
                    record.priority === p ? "bg-primary/15 text-primary ring-1 ring-primary/30" : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Add note form */
function AddNoteForm({ caseId }: { caseId: string }) {
  const [text, setText] = useState("");
  const addNote = useAddCaseNote();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || addNote.isPending) return;
    addNote.mutate({ caseId, text: text.trim() }, { onSuccess: () => { setText(""); inputRef.current?.focus(); } });
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write a case note…"
        className="h-10 flex-1 rounded-md"
      />
      <Button type="submit" size="sm" className="gradient-primary rounded-md text-primary-foreground" disabled={!text.trim() || addNote.isPending}>
        {addNote.isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
      </Button>
    </form>
  );
}

/** Add party form */
function AddPartyForm({ caseId }: { caseId: string }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [type, setType] = useState<CaseParty["type"]>("client");
  const [show, setShow] = useState(false);
  const addParty = useAddCaseParty();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || addParty.isPending) return;
    addParty.mutate({ caseId, party: { name: name.trim(), role: role.trim() || "Party", type } }, {
      onSuccess: () => { setName(""); setRole(""); setShow(false); },
    });
  };

  if (!show) {
    return (
      <Button variant="outline" size="sm" className="rounded-md" onClick={() => setShow(true)}>
        <UserPlus size={14} /> Add party
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-md border border-border bg-muted/30 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5 sm:col-span-3">
          <Label className="text-caption">Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Party name" className="h-10 rounded-md" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-caption">Role</Label>
          <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Plaintiff, Defendant…" className="h-10 rounded-md" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-caption">Type</Label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as CaseParty["type"])}
            className="h-10 w-full rounded-md border border-border bg-card px-3 text-helper outline-none"
          >
            <option value="client">Client</option>
            <option value="sub_client">Sub-client</option>
            <option value="opposing_party">Opposing Party</option>
            <option value="counsel">Counsel</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" className="rounded-md" onClick={() => setShow(false)}>
          <X size={14} /> Cancel
        </Button>
        <Button type="submit" size="sm" className="gradient-primary rounded-md text-primary-foreground" disabled={!name.trim() || addParty.isPending}>
          {addParty.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

function CaseWorkspace() {
  const { caseId } = Route.useParams();
  const { data, isLoading, isError } = useCase(caseId);
  const [active, setActive] = useState("overview");

  // Linked data — queried only when tab is active
  const { data: docsData } = useDocuments({ caseId });
  const { data: tasksData } = useTasks({ caseId });
  const { data: hearingsData } = useCalendarEvents({
    start: "1970-01-01",
    end: "2099-12-31",
    caseId,
  });
  const { data: auditData } = { data: null };  // activity tab replaced with note/timeline recap

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Loader2 size={32} className="mx-auto animate-spin text-muted-foreground" />
          <p className="mt-4 text-helper text-muted-foreground">Loading case workspace…</p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-sm text-center">
          <h2 className="text-xl font-semibold">Case not found</h2>
          <p className="mt-2 text-helper text-muted-foreground">This case may have been deleted or you don't have access to it.</p>
        </div>
      </div>
    );
  }

  const record = data.case;
  const documents = docsData?.documents ?? [];
  const tasks = tasksData?.tasks ?? [];
  const hearings = (hearingsData?.events ?? []).filter((e) => e.type === "hearing");

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "StillWorks", to: "/" },
          { label: "Cases", to: "/cases" },
          { label: record.number },
        ]}
        title={record.title}
        subtitle={`${record.parties?.[0]?.name ?? "No client"} · ${record.court || "No court"}`}
        actions={
          <>
            <Button variant="outline" className="rounded-md" asChild>
              <Link to="/calendar"><CalendarDays size={17} strokeWidth={1.75} /> View calendar</Link>
            </Button>
            <QuickEditDropdown record={record} caseId={caseId} />
          </>
        }
      />

      {/* Hero card */}
      <div className="gradient-primary mb-6 rounded-lg p-6 text-primary-foreground shadow-lift">
        <div className="grid gap-6 md:grid-cols-4">
          {[
            ["Status", record.status],
            ["Priority", record.priority],
            ["Assigned", record.assignedTo?.name ?? "Unassigned"],
            ["Next hearing", formatDate(record.nextHearing)],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <p className="text-caption opacity-85">{label}</p>
              <p className="mt-1 truncate text-body font-semibold">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex items-center gap-3">
          <Progress value={record.progress} className="h-1.5 bg-white/25" />
          <span className="num shrink-0 text-caption">{record.progress}% complete</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Section nav */}
        <nav aria-label="Case sections" className="lg:sticky lg:top-28 lg:self-start">
          <ul className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-card p-2 shadow-soft lg:flex-col lg:overflow-visible">
            {sections.map((s) => (
              <li key={s.id} className="shrink-0 lg:shrink">
                <button
                  onClick={() => setActive(s.id)}
                  aria-current={active === s.id ? "true" : undefined}
                  className={`flex min-h-11 w-full items-center gap-2.5 rounded-sm px-3 text-helper font-medium transition-colors duration-150 ${
                    active === s.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <s.icon size={18} strokeWidth={1.75} />
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Tab content */}
        <div className="min-w-0 space-y-6">
          {/* ── Overview ── */}
          {active === "overview" && (
            <>
              <SectionCard title="Matter summary" description="The essentials, nothing else." icon={LayoutDashboard}>
                <p className="text-body text-muted-foreground">
                  {record.description || "No description provided yet."}
                </p>
                <dl className="mt-6 grid gap-4 sm:grid-cols-3">
                  {[
                    ["Practice area", record.practice],
                    ["Filed on", formatDate(record.createdAt)],
                    ["Case number", record.number],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-md bg-muted/60 p-4">
                      <dt className="text-caption text-muted-foreground">{k}</dt>
                      <dd className="mt-1 truncate text-helper font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>
                {record.tags && record.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {record.tags.map((t) => (
                      <span key={t} className="rounded-pill bg-primary/10 px-3 py-1 text-caption font-medium text-primary">{t}</span>
                    ))}
                  </div>
                )}
              </SectionCard>

              {record.timeline && record.timeline.length > 0 && (
                <SectionCard title="Recent timeline" description="How the matter progressed." icon={History}>
                  <ol className="relative space-y-5 border-l border-border pl-6">
                    {record.timeline.slice(-6).reverse().map((t) => (
                      <li key={t._id ?? t.event} className="relative">
                        <span className="absolute top-1.5 -left-[1.9rem] size-2.5 rounded-full bg-primary ring-4 ring-card" />
                        <p className="font-medium">{t.event}</p>
                        <p className="text-helper text-muted-foreground">
                          {formatDate(t.when)} · {t.by}
                        </p>
                      </li>
                    ))}
                  </ol>
                </SectionCard>
              )}
            </>
          )}

          {/* ── Hearings ── */}
          {active === "hearings" && (
            <SectionCard title="Hearings" description="Court dates and scheduled hearings for this matter." icon={Gavel}>
              {hearings.length === 0 ? (
                <div className="rounded-lg border border-dashed p-12 text-center">
                  <Gavel size={32} className="mx-auto text-muted-foreground" strokeWidth={1.5} />
                  <p className="mt-4 font-medium">No hearings scheduled</p>
                  <p className="mt-1 text-helper text-muted-foreground">
                    Schedule a hearing from the Calendar module to link it to this case.
                  </p>
                  <Button className="mt-4 gradient-primary rounded-md text-primary-foreground" asChild>
                    <Link to="/calendar"><CalendarDays size={16} /> Open calendar</Link>
                  </Button>
                </div>
              ) : (
                <ol className="relative space-y-5 border-l border-border pl-6">
                  {hearings.map((h) => (
                    <li key={h._id} className="relative">
                      <span className="absolute top-2 -left-[1.9rem] size-2.5 rounded-full bg-primary ring-4 ring-card" />
                      <div className="rounded-md border border-border bg-card p-4">
                        <p className="font-medium">{h.title}</p>
                        {h.description && <p className="mt-1 text-helper text-muted-foreground">{h.description}</p>}
                        <p className="num mt-2 flex items-center gap-1 text-caption text-muted-foreground">
                          <Clock size={12} />
                          {formatDate(h.start)}{" · "}
                          {new Date(h.start).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </SectionCard>
          )}

          {/* ── Documents ── */}
          {active === "documents" && (
            <SectionCard title="Documents" description="Files linked to this matter." icon={FileText}>
              {documents.length === 0 ? (
                <div className="rounded-lg border border-dashed p-12 text-center">
                  <FileText size={32} className="mx-auto text-muted-foreground" strokeWidth={1.5} />
                  <p className="mt-4 font-medium">No documents yet</p>
                  <p className="mt-1 text-helper text-muted-foreground">
                    Upload documents through the Documents module to link them to this case.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {documents.map((d) => (
                    <li key={d._id} className="flex items-center gap-3 py-3">
                      <span className="num grid size-9 shrink-0 place-items-center rounded-sm bg-muted text-caption font-semibold text-muted-foreground">
                        {(d.kind ?? "DOC").slice(0, 3)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-helper font-medium">{d.name}</p>
                        <p className="truncate text-caption text-muted-foreground">{d.size}</p>
                      </div>
                      <StatusPill tone={toneForStatus(d.state)}>{d.state}</StatusPill>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          )}

          {/* ── Tasks ── */}
          {active === "tasks" && (
            <SectionCard title="Tasks" description="Work assigned on this matter." icon={CheckSquare}>
              {tasks.length === 0 ? (
                <div className="rounded-lg border border-dashed p-12 text-center">
                  <CheckSquare size={32} className="mx-auto text-muted-foreground" strokeWidth={1.5} />
                  <p className="mt-4 font-medium">No tasks yet</p>
                  <p className="mt-1 text-helper text-muted-foreground">
                    Create tasks and link them to this case from the Tasks module.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {tasks.map((t) => (
                    <li key={t._id} className="flex items-center gap-3 py-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                        <CheckSquare size={17} strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-helper font-medium">{t.title}</p>
                        <p className="truncate text-caption text-muted-foreground">
                          {t.category?.replace(/_/g, " ")} · Due {formatDate(t.deadline)}
                        </p>
                      </div>
                      <StatusPill tone={toneForStatus(t.status)}>{t.status.replace(/_/g, " ")}</StatusPill>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          )}

          {/* ── Notes ── */}
          {active === "notes" && (
            <SectionCard title="Notes" description="Case notes and observations." icon={StickyNote}
              action={<AddNoteForm caseId={caseId} />}
            >
              {record.notes && record.notes.length > 0 ? (
                <ul className="space-y-4">
                  {record.notes.map((n) => (
                    <li key={n._id ?? n.text} className="rounded-md border border-border p-4">
                      <p className="text-body">{n.text}</p>
                      <p className="mt-2 text-caption text-muted-foreground">
                        {n.author} · {formatRelative(n.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-lg border border-dashed p-12 text-center">
                  <StickyNote size={32} className="mx-auto text-muted-foreground" strokeWidth={1.5} />
                  <p className="mt-4 font-medium">No notes yet</p>
                  <p className="mt-1 text-helper text-muted-foreground">Add a note above to start documenting this matter.</p>
                </div>
              )}
            </SectionCard>
          )}

          {/* ── Parties ── */}
          {active === "parties" && (
            <SectionCard title="Parties" description="Clients, sub-clients and relationships." icon={Users}
              action={<AddPartyForm caseId={caseId} />}
            >
              {record.parties && record.parties.length > 0 ? (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {record.parties.map((p) => (
                    <li key={p._id ?? p.name} className="rounded-md border border-border p-4">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">{p.name}</p>
                        <StatusPill tone={p.type === "client" ? "primary" : p.type === "opposing_party" ? "destructive" : "muted"}>
                          {p.type.replace(/_/g, " ")}
                        </StatusPill>
                      </div>
                      <p className="mt-1 truncate text-helper text-muted-foreground">{p.role}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-lg border border-dashed p-12 text-center">
                  <Users size={32} className="mx-auto text-muted-foreground" strokeWidth={1.5} />
                  <p className="mt-4 font-medium">No parties added</p>
                  <p className="mt-1 text-helper text-muted-foreground">Add clients, sub-clients, opposing parties and counsel.</p>
                </div>
              )}
            </SectionCard>
          )}

          {/* ── Timeline ── */}
          {active === "timeline" && (
            <SectionCard title="Timeline" description="Every milestone in this matter." icon={History}>
              {record.timeline && record.timeline.length > 0 ? (
                <ol className="relative space-y-5 border-l border-border pl-6">
                  {record.timeline.map((t) => (
                    <li key={t._id ?? t.event} className="relative">
                      <span className="absolute top-1.5 -left-[1.9rem] size-2.5 rounded-full bg-primary ring-4 ring-card" />
                      <p className="font-medium">{t.event}</p>
                      <p className="text-helper text-muted-foreground">
                        {formatDate(t.when)} · {t.by}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="rounded-lg border border-dashed p-12 text-center">
                  <History size={32} className="mx-auto text-muted-foreground" strokeWidth={1.5} />
                  <p className="mt-4 font-medium">No timeline entries</p>
                </div>
              )}
            </SectionCard>
          )}

          {/* ── Activity ── */}
          {active === "activity" && (
            <SectionCard title="Activity log" description="Notes and timeline entries — everything that's happened." icon={ActivityIcon}>
              {(() => {
                const items = [
                  ...(record.timeline ?? []).map((t) => ({ kind: "timeline", text: t.event, by: t.by, when: t.when })),
                  ...(record.notes ?? []).map((n) => ({ kind: "note", text: n.text, by: n.author, when: n.createdAt })),
                ].sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());

                if (items.length === 0) {
                  return (
                    <div className="rounded-lg border border-dashed p-12 text-center">
                      <ActivityIcon size={32} className="mx-auto text-muted-foreground" strokeWidth={1.5} />
                      <p className="mt-4 font-medium">No activity yet</p>
                      <p className="mt-1 text-helper text-muted-foreground">Notes and timeline events will appear here.</p>
                    </div>
                  );
                }

                return (
                  <ul className="space-y-3">
                    {items.map((item, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="mt-1 grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-caption font-semibold text-primary">
                          {item.kind === "timeline" ? <History size={14} /> : <StickyNote size={14} />}
                        </span>
                        <div className="min-w-0">
                          <p className="text-helper">
                            <span className="font-medium">{item.by}</span>{" "}
                            <span className="text-muted-foreground">{item.text}</span>
                          </p>
                          <p className="text-caption text-muted-foreground">{formatRelative(item.when)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}
