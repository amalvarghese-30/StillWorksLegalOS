import React from "react";
import {
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Check,
  CheckCheck,
  RotateCcw,
  Tag,
  Pencil,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import type { ChecklistItem, ChecklistSubItem } from "@/services/tasks";

interface TaskChecklistSectionProps {
  isEditing: boolean;
  setIsEditing: (val: boolean) => void;
  isDirty: boolean;
  setShowDiscardConfirm: (val: boolean) => void;
  editableChecklist: ChecklistItem[];
  setEditableChecklist: React.Dispatch<React.SetStateAction<ChecklistItem[]>>;
  checklist: ChecklistItem[];
  total: number;
  doneCount: number;
  pct: number;
  mainCategory: string;
  availableSubCategories: Array<{ _id?: string; name: string }>;
  liveChecklist: ChecklistItem[];
  handleAddSubCategoryToChecklist: (name: string) => void;
  handleAddAllSubCategoriesToChecklist: () => void;
  handleMarkAllChecklist: (done: boolean) => void;
  handleToggle: (item: ChecklistItem, idx: number) => void;
  handleRemoveChecklistItem: (idx: number) => void;
  editingIndex: number | null;
  setEditingIndex: (idx: number | null) => void;
  editingText: string;
  setEditingText: (t: string) => void;
  handleSaveInlineChecklistText: (idx: number) => void;
  expandedItems: Record<string, boolean>;
  setExpandedItems: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  newSubItemText: Record<string, string>;
  setNewSubItemText: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleToggleSubItemClick: (item: ChecklistItem, sub: ChecklistSubItem, itemIdx: number, subIdx: number) => void;
  deleteSubItem: any;
  activeTaskId: string;
  setLiveChecklist: React.Dispatch<React.SetStateAction<ChecklistItem[]>>;
  handleAddSubItemSubmit: (item: ChecklistItem, idx: number) => void;
  addSubItem: any;
  newChecklistText: string;
  setNewChecklistText: (t: string) => void;
  handleAddChecklistItem: (e: React.FormEvent) => void;
  addChecklistItem: any;
  updateTask: any;
  handleSaveDetails: () => void;
}

export function TaskChecklistSection({
  isEditing,
  setIsEditing,
  isDirty,
  setShowDiscardConfirm,
  editableChecklist,
  setEditableChecklist,
  checklist,
  total,
  doneCount,
  pct,
  mainCategory,
  availableSubCategories,
  liveChecklist,
  handleAddSubCategoryToChecklist,
  handleAddAllSubCategoriesToChecklist,
  handleMarkAllChecklist,
  handleToggle,
  handleRemoveChecklistItem,
  editingIndex,
  setEditingIndex,
  editingText,
  setEditingText,
  handleSaveInlineChecklistText,
  expandedItems,
  setExpandedItems,
  newSubItemText,
  setNewSubItemText,
  handleToggleSubItemClick,
  deleteSubItem,
  activeTaskId,
  setLiveChecklist,
  handleAddSubItemSubmit,
  addSubItem,
  newChecklistText,
  setNewChecklistText,
  handleAddChecklistItem,
  addChecklistItem,
  updateTask,
  handleSaveDetails,
}: TaskChecklistSectionProps) {
  return (
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

      {/* Subcategory checklist chips based on main category */}
      {mainCategory && availableSubCategories.length > 0 && (
        <div className="mb-3 rounded-md border border-primary/20 bg-primary/5 p-2.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
              <Tag size={12} className="text-primary" />
              Subcategory Checklist ({mainCategory}):
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleAddAllSubCategoriesToChecklist}
              className="h-6 px-2 text-[10px] text-primary hover:bg-primary/10 font-medium rounded"
            >
              <Plus size={11} className="mr-0.5" /> Add All Subcategories
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {availableSubCategories.map((sc) => {
              const currentList = isEditing ? editableChecklist : liveChecklist;
              const isAlreadyAdded = currentList.some(
                (c) => c.text.toLowerCase() === sc.name.toLowerCase()
              );
              return (
                <button
                  key={sc._id || sc.name}
                  type="button"
                  onClick={() => handleAddSubCategoryToChecklist(sc.name)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                    isAlreadyAdded
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium"
                      : "border-border/80 bg-background text-foreground/80 hover:border-primary hover:text-primary hover:bg-primary/5"
                  }`}
                  title={isAlreadyAdded ? "Already in checklist" : `Add "${sc.name}" as checklist step`}
                >
                  {isAlreadyAdded ? <Check size={10} className="text-emerald-600" /> : <Plus size={10} />}
                  {sc.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

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

                {item.remarks && (
                  <p className="text-[11px] text-muted-foreground italic pl-7 -mt-1 pb-1">
                    Note: {item.remarks}
                  </p>
                )}

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
                                    taskId: activeTaskId,
                                    itemId: item._id || item.id || String(idx),
                                    subId,
                                  });
                                } catch {
                                  // Handled in parent
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

                    {/* Add Sub-Item Inline Form */}
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

      {/* In Edit mode, show convenient Save All Changes bar */}
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
  );
}
