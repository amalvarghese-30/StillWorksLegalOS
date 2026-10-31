import { useState, useMemo } from "react";
import {
  Folder,
  FolderOpen,
  FileText,
  Tag,
  ChevronRight,
  ChevronDown,
  Plus,
  Search,
  Edit2,
  Move,
  Trash2,
  AlertTriangle,
  Layers,
  Briefcase,
  CheckCircle2,
  XCircle,
  Loader2,
  MoreVertical,
  ArrowRightLeft,
  Info,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useCategoryTree,
  useCreateCategory,
  useUpdateCategory,
  useSetCategoryStatus,
  useMoveCategory,
  useDeleteCategory,
  useMigrateCategory,
  useCategoryUsage,
  type CategoryNode,
  type CreateCategoryPayload,
} from "@/services/categories";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FilterStatus = "all" | "active" | "inactive";

interface CategoryFlattened {
  node: CategoryNode;
  level: number;
  parentName?: string;
  ancestorNames: string[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CategoryManagementSettings() {
  const { data: tree = [], isLoading, isFetching, refetch } = useCategoryTree({ includeInactive: true });

  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const setStatus = useSetCategoryStatus();
  const moveCategory = useMoveCategory();
  const deleteCategory = useDeleteCategory();
  const migrateCategory = useMigrateCategory();

  // Search & Filter state
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [usageDialogOpen, setUsageDialogOpen] = useState(false);
  const [deactivateConfirmOpen, setDeactivateConfirmOpen] = useState(false);

  // Selected nodes for dialogs
  const [activeParentNode, setActiveParentNode] = useState<CategoryNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<CategoryNode | null>(null);

  // Add category form
  const [addName, setAddName] = useState("");
  const [addParentId, setAddParentId] = useState<string>("");
  const [addType, setAddType] = useState<"legal" | "admin" | "custom">("legal");
  const [addDescription, setAddDescription] = useState("");
  const [addDisplayOrder, setAddDisplayOrder] = useState<number>(0);

  // Edit category form
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editType, setEditType] = useState<"legal" | "admin" | "custom">("legal");
  const [editDisplayOrder, setEditDisplayOrder] = useState<number>(0);

  // Move category form
  const [targetParentId, setTargetParentId] = useState<string>("");

  // Migrate form
  const [targetMigrationId, setTargetMigrationId] = useState<string>("");

  // Usage query
  const { data: usageData, isLoading: isUsageLoading, refetch: refetchUsage } = useCategoryUsage(
    selectedNode ? selectedNode._id : null
  );

  // ---------------------------------------------------------------------------
  // Flattened category lookup for parent pickers
  // ---------------------------------------------------------------------------
  const allCategoriesFlattened = useMemo(() => {
    const list: CategoryFlattened[] = [];

    function traverse(node: CategoryNode, ancestorNames: string[] = []) {
      list.push({
        node,
        level: node.level,
        parentName: ancestorNames[ancestorNames.length - 1],
        ancestorNames,
      });
      if (Array.isArray(node.children)) {
        for (const child of node.children) {
          traverse(child, [...ancestorNames, node.name]);
        }
      }
    }

    for (const root of tree) {
      traverse(root, []);
    }
    return list;
  }, [tree]);

  // ---------------------------------------------------------------------------
  // Top Metrics
  // ---------------------------------------------------------------------------
  const metrics = useMemo(() => {
    let activeMain = 0;
    let activeSubs = 0;
    let inactive = 0;

    for (const item of allCategoriesFlattened) {
      const isAct = item.node.isActive !== false;
      if (!isAct) {
        inactive++;
      } else if (item.level === 1) {
        activeMain++;
      } else {
        activeSubs++;
      }
    }

    return { activeMain, activeSubs, inactive, total: allCategoriesFlattened.length };
  }, [allCategoriesFlattened]);

  // ---------------------------------------------------------------------------
  // Filter & Search Logic
  // ---------------------------------------------------------------------------
  const filteredTree = useMemo(() => {
    const query = search.trim().toLowerCase();

    function matchNode(node: CategoryNode): boolean {
      if (filterStatus === "active" && node.isActive === false) return false;
      if (filterStatus === "inactive" && node.isActive !== false) return false;

      if (!query) return true;
      if (node.name.toLowerCase().includes(query)) return true;
      if (node.description?.toLowerCase().includes(query)) return true;

      // Match if any child matches
      if (Array.isArray(node.children) && node.children.some(matchNode)) return true;

      return false;
    }

    function cloneAndFilter(node: CategoryNode): CategoryNode | null {
      const selfMatchesStatus =
        filterStatus === "all" ||
        (filterStatus === "active" && node.isActive !== false) ||
        (filterStatus === "inactive" && node.isActive === false);

      const selfMatchesQuery = !query || node.name.toLowerCase().includes(query);

      let filteredChildren: CategoryNode[] = [];
      if (Array.isArray(node.children)) {
        filteredChildren = node.children
          .map(cloneAndFilter)
          .filter((c): c is CategoryNode => c !== null);
      }

      if (filteredChildren.length > 0 || (selfMatchesStatus && selfMatchesQuery)) {
        return {
          ...node,
          children: filteredChildren,
        };
      }

      return null;
    }

    return tree.map(cloneAndFilter).filter((c): c is CategoryNode => c !== null);
  }, [tree, search, filterStatus]);

  // ---------------------------------------------------------------------------
  // Expand / Collapse Handlers
  // ---------------------------------------------------------------------------
  const toggleExpand = (id: string) => {
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleExpandAll = () => {
    const next: Record<string, boolean> = {};
    for (const item of allCategoriesFlattened) {
      if (Array.isArray(item.node.children) && item.node.children.length > 0) {
        next[item.node._id] = true;
      }
    }
    setExpandedNodes(next);
  };

  const handleCollapseAll = () => {
    setExpandedNodes({});
  };

  // ---------------------------------------------------------------------------
  // Dialog Openers
  // ---------------------------------------------------------------------------
  const handleOpenAdd = (parent?: CategoryNode | null) => {
    setActiveParentNode(parent || null);
    setAddParentId(parent ? parent._id : "");
    setAddName("");
    setAddDescription("");
    setAddType(parent ? (parent.categoryType as any) || "legal" : "legal");
    setAddDisplayOrder(0);
    setAddDialogOpen(true);
  };

  const handleOpenEdit = (node: CategoryNode) => {
    setSelectedNode(node);
    setEditName(node.name);
    setEditDescription(node.description || "");
    setEditType((node.categoryType as any) || "legal");
    setEditDisplayOrder(node.displayOrder || 0);
    setEditDialogOpen(true);
  };

  const handleOpenMove = (node: CategoryNode) => {
    setSelectedNode(node);
    setTargetParentId(node.parentId || "");
    setMoveDialogOpen(true);
  };

  const handleOpenUsage = (node: CategoryNode) => {
    setSelectedNode(node);
    setTargetMigrationId("");
    setUsageDialogOpen(true);
  };

  const handleToggleStatus = (node: CategoryNode) => {
    const nextStatus = !(node.isActive !== false);
    if (!nextStatus) {
      // Deactivating: confirm
      setSelectedNode(node);
      setDeactivateConfirmOpen(true);
    } else {
      // Activating: execute immediately
      setStatus.mutate(
        { id: node._id, isActive: true },
        {
          onSuccess: () => toast.success(`Category "${node.name}" activated`),
          onError: (err: any) => toast.error(err?.message || "Failed to activate category"),
        }
      );
    }
  };

  // ---------------------------------------------------------------------------
  // Mutation Submit Handlers
  // ---------------------------------------------------------------------------
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim()) {
      toast.error("Category name is required");
      return;
    }

    const payload: CreateCategoryPayload = {
      name: addName.trim(),
      parentId: addParentId ? addParentId : null,
      description: addDescription.trim() || undefined,
      categoryType: addType,
      displayOrder: Number(addDisplayOrder) || 0,
    };

    createCategory.mutate(payload, {
      onSuccess: (res) => {
        toast.success(`Category "${res.category?.name || addName}" created successfully`);
        setAddDialogOpen(false);
        // Ensure parent is expanded
        if (addParentId) {
          setExpandedNodes((prev) => ({ ...prev, [addParentId]: true }));
        }
      },
      onError: (err: any) => {
        toast.error(err?.message || "Failed to create category");
      },
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNode) return;
    if (!editName.trim()) {
      toast.error("Category name cannot be empty");
      return;
    }

    updateCategory.mutate(
      {
        id: selectedNode._id,
        name: editName.trim(),
        description: editDescription.trim(),
        categoryType: editType,
        displayOrder: Number(editDisplayOrder) || 0,
      },
      {
        onSuccess: (res) => {
          toast.success(`Category "${res.category?.name || editName}" updated`);
          setEditDialogOpen(false);
        },
        onError: (err: any) => {
          toast.error(err?.message || "Failed to update category");
        },
      }
    );
  };

  const handleMoveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNode) return;

    const newParentId = targetParentId.trim() ? targetParentId.trim() : null;
    if (newParentId === selectedNode.parentId) {
      setMoveDialogOpen(false);
      return;
    }

    moveCategory.mutate(
      {
        id: selectedNode._id,
        targetParentId: newParentId,
      },
      {
        onSuccess: () => {
          toast.success(`Category "${selectedNode.name}" moved successfully`);
          setMoveDialogOpen(false);
          if (newParentId) {
            setExpandedNodes((prev) => ({ ...prev, [newParentId]: true }));
          }
        },
        onError: (err: any) => {
          toast.error(err?.message || "Failed to move category");
        },
      }
    );
  };

  const handleDeactivateConfirm = () => {
    if (!selectedNode) return;
    setStatus.mutate(
      { id: selectedNode._id, isActive: false },
      {
        onSuccess: () => {
          toast.success(`Category "${selectedNode.name}" deactivated`);
          setDeactivateConfirmOpen(false);
        },
        onError: (err: any) => {
          toast.error(err?.message || "Failed to deactivate category");
        },
      }
    );
  };

  const handleDeleteCategory = (node: CategoryNode) => {
    deleteCategory.mutate(node._id, {
      onSuccess: () => {
        toast.success(`Category "${node.name}" permanently deleted`);
        setUsageDialogOpen(false);
      },
      onError: (err: any) => {
        toast.error(err?.message || "Failed to delete category");
      },
    });
  };

  const handleMigrateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNode || !targetMigrationId) {
      toast.error("Please select a target category for migration");
      return;
    }

    migrateCategory.mutate(
      {
        id: selectedNode._id,
        targetCategoryId: targetMigrationId,
      },
      {
        onSuccess: (res) => {
          toast.success(
            `Migrated ${res.casesMigrated || 0} cases and ${res.tasksMigrated || 0} tasks successfully`
          );
          refetchUsage();
        },
        onError: (err: any) => {
          toast.error(err?.message || "Migration failed");
        },
      }
    );
  };

  // ---------------------------------------------------------------------------
  // Available destination parents for Move dialog
  // ---------------------------------------------------------------------------
  const availableMoveTargets = useMemo(() => {
    if (!selectedNode) return [];
    return allCategoriesFlattened.filter((item) => {
      // Cannot move under self
      if (item.node._id === selectedNode._id) return false;
      // Cannot move under descendants
      if (item.ancestorNames.includes(selectedNode.name)) return false;
      // Max parent level for destination is 2 (so category becomes level 3)
      if (item.level >= 3) return false;
      return true;
    });
  }, [selectedNode, allCategoriesFlattened]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* ── HEADER & INTRO ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Layers size={20} className="text-primary" />
            Category Management
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 max-w-2xl">
            Manage legal and administrative main categories, work types, and nested subcategories. Changes synchronize dynamically across cases, clients, and task workflows in real time.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-9 gap-1.5 text-xs rounded-md"
          >
            <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
            Sync
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => handleOpenAdd(null)}
            className="h-9 gap-1.5 text-xs font-semibold gradient-primary text-primary-foreground rounded-md shadow-xs"
          >
            <Plus size={15} strokeWidth={2.5} />
            Add Main Category
          </Button>
        </div>
      </div>

      {/* ── SUMMARY METRICS CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border border-border bg-card/60 shadow-xs">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
            Main Categories
          </span>
          <span className="text-2xl font-bold text-foreground mt-1 block">
            {metrics.activeMain}
          </span>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card/60 shadow-xs">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
            Subcategories
          </span>
          <span className="text-2xl font-bold text-primary mt-1 block">
            {metrics.activeSubs}
          </span>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card/60 shadow-xs">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
            Inactive
          </span>
          <span className={`text-2xl font-bold mt-1 block ${metrics.inactive > 0 ? "text-amber-500" : "text-muted-foreground"}`}>
            {metrics.inactive}
          </span>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card/60 shadow-xs">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
            Total Records
          </span>
          <span className="text-2xl font-bold text-foreground mt-1 block">
            {metrics.total}
          </span>
        </div>
      </div>

      {/* ── SEARCH & FILTER CONTROLS ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories and subcategories…"
            className="h-9 pl-9 text-xs rounded-md border-border bg-background"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Status Filter Tabs */}
          <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
            {(["all", "active", "inactive"] as FilterStatus[]).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1 rounded-md font-medium capitalize transition-all ${
                  filterStatus === st
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Expand / Collapse all */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleExpandAll}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
            title="Expand all hierarchy levels"
          >
            Expand
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCollapseAll}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
            title="Collapse all levels"
          >
            Collapse
          </Button>
        </div>
      </div>

      {/* ── CATEGORY HIERARCHY TREE ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs divide-y divide-border">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
            <Loader2 size={24} className="animate-spin text-primary" />
            <span className="text-sm">Loading category hierarchy…</span>
          </div>
        ) : filteredTree.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Layers size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">No categories match your filter criteria.</p>
            {search && (
              <Button
                variant="link"
                size="sm"
                onClick={() => setSearch("")}
                className="mt-1 text-xs"
              >
                Clear search query
              </Button>
            )}
          </div>
        ) : (
          filteredTree.map((mainNode) => (
            <CategoryItemRow
              key={mainNode._id}
              node={mainNode}
              level={1}
              expandedNodes={expandedNodes}
              toggleExpand={toggleExpand}
              onAddChild={handleOpenAdd}
              onEdit={handleOpenEdit}
              onMove={handleOpenMove}
              onUsage={handleOpenUsage}
              onToggleStatus={handleToggleStatus}
            />
          ))
        )}
      </div>

      {/* ── DIALOG: ADD CATEGORY ── */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {activeParentNode
                ? `Add Subcategory under "${activeParentNode.name}"`
                : "Add New Main Category"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {activeParentNode
                ? `Will be created at Level ${activeParentNode.level + 1} under "${activeParentNode.name}".`
                : "Creates a Level-1 main category at the root level of LegalOS."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="add-cat-name" className="text-xs font-semibold">
                Category Name *
              </Label>
              <Input
                id="add-cat-name"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="e.g. COMMERCIAL LITIGATION"
                className="h-10 text-sm"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="add-cat-parent" className="text-xs font-semibold">
                Parent Category
              </Label>
              <select
                id="add-cat-parent"
                value={addParentId}
                onChange={(e) => {
                  const val = e.target.value;
                  setAddParentId(val);
                  const parentItem = allCategoriesFlattened.find((c) => c.node._id === val);
                  setActiveParentNode(parentItem ? parentItem.node : null);
                }}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-xs outline-none focus:border-primary"
              >
                <option value="">-- None (Level 1 Main Category) --</option>
                {allCategoriesFlattened
                  .filter((item) => item.level < 3)
                  .map((item) => (
                    <option key={item.node._id} value={item.node._id}>
                      {item.level === 1 ? `● ${item.node.name}` : `    ↳ ${item.node.name}`} (Level {item.level})
                    </option>
                  ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="add-cat-type" className="text-xs font-semibold">
                  Category Type
                </Label>
                <select
                  id="add-cat-type"
                  value={addType}
                  onChange={(e) => setAddType(e.target.value as any)}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-xs outline-none focus:border-primary"
                >
                  <option value="legal">Legal Work</option>
                  <option value="admin">Office Admin</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-cat-order" className="text-xs font-semibold">
                  Display Order
                </Label>
                <Input
                  id="add-cat-order"
                  type="number"
                  value={addDisplayOrder}
                  onChange={(e) => setAddDisplayOrder(parseInt(e.target.value, 10) || 0)}
                  className="h-10 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="add-cat-desc" className="text-xs font-semibold">
                Description (Optional)
              </Label>
              <Input
                id="add-cat-desc"
                value={addDescription}
                onChange={(e) => setAddDescription(e.target.value)}
                placeholder="Optional purpose, notes or statutory reference"
                className="h-10 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createCategory.isPending || !addName.trim()}
                className="gradient-primary text-primary-foreground font-semibold"
              >
                {createCategory.isPending ? <Loader2 size={15} className="animate-spin mr-1.5" /> : null}
                Create Category
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: EDIT CATEGORY ── */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              Edit Category: {selectedNode?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Level {selectedNode?.level} category • ID: {selectedNode?._id}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-cat-name" className="text-xs font-semibold">
                Category Name *
              </Label>
              <Input
                id="edit-cat-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Category name"
                className="h-10 text-sm font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-cat-type" className="text-xs font-semibold">
                  Category Type
                </Label>
                <select
                  id="edit-cat-type"
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as any)}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-xs outline-none focus:border-primary"
                >
                  <option value="legal">Legal Work</option>
                  <option value="admin">Office Admin</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-cat-order" className="text-xs font-semibold">
                  Display Order
                </Label>
                <Input
                  id="edit-cat-order"
                  type="number"
                  value={editDisplayOrder}
                  onChange={(e) => setEditDisplayOrder(parseInt(e.target.value, 10) || 0)}
                  className="h-10 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-cat-desc" className="text-xs font-semibold">
                Description
              </Label>
              <Input
                id="edit-cat-desc"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Optional notes or description"
                className="h-10 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={updateCategory.isPending || !editName.trim()}
                className="gradient-primary text-primary-foreground font-semibold"
              >
                {updateCategory.isPending ? <Loader2 size={15} className="animate-spin mr-1.5" /> : null}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: MOVE CATEGORY ── */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Move size={17} className="text-primary" />
              Move Category: {selectedNode?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Select a new parent category. Ancestor paths and descendant hierarchy levels will be automatically recalculated.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleMoveSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="move-target-parent" className="text-xs font-semibold">
                New Parent Destination
              </Label>
              <select
                id="move-target-parent"
                value={targetParentId}
                onChange={(e) => setTargetParentId(e.target.value)}
                className="h-11 w-full rounded-md border border-border bg-background px-3 text-xs outline-none focus:border-primary"
              >
                <option value="">-- Root Level (Make Level 1 Main Category) --</option>
                {availableMoveTargets.map((item) => (
                  <option key={item.node._id} value={item.node._id}>
                    {item.level === 1 ? `● ${item.node.name}` : `    ↳ ${item.node.name}`} (Level {item.level})
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground flex gap-2">
              <Info size={16} className="shrink-0 text-primary mt-0.5" />
              <span>
                Moving a category preserves its complete subtree of subcategories. The maximum supported hierarchy depth across LegalOS is 3 levels.
              </span>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMoveDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={moveCategory.isPending}
                className="gradient-primary text-primary-foreground font-semibold"
              >
                {moveCategory.isPending ? <Loader2 size={15} className="animate-spin mr-1.5" /> : null}
                Confirm Move
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: CATEGORY USAGE & SAFE DELETION / MIGRATION ── */}
      <Dialog open={usageDialogOpen} onOpenChange={setUsageDialogOpen}>
        <DialogContent className="sm:max-w-lg rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Briefcase size={17} className="text-primary" />
              Record Usage &amp; Maintenance: {selectedNode?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Inspect linked cases and tasks before performing permanent removal or controlled record migration.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {isUsageLoading ? (
              <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
                <Loader2 size={20} className="animate-spin text-primary" />
                <span className="text-xs">Calculating record usage…</span>
              </div>
            ) : usageData ? (
              <>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="p-3 rounded-lg border border-border bg-card/60 text-center">
                    <span className="text-[10px] text-muted-foreground uppercase font-medium">Subcategories</span>
                    <span className="text-xl font-bold block mt-0.5">{usageData.childCount}</span>
                  </div>
                  <div className="p-3 rounded-lg border border-border bg-card/60 text-center">
                    <span className="text-[10px] text-muted-foreground uppercase font-medium">Linked Cases</span>
                    <span className="text-xl font-bold text-primary block mt-0.5">{usageData.casesCount}</span>
                  </div>
                  <div className="p-3 rounded-lg border border-border bg-card/60 text-center">
                    <span className="text-[10px] text-muted-foreground uppercase font-medium">Linked Tasks</span>
                    <span className="text-xl font-bold text-primary block mt-0.5">{usageData.tasksCount}</span>
                  </div>
                </div>

                {usageData.totalRecords > 0 || usageData.childCount > 0 ? (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold">
                      <AlertTriangle size={15} />
                      Permanent Deletion Blocked
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      {usageData.childCount > 0
                        ? `This category contains ${usageData.childCount} active child category(ies). Move or delete its children before deleting this category.`
                        : `This category is actively referenced by ${usageData.casesCount} case(s) and ${usageData.tasksCount} task(s). Deactivate the category instead, or migrate all records to a replacement category below.`}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5 space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold">
                      <CheckCircle2 size={15} />
                      Safe for Permanent Deletion
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      Zero child categories and zero active cases or tasks reference this category. It can be safely deleted without orphaning any records.
                    </p>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => selectedNode && handleDeleteCategory(selectedNode)}
                      disabled={deleteCategory.isPending}
                      className="mt-1"
                    >
                      {deleteCategory.isPending ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Trash2 size={14} className="mr-1.5" />}
                      Permanently Delete Category
                    </Button>
                  </div>
                )}

                {/* Controlled Record Migration Form */}
                {usageData.totalRecords > 0 && (
                  <form onSubmit={handleMigrateSubmit} className="space-y-3 pt-2 border-t border-border">
                    <div>
                      <Label htmlFor="migrate-target-category" className="text-xs font-semibold">
                        Migrate All Records to Replacement Category
                      </Label>
                      <p className="text-[11px] text-muted-foreground mt-0.5 mb-1.5">
                        Updates all linked cases and tasks safely to the chosen replacement category.
                      </p>
                      <select
                        id="migrate-target-category"
                        value={targetMigrationId}
                        onChange={(e) => setTargetMigrationId(e.target.value)}
                        className="h-10 w-full rounded-md border border-border bg-background px-3 text-xs outline-none focus:border-primary"
                      >
                        <option value="">-- Select Replacement Category --</option>
                        {allCategoriesFlattened
                          .filter((item) => item.node._id !== selectedNode?._id && item.node.isActive !== false)
                          .map((item) => (
                            <option key={item.node._id} value={item.node._id}>
                              {item.ancestorNames.length > 0 ? `${item.ancestorNames.join(" > ")} > ` : ""}{item.node.name}
                            </option>
                          ))}
                      </select>
                    </div>

                    <Button
                      type="submit"
                      size="sm"
                      disabled={migrateCategory.isPending || !targetMigrationId}
                      className="gap-1.5 text-xs font-semibold"
                    >
                      {migrateCategory.isPending ? <Loader2 size={14} className="animate-spin" /> : <ArrowRightLeft size={14} />}
                      Migrate {usageData.totalRecords} Records
                    </Button>
                  </form>
                )}
              </>
            ) : null}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setUsageDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: CONFIRM DEACTIVATION ── */}
      <Dialog open={deactivateConfirmOpen} onOpenChange={setDeactivateConfirmOpen}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle size={17} />
              Deactivate Category: {selectedNode?.name}?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed pt-1">
              Deactivating this category will hide it from new case, client, and task creation forms. Existing cases and historical tasks will continue to display this category name and will not be altered.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeactivateConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDeactivateConfirm}
              disabled={setStatus.isPending}
            >
              {setStatus.isPending ? <Loader2 size={14} className="animate-spin mr-1.5" /> : null}
              Confirm Deactivation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category Item Row Component (Recursive tree view)
// ---------------------------------------------------------------------------

interface CategoryItemRowProps {
  node: CategoryNode;
  level: number;
  expandedNodes: Record<string, boolean>;
  toggleExpand: (id: string) => void;
  onAddChild: (parent: CategoryNode) => void;
  onEdit: (node: CategoryNode) => void;
  onMove: (node: CategoryNode) => void;
  onUsage: (node: CategoryNode) => void;
  onToggleStatus: (node: CategoryNode) => void;
}

function CategoryItemRow({
  node,
  level,
  expandedNodes,
  toggleExpand,
  onAddChild,
  onEdit,
  onMove,
  onUsage,
  onToggleStatus,
}: CategoryItemRowProps) {
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const isExpanded = Boolean(expandedNodes[node._id]);
  const isActive = node.isActive !== false;

  // Icon depending on level
  const NodeIcon =
    level === 1
      ? isExpanded
        ? FolderOpen
        : Folder
      : level === 2
      ? FileText
      : Tag;

  return (
    <div className="flex flex-col">
      <div
        className={`group flex items-center justify-between py-2.5 px-3 sm:px-4 transition-colors hover:bg-muted/40 ${
          level === 1 ? "bg-card font-semibold" : level === 2 ? "bg-background/80 pl-8 sm:pl-10" : "bg-muted/20 pl-14 sm:pl-16"
        } ${!isActive ? "opacity-60" : ""}`}
      >
        {/* Left side: Expand toggle + Icon + Name + Badges */}
        <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleExpand(node._id)}
              className="grid size-6 shrink-0 place-items-center rounded-sm hover:bg-muted text-muted-foreground transition-transform"
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span className="size-6 shrink-0" />
          )}

          <NodeIcon
            size={level === 1 ? 16 : 14}
            className={`shrink-0 ${
              level === 1
                ? "text-primary"
                : level === 2
                ? "text-blue-500 dark:text-blue-400"
                : "text-amber-500"
            }`}
          />

          <span
            className={`truncate text-xs sm:text-sm ${
              level === 1
                ? "font-bold text-foreground tracking-tight"
                : level === 2
                ? "font-medium text-foreground/90"
                : "text-muted-foreground"
            }`}
          >
            {node.name}
          </span>

          {/* Badges */}
          <div className="flex items-center gap-1.5 shrink-0 ml-1">
            {hasChildren && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground font-mono">
                {node.children!.length}
              </span>
            )}

            {!isActive && (
              <span className="rounded-sm border border-destructive/20 bg-destructive/10 px-1.5 py-0.2 text-[10px] font-semibold text-destructive uppercase">
                Inactive
              </span>
            )}

            {node.categoryType === "admin" && (
              <span className="rounded-sm border border-purple-500/20 bg-purple-500/10 px-1.5 py-0.2 text-[10px] font-medium text-purple-600 dark:text-purple-400">
                Admin
              </span>
            )}

            {node.isCustom && (
              <span className="rounded-sm border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.2 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                Custom
              </span>
            )}
          </div>
        </div>

        {/* Right side: Action buttons */}
        <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
          {/* Add Subcategory (available if level < 3) */}
          {level < 3 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onAddChild(node)}
              className="h-7 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
              title={`Add child category under ${node.name}`}
            >
              <Plus size={13} />
              <span className="hidden md:inline">Add Sub</span>
            </Button>
          )}

          {/* Edit */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEdit(node)}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            title="Edit Category"
          >
            <Edit2 size={13} />
          </Button>

          {/* Move */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onMove(node)}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            title="Move Category Hierarchy"
          >
            <Move size={13} />
          </Button>

          {/* Status Toggle */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onToggleStatus(node)}
            className={`h-7 w-7 p-0 ${isActive ? "text-emerald-600 hover:text-emerald-700 dark:text-emerald-400" : "text-muted-foreground hover:text-foreground"}`}
            title={isActive ? "Deactivate Category" : "Activate Category"}
          >
            {isActive ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
          </Button>

          {/* Usage & Maintenance */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onUsage(node)}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            title="View Usage & Records"
          >
            <MoreVertical size={13} />
          </Button>
        </div>
      </div>

      {/* Render children recursively if expanded */}
      {hasChildren && isExpanded && (
        <div className="border-t border-border/50 divide-y divide-border/40">
          {node.children!.map((child) => (
            <CategoryItemRow
              key={child._id}
              node={child}
              level={level + 1}
              expandedNodes={expandedNodes}
              toggleExpand={toggleExpand}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onMove={onMove}
              onUsage={onUsage}
              onToggleStatus={onToggleStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}
