import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { useSocketEvent } from "@/lib/socket";
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
  useRequestTaskAssignment,
  useRequestTaskDeletion,
  useAddTaskRemark,
  useAddSubItem,
  useToggleSubItem,
  useDeleteSubItem,
  useTaskAuditLogs,
  taskKeys,
  type TaskRecord,
  type ChecklistItem,
  type ChecklistSubItem,
  type CreateTaskPayload,
} from "@/services/tasks";
import { useCategoryTree } from "@/services/categories";
import { useCases } from "@/services/cases";
import { useClients } from "@/services/clients";
import { useEmployees } from "@/services/admin";
import { useAuth } from "@/lib/auth";
import { toSafeIso, formatReadableDate } from "@/lib/dates";
import { DiscardConfirmationDialog } from "@/components/ui/discard-confirmation-dialog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AssigneeMultiSelect } from "@/components/common/AssigneeMultiSelect";

// Icons
import {
  CheckSquare,
  X,
  Trash2,
  CheckCircle2,
  Calendar,
  Clock,
  User,
  FolderOpen,
  FileText,
  AlertCircle,
  Plus,
  ChevronRight,
  ChevronDown,
  Loader2,
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Link as LinkIcon,
  Send,
  PhoneCall,
  History,
  MessageSquare,
  Check,
} from "lucide-react";

// Decomposed Subcomponents
import { TaskDocumentsSection } from "./detail/TaskDocumentsSection";
import { TaskCompletionDialog } from "./detail/TaskCompletionDialog";
import { TaskCallReminderCard } from "./detail/TaskCallReminderCard";
import { TaskHistorySection } from "./detail/TaskHistorySection";
import { TaskRemarksThread } from "./detail/TaskRemarksThread";
import { TaskSubModals } from "./detail/TaskSubModals";

interface TaskDetailDialogProps {
  open: boolean;
  onClose: () => void;
  task: TaskRecord | null;
}

export function TaskDetailDialog({ open, onClose, task }: TaskDetailDialogProps) {
  if (!open || !task) return null;
  return <TaskDetailDialogInner key={task._id} open={open} onClose={onClose} task={task} />;
}

function TaskDetailDialogInner({
  open,
  onClose,
  task,
}: {
  open: boolean;
  onClose: () => void;
  task: TaskRecord;
}) {
  const queryClient = useQueryClient();
  const { data: taskQueryData } = useTask(task._id, task);
  const activeTask = taskQueryData?.task ?? task;

  // Real-time synchronization
  useSocketEvent<{ task?: TaskRecord; taskId?: string }>("task:updated", (payload) => {
    if (payload?.taskId === activeTask._id || payload?.task?._id === activeTask._id) {
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(activeTask._id) });
      queryClient.invalidateQueries({ queryKey: ["task-audit-logs", activeTask._id] });
    }
  });

  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // Data fetching
  const { data: empData } = useEmployees(undefined, { enabled: isAdmin });
  const employees = empData?.employees ?? [];
  const { data: casesData } = useCases({ limit: "100" });
  const { data: clientsData } = useClients({ limit: "100" });
  const cases = casesData?.cases ?? [];
  const clients = clientsData?.clients ?? [];
  const { data: categoryTree = [] } = useCategoryTree();
  const { data: optionsData } = useTaskOptions();
  const predefinedAgents = optionsData?.agents ?? [];

  const allStaffMembers = useMemo(() => {
    const map = new Map<string, { _id: string; name: string; email?: string }>();
    if (Array.isArray(optionsData?.staff)) {
      for (const s of optionsData.staff) {
        if (s?._id) map.set(s._id, s);
      }
    }
    if (Array.isArray(employees)) {
      for (const e of employees) {
        if (e?._id) map.set(e._id, { ...map.get(e._id), ...e });
      }
    }
    return Array.from(map.values());
  }, [optionsData?.staff, employees]);

  // Form State
  const [title, setTitle] = useState(activeTask.title || "");
  const [description, setDescription] = useState(activeTask.description || "");
  const [notes, setNotes] = useState(activeTask.notes || "");
  const [mainCategory, setMainCategory] = useState(activeTask.mainCategory || "");
  const [subCategory, setSubCategory] = useState(activeTask.subCategory || "");
  const [customCategory, setCustomCategory] = useState(activeTask.customCategory || "");
  const [priority, setPriority] = useState<"High" | "Medium" | "Low">(
    (activeTask.priority as "High" | "Medium" | "Low") || "Medium"
  );

  // Deadline split into date and time
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("");

  const initialAssigned = useMemo(() => {
    if (activeTask.assignedUsers && activeTask.assignedUsers.length > 0) {
      return activeTask.assignedUsers.map((u) => u._id);
    }
    return activeTask.assignedTo?._id ? [activeTask.assignedTo._id] : [];
  }, [activeTask.assignedUsers, activeTask.assignedTo]);

  const [assignedTo, setAssignedTo] = useState<string[]>(initialAssigned);
  const [caseId, setCaseId] = useState("");
  const [clientId, setClientId] = useState("");

  // Checklist state
  const [liveChecklist, setLiveChecklist] = useState<ChecklistItem[]>(activeTask.checklist ?? []);
  const [newChecklistText, setNewChecklistText] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [expandedItems, setExpandedItems] = useState<{ [itemId: string]: boolean }>({});
  const [newSubItemText, setNewSubItemText] = useState<{ [itemId: string]: string }>({});

  // Submodals and confirmations
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showRequestDeleteModal, setShowRequestDeleteModal] = useState(false);
  const [showAdminDeleteModal, setShowAdminDeleteModal] = useState(false);
  const [targetUserId, setTargetUserId] = useState("");
  const [actionNote, setActionNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [deleteRequestReason, setDeleteRequestReason] = useState("");
  const [newRemarkText, setNewRemarkText] = useState("");
  const [auditTab, setAuditTab] = useState<"assignment" | "edits">("assignment");

  // Call reminder state
  const [callCompleted, setCallCompleted] = useState(
    Boolean(activeTask.callReminder?.completed || activeTask.status === "completed")
  );
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleDateTime, setRescheduleDateTime] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("Person did not pick up call");
  const [isRescheduling, setIsRescheduling] = useState(false);

  // Mutations
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
  const requestTaskAssignment = useRequestTaskAssignment();
  const requestTaskDeletion = useRequestTaskDeletion();
  const addTaskRemark = useAddTaskRemark();
  const addSubItem = useAddSubItem();
  const toggleSubItem = useToggleSubItem();
  const deleteSubItem = useDeleteSubItem();

  const { data: auditLogsData, isLoading: isLoadingAuditLogs } = useTaskAuditLogs(activeTask._id);
  const auditLogs = auditLogsData?.logs ?? [];

  // Subcategory choices
  const selectedParent = categoryTree.find((c) => c.name === mainCategory);
  const availableSubCategories = selectedParent?.children ?? [];

  // Description textarea ref for formatting actions
  const descTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Apply rich-text markdown toolbar wrapping to description
  const applyTextFormat = (wrapperStart: string, wrapperEnd: string = wrapperStart) => {
    const textarea = descTextareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = description.substring(start, end);
    const before = description.substring(0, start);
    const after = description.substring(end);
    const replacement = `${wrapperStart}${selected || "text"}${wrapperEnd}`;
    setDescription(before + replacement + after);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + wrapperStart.length,
        end + wrapperStart.length
      );
    }, 0);
  };

  // Synchronize initial task values
  useEffect(() => {
    if (activeTask) {
      setTitle(activeTask.title || "");
      setDescription(activeTask.description || "");
      setNotes(activeTask.notes || "");
      setMainCategory(activeTask.mainCategory || "");
      setSubCategory(activeTask.subCategory || "");
      setCustomCategory(activeTask.customCategory || "");
      setPriority(
        (activeTask.priority as "High" | "Medium" | "Low") || "Medium"
      );

      const freshAssigned =
        activeTask.assignedUsers && activeTask.assignedUsers.length > 0
          ? activeTask.assignedUsers.map((u) => u._id)
          : activeTask.assignedTo?._id
          ? [activeTask.assignedTo._id]
          : [];
      setAssignedTo(freshAssigned);

      if (activeTask.deadline) {
        try {
          const d = new Date(activeTask.deadline);
          if (!isNaN(d.getTime())) {
            setDeadlineDate(d.toISOString().slice(0, 10));
            setDeadlineTime(
              `${String(d.getHours()).padStart(2, "0")}:${String(
                d.getMinutes()
              ).padStart(2, "0")}`
            );
          }
        } catch {
          setDeadlineDate("");
          setDeadlineTime("");
        }
      } else {
        setDeadlineDate("");
        setDeadlineTime("");
      }

      const initialCaseId =
        activeTask.caseId && typeof activeTask.caseId === "object"
          ? (activeTask.caseId as { _id?: string })._id
          : activeTask.caseId || "";
      setCaseId(initialCaseId || "");

      const initialClientId =
        activeTask.clientId && typeof activeTask.clientId === "object"
          ? (activeTask.clientId as { _id?: string })._id
          : activeTask.clientId || "";
      setClientId(initialClientId || "");

      setLiveChecklist(activeTask.checklist ?? []);
      setCallCompleted(
        Boolean(activeTask.callReminder?.completed || activeTask.status === "completed")
      );
    }
  }, [activeTask]);

  // Derived progress calculations
  const checklist = liveChecklist;
  const total = checklist.length;
  const doneCount = checklist.filter((c) => c.done).length;
  const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  // Track if changes are dirty
  const isDirty = useMemo(() => {
    const origAssigned =
      activeTask.assignedUsers && activeTask.assignedUsers.length > 0
        ? activeTask.assignedUsers.map((u) => u._id)
        : activeTask.assignedTo?._id
        ? [activeTask.assignedTo._id]
        : [];
    const assignedChanged =
      assignedTo.length !== origAssigned.length ||
      assignedTo.some((id) => !origAssigned.includes(id));

    return (
      title !== (activeTask.title || "") ||
      description !== (activeTask.description || "") ||
      notes !== (activeTask.notes || "") ||
      mainCategory !== (activeTask.mainCategory || "") ||
      subCategory !== (activeTask.subCategory || "") ||
      customCategory !== (activeTask.customCategory || "") ||
      priority !== (activeTask.priority || "Medium") ||
      assignedChanged
    );
  }, [
    title,
    description,
    notes,
    mainCategory,
    subCategory,
    customCategory,
    priority,
    assignedTo,
    activeTask,
  ]);

  // Handle Save Details
  const handleSaveDetails = async () => {
    if (!title.trim()) {
      toast.error("Task title is required");
      return;
    }

    try {
      let combinedDeadline: string | undefined = undefined;
      if (deadlineDate) {
        if (deadlineTime) {
          combinedDeadline = new Date(`${deadlineDate}T${deadlineTime}:00`).toISOString();
        } else {
          combinedDeadline = new Date(`${deadlineDate}T23:59:59`).toISOString();
        }
      }

      const chosenCategory =
        customCategory.trim() ||
        subCategory ||
        mainCategory ||
        activeTask.category ||
        "Other Work";

      const payload: Partial<CreateTaskPayload> = {
        title: title.trim(),
        description: description.trim(),
        notes: notes.trim(),
        mainCategory: mainCategory || undefined,
        subCategory: subCategory || undefined,
        customCategory: customCategory.trim() || undefined,
        category: chosenCategory,
        priority,
        caseId: caseId.trim() ? caseId.trim() : null,
        clientId: clientId.trim() ? clientId.trim() : null,
        deadline: combinedDeadline,
        assignedTo,
      };

      await updateTask.mutateAsync({
        id: activeTask._id,
        data: payload,
      });

      queryClient.invalidateQueries({ queryKey: taskKeys.detail(activeTask._id) });
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      toast.success("Task details saved successfully!");
    } catch (err) {
      console.error("Failed to save task details:", err);
      toast.error(err instanceof Error ? err.message : "Failed to update task");
    }
  };

  // Checklist Operations
  const handleToggleChecklist = async (item: ChecklistItem, idx: number) => {
    const targetId = item._id || item.id;
    const nextDone = !item.done;

    setLiveChecklist((prev) =>
      prev.map((c, i) => {
        const matches = (targetId && (c._id === targetId || c.id === targetId)) || i === idx;
        if (!matches) return c;
        return {
          ...c,
          done: nextDone,
          subItems:
            nextDone && Array.isArray(c.subItems)
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

  const handleAddChecklistStep = async () => {
    const trimmed = newChecklistText.trim();
    if (!trimmed) return;
    setNewChecklistText("");

    const tempItem: ChecklistItem = {
      id: `temp-${Date.now()}`,
      text: trimmed,
      done: false,
      subItems: [],
    };
    setLiveChecklist((prev) => [...prev, tempItem]);

    try {
      await addChecklistItem.mutateAsync({
        taskId: activeTask._id,
        text: trimmed,
      });
      toast.success(`Added "${trimmed}" to checklist`);
    } catch (err) {
      console.error("Failed to add checklist item:", err);
      setLiveChecklist(activeTask.checklist ?? []);
      toast.error("Failed to add checklist item");
    }
  };

  const handleRemoveChecklistItem = async (indexToRemove: number) => {
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

  const handleToggleSubItem = async (
    item: ChecklistItem,
    sub: ChecklistSubItem,
    itemIdx: number,
    subIdx: number
  ) => {
    const parentId = item._id || item.id || String(itemIdx);
    const subId = sub._id || sub.id || String(subIdx);
    const nextDone = !sub.done;

    setLiveChecklist((prev) =>
      prev.map((ci, i) => {
        const matchesParent =
          (item._id && ci._id === item._id) || (item.id && ci.id === item.id) || i === itemIdx;
        if (!matchesParent) return ci;
        const newSubs = (ci.subItems || []).map((si, sI) => {
          const matchesSub =
            (sub._id && si._id === sub._id) || (sub.id && si.id === sub.id) || sI === subIdx;
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

  const handleAddSubItem = async (item: ChecklistItem, itemIdx: number) => {
    const itemId = item._id || item.id || String(itemIdx);
    const text = (newSubItemText[itemId] || "").trim();
    if (!text) return;

    const tempSub: ChecklistSubItem = { id: `temp-${Date.now()}`, text, done: false };
    setLiveChecklist((prev) =>
      prev.map((ci, i) => {
        const matches =
          (item._id && ci._id === item._id) || (item.id && ci.id === item.id) || i === itemIdx;
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

  // Delete Task
  const handleDeleteTask = async () => {
    const rawId = activeTask?._id || task?._id;
    if (!rawId) return;
    try {
      await deleteTask.mutateAsync(rawId);
      toast.success(`Task "${activeTask.title || task.title}" deleted`);
      setShowDeleteConfirm(false);
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete task");
    }
  };

  // Status Change directly from overview badge
  const handleStatusChange = async (newStatus: "pending" | "in_progress" | "pending_approval" | "completed") => {
    try {
      await updateTask.mutateAsync({
        id: activeTask._id,
        data: { status: newStatus },
      });
      toast.success(`Task marked as ${newStatus.replace("_", " ")}`);
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  // Formatted status display helper
  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Completed</Badge>;
      case "pending_approval":
        return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Pending Approval</Badge>;
      case "in_progress":
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200">In Progress</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground">Pending</Badge>;
    }
  };

  const isAssigned =
    (activeTask.assignedUsers &&
      activeTask.assignedUsers.some(
        (u) => (typeof u === "object" ? u._id : u)?.toString() === user?._id?.toString()
      )) ||
    (activeTask.assignedTo &&
      (typeof activeTask.assignedTo === "object"
        ? (activeTask.assignedTo as { _id?: string })._id
        : activeTask.assignedTo)?.toString() === user?._id?.toString());

  const canDeleteTask =
    isAdmin ||
    user?.permissions?.tasks !== false ||
    (activeTask.createdBy &&
      (typeof activeTask.createdBy === "object"
        ? (activeTask.createdBy as { _id?: string })._id
        : activeTask.createdBy)?.toString() === user?._id?.toString()) ||
    isAssigned;

  const handleAttemptClose = () => {
    if (isDirty) {
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
          className="max-h-[92dvh] overflow-y-auto w-[96vw] sm:max-w-4xl lg:max-w-6xl rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-2xl ios-scroll"
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-border pb-4 gap-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/50 shadow-xs">
                <CheckSquare className="h-6 w-6 stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-xl font-bold tracking-tight text-foreground">
                    Edit Task
                  </h2>
                  {getStatusBadge(activeTask.status)}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Update task information, assignments, and track progress
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleAttemptClose}
                className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Two-Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-5">
            {/* Left Column: Task Information */}
            <div className="lg:col-span-7 space-y-5">
              <div className="rounded-xl border border-border/80 bg-background/60 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Task Information
                  </h3>
                </div>

                {/* Task Title */}
                <div className="space-y-1.5">
                  <Label htmlFor="task-title-input" className="text-xs font-semibold text-foreground">
                    Task Title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="task-title-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Complete Document Review"
                    className="h-10 text-sm font-medium rounded-lg"
                  />
                </div>

                {/* Categories Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="main-category-select" className="text-xs font-semibold text-foreground">
                      Main Category
                    </Label>
                    <select
                      id="main-category-select"
                      value={mainCategory}
                      onChange={(e) => {
                        setMainCategory(e.target.value);
                        setSubCategory("");
                        setCustomCategory("");
                      }}
                      className="h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
                    <Label htmlFor="sub-category-select" className="text-xs font-semibold text-foreground">
                      Subcategory
                    </Label>
                    <select
                      id="sub-category-select"
                      value={subCategory}
                      onChange={(e) => {
                        setSubCategory(e.target.value);
                        if (e.target.value !== "__other__") setCustomCategory("");
                      }}
                      disabled={!mainCategory || availableSubCategories.length === 0}
                      className="h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
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
                    <Label htmlFor="custom-category-input" className="text-xs font-semibold text-foreground">
                      Custom Subcategory Name
                    </Label>
                    <Input
                      id="custom-category-input"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder="Enter custom subcategory..."
                      className="h-9 text-xs rounded-lg"
                    />
                  </div>
                )}

                {/* Priority & Deadline Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">Priority</Label>
                    <div className="flex h-10 rounded-lg border border-border overflow-hidden bg-muted/30">
                      {(["High", "Medium", "Low"] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPriority(p)}
                          className={`flex-1 text-xs font-semibold transition-all border-r border-border last:border-r-0 flex items-center justify-center gap-1.5 ${
                            priority === p
                              ? p === "High"
                                ? "bg-destructive/15 text-destructive font-bold"
                                : p === "Medium"
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold"
                                : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              p === "High"
                                ? "bg-destructive"
                                : p === "Medium"
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            }`}
                          />
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">Deadline & Time</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative">
                        <Input
                          type="date"
                          value={deadlineDate}
                          onChange={(e) => setDeadlineDate(e.target.value)}
                          className="h-10 text-xs rounded-lg px-2"
                        />
                      </div>
                      <div className="relative">
                        <Input
                          type="time"
                          value={deadlineTime}
                          onChange={(e) => setDeadlineTime(e.target.value)}
                          className="h-10 text-xs rounded-lg px-2"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Assigned Staff & Counsel */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Assigned Staff & Counsel
                  </Label>
                  <AssigneeMultiSelect value={assignedTo} onChange={setAssignedTo} />
                </div>

                {/* Description with Formatting Toolbar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="task-description-input" className="text-xs font-semibold text-foreground">
                      Task Description & Instructions
                    </Label>
                    {/* Rich text formatting bar */}
                    <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-md border border-border/60">
                      <button
                        type="button"
                        onClick={() => applyTextFormat("**")}
                        title="Bold"
                        className="p-1 rounded hover:bg-background text-muted-foreground hover:text-foreground"
                      >
                        <Bold className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyTextFormat("*")}
                        title="Italic"
                        className="p-1 rounded hover:bg-background text-muted-foreground hover:text-foreground"
                      >
                        <Italic className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyTextFormat("~~")}
                        title="Strikethrough"
                        className="p-1 rounded hover:bg-background text-muted-foreground hover:text-foreground"
                      >
                        <Strikethrough className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyTextFormat("- ")}
                        title="Bullet List"
                        className="p-1 rounded hover:bg-background text-muted-foreground hover:text-foreground"
                      >
                        <List className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyTextFormat("1. ")}
                        title="Numbered List"
                        className="p-1 rounded hover:bg-background text-muted-foreground hover:text-foreground"
                      >
                        <ListOrdered className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyTextFormat("[", "](https://)")}
                        title="Link"
                        className="p-1 rounded hover:bg-background text-muted-foreground hover:text-foreground"
                      >
                        <LinkIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <Textarea
                    id="task-description-input"
                    ref={descTextareaRef}
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide detailed instructions and context for this task..."
                    className="text-xs rounded-lg border-border resize-y min-h-[90px]"
                  />
                </div>

                {/* Additional Internal Notes */}
                <div className="space-y-1.5">
                  <Label htmlFor="task-notes-input" className="text-xs font-semibold text-foreground">
                    Additional Internal Notes
                  </Label>
                  <Textarea
                    id="task-notes-input"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notes visible only to internal team members..."
                    className="text-xs rounded-lg border-border resize-y bg-muted/10 min-h-[75px]"
                  />
                </div>

                {/* Related Client & Case */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-border/50">
                  <div className="space-y-1.5">
                    <Label htmlFor="task-client-select" className="text-xs font-semibold text-foreground">
                      Related Client
                    </Label>
                    <select
                      id="task-client-select"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      className="h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">No client selected</option>
                      {clients.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="task-case-select" className="text-xs font-semibold text-foreground">
                      Related Case
                    </Label>
                    <select
                      id="task-case-select"
                      value={caseId}
                      onChange={(e) => setCaseId(e.target.value)}
                      className="h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">No case selected</option>
                      {cases.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.caseNumber ? `${c.caseNumber} - ${c.title}` : c.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Call Task Card if applicable */}
                {Boolean(activeTask.isCall || activeTask.callReminder) && (
                  <TaskCallReminderCard
                    activeTask={activeTask}
                    callCompleted={callCompleted}
                    handleToggleCallDone={async () => {
                      const next = !callCompleted;
                      setCallCompleted(next);
                      await updateTask.mutateAsync({
                        id: activeTask._id,
                        data: {
                          status: next ? "completed" : "pending",
                          callReminder: {
                            clientName: activeTask.callReminder?.clientName || activeTask.title,
                            phone: activeTask.callReminder?.phone || "",
                            scheduledAt: activeTask.callReminder?.scheduledAt || new Date().toISOString(),
                            notes: activeTask.callReminder?.notes || "",
                            completed: next,
                          },
                        },
                      });
                    }}
                    isPending={updateTask.isPending}
                    onOpenReschedule={() => {
                      setShowRescheduleModal(true);
                    }}
                  />
                )}
              </div>
            </div>

            {/* Right Column: Task Overview, Checklist, Documents, Activity */}
            <div className="lg:col-span-5 space-y-5">
              {/* Task Overview Card */}
              <div className="rounded-xl border border-border/80 bg-background/60 p-4 shadow-xs space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Task Overview
                </h3>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <span className="text-muted-foreground block text-[11px]">Status</span>
                    <select
                      value={activeTask.status || "pending"}
                      onChange={(e) => handleStatusChange(e.target.value as "pending" | "in_progress" | "pending_approval" | "completed")}
                      className="h-8 rounded-md border border-border bg-background px-2 font-medium text-foreground text-xs"
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="pending_approval">Pending Approval</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <span className="text-muted-foreground block text-[11px]">Created</span>
                    <span className="font-medium text-foreground block truncate">
                      {formatReadableDate(activeTask.createdAt || activeTask.createdDate) || "Recent"}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-muted-foreground block text-[11px]">Created By</span>
                    <span className="font-medium text-foreground block truncate">
                      {activeTask.createdBy && typeof activeTask.createdBy === "object"
                        ? (activeTask.createdBy as { name?: string; email?: string }).name ||
                          (activeTask.createdBy as { name?: string; email?: string }).email
                        : "Administrator"}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-muted-foreground block text-[11px]">Last Updated</span>
                    <span className="font-medium text-foreground block truncate">
                      {formatReadableDate(activeTask.updatedAt) || "Just now"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Nested Checklist & Subtasks Card with Circular Progress */}
              <div className="rounded-xl border border-border/80 bg-background/60 p-4 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Checklist & Subtasks
                    </h3>
                  </div>

                  {/* Circular/Pill Progress Indicator */}
                  <div className="flex items-center gap-2">
                    <div className="h-6 px-2.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-semibold text-[11px] flex items-center gap-1 border border-blue-200 dark:border-blue-800">
                      <span>{pct}%</span>
                      <span className="text-blue-500 font-normal">({doneCount}/{total})</span>
                    </div>
                  </div>
                </div>

                {/* Checklist Items List */}
                <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                  {checklist.length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      No checklist steps added yet. Add steps below to track subtasks.
                    </div>
                  ) : (
                    checklist.map((item, idx) => {
                      const isExpanded = expandedItems[item._id || item.id || String(idx)] ?? true;
                      const hasSubs = Array.isArray(item.subItems) && item.subItems.length > 0;
                      const subsDone = hasSubs ? item.subItems!.filter((s) => s.done).length : 0;
                      const itemId = item._id || item.id || String(idx);

                      return (
                        <div
                          key={itemId}
                          className="rounded-lg border border-border/70 bg-card p-2.5 space-y-2 transition-all hover:border-border"
                        >
                          {/* Parent Step Row */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5 flex-1 min-w-0">
                              <input
                                type="checkbox"
                                checked={Boolean(item.done)}
                                onChange={() => handleToggleChecklist(item, idx)}
                                className="h-4 w-4 mt-0.5 rounded border-border text-primary focus:ring-primary cursor-pointer shrink-0"
                              />

                              {editingIndex === idx ? (
                                <div className="flex items-center gap-1.5 flex-1">
                                  <Input
                                    value={editingText}
                                    onChange={(e) => setEditingText(e.target.value)}
                                    className="h-7 text-xs py-0"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleSaveInlineChecklistText(idx);
                                      if (e.key === "Escape") setEditingIndex(null);
                                    }}
                                  />
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleSaveInlineChecklistText(idx)}
                                    className="h-7 px-2 text-xs"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ) : (
                                <span
                                  onClick={() => {
                                    setEditingIndex(idx);
                                    setEditingText(item.text);
                                  }}
                                  className={`text-xs font-medium cursor-pointer flex-1 truncate ${
                                    item.done ? "line-through text-muted-foreground" : "text-foreground"
                                  }`}
                                  title="Click to edit text"
                                >
                                  {item.text}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1">
                              {hasSubs && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedItems((prev) => ({ ...prev, [itemId]: !isExpanded }))
                                  }
                                  className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 px-1 py-0.5 rounded bg-muted/40"
                                >
                                  <span>{subsDone}/{item.subItems!.length}</span>
                                  {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleRemoveChecklistItem(idx)}
                                className="text-muted-foreground hover:text-destructive p-1 rounded"
                                title="Delete step"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Nested Subtasks */}
                          {isExpanded && (
                            <div className="pl-6 space-y-1.5 pt-1 border-t border-border/40">
                              {hasSubs &&
                                item.subItems!.map((sub, sIdx) => {
                                  const subKey = sub._id || sub.id || `${itemId}-${sIdx}`;
                                  return (
                                    <div
                                      key={subKey}
                                      className="flex items-center justify-between gap-2 group text-xs py-0.5"
                                    >
                                      <label className="flex items-center gap-2 flex-1 cursor-pointer min-w-0">
                                        <input
                                          type="checkbox"
                                          checked={Boolean(sub.done)}
                                          onChange={() => handleToggleSubItem(item, sub, idx, sIdx)}
                                          className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer shrink-0"
                                        />
                                        <span
                                          className={`truncate text-xs ${
                                            sub.done ? "line-through text-muted-foreground" : "text-foreground/90"
                                          }`}
                                        >
                                          {sub.text}
                                        </span>
                                      </label>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          await deleteSubItem.mutateAsync({
                                            taskId: activeTask._id,
                                            itemId,
                                            subId: sub._id || sub.id || String(sIdx),
                                          });
                                          setLiveChecklist((prev) =>
                                            prev.map((ci, cI) =>
                                              cI === idx
                                                ? {
                                                    ...ci,
                                                    subItems: (ci.subItems || []).filter((_, i) => i !== sIdx),
                                                  }
                                                : ci
                                            )
                                          );
                                        }}
                                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-0.5"
                                        title="Delete subtask"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </div>
                                  );
                                })}

                              {/* Add Subtask Input */}
                              <div className="flex items-center gap-1.5 pt-1">
                                <Input
                                  value={newSubItemText[itemId] || ""}
                                  onChange={(e) =>
                                    setNewSubItemText((prev) => ({ ...prev, [itemId]: e.target.value }))
                                  }
                                  placeholder="+ Add subtask..."
                                  className="h-7 text-[11px] rounded bg-background/80"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleAddSubItem(item, idx);
                                  }}
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleAddSubItem(item, idx)}
                                  className="h-7 px-2 text-[11px]"
                                >
                                  Add
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Add New Parent Step */}
                <div className="flex items-center gap-2 pt-2 border-t border-border/60">
                  <Input
                    value={newChecklistText}
                    onChange={(e) => setNewChecklistText(e.target.value)}
                    placeholder="Add a new checklist step..."
                    className="h-9 text-xs rounded-lg flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddChecklistStep();
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddChecklistStep}
                    disabled={!newChecklistText.trim()}
                    className="h-9 px-3 text-xs bg-primary text-primary-foreground font-semibold rounded-lg"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Step
                  </Button>
                </div>
              </div>

              {/* Task Documents Section */}
              <TaskDocumentsSection
                taskId={activeTask._id}
                caseId={activeTask.caseId?._id || activeTask.caseId}
                clientId={activeTask.clientId?._id || activeTask.clientId}
                initialDocuments={activeTask.documents}
              />

              {/* Activity & Remarks Section */}
              <div className="rounded-xl border border-border/80 bg-background/60 p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Activity & Remarks
                  </h3>
                  <div className="flex rounded-md border border-border overflow-hidden text-[10px]">
                    <button
                      type="button"
                      onClick={() => setAuditTab("assignment")}
                      className={`px-2 py-0.5 font-medium ${
                        auditTab === "assignment" ? "bg-muted text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      Remarks
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuditTab("edits")}
                      className={`px-2 py-0.5 font-medium border-l border-border ${
                        auditTab === "edits" ? "bg-muted text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      Audit
                    </button>
                  </div>
                </div>

                {auditTab === "assignment" ? (
                  <TaskRemarksThread
                    activeTask={activeTask}
                    user={user}
                    newRemarkText={newRemarkText}
                    setNewRemarkText={setNewRemarkText}
                    addTaskRemark={addTaskRemark}
                  />
                ) : (
                  <TaskHistorySection
                    activeTask={activeTask}
                    auditTab={auditTab}
                    setAuditTab={setAuditTab}
                    auditLogs={auditLogs}
                    isLoadingAuditLogs={isLoadingAuditLogs}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between border-t border-border pt-4 mt-6 flex-wrap gap-3">
            <div>
              {canDeleteTask && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="h-10 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive text-xs font-semibold rounded-lg"
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Delete Task
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCompletionDialog(true)}
                className="h-10 text-xs font-semibold rounded-lg border-blue-200 bg-blue-50/50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 dark:bg-blue-950/30 dark:border-blue-900 dark:text-blue-300"
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                {isAdmin ? "Mark as Complete" : "Submit for Approval"}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleAttemptClose}
                className="h-10 text-xs font-medium rounded-lg"
              >
                Cancel
              </Button>

              <Button
                type="button"
                onClick={handleSaveDetails}
                disabled={updateTask.isPending}
                className="h-10 text-xs font-semibold rounded-lg px-5 bg-primary text-primary-foreground shadow-sm hover:bg-primary/95"
              >
                {updateTask.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent className="max-w-md p-6 rounded-xl">
            <h3 className="text-base font-bold text-foreground">Confirm Task Deletion</h3>
            <p className="text-xs text-muted-foreground mt-2">
              Are you sure you want to delete this task? This action cannot be undone and will remove all checklist steps and associated notes.
            </p>
            <div className="flex justify-end gap-2.5 mt-5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteConfirm(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteTask}
                disabled={deleteTask.isPending}
                className="text-xs"
              >
                {deleteTask.isPending ? "Deleting..." : "Delete Permanently"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Task Completion / Approval Submission Dialog */}
      {showCompletionDialog && (
        <TaskCompletionDialog
          open={showCompletionDialog}
          onClose={() => setShowCompletionDialog(false)}
          task={activeTask}
          checklistProgress={{ total, doneCount }}
        />
      )}

      {/* Discard Changes Prompt */}
      {showDiscardConfirm && (
        <DiscardConfirmationDialog
          open={showDiscardConfirm}
          onOpenChange={setShowDiscardConfirm}
          onDiscard={() => {
            setShowDiscardConfirm(false);
            onClose();
          }}
          onKeepEditing={() => setShowDiscardConfirm(false)}
        />
      )}

      {/* Subdialogs */}
      <TaskSubModals
        task={task}
        activeTask={activeTask}
        allStaffMembers={allStaffMembers}
        showForwardModal={showForwardModal}
        setShowForwardModal={setShowForwardModal}
        showReassignModal={showReassignModal}
        setShowReassignModal={setShowReassignModal}
        showRequestDeleteModal={showRequestDeleteModal}
        setShowRequestDeleteModal={setShowRequestDeleteModal}
        showAdminDeleteModal={showAdminDeleteModal}
        setShowAdminDeleteModal={setShowAdminDeleteModal}
        showRejectModal={showRejectModal}
        setShowRejectModal={setShowRejectModal}
        showRescheduleModal={showRescheduleModal}
        setShowRescheduleModal={setShowRescheduleModal}
        targetUserId={targetUserId}
        setTargetUserId={setTargetUserId}
        actionNote={actionNote}
        setActionNote={setActionNote}
        deleteRequestReason={deleteRequestReason}
        setDeleteRequestReason={setDeleteRequestReason}
        rejectReason={rejectReason}
        setRejectReason={setRejectReason}
        rescheduleDateTime={rescheduleDateTime}
        setRescheduleDateTime={setRescheduleDateTime}
        rescheduleReason={rescheduleReason}
        setRescheduleReason={setRescheduleReason}
        isRescheduling={isRescheduling}
        forwardTask={forwardTask}
        reassignTask={reassignTask}
        requestTaskDeletion={requestTaskDeletion}
        handleDeleteTask={handleDeleteTask}
        rejectTask={rejectTask}
        handleConfirmReschedule={async () => {
          if (!rescheduleDateTime) return;
          setIsRescheduling(true);
          try {
            await updateTask.mutateAsync({
              id: activeTask._id,
              data: {
                deadline: new Date(rescheduleDateTime).toISOString(),
                status: "pending",
                didNotPickUp: true,
                rescheduleReason: rescheduleReason || "Person did not pick up call",
              },
            });
            toast.success("Call rescheduled successfully!");
            setShowRescheduleModal(false);
          } finally {
            setIsRescheduling(false);
          }
        }}
        handleQuickReschedulePreset={(minsOrHours: number, isDay = false) => {
          const target = new Date();
          if (isDay) {
            target.setDate(target.getDate() + minsOrHours);
            target.setHours(10, 0, 0, 0);
          } else {
            target.setTime(Date.now() + minsOrHours * 60 * 1000);
          }
          const localIso = new Date(target.getTime() - target.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
          setRescheduleDateTime(localIso);
        }}
        onClose={onClose}
      />
    </>
  );
}
