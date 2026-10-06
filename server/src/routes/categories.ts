import { Router, type Request, type Response } from "express";
import { AppSettings, UNIFIED_CATEGORIES } from "../models/AppSettings.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

/**
 * GET /api/categories
 * Returns the unified category list, combining AppSettings configured categories
 * with all baseline legal/work categories, deduplicated.
 */
router.get("/", async (_req: Request, res: Response) => {
  try {
    const options = await AppSettings.getTaskOptions();
    // Ensure all baseline UNIFIED_CATEGORIES are present alongside any admin-added categories
    const categorySet = new Set<string>([...UNIFIED_CATEGORIES, ...(options.categories || [])]);
    const categories = Array.from(categorySet);

    res.json({ categories });
  } catch (err) {
    console.error("[categories] Error fetching categories:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
