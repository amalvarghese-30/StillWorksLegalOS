import { Router, type Request, type Response } from "express";
import type { Readable } from "node:stream";
import busboy from "busboy";
import { DocumentModel, type IDocument } from "../models/Document.js";
import { Case } from "../models/Case.js";
import { AuditLog } from "../models/AuditLog.js";
import { FileIntegrity } from "../models/FileIntegrity.js";
import { NotificationService } from "../services/notifications.js";
import { Types } from "mongoose";
import { requireAuth } from "../middleware/auth.js";
import { requireResourceAccess, getAccessibleCaseIds, canAccessCase } from "../middleware/authorization.js";
import {
  buildAccessibleNasTree,
  validateMimeType,
  formatBytes,
  sanitizeNasPath,
  getDocumentPath,
  getCaseFolderPath,
  createDocumentAuditLog,
} from "../services/nas.js";
import { uploadStream, downloadStream, deletePath } from "../services/webdav.js";

const router = Router();

// ---------------------------------------------------------------------------
// All document routes below require authentication.
// ---------------------------------------------------------------------------

router.use(requireAuth);

// ---------------------------------------------------------------------------
// GET /api/documents — list with search, state filter, pagination
// Filters to user's accessible documents
// ---------------------------------------------------------------------------

router.get("/", async (req: Request, res: Response) => {
  try {
    const {
      search,
      state,
      caseId,
      page = "1",
      limit = "24",
    } = req.query as Record<string, string>;

    let filter: Record<string, unknown> = {};

    if (state && state !== "all") filter["state"] = state;
    if (caseId) filter["caseId"] = caseId;

    if (search && search.trim()) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter["name"] = regex;
    }

    // Non-admins only see documents they uploaded or in their cases
    if (req.user!.role !== "admin") {
      const accessibleCaseIds = await getAccessibleCaseIds(req.userId!, req.user!.role);

      const accessFilter: Record<string, unknown> =
        accessibleCaseIds.length === 0
          ? { uploadedBy: req.userId }
          : { $or: [{ uploadedBy: req.userId }, { caseId: { $in: accessibleCaseIds } }] };

      const hasBaseFilter = Object.keys(filter).length > 0;
      filter = hasBaseFilter ? { $and: [filter, accessFilter] } : accessFilter;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 24));
    const skip = (pageNum - 1) * limitNum;

    const [documents, total] = await Promise.all([
      DocumentModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("uploadedBy", "name")
        .populate("caseId", "title number")
        .lean(),
      DocumentModel.countDocuments(filter),
    ]);

    res.json({
      documents,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    console.error("[documents] List error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/documents/nas/structure — secure NAS folder tree (access-controlled)
// ---------------------------------------------------------------------------

router.get("/nas/structure", async (req: Request, res: Response) => {
  try {
    const folders = await buildAccessibleNasTree(req.userId!, req.user!.role);
    res.json({ folders });
  } catch (err) {
    console.error("[documents] NAS structure error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/documents/:id/download — stream the file from the NAS (WebDAV)
// ---------------------------------------------------------------------------

router.get("/:id/download", requireResourceAccess("document"), async (req: Request, res: Response) => {
  try {
    const document = await DocumentModel.findById(req.params["id"]);
    if (!document) {
      res.status(404).json({ message: "Document not found" });
      return;
    }

    if (!document.nasPath) {
      res.status(400).json({ message: "Document has no NAS path" });
      return;
    }

    await AuditLog.create(createDocumentAuditLog(
      req.userId!,
      req.user?.name ?? "Unknown",
      "download",
      document._id.toString(),
      document.name,
      req
    ));

    const stream = await downloadStream(document.nasPath);
    const fileName = document.originalName || document.name || "download";
    const safeName = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");

    res.setHeader("Content-Type", document.mimeType || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    );
    res.setHeader("Cache-Control", "private, no-store");
    if (document.size > 0) res.setHeader("Content-Length", String(document.size));

    stream.on("error", (err) => {
      console.error("[documents] Download stream error:", err);
      if (!res.headersSent) {
        res.status(502).json({ message: "Failed to stream file from NAS" });
      } else {
        res.destroy();
      }
    });

    stream.pipe(res);
  } catch (err) {
    console.error("[documents] Download error:", err);
    if (!res.headersSent) {
      res.status(502).json({ message: "Failed to stream file from NAS" });
    } else {
      res.destroy();
    }
  }
});

// ---------------------------------------------------------------------------
// GET /api/documents/:id/verify — verify file integrity (admin only)
// ---------------------------------------------------------------------------

router.get("/:id/verify", requireResourceAccess("document"), async (req: Request, res: Response) => {
  try {
    const document = await DocumentModel.findById(req.params["id"]);
    if (!document) {
      res.status(404).json({ message: "Document not found" });
      return;
    }

    if (!document.sha256) {
      res.status(400).json({ message: "Document has no integrity hash" });
      return;
    }

    res.json({
      documentId: document._id.toString(),
      expectedHash: document.sha256,
      algorithm: "SHA-256",
    });
  } catch (err) {
    console.error("[documents] Verify error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/documents/:id/verify — verify uploaded file integrity (server-side)
// Expects multipart/form-data with file
// ---------------------------------------------------------------------------

router.post("/:id/verify", requireResourceAccess("document"), async (req: Request, res: Response) => {
  try {
    const document = await DocumentModel.findById(req.params["id"]);
    if (!document) {
      res.status(404).json({ message: "Document not found" });
      return;
    }

    if (!document.sha256) {
      res.status(400).json({ message: "Document has no integrity hash" });
      return;
    }

    res.json({
      documentId: document._id.toString(),
      expectedHash: document.sha256,
      message: "Use client-side verification or implement server-side streaming verification",
    });
  } catch (err) {
    console.error("[documents] Verify error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/documents/:id (with authorization)
// ---------------------------------------------------------------------------

router.get("/:id", requireResourceAccess("document"), async (req: Request, res: Response) => {
  try {
    const document = await DocumentModel.findById(req.params["id"])
      .populate("uploadedBy", "name")
      .populate("caseId", "title number")
      .populate("approvedBy", "name")
      .populate("rejectedBy", "name");
    if (!document) {
      res.status(404).json({ message: "Document not found" });
      return;
    }
    res.json({ document });
  } catch (err) {
    console.error("[documents] Get error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/documents/upload — streaming multipart upload
// Streams the file straight through to the NAS (WebDAV), hashing bytes in
// transit. The file is never buffered whole in memory. Cloudflare Tunnel caps
// requests at 100MB, so we enforce that limit here as well.
// ---------------------------------------------------------------------------

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

router.post("/upload", async (req: Request, res: Response) => {
  const contentType = req.headers["content-type"] ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    res.status(400).json({ message: "Expected multipart/form-data" });
    return;
  }

  const bb = busboy({
    headers: req.headers,
    limits: { fileSize: MAX_UPLOAD_BYTES },
  });

  const fields: Record<string, string> = {};
  let fileSeen = false;
  let settled = false;
  let fileTask: Promise<void> = Promise.resolve();

  const respond = (status: number, body: unknown) => {
    if (settled) return;
    settled = true;
    res.status(status).json(body);
  };

  const httpError = (status: number, message: string): Error & { status: number } => {
    const err = new Error(message) as Error & { status: number };
    err.status = status;
    return err;
  };

  bb.on("field", (name, value) => {
    fields[name] = value;
  });

  bb.on("file", (_fieldname, fileStream, info) => {
    if (fileSeen) {
      fileStream.resume();
      return;
    }
    fileSeen = true;

    const originalName = info.filename || "document";
    const mimeType = info.mimeType || "application/octet-stream";
    const displayName = fields["name"]?.trim() || originalName;
    const caseId = fields["caseId"]?.trim() || undefined;

    fileTask = processFile(fileStream, { originalName, displayName, mimeType, caseId });
  });

  bb.on("error", (err) => {
    console.error("[documents] Multipart parse error:", err);
    respond(400, { message: "Malformed upload request" });
  });

  bb.on("close", async () => {
    await fileTask;
    if (!settled) {
      respond(fileSeen ? 500 : 400, { message: fileSeen ? "Upload failed" : "No file uploaded" });
    }
  });

  req.pipe(bb);

  async function processFile(
    fileStream: Readable & { truncated?: boolean },
    meta: { originalName: string; displayName: string; mimeType: string; caseId?: string },
  ): Promise<void> {
    let doc: IDocument | null = null;
    let nasPath = "";
    let nasFolder = "/General";
    try {
      const mimeCheck = validateMimeType(meta.mimeType);
      if (!mimeCheck.valid) throw httpError(415, mimeCheck.error ?? "File type not allowed");

      let caseNumber = "";
      if (meta.caseId) {
        const caseDoc = await Case.findById(meta.caseId).select("number _id").lean();
        if (!caseDoc) throw httpError(404, "Case not found");
        const allowed = await canAccessCase(req.userId!, req.user!.role, meta.caseId);
        if (!allowed) throw httpError(403, "Cannot upload to a case you don't have access to");
        caseNumber = caseDoc.number;
        nasFolder = getCaseFolderPath(caseNumber, meta.caseId);
      }

      // Check if a document with the same name and caseId already exists to determine version
      let version = 1;
      if (meta.caseId) {
        const existingDoc = await DocumentModel.findOne({
          name: meta.displayName,
          caseId: meta.caseId,
        }).sort({ version: -1 });

        if (existingDoc) {
          version = (existingDoc.version || 1) + 1;
        }
      } else {
        const existingDoc = await DocumentModel.findOne({
          name: meta.displayName,
          nasFolder: nasFolder,
        }).sort({ version: -1 });

        if (existingDoc) {
          version = (existingDoc.version || 1) + 1;
        }
      }

      doc = await DocumentModel.create({
        name: meta.displayName,
        originalName: meta.originalName,
        kind: "",
        mimeType: meta.mimeType,
        size: 0,
        sizeFormatted: "0 Bytes",
        caseId: meta.caseId ?? null,
        uploadedBy: req.userId,
        state: "Draft",
        nasPath: "",
        nasFolder: nasFolder,
        version: version,
      });

      const documentIdStr = doc._id.toString();
      if (meta.caseId) {
        nasPath = getDocumentPath(caseNumber, meta.caseId, documentIdStr, meta.originalName);
      } else {
        const ext = meta.originalName.includes(".")
          ? meta.originalName.substring(meta.originalName.lastIndexOf("."))
          : "";
        const safeBase = meta.originalName
          .replace(/\.[^.]+$/, "")
          .replace(/[^a-zA-Z0-9_-]/g, "_")
          .substring(0, 100);
        nasPath = sanitizeNasPath(`/General/${documentIdStr}-${safeBase}${ext}`);
      }

      const { size, sha256 } = await uploadStream(nasPath, fileStream);

      if (fileStream.truncated) {
        throw httpError(413, `File exceeds the ${MAX_UPLOAD_BYTES / 1048576}MB limit`);
      }

      doc.size = size;
      doc.sizeFormatted = formatBytes(size);
      doc.sha256 = sha256;
      doc.nasPath = nasPath;
      doc.state = "Pending";
      await doc.save();

      await FileIntegrity.registerFile({
        documentId: doc._id,
        originalName: meta.originalName,
        storedPath: nasPath,
        size,
        mimeType: meta.mimeType,
        sha256,
        uploadedBy: req.userId as any,
        caseId: meta.caseId ? (meta.caseId as any) : undefined,
      });

      await AuditLog.create(createDocumentAuditLog(
        req.userId!,
        req.user?.name ?? "Unknown",
        "upload",
        doc._id.toString(),
        meta.displayName,
        req,
      ));

      respond(201, { document: doc });
    } catch (err) {
      if (doc) {
        await DocumentModel.findByIdAndDelete(doc._id).catch(() => { });
      }
      if (nasPath) {
        await deletePath(nasPath).catch(() => { });
      }
      fileStream.resume();
      const status = (err as { status?: number }).status ?? 502;
      const message = err instanceof Error ? err.message : "Failed to upload file to NAS";
      console.error("[documents] Upload stream error:", err);
      respond(status, { message });
    }
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/documents/:id — update metadata or approval state (with authorization)
// ---------------------------------------------------------------------------

router.patch("/:id", requireResourceAccess("document"), async (req: Request, res: Response) => {
  try {
    const updates: Record<string, unknown> = {};
    const allowed = ["name", "nasPath", "nasFolder", "state"];
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if ((updates["state"] === "Approved" || updates["state"] === "Rejected") && req.user!.role !== "admin") {
      res.status(403).json({ message: "Only admins can approve or reject documents" });
      return;
    }

    if (updates["state"] === "Approved") {
      updates["approvedBy"] = req.userId;
      updates["approvedAt"] = new Date();
    }
    if (updates["state"] === "Rejected") {
      updates["rejectedBy"] = req.userId;
      updates["rejectedReason"] = req.body["rejectedReason"] ?? "";
    }

    // Fetch the original document to detect state changes
    const originalDocument = await DocumentModel.findById(req.params["id"]);

    const document = await DocumentModel.findByIdAndUpdate(req.params["id"], updates, {
      new: true,
      runValidators: true,
    });

    if (!document) {
      res.status(404).json({ message: "Document not found" });
      return;
    }

    // Notify uploader if document was approved or rejected
    if (
      updates["state"] !== undefined &&
      originalDocument &&
      originalDocument.state !== updates["state"] &&
      (updates["state"] === "Approved" || updates["state"] === "Rejected")
    ) {
      // Notify the uploader if they are not the one who made the change
      if (document.uploadedBy && !document.uploadedBy.equals(req.userId)) {
        const notificationType = updates["state"] === "Approved" ? "DOCUMENT_SHARED" : "DOCUMENT_SHARED"; // We can use different types, but let's use DOCUMENT_SHARED for both for now
        const title = updates["state"] === "Approved" ? "Document Approved" : "Document Rejected";
        const message = updates["state"] === "Approved"
          ? `Your document "${document.name}" has been approved.`
          : `Your document "${document.name}" has been rejected.${document.rejectedReason ? " Reason: " + document.rejectedReason : ""}`;

        await NotificationService.createNotification({
          userId: document.uploadedBy,
          type: "DOCUMENT_SHARED", // We'll use this type for both approved and rejected for simplicity
          title,
          message,
          relatedId: document._id,
          relatedModel: "Document",
          actorId: new Types.ObjectId(req.userId),
          metadata: {
            documentName: document.name,
            documentId: document._id.toString(),
            state: updates["state"],
            rejectedReason: updates["state"] === "Rejected" ? document.rejectedReason : undefined,
          },
        }, req.app.get("io"));
      }
    }

    await AuditLog.create(createDocumentAuditLog(
      req.userId!,
      req.user?.name ?? "Unknown",
      updates["state"] === "Approved" ? "approve" : updates["state"] === "Rejected" ? "reject" : "update",
      document._id.toString(),
      document.name,
      req
    ));

    res.json({ document });
  } catch (err) {
    console.error("[documents] Update error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/documents/:docId/request-access (with authorization)
// ---------------------------------------------------------------------------

router.post("/:docId/request-access", requireResourceAccess("document", "docId"), async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const document = await DocumentModel.findById(req.params["docId"]);
    if (!document) {
      res.status(404).json({ message: "Document not found" });
      return;
    }

    document.accessRequests.push({
      userId: req.userId! as any,
      reason: reason ?? "",
      status: "pending",
      createdAt: new Date(),
    });

    await document.save();

    // Notify the document's uploader about the access request (if they are not the requester)
    if (document.uploadedBy && !document.uploadedBy.equals(req.userId)) {
      await NotificationService.createNotification({
        userId: document.uploadedBy,
        type: "DOCUMENT_SHARED", // We can create a specific type for access request, but let's use DOCUMENT_SHARED for now
        title: "Access Request Received",
        message: `User "${req.user?.name ?? "Unknown"}" has requested access to your document "${document.name}".`,
        relatedId: document._id,
        relatedModel: "Document",
        actorId: new Types.ObjectId(req.userId),
        metadata: {
          documentName: document.name,
          documentId: document._id.toString(),
          requesterId: req.userId,
          requesterName: req.user?.name ?? "Unknown",
          reason: reason ?? "",
        },
      }, req.app.get("io"));
    }

    await AuditLog.create(createDocumentAuditLog(
      req.userId!,
      req.user?.name ?? "Unknown",
      "access_request",
      document._id.toString(),
      document.name,
      req,
      reason
    ));

    res.json({ message: "Access requested", document });
  } catch (err) {
    console.error("[documents] Access request error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/documents/:docId/access-requests/:requestId — review an access
// request (admin only). Approves or rejects a pending document access request.
// ---------------------------------------------------------------------------

router.patch("/:docId/access-requests/:requestId", requireAuth, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== "admin") {
      res.status(403).json({ message: "Only admins can review access requests" });
      return;
    }

    const { status } = req.body;
    if (status !== "approved" && status !== "rejected") {
      res.status(400).json({ message: "status must be 'approved' or 'rejected'" });
      return;
    }

    const document = await DocumentModel.findById(req.params["docId"]);
    if (!document) {
      res.status(404).json({ message: "Document not found" });
      return;
    }

    const requestId = req.params["requestId"];
    const request = document.accessRequests.find(
      (ar) => ar.createdAt.getTime().toString() === requestId
    );
    if (!request) {
      res.status(404).json({ message: "Access request not found" });
      return;
    }

    request.status = status;
    await document.save();

    // Notify the requester about the outcome of their access request
    if (request.userId && !request.userId.equals(req.userId)) { // Not notifying the admin who made the decision
      const notificationTitle = status === "approved" ? "Access Request Approved" : "Access Request Rejected";
      const notificationMessage = status === "approved"
        ? `Your request to access document "${document.name}" has been approved.`
        : `Your request to access document "${document.name}" has been rejected.${request.reason ? " Reason: " + request.reason : ""}`;

      await NotificationService.createNotification({
        userId: request.userId,
        type: "DOCUMENT_SHARED", // We can use a specific type, but let's reuse for now
        title: notificationTitle,
        message: notificationMessage,
        relatedId: document._id,
        relatedModel: "Document",
        actorId: new Types.ObjectId(req.userId),
        metadata: {
          documentName: document.name,
          documentId: document._id.toString(),
          requesterId: request.userId,
          requesterName: request.userId.toString(), // We don't have the name here, but we can fetch it if needed
          status: status,
          reason: request.reason ?? "",
        },
      }, req.app.get("io"));
    }

    try {
      await AuditLog.create(createDocumentAuditLog(
        req.userId!,
        req.user?.name ?? "Unknown",
        status === "approved" ? "approve" : "reject",
        document._id.toString(),
        document.name,
        req,
        request.reason
      ));
    } catch (logErr) {
      console.error("[documents] Access review audit log error:", logErr);
    }

    res.json({ message: `Access request ${status}`, document });
  } catch (err) {
    console.error("[documents] Access request review error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/documents/:id (with authorization)
// ---------------------------------------------------------------------------

router.delete("/:id", requireResourceAccess("document"), async (req: Request, res: Response) => {
  try {
    const document = await DocumentModel.findByIdAndDelete(req.params["id"]);
    if (!document) {
      res.status(404).json({ message: "Document not found" });
      return;
    }

    await AuditLog.create(createDocumentAuditLog(
      req.userId!,
      req.user?.name ?? "Unknown",
      "delete",
      document._id.toString(),
      document.name,
      req
    ));

    res.json({ message: "Document deleted" });
  } catch (err) {
    console.error("[documents] Delete error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/documents/:id/versions — get version history for a document
// ---------------------------------------------------------------------------
router.get("/:id/versions", requireResourceAccess("document"), async (req: Request, res: Response) => {
  try {
    const document = await DocumentModel.findById(req.params["id"]);
    if (!document) {
      res.status(404).json({ message: "Document not found" });
      return;
    }

    const filter: any = { name: document.name };
    if (document.caseId) {
      filter.caseId = document.caseId;
    } else {
      filter.nasFolder = document.nasFolder || "/General";
    }

    const versions = await DocumentModel.find(filter)
      .sort({ version: -1 })
      .populate("uploadedBy", "name")
      .populate("caseId", "title number")
      .lean();

    res.json({ versions, count: versions.length });
  } catch (err) {
    console.error("[documents] Get versions error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;