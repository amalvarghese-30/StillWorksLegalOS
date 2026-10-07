import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "./api";
import { reportKeys } from "./reports";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChecklistSubItem {
  _id?: string;
  id?: string;
  text: string;
  done: boolean;
}

export interface ChecklistItem {
  _id?: string;
  id?: string;
  text: string;
  done: boolean;
  subItems?: ChecklistSubItem[];
}

export interface AssignmentHistoryEntry {
  _id?: string;
  fromUser?: { _id: string; name: string; email?: string } | null;
  toUser: { _id: string; name: string; email?: string };
  assignedBy: { _id: string; name: string; email?: string };
  action: "assigned" | "reassigned" | "forwarded";
  note?: string;
  timestamp: string;
}

export interface CallReminder {
  _id?: string;
  clientName: string;
  phone: string;
  scheduledAt: string;
  notes: string;
  completed: boolean;
}

export interface ChecklistTemplate {
  name: string;
  items: string[];
}

export interface TaskOptions {
  categories: string[];
  checklistTemplates: ChecklistTemplate[];
  agents: string[];
}

export interface StaffMember {
  _id: string;
  name: string;
}

export interface TaskOptionsResponse extends TaskOptions {
  staff: StaffMember[];
}

export interface TaskRecord {
  _id: string;
  title: string;
  description: string;
  category: string;
  priority: "High" | "Medium" | "Low";
  status: "pending" | "in_progress" | "pending_approval" | "completed" | "overdue";
  deadline: string | null;
  assignedTo?: { _id: string; name: string; email?: string; title?: string };
  assignedBy?: { _id: string; name: string; email?: string; title?: string };
  assignedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  submittedForApprovalAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  localPath?: string;
  assignmentHistory?: AssignmentHistoryEntry[];
  caseId?: string | { _id: string; title: string; number?: string } | null;
  caseName?: string;
  clientId?: string | { _id: string; name: string; phone?: string } | null;
  clientName?: string;
  checklist: ChecklistItem[];
  callReminder?: CallReminder;
  agent?: string;
  isCall?: boolean;
  createdBy: string | { _id: string; name: string; email?: string };
  createdAt: string;
  updatedAt: string;
}

export interface TasksResponse {
  tasks: TaskRecord[];
  total: number;
  page: number;
  totalPages: number;
  stats?: {
    total: number;
    overdue: number;
    dueToday: number;
    inProgress: number;
    inReview: number;
    completed: number;
    calls: number;
  };
}

export interface CreateTaskPayload {
  title: string;
  description?: string | undefined;
  category?: string | undefined;
  priority?: string | undefined;
  status?: "pending" | "in_progress" | "pending_approval" | "completed" | "overdue" | undefined;
  deadline?: string | undefined;
  assignedTo?: string | undefined;
  localPath?: string | undefined;
  caseId?: string | null | undefined;
  clientId?: string | null | undefined;
  checklist?: { text: string; done: boolean; subItems?: { text: string; done: boolean }[] }[] | undefined;
  callReminder?: {
    clientName: string;
    phone: string;
    scheduledAt: string;
    notes: string;
    completed?: boolean | undefined;
  } | undefined;
  agent?: string | undefined;
  isCall?: boolean | undefined;
}

export type UpdateTaskPayload = Partial<CreateTaskPayload>;

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const taskKeys = {
  all: ["tasks"] as const,
  list: (filters: Record<string, string>) => ["tasks", "list", filters] as const,
  detail: (id: string) => ["tasks", id] as const,
  options: ["tasks", "options"] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useTasks(filters: Record<string, string> = {}) {
  const params = new URLSearchParams(filters).toString();
  return useQuery<TasksResponse>({
    queryKey: taskKeys.list(filters),
    queryFn: () => api.get(`/tasks${params ? `?${params}` : ""}`),
  });
}

export function useTask(id?: string | null, initialData?: TaskRecord) {
  return useQuery<{ task: TaskRecord }>({
    queryKey: taskKeys.detail(id || ""),
    queryFn: () => api.get(`/tasks/${id}`),
    enabled: Boolean(id),
    initialData: initialData ? { task: initialData } : undefined,
    staleTime: 5 * 1000,
  });
}

export function updateTaskInQueryCache(qc: QueryClient, updatedTask: TaskRecord) {
  if (!updatedTask?._id) return;
  qc.setQueryData(taskKeys.detail(updatedTask._id), { task: updatedTask });
  qc.setQueriesData<TasksResponse>({ queryKey: taskKeys.all }, (old) => {
    if (!old || !Array.isArray(old.tasks)) return old;
    return {
      ...old,
      tasks: old.tasks.map((t) => (t._id === updatedTask._id ? { ...t, ...updatedTask } : t)),
    };
  });
}

export function useTaskOptions() {
  return useQuery<TaskOptionsResponse>({
    queryKey: taskKeys.options,
    queryFn: () => api.get("/tasks/options"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation<{ task: TaskRecord }, Error, CreateTaskPayload>({
    mutationFn: (payload) => api.post("/tasks", payload),
    onSuccess: (res) => {
      if (res?.task) updateTaskInQueryCache(qc, res.task);
      qc.invalidateQueries({ queryKey: taskKeys.all });
      qc.invalidateQueries({ queryKey: reportKeys.all });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation<{ task: TaskRecord }, Error, { id: string; data: Partial<CreateTaskPayload> }>({
    mutationFn: ({ id, data }) => api.patch(`/tasks/${id}`, data),
    onSuccess: (res, vars) => {
      if (res?.task) updateTaskInQueryCache(qc, res.task);
      qc.invalidateQueries({ queryKey: taskKeys.detail(vars.id) });
      qc.invalidateQueries({ queryKey: taskKeys.all });
      qc.invalidateQueries({ queryKey: reportKeys.all });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export interface DeleteTaskResult {
  message: string;
  alreadyDeleted?: boolean;
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation<DeleteTaskResult, Error, string>({
    mutationFn: async (id: string) => {
      try {
        return await api.delete<DeleteTaskResult>(`/tasks/${id}`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          return {
            message: "Task was already deleted or is no longer available.",
            alreadyDeleted: true,
          };
        }
        throw err;
      }
    },
    onSuccess: (_data, taskId) => {
      qc.removeQueries({ queryKey: taskKeys.detail(taskId) });
      qc.removeQueries({ queryKey: ["task", taskId] });
      qc.invalidateQueries({ queryKey: taskKeys.all });
      qc.invalidateQueries({ queryKey: ["calendar"] });
      qc.invalidateQueries({ queryKey: reportKeys.all });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useToggleChecklistItem() {
  const qc = useQueryClient();
  return useMutation<
    { task: TaskRecord },
    Error,
    { taskId: string; itemId: string; done?: boolean; text?: string; itemText?: string; subItems?: ChecklistSubItem[] }
  >({
    mutationFn: ({ taskId, itemId, ...body }) =>
      api.patch(`/tasks/${taskId}/checklist/${itemId}`, body),
    onSuccess: (res, vars) => {
      if (res?.task) updateTaskInQueryCache(qc, res.task);
      qc.invalidateQueries({ queryKey: taskKeys.detail(vars.taskId) });
      qc.invalidateQueries({ queryKey: taskKeys.all });
      qc.invalidateQueries({ queryKey: reportKeys.all });
    },
  });
}

export function useAddChecklistItem() {
  const qc = useQueryClient();
  return useMutation<{ task: TaskRecord }, Error, { taskId: string; text: string; subItems?: ChecklistSubItem[] }>({
    mutationFn: ({ taskId, text, subItems }) =>
      api.post(`/tasks/${taskId}/checklist`, { text, subItems }),
    onSuccess: (res, vars) => {
      if (res?.task) updateTaskInQueryCache(qc, res.task);
      qc.invalidateQueries({ queryKey: taskKeys.detail(vars.taskId) });
      qc.invalidateQueries({ queryKey: taskKeys.all });
      qc.invalidateQueries({ queryKey: reportKeys.all });
    },
  });
}

export function useDeleteChecklistItem() {
  const qc = useQueryClient();
  return useMutation<{ task: TaskRecord }, Error, { taskId: string; itemId: string }>({
    mutationFn: ({ taskId, itemId }) =>
      api.delete(`/tasks/${taskId}/checklist/${itemId}`),
    onSuccess: (res, vars) => {
      if (res?.task) updateTaskInQueryCache(qc, res.task);
      qc.invalidateQueries({ queryKey: taskKeys.detail(vars.taskId) });
      qc.invalidateQueries({ queryKey: taskKeys.all });
      qc.invalidateQueries({ queryKey: reportKeys.all });
    },
  });
}

export function useAddChecklistSubItem() {
  const qc = useQueryClient();
  return useMutation<{ task: TaskRecord }, Error, { taskId: string; itemId: string; text: string }>({
    mutationFn: ({ taskId, itemId, text }) =>
      api.post(`/tasks/${taskId}/checklist/${itemId}/subitems`, { text }),
    onSuccess: (res, vars) => {
      if (res?.task) updateTaskInQueryCache(qc, res.task);
      qc.invalidateQueries({ queryKey: taskKeys.detail(vars.taskId) });
      qc.invalidateQueries({ queryKey: taskKeys.all });
      qc.invalidateQueries({ queryKey: reportKeys.all });
    },
  });
}

export function useToggleChecklistSubItem() {
  const qc = useQueryClient();
  return useMutation<
    { task: TaskRecord },
    Error,
    { taskId: string; itemId: string; subId: string; done?: boolean; text?: string; subText?: string }
  >({
    mutationFn: ({ taskId, itemId, subId, done, text, subText }) =>
      api.patch(`/tasks/${taskId}/checklist/${itemId}`, { subItemId: subId, subDone: done, subText: text || subText }),
    onSuccess: (res, vars) => {
      if (res?.task) updateTaskInQueryCache(qc, res.task);
      qc.invalidateQueries({ queryKey: taskKeys.detail(vars.taskId) });
      qc.invalidateQueries({ queryKey: taskKeys.all });
      qc.invalidateQueries({ queryKey: reportKeys.all });
    },
  });
}

export function useDeleteChecklistSubItem() {
  const qc = useQueryClient();
  return useMutation<{ task: TaskRecord }, Error, { taskId: string; itemId: string; subId: string }>({
    mutationFn: ({ taskId, itemId, subId }) =>
      api.delete(`/tasks/${taskId}/checklist/${itemId}/subitems/${subId}`),
    onSuccess: (res, vars) => {
      if (res?.task) updateTaskInQueryCache(qc, res.task);
      qc.invalidateQueries({ queryKey: taskKeys.detail(vars.taskId) });
      qc.invalidateQueries({ queryKey: taskKeys.all });
      qc.invalidateQueries({ queryKey: reportKeys.all });
    },
  });
}

export const useAddSubItem = useAddChecklistSubItem;
export const useToggleSubItem = useToggleChecklistSubItem;
export const useDeleteSubItem = useDeleteChecklistSubItem;

export function useApproveTask() {
  const qc = useQueryClient();
  return useMutation<{ task: TaskRecord }, Error, { taskId: string }>({
    mutationFn: ({ taskId }) => api.post(`/tasks/${taskId}/approve`, {}),
    onSuccess: (res, vars) => {
      if (res?.task) updateTaskInQueryCache(qc, res.task);
      qc.invalidateQueries({ queryKey: taskKeys.detail(vars.taskId) });
      qc.invalidateQueries({ queryKey: taskKeys.all });
      qc.invalidateQueries({ queryKey: reportKeys.all });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useRejectTask() {
  const qc = useQueryClient();
  return useMutation<{ task: TaskRecord }, Error, { taskId: string; reason?: string }>({
    mutationFn: ({ taskId, reason }) => api.post(`/tasks/${taskId}/reject`, { reason }),
    onSuccess: (res, vars) => {
      if (res?.task) updateTaskInQueryCache(qc, res.task);
      qc.invalidateQueries({ queryKey: taskKeys.detail(vars.taskId) });
      qc.invalidateQueries({ queryKey: taskKeys.all });
      qc.invalidateQueries({ queryKey: reportKeys.all });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useForwardTask() {
  const qc = useQueryClient();
  return useMutation<{ task: TaskRecord }, Error, { taskId: string; toUserId: string; note?: string }>({
    mutationFn: ({ taskId, toUserId, note }) =>
      api.post(`/tasks/${taskId}/forward`, { toUserId, note }),
    onSuccess: (res, vars) => {
      if (res?.task) updateTaskInQueryCache(qc, res.task);
      qc.invalidateQueries({ queryKey: taskKeys.detail(vars.taskId) });
      qc.invalidateQueries({ queryKey: taskKeys.all });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useReassignTask() {
  const qc = useQueryClient();
  return useMutation<{ task: TaskRecord }, Error, { taskId: string; toUserId: string; note?: string }>({
    mutationFn: ({ taskId, toUserId, note }) =>
      api.post(`/tasks/${taskId}/reassign`, { toUserId, note }),
    onSuccess: (res, vars) => {
      if (res?.task) updateTaskInQueryCache(qc, res.task);
      qc.invalidateQueries({ queryKey: taskKeys.detail(vars.taskId) });
      qc.invalidateQueries({ queryKey: taskKeys.all });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

