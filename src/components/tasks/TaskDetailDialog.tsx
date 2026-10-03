import { useState, useEffect } from "react";
import {
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Calendar,
  User,
  Tag,
  Loader2,
  Clock,
  Briefcase,
  AlertTriangle,
  Edit2,
  Check,
  PhoneCall,
  Phone,
  Copy,
  CalendarClock,
  MoreVertical,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useUpdateTask,
  useDeleteTask,
  useCreateTask,
  useTaskOptions,
  useToggleChecklistItem,
  type TaskRecord,
  type ChecklistItem,
  type CreateTaskPayload,
} from "@/services/tasks";
import { useCases } from "@/services/cases";
import { useClients } from "@/services/clients";
import { useEmployees } from "@/services/admin";
import { useAuth } from "@/lib/auth";
import { formatSafeDateTime, toSafeIso } from "@/lib/dates";
import { toast } from "sonner";

interface TaskDetailDialogProps {
  open: boolean;
  onClose: () => void;
  task: TaskRecord | null;
}

export function TaskDetailDialog({ open, onClose, task }: TaskDetailDialogProps) {
  if (!open || !task) return null;
  return <TaskDetailDialogInner key={task._id} open={open} onClose={onClose} task={task} />;
}

function TaskDetailDialogInner({ open, onClose, task }: { open: boolean; onClose: () => void; task: TaskRecord }) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(task.title || "");
  const [description, setDescription] = useState(task.description || "");
  const [category, setCategory] = useState(task.category || "General");
  const [priority, setPriority] = useState(task.priority || "Medium");
  const [deadline, setDeadline] = useState(
    task.deadline ? new Date(task.deadline).toISOString().slice(0, 16) : ""
  );
  const [assignedTo, setAssignedTo] = useState(task.assignedTo?._id || "");
  const [caseId, setCaseId] = useState("");
  const [clientId, setClientId] = useState("");
  const [manualCase, setManualCase] = useState(false);
  const [manualClient, setManualClient] = useState(false);
  const [newChecklistText, setNewChecklistText] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Broker / Agent state
  const [agentSelect, setAgentSelect] = useState("");
  const [agentCustom, setAgentCustom] = useState("");

  // Call reminder state
  const isCallTask = Boolean(task?.isCall || task?.callReminder);
  const [callClientName, setCallClientName] = useState("");
  const [callPhone, setCallPhone] = useState("");
  const [callScheduledAt, setCallScheduledAt] = useState("");
  const [callNotes, setCallNotes] = useState("");
  const [callCompleted, setCallCompleted] = useState(false);

  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data: empData } = useEmployees(undefined, { enabled: isAdmin });
  const employees = empData?.employees ?? [];
  const { data: casesData } = useCases({ limit: "100" });
  const { data: clientsData } = useClients({ limit: "100" });
  const cases = casesData?.cases ?? [];
  const clients = clientsData?.clients ?? [];

  const { data: optionsData } = useTaskOptions();
  const predefinedAgents = optionsData?.agents ?? [];

  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const createTask = useCreateTask();
  const toggleItem = useToggleChecklistItem();

  useEffect(() => {
    if (task) {
      setTitle(task.title || "");
      setDescription(task.description || "");
      setCategory(task.category || "General");
      setPriority(task.priority || "Medium");
      setDeadline(task.deadline ? new Date(task.deadline).toISOString().slice(0, 16) : "");
      setAssignedTo(task.assignedTo?._id || "");

      // Handle Agent / Broker initialization
      if (task.agent) {
        if (predefinedAgents.includes(task.agent)) {
          setAgentSelect(task.agent);
          setAgentCustom("");
        } else {
          setAgentSelect("__other__");
          setAgentCustom(task.agent);
        }
      } else {
        setAgentSelect("");
        setAgentCustom("");
      }

      const cr = task.callReminder;
      setCallClientName(cr?.clientName || (task.isCall ? task.title.replace(/^📞\s*CALL:\s*/i, "") : ""));
      setCallPhone(cr?.phone || "");
      const sched = cr?.scheduledAt ? new Date(cr.scheduledAt) : task.deadline ? new Date(task.deadline) : null;
      if (sched && !isNaN(sched.getTime())) {
        const localIso = new Date(sched.getTime() - sched.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        setCallScheduledAt(localIso);
      } else {
        setCallScheduledAt("");
      }
      setCallNotes(cr?.notes || "");
      setCallCompleted(Boolean(cr?.completed || task.status === "completed"));

      const initialCaseId =
        task.caseId && typeof task.caseId === "object"
          ? (task.caseId as any)._id
          : task.caseId || "";
      setCaseId(initialCaseId || "");

      const initialClientId =
        task.clientId && typeof task.clientId === "object"
          ? (task.clientId as any)._id
          : task.clientId || "";
      setClientId(initialClientId || "");

      setManualCase(false);
      setManualClient(false);
      setIsEditing(false);
      setNewChecklistText("");
    }
  }, [task, predefinedAgents]);

  const caseDisplay =
    task.caseId && typeof task.caseId === "object"
      ? (task.caseId.number ? `${task.caseId.number} — ${task.caseId.title}` : task.caseId.title)
      : task.caseName || null;

  const clientDisplay =
    task.clientId && typeof task.clientId === "object"
      ? task.clientId.name
      : task.clientName || null;

  const checklist: ChecklistItem[] = task.checklist ?? [];
  const total = checklist.length;
  const doneCount = checklist.filter((c) => c.done).length;
  const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  const handleToggle = async (item: ChecklistItem) => {
    if (!item._id) return;
    try {
      await toggleItem.mutateAsync({
        taskId: task._id,
        itemId: item._id,
        done: !item.done,
      });
    } catch (err) {
      console.error("Failed to toggle checklist item:", err);
    }
  };

  const handleAddChecklistItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistText.trim()) return;

    const updatedChecklist = [
      ...checklist.map((c) => ({ text: c.text, done: c.done })),
      { text: newChecklistText.trim(), done: false },
    ];

    try {
      await updateTask.mutateAsync({
        id: task._id,
        data: { checklist: updatedChecklist },
      });
      setNewChecklistText("");
    } catch (err) {
      console.error("Failed to add checklist item:", err);
    }
  };

  const handleRemoveChecklistItem = async (indexToRemove: number) => {
    const updatedChecklist = checklist
      .filter((_, idx) => idx !== indexToRemove)
      .map((c) => ({ text: c.text, done: c.done }));

    try {
      await updateTask.mutateAsync({
        id: task._id,
        data: { checklist: updatedChecklist },
      });
    } catch (err) {
      console.error("Failed to remove checklist item:", err);
    }
  };

  const handleToggleCallDone = async () => {
    const nextVal = !callCompleted;
    setCallCompleted(nextVal);
    try {
      await updateTask.mutateAsync({
        id: task._id,
        data: {
          status: nextVal ? "completed" : "pending",
          callReminder: {
            clientName: callClientName.trim() || task.callReminder?.clientName || task.title,
            phone: callPhone.trim() || task.callReminder?.phone || "",
            scheduledAt: toSafeIso(callScheduledAt) || task.callReminder?.scheduledAt || new Date().toISOString(),
            notes: callNotes.trim() || task.callReminder?.notes || "",
            completed: nextVal,
          },
        },
      });
      toast.success(nextVal ? "Call marked as completed!" : "Call marked as pending");
    } catch {
      setCallCompleted(!nextVal);
      toast.error("Failed to update status");
    }
  };

  const handleSaveDetails = async () => {
    if (!title.trim()) {
      toast.error("Task title is required");
      return;
    }
    if (agentSelect === "__other__" && !agentCustom.trim()) {
      toast.error("Please enter the custom agent/broker name");
      return;
    }

    try {
      const resolvedAgent =
        agentSelect === "__other__"
          ? agentCustom.trim()
          : agentSelect.trim();

      const payload: Partial<CreateTaskPayload> = {
        title: title.trim(),
        description: description.trim(),
        category: category.trim(),
        priority,
        caseId: caseId.trim() ? caseId.trim() : null,
        clientId: clientId.trim() ? clientId.trim() : null,
        agent: resolvedAgent,
      };
      if (deadline) {
        const iso = toSafeIso(deadline);
        if (iso) payload.deadline = iso;
      }
      if (assignedTo) payload.assignedTo = assignedTo;

      if (isCallTask || callClientName.trim()) {
        const scheduledIso = toSafeIso(callScheduledAt) || (deadline ? toSafeIso(deadline) : null) || new Date().toISOString();
        payload.callReminder = {
          clientName: callClientName.trim() || title.trim(),
          phone: callPhone.trim(),
          scheduledAt: scheduledIso,
          notes: callNotes.trim(),
          completed: callCompleted,
        };
        payload.isCall = true;
      }

      await updateTask.mutateAsync({
        id: task._id,
        data: payload,
      });
      toast.success("Task details saved");
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to update task details:", err);
      toast.error(err instanceof Error ? err.message : "Failed to update task");
    }
  };

  const handleDeleteTask = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    try {
      await deleteTask.mutateAsync(task._id);
      toast.success(`Task "${task.title}" deleted`);
      setShowDeleteConfirm(false);
      onClose();
    } catch (err) {
      console.error("Failed to delete task:", err);
      toast.error(err instanceof Error ? err.message : "Failed to delete task");
    }
  };

  const handleDuplicateTask = async () => {
    try {
      const duplicatePayload: CreateTaskPayload = {
        title: `${task.title} (Copy)`,
        description: task.description,
        category: task.category,
        priority: task.priority,
        agent: task.agent,
        checklist: (task.checklist || []).map((c) => ({ text: c.text, done: false })),
        caseId: task.caseId && typeof task.caseId === "object" ? (task.caseId as any)._id : task.caseId || null,
        clientId: task.clientId && typeof task.clientId === "object" ? (task.clientId as any)._id : task.clientId || null,
      };
      if (task.deadline) {
        duplicatePayload.deadline = task.deadline;
      }
      if (task.callReminder) {
        duplicatePayload.callReminder = {
          clientName: task.callReminder.clientName,
          phone: task.callReminder.phone,
          scheduledAt: task.callReminder.scheduledAt,
          notes: task.callReminder.notes,
          completed: false,
        };
        duplicatePayload.isCall = task.isCall;
      }
      await createTask.mutateAsync(duplicatePayload);
      toast.success("Task duplicated successfully");
      onClose();
    } catch (err) {
      console.error("Failed to duplicate task:", err);
      toast.error(err instanceof Error ? err.message : "Failed to duplicate task");
    }
  };

  const handleSetStatus = async (status: "pending" | "in_progress" | "pending_approval" | "completed") => {
    try {
      await updateTask.mutateAsync({
        id: task._id,
        data: { status },
      });
      if (status === "pending_approval") {
        toast.success("Task submitted for admin approval");
      } else if (status === "completed") {
        toast.success("Task marked as completed");
      } else if (status === "in_progress") {
        toast.info("Task marked as in progress");
      } else if (status === "pending") {
        toast.info("Task marked as pending");
      }
    } catch (err) {
      console.error("Failed to update task status:", err);
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const isCreatorOrAdmin =
    isAdmin ||
    (task.createdBy &&
      (typeof task.createdBy === "object" ? (task.createdBy as any)._id : task.createdBy)?.toString() ===
        user?._id?.toString());

  return (
    <>
      <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl rounded-xl border border-border bg-card p-6 shadow-lift">
          <DialogHeader className="border-b border-border/60 pb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-pill bg-primary/10 px-2.5 py-0.5 text-caption font-semibold text-primary">
                    {task.category || "Task"}
                  </span>
                  <span
                    className={`rounded-pill px-2.5 py-0.5 text-caption font-semibold ${
                      task.priority === "High"
                        ? "bg-destructive/15 text-destructive"
                        : task.priority === "Medium"
                        ? "bg-warning/15 text-warning"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {task.priority || "Medium"}
                  </span>
                  {task.status === "completed" ? (
                    <span className="rounded-pill bg-success/15 text-success px-2.5 py-0.5 text-caption font-semibold flex items-center gap-1">
                      <CheckCircle2 size={12} /> Completed
                    </span>
                  ) : task.status === "pending_approval" ? (
                    <span className="rounded-pill bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2.5 py-0.5 text-caption font-semibold flex items-center gap-1">
                      <Clock size={12} /> Pending Approval
                    </span>
                  ) : task.status === "overdue" ? (
                    <span className="rounded-pill bg-destructive text-destructive-foreground px-2.5 py-0.5 text-caption font-bold">
                      Overdue
                    </span>
                  ) : null}

                  {task.agent && (
                    <span className="rounded-pill bg-secondary/80 px-2.5 py-0.5 text-caption font-medium text-foreground border border-border">
                      Agent: {task.agent}
                    </span>
                  )}
                </div>
                <DialogTitle className="text-title font-semibold text-foreground pt-1">
                  {task.title}
                </DialogTitle>
                {caseDisplay && (
                  <DialogDescription className="text-helper text-muted-foreground flex items-center gap-1.5">
                    <Briefcase size={13} />
                    {caseDisplay}
                  </DialogDescription>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                  className="rounded-md h-8 text-xs"
                >
                  <Edit2 size={13} className="mr-1.5" />
                  {isEditing ? "View" : "Edit"}
                </Button>

                {/* More Options Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md" aria-label="More options">
                      <MoreVertical size={16} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="text-xs">
                        <CheckCircle2 size={14} className="mr-2" />
                        Change Status
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-44">
                        <DropdownMenuItem
                          className="text-xs"
                          disabled={task.status === "pending"}
                          onClick={() => handleSetStatus("pending")}
                        >
                          Mark as Pending
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-xs"
                          disabled={task.status === "in_progress"}
                          onClick={() => handleSetStatus("in_progress")}
                        >
                          Mark as In Progress
                        </DropdownMenuItem>
                        {isAdmin ? (
                          <DropdownMenuItem
                            className="text-xs font-medium text-emerald-600 dark:text-emerald-400"
                            disabled={task.status === "completed"}
                            onClick={() => handleSetStatus("completed")}
                          >
                            Approve & Complete
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            className="text-xs font-medium text-amber-600 dark:text-amber-400"
                            disabled={task.status === "pending_approval" || task.status === "completed"}
                            onClick={() => handleSetStatus("pending_approval")}
                          >
                            Submit for Approval
                          </DropdownMenuItem>
                        )}
                        {isAdmin && task.status === "pending_approval" && (
                          <DropdownMenuItem
                            className="text-xs text-amber-600 dark:text-amber-400"
                            onClick={() => handleSetStatus("in_progress")}
                          >
                            Request Changes
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuItem className="text-xs" onClick={handleDuplicateTask}>
                      <Copy size={14} className="mr-2" />
                      Duplicate Task
                    </DropdownMenuItem>

                    {isCreatorOrAdmin && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-xs text-destructive focus:text-destructive"
                          onClick={() => setShowDeleteConfirm(true)}
                        >
                          <Trash2 size={14} className="mr-2" />
                          Delete Task
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </DialogHeader>

          {/* Clean Informational Status Banners (No redundant duplicate action buttons) */}
          {task.status === "pending_approval" && (
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-start gap-2.5">
              <Clock size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="text-helper font-semibold text-foreground">
                  Pending Admin Verification & Approval
                </p>
                <p className="text-caption text-muted-foreground mt-0.5">
                  {isAdmin
                    ? "Submitted for review. Review the checklist items below and approve or request changes using the action buttons."
                    : "Task submitted. An administrator will verify completion and sign off."}
                </p>
              </div>
            </div>
          )}

          {task.status === "completed" && (
            <div className="mt-4 rounded-lg border border-success/30 bg-success/10 p-3.5 flex items-center gap-2.5">
              <CheckCircle2 size={18} className="shrink-0 text-success" />
              <div>
                <p className="text-helper font-semibold text-foreground">Task Completed</p>
                <p className="text-caption text-muted-foreground">Work and checklist items have been completed and verified.</p>
              </div>
            </div>
          )}

          {task.status !== "completed" && task.status !== "pending_approval" && total > 0 && doneCount === total && (
            <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3.5 flex items-center gap-2.5">
              <CheckCircle2 size={18} className="shrink-0 text-primary" />
              <div>
                <p className="text-helper font-semibold text-foreground">All checklist items are completed!</p>
                <p className="text-caption text-muted-foreground">
                  {isAdmin
                    ? "Use the action button below to finalize and complete this task."
                    : "Submit this task for admin verification to complete it."}
                </p>
              </div>
            </div>
          )}

          {isEditing ? (
            /* Edit Form */
            <div className="mt-4 space-y-4">
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
                  <Label htmlFor="task-cat" className="text-helper font-medium">Category</Label>
                  <Input
                    id="task-cat"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="h-10 rounded-md"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="task-prio" className="text-helper font-medium">Priority</Label>
                  <select
                    id="task-prio"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as "High" | "Medium" | "Low")}
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-helper text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
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
                  <Label htmlFor="task-assignee" className="text-helper font-medium">Assignee</Label>
                  <select
                    id="task-assignee"
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
                      onClick={() => setManualCase((prev) => !prev)}
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
                            const primaryParty = matchedCase?.parties?.find((p) => p.clientId);
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
                  <div className="flex items-center justify-between">
                    <Label htmlFor="task-edit-client" className="text-helper font-medium">Linked Client</Label>
                    <button
                      type="button"
                      onClick={() => setManualClient((prev) => !prev)}
                      className="text-xs text-primary hover:underline font-normal"
                    >
                      {manualClient ? "Select from list" : "Enter manually"}
                    </button>
                  </div>
                  {manualClient ? (
                    <Input
                      id="task-edit-client"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      placeholder="Client name or ID"
                      className="h-10 rounded-md"
                    />
                  ) : (
                    <select
                      id="task-edit-client"
                      value={clientId || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "__manual__") {
                          setManualClient(true);
                        } else {
                          setClientId(val);
                        }
                      }}
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-helper text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">None (No client linked)</option>
                      {clients.map((cl) => (
                        <option key={cl._id} value={cl._id}>
                          {cl.name} {cl.phone ? `(${cl.phone})` : ""}
                        </option>
                      ))}
                      <option value="__manual__">+ Enter Client manually...</option>
                    </select>
                  )}
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
                      onChange={(e) => setCallPhone(e.target.value)}
                      placeholder="+91-XXXXXXXXXX"
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
                <Button variant="outline" size="sm" onClick={() => setIsEditing(false)} className="rounded-md">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="gradient-primary rounded-md text-primary-foreground"
                  onClick={handleSaveDetails}
                  disabled={updateTask.isPending}
                >
                  {updateTask.isPending ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Check size={14} className="mr-1.5" />}
                  Save Details
                </Button>
              </div>
            </div>
          ) : (
            /* View Details */
            <div className="mt-4 space-y-4">
              {task.description && (
                <div className="rounded-md bg-muted/50 p-3 text-helper text-foreground/90 whitespace-pre-wrap">
                  {task.description}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2 text-helper">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User size={15} />
                  <span>Assignee: <strong className="text-foreground">{task.assignedTo?.name || "Unassigned"}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar size={15} />
                  <span>
                    Deadline:{" "}
                    <strong className="text-foreground">
                      {formatSafeDateTime(task.deadline, "No deadline")}
                    </strong>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Briefcase size={15} />
                  <span>
                    Linked Case:{" "}
                    <strong className="text-foreground">
                      {caseDisplay || "None (General Task)"}
                    </strong>
                  </span>
                </div>
                {clientDisplay && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User size={15} />
                    <span>
                      Linked Client:{" "}
                      <strong className="text-foreground">{clientDisplay}</strong>
                    </span>
                  </div>
                )}
                {task.agent && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Tag size={15} />
                    <span>
                      Agent / Broker:{" "}
                      <strong className="text-foreground">{task.agent}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Dedicated Call Reminder Card */}
              {(task.isCall || task.callReminder) && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 shadow-soft">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="grid size-9 place-items-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                        <PhoneCall size={18} strokeWidth={2} />
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-foreground">Call Reminder</h4>
                          <span
                            className={`rounded-pill px-2 py-0.5 text-[10px] font-bold ${
                              callCompleted
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                                : "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                            }`}
                          >
                            {callCompleted ? "Done" : "Pending"}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock size={11} />
                          {formatSafeDateTime(task.callReminder?.scheduledAt, "No scheduled time")}
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant={callCompleted ? "outline" : "default"}
                      size="sm"
                      onClick={handleToggleCallDone}
                      disabled={updateTask.isPending}
                      className={`h-8 rounded-pill text-xs font-semibold ${
                        callCompleted
                          ? "border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10"
                          : "gradient-primary text-primary-foreground font-bold shadow-soft"
                      }`}
                    >
                      {callCompleted ? (
                        <>
                          <CheckCircle2 size={13} className="mr-1 text-emerald-600" /> Completed
                        </>
                      ) : (
                        <>
                          <Check size={13} className="mr-1" /> Mark Call Done
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2 text-xs">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User size={13} />
                      <span>Contact: <strong className="text-foreground">{task.callReminder?.clientName || task.title}</strong></span>
                    </div>
                    {task.callReminder?.phone && (
                      <div className="flex items-center justify-between rounded border border-border/60 bg-card px-2.5 py-1">
                        <span className="font-mono text-xs font-medium text-foreground">{task.callReminder.phone}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(task.callReminder!.phone);
                              toast.success("Phone number copied to clipboard");
                            }}
                            className="rounded p-1 text-muted-foreground hover:text-foreground"
                            title="Copy phone"
                          >
                            <Copy size={12} />
                          </button>
                          <a
                            href={`tel:${task.callReminder.phone}`}
                            className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                          >
                            Call
                          </a>
                        </div>
                      </div>
                    )}
                  </div>

                  {task.callReminder?.notes && (
                    <p className="mt-2.5 rounded border border-border/50 bg-background/60 p-2.5 text-xs text-foreground/90 italic">
                      &ldquo;{task.callReminder.notes}&rdquo;
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Checklist Section - Full scrollable list */}
          <div className="mt-5 border-t border-border/60 pt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-helper font-semibold text-foreground flex items-center gap-2">
                Checklist
                <span className="text-caption font-normal text-muted-foreground">
                  ({doneCount} of {total} completed)
                </span>
              </h4>
              <span className="text-caption font-semibold text-primary">{pct}%</span>
            </div>

            <Progress value={pct} className="h-1.5 mb-3" />

            {/* Scrollable list of all items without cutting off */}
            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {checklist.length === 0 ? (
                <p className="py-4 text-center text-helper text-muted-foreground">No checklist items yet.</p>
              ) : (
                checklist.map((item, idx) => (
                  <div
                    key={item._id || idx}
                    className="group flex items-center justify-between gap-2 rounded-md p-2 hover:bg-muted/60 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => handleToggle(item)}
                      disabled={toggleItem.isPending}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left text-helper"
                    >
                      {item.done ? (
                        <CheckCircle2 size={17} className="shrink-0 text-success" />
                      ) : (
                        <Circle size={17} className="shrink-0 text-muted-foreground group-hover:text-foreground" />
                      )}
                      <span className={`truncate ${item.done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                        {item.text}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveChecklistItem(idx)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-opacity"
                      aria-label="Remove item"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Add checklist item */}
            <form onSubmit={handleAddChecklistItem} className="mt-3 flex items-center gap-2">
              <Input
                value={newChecklistText}
                onChange={(e) => setNewChecklistText(e.target.value)}
                placeholder="Add new checklist item…"
                className="h-9 text-helper rounded-md"
              />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                className="h-9 shrink-0 rounded-md"
                disabled={!newChecklistText.trim() || updateTask.isPending}
              >
                <Plus size={14} className="mr-1" /> Add
              </Button>
            </form>
          </div>

          <DialogFooter className="mt-6 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-border/60 pt-4">
            <div>
              {isCreatorOrAdmin ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive rounded-md"
                >
                  <Trash2 size={15} className="mr-1.5" />
                  Delete Task
                </Button>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose} className="rounded-md">
                Close
              </Button>

              {/* Single Contextual Action Button */}
              {task.status === "pending_approval" ? (
                isAdmin ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={updateTask.isPending}
                      onClick={() => handleSetStatus("in_progress")}
                      className="rounded-md"
                    >
                      Request Changes
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="gradient-primary rounded-md text-primary-foreground"
                      disabled={updateTask.isPending}
                      onClick={() => handleSetStatus("completed")}
                    >
                      {updateTask.isPending ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Check size={14} className="mr-1.5" />}
                      Approve & Complete
                    </Button>
                  </>
                ) : (
                  <Button type="button" size="sm" variant="secondary" disabled className="rounded-md opacity-80">
                    <Clock size={14} className="mr-1.5 text-amber-500" />
                    Awaiting Approval
                  </Button>
                )
              ) : task.status === "completed" ? (
                isAdmin ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-md"
                    disabled={updateTask.isPending}
                    onClick={() => handleSetStatus("in_progress")}
                  >
                    <RotateCcw size={14} className="mr-1.5" />
                    Reopen Task
                  </Button>
                ) : null
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="gradient-primary rounded-md text-primary-foreground"
                  disabled={updateTask.isPending}
                  onClick={() => handleSetStatus(isAdmin ? "completed" : "pending_approval")}
                >
                  {updateTask.isPending ? (
                    <Loader2 size={14} className="animate-spin mr-1.5" />
                  ) : (
                    <Check size={14} className="mr-1.5" />
                  )}
                  {isAdmin ? "Mark as Completed" : "Submit for Approval"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="rounded-xl border border-border bg-card p-6 shadow-lift max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-title font-semibold text-destructive flex items-center gap-2">
              <Trash2 size={18} />
              Delete Task
            </AlertDialogTitle>
            <AlertDialogDescription className="text-helper text-muted-foreground mt-2">
              Are you sure you want to delete task <span className="font-semibold text-foreground">"{task.title}"</span>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-5 flex justify-end gap-2">
            <AlertDialogCancel className="rounded-md" disabled={deleteTask.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteTask}
              disabled={deleteTask.isPending}
            >
              {deleteTask.isPending ? "Deleting…" : "Delete Task"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
