import { useState, useEffect, useMemo } from "react";
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
  MoreVertical,
  RotateCcw,
  Pencil,
  X,
  Share2,
  UserCheck,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  CheckCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { validatePhone, sanitizePhone } from "@/lib/validation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  useTask,
  useUpdateTask,
  useDeleteTask,
  useCreateTask,
  useTaskOptions,
  useToggleChecklistItem,
  useAddChecklistItem,
  useDeleteChecklistItem,
  useApproveTask,
  useRejectTask,
  useForwardTask,
  useReassignTask,
  useAddSubItem,
  useToggleSubItem,
  useDeleteSubItem,
  type TaskRecord,
  type ChecklistItem,
  type ChecklistSubItem,
  type CreateTaskPayload,
} from "@/services/tasks";
import { useCases } from "@/services/cases";
import { useClients } from "@/services/clients";
import { useEmployees } from "@/services/admin";
import { useAuth } from "@/lib/auth";
import { formatSafeDateTime, toSafeIso } from "@/lib/dates";
import { openLocalPath } from "@/platform/localPath";
import { DiscardConfirmationDialog } from "@/components/ui/discard-confirmation-dialog";
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
  const { data: taskQueryData } = useTask(task._id, task);
  const activeTask = taskQueryData?.task ?? task;

  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(activeTask.title || "");
  const [description, setDescription] = useState(activeTask.description || "");
  const [category, setCategory] = useState(activeTask.category || "General");
  const [priority, setPriority] = useState(activeTask.priority || "Medium");
  const [deadline, setDeadline] = useState(
    activeTask.deadline ? new Date(activeTask.deadline).toISOString().slice(0, 16) : ""
  );
  const [assignedTo, setAssignedTo] = useState(activeTask.assignedTo?._id || "");
  const [caseId, setCaseId] = useState("");
  const [clientId, setClientId] = useState("");
  const [manualCase, setManualCase] = useState(false);
  const [manualClient, setManualClient] = useState(false);
  const [newChecklistText, setNewChecklistText] = useState("");
  const [liveChecklist, setLiveChecklist] = useState<ChecklistItem[]>(activeTask.checklist ?? []);
  const [editableChecklist, setEditableChecklist] = useState<ChecklistItem[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Broker / Agent state
  const [agentSelect, setAgentSelect] = useState("");
  const [agentCustom, setAgentCustom] = useState("");

  // Call reminder state
  const isCallTask = Boolean(activeTask?.isCall || activeTask?.callReminder);
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

  const availableCategories = useMemo(() => {
    const list = [...(optionsData?.categories ?? [
      "Agreement",
      "Sale Deed / Soc Doc",
      "Gift Deed",
      "Registration",
      "CIDCO Doc",
      "CIDCO Transfer",
      "CIDCO Mortgage",
      "CIDCO Other",
      "Other Documents",
      "Other Work",
      "Court Case",
      "Meeting",
      "Personal",
    ])];
    const required = ["Gift Deed", "Registration"];
    for (const reqCat of required) {
      if (!list.includes(reqCat)) {
        const prevIdx = list.indexOf(reqCat === "Registration" ? "Gift Deed" : "Sale Deed / Soc Doc");
        if (prevIdx !== -1) {
          list.splice(prevIdx + 1, 0, reqCat);
        } else {
          list.push(reqCat);
        }
      }
    }
    if (category && !list.includes(category)) {
      list.push(category);
    }
    return list;
  }, [optionsData?.categories, category]);

  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const createTask = useCreateTask();
  const toggleItem = useToggleChecklistItem();
  const addChecklistItem = useAddChecklistItem();
  const deleteChecklistItem = useDeleteChecklistItem();
  const approveTask = useApproveTask();
  const rejectTask = useRejectTask();
  const forwardTask = useForwardTask();
  const reassignTask = useReassignTask();
  const addSubItem = useAddSubItem();
  const toggleSubItem = useToggleSubItem();
  const deleteSubItem = useDeleteSubItem();

  const [showForwardModal, setShowForwardModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [targetUserId, setTargetUserId] = useState("");
  const [actionNote, setActionNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [newSubItemText, setNewSubItemText] = useState<{ [itemId: string]: string }>({});
  const [expandedItems, setExpandedItems] = useState<{ [itemId: string]: boolean }>({});

  useEffect(() => {
    if (activeTask) {
      setTitle(activeTask.title || "");
      setDescription(activeTask.description || "");
      setCategory(activeTask.category || "General");
      setPriority(activeTask.priority || "Medium");
      setDeadline(activeTask.deadline ? new Date(activeTask.deadline).toISOString().slice(0, 16) : "");
      setAssignedTo(activeTask.assignedTo?._id || "");

      // Handle Agent / Broker initialization
      if (activeTask.agent) {
        if (predefinedAgents.includes(activeTask.agent)) {
          setAgentSelect(activeTask.agent);
          setAgentCustom("");
        } else {
          setAgentSelect("__other__");
          setAgentCustom(activeTask.agent);
        }
      } else {
        setAgentSelect("");
        setAgentCustom("");
      }

      const cr = activeTask.callReminder;
      setCallClientName(cr?.clientName || (activeTask.isCall ? activeTask.title.replace(/^📞\s*CALL:\s*/i, "") : ""));
      setCallPhone(cr?.phone || "");
      const sched = cr?.scheduledAt ? new Date(cr.scheduledAt) : activeTask.deadline ? new Date(activeTask.deadline) : null;
      if (sched && !isNaN(sched.getTime())) {
        const localIso = new Date(sched.getTime() - sched.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        setCallScheduledAt(localIso);
      } else {
        setCallScheduledAt("");
      }
      setCallNotes(cr?.notes || "");
      setCallCompleted(Boolean(cr?.completed || activeTask.status === "completed"));

      const initialCaseId =
        activeTask.caseId && typeof activeTask.caseId === "object"
          ? (activeTask.caseId as any)._id
          : activeTask.caseId || "";
      setCaseId(initialCaseId || "");

      const initialClientId =
        activeTask.clientId && typeof activeTask.clientId === "object"
          ? (activeTask.clientId as any)._id
          : activeTask.clientId || "";
      setClientId(initialClientId || "");

      setManualCase(false);
      setManualClient(false);
      setIsEditing(false);
      setNewChecklistText("");
      setLiveChecklist(activeTask.checklist ?? []);
      setEditableChecklist(
        (activeTask.checklist || []).map((c) => ({
          _id: c._id,
          id: c.id,
          text: c.text,
          done: Boolean(c.done),
          subItems: Array.isArray(c.subItems)
            ? c.subItems.map((s) => ({
                _id: s._id,
                id: s.id,
                text: s.text,
                done: Boolean(s.done),
              }))
            : [],
        }))
      );
      setEditingIndex(null);
      setEditingText("");
    }
  }, [activeTask._id, predefinedAgents]);

  useEffect(() => {
    if (activeTask?.checklist) {
      setLiveChecklist(activeTask.checklist);
    }
  }, [activeTask?.checklist]);

  const caseDisplay =
    activeTask.caseId && typeof activeTask.caseId === "object"
      ? (activeTask.caseId.number ? `${activeTask.caseId.number} — ${activeTask.caseId.title}` : activeTask.caseId.title)
      : activeTask.caseName || null;

  const clientDisplay =
    activeTask.clientId && typeof activeTask.clientId === "object"
      ? activeTask.clientId.name
      : activeTask.clientName || null;

  const checklist: ChecklistItem[] = liveChecklist;
  const total = checklist.length;
  const doneCount = checklist.filter((c) => c.done).length;
  const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  const handleToggle = async (item: ChecklistItem, idx: number) => {
    const targetId = item._id || item.id;
    const nextDone = !item.done;

    // 1. Instant 0ms optimistic UI update
    setLiveChecklist((prev) =>
      prev.map((c, i) => {
        const matches = (targetId && (c._id === targetId || c.id === targetId)) || i === idx;
        if (!matches) return c;
        return {
          ...c,
          done: nextDone,
          subItems: nextDone && Array.isArray(c.subItems)
            ? c.subItems.map((s) => ({ ...s, done: true }))
            : c.subItems,
        };
      })
    );

    try {
      await toggleItem.mutateAsync({
        taskId: activeTask._id,
        itemId: targetId || String(idx),
        done: nextDone,
        text: item.text,
        itemText: item.text,
      });
      if (nextDone && doneCount + 1 === total) {
        toast.success("All checklist items completed!");
      }
    } catch (err) {
      console.error("Failed to toggle checklist item:", err);
      setLiveChecklist(activeTask.checklist ?? []);
      toast.error("Failed to update checklist item");
    }
  };

  const handleMarkAllChecklist = async (allDone: boolean) => {
    if (total === 0) return;
    const updated = checklist.map((c) => ({
      ...c,
      done: allDone,
      subItems: Array.isArray(c.subItems) ? c.subItems.map((s) => ({ ...s, done: allDone })) : [],
    }));

    setLiveChecklist(updated);

    try {
      await updateTask.mutateAsync({
        id: activeTask._id,
        data: {
          checklist: updated.map((c) => ({
            id: c.id || (c._id ? String(c._id) : undefined),
            text: c.text,
            done: c.done,
            subItems: Array.isArray(c.subItems)
              ? c.subItems.map((s) => ({
                  id: s.id || (s._id ? String(s._id) : undefined),
                  text: s.text,
                  done: s.done,
                }))
              : [],
          })),
        },
      });
      toast.success(allDone ? "All checklist items marked as completed!" : "Checklist items marked as pending");
    } catch (err) {
      console.error("Failed to update all checklist items:", err);
      setLiveChecklist(activeTask.checklist ?? []);
      toast.error("Failed to update checklist items");
    }
  };

  const handleAddChecklistItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistText.trim()) return;

    if (isEditing) {
      setEditableChecklist((prev) => [
        ...prev,
        { text: newChecklistText.trim(), done: false, subItems: [] },
      ]);
      setNewChecklistText("");
      return;
    }

    const textToAdd = newChecklistText.trim();
    setNewChecklistText("");
    setLiveChecklist((prev) => [...prev, { text: textToAdd, done: false, subItems: [] }]);

    try {
      await addChecklistItem.mutateAsync({
        taskId: activeTask._id,
        text: textToAdd,
      });
      toast.success("Checklist item added");
    } catch (err) {
      console.error("Failed to add checklist item:", err);
      setLiveChecklist(activeTask.checklist ?? []);
      toast.error("Failed to add checklist item");
    }
  };

  const handleRemoveChecklistItem = async (indexToRemove: number) => {
    if (isEditing) {
      setEditableChecklist((prev) => prev.filter((_, idx) => idx !== indexToRemove));
      return;
    }

    const item = checklist[indexToRemove];
    const itemId = item?._id || item?.id || String(indexToRemove);

    setLiveChecklist((prev) => prev.filter((_, idx) => idx !== indexToRemove));

    try {
      await deleteChecklistItem.mutateAsync({
        taskId: activeTask._id,
        itemId,
      });
      toast.success("Checklist item removed");
    } catch (err) {
      console.error("Failed to remove checklist item:", err);
      setLiveChecklist(activeTask.checklist ?? []);
      toast.error("Failed to remove checklist item");
    }
  };

  const handleSaveInlineChecklistText = async (idx: number) => {
    if (!editingText.trim()) return;
    const item = checklist[idx];
    const itemId = item?._id || item?.id || String(idx);
    const newText = editingText.trim();

    setLiveChecklist((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, text: newText } : c))
    );
    setEditingIndex(null);
    setEditingText("");

    try {
      await toggleItem.mutateAsync({
        taskId: activeTask._id,
        itemId,
        text: newText,
      });
      toast.success("Checklist item updated");
    } catch (err) {
      console.error("Failed to update checklist item:", err);
      setLiveChecklist(activeTask.checklist ?? []);
      toast.error("Failed to update checklist item");
    }
  };

  const handleToggleSubItemClick = async (item: ChecklistItem, sub: ChecklistSubItem, itemIdx: number, subIdx: number) => {
    const parentId = item._id || item.id || String(itemIdx);
    const subId = sub._id || sub.id || String(subIdx);
    const nextDone = !sub.done;

    // Instant optimistic update
    setLiveChecklist((prev) =>
      prev.map((ci, i) => {
        const matchesParent = (item._id && ci._id === item._id) || (item.id && ci.id === item.id) || i === itemIdx;
        if (!matchesParent) return ci;
        const newSubs = (ci.subItems || []).map((si, sI) => {
          const matchesSub = (sub._id && si._id === sub._id) || (sub.id && si.id === sub.id) || sI === subIdx;
          return matchesSub ? { ...si, done: nextDone } : si;
        });
        const allSubsDone = newSubs.length > 0 && newSubs.every((s) => s.done);
        return {
          ...ci,
          done: allSubsDone ? true : ci.done,
          subItems: newSubs,
        };
      })
    );

    try {
      await toggleSubItem.mutateAsync({
        taskId: activeTask._id,
        itemId: parentId,
        subId,
        done: nextDone,
        text: sub.text,
        subText: sub.text,
      });
    } catch (err) {
      console.error("Failed to toggle sub-item:", err);
      setLiveChecklist(activeTask.checklist ?? []);
      toast.error("Failed to toggle sub-item");
    }
  };

  const handleAddSubItemSubmit = async (item: ChecklistItem, itemIdx: number) => {
    const itemId = item._id || item.id || String(itemIdx);
    const text = (newSubItemText[itemId] || "").trim();
    if (!text) return;

    // Optimistic add
    const tempSub: ChecklistSubItem = { id: `temp-${Date.now()}`, text, done: false };
    setLiveChecklist((prev) =>
      prev.map((ci, i) => {
        const matches = (item._id && ci._id === item._id) || (item.id && ci.id === item.id) || i === itemIdx;
        if (!matches) return ci;
        return {
          ...ci,
          subItems: [...(ci.subItems || []), tempSub],
        };
      })
    );
    setNewSubItemText((prev) => ({ ...prev, [itemId]: "" }));

    try {
      await addSubItem.mutateAsync({
        taskId: activeTask._id,
        itemId,
        text,
      });
      toast.success("Sub-item added successfully");
    } catch (err) {
      console.error("Failed to add sub-item:", err);
      setLiveChecklist(activeTask.checklist ?? []);
      toast.error("Failed to add sub-item");
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

      const payload: Partial<CreateTaskPayload> & { checklist?: any[] } = {
        title: title.trim(),
        description: description.trim(),
        category: category.trim(),
        priority,
        caseId: caseId.trim() ? caseId.trim() : null,
        clientId: clientId.trim() ? clientId.trim() : null,
        agent: resolvedAgent,
        checklist: editableChecklist
          .filter((c) => c.text.trim())
          .map((c) => ({
            ...(c._id ? { _id: c._id } : {}),
            id: c.id || (c._id ? String(c._id) : undefined),
            text: c.text.trim(),
            done: Boolean(c.done),
            subItems: Array.isArray(c.subItems)
              ? c.subItems
                  .filter((s) => s.text.trim())
                  .map((s) => ({
                    ...(s._id ? { _id: s._id } : {}),
                    id: s.id || (s._id ? String(s._id) : undefined),
                    text: s.text.trim(),
                    done: Boolean(s.done),
                  }))
              : [],
          })),
      };
      if (deadline) {
        const iso = toSafeIso(deadline);
        if (iso) payload.deadline = iso;
      }
      if (assignedTo) payload.assignedTo = assignedTo;

      if (isCallTask || callClientName.trim()) {
        if (callPhone.trim()) {
          const pCheck = validatePhone(callPhone);
          if (!pCheck.valid) {
            toast.error(pCheck.error ?? "Invalid phone number");
            return;
          }
        }
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
        id: activeTask._id,
        data: payload,
      });
      toast.success("Task details saved successfully");
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to update task details:", err);
      toast.error(err instanceof Error ? err.message : "Failed to update task");
    }
  };

  const handleDeleteTask = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    const rawId = activeTask?._id || (activeTask as any)?.id || task?._id || (task as any)?.id;
    const targetId = typeof rawId === "object" && rawId !== null
      ? ((rawId as any)._id || (rawId as any).id || String(rawId))
      : String(rawId || "");

    console.log("[TaskDetailDialog] handleDeleteTask triggered for target ID:", targetId);
    if (!targetId || targetId === "undefined" || targetId === "null") {
      toast.error("Unable to find task identifier to delete");
      return;
    }
    try {
      const res = await deleteTask.mutateAsync(targetId);
      console.log("[TaskDetailDialog] Delete task response:", res);
      if (res?.alreadyDeleted) {
        toast.info("Task was already deleted or is no longer available.");
      } else {
        toast.success(`Task "${activeTask.title || task.title}" deleted`);
      }
      setShowDeleteConfirm(false);
      onClose();
    } catch (err: any) {
      console.error("[TaskDetailDialog] Failed to delete task:", err);
      if (err?.status === 404 || err?.message?.includes("not found")) {
        toast.info("Task was already deleted or is no longer available.");
        setShowDeleteConfirm(false);
        onClose();
        return;
      }
      toast.error(err instanceof Error ? err.message : "Failed to delete task");
    }
  };

  const handleDuplicateTask = async () => {
    try {
      const duplicatePayload: CreateTaskPayload = {
        title: `${activeTask.title} (Copy)`,
        description: activeTask.description,
        category: activeTask.category,
        priority: activeTask.priority,
        agent: activeTask.agent,
        checklist: (activeTask.checklist || []).map((c) => ({ text: c.text, done: false })),
        caseId: activeTask.caseId && typeof activeTask.caseId === "object" ? (activeTask.caseId as any)._id : activeTask.caseId || null,
        clientId: activeTask.clientId && typeof activeTask.clientId === "object" ? (activeTask.clientId as any)._id : activeTask.clientId || null,
      };
      if (activeTask.deadline) {
        duplicatePayload.deadline = activeTask.deadline;
      }
      if (activeTask.callReminder) {
        duplicatePayload.callReminder = {
          clientName: activeTask.callReminder.clientName,
          phone: activeTask.callReminder.phone,
          scheduledAt: activeTask.callReminder.scheduledAt,
          notes: activeTask.callReminder.notes,
          completed: false,
        };
        duplicatePayload.isCall = activeTask.isCall;
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
        id: activeTask._id,
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

  const canDeleteTask =
    isAdmin ||
    user?.permissions?.tasks !== false ||
    (activeTask.createdBy &&
      (typeof activeTask.createdBy === "object" ? (activeTask.createdBy as any)._id : activeTask.createdBy)?.toString() ===
        user?._id?.toString()) ||
    (activeTask.assignedTo &&
      (typeof activeTask.assignedTo === "object" ? (activeTask.assignedTo as any)._id : activeTask.assignedTo)?.toString() ===
        user?._id?.toString());

  const isCreatorOrAdmin = canDeleteTask;

  const isDirty = useMemo(() => {
    if (!isEditing) return false;
    return (
      title !== (activeTask.title || "") ||
      description !== (activeTask.description || "") ||
      category !== (activeTask.category || "General") ||
      priority !== (activeTask.priority || "Medium") ||
      assignedTo !== (activeTask.assignedTo?._id || "")
    );
  }, [isEditing, title, description, category, priority, assignedTo, activeTask]);

  const handleAttemptClose = () => {
    if (isEditing && isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(val) => {
          if (!val) handleAttemptClose();
        }}
      >
        <DialogContent
          onInteractOutside={(e) => {
            e.preventDefault();
            handleAttemptClose();
          }}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            handleAttemptClose();
          }}
          className="max-h-[92dvh] overflow-y-auto w-[95vw] sm:max-w-xl rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-lift ios-scroll"
        >
          <DialogHeader className="border-b border-border/60 pb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-pill bg-primary/10 px-2.5 py-0.5 text-caption font-semibold text-primary">
                    {activeTask.category || "Task"}
                  </span>
                  <span
                    className={`rounded-pill px-2.5 py-0.5 text-caption font-semibold ${
                      activeTask.priority === "High"
                        ? "bg-destructive/15 text-destructive"
                        : activeTask.priority === "Medium"
                        ? "bg-warning/15 text-warning"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {activeTask.priority || "Medium"}
                  </span>
                  {activeTask.status === "completed" ? (
                    <span className="rounded-pill bg-success/15 text-success px-2.5 py-0.5 text-caption font-semibold flex items-center gap-1">
                      <CheckCircle2 size={12} /> Completed
                    </span>
                  ) : activeTask.status === "pending_approval" ? (
                    <span className="rounded-pill bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2.5 py-0.5 text-caption font-semibold flex items-center gap-1">
                      <Clock size={12} /> Pending Approval
                    </span>
                  ) : activeTask.status === "overdue" ? (
                    <span className="rounded-pill bg-destructive text-destructive-foreground px-2.5 py-0.5 text-caption font-bold">
                      Overdue
                    </span>
                  ) : null}

                  {activeTask.agent && (
                    <span className="rounded-pill bg-secondary/80 px-2.5 py-0.5 text-caption font-medium text-foreground border border-border">
                      Agent: {activeTask.agent}
                    </span>
                  )}
                </div>
                <DialogTitle className="text-title font-semibold text-foreground pt-1">
                  {activeTask.title}
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
                  onClick={() => {
                    if (!isEditing) {
                      setEditableChecklist(
                        (activeTask.checklist || []).map((c) => ({
                          _id: c._id,
                          id: c.id,
                          text: c.text,
                          done: Boolean(c.done),
                          subItems: Array.isArray(c.subItems)
                            ? c.subItems.map((s) => ({
                                _id: s._id,
                                id: s.id,
                                text: s.text,
                                done: Boolean(s.done),
                              }))
                            : [],
                        }))
                      );
                      setEditingIndex(null);
                    }
                    setIsEditing(!isEditing);
                  }}
                  className="rounded-md h-8 text-xs"
                >
                  <Edit2 size={13} className="mr-1.5" />
                  {isEditing ? "View Details" : "Edit"}
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
                          disabled={activeTask.status === "pending"}
                          onClick={() => handleSetStatus("pending")}
                        >
                          Mark as Pending
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-xs"
                          disabled={activeTask.status === "in_progress"}
                          onClick={() => handleSetStatus("in_progress")}
                        >
                          Mark as In Progress
                        </DropdownMenuItem>
                        {isAdmin ? (
                          <DropdownMenuItem
                            className="text-xs font-medium text-emerald-600 dark:text-emerald-400"
                            disabled={activeTask.status === "completed"}
                            onClick={() => handleSetStatus("completed")}
                          >
                            Approve & Complete
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            className="text-xs font-medium text-amber-600 dark:text-amber-400"
                            disabled={activeTask.status === "pending_approval" || activeTask.status === "completed"}
                            onClick={() => handleSetStatus("pending_approval")}
                          >
                            Submit for Approval
                          </DropdownMenuItem>
                        )}
                        {isAdmin && activeTask.status === "pending_approval" && (
                          <DropdownMenuItem
                            className="text-xs text-amber-600 dark:text-amber-400"
                            onClick={() => handleSetStatus("in_progress")}
                          >
                            Request Changes
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuItem className="text-xs" onClick={() => setShowForwardModal(true)}>
                      <Share2 size={14} className="mr-2" />
                      Forward Task
                    </DropdownMenuItem>

                    <DropdownMenuItem className="text-xs" onClick={() => setShowReassignModal(true)}>
                      <UserCheck size={14} className="mr-2" />
                      Reassign Task
                    </DropdownMenuItem>

                    <DropdownMenuItem className="text-xs" onClick={handleDuplicateTask}>
                      <Copy size={14} className="mr-2" />
                      Duplicate Task
                    </DropdownMenuItem>

                    {isCreatorOrAdmin && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-xs text-destructive focus:text-destructive"
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to permanently delete task "${activeTask.title || task.title}"? This action cannot be undone.`)) {
                              handleDeleteTask();
                            }
                          }}
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
          {activeTask.status === "pending_approval" && (
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

          {activeTask.status === "completed" && (
            <div className="mt-4 rounded-lg border border-success/30 bg-success/10 p-3.5 flex items-center gap-2.5">
              <CheckCircle2 size={18} className="shrink-0 text-success" />
              <div>
                <p className="text-helper font-semibold text-foreground">Task Completed</p>
                <p className="text-caption text-muted-foreground">Work and checklist items have been completed and verified.</p>
              </div>
            </div>
          )}

          {activeTask.status !== "completed" && activeTask.status !== "pending_approval" && total > 0 && doneCount === total && (
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
                  <select
                    id="task-cat"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-helper text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Select category…</option>
                    {availableCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
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
                  onClick={() => {
                    setEditableChecklist(
                      (activeTask.checklist || []).map((c) => ({
                        _id: c._id,
                        id: c.id,
                        text: c.text,
                        done: Boolean(c.done),
                        subItems: Array.isArray(c.subItems)
                          ? c.subItems.map((s) => ({
                              _id: s._id,
                              id: s.id,
                              text: s.text,
                              done: Boolean(s.done),
                            }))
                          : [],
                      }))
                    );
                    setIsEditing(false);
                  }}
                  className="rounded-md"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="gradient-primary rounded-md text-primary-foreground font-semibold shadow-soft"
                  onClick={handleSaveDetails}
                  disabled={updateTask.isPending}
                >
                  {updateTask.isPending ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Check size={14} className="mr-1.5" />}
                  Save Changes
                </Button>
              </div>
            </div>
          ) : (
            /* View Details */
            <div className="mt-4 space-y-4">
              {activeTask.description && (
                <div className="rounded-md bg-muted/50 p-3 text-helper text-foreground/90 whitespace-pre-wrap">
                  {activeTask.description}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2 text-helper">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User size={15} />
                  <span>Assignee: <strong className="text-foreground">{activeTask.assignedTo?.name || "Unassigned"}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar size={15} />
                  <span>
                    Deadline:{" "}
                    <strong className="text-foreground">
                      {formatSafeDateTime(activeTask.deadline, "No deadline")}
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
                {activeTask.agent && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Tag size={15} />
                    <span>
                      Agent / Broker:{" "}
                      <strong className="text-foreground">{activeTask.agent}</strong>
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User size={15} />
                  <span>
                    Created By:{" "}
                    <strong className="text-foreground">
                      {typeof activeTask.createdBy === "object" ? activeTask.createdBy?.name : "System"}
                    </strong>
                  </span>
                </div>
                {activeTask.assignedBy && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <UserCheck size={15} />
                    <span>
                      Assigned By:{" "}
                      <strong className="text-foreground">
                        {typeof activeTask.assignedBy === "object" ? activeTask.assignedBy?.name : "Admin"}
                      </strong>
                    </span>
                  </div>
                )}
                {activeTask.startedAt && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock size={15} />
                    <span>Started: <strong className="text-foreground">{formatSafeDateTime(activeTask.startedAt)}</strong></span>
                  </div>
                )}
                {activeTask.completedAt && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 size={15} className="text-success" />
                    <span>Completed: <strong className="text-foreground">{formatSafeDateTime(activeTask.completedAt)}</strong></span>
                  </div>
                )}
                {activeTask.submittedForApprovalAt && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock size={15} className="text-amber-500" />
                    <span>Submitted for Review: <strong className="text-foreground">{formatSafeDateTime(activeTask.submittedForApprovalAt)}</strong></span>
                  </div>
                )}
                {activeTask.approvedAt && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Check size={15} className="text-emerald-500" />
                    <span>Approved: <strong className="text-foreground">{formatSafeDateTime(activeTask.approvedAt)}</strong></span>
                  </div>
                )}
              </div>

              {/* Local Folder / File Path */}
              {activeTask.localPath && (
                <div className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/40 p-3 text-xs">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Local Task Folder</p>
                    <p className="font-mono text-xs text-foreground truncate mt-0.5">{activeTask.localPath}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs rounded-md shrink-0 ml-2"
                    onClick={() => openLocalPath(activeTask.localPath!)}
                  >
                    <FolderOpen size={13} className="mr-1" /> Open Path
                  </Button>
                </div>
              )}

              {/* Assignment Audit History */}
              {activeTask.assignmentHistory && activeTask.assignmentHistory.length > 0 && (
                <div className="rounded-lg border border-border/70 bg-card p-3.5 space-y-2">
                  <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <UserCheck size={13} /> Assignment History & Audit Trail
                  </h5>
                  <div className="divide-y divide-border/50 max-h-36 overflow-y-auto pr-1">
                    {activeTask.assignmentHistory.slice().reverse().map((h, i) => (
                      <div key={i} className="py-2 first:pt-1 text-xs">
                        <p className="font-medium text-foreground">
                          {h.action ? h.action.toUpperCase() : "ASSIGNED"}: {typeof h.fromUser === "object" ? h.fromUser?.name : "—"} → {typeof h.toUser === "object" ? h.toUser?.name : "—"}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          By {typeof h.assignedBy === "object" ? h.assignedBy?.name : "Admin"} • {formatSafeDateTime(h.timestamp)}
                        </p>
                        {h.note && <p className="text-[11px] text-muted-foreground italic mt-0.5">"{h.note}"</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dedicated Call Reminder Card */}
              {(activeTask.isCall || activeTask.callReminder) && (
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
                          {formatSafeDateTime(activeTask.callReminder?.scheduledAt, "No scheduled time")}
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
                      <span>Contact: <strong className="text-foreground">{activeTask.callReminder?.clientName || activeTask.title}</strong></span>
                    </div>
                    {activeTask.callReminder?.phone && (
                      <div className="flex items-center justify-between rounded border border-border/60 bg-card px-2.5 py-1">
                        <span className="font-mono text-xs font-medium text-foreground">{activeTask.callReminder.phone}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(activeTask.callReminder!.phone);
                              toast.success("Phone number copied to clipboard");
                            }}
                            className="rounded p-1 text-muted-foreground hover:text-foreground"
                            title="Copy phone"
                          >
                            <Copy size={12} />
                          </button>
                          <a
                            href={`tel:${activeTask.callReminder.phone}`}
                            className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                          >
                            Call
                          </a>
                        </div>
                      </div>
                    )}
                  </div>

                  {activeTask.callReminder?.notes && (
                    <p className="mt-2.5 rounded border border-border/50 bg-background/60 p-2.5 text-xs text-foreground/90 italic">
                      &ldquo;{activeTask.callReminder.notes}&rdquo;
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
                {isEditing ? (
                  <span className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    Editing Mode ({editableChecklist.length} {editableChecklist.length === 1 ? "item" : "items"})
                  </span>
                ) : (
                  <span className="text-caption font-normal text-muted-foreground">
                    ({doneCount} of {total} completed)
                  </span>
                )}
              </h4>
              {!isEditing && total > 0 && (
                <div className="flex items-center gap-2">
                  {doneCount < total ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkAllChecklist(true)}
                      disabled={updateTask.isPending}
                      className="h-7 px-2 text-xs text-primary hover:bg-primary/10 font-medium rounded-md"
                      title="Mark all checklist items as completed in one click"
                    >
                      <CheckCheck size={14} className="mr-1" /> Mark All Done
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkAllChecklist(false)}
                      disabled={updateTask.isPending}
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground font-medium rounded-md"
                      title="Reset all checklist items"
                    >
                      <RotateCcw size={12} className="mr-1" /> Reset All
                    </Button>
                  )}
                  <span className="text-caption font-semibold text-primary min-w-[32px] text-right">{pct}%</span>
                </div>
              )}
            </div>

            {!isEditing && <Progress value={pct} className="h-1.5 mb-3" />}

            {/* Scrollable list of items */}
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {isEditing ? (
                /* Editable list in Task Edit mode */
                editableChecklist.length === 0 ? (
                  <p className="py-4 text-center text-helper text-muted-foreground">No checklist items yet. Add one below.</p>
                ) : (
                  editableChecklist.map((item, idx) => (
                    <div
                      key={item._id || item.id || idx}
                      className="rounded-lg p-2.5 bg-muted/40 border border-border/70 space-y-2 focus-within:border-primary/60 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditableChecklist((prev) =>
                              prev.map((c, i) => (i === idx ? { ...c, done: !c.done } : c))
                            );
                          }}
                          className="shrink-0 p-1 text-muted-foreground hover:text-foreground"
                          title={item.done ? "Mark incomplete" : "Mark complete"}
                        >
                          {item.done ? (
                            <CheckCircle2 size={17} className="text-success" />
                          ) : (
                            <Circle size={17} className="text-muted-foreground" />
                          )}
                        </button>
                        <Input
                          value={item.text}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditableChecklist((prev) =>
                              prev.map((c, i) => (i === idx ? { ...c, text: val } : c))
                            );
                          }}
                          placeholder="Checklist step description…"
                          className="h-8 text-helper rounded bg-background flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveChecklistItem(idx)}
                          className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                          title="Remove checklist item"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>

                      {/* Sub-items in Edit Mode */}
                      <div className="ml-6 pl-2.5 border-l-2 border-border/60 space-y-1.5">
                        {item.subItems?.map((sub, sIdx) => (
                          <div key={sub._id || sub.id || sIdx} className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditableChecklist((prev) =>
                                  prev.map((c, i) =>
                                    i === idx
                                      ? {
                                          ...c,
                                          subItems: c.subItems?.map((s, si) =>
                                            si === sIdx ? { ...s, done: !s.done } : s
                                          ),
                                        }
                                      : c
                                  )
                                );
                              }}
                              className="shrink-0 p-1 text-muted-foreground hover:text-foreground"
                            >
                              {sub.done ? (
                                <CheckCircle2 size={14} className="text-success" />
                              ) : (
                                <Circle size={14} className="text-muted-foreground" />
                              )}
                            </button>
                            <Input
                              value={sub.text}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditableChecklist((prev) =>
                                  prev.map((c, i) =>
                                    i === idx
                                      ? {
                                          ...c,
                                          subItems: c.subItems?.map((s, si) =>
                                            si === sIdx ? { ...s, text: val } : s
                                          ),
                                        }
                                      : c
                                  )
                                );
                              }}
                              placeholder="Sub-item step..."
                              className="h-7 text-xs rounded bg-background flex-1"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditableChecklist((prev) =>
                                  prev.map((c, i) =>
                                    i === idx
                                      ? { ...c, subItems: c.subItems?.filter((_, si) => si !== sIdx) }
                                      : c
                                  )
                                );
                              }}
                              className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                              title="Remove sub-item"
                            >
                              <X size={12} />
                            </Button>
                          </div>
                        ))}

                        {/* Add sub-item in edit mode */}
                        <div className="flex items-center gap-1.5 pt-1">
                          <Input
                            value={newSubItemText[item._id || item.id || String(idx)] || ""}
                            onChange={(e) =>
                              setNewSubItemText((prev) => ({
                                ...prev,
                                [item._id || item.id || String(idx)]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const text = (newSubItemText[item._id || item.id || String(idx)] || "").trim();
                                if (!text) return;
                                setEditableChecklist((prev) =>
                                  prev.map((c, i) =>
                                    i === idx
                                      ? {
                                          ...c,
                                          subItems: [...(c.subItems || []), { text, done: false }],
                                        }
                                      : c
                                  )
                                );
                                setNewSubItemText((prev) => ({ ...prev, [item._id || item.id || String(idx)]: "" }));
                              }
                            }}
                            placeholder="Add sub-item step..."
                            className="h-7 text-xs rounded bg-background flex-1"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-7 px-2.5 text-xs shrink-0"
                            disabled={!(newSubItemText[item._id || item.id || String(idx)] || "").trim()}
                            onClick={() => {
                              const text = (newSubItemText[item._id || item.id || String(idx)] || "").trim();
                              if (!text) return;
                              setEditableChecklist((prev) =>
                                prev.map((c, i) =>
                                  i === idx
                                    ? {
                                        ...c,
                                        subItems: [...(c.subItems || []), { text, done: false }],
                                      }
                                    : c
                                )
                              );
                              setNewSubItemText((prev) => ({ ...prev, [item._id || item.id || String(idx)]: "" }));
                            }}
                          >
                            <Plus size={12} className="mr-1" /> Add
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )
              ) : (
                /* View list with inline editing capability */
                checklist.length === 0 ? (
                  <p className="py-4 text-center text-helper text-muted-foreground">No checklist items yet.</p>
                ) : (
                  checklist.map((item, idx) => (
                  <div key={item._id || item.id || idx} className="space-y-1">
                    <div
                      className="group flex items-center justify-between gap-2 rounded-md p-2 hover:bg-muted/60 transition-colors"
                    >
                      {editingIndex === idx ? (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleSaveInlineChecklistText(idx);
                              } else if (e.key === "Escape") {
                                setEditingIndex(null);
                              }
                            }}
                            autoFocus
                            className="h-8 text-helper rounded bg-background flex-1"
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => handleSaveInlineChecklistText(idx)}
                            disabled={!editingText.trim() || updateTask.isPending}
                            className="size-8 text-success hover:bg-success/10 shrink-0"
                            title="Save"
                          >
                            <Check size={14} />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => setEditingIndex(null)}
                            className="size-8 text-muted-foreground hover:text-foreground shrink-0"
                            title="Cancel"
                          >
                            <X size={14} />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleToggle(item, idx)}
                            className="flex min-w-0 flex-1 items-center gap-2.5 text-left text-helper py-0.5 cursor-pointer"
                          >
                            {item.done ? (
                              <CheckCircle2 size={17} className="shrink-0 text-success transition-transform active:scale-95" />
                            ) : (
                              <Circle size={17} className="shrink-0 text-muted-foreground group-hover:text-foreground transition-transform active:scale-95" />
                            )}
                            <span className={`truncate ${item.done ? "text-muted-foreground line-through" : "text-foreground font-medium"}`}>
                              {item.text}
                            </span>
                          </button>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingIndex(idx);
                                setEditingText(item.text);
                              }}
                              className="p-1 text-muted-foreground hover:text-foreground rounded"
                              aria-label="Edit item text"
                              title="Edit item"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const key = item._id || item.id || String(idx);
                                setExpandedItems((prev) => ({
                                  ...prev,
                                  [key]: !prev[key],
                                }));
                              }}
                              className="p-1 text-muted-foreground hover:text-primary rounded"
                              aria-label="Add or view sub-tasks"
                              title="Sub-tasks"
                            >
                              <Plus size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveChecklistItem(idx)}
                              className="p-1 text-muted-foreground hover:text-destructive rounded"
                              aria-label="Remove item"
                              title="Remove item"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Nested Sub-Items in View Mode */}
                    {(Boolean(item.subItems?.length) || expandedItems[item._id || item.id || String(idx)]) && (
                      <div className="ml-6 pl-2.5 border-l-2 border-primary/25 space-y-2 my-2 py-1">
                        {item.subItems && item.subItems.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Sub-items ({item.subItems.filter((s) => s.done).length}/{item.subItems.length})
                            </span>
                            {item.subItems.map((sub, sIdx) => (
                              <div
                                key={sub._id || sub.id || sIdx}
                                className="group/sub flex items-center justify-between gap-2 text-xs py-1.5 px-2 rounded-md hover:bg-muted/50 border border-transparent hover:border-border/60 transition-colors"
                              >
                                <button
                                  type="button"
                                  onClick={() => handleToggleSubItemClick(item, sub, idx, sIdx)}
                                  className="flex items-center gap-2 text-left min-w-0 flex-1 cursor-pointer"
                                >
                                  {sub.done ? (
                                    <CheckCircle2 size={15} className="text-success shrink-0" />
                                  ) : (
                                    <Circle size={15} className="text-muted-foreground group-hover/sub:text-foreground shrink-0" />
                                  )}
                                  <span className={`truncate ${sub.done ? "line-through text-muted-foreground" : "text-foreground font-medium"}`}>
                                    {sub.text}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const subId = sub._id || sub.id || String(sIdx);
                                    try {
                                      setLiveChecklist((prev) =>
                                        prev.map((ci, cIdx) =>
                                          cIdx === idx
                                            ? { ...ci, subItems: ci.subItems?.filter((_, i) => i !== sIdx) }
                                            : ci
                                        )
                                      );
                                      await deleteSubItem.mutateAsync({
                                        taskId: activeTask._id,
                                        itemId: item._id || item.id || String(idx),
                                        subId,
                                      });
                                      toast.success("Sub-item removed");
                                    } catch {
                                      setLiveChecklist(activeTask.checklist ?? []);
                                      toast.error("Failed to remove sub-item");
                                    }
                                  }}
                                  className="opacity-0 group-hover/sub:opacity-100 p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-all"
                                  title="Remove sub-item"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add Sub-Item Inline Form with Prominent Button */}
                        <div className="flex items-center gap-1.5 pt-1">
                          <Input
                            value={newSubItemText[item._id || item.id || String(idx)] || ""}
                            onChange={(e) =>
                              setNewSubItemText((prev) => ({
                                ...prev,
                                [item._id || item.id || String(idx)]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddSubItemSubmit(item, idx);
                              }
                            }}
                            placeholder="Add sub-item checklist step..."
                            className="h-8 text-xs rounded bg-background flex-1"
                          />
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 px-3 text-xs gradient-primary text-primary-foreground font-medium rounded-md shadow-soft shrink-0"
                            disabled={!(newSubItemText[item._id || item.id || String(idx)] || "").trim() || addSubItem.isPending}
                            onClick={() => handleAddSubItemSubmit(item, idx)}
                          >
                            <Plus size={13} className="mr-1" /> Add Sub-item
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  ))
                )
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
                className="h-9 shrink-0 rounded-md font-medium"
                disabled={!newChecklistText.trim() || addChecklistItem.isPending}
              >
                <Plus size={14} className="mr-1" /> Add
              </Button>
            </form>

            {/* In Edit mode, show convenient Save All Changes bar below the checklist */}
            {isEditing && (
              <div className="mt-4 flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-3">
                <span className="text-xs text-muted-foreground font-medium">
                  Ready with task details &amp; checklist?
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (isDirty) {
                        setShowDiscardConfirm(true);
                      } else {
                        setIsEditing(false);
                      }
                    }}
                    className="rounded-md h-8 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="gradient-primary rounded-md text-primary-foreground h-8 text-xs font-semibold shadow-soft"
                    onClick={handleSaveDetails}
                    disabled={updateTask.isPending}
                  >
                    {updateTask.isPending ? <Loader2 size={13} className="animate-spin mr-1.5" /> : <Check size={13} className="mr-1.5" />}
                    Save Changes
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-6 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-border/60 pt-4">
            <div>
              {isCreatorOrAdmin ? (
                showDeleteConfirm ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs animate-in fade-in">
                    <span className="font-semibold text-destructive flex items-center gap-1">
                      <AlertTriangle size={13} className="shrink-0" />
                      Delete permanently?
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className="h-7 px-3 text-xs font-semibold rounded-md shadow-sm"
                      disabled={deleteTask.isPending}
                      onClick={handleDeleteTask}
                    >
                      {deleteTask.isPending ? (
                        <Loader2 size={12} className="animate-spin mr-1" />
                      ) : (
                        <Trash2 size={12} className="mr-1" />
                      )}
                      {deleteTask.isPending ? "Deleting…" : "Confirm Delete"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs rounded-md"
                      disabled={deleteTask.isPending}
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
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
                )
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {isEditing ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (isDirty) {
                        setShowDiscardConfirm(true);
                      } else {
                        setIsEditing(false);
                      }
                    }}
                    className="rounded-md"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="gradient-primary rounded-md text-primary-foreground font-semibold shadow-soft"
                    disabled={updateTask.isPending}
                    onClick={handleSaveDetails}
                  >
                    {updateTask.isPending ? (
                      <Loader2 size={14} className="animate-spin mr-1.5" />
                    ) : (
                      <Check size={14} className="mr-1.5" />
                    )}
                    Save Changes
                  </Button>
                </>
              ) : (
                <>
                  <Button type="button" variant="outline" size="sm" onClick={onClose} className="rounded-md">
                    Close
                  </Button>

                  {/* Single Contextual Action Button */}
                  {activeTask.status === "pending_approval" ? (
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
                          className="gradient-primary rounded-md text-primary-foreground font-semibold shadow-soft"
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
                  ) : activeTask.status === "completed" ? (
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
                      className="gradient-primary rounded-md text-primary-foreground font-semibold shadow-soft"
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
                </>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Forward Task Dialog */}
      <Dialog open={showForwardModal} onOpenChange={setShowForwardModal}>
        <DialogContent className="rounded-xl border border-border bg-card p-6 shadow-lift max-w-md">
          <DialogHeader>
            <DialogTitle className="text-title font-semibold text-foreground flex items-center gap-2">
              <Share2 size={18} /> Forward Task
            </DialogTitle>
            <DialogDescription className="text-helper text-muted-foreground mt-1">
              Forward task "{task.title}" to a team member.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!targetUserId) {
                toast.error("Please select an employee");
                return;
              }
              try {
                await forwardTask.mutateAsync({
                  taskId: task._id,
                  toUserId: targetUserId,
                  note: actionNote.trim() || undefined,
                });
                toast.success("Task forwarded successfully");
                setShowForwardModal(false);
                setTargetUserId("");
                setActionNote("");
              } catch (err: any) {
                toast.error(err?.response?.data?.message || "Failed to forward task");
              }
            }}
            className="mt-4 space-y-4"
          >
            <div className="space-y-1.5">
              <Label className="text-helper">Forward To</Label>
              <select
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-helper"
                required
              >
                <option value="">Select team member...</option>
                {employees.map((emp) => (
                  <option key={emp._id} value={emp._id}>
                    {emp.name} ({emp.title || emp.role})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-helper">Note / Reason (Optional)</Label>
              <Input
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder="Reason for forwarding..."
                className="h-10 rounded-md"
              />
            </div>
            <DialogFooter className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowForwardModal(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="gradient-primary text-primary-foreground"
                disabled={forwardTask.isPending}
              >
                {forwardTask.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : <Share2 size={14} className="mr-1" />}
                Forward Task
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reassign Task Dialog */}
      <Dialog open={showReassignModal} onOpenChange={setShowReassignModal}>
        <DialogContent className="rounded-xl border border-border bg-card p-6 shadow-lift max-w-md">
          <DialogHeader>
            <DialogTitle className="text-title font-semibold text-foreground flex items-center gap-2">
              <UserCheck size={18} /> Reassign Task
            </DialogTitle>
            <DialogDescription className="text-helper text-muted-foreground mt-1">
              Reassign task "{task.title}" to another employee.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!targetUserId) {
                toast.error("Please select an employee");
                return;
              }
              try {
                await reassignTask.mutateAsync({
                  taskId: task._id,
                  toUserId: targetUserId,
                  note: actionNote.trim() || undefined,
                });
                toast.success("Task reassigned successfully");
                setShowReassignModal(false);
                setTargetUserId("");
                setActionNote("");
              } catch (err: any) {
                toast.error(err?.response?.data?.message || "Failed to reassign task");
              }
            }}
            className="mt-4 space-y-4"
          >
            <div className="space-y-1.5">
              <Label className="text-helper">New Assignee</Label>
              <select
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-helper"
                required
              >
                <option value="">Select team member...</option>
                {employees.map((emp) => (
                  <option key={emp._id} value={emp._id}>
                    {emp.name} ({emp.title || emp.role})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-helper">Reassignment Note (Optional)</Label>
              <Input
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder="Reason or instructions..."
                className="h-10 rounded-md"
              />
            </div>
            <DialogFooter className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowReassignModal(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="gradient-primary text-primary-foreground"
                disabled={reassignTask.isPending}
              >
                {reassignTask.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : <UserCheck size={14} className="mr-1" />}
                Reassign Task
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reject Task / Request Changes Dialog */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent className="rounded-xl border border-border bg-card p-6 shadow-lift max-w-md">
          <DialogHeader>
            <DialogTitle className="text-title font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-2">
              <Clock size={18} /> Request Changes
            </DialogTitle>
            <DialogDescription className="text-helper text-muted-foreground mt-1">
              Send task "{task.title}" back to the assignee with feedback.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await rejectTask.mutateAsync({
                  taskId: task._id,
                  reason: rejectReason.trim() || undefined,
                });
                toast.success("Changes requested. Task returned to assignee.");
                setShowRejectModal(false);
                setRejectReason("");
              } catch (err: any) {
                toast.error(err?.response?.data?.message || "Failed to request changes");
              }
            }}
            className="mt-4 space-y-4"
          >
            <div className="space-y-1.5">
              <Label className="text-helper">Feedback / Change Notes</Label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="What needs to be updated before approval..."
                rows={3}
                className="w-full rounded-md border border-border bg-background p-2.5 text-xs text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <DialogFooter className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowRejectModal(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white"
                disabled={rejectTask.isPending}
              >
                {rejectTask.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : <Clock size={14} className="mr-1" />}
                Send Feedback
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Discard Confirmation Dialog */}
      <DiscardConfirmationDialog
        open={showDiscardConfirm}
        onOpenChange={setShowDiscardConfirm}
        onConfirmDiscard={() => {
          setShowDiscardConfirm(false);
          setIsEditing(false);
          onClose();
        }}
      />
    </>
  );
}
