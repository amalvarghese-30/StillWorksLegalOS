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
  useUpdateTask,
  useDeleteTask,
  useToggleChecklistItem,
  type TaskRecord,
  type ChecklistItem,
  type CreateTaskPayload,
} from "@/services/tasks";
import { useEmployees } from "@/services/admin";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface TaskDetailDialogProps {
  open: boolean;
  onClose: () => void;
  task: TaskRecord | null;
}

export function TaskDetailDialog({ open, onClose, task }: TaskDetailDialogProps) {
  if (!task) return null;

  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(task.title || "");
  const [description, setDescription] = useState(task.description || "");
  const [category, setCategory] = useState(task.category || "General");
  const [priority, setPriority] = useState(task.priority || "Medium");
  const [deadline, setDeadline] = useState(
    task.deadline ? new Date(task.deadline).toISOString().slice(0, 16) : ""
  );
  const [assignedTo, setAssignedTo] = useState(task.assignedTo?._id || "");
  const [newChecklistText, setNewChecklistText] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data: empData } = useEmployees(undefined, { enabled: isAdmin });
  const employees = empData?.employees ?? [];

  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const toggleItem = useToggleChecklistItem();

  useEffect(() => {
    if (task) {
      setTitle(task.title || "");
      setDescription(task.description || "");
      setCategory(task.category || "General");
      setPriority(task.priority || "Medium");
      setDeadline(task.deadline ? new Date(task.deadline).toISOString().slice(0, 16) : "");
      setAssignedTo(task.assignedTo?._id || "");
      setIsEditing(false);
      setNewChecklistText("");
    }
  }, [task]);

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

  const handleSaveDetails = async () => {
    try {
      const payload: Partial<CreateTaskPayload> = {
        title: title.trim(),
        description: description.trim(),
        category: category.trim(),
        priority,
      };
      if (deadline) payload.deadline = new Date(deadline).toISOString();
      if (assignedTo) payload.assignedTo = assignedTo;

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
                </div>
                <DialogTitle className="text-title font-semibold text-foreground pt-1">
                  {task.title}
                </DialogTitle>
                {task.caseName && (
                  <DialogDescription className="text-helper text-muted-foreground flex items-center gap-1.5">
                    <Briefcase size={13} />
                    {task.caseName}
                  </DialogDescription>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
                className="shrink-0 rounded-md"
              >
                <Edit2 size={14} className="mr-1.5" />
                {isEditing ? "View" : "Edit"}
              </Button>
            </div>
          </DialogHeader>

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
                <div className="rounded-md bg-muted/50 p-3 text-helper text-foreground/90">
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
                      {task.deadline
                        ? new Date(task.deadline).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "No deadline"}
                    </strong>
                  </span>
                </div>
              </div>
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

          <DialogFooter className="mt-6 flex items-center justify-between border-t border-border/60 pt-4">
            {isAdmin || (task.createdBy && (typeof task.createdBy === "object" ? (task.createdBy as any)._id : task.createdBy)?.toString() === user?._id?.toString()) ? (
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
            ) : (
              <div />
            )}
            <Button type="button" variant="outline" size="sm" onClick={onClose} className="rounded-md">
              Done
            </Button>
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
