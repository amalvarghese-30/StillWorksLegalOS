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

    // Non-admins only see their clients
    if (req.user!.role !== "admin") {
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
        // Filter text results by accessible clients for non-admins
        if (req.user!.role !== "admin") {
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
    const client = await Client.findById(req.params["id"]);
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
      propertyDetails,
      subClients,
    } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ message: "Client name is required" });
      return;
    }

    // KYC auto-verification: if Aadhar + PAN provided, mark Verified
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

    res.status(201).json({ client });
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
    const updates = { ...req.body, updatedBy: req.userId };

    // Re-evaluate KYC if Aadhar/PAN change
    const existing = await Client.findById(req.params["id"]);
    if (!existing) {
      res.status(404).json({ message: "Client not found" });
      return;
    }

    const aadhar = updates["aadhar"] ?? existing.aadhar;
    const pan = updates["pan"] ?? existing.pan;
    updates["kyc"] = aadhar && pan ? "Verified" : existing.kyc;

    const client = await Client.findByIdAndUpdate(req.params["id"], updates, {
      new: true,
      runValidators: true,
    });

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
// DELETE /api/clients/:id (with authorization)
// ---------------------------------------------------------------------------

router.delete("/:id", requireResourceAccess("client"), async (req: Request, res: Response) => {
  try {
    const client = await Client.findByIdAndDelete(req.params["id"]);
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
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ message: "Client deleted" });
  } catch (err) {
    console.error("[clients] Delete error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;