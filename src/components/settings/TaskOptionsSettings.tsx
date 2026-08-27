import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, Tags, ListChecks, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTaskOptionsConfig, useUpdateTaskOptions } from "@/services/admin";
import type { ChecklistTemplate } from "@/services/tasks";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TaskOptionsSettings() {
  const { data, isLoading } = useTaskOptionsConfig();
  const update = useUpdateTaskOptions();

  const [categories, setCategories] = useState<string[]>([]);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [agents, setAgents] = useState<string[]>([]);

  useEffect(() => {
    if (data) {
      setCategories(data.categories ?? []);
      setTemplates(data.checklistTemplates ?? []);
      setAgents(data.agents ?? []);
    }
  }, [data]);

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-helper text-muted-foreground">
        <Loader2 size={16} className="animate-spin" /> Loading options…
      </p>
    );
  }

  // ── Categories ──
  const updateCategory = (i: number, v: string) =>
    setCategories((prev) => prev.map((c, idx) => (idx === i ? v : c)));
  const removeCategory = (i: number) =>
    setCategories((prev) => prev.filter((_, idx) => idx !== i));
  const addCategory = () => setCategories((prev) => [...prev, ""]);

  // ── Agents ──
  const updateAgent = (i: number, v: string) =>
    setAgents((prev) => prev.map((a, idx) => (idx === i ? v : a)));
  const removeAgent = (i: number) => setAgents((prev) => prev.filter((_, idx) => idx !== i));
  const addAgent = () => setAgents((prev) => [...prev, ""]);

  // ── Templates ──
  const addTemplate = () => setTemplates((prev) => [...prev, { name: "", items: [""] }]);
  const removeTemplate = (i: number) =>
    setTemplates((prev) => prev.filter((_, idx) => idx !== i));
  const updateTemplateName = (i: number, v: string) =>
    setTemplates((prev) => prev.map((t, idx) => (idx === i ? { ...t, name: v } : t)));
  const updateTemplateItem = (ti: number, ii: number, v: string) =>
    setTemplates((prev) =>
      prev.map((t, idx) =>
        idx === ti ? { ...t, items: t.items.map((it, j) => (j === ii ? v : it)) } : t,
      ),
    );
  const addTemplateItem = (ti: number) =>
    setTemplates((prev) =>
      prev.map((t, idx) => (idx === ti ? { ...t, items: [...t.items, ""] } : t)),
    );
  const removeTemplateItem = (ti: number, ii: number) =>
    setTemplates((prev) =>
      prev.map((t, idx) =>
        idx === ti ? { ...t, items: t.items.filter((_, j) => j !== ii) } : t,
      ),
    );

  const handleSave = () => {
    update.mutate({
      categories: categories.map((c) => c.trim()).filter(Boolean),
      checklistTemplates: templates
        .map((t) => ({
          name: t.name.trim(),
          items: t.items.map((i) => i.trim()).filter(Boolean),
        }))
        .filter((t) => t.name.length > 0 && t.items.length > 0),
      agents: agents.map((a) => a.trim()).filter(Boolean),
    });
  };

  return (
    <div className="space-y-8">
      {/* Categories */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-semibold">
              <Tags size={16} strokeWidth={1.75} className="text-muted-foreground" />
              Task categories
            </h3>
            <p className="text-helper text-muted-foreground">
              Shown in the task form's category dropdown.
            </p>
          </div>
          <Button variant="outline" size="sm" className="rounded-md" onClick={addCategory}>
            <Plus size={14} /> Add
          </Button>
        </div>
        <ul className="space-y-2">
          {categories.map((c, i) => (
            <li key={i} className="flex items-center gap-2">
              <Input
                value={c}
                onChange={(e) => updateCategory(i, e.target.value)}
                placeholder="Category name"
                className="h-10 flex-1 rounded-md"
              />
              <button
                type="button"
                onClick={() => removeCategory(i)}
                className="grid size-9 shrink-0 place-items-center rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
          {categories.length === 0 && (
            <li className="py-2 text-caption text-muted-foreground">No categories yet.</li>
          )}
        </ul>
      </section>

      {/* Checklist templates */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-semibold">
              <ListChecks size={16} strokeWidth={1.75} className="text-muted-foreground" />
              Quick checklist templates
            </h3>
            <p className="text-helper text-muted-foreground">
              One-click subtask sets in the task form.
            </p>
          </div>
          <Button variant="outline" size="sm" className="rounded-md" onClick={addTemplate}>
            <Plus size={14} /> Add
          </Button>
        </div>
        <div className="space-y-3">
          {templates.map((t, ti) => (
            <div key={ti} className="rounded-lg border border-border p-4">
              <div className="mb-3 flex items-center gap-2">
                <Label className="text-helper">Template name</Label>
                <Input
                  value={t.name}
                  onChange={(e) => updateTemplateName(ti, e.target.value)}
                  placeholder="e.g. Agreement"
                  className="h-10 flex-1 rounded-md"
                />
                <button
                  type="button"
                  onClick={() => removeTemplate(ti)}
                  className="grid size-9 shrink-0 place-items-center rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="space-y-2">
                {t.items.map((item, ii) => (
                  <div key={ii} className="flex items-center gap-2">
                    <Input
                      value={item}
                      onChange={(e) => updateTemplateItem(ti, ii, e.target.value)}
                      placeholder="Subtask description"
                      className="h-10 flex-1 rounded-md"
                    />
                    <button
                      type="button"
                      onClick={() => removeTemplateItem(ti, ii)}
                      className="grid size-9 shrink-0 place-items-center rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-md"
                  onClick={() => addTemplateItem(ti)}
                >
                  <Plus size={14} /> Add item
                </Button>
              </div>
            </div>
          ))}
          {templates.length === 0 && (
            <p className="py-2 text-caption text-muted-foreground">No templates yet.</p>
          )}
        </div>
      </section>

      {/* Agents */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-semibold">
              <UserRound size={16} strokeWidth={1.75} className="text-muted-foreground" />
              Brokers / Agents
            </h3>
            <p className="text-helper text-muted-foreground">
              Shown in the task form's agent dropdown.
            </p>
          </div>
          <Button variant="outline" size="sm" className="rounded-md" onClick={addAgent}>
            <Plus size={14} /> Add
          </Button>
        </div>
        <ul className="space-y-2">
          {agents.map((a, i) => (
            <li key={i} className="flex items-center gap-2">
              <Input
                value={a}
                onChange={(e) => updateAgent(i, e.target.value)}
                placeholder="Agent / broker name"
                className="h-10 flex-1 rounded-md"
              />
              <button
                type="button"
                onClick={() => removeAgent(i)}
                className="grid size-9 shrink-0 place-items-center rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
          {agents.length === 0 && (
            <li className="py-2 text-caption text-muted-foreground">No agents yet.</li>
          )}
        </ul>
      </section>

      {/* Save */}
      <div className="flex items-center gap-3 border-t border-border pt-4">
        <Button
          type="button"
          disabled={update.isPending}
          onClick={handleSave}
          className="gradient-primary rounded-md text-primary-foreground shadow-soft"
        >
          {update.isPending ? <Loader2 size={17} className="animate-spin" /> : null}
          {update.isPending ? "Saving…" : update.isSuccess ? "Saved ✓" : "Save changes"}
        </Button>
        {update.isError && (
          <span className="text-caption text-destructive">Failed to save. Please try again.</span>
        )}
      </div>
    </div>
  );
}
