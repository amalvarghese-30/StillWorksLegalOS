import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, Tags, ListChecks, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTaskOptionsConfig, useUpdateTaskOptions } from "@/services/admin";
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function TaskOptionsSettings() {
    const { data, isLoading } = useTaskOptionsConfig();
    const update = useUpdateTaskOptions();
    const [categories, setCategories] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [agents, setAgents] = useState([]);
    useEffect(() => {
        if (data) {
            setCategories(data.categories ?? []);
            setTemplates(data.checklistTemplates ?? []);
            setAgents(data.agents ?? []);
        }
    }, [data]);
    if (isLoading) {
        return (_jsxs("p", { className: "flex items-center gap-2 text-helper text-muted-foreground", children: [_jsx(Loader2, { size: 16, className: "animate-spin" }), " Loading options\u2026"] }));
    }
    // ── Categories ──
    const updateCategory = (i, v) => setCategories((prev) => prev.map((c, idx) => (idx === i ? v : c)));
    const removeCategory = (i) => setCategories((prev) => prev.filter((_, idx) => idx !== i));
    const addCategory = () => setCategories((prev) => [...prev, ""]);
    // ── Agents ──
    const updateAgent = (i, v) => setAgents((prev) => prev.map((a, idx) => (idx === i ? v : a)));
    const removeAgent = (i) => setAgents((prev) => prev.filter((_, idx) => idx !== i));
    const addAgent = () => setAgents((prev) => [...prev, ""]);
    // ── Templates ──
    const addTemplate = () => setTemplates((prev) => [...prev, { name: "", items: [""] }]);
    const removeTemplate = (i) => setTemplates((prev) => prev.filter((_, idx) => idx !== i));
    const updateTemplateName = (i, v) => setTemplates((prev) => prev.map((t, idx) => (idx === i ? { ...t, name: v } : t)));
    const updateTemplateItem = (ti, ii, v) => setTemplates((prev) => prev.map((t, idx) => idx === ti ? { ...t, items: t.items.map((it, j) => (j === ii ? v : it)) } : t));
    const addTemplateItem = (ti) => setTemplates((prev) => prev.map((t, idx) => (idx === ti ? { ...t, items: [...t.items, ""] } : t)));
    const removeTemplateItem = (ti, ii) => setTemplates((prev) => prev.map((t, idx) => idx === ti ? { ...t, items: t.items.filter((_, j) => j !== ii) } : t));
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
    return (_jsxs("div", { className: "space-y-8", children: [_jsxs("section", { children: [_jsxs("div", { className: "mb-4 flex items-center justify-between", children: [_jsxs("div", { children: [_jsxs("h3", { className: "flex items-center gap-2 font-semibold", children: [_jsx(Tags, { size: 16, strokeWidth: 1.75, className: "text-muted-foreground" }), "Task categories"] }), _jsx("p", { className: "text-helper text-muted-foreground", children: "Shown in the task form's category dropdown." })] }), _jsxs(Button, { variant: "outline", size: "sm", className: "rounded-md", onClick: addCategory, children: [_jsx(Plus, { size: 14 }), " Add"] })] }), _jsxs("ul", { className: "space-y-2", children: [categories.map((c, i) => (_jsxs("li", { className: "flex items-center gap-2", children: [_jsx(Input, { value: c, onChange: (e) => updateCategory(i, e.target.value), placeholder: "Category name", className: "h-10 flex-1 rounded-md" }), _jsx("button", { type: "button", onClick: () => removeCategory(i), className: "grid size-9 shrink-0 place-items-center rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive", children: _jsx(Trash2, { size: 15 }) })] }, i))), categories.length === 0 && (_jsx("li", { className: "py-2 text-caption text-muted-foreground", children: "No categories yet." }))] })] }), _jsxs("section", { children: [_jsxs("div", { className: "mb-4 flex items-center justify-between", children: [_jsxs("div", { children: [_jsxs("h3", { className: "flex items-center gap-2 font-semibold", children: [_jsx(ListChecks, { size: 16, strokeWidth: 1.75, className: "text-muted-foreground" }), "Quick checklist templates"] }), _jsx("p", { className: "text-helper text-muted-foreground", children: "One-click subtask sets in the task form." })] }), _jsxs(Button, { variant: "outline", size: "sm", className: "rounded-md", onClick: addTemplate, children: [_jsx(Plus, { size: 14 }), " Add"] })] }), _jsxs("div", { className: "space-y-3", children: [templates.map((t, ti) => (_jsxs("div", { className: "rounded-lg border border-border p-4", children: [_jsxs("div", { className: "mb-3 flex items-center gap-2", children: [_jsx(Label, { className: "text-helper", children: "Template name" }), _jsx(Input, { value: t.name, onChange: (e) => updateTemplateName(ti, e.target.value), placeholder: "e.g. Agreement", className: "h-10 flex-1 rounded-md" }), _jsx("button", { type: "button", onClick: () => removeTemplate(ti), className: "grid size-9 shrink-0 place-items-center rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive", children: _jsx(Trash2, { size: 15 }) })] }), _jsxs("div", { className: "space-y-2", children: [t.items.map((item, ii) => (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Input, { value: item, onChange: (e) => updateTemplateItem(ti, ii, e.target.value), placeholder: "Subtask description", className: "h-10 flex-1 rounded-md" }), _jsx("button", { type: "button", onClick: () => removeTemplateItem(ti, ii), className: "grid size-9 shrink-0 place-items-center rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive", children: _jsx(Trash2, { size: 15 }) })] }, ii))), _jsxs(Button, { type: "button", variant: "ghost", size: "sm", className: "rounded-md", onClick: () => addTemplateItem(ti), children: [_jsx(Plus, { size: 14 }), " Add item"] })] })] }, ti))), templates.length === 0 && (_jsx("p", { className: "py-2 text-caption text-muted-foreground", children: "No templates yet." }))] })] }), _jsxs("section", { children: [_jsxs("div", { className: "mb-4 flex items-center justify-between", children: [_jsxs("div", { children: [_jsxs("h3", { className: "flex items-center gap-2 font-semibold", children: [_jsx(UserRound, { size: 16, strokeWidth: 1.75, className: "text-muted-foreground" }), "Brokers / Agents"] }), _jsx("p", { className: "text-helper text-muted-foreground", children: "Shown in the task form's agent dropdown." })] }), _jsxs(Button, { variant: "outline", size: "sm", className: "rounded-md", onClick: addAgent, children: [_jsx(Plus, { size: 14 }), " Add"] })] }), _jsxs("ul", { className: "space-y-2", children: [agents.map((a, i) => (_jsxs("li", { className: "flex items-center gap-2", children: [_jsx(Input, { value: a, onChange: (e) => updateAgent(i, e.target.value), placeholder: "Agent / broker name", className: "h-10 flex-1 rounded-md" }), _jsx("button", { type: "button", onClick: () => removeAgent(i), className: "grid size-9 shrink-0 place-items-center rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive", children: _jsx(Trash2, { size: 15 }) })] }, i))), agents.length === 0 && (_jsx("li", { className: "py-2 text-caption text-muted-foreground", children: "No agents yet." }))] })] }), _jsxs("div", { className: "flex items-center gap-3 border-t border-border pt-4", children: [_jsxs(Button, { type: "button", disabled: update.isPending, onClick: handleSave, className: "gradient-primary rounded-md text-primary-foreground shadow-soft", children: [update.isPending ? _jsx(Loader2, { size: 17, className: "animate-spin" }) : null, update.isPending ? "Saving…" : update.isSuccess ? "Saved ✓" : "Save changes"] }), update.isError && (_jsx("span", { className: "text-caption text-destructive", children: "Failed to save. Please try again." }))] })] }));
}
