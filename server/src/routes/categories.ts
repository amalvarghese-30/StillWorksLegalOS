import { Router, type Request, type Response } from "express";
import { Category, slugify } from "../models/Category.js";
import { requireAuth } from "../middleware/auth.js";
import { AuditLog } from "../models/AuditLog.js";
import { seedCategories } from "../scripts/seedCategories.js";

const router = Router();
router.use(requireAuth);

/**
 * GET /api/categories
 * Returns active categories list or hierarchy
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const { parentId, level, includeInactive } = req.query;

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
 * Returns nested tree structure (Main Categories with their Work Types)
 */
router.get("/tree", async (_req: Request, res: Response) => {
  try {
    let all = await Category.find({ isActive: true })
      .sort({ level: 1, displayOrder: 1, name: 1 })
      .lean();

    // Auto-seed and reconcile from master Excel taxonomy if empty or missing required branches
    const hasLand = all.some((c) => c.level === 1 && c.name === "LAND / PLOT / REVENUE MATTERS");
    const hasOffice = all.some((c) => c.level === 1 && c.name === "OFFICE ADMIN WORK");
    const specialDoc = all.find((c) => c.level === 2 && c.name === "SPECIAL LEGAL WORK");
    const hasSpecialChildren = specialDoc
      ? all.some((c) => c.parentId && c.parentId.toString() === specialDoc._id.toString())
      : false;

    if (all.length === 0 || !hasLand || !hasOffice || !hasSpecialChildren) {
      try {
        console.log("[categories] Category collection requires sync, syncing master taxonomy...");
        await seedCategories();
        all = await Category.find({ isActive: true })
          .sort({ level: 1, displayOrder: 1, name: 1 })
          .lean();
      } catch (seedErr) {
        console.error("[categories] Auto-seed failed:", seedErr);
      }
    }

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
 * POST /api/categories
 * Create custom or global category
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const { name, parentId, categoryType, description } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({ message: "Category name is required", field: "name" });
      return;
    }

    const trimmedName = name.trim();
    const slug = slugify(trimmedName);

    let parentDoc = null;
    let level = 1;
    let ancestors: any[] = [];

    if (parentId) {
      parentDoc = await Category.findById(parentId);
      if (!parentDoc) {
        res.status(404).json({ message: "Parent category not found", field: "parentId" });
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

    const category = await Category.create({
      name: trimmedName,
      slug,
      parentId: parentDoc ? parentDoc._id : null,
      ancestors,
      level,
      categoryType: resolvedCategoryType,
      isActive: true,
      displayOrder: 999,
      isCustom,
      description: description || "",
      createdBy: req.userId,
    });

    await AuditLog.create({
      userId: req.userId,
      userName: req.user?.name ?? "Unknown",
      action: "create",
      resource: "category" as any,
      resourceId: category._id.toString(),
      resourceName: category.name,
      details: `Created category: ${category.name}`,
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
 * POST /api/categories/import
 * Admin-triggered Excel taxonomy import
 */
router.post("/import", async (req: Request, res: Response) => {
  try {
    if (req.user?.role !== "admin") {
      res.status(403).json({ message: "Only administrators can run category import" });
      return;
    }

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
