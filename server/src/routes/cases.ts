import { Router, type Request, type Response } from "express";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { Case } from "../models/Case.js";
import { Client } from "../models/Client.js";
import { DocumentModel } from "../models/Document.js";
import { initSequence } from "../models/Counter.js";
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
      practice,
      practiceArea,
      assignedTo,
      court,
      judge,
      hearingFrom,
      hearingTo,
      createdFrom,
      createdTo,
      updatedFrom,
      updatedTo,
      tag,
      includeArchived,
      page = "1",
      limit = "24",
    } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = {};

    // Exclude archived cases by default (only show if explicitly requested)
    if (!includeArchived || includeArchived === "false") {
      filter["status"] = { $ne: "Archived" };
    }

    // Base accessibility filter for non-admins without cases permission
    const baseAccessibleFilter: Record<string, unknown> = {
      ...(!includeArchived || includeArchived === "false" ? { status: { $ne: "Archived" } } : {}),
    };

    if (req.user!.role !== "admin" && !req.user?.permissions?.cases) {
      const accessibleCaseIds = await getAccessibleCaseIds(req.userId!, req.user!.role);
      if (accessibleCaseIds.length === 0) {
        res.json({
          cases: [],
          total: 0,
          page: 1,
          totalPages: 1,
          stats: { total: 0, active: 0, urgent: 0, onHold: 0, closed: 0 },
        });
        return;
      }
      filter["_id"] = { $in: accessibleCaseIds };
      baseAccessibleFilter["_id"] = { $in: accessibleCaseIds };
    }

    // Status filter: single or comma-separated
    if (status && status !== "All") {
      if (status.includes(",")) {
        const statuses = status.split(",").map((s) => s.trim()).filter(Boolean);
        filter["status"] = { $in: statuses };
      } else {
        filter["status"] = status;
      }
    }

    // Priority filter: single or comma-separated
    if (priority && priority !== "All") {
      if (priority.includes(",")) {
        const priorities = priority.split(",").map((p) => p.trim()).filter(Boolean);
        filter["priority"] = { $in: priorities };
      } else {
        filter["priority"] = priority;
      }
    }

    // Practice / Practice area filter
    const practiceFilterVal = practice || practiceArea;
    if (practiceFilterVal && practiceFilterVal !== "All") {
      const escapedPractice = practiceFilterVal.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter["practice"] = new RegExp(`^${escapedPractice}$`, "i");
    }

    // Assigned staff: single or comma-separated
    if (assignedTo && assignedTo !== "All") {
      if (assignedTo.includes(",")) {
        const ids = assignedTo.split(",").map((id) => id.trim()).filter((id) => mongoose.Types.ObjectId.isValid(id));
        if (ids.length > 0) {
          filter["assignedTo"] = { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) };
        }
      } else if (mongoose.Types.ObjectId.isValid(assignedTo)) {
        filter["assignedTo"] = new mongoose.Types.ObjectId(assignedTo);
      }
    }

    // Court match
    if (court && court.trim()) {
      filter["court"] = new RegExp(court.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    }

    // Judge match
    if (judge && judge.trim()) {
      filter["judge"] = new RegExp(judge.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    }

    // Tag match
    if (tag && tag.trim()) {
      filter["tags"] = tag.trim();
    }

    // Next hearing date range
    if (hearingFrom || hearingTo) {
      const hearingCond: Record<string, unknown> = {};
      if (hearingFrom) hearingCond["$gte"] = new Date(hearingFrom);
      if (hearingTo) hearingCond["$lte"] = new Date(hearingTo);
      filter["nextHearing"] = hearingCond;
    }

    // Created date range
    if (createdFrom || createdTo) {
      const createdCond: Record<string, unknown> = {};
      if (createdFrom) createdCond["$gte"] = new Date(createdFrom);
      if (createdTo) createdCond["$lte"] = new Date(createdTo);
      filter["createdAt"] = createdCond;
    }

    // Updated date range
    if (updatedFrom || updatedTo) {
      const updatedCond: Record<string, unknown> = {};
      if (updatedFrom) updatedCond["$gte"] = new Date(updatedFrom);
      if (updatedTo) updatedCond["$lte"] = new Date(updatedTo);
      filter["updatedAt"] = updatedCond;
    }

    // Search query: matches across title, number, court, judge, parties, tags
    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      filter["$or"] = [
        { number: regex },
        { title: regex },
        { court: regex },
        { judge: regex },
        { "parties.name": regex },
        { courtCaseId: regex },
        { tags: regex },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 24));
    const skip = (pageNum - 1) * limitNum;

    const [cases, total, statusCounts] = await Promise.all([
      Case.find(filter)
        .populate("assignedTo", "name email")
        .populate("createdBy", "name")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Case.countDocuments(filter),
      Case.aggregate([
        { $match: baseAccessibleFilter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);

    const stats = {
      total: 0,
      active: 0,
      urgent: 0,
      onHold: 0,
      closed: 0,
    };
    for (const sc of statusCounts) {
      stats.total += sc.count;
      if (sc._id === "Active") stats.active = sc.count;
      if (sc._id === "Urgent") stats.urgent = sc.count;
      if (sc._id === "On Hold") stats.onHold = sc.count;
      if (sc._id === "Closed") stats.closed = sc.count;
    }

    res.json({
      cases,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      stats,
    });
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
  const corrId = (req.headers["x-correlation-id"] as string) || randomUUID();
  const userId = req.userId!;
  const userRole = req.user?.role ?? "employee";

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
      tags,
    } = req.body;

    console.log(`[cases:create] [corrId: ${corrId}] [stage: start] [userId: ${userId}] [title: ${typeof title === "string" ? title.slice(0, 50) : "empty"}]`);

    // 1. Validation Stage
    if (!title || !String(title).trim()) {
      console.warn(`[cases:create] [corrId: ${corrId}] [stage: validation_failed] Missing case title`);
      res.status(400).json({ message: "Case title is required" });
      return;
    }

    const cleanTitle = String(title).trim();

    // 2. Idempotency & Deduplication Stage
    const idempotencyKey =
      (req.headers["idempotency-key"] as string) ||
      (req.headers["x-idempotency-key"] as string) ||
      (req.body?.idempotencyKey ? String(req.body.idempotencyKey).trim() : undefined);

    if (idempotencyKey) {
      const existing = await Case.findOne({
        idempotencyKey,
        createdBy: userId,
      }).populate(["assignedTo", "createdBy"]);
      if (existing) {
        console.log(`[cases:create] [corrId: ${corrId}] [stage: idempotent_hit] Returning existing case ${existing._id}`);
        res.status(200).json({ case: existing, idempotent: true });
        return;
      }
    } else {
      // Automatic double-click suppressor: return existing case if identical submission created within 3 seconds
      const recent = await Case.findOne({
        createdBy: userId,
        title: cleanTitle,
        createdAt: { $gte: new Date(Date.now() - 3000) },
      }).populate(["assignedTo", "createdBy"]);
      if (recent) {
        console.log(`[cases:create] [corrId: ${corrId}] [stage: double_click_suppressed] Returning existing case ${recent._id}`);
        res.status(200).json({ case: recent, idempotent: true });
        return;
      }
    }

    // Non-admins can only assign to themselves. Ensure valid ObjectId if specified.
    const finalAssignedTo =
      userRole === "admin" && assignedTo && mongoose.Types.ObjectId.isValid(assignedTo)
        ? assignedTo
        : userId;

    let parsedNextHearing: Date | null = null;
    if (nextHearing) {
      const d = new Date(nextHearing);
      if (!isNaN(d.getTime())) {
        parsedNextHearing = d;
      }
    }

    // 3. Parties Resolution & Client Relationship Integrity (Phase 6)
    const sanitizedParties: Array<{
      clientId?: mongoose.Types.ObjectId;
      name: string;
      role: string;
      type: "client" | "sub_client" | "opposing_party" | "counsel" | "other";
    }> = [];

    if (Array.isArray(parties)) {
      for (const p of parties) {
        if (!p || typeof p !== "object" || !p.name || !String(p.name).trim()) continue;
        const partyName = String(p.name).trim();
        const partyRole = String(p.role || "Party").trim();
        let partyType: "client" | "sub_client" | "opposing_party" | "counsel" | "other" =
          ["client", "sub_client", "opposing_party", "counsel", "other"].includes(p.type)
            ? p.type
            : "client";
        let linkedClientId: mongoose.Types.ObjectId | undefined;

        if (p.clientId) {
          if (!mongoose.Types.ObjectId.isValid(p.clientId)) {
            res.status(400).json({ message: `Invalid client ID format: ${p.clientId}` });
            return;
          }
          const realClient = await Client.findById(p.clientId).select("_id name").lean();
          if (!realClient) {
            res.status(400).json({ message: `Client not found with ID: ${p.clientId}` });
            return;
          }
          linkedClientId = realClient._id as mongoose.Types.ObjectId;
        } else if (partyType === "client" || partyType === "sub_client") {
          // Attempt to find existing client by exact name
          const matchingClient = await Client.findOne({
            name: new RegExp(`^${partyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
          })
            .select("_id")
            .lean();
          if (matchingClient) {
            linkedClientId = matchingClient._id as mongoose.Types.ObjectId;
          } else if (partyType === "client") {
            // Cannot masquerade as a relational client without a real client record
            partyType = "other";
          }
        }

        sanitizedParties.push({
          name: partyName,
          role: partyRole,
          type: partyType,
          ...(linkedClientId ? { clientId: linkedClientId } : {}),
        });
      }
    }

    // Support optional top-level clientId
    if (req.body.clientId) {
      if (!mongoose.Types.ObjectId.isValid(req.body.clientId)) {
        res.status(400).json({ message: `Invalid client ID format: ${req.body.clientId}` });
        return;
      }
      const topClient = await Client.findById(req.body.clientId).select("_id name").lean();
      if (!topClient) {
        res.status(400).json({ message: `Client not found with ID: ${req.body.clientId}` });
        return;
      }
      const hasParty = sanitizedParties.some((p) => p.clientId?.toString() === topClient._id.toString());
      if (!hasParty) {
        sanitizedParties.unshift({
          name: topClient.name,
          role: "Primary Client",
          type: "client",
          clientId: topClient._id as mongoose.Types.ObjectId,
        });
      }
    }

    const timelineEntry = {
      event: "Case created",
      by: req.user?.name ?? "Unknown",
      when: new Date(),
    };

    console.log(`[cases:create] [corrId: ${corrId}] [stage: db_create]`);

    const caseData: Record<string, unknown> = {
      title: cleanTitle,
      description: typeof description === "string" ? description.trim() : "",
      practice: typeof practice === "string" && practice.trim() ? practice.trim() : "Property",
      court: typeof court === "string" ? court.trim() : "",
      judge: typeof judge === "string" ? judge.trim() : "",
      status: status || "Active",
      priority: priority || "Medium",
      nextHearing: parsedNextHearing,
      parties: sanitizedParties,
      assignedTo: finalAssignedTo,
      createdBy: userId,
      tags: Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean) : [],
      timeline: [timelineEntry],
      ...(idempotencyKey ? { idempotencyKey } : {}),
    };

    let record;
    try {
      record = await Case.create(caseData);
    } catch (createErr: any) {
      // 4. Counter Collision Recovery: If E11000 duplicate key error on case number,
      // resync counter to maximum database sequence and retry once atomically.
      if (createErr.code === 11000 && createErr.message?.includes("number_1")) {
        console.warn(`[cases:create] [corrId: ${corrId}] [stage: counter_collision] Resyncing case sequence counter...`);
        const year = new Date().getFullYear();
        const counterKey = `case-number-${year}`;
        const prefix = `SW-${year}-`;
        const existingCases = await Case.find(
          { number: { $regex: `^${prefix}` } },
          { number: 1 }
        ).lean();
        let maxCaseSeq = 0;
        for (const c of existingCases) {
          if (c.number && c.number.startsWith(prefix)) {
            const numPart = parseInt(c.number.slice(prefix.length), 10);
            if (!isNaN(numPart) && numPart > maxCaseSeq) maxCaseSeq = numPart;
          }
        }
        await initSequence(counterKey, maxCaseSeq);
        record = await Case.create(caseData);
      } else {
        throw createErr;
      }
    }

    console.log(`[cases:create] [corrId: ${corrId}] [stage: created] [caseId: ${record._id}] [number: ${record.number}]`);

    await record.populate(["assignedTo", "createdBy"]);

    // 5. Non-Fatal Audit Logging
    try {
      if (userId) {
        await AuditLog.logWithActivity(
          {
            userId: new mongoose.Types.ObjectId(userId),
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
      }
    } catch (auditErr: any) {
      console.warn(`[cases:create] [corrId: ${corrId}] Non-fatal audit log error:`, auditErr?.message);
    }

    res.status(201).json({ case: record });
  } catch (err: any) {
    console.error(`[cases:create] [corrId: ${corrId}] [stage: failed] Error:`, err);
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors || {}).map((e: any) => e.message);
      res.status(400).json({ message: messages.length > 0 ? messages.join(", ") : err.message });
      return;
    }
    if (err.code === 11000) {
      res.status(409).json({ message: "A case with this number or idempotency key already exists" });
      return;
    }
    if (err.name === "CastError") {
      res.status(400).json({ message: `Invalid ID format for ${err.path}` });
      return;
    }
    res.status(500).json({ message: err?.message || "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/cases/:id — partial update (with authorization)
// ---------------------------------------------------------------------------

router.patch("/:id", requireResourceAccess("case"), async (req: Request, res: Response) => {
  try {
    // ---------------------------------------------------------------------------
    // Explicit field whitelist — never spread req.body directly into DB updates.
    // Internal fields: _id, number, createdBy, createdAt, updatedAt
    // are server-controlled and must not be modifiable via this endpoint.
    // ---------------------------------------------------------------------------
    const ALLOWED_FIELDS = [
      "title", "description", "practice", "court", "judge", "courtCaseId",
      "status", "priority", "nextHearing", "parties", "tags", "progress",
    ] as const;

    const updates: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    // assignedTo: only admins may reassign to other users.
    if (req.body["assignedTo"] !== undefined) {
      if (req.user?.role === "admin") {
        updates["assignedTo"] = req.body["assignedTo"];
      } else if (req.body["assignedTo"] === req.userId) {
        // Non-admins may assign to themselves only.
        updates["assignedTo"] = req.userId;
      } else {
        res.status(403).json({ message: "Cannot assign case to another user" });
        return;
      }
    }

    // Convert nextHearing string to Date if provided
    if (updates["nextHearing"]) {
      const d = new Date(updates["nextHearing"] as string);
      updates["nextHearing"] = !isNaN(d.getTime()) ? d : null;
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

    // Parties validation stage for PATCH
    if (updates["parties"] !== undefined && Array.isArray(updates["parties"])) {
      const sanitizedParties: Array<{
        clientId?: mongoose.Types.ObjectId;
        name: string;
        role: string;
        type: "client" | "sub_client" | "opposing_party" | "counsel" | "other";
      }> = [];

      for (const p of updates["parties"] as any[]) {
        if (!p || typeof p !== "object" || !p.name || !String(p.name).trim()) continue;
        const partyName = String(p.name).trim();
        const partyRole = String(p.role || "Party").trim();
        let partyType: "client" | "sub_client" | "opposing_party" | "counsel" | "other" =
          ["client", "sub_client", "opposing_party", "counsel", "other"].includes(p.type)
            ? p.type
            : "client";
        let linkedClientId: mongoose.Types.ObjectId | undefined;

        if (p.clientId) {
          if (!mongoose.Types.ObjectId.isValid(p.clientId)) {
            res.status(400).json({ message: `Invalid client ID format: ${p.clientId}` });
            return;
          }
          const realClient = await Client.findById(p.clientId).select("_id name").lean();
          if (!realClient) {
            res.status(400).json({ message: `Client not found with ID: ${p.clientId}` });
            return;
          }
          linkedClientId = realClient._id as mongoose.Types.ObjectId;
        } else if (partyType === "client" || partyType === "sub_client") {
          const matchingClient = await Client.findOne({
            name: new RegExp(`^${partyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
          })
            .select("_id")
            .lean();
          if (matchingClient) {
            linkedClientId = matchingClient._id as mongoose.Types.ObjectId;
          } else if (partyType === "client") {
            partyType = "other";
          }
        }

        sanitizedParties.push({
          name: partyName,
          role: partyRole,
          type: partyType,
          ...(linkedClientId ? { clientId: linkedClientId } : {}),
        });
      }
      updates["parties"] = sanitizedParties;
    }

    const record = await Case.findByIdAndUpdate(req.params["id"], updates, {
      new: true,
      runValidators: true,
    })
      .populate("assignedTo", "name email title")
      .populate("createdBy", "name")
      .populate("parties.clientId", "name email phone");

    if (!record) {
      res.status(404).json({ message: "Case not found" });
      return;
    }

    if (updates["parties"] !== undefined) {
      const primaryClientParty = (record.parties || []).find((p: any) => (p.type === "client" || p.type === "sub_client") && p.clientId);
      const newClientId = primaryClientParty ? (primaryClientParty.clientId as any)._id ?? primaryClientParty.clientId : null;
      await DocumentModel.updateMany({ caseId: record._id }, { clientId: newClientId });
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
  } catch (err: any) {
    console.error("[cases] Update error:", err);
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors || {}).map((e: any) => e.message);
      res.status(400).json({ message: messages.length > 0 ? messages.join(", ") : err.message });
      return;
    }
    if (err.code === 11000) {
      res.status(409).json({ message: "Duplicate record exists" });
      return;
    }
    if (err.name === "CastError") {
      res.status(400).json({ message: `Invalid ID format for ${err.path}` });
      return;
    }
    res.status(500).json({ message: err?.message || "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/cases/:id — archive case (preserve all related data)
// Legal records must not be destroyed; use archive semantics instead.
// ---------------------------------------------------------------------------

router.delete("/:id", requireResourceAccess("case"), async (req: Request, res: Response) => {
  try {
    const record = await Case.findByIdAndUpdate(
      req.params["id"],
      {
        $set: {
          status: "Archived",
          archivedAt: new Date(),
          archivedBy: new mongoose.Types.ObjectId(req.userId!),
        },
        $push: {
          timeline: {
            event: "Case archived",
            by: req.user?.name ?? "Unknown",
            when: new Date(),
          },
        },
      },
      { new: true }
    );

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
        details: "Case archived (soft-delete)",
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      },
      req.app.get("io")
    );

    res.json({ message: "Case archived", case: record });
  } catch (err) {
    console.error("[cases] Archive error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/cases/:id/parties — add a party (with authorization)
// ---------------------------------------------------------------------------

router.post("/:id/parties", requireResourceAccess("case"), async (req: Request, res: Response) => {
  try {
    const { name, role, type, clientId } = req.body;

    if (!name || !String(name).trim() || !role || !String(role).trim()) {
      res.status(400).json({ message: "Party name and role are required" });
      return;
    }

    let linkedClientId: mongoose.Types.ObjectId | undefined;
    if (clientId) {
      if (!mongoose.Types.ObjectId.isValid(clientId)) {
        res.status(400).json({ message: `Invalid client ID format: ${clientId}` });
        return;
      }
      const realClient = await Client.findById(clientId).select("_id name").lean();
      if (!realClient) {
        res.status(400).json({ message: `Client not found with ID: ${clientId}` });
        return;
      }
      linkedClientId = realClient._id as mongoose.Types.ObjectId;
    }

    const record = await Case.findById(req.params["id"]);
    if (!record) {
      res.status(404).json({ message: "Case not found" });
      return;
    }

    const partyType = ["client", "sub_client", "opposing_party", "counsel", "other"].includes(type) ? type : "client";
    const cleanName = String(name).trim();
    const cleanRole = String(role).trim();

    record.parties.push({
      name: cleanName,
      role: cleanRole,
      type: partyType,
      ...(linkedClientId ? { clientId: linkedClientId } : {}),
    });
    record.timeline.push({
      event: `Added party: ${cleanName} (${cleanRole})`,
      by: req.user?.name ?? "Unknown",
      when: new Date(),
    });

    await record.save();

    // Reconcile document client linkage if a client party was added
    if (linkedClientId && (partyType === "client" || partyType === "sub_client")) {
      await DocumentModel.updateMany(
        { caseId: record._id, $or: [{ clientId: { $exists: false } }, { clientId: null }] },
        { clientId: linkedClientId }
      );
    }

    await AuditLog.logWithActivity(
      {
        userId: new mongoose.Types.ObjectId(req.userId!),
        userName: req.user?.name ?? "Unknown",
        action: "update",
        resource: "case",
        resourceId: record._id.toString(),
        resourceName: record.title,
        details: `Added party: ${cleanName} (${cleanRole})`,
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
// DELETE /api/cases/:id/parties/:partyId — remove a party from case
// ---------------------------------------------------------------------------

router.delete("/:id/parties/:partyId", requireResourceAccess("case"), async (req: Request, res: Response) => {
  try {
    const { id, partyId } = req.params;
    const record = await Case.findById(id);
    if (!record) {
      res.status(404).json({ message: "Case not found" });
      return;
    }

    const partyIndex = record.parties.findIndex((p: any) =>
      p._id?.toString() === partyId || String(p.id) === partyId
    );

    if (partyIndex === -1) {
      res.status(404).json({ message: "Party not found in case" });
      return;
    }

    const removedParty = record.parties[partyIndex];
    record.parties.splice(partyIndex, 1);

    record.timeline.push({
      event: `Removed party: ${removedParty.name} (${removedParty.role})`,
      by: req.user?.name ?? "Unknown",
      when: new Date(),
    });

    await record.save();

    // If removed party was a client, resync document clientId to the new primary client if any
    if (removedParty.clientId) {
      const remainingClientParty = record.parties.find(
        (p: any) => (p.type === "client" || p.type === "sub_client") && p.clientId
      );
      const newClientId = remainingClientParty ? remainingClientParty.clientId : null;
      await DocumentModel.updateMany({ caseId: record._id }, { clientId: newClientId });
    }

    await AuditLog.logWithActivity(
      {
        userId: new mongoose.Types.ObjectId(req.userId!),
        userName: req.user?.name ?? "Unknown",
        action: "update",
        resource: "case",
        resourceId: record._id.toString(),
        resourceName: record.title,
        details: `Removed party: ${removedParty.name} (${removedParty.role})`,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      },
      req.app.get("io")
    );

    res.json({ case: record, message: "Party removed successfully" });
  } catch (err) {
    console.error("[cases] Remove party error:", err);
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