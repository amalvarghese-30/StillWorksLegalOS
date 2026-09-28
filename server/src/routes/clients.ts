import { Router, type Request, type Response } from "express";
import { Client } from "../models/Client.js";
import { AuditLog } from "../models/AuditLog.js";
import { requireAuth } from "../middleware/auth.js";
import { canAccessClient, requireResourceAccess, getAccessibleClientIds } from "../middleware/authorization.js";

const router = Router();

// All routes require authentication
router.use(requireAuth);

// ---------------------------------------------------------------------------
// GET /api/clients — list with search, filter, pagination
// Filters to user's accessible clients
// ---------------------------------------------------------------------------

router.get("/", async (req: Request, res: Response) => {
  try {
    const {
      search,
      tag,
      type,
      kyc,
      page = "1",
      limit = "24",
    } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = {};

    // Non-admins without clients permission only see their clients
    if (req.user!.role !== "admin" && !req.user?.permissions?.clients) {
      const accessibleClientIds = await getAccessibleClientIds(req.userId!, req.user!.role);
      if (accessibleClientIds.length === 0) {
        res.json({
          clients: [],
          total: 0,
          page: 1,
          totalPages: 1,
        });
        return;
      }
      filter["_id"] = { $in: accessibleClientIds };
    }

    if (tag && tag !== "All") filter["tag"] = tag;
    if (type && type !== "All") filter["type"] = type;
    if (kyc && kyc !== "All") filter["kyc"] = kyc;

    // Universal search: text index for full-text, fallback to regex
    if (search && search.trim()) {
      // Try text search first
      const textResults = await Client.find(
        { $text: { $search: search.trim() } },
        { score: { $meta: "textScore" } },
      )
        .sort({ score: { $meta: "textScore" } })
        .limit(50)
        .lean();

      if (textResults.length > 0) {
        // Filter text results by accessible clients for non-admins without clients permission
        if (req.user!.role !== "admin" && !req.user?.permissions?.clients) {
          const accessibleIds = await getAccessibleClientIds(req.userId!, req.user!.role);
          const filtered = textResults.filter((c) => accessibleIds.includes(c._id.toString()));
          res.json({
            clients: filtered,
            total: filtered.length,
            page: 1,
            totalPages: 1,
          });
        } else {
          res.json({
            clients: textResults,
            total: textResults.length,
            page: 1,
            totalPages: 1,
          });
        }
        return;
      }

      // Fallback to regex on indexed fields
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter["$or"] = [
        { name: regex },
        { phone: regex },
        { pan: regex },
        { aadhar: regex },
        { email: regex },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 24));
    const skip = (pageNum - 1) * limitNum;

    const [clients, total] = await Promise.all([
      Client.find(filter)
        .populate("assignedTo", "name email title initials")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Client.countDocuments(filter),
    ]);

    res.json({
      clients,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    console.error("[clients] List error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/clients/:id (with authorization)
// ---------------------------------------------------------------------------

router.get("/:id", requireResourceAccess("client"), async (req: Request, res: Response) => {
  try {
    const client = await Client.findById(req.params["id"]).populate("assignedTo", "name email title initials");
    if (!client) {
      res.status(404).json({ message: "Client not found" });
      return;
    }
    res.json({ client });
  } catch (err) {
    console.error("[clients] Get error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/clients — create (5-step wizard: step 1 always, rest optional)
// ---------------------------------------------------------------------------

router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      type = "Individual",
      tag = "Active",
      name,
      phone,
      email,
      address,
      aadhar,
      pan,
      notes,
      assignedTo,
      promisedCompletionDate,
      propertyDetails,
      subClients,
    } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ field: "name", message: "Client name is required" });
      return;
    }

    if (phone && phone.trim()) {
      const cleanPhone = phone.trim().replace(/\D/g, "");
      if (cleanPhone.length !== 10) {
        res.status(400).json({ field: "phone", message: "Phone number must be a valid 10-digit number" });
        return;
      }
    }

    if (email && email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        res.status(400).json({ field: "email", message: "Invalid email address format" });
        return;
      }
    }

    if (aadhar && aadhar.trim()) {
      const cleanAadhar = aadhar.trim().replace(/\D/g, "");
      if (cleanAadhar.length !== 12) {
        res.status(400).json({ field: "aadhar", message: "Aadhaar must be exactly 12 digits" });
        return;
      }
    }

    if (pan && pan.trim()) {
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i;
      if (!panRegex.test(pan.trim())) {
        res.status(400).json({ field: "pan", message: "Invalid PAN format (e.g. ABCDE1234F)" });
        return;
      }
    }

    // Identity auto-verification: if Aadhar + PAN provided, mark Verified
    const kyc = aadhar && pan ? "Verified" : "Pending";

    const client = await Client.create({
      type,
      tag,
      name: name.trim(),
      phone: phone ?? "",
      email: email ?? "",
      address: address ?? "",
      aadhar: aadhar ?? "",
      pan: pan ?? "",
      kyc,
      notes: notes ?? "",
      assignedTo: Array.isArray(assignedTo) ? assignedTo : assignedTo ? [assignedTo] : [],
      promisedCompletionDate: promisedCompletionDate ? new Date(promisedCompletionDate) : null,
      propertyDetails: propertyDetails?.address ? propertyDetails : undefined,
      subClients: subClients ?? [],
      createdBy: req.userId,
      updatedBy: req.userId,
    });

    await AuditLog.create({
      userId: req.userId,
      userName: req.user?.name ?? "Unknown",
      action: "create",
      resource: "client",
      resourceId: client._id.toString(),
      resourceName: client.name,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    const populatedClient = await Client.findById(client._id).populate("assignedTo", "name email title initials");

    res.status(201).json({ client: populatedClient ?? client });
  } catch (err: any) {
    console.error("[clients] Create error:", err);
    if (err.code === 11000) {
      res.status(409).json({ message: "A client with these details already exists" });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/clients/:id — partial update (with authorization)
// ---------------------------------------------------------------------------

router.patch("/:id", requireResourceAccess("client"), async (req: Request, res: Response) => {
  try {
    // Explicit whitelist — never spread req.body into DB updates.
    // _id, createdBy, createdAt, updatedAt are server-controlled.
    const ALLOWED_FIELDS = [
      "name", "type", "tag", "phone", "email", "address",
      "aadhar", "pan", "notes", "assignedTo", "promisedCompletionDate",
      "kyc", "propertyDetails", "subClients",
    ] as const;

    const updates: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    // updatedBy is always the current authenticated user — never from client input.
    updates["updatedBy"] = req.userId;

    if (updates["name"] !== undefined && (!updates["name"] || !String(updates["name"]).trim())) {
      res.status(400).json({ field: "name", message: "Client name cannot be empty" });
      return;
    }

    if (updates["phone"] && typeof updates["phone"] === "string" && updates["phone"].trim()) {
      const cleanPhone = updates["phone"].trim().replace(/\D/g, "");
      if (cleanPhone.length !== 10) {
        res.status(400).json({ field: "phone", message: "Phone number must be a valid 10-digit number" });
        return;
      }
    }

    if (updates["email"] && typeof updates["email"] === "string" && updates["email"].trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updates["email"].trim())) {
        res.status(400).json({ field: "email", message: "Invalid email address format" });
        return;
      }
    }

    if (updates["aadhar"] && typeof updates["aadhar"] === "string" && updates["aadhar"].trim()) {
      const cleanAadhar = updates["aadhar"].trim().replace(/\D/g, "");
      if (cleanAadhar.length !== 12) {
        res.status(400).json({ field: "aadhar", message: "Aadhaar must be exactly 12 digits" });
        return;
      }
    }

    if (updates["pan"] && typeof updates["pan"] === "string" && updates["pan"].trim()) {
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i;
      if (!panRegex.test(updates["pan"].trim())) {
        res.status(400).json({ field: "pan", message: "Invalid PAN format (e.g. ABCDE1234F)" });
        return;
      }
    }

    // Re-evaluate KYC if Aadhar/PAN change
    const existing = await Client.findById(req.params["id"]);
    if (!existing) {
      res.status(404).json({ message: "Client not found" });
      return;
    }

    const aadhar = (updates["aadhar"] ?? existing.aadhar) as string;
    const pan = (updates["pan"] ?? existing.pan) as string;
    if (updates["kyc"] === undefined) {
      updates["kyc"] = aadhar && pan ? "Verified" : existing.kyc;
    }

    const client = await Client.findByIdAndUpdate(req.params["id"], updates, {
      new: true,
      runValidators: true,
    }).populate("assignedTo", "name email title initials");

    if (!client) {
      res.status(404).json({ message: "Client not found" });
      return;
    }

    await AuditLog.create({
      userId: req.userId,
      userName: req.user?.name ?? "Unknown",
      action: "update",
      resource: "client",
      resourceId: client._id.toString(),
      resourceName: client.name,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ client });
  } catch (err) {
    console.error("[clients] Update error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/clients/:id — archive client (preserve historical case data)
// Hard-delete is prohibited: historical case parties reference client records.
// ---------------------------------------------------------------------------

router.delete("/:id", requireResourceAccess("client"), async (req: Request, res: Response) => {
  try {
    // Archive semantics: set tag to "Archived". The client record is retained
    // so that existing case parties and audit logs continue to resolve correctly.
    const client = await Client.findByIdAndUpdate(
      req.params["id"],
      { $set: { tag: "Archived", updatedBy: req.userId } },
      { new: true }
    );

    if (!client) {
      res.status(404).json({ message: "Client not found" });
      return;
    }

    await AuditLog.create({
      userId: req.userId,
      userName: req.user?.name ?? "Unknown",
      action: "delete",
      resource: "client",
      resourceId: client._id.toString(),
      resourceName: client.name,
      details: "Client archived (soft-delete)",
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ message: "Client archived", client });
  } catch (err) {
    console.error("[clients] Archive error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;