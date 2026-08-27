import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChecklistItem {
  _id?: string;
  text: string;
  done: boolean;
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
  status: "pending" | "in_progress" | "completed" | "overdue";
  deadline: string | null;
  assignedTo?: { _id: string; name: string };
  caseId?: string;
  caseName?: string;
  clientId?: string;
  clientName?: string;
  checklist: ChecklistItem[];
  callReminder?: CallReminder;
  agent?: string;
  isCall?: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TasksResponse {
  tasks: TaskRecord[];
  total: number;
  page: number;
  totalPages: number;
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  category?: string;
  priority?: string;
  deadline?: string;
  assignedTo?: string;
  caseId?: string;
  clientId?: string;
  checklist?: { text: string; done: boolean }[];
  callReminder?: {
    clientName: string;
    phone: string;
    scheduledAt: string;
    notes: string;
  };
  agent?: string;
  isCall?: boolean;
}

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation<{ task: TaskRecord }, Error, { id: string; data: Partial<CreateTaskPayload> }>({
    mutationFn: ({ id, data }) => api.patch(`/tasks/${id}`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: taskKeys.detail(vars.id) });
      qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation<{ message: string }, Error, string>({
    mutationFn: (id) => api.delete(`/tasks/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

export function useToggleChecklistItem() {
  const qc = useQueryClient();
  return useMutation<{ task: TaskRecord }, Error, { taskId: string; itemId: string; done: boolean }>({
    mutationFn: ({ taskId, itemId, done }) =>
      api.patch(`/tasks/${taskId}/checklist/${itemId}`, { done }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: taskKeys.detail(vars.taskId) });
      qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}
