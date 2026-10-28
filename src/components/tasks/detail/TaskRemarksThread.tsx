import React from "react";
import { MessageSquare, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveAvatarUrl } from "@/lib/avatarUrl";
import { toast } from "sonner";
import type { TaskRecord } from "@/services/tasks";

interface TaskRemarksThreadProps {
  activeTask: TaskRecord;
  user: any;
  newRemarkText: string;
  setNewRemarkText: (text: string) => void;
  addTaskRemark: any;
}

export function TaskRemarksThread({
  activeTask,
  user,
  newRemarkText,
  setNewRemarkText,
  addTaskRemark,
}: TaskRemarksThreadProps) {
  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 space-y-3.5 shadow-soft">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-md bg-primary/10 text-primary">
            <MessageSquare size={14} />
          </span>
          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Important Notes &amp; Remarks Thread
            </h5>
            <p className="text-[11px] text-muted-foreground">
              Any staff member can add notes, special instructions, or client updates at any time.
            </p>
          </div>
        </div>
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
          {activeTask.remarks?.length || 0} {activeTask.remarks?.length === 1 ? "note" : "notes"}
        </span>
      </div>

      {activeTask.remarks && activeTask.remarks.length > 0 ? (
        <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
          {activeTask.remarks.map((r, i) => {
            const authorName = (r as any).author || r.authorName || "Staff Member";
            const isMe = (r as any).authorId === user?._id || authorName === user?.name;
            const initials =
              authorName
                .split(" ")
                .map((w: string) => w[0])
                .filter(Boolean)
                .slice(0, 2)
                .join("")
                .toUpperCase() || "ST";

            return (
              <div
                key={r._id || (r as any).id || i}
                className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs transition-colors hover:border-primary/30"
              >
                <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground mb-1.5 flex-wrap">
                  <div className="flex items-center gap-2">
                    {isMe && resolveAvatarUrl(user?.avatarUrl) ? (
                      <img
                        src={resolveAvatarUrl(user.avatarUrl)}
                        alt={authorName}
                        className="size-6 rounded-full object-cover shrink-0"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : resolveAvatarUrl((r as any).authorAvatar) ? (
                      <img
                        src={resolveAvatarUrl((r as any).authorAvatar)}
                        alt={authorName}
                        className="size-6 rounded-full object-cover shrink-0"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <span className="grid size-6 place-items-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                        {initials}
                      </span>
                    )}
                    <span className="font-semibold text-foreground">{authorName}</span>
                    {isMe && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground uppercase">
                        You
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {r.createdAt
                      ? new Date(r.createdAt).toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })
                      : "—"}
                  </span>
                </div>
                <p className="text-foreground whitespace-pre-wrap leading-relaxed pl-8">
                  {r.text}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border/80 p-4 text-center">
          <p className="text-xs text-muted-foreground">
            No notes or remarks posted yet. Any staff member can add an important note below.
          </p>
        </div>
      )}

      {/* Add Note Form */}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!newRemarkText.trim() || addTaskRemark.isPending) return;
          try {
            await addTaskRemark.mutateAsync({ taskId: activeTask._id, text: newRemarkText.trim() });
            setNewRemarkText("");
            toast.success("Note added to thread");
          } catch (err: any) {
            toast.error(err?.message || "Failed to add note");
          }
        }}
        className="space-y-2 pt-1 border-t border-border/50"
      >
        <div className="relative">
          <textarea
            value={newRemarkText}
            onChange={(e) => setNewRemarkText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                if (newRemarkText.trim() && !addTaskRemark.isPending) {
                  addTaskRemark.mutate(
                    { taskId: activeTask._id, text: newRemarkText.trim() },
                    {
                      onSuccess: () => {
                        setNewRemarkText("");
                        toast.success("Note added to thread");
                      },
                      onError: (err: any) => {
                        toast.error(err?.message || "Failed to add note");
                      },
                    }
                  );
                }
              }
            }}
            placeholder="Add an important note, update, or remark for this task (Press Ctrl+Enter to post)…"
            rows={2}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/70 outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            Visible to all staff assigned or collaborating on this task
          </span>
          <Button
            type="submit"
            size="sm"
            disabled={!newRemarkText.trim() || addTaskRemark.isPending}
            className="h-8 px-3.5 text-xs gradient-primary text-primary-foreground font-semibold rounded-md shadow-soft"
          >
            {addTaskRemark.isPending ? (
              <Loader2 size={13} className="animate-spin mr-1.5" />
            ) : (
              <Send size={13} className="mr-1.5" />
            )}
            Add Note
          </Button>
        </div>
      </form>
    </div>
  );
}
