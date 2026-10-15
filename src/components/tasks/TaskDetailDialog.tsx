import React, { useState, useEffect, useMemo } from "react";
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
import { toSafeIso } from "@/lib/dates";
import { validatePhone } from "@/lib/validation";
import { DiscardConfirmationDialog } from "@/components/ui/discard-confirmation-dialog";
import { toast } from "sonner";

// Decomposed Subcomponents
import { TaskHeader } from "./detail/TaskHeader";
import { TaskBanners } from "./detail/TaskBanners";
import { TaskMetadataView } from "./detail/TaskMetadataView";
import { TaskEditForm } from "./detail/TaskEditForm";
import { TaskCallReminderCard } from "./detail/TaskCallReminderCard";
import { TaskHistorySection } from "./detail/TaskHistorySection";
import { TaskRemarksThread } from "./detail/TaskRemarksThread";
import { TaskChecklistSection } from "./detail/TaskChecklistSection";
import { TaskActionFooter } from "./detail/TaskActionFooter";
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

function TaskDetailDialogInner({ open, onClose, task }: { open: boolean; onClose: () => void; task: TaskRecord }) {
  const queryClient = useQueryClient();
  const { data: taskQueryData } = useTask(task._id, task);
  const activeTask = taskQueryData?.task ?? task;

  // Real-time synchronization when notes or details are updated by other staff members
  useSocketEvent<{ task?: TaskRecord; taskId?: string }>("task:updated", (payload) => {
    if (payload?.taskId === activeTask._id || payload?.task?._id === activeTask._id) {
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(activeTask._id) });
      queryClient.invalidateQueries({ queryKey: ["task-audit-logs", activeTask._id] });
    }
  });

  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(activeTask.title || "");
  const [description, setDescription] = useState(activeTask.description || "");
  const [category, setCategory] = useState(activeTask.category || "General");
  const [mainCategory, setMainCategory] = useState(activeTask.mainCategory || "");
  const [subCategory, setSubCategory] = useState(activeTask.subCategory || "");
  const [customCategory, setCustomCategory] = useState(activeTask.customCategory || "");
  const [priority, setPriority] = useState(activeTask.priority || "Medium");
  const [deadline, setDeadline] = useState(
    activeTask.deadline ? new Date(activeTask.deadline).toISOString().slice(0, 16) : ""
  );
  const initialAssigned = useMemo(() => {
    if (activeTask.assignedUsers && activeTask.assignedUsers.length > 0) {
      return activeTask.assignedUsers.map((u) => u._id);
    }
    return activeTask.assignedTo?._id ? [activeTask.assignedTo._id] : [];
  }, [activeTask.assignedUsers, activeTask.assignedTo]);
  const [assignedTo, setAssignedTo] = useState<string[]>(initialAssigned);
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
  const [showAdminDeleteModal, setShowAdminDeleteModal] = useState(false);
  const [showRequestDeleteModal, setShowRequestDeleteModal] = useState(false);
  const [deleteRequestReason, setDeleteRequestReason] = useState("");
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [newRemarkText, setNewRemarkText] = useState("");
  const [auditTab, setAuditTab] = useState<"assignment" | "edits">("assignment");

  const { data: auditLogsData, isLoading: isLoadingAuditLogs } = useTaskAuditLogs(activeTask._id);
  const auditLogs = auditLogsData?.logs ?? [];

  const { data: categoryTree = [] } = useCategoryTree();
  const selectedParent = categoryTree.find((c) => c.name === mainCategory);
  const availableSubCategories = selectedParent?.children ?? [];

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

  const allStaffMembers = useMemo(() => {
    const map = new Map<string, any>();
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

  const [showForwardModal, setShowForwardModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [targetUserId, setTargetUserId] = useState("");
  const [actionNote, setActionNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [newSubItemText, setNewSubItemText] = useState<{ [itemId: string]: string }>({});
  const [expandedItems, setExpandedItems] = useState<{ [itemId: string]: boolean }>({});

  const handleOpenForwardModal = () => {
    setTargetUserId("");
    setActionNote("");
    setShowForwardModal(true);
  };

  const handleOpenReassignModal = () => {
    setTargetUserId("");
    setActionNote("");
    setShowReassignModal(true);
  };

  const handleOpenRequestDeleteModal = () => {
    setDeleteRequestReason("");
    setShowRequestDeleteModal(true);
  };

  const handleOpenAdminDeleteModal = () => {
    setShowAdminDeleteModal(true);
  };

  const handleOpenRejectModal = () => {
    setRejectReason("");
    setShowRejectModal(true);
  };

  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleDateTime, setRescheduleDateTime] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("Person did not pick up call");
  const [isRescheduling, setIsRescheduling] = useState(false);

  const handleQuickReschedulePreset = (minsOrHours: number, isDay = false) => {
    const target = new Date();
    if (isDay) {
      target.setDate(target.getDate() + minsOrHours);
      target.setHours(10, 0, 0, 0);
    } else {
      target.setTime(Date.now() + minsOrHours * 60 * 1000);
    }
    const localIso = new Date(target.getTime() - target.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setRescheduleDateTime(localIso);
  };

  const handleConfirmReschedule = async () => {
    if (!rescheduleDateTime) {
      toast.error("Please choose a date and time to reschedule the call.");
      return;
    }
    const parsed = new Date(rescheduleDateTime);
    if (isNaN(parsed.getTime())) {
      toast.error("Invalid date and time.");
      return;
    }
    setIsRescheduling(true);
    try {
      const scheduledIso = parsed.toISOString();
      await updateTask.mutateAsync({
        id: activeTask._id,
        data: {
          deadline: scheduledIso,
          status: "pending",
          didNotPickUp: true,
          rescheduleReason: rescheduleReason || "Person did not pick up call",
          callReminder: {
            clientName: activeTask.callReminder?.clientName || activeTask.title,
            phone: activeTask.callReminder?.phone || "",
            scheduledAt: scheduledIso,
            notes: activeTask.callReminder?.notes || "",
            completed: false,
          },
        },
      });
      setCallCompleted(false);
      setCallScheduledAt(rescheduleDateTime);
      toast.success("Call rescheduled successfully!");
      setShowRescheduleModal(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to reschedule call");
    } finally {
      setIsRescheduling(false);
    }
  };

  useEffect(() => {
    if (activeTask) {
      setTitle(activeTask.title || "");
      setDescription(activeTask.description || "");
      setCategory(activeTask.category || "General");
      setMainCategory(activeTask.mainCategory || "");
      setSubCategory(activeTask.subCategory || "");
      setCustomCategory(activeTask.customCategory || "");
      setPriority(activeTask.priority || "Medium");
      const freshAssigned =
        activeTask.assignedUsers && activeTask.assignedUsers.length > 0
          ? activeTask.assignedUsers.map((u) => u._id)
          : activeTask.assignedTo?._id
          ? [activeTask.assignedTo._id]
          : [];
      setAssignedTo(freshAssigned);

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

  const linkedCaseId =
    activeTask.caseId && typeof activeTask.caseId === "object"
      ? (activeTask.caseId as any)._id
      : typeof activeTask.caseId === "string"
      ? activeTask.caseId
      : null;

  const caseDisplay =
    activeTask.caseId && typeof activeTask.caseId === "object"
      ? activeTask.caseId.number
        ? `${activeTask.caseId.number} — ${activeTask.caseId.title}`
        : activeTask.caseId.title
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

    // Instant optimistic UI update
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

  const handleAddSubCategoryToChecklist = async (subCatName: string) => {
    const textToAdd = subCatName.trim();
    if (!textToAdd) return;

    if (isEditing) {
      if (editableChecklist.some((c) => c.text.toLowerCase() === textToAdd.toLowerCase())) {
        toast.info(`"${textToAdd}" is already in the checklist`);
        return;
      }
      setEditableChecklist((prev) => [
        ...prev,
        { text: textToAdd, done: false, subItems: [] },
      ]);
      toast.success(`Added "${textToAdd}" to checklist`);
      return;
    }

    if (liveChecklist.some((c) => c.text.toLowerCase() === textToAdd.toLowerCase())) {
      toast.info(`"${textToAdd}" is already in the checklist`);
      return;
    }

    setLiveChecklist((prev) => [...prev, { text: textToAdd, done: false, subItems: [] }]);
    try {
      await addChecklistItem.mutateAsync({
        taskId: activeTask._id,
        text: textToAdd,
      });
      toast.success(`Added "${textToAdd}" to checklist`);
    } catch (err) {
      console.error("Failed to add subcategory checklist item:", err);
      setLiveChecklist(activeTask.checklist ?? []);
      toast.error("Failed to add checklist item");
    }
  };

  const handleAddAllSubCategoriesToChecklist = async () => {
    if (!availableSubCategories || availableSubCategories.length === 0) return;

    const currentItems = isEditing ? editableChecklist : liveChecklist;
    const existingTexts = new Set(currentItems.map((c) => c.text.toLowerCase()));
    const toAdd = availableSubCategories
      .map((sc) => sc.name.trim())
      .filter((name) => name && !existingTexts.has(name.toLowerCase()));

    if (toAdd.length === 0) {
      toast.info("All subcategories are already in the checklist");
      return;
    }

    if (isEditing) {
      setEditableChecklist((prev) => [
        ...prev,
        ...toAdd.map((text) => ({ text, done: false, subItems: [] })),
      ]);
      toast.success(`Added ${toAdd.length} subcategory checklist step(s)`);
      return;
    }

    // Sequentially persist
    const newItems = toAdd.map((text) => ({ text, done: false, subItems: [] }));
    setLiveChecklist((prev) => [...prev, ...newItems]);
    try {
      for (const text of toAdd) {
        await addChecklistItem.mutateAsync({
          taskId: activeTask._id,
          text,
        });
      }
      toast.success(`Added ${toAdd.length} subcategory checklist step(s)`);
    } catch (err) {
      console.error("Failed to add subcategories to checklist:", err);
      toast.error("Some checklist steps could not be added");
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

      const chosenCategory =
        customCategory.trim() ||
        subCategory ||
        mainCategory ||
        category.trim() ||
        "Other Work";

      const payload: Partial<CreateTaskPayload> & { checklist?: any[] } = {
        title: title.trim(),
        description: description.trim(),
        mainCategory: mainCategory || undefined,
        subCategory: subCategory || undefined,
        customCategory: customCategory.trim() || undefined,
        category: chosenCategory,
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
      if (isAdmin) {
        payload.assignedTo = assignedTo;
        payload.assignedUsers = assignedTo;
      }

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
    const targetId =
      typeof rawId === "object" && rawId !== null
        ? ((rawId as any)._id || (rawId as any).id || String(rawId))
        : String(rawId || "");

    if (!targetId || targetId === "undefined" || targetId === "null") {
      toast.error("Unable to find task identifier to delete");
      return;
    }
    try {
      const res = await deleteTask.mutateAsync(targetId);
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
    if (isDuplicating) return;
    setIsDuplicating(true);
    try {
      const duplicatePayload: CreateTaskPayload = {
        title: `${activeTask.title} (Copy)`,
        description: activeTask.description,
        category: activeTask.category,
        priority: activeTask.priority,
        agent: activeTask.agent,
        checklist: (activeTask.checklist || []).map((c) => ({
          text: c.text,
          done: false,
          subItems: (c.subItems || []).map((s) => ({ text: s.text, done: false })),
        })),
        caseId: activeTask.caseId && typeof activeTask.caseId === "object" ? (activeTask.caseId as any)._id : activeTask.caseId || null,
        clientId: activeTask.clientId && typeof activeTask.clientId === "object" ? (activeTask.clientId as any)._id : activeTask.clientId || null,
        mainCategory: activeTask.mainCategory,
        subCategory: activeTask.subCategory,
        categoryPath: activeTask.categoryPath,
        customCategory: activeTask.customCategory,
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
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleSetStatus = async (status: "pending" | "in_progress" | "pending_approval" | "completed") => {
    try {
      const res = await updateTask.mutateAsync({
        id: activeTask._id,
        data: { status },
      });
      const resolvedStatus = (res as any)?.task?.status;
      if (resolvedStatus === "pending_approval") {
        toast.info("Task submitted for admin approval");
      } else if (resolvedStatus === "completed") {
        toast.success("Task marked as completed");
      } else if (resolvedStatus === "in_progress") {
        toast.info("Task marked as in progress");
      } else if (resolvedStatus === "pending") {
        toast.info("Task marked as pending");
      } else {
        toast.error("Unexpected task status received from server. Status change unverified.");
      }
    } catch (err) {
      console.error("Failed to update task status:", err);
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const isAssigned =
    (activeTask.assignedUsers &&
      activeTask.assignedUsers.some(
        (u) => (typeof u === "object" ? u._id : u)?.toString() === user?._id?.toString()
      )) ||
    (activeTask.assignedTo &&
      (typeof activeTask.assignedTo === "object" ? (activeTask.assignedTo as any)._id : activeTask.assignedTo)?.toString() ===
        user?._id?.toString());

  const canDeleteTask =
    isAdmin ||
    user?.permissions?.tasks !== false ||
    (activeTask.createdBy &&
      (typeof activeTask.createdBy === "object" ? (activeTask.createdBy as any)._id : activeTask.createdBy)?.toString() ===
        user?._id?.toString()) ||
    isAssigned;

  const isCreatorOrAdmin = canDeleteTask;

  const isDirty = useMemo(() => {
    if (!isEditing) return false;
    const assignedChanged =
      isAdmin &&
      (assignedTo.length !== initialAssigned.length ||
        assignedTo.some((id) => !initialAssigned.includes(id)));
    return (
      title !== (activeTask.title || "") ||
      description !== (activeTask.description || "") ||
      category !== (activeTask.category || "General") ||
      mainCategory !== (activeTask.mainCategory || "") ||
      subCategory !== (activeTask.subCategory || "") ||
      customCategory !== (activeTask.customCategory || "") ||
      priority !== (activeTask.priority || "Medium") ||
      assignedChanged
    );
  }, [isEditing, title, description, category, mainCategory, subCategory, customCategory, priority, assignedTo, initialAssigned, activeTask, isAdmin]);

  const handleAttemptClose = () => {
    if (isEditing && isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  const isAnySubModalOpen =
    showForwardModal ||
    showReassignModal ||
    showRequestDeleteModal ||
    showAdminDeleteModal ||
    showRejectModal ||
    showDiscardConfirm ||
    showRescheduleModal ||
    showDeleteConfirm;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(val) => {
          if (!val && !isAnySubModalOpen) handleAttemptClose();
        }}
      >
        <DialogContent
          onInteractOutside={(e) => {
            if (isAnySubModalOpen) {
              e.preventDefault();
              return;
            }
            const target = e.target as HTMLElement | null;
            if (
              target?.closest("[data-radix-popper-content-wrapper]") ||
              target?.closest('[role="menu"]') ||
              target?.closest('[role="menuitem"]') ||
              target?.closest('[role="dialog"]') ||
              target?.closest("[data-radix-dropdown-menu-content]") ||
              target?.closest("[data-sonner-toaster]") ||
              target?.closest(".toaster")
            ) {
              e.preventDefault();
              return;
            }
            e.preventDefault();
            handleAttemptClose();
          }}
          onEscapeKeyDown={(e) => {
            if (isAnySubModalOpen) {
              e.preventDefault();
              return;
            }
            e.preventDefault();
            handleAttemptClose();
          }}
          className="max-h-[92dvh] overflow-y-auto w-[95vw] sm:max-w-xl rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-lift ios-scroll"
        >
          {/* Header */}
          <TaskHeader
            activeTask={activeTask}
            caseDisplay={caseDisplay}
            linkedCaseId={linkedCaseId}
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            setEditableChecklist={setEditableChecklist}
            setEditingIndex={setEditingIndex}
            isAdmin={isAdmin}
            isDuplicating={isDuplicating}
            handleSetStatus={handleSetStatus}
            handleOpenForwardModal={handleOpenForwardModal}
            handleOpenReassignModal={handleOpenReassignModal}
            handleOpenRejectModal={handleOpenRejectModal}
            handleOpenAdminDeleteModal={handleOpenAdminDeleteModal}
            handleOpenRequestDeleteModal={handleOpenRequestDeleteModal}
            handleDuplicateTask={handleDuplicateTask}
            onClose={onClose}
          />

          {/* Clean Informational Status Banners */}
          <TaskBanners
            activeTask={activeTask}
            isAdmin={isAdmin}
            total={total}
            doneCount={doneCount}
          />

          {/* Content: Edit Mode vs View Mode */}
          {isEditing ? (
            <TaskEditForm
              title={title}
              setTitle={setTitle}
              description={description}
              setDescription={setDescription}
              mainCategory={mainCategory}
              setMainCategory={setMainCategory}
              subCategory={subCategory}
              setSubCategory={setSubCategory}
              customCategory={customCategory}
              setCustomCategory={setCustomCategory}
              categoryTree={categoryTree}
              availableSubCategories={availableSubCategories}
              priority={priority}
              setPriority={setPriority}
              agentSelect={agentSelect}
              setAgentSelect={setAgentSelect}
              agentCustom={agentCustom}
              setAgentCustom={setAgentCustom}
              predefinedAgents={predefinedAgents}
              assignedTo={assignedTo}
              setAssignedTo={setAssignedTo}
              deadline={deadline}
              setDeadline={setDeadline}
              caseId={caseId}
              setCaseId={setCaseId}
              clientId={clientId}
              setClientId={setClientId}
              manualCase={manualCase}
              setManualCase={setManualCase}
              cases={cases}
              clients={clients}
              callClientName={callClientName}
              setCallClientName={setCallClientName}
              callPhone={callPhone}
              setCallPhone={setCallPhone}
              callScheduledAt={callScheduledAt}
              setCallScheduledAt={setCallScheduledAt}
              callNotes={callNotes}
              setCallNotes={setCallNotes}
              callCompleted={callCompleted}
              setCallCompleted={setCallCompleted}
              handleSaveDetails={handleSaveDetails}
              handleCancelEdit={() => {
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
              isPending={updateTask.isPending}
            />
          ) : (
            <div className="mt-4 space-y-4">
              {/* Metadata Details */}
              <TaskMetadataView
                activeTask={activeTask}
                linkedCaseId={linkedCaseId}
                caseDisplay={caseDisplay}
                clientDisplay={clientDisplay}
                onClose={onClose}
              />

              {/* History & Audit Trail */}
              <TaskHistorySection
                activeTask={activeTask}
                auditTab={auditTab}
                setAuditTab={setAuditTab}
                auditLogs={auditLogs}
                isLoadingAuditLogs={isLoadingAuditLogs}
              />

              {/* Remarks Thread */}
              <TaskRemarksThread
                activeTask={activeTask}
                user={user}
                newRemarkText={newRemarkText}
                setNewRemarkText={setNewRemarkText}
                addTaskRemark={addTaskRemark}
              />

              {/* Call Reminder Card */}
              <TaskCallReminderCard
                activeTask={activeTask}
                callCompleted={callCompleted}
                handleToggleCallDone={handleToggleCallDone}
                isPending={updateTask.isPending}
                onOpenReschedule={() => {
                  const sched = activeTask.callReminder?.scheduledAt ? new Date(activeTask.callReminder.scheduledAt) : new Date();
                  const future = new Date(Date.now() + 30 * 60 * 1000);
                  const localIso = new Date(future.getTime() - future.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                  setRescheduleDateTime(localIso);
                  setRescheduleReason("Person did not pick up call");
                  setShowRescheduleModal(true);
                }}
              />
            </div>
          )}

          {/* Checklist Section */}
          <TaskChecklistSection
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            isDirty={isDirty}
            setShowDiscardConfirm={setShowDiscardConfirm}
            editableChecklist={editableChecklist}
            setEditableChecklist={setEditableChecklist}
            checklist={checklist}
            total={total}
            doneCount={doneCount}
            pct={pct}
            mainCategory={mainCategory}
            availableSubCategories={availableSubCategories}
            liveChecklist={liveChecklist}
            handleAddSubCategoryToChecklist={handleAddSubCategoryToChecklist}
            handleAddAllSubCategoriesToChecklist={handleAddAllSubCategoriesToChecklist}
            handleMarkAllChecklist={handleMarkAllChecklist}
            handleToggle={handleToggle}
            handleRemoveChecklistItem={handleRemoveChecklistItem}
            editingIndex={editingIndex}
            setEditingIndex={setEditingIndex}
            editingText={editingText}
            setEditingText={setEditingText}
            handleSaveInlineChecklistText={handleSaveInlineChecklistText}
            expandedItems={expandedItems}
            setExpandedItems={setExpandedItems}
            newSubItemText={newSubItemText}
            setNewSubItemText={setNewSubItemText}
            handleToggleSubItemClick={handleToggleSubItemClick}
            deleteSubItem={deleteSubItem}
            activeTaskId={activeTask._id}
            setLiveChecklist={setLiveChecklist}
            handleAddSubItemSubmit={handleAddSubItemSubmit}
            addSubItem={addSubItem}
            newChecklistText={newChecklistText}
            setNewChecklistText={setNewChecklistText}
            handleAddChecklistItem={handleAddChecklistItem}
            addChecklistItem={addChecklistItem}
            updateTask={updateTask}
            handleSaveDetails={handleSaveDetails}
          />

          {/* Action Footer */}
          <TaskActionFooter
            isEditing={isEditing}
            isCreatorOrAdmin={isCreatorOrAdmin}
            showDeleteConfirm={showDeleteConfirm}
            setShowDeleteConfirm={setShowDeleteConfirm}
            handleDeleteTask={handleDeleteTask}
            deletePending={deleteTask.isPending}
            isDirty={isDirty}
            setShowDiscardConfirm={setShowDiscardConfirm}
            setIsEditing={setIsEditing}
            handleSaveDetails={handleSaveDetails}
            updatePending={updateTask.isPending}
            onClose={onClose}
            activeTask={activeTask}
            isAdmin={isAdmin}
            handleOpenRejectModal={handleOpenRejectModal}
            handleSetStatus={handleSetStatus}
          />
        </DialogContent>
      </Dialog>

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
        handleConfirmReschedule={handleConfirmReschedule}
        handleQuickReschedulePreset={handleQuickReschedulePreset}
        onClose={onClose}
      />

      {/* Discard Changes Prompt */}
      {showDiscardConfirm && (
        <DiscardConfirmationDialog
          open={showDiscardConfirm}
          onOpenChange={setShowDiscardConfirm}
          onDiscard={() => {
            setShowDiscardConfirm(false);
            setIsEditing(false);
            onClose();
          }}
          onKeepEditing={() => setShowDiscardConfirm(false)}
        />
      )}
    </>
  );
}
