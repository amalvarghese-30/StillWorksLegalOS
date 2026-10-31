import { Router, type Request, type Response } from "express";
import mongoose from "mongoose";
import { Category, slugify, type ICategory } from "../models/Category.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { AuditLog } from "../models/AuditLog.js";
import { Case } from "../models/Case.js";
import { Task } from "../models/Task.js";
import { seedCategories } from "../scripts/seedCategories.js";

const router = Router();
router.use(requireAuth);

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

/**
 * Helper to calculate linked record counts for a category
 */
async function getCategoryUsage(cat: ICategory) {
  const childCount = await Category.countDocuments({ parentId: cat._id });

  // Direct case usage
  const casesCount = await Case.countDocuments({
    $or: [
      { mainCategory: cat.name },
      { subCategory: cat.name },
      { category: cat.name },
      { categoryPath: cat.name },
    ],
  });

  // Direct task usage
  const tasksCount = await Task.countDocuments({
    $or: [
      { mainCategory: cat.name },
      { subCategory: cat.name },
      { category: cat.name },
      { categoryPath: cat.name },
    ],
  });

  return {
    childCount,
    casesCount,
    tasksCount,
    totalRecords: casesCount + tasksCount,
    canDelete: childCount === 0 && casesCount + tasksCount === 0,
  };
}

/**
 * Calculate maximum descendant depth of a category
 */
async function getSubtreeMaxDepth(catId: mongoose.Types.ObjectId): Promise<number> {
  const children = await Category.find({ parentId: catId });
  if (children.length === 0) return 0;
  let maxChildDepth = 0;
  for (const child of children) {
    const d = await getSubtreeMaxDepth(child._id as mongoose.Types.ObjectId);
    if (d + 1 > maxChildDepth) {
      maxChildDepth = d + 1;
    }
  }
  return maxChildDepth;
}

/**
 * GET /api/categories
 * Returns active categories list or hierarchy
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const { parentId, level, categoryType, includeInactive, search } = req.query;

    const filter: Record<string, any> = {};
    if (includeInactive !== "true") {
      filter["isActive"] = true;
    }
    if (parentId !== undefined) {
      filter["parentId"] = parentId === "null" || parentId === "" ? null : parentId;
    }
    if (level !== undefined) {
      filter["level"] = parseInt(String(level), 10);
    }
    if (categoryType !== undefined && categoryType !== "all") {
      filter["categoryType"] = categoryType;
    }
    if (search && typeof search === "string" && search.trim()) {
      filter["name"] = { $regex: new RegExp(escapeRegex(search.trim()), "i") };
    }

    const categories = await Category.find(filter)
      .sort({ displayOrder: 1, name: 1 })
      .lean();

    res.json({ categories });
  } catch (err) {
    console.error("[categories] List error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * GET /api/categories/tree
 * Returns nested tree structure (Main Categories with their Work Types and details)
 */
router.get("/tree", async (req: Request, res: Response) => {
  try {
    const includeInactive = req.query["includeInactive"] === "true";
    const totalCount = await Category.countDocuments();

    // Auto-seed only if database is completely empty on initial setup
    if (totalCount === 0) {
      try {
        console.log("[categories] Category collection is empty, syncing master taxonomy...");
        await seedCategories();
      } catch (seedErr) {
        console.error("[categories] Auto-seed failed:", seedErr);
      }
    }

    const filter: Record<string, any> = {};
    if (!includeInactive) {
      filter["isActive"] = true;
    }

    const all = await Category.find(filter)
      .sort({ displayOrder: 1, name: 1 })
      .lean();

    // Build multi-level parent-child hierarchy (level 1 -> level 2 -> level 3)
    const childrenByParent = new Map<string, any[]>();

    for (const c of all) {
      if (c.parentId) {
        const pId = c.parentId.toString();
        if (!childrenByParent.has(pId)) childrenByParent.set(pId, []);
        childrenByParent.get(pId)!.push(c);
      }
    }

    // Recursive helper to populate children down to level 3
    function populateChildren(node: any): any {
      const directChildren = childrenByParent.get(node._id.toString()) || [];
      return {
        ...node,
        children: directChildren.map((child) => populateChildren(child)),
      };
    }

    const tree = all
      .filter((c) => c.level === 1 || !c.parentId)
      .map((parent) => populateChildren(parent));

    res.json({ tree });
  } catch (err) {
    console.error("[categories] Tree error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * GET /api/categories/:id/usage
 * Returns linked record counts (cases and tasks) and deletion safety
 */
router.get("/:id/usage", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = String(req.params["id"] || "");
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: "Invalid category ID" });
      return;
    }

    const cat = await Category.findById(id);
    if (!cat) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    const usage = await getCategoryUsage(cat);
    res.json({
      category: {
        _id: cat._id,
        name: cat.name,
        slug: cat.slug,
        level: cat.level,
        isActive: cat.isActive,
      },
      ...usage,
    });
  } catch (err: any) {
    console.error("[categories] Usage error:", err);
    res.status(500).json({ message: err?.message || "Internal server error" });
  }
});

/**
 * POST /api/categories
 * Create custom or global category
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const { name, parentId, categoryType, description, displayOrder } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({ message: "Category name is required", field: "name" });
      return;
    }

    const trimmedName = name.trim();
    if (trimmedName.length > 120) {
      res.status(400).json({ message: "Category name cannot exceed 120 characters", field: "name" });
      return;
    }

    const slug = slugify(trimmedName);
    if (!slug) {
      res.status(400).json({ message: "Category name contains no valid alphanumeric characters", field: "name" });
      return;
    }

    let parentDoc = null;
    let level = 1;
    let ancestors: any[] = [];

    if (parentId) {
      if (!mongoose.Types.ObjectId.isValid(parentId)) {
        res.status(400).json({ message: "Invalid parent category ID", field: "parentId" });
        return;
      }
      parentDoc = await Category.findById(parentId);
      if (!parentDoc) {
        res.status(404).json({ message: "Parent category not found", field: "parentId" });
        return;
      }
      if (parentDoc.level >= 3) {
        res.status(400).json({
          message: "Cannot create subcategories beyond 3 levels deep",
          field: "parentId",
        });
        return;
      }
      level = parentDoc.level + 1;
      ancestors = [...(parentDoc.ancestors || []), parentDoc._id];
    }

    // Non-admins may create custom categories only beneath the canonical active "Other Works"
    // parent. Do not trust the submitted categoryType or parentId alone.
    const isAdmin = req.user?.role === "admin";
    const isCustom = !isAdmin;
    if (!isAdmin) {
      const isOtherWorksParent =
        parentDoc !== null &&
        parentDoc.isActive !== false &&
        (String(parentDoc.name ?? "").trim().toLowerCase() === "other works" ||
          String(parentDoc.slug ?? "").trim().toLowerCase() === "other-works");
      if (!isOtherWorksParent) {
        res.status(403).json({
          message: 'Custom categories can only be created under "Other Works".',
          field: "parentId",
        });
        return;
      }
    }

    const existing = await Category.findOne({
      parentId: parentDoc ? parentDoc._id : null,
      slug,
    });

    if (existing) {
      res.status(409).json({
        message: `Category "${trimmedName}" already exists under this parent`,
        field: "name",
      });
      return;
    }

    let resolvedCategoryType: "legal" | "admin" | "custom" = "legal";
    if (!isAdmin) {
      resolvedCategoryType = "custom";
    } else if (categoryType) {
      if (categoryType === "admin" || categoryType === "task") resolvedCategoryType = "admin";
      else if (categoryType === "custom") resolvedCategoryType = "custom";
      else resolvedCategoryType = "legal";
    } else if (parentDoc) {
      resolvedCategoryType = parentDoc.categoryType;
    }

    // Calculate display order if not specified
    let finalDisplayOrder = typeof displayOrder === "number" ? displayOrder : 0;
    if (typeof displayOrder !== "number") {
      const lastSibling = await Category.findOne({ parentId: parentDoc ? parentDoc._id : null })
        .sort({ displayOrder: -1 })
        .select("displayOrder")
        .lean();
      finalDisplayOrder = (lastSibling?.displayOrder ?? 0) + 10;
    }

    const category = await Category.create({
      name: trimmedName,
      slug,
      parentId: parentDoc ? parentDoc._id : null,
      ancestors,
      level,
      categoryType: resolvedCategoryType,
      isActive: true,
      displayOrder: finalDisplayOrder,
      isCustom,
      description: typeof description === "string" ? description.trim() : "",
      createdBy: req.userId,
    });

    await AuditLog.create({
      userId: req.userId,
      userName: req.user?.name ?? "Unknown",
      action: "create",
      resource: "category" as any,
      resourceId: category._id.toString(),
      resourceName: category.name,
      details: `Created category: ${category.name} (Level ${level})`,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.status(201).json({ category });
  } catch (err: any) {
    console.error("[categories] Create error:", err);
    res.status(500).json({ message: err?.message || "Internal server error" });
  }
});

/**
 * PATCH /api/categories/reorder
 * Bulk updates displayOrder for categories
 */
router.patch("/reorder", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ message: "Invalid items array for reordering" });
      return;
    }

    for (const item of items) {
      if (item.id && mongoose.Types.ObjectId.isValid(item.id) && typeof item.displayOrder === "number") {
        await Category.updateOne(
          { _id: item.id },
          { $set: { displayOrder: item.displayOrder, updatedBy: req.userId } }
        );
      }
    }

    await AuditLog.create({
      userId: req.userId,
      userName: req.user?.name ?? "Unknown",
      action: "update",
      resource: "category" as any,
      resourceName: "Category Reorder",
      details: `Reordered ${items.length} categories`,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ message: "Categories reordered successfully" });
  } catch (err: any) {
    console.error("[categories] Reorder error:", err);
    res.status(500).json({ message: err?.message || "Internal server error" });
  }
});

/**
 * PATCH /api/categories/:id
 * Rename, update description, displayOrder, categoryType
 */
router.patch("/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = String(req.params["id"] || "");
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: "Invalid category ID" });
      return;
    }

    const cat = await Category.findById(id);
    if (!cat) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    const { name, description, displayOrder, categoryType } = req.body;
    const oldName = cat.name;

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        res.status(400).json({ message: "Category name cannot be empty", field: "name" });
        return;
      }
      const trimmedName = name.trim();
      if (trimmedName.length > 120) {
        res.status(400).json({ message: "Category name cannot exceed 120 characters", field: "name" });
        return;
      }

      const slug = slugify(trimmedName);
      if (!slug) {
        res.status(400).json({ message: "Category name contains no valid alphanumeric characters", field: "name" });
        return;
      }

      // Check unique slug under same parent
      const existing = await Category.findOne({
        _id: { $ne: cat._id },
        parentId: cat.parentId,
        slug,
      });

      if (existing) {
        res.status(409).json({
          message: `Category "${trimmedName}" already exists under this parent`,
          field: "name",
        });
        return;
      }

      cat.name = trimmedName;
      cat.slug = slug;
    }

    if (description !== undefined) {
      cat.description = typeof description === "string" ? description.trim() : "";
    }

    if (displayOrder !== undefined && typeof displayOrder === "number") {
      cat.displayOrder = displayOrder;
    }

    if (categoryType !== undefined) {
      if (categoryType === "admin" || categoryType === "custom" || categoryType === "legal") {
        cat.categoryType = categoryType;
      }
    }

    cat.updatedBy = new mongoose.Types.ObjectId(req.userId);
    await cat.save();

    await AuditLog.create({
      userId: req.userId,
      userName: req.user?.name ?? "Unknown",
      action: "update",
      resource: "category" as any,
      resourceId: cat._id.toString(),
      resourceName: cat.name,
      details: name && name !== oldName
        ? `Renamed category from "${oldName}" to "${cat.name}"`
        : `Updated category details for "${cat.name}"`,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ category: cat });
  } catch (err: any) {
    console.error("[categories] Update error:", err);
    res.status(500).json({ message: err?.message || "Internal server error" });
  }
});

/**
 * PATCH /api/categories/:id/status
 * Activate or deactivate a category
 */
router.patch("/:id/status", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = String(req.params["id"] || "");
    const { isActive } = req.body;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: "Invalid category ID" });
      return;
    }
    if (typeof isActive !== "boolean") {
      res.status(400).json({ message: "isActive must be a boolean" });
      return;
    }

    const cat = await Category.findById(id);
    if (!cat) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    cat.isActive = isActive;
    cat.updatedBy = new mongoose.Types.ObjectId(req.userId);
    await cat.save();

    // If deactivating, also cascade deactivation to descendants to avoid floating active children
    if (!isActive) {
      await Category.updateMany(
        { ancestors: cat._id },
        { $set: { isActive: false, updatedBy: new mongoose.Types.ObjectId(req.userId) } }
      );
    } else if (cat.parentId) {
      // If activating a child, ensure its ancestors are also active
      await Category.updateMany(
        { _id: { $in: cat.ancestors } },
        { $set: { isActive: true, updatedBy: new mongoose.Types.ObjectId(req.userId) } }
      );
    }

    await AuditLog.create({
      userId: req.userId,
      userName: req.user?.name ?? "Unknown",
      action: "update",
      resource: "category" as any,
      resourceId: cat._id.toString(),
      resourceName: cat.name,
      details: `${isActive ? "Activated" : "Deactivated"} category: ${cat.name}`,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ category: cat });
  } catch (err: any) {
    console.error("[categories] Status error:", err);
    res.status(500).json({ message: err?.message || "Internal server error" });
  }
});

/**
 * PATCH /api/categories/:id/move
 * Safely move category to new parent
 */
router.patch("/:id/move", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = String(req.params["id"] || "");
    const targetParentId = req.body.targetParentId ? String(req.body.targetParentId) : null;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: "Invalid category ID" });
      return;
    }

    const cat = await Category.findById(id);
    if (!cat) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    let targetParent = null;
    let newLevel = 1;
    let newAncestors: mongoose.Types.ObjectId[] = [];

    if (targetParentId) {
      if (!mongoose.Types.ObjectId.isValid(targetParentId)) {
        res.status(400).json({ message: "Invalid target parent ID" });
        return;
      }

      if (targetParentId === cat._id.toString()) {
        res.status(400).json({ message: "Cannot move a category under itself" });
        return;
      }

      targetParent = await Category.findById(targetParentId);
      if (!targetParent) {
        res.status(404).json({ message: "Target parent category not found" });
        return;
      }

      // Check circular reference (cannot move under one of its descendants)
      if (targetParent.ancestors.some((a) => a.toString() === cat._id.toString())) {
        res.status(400).json({ message: "Cannot move a category beneath one of its own descendants" });
        return;
      }

      newLevel = targetParent.level + 1;
      newAncestors = [...(targetParent.ancestors || []), targetParent._id as mongoose.Types.ObjectId];
    }

    // Check maximum hierarchy depth limit of 3
    const subtreeDepth = await getSubtreeMaxDepth(cat._id as mongoose.Types.ObjectId);
    if (newLevel + subtreeDepth > 3) {
      res.status(400).json({
        message: `Cannot move category here: resulting hierarchy depth (${newLevel + subtreeDepth}) would exceed the maximum limit of 3 levels`,
      });
      return;
    }

    // Check duplicate slug under target parent
    const duplicate = await Category.findOne({
      _id: { $ne: cat._id },
      parentId: targetParent ? targetParent._id : null,
      slug: cat.slug,
    });

    if (duplicate) {
      res.status(409).json({
        message: `A category named "${cat.name}" already exists under "${targetParent ? targetParent.name : "Root"}"`,
      });
      return;
    }

    const oldParentId = cat.parentId;
    const oldAncestors = [...cat.ancestors];

    cat.parentId = targetParent ? targetParent._id : null;
    cat.level = newLevel;
    cat.ancestors = newAncestors;
    cat.updatedBy = new mongoose.Types.ObjectId(req.userId);
    await cat.save();

    // Rebuild ancestors and level for all descendants
    const descendants = await Category.find({ ancestors: cat._id });
    for (const desc of descendants) {
      // Find where cat._id is in desc.ancestors
      const idx = desc.ancestors.findIndex((a) => a.toString() === cat._id.toString());
      if (idx !== -1) {
        const descendantSubPath = desc.ancestors.slice(idx + 1);
        desc.ancestors = [...newAncestors, cat._id as mongoose.Types.ObjectId, ...descendantSubPath];
        desc.level = desc.ancestors.length + 1;
        desc.updatedBy = new mongoose.Types.ObjectId(req.userId);
        await desc.save();
      }
    }

    await AuditLog.create({
      userId: req.userId,
      userName: req.user?.name ?? "Unknown",
      action: "update",
      resource: "category" as any,
      resourceId: cat._id.toString(),
      resourceName: cat.name,
      details: `Moved category "${cat.name}" from ${oldParentId ? oldParentId.toString() : "Root"} to ${targetParent ? targetParent.name : "Root"}`,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ category: cat });
  } catch (err: any) {
    console.error("[categories] Move error:", err);
    res.status(500).json({ message: err?.message || "Internal server error" });
  }
});

/**
 * POST /api/categories/:id/migrate
 * Controlled record migration from source category to target category
 */
router.post("/:id/migrate", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = String(req.params["id"] || "");
    const targetCategoryId = String(req.body.targetCategoryId || "");

    if (!id || !mongoose.Types.ObjectId.isValid(id) || !targetCategoryId || !mongoose.Types.ObjectId.isValid(targetCategoryId)) {
      res.status(400).json({ message: "Invalid category IDs" });
      return;
    }

    if (id === targetCategoryId) {
      res.status(400).json({ message: "Source and target categories cannot be the same" });
      return;
    }

    const sourceCat = await Category.findById(id);
    const targetCat = await Category.findById(targetCategoryId);

    if (!sourceCat) {
      res.status(404).json({ message: "Source category not found" });
      return;
    }
    if (!targetCat) {
      res.status(404).json({ message: "Target category not found" });
      return;
    }

    const sourceName = sourceCat.name;
    const targetName = targetCat.name;

    // Resolve target hierarchy names
    let targetMain = "";
    let targetSub = "";
    if (targetCat.level === 1) {
      targetMain = targetCat.name;
    } else if (targetCat.level === 2) {
      const p = await Category.findById(targetCat.parentId);
      targetMain = p ? p.name : "";
      targetSub = targetCat.name;
    } else if (targetCat.level === 3) {
      const p = await Category.findById(targetCat.parentId);
      const gp = p ? await Category.findById(p.parentId) : null;
      targetMain = gp ? gp.name : (p ? p.name : "");
      targetSub = p ? p.name : "";
    }

    // Migrate Cases
    const casesToUpdate = await Case.find({
      $or: [
        { mainCategory: sourceName },
        { subCategory: sourceName },
        { category: sourceName },
        { categoryPath: sourceName },
      ],
    });

    let casesMigrated = 0;
    for (const c of casesToUpdate) {
      if (c.mainCategory === sourceName) c.mainCategory = targetMain || targetName;
      if (c.subCategory === sourceName) c.subCategory = targetSub || targetName;
      if (c.category === sourceName) c.category = targetName;
      if (Array.isArray(c.categoryPath)) {
        c.categoryPath = c.categoryPath.map((item) => (item === sourceName ? targetName : item));
      }
      await c.save();
      casesMigrated++;
    }

    // Migrate Tasks
    const tasksToUpdate = await Task.find({
      $or: [
        { mainCategory: sourceName },
        { subCategory: sourceName },
        { category: sourceName },
        { categoryPath: sourceName },
      ],
    });

    let tasksMigrated = 0;
    for (const t of tasksToUpdate) {
      if (t.mainCategory === sourceName) t.mainCategory = targetMain || targetName;
      if (t.subCategory === sourceName) t.subCategory = targetSub || targetName;
      if (t.category === sourceName) t.category = targetName;
      if (Array.isArray(t.categoryPath)) {
        t.categoryPath = t.categoryPath.map((item) => (item === sourceName ? targetName : item));
      }
      await t.save();
      tasksMigrated++;
    }

    await AuditLog.create({
      userId: req.userId,
      userName: req.user?.name ?? "Unknown",
      action: "update",
      resource: "category" as any,
      resourceId: sourceCat._id.toString(),
      resourceName: sourceCat.name,
      details: `Migrated records from "${sourceName}" to "${targetName}": ${casesMigrated} cases, ${tasksMigrated} tasks`,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({
      message: `Successfully migrated records from "${sourceName}" to "${targetName}"`,
      casesMigrated,
      tasksMigrated,
    });
  } catch (err: any) {
    console.error("[categories] Migrate error:", err);
    res.status(500).json({ message: err?.message || "Internal server error" });
  }
});

/**
 * DELETE /api/categories/:id
 * Permanent deletion only permitted when zero children and zero linked records exist
 */
router.delete("/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = String(req.params["id"] || "");
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: "Invalid category ID" });
      return;
    }

    const cat = await Category.findById(id);
    if (!cat) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    const usage = await getCategoryUsage(cat);

    if (usage.childCount > 0) {
      res.status(400).json({
        message: `Cannot delete category "${cat.name}" because it contains ${usage.childCount} subcategories. Move or delete child categories first.`,
        childCount: usage.childCount,
      });
      return;
    }

    if (usage.totalRecords > 0) {
      res.status(400).json({
        message: `Cannot delete category "${cat.name}" because it is linked to ${usage.casesCount} case(s) and ${usage.tasksCount} task(s). Deactivate the category or migrate its records first.`,
        casesCount: usage.casesCount,
        tasksCount: usage.tasksCount,
        totalRecords: usage.totalRecords,
      });
      return;
    }

    await Category.deleteOne({ _id: cat._id });

    await AuditLog.create({
      userId: req.userId,
      userName: req.user?.name ?? "Unknown",
      action: "delete",
      resource: "category" as any,
      resourceId: cat._id.toString(),
      resourceName: cat.name,
      details: `Permanently deleted category: ${cat.name}`,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ message: `Category "${cat.name}" deleted successfully` });
  } catch (err: any) {
    console.error("[categories] Delete error:", err);
    res.status(500).json({ message: err?.message || "Internal server error" });
  }
});

/**
 * POST /api/categories/import
 * Admin-triggered Excel taxonomy import
 */
router.post("/import", requireAdmin, async (req: Request, res: Response) => {
  try {
    const report = await seedCategories();

    await AuditLog.create({
      userId: req.userId,
      userName: req.user?.name ?? "Unknown",
      action: "create",
      resource: "category" as any,
      resourceName: "Excel Taxonomy Import",
      details: `Category import executed: ${report.parentsCreated} parents, ${report.childrenCreated} children created`,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ message: "Taxonomy imported successfully", report });
  } catch (err: any) {
    console.error("[categories] Import error:", err);
    res.status(500).json({ message: err?.message || "Internal server error" });
  }
});

export const categoriesRouter = router;
export default router;
