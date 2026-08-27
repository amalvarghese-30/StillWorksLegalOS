import { Router, type Request, type Response } from "express";
import mongoose from "mongoose";
import { Case } from "../models/Case.js";
import { AuditLog } from "../models/AuditLog.js";
import { requireAuth } from "../middleware/auth.js";
import { canAccessCase, requireResourceAccess, getAccessibleCaseIds } from "../middleware/authorization.js";

const router = Router();

router.use(requireAuth);

// ---------------------------------------------------------------------------
// GET /api/cases — list with search, status filter, pagination
// Filters to user's accessible cases
// ---------------------------------------------------------------------------

router.get("/", async (req: Request, res: Response) => {
  try {
    const {
      search,
      status,
      priority,
      assignedTo,
      page = "1",
      limit = "24",
    } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = {};

    // Non-admins only see their cases
    if (req.user!.role !== "admin") {
      const accessibleCaseIds = await getAccessibleCaseIds(req.userId!, req.user!.role);
      if (accessibleCaseIds.length === 0) {
        res.json({ cases: [], total: 0, page: 1, totalPages: 1 });
        return;
      }
      filter["_id"] = { $in: accessibleCaseIds };
    }

    if (status && status !== "All") filter["status"] = status;
    if (priority && priority !== "All") filter["priority"] = priority;
    if (assignedTo) filter["assignedTo"] = assignedTo;

    // Full-text or regex search
    if (search && search.trim()) {
      const textResults = await Case.find(
        { $text: { $search: search.trim() } },
        { score: { $meta: "textScore" } },
      )
        .sort({ score: { $meta: "textScore" } })
        .limit(50)
        .lean();

      if (textResults.length > 0) {
        // Filter text results by accessible cases for non-admins
        if (req.user!.role !== "admin") {
          const accessibleIds = await getAccessibleCaseIds(req.userId!, req.user!.role);
          const filtered = textResults.filter((c) => accessibleIds.includes(c._id.toString()));
          res.json({ cases: filtered, total: filtered.length, page: 1, totalPages: 1 });
        } else {
          res.json({ cases: textResults, total: textResults.length, page: 1, totalPages: 1 });
        }
        return;
      }

      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter["$or"] = [
        { number: regex },
        { title: regex },
        { court: regex },
        { "parties.name": regex },
        { courtCaseId: regex },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 24));
    const skip = (pageNum - 1) * limitNum;

    const [cases, total] = await Promise.all([
      Case.find(filter)
        .populate("assignedTo", "name email")
        .populate("createdBy", "name")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Case.countDocuments(filter),
    ]);

    res.json({ cases, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (err) {
    console.error("[cases] List error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/cases/:id — detailed record (with authorization)
// ---------------------------------------------------------------------------

router.get("/:id", requireResourceAccess("case"), async (req: Request, res: Response) => {
  try {
    const record = await Case.findById(req.params["id"])
      .populate("assignedTo", "name email title")
      .populate("createdBy", "name")
      .populate("parties.clientId", "name email phone")
      .populate("notes.authorId", "name")
      .lean();

    if (!record) {
      res.status(404).json({ message: "Case not found" });
      return;
    }

    res.json({ case: record });
  } catch (err) {
    console.error("[cases] Get error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/cases — create (all fields optional for quick draft saving)
// ---------------------------------------------------------------------------

router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      practice,
      court,
      judge,
      status,
      priority,
      nextHearing,
      parties,
      assignedTo,
      nasPath,
      tags,
    } = req.body;

    if (!title || !title.trim()) {
      res.status(400).json({ message: "Case title is required" });
      return;
    }

    // Non-admins can only assign to themselves
    const finalAssignedTo = req.user?.role === "admin" ? (assignedTo ?? req.userId) : req.userId;

    const timelineEntry = {
      event: "Case created",
      by: req.user?.name ?? "Unknown",
      when: new Date(),
    };

    const record = await Case.create({
      title: title.trim(),
      description: description ?? "",
      practice: practice ?? "Property",
      court: court ?? "",
      judge: judge ?? "",
      status: status ?? "Active",
      priority: priority ?? "Medium",
      nextHearing: nextHearing ? new Date(nextHearing) : null,
      parties: parties ?? [],
      assignedTo: finalAssignedTo,
      createdBy: req.userId,
      nasPath: nasPath ?? "",
      tags: tags ?? [],
      timeline: [timelineEntry],
    });

    await record.populate(["assignedTo", "createdBy"]);

    await AuditLog.logWithActivity(
      {
        userId: new mongoose.Types.ObjectId(req.userId!),
        userName: req.user?.name ?? "Unknown",
        action: "create",
        resource: "case",
        resourceId: record._id.toString(),
        resourceName: record.title,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      },
      req.app.get("io")
    );

    res.status(201).json({ case: record });
  } catch (err) {
    console.error("[cases] Create error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/cases/:id — partial update (with authorization)
// ---------------------------------------------------------------------------

router.patch("/:id", requireResourceAccess("case"), async (req: Request, res: Response) => {
  try {
    const updates = { ...req.body };

    // Non-admins cannot reassign to others
    if (req.user?.role !== "admin" && updates["assignedTo"] && updates["assignedTo"] !== req.userId) {
      res.status(403).json({ message: "Cannot assign case to another user" });
      return;
    }

    // Convert nextHearing string to Date if provided
    if (updates["nextHearing"]) {
      updates["nextHearing"] = new Date(updates["nextHearing"]);
    }

    // Add timeline entry if status is changing
    if (updates["status"]) {
      const existing = await Case.findById(req.params["id"]);
      if (existing && existing.status !== updates["status"]) {
        const timelineEntry = {
          event: `Status changed to ${updates["status"]}`,
          by: req.user?.name ?? "Unknown",
          when: new Date(),
        };
        updates["$push"] = { timeline: timelineEntry };
      }
    }

    const record = await Case.findByIdAndUpdate(req.params["id"], updates, {
      new: true,
      runValidators: true,
    })
      .populate("assignedTo", "name email title")
      .populate("createdBy", "name");

    if (!record) {
      res.status(404).json({ message: "Case not found" });
      return;
    }

    await AuditLog.logWithActivity(
      {
        userId: new mongoose.Types.ObjectId(req.userId!),
        userName: req.user?.name ?? "Unknown",
        action: "update",
        resource: "case",
        resourceId: record._id.toString(),
        resourceName: record.title,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      },
      req.app.get("io")
    );

    res.json({ case: record });
  } catch (err) {
    console.error("[cases] Update error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/cases/:id (with authorization)
// ---------------------------------------------------------------------------

router.delete("/:id", requireResourceAccess("case"), async (req: Request, res: Response) => {
  try {
    const record = await Case.findByIdAndDelete(req.params["id"]);
    if (!record) {
      res.status(404).json({ message: "Case not found" });
      return;
    }

    await AuditLog.logWithActivity(
      {
        userId: new mongoose.Types.ObjectId(req.userId!),
        userName: req.user?.name ?? "Unknown",
        action: "delete",
        resource: "case",
        resourceId: record._id.toString(),
        resourceName: record.title,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      },
      req.app.get("io")
    );

    res.json({ message: "Case deleted" });
  } catch (err) {
    console.error("[cases] Delete error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/cases/:id/parties — add a party (with authorization)
// ---------------------------------------------------------------------------

router.post("/:id/parties", requireResourceAccess("case"), async (req: Request, res: Response) => {
  try {
    const { name, role, type, clientId } = req.body;

    if (!name || !role) {
      res.status(400).json({ message: "Party name and role are required" });
      return;
    }

    const record = await Case.findById(req.params["id"]);
    if (!record) {
      res.status(404).json({ message: "Case not found" });
      return;
    }

    record.parties.push({ name, role, type: type ?? "client", clientId });
    record.timeline.push({
      event: `Added party: ${name} (${role})`,
      by: req.user?.name ?? "Unknown",
      when: new Date(),
    });

    await record.save();

    await AuditLog.logWithActivity(
      {
        userId: new mongoose.Types.ObjectId(req.userId!),
        userName: req.user?.name ?? "Unknown",
        action: "update",
        resource: "case",
        resourceId: record._id.toString(),
        resourceName: record.title,
        details: `Added party: ${name} (${role})`,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      },
      req.app.get("io")
    );

    res.json({ case: record });
  } catch (err) {
    console.error("[cases] Add party error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/cases/:id/notes — add a note (with authorization)
// ---------------------------------------------------------------------------

router.post("/:id/notes", requireResourceAccess("case"), async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      res.status(400).json({ message: "Note text is required" });
      return;
    }

    const record = await Case.findById(req.params["id"]);
    if (!record) {
      res.status(404).json({ message: "Case not found" });
      return;
    }

    record.notes.push({
      text: text.trim(),
      author: req.user?.name ?? "Unknown",
      authorId: req.userId as any,
      createdAt: new Date(),
    });

    await record.save();

    await AuditLog.logWithActivity(
      {
        userId: new mongoose.Types.ObjectId(req.userId!),
        userName: req.user?.name ?? "Unknown",
        action: "update",
        resource: "case",
        resourceId: record._id.toString(),
        resourceName: record.title,
        details: "Added note",
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      },
      req.app.get("io")
    );

    res.json({ case: record });
  } catch (err) {
    console.error("[cases] Add note error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;