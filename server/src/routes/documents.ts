import { Router, type Request, type Response } from "express";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import busboy from "busboy";
import { DocumentModel, type IDocument } from "../models/Document.js";
import { Case } from "../models/Case.js";
import { Client } from "../models/Client.js";
import { Task } from "../models/Task.js";
import { User } from "../models/User.js";
import { AuditLog } from "../models/AuditLog.js";
import { FileIntegrity } from "../models/FileIntegrity.js";
import { NotificationService } from "../services/notifications.js";
import { Types } from "mongoose";
import { requireAuth } from "../middleware/auth.js";
import { requireResourceAccess, getAccessibleCaseIds, canAccessCase, canAccessClient, canAccessTask } from "../middleware/authorization.js";
import {
  buildAccessibleNasTree,
  validateMimeType,
  formatBytes,
  sanitizeNasPath,
  getDocumentPath,
  getCaseFolderPath,
  createDocumentAuditLog,
} from "../services/nas.js";
import { uploadStream, downloadStream, deletePath } from "../services/storage.js";

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
      clientId,
      taskId,
      page = "1",
      limit = "24",
    } = req.query as Record<string, string>;

    let filter: Record<string, unknown> = {};

    if (state && state !== "all") filter["state"] = state;
    if (taskId && taskId !== "all" && taskId !== "undefined" && taskId !== "null") {
      if (Types.ObjectId.isValid(taskId)) {
        filter["taskId"] = new Types.ObjectId(taskId);
      }
    }

    if (caseId && caseId !== "all" && caseId !== "undefined" && caseId !== "null") {
      if (Types.ObjectId.isValid(caseId)) {
        const caseObjId = new Types.ObjectId(caseId);
        const caseTasks = await Task.find({ caseId: caseObjId }).select("_id").lean();
        const caseTaskIds = caseTasks.map((t) => t._id);
        filter["$or"] = [
          { caseId: caseObjId },
          ...(caseTaskIds.length > 0 ? [{ taskId: { $in: caseTaskIds } }] : []),
        ];
      }
    } else if (clientId && clientId !== "all" && clientId !== "undefined" && clientId !== "null") {
      if (Types.ObjectId.isValid(clientId)) {
        const clientObjId = new Types.ObjectId(clientId);
        const clientCases = await Case.find({
          $or: [
            { clientId: clientObjId },
            { "parties.clientId": clientObjId },
          ],
        }).select("_id").lean();
        const clientCaseIds = clientCases.map((c) => c._id);
        const clientTasks = await Task.find({
          $or: [
            { clientId: clientObjId },
            ...(clientCaseIds.length > 0 ? [{ caseId: { $in: clientCaseIds } }] : []),
          ],
        }).select("_id").lean();
        const clientTaskIds = clientTasks.map((t) => t._id);

        filter["$or"] = [
          { clientId: clientObjId },
          ...(clientCaseIds.length > 0 ? [{ caseId: { $in: clientCaseIds } }] : []),
          ...(clientTaskIds.length > 0 ? [{ taskId: { $in: clientTaskIds } }] : []),
        ];
      }
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter["name"] = regex;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 24));
    const skip = (pageNum - 1) * limitNum;

    const [rawDocuments, total] = await Promise.all([
      DocumentModel.find(filter)
        .select("-storagePath -storageFolder -nasPath -nasFolder -filePath -tempPath")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("uploadedBy", "name email")
        .populate("caseId", "title number")
        .populate("accessRequests.userId", "name email")
        .lean(),
      DocumentModel.countDocuments(filter),
    ]);

    const currentUserId = req.userId?.toString();
    const isAdmin = req.user?.role === "admin";

    // Pre-query accessible tasks for documents with taskId
    const docTaskIds = rawDocuments.map((d: any) => d.taskId).filter(Boolean);
    let accessibleTaskSet = new Set<string>();
    if (!isAdmin && docTaskIds.length > 0 && currentUserId) {
      const userAccessibleTasks = await Task.find({
        _id: { $in: docTaskIds },
        $or: [
          { assignedTo: currentUserId },
          { assignedUsers: currentUserId },
          { assignedBy: currentUserId },
          { createdBy: currentUserId },
        ],
      }).select("_id").lean();
      accessibleTaskSet = new Set(userAccessibleTasks.map((t: any) => t._id.toString()));
    }

    const documents = rawDocuments.map((doc: any) => {
      const userReqs = (doc.accessRequests || []).filter(
        (ar: any) => (ar?.userId?._id || ar?.userId)?.toString() === currentUserId
      );
      const latestReq = userReqs.length > 0 ? userReqs[userReqs.length - 1] : null;

      let canAccess = false;
      let accessStatus: "approved" | "pending" | "rejected" | "none" = "none";

      if (isAdmin) {
        canAccess = true;
        accessStatus = "approved";
      } else if (doc.taskId && accessibleTaskSet.has(doc.taskId.toString())) {
        canAccess = true;
        accessStatus = "approved";
      } else if (doc.state === "Rejected") {
        canAccess = false;
        accessStatus = "rejected";
      } else if (latestReq?.status === "rejected") {
        canAccess = false;
        accessStatus = "rejected";
      } else if (latestReq?.status === "approved") {
        canAccess = true;
        accessStatus = "approved";
      } else if (latestReq?.status === "pending") {
        canAccess = false;
        accessStatus = "pending";
      } else if (
        (doc.uploadedBy?._id || doc.uploadedBy)?.toString() === currentUserId
      ) {
        canAccess = true;
        accessStatus = "approved";
      } else {
        canAccess = false;
        accessStatus = "none";
      }

      // Collect who all has access to this document
      const authorizedUsers: { id: string; name: string; role?: string }[] = [];
      if (doc.uploadedBy) {
        const uId = (doc.uploadedBy._id || doc.uploadedBy).toString();
        const uName = (doc.uploadedBy && typeof doc.uploadedBy === "object" && doc.uploadedBy.name)
          ? doc.uploadedBy.name
          : "Uploader";
        authorizedUsers.push({ id: uId, name: uName, role: "Uploader" });
      }
      (doc.accessRequests || []).forEach((ar: any) => {
        if (ar && ar.status === "approved" && ar.userId) {
          const aId = (ar.userId._id || ar.userId).toString();
          if (!authorizedUsers.some((u) => u.id === aId)) {
            authorizedUsers.push({
              id: aId,
              name: (ar.userId && typeof ar.userId === "object" && ar.userId.name)
                ? ar.userId.name
                : "Authorized",
              role: "Granted",
            });
          }
        }
      });

      const uploaderName = (doc.uploadedBy && typeof doc.uploadedBy === "object" && doc.uploadedBy.name)
        ? doc.uploadedBy.name
        : "Colleague";

      return {
        ...doc,
        caseName: doc.caseId?.title || doc.caseName || "General",
        uploadedByName: uploaderName,
        canAccess,
        accessStatus,
        authorizedUsers,
      };
    });

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
// GET /api/documents/requestable — list documents available for access requests
// ---------------------------------------------------------------------------

router.get("/requestable", async (req: Request, res: Response) => {
  try {
    const documents = await DocumentModel.find()
      .select("_id name size sizeFormatted state caseName createdAt accessRequests uploadedBy")
      .populate("caseId", "title number")
      .populate("uploadedBy", "name")
      .sort({ createdAt: -1 })
      .lean();

    const mapped = documents.map((d: any) => {
      const myRequest = (d.accessRequests || []).find(
        (ar: any) => ar.userId?.toString() === req.userId,
      );
      return {
        _id: d._id,
        name: d.name,
        size: d.size,
        sizeFormatted: d.sizeFormatted,
        state: d.state,
        caseName: d.caseId ? `${d.caseId.number} — ${d.caseId.title}` : d.caseName || "General",
        uploadedByName: d.uploadedBy?.name || "Colleague",
        myRequestStatus: myRequest ? myRequest.status : null,
        myRequestReason: myRequest ? myRequest.reason : null,
      };
    });

    res.json({ documents: mapped });
  } catch (err) {
    console.error("[documents] Requestable list error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/documents/structure (and /nas/structure) — secure folder tree (access-controlled)
// ---------------------------------------------------------------------------

const getStructureHandler = async (req: Request, res: Response) => {
  try {
    const folders = await buildAccessibleNasTree(req.userId!, req.user!.role);
    res.json({ folders });
  } catch (err) {
    console.error("[documents] Folder structure error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

router.get("/structure", getStructureHandler);
router.get("/nas/structure", getStructureHandler);

// ---------------------------------------------------------------------------
// GET /api/documents/:id/download — stream the file from VPS disk for download
// ---------------------------------------------------------------------------

router.get("/:id/download", requireResourceAccess("document"), async (req: Request, res: Response) => {
  try {
    const document = await DocumentModel.findById(req.params["id"]);
    if (!document) {
      res.status(404).json({ message: "Document not found" });
      return;
    }

    const filePath = document.storagePath || document.nasPath;
    if (!filePath) {
      res.status(400).json({ message: "Document has no file path" });
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

    const stream = await downloadStream(filePath);
    const fileName = document.originalName || document.name || "download";
    const safeName = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");

    res.setHeader("Content-Type", document.mimeType || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, no-store");
    if (document.size > 0) res.setHeader("Content-Length", String(document.size));

    stream.on("error", (err) => {
      console.error("[documents] Download stream error:", err);
      if (!res.headersSent) {
        res.status(502).json({ message: "Failed to stream file from storage" });
      } else {
        res.destroy();
      }
    });

    stream.pipe(res);
  } catch (err) {
    console.error("[documents] Download error:", err);
    if (!res.headersSent) {
      res.status(502).json({ message: "Failed to stream file from storage" });
    } else {
      res.destroy();
    }
  }
});

// ---------------------------------------------------------------------------
// GET /api/documents/:id/view — stream file inline for preview in browser
// ---------------------------------------------------------------------------

router.get("/:id/view", requireResourceAccess("document"), async (req: Request, res: Response) => {
  try {
    const document = await DocumentModel.findById(req.params["id"]);
    if (!document) {
      res.status(404).json({ message: "Document not found" });
      return;
    }

    const filePath = document.storagePath || document.nasPath;
    if (!filePath) {
      res.status(400).json({ message: "Document has no file path" });
      return;
    }

    const stream = await downloadStream(filePath);
    const fileName = document.originalName || document.name || "document";
    const safeName = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");

    const mime = (document.mimeType || "application/octet-stream").toLowerCase();
    const isDangerous = /^(text\/html|application\/xhtml\+xml|image\/svg\+xml|text\/javascript|application\/javascript|text\/xml)$/i.test(mime);
    const isPreviewable = /^(application\/pdf|image\/(jpeg|png|gif|webp)|text\/(plain|csv)|application\/json)$/i.test(mime);

    const disposition = (!isDangerous && isPreviewable) ? "inline" : "attachment";
    const responseMime = isDangerous ? "application/octet-stream" : mime;

    res.setHeader("Content-Type", responseMime);
    res.setHeader(
      "Content-Disposition",
      `${disposition}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, no-cache, no-transform");
    if (document.size > 0) res.setHeader("Content-Length", String(document.size));

    stream.on("error", (err) => {
      console.error("[documents] View stream error:", err);
      if (!res.headersSent) {
        res.status(502).json({ message: "Failed to stream file for preview" });
      } else {
        res.destroy();
      }
    });

    stream.pipe(res);
  } catch (err) {
    console.error("[documents] View error:", err);
    if (!res.headersSent) {
      res.status(502).json({ message: "Failed to stream file for preview" });
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

    let actualHash = "";
    let status: "verified" | "tampered" | "missing" = "missing";

    try {
      const filePath = document.storagePath || document.nasPath;
      const stream = filePath ? await downloadStream(filePath) : null;
      if (stream) {
        const hash = createHash("sha256");
        await new Promise<void>((resolve, reject) => {
          stream.on("data", (chunk: Buffer) => hash.update(chunk));
          stream.on("end", () => resolve());
          stream.on("error", (err: unknown) => reject(err));
        });
        actualHash = hash.digest("hex");
        status = actualHash.toLowerCase() === document.sha256.toLowerCase() ? "verified" : "tampered";
      }
    } catch (streamErr) {
      console.warn(`[documents] Verify stream error for ${document._id}:`, streamErr);
      status = "missing";
    }

    const verifiedAt = new Date();

    try {
      const fileIntegrity = await FileIntegrity.findOne({ documentId: document._id });
      if (fileIntegrity) {
        fileIntegrity.status = status;
        fileIntegrity.lastVerifiedAt = verifiedAt;
        if (req.user?._id) {
          fileIntegrity.verifications.push({
            verifiedAt,
            verifiedBy: req.user._id,
            status,
            computedHash: actualHash,
          });
        }
        await fileIntegrity.save();
      }
    } catch (fiErr) {
      console.warn(`[documents] FileIntegrity update error:`, fiErr);
    }

    res.json({
      documentId: document._id.toString(),
      status,
      actualHash,
      expectedHash: document.sha256,
      verifiedAt,
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
    const docObj: any = document.toObject ? document.toObject() : { ...document };
    delete docObj.storagePath;
    delete docObj.storageFolder;
    delete docObj.nasPath;
    delete docObj.nasFolder;
    delete docObj.filePath;
    delete docObj.tempPath;

    res.json({ document: docObj });
  } catch (err) {
    console.error("[documents] Get error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/documents/upload — streaming multipart upload
// Streams the file straight through to application filesystem storage, hashing
// bytes in transit. The file is never buffered whole in memory. Upload limit: 100MB.
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
  let fileMeta: {
    originalName: string;
    mimeType: string;
    tmpPath: string;
    truncated: boolean;
  } | null = null;

  const respond = (status: number, body: unknown) => {
    if (settled) return;
    settled = true;
    if (status >= 400 && !res.headersSent) {
      res.setHeader("Connection", "close");
    }
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
    const safeTmpName = `upload_${Date.now()}_${randomUUID()}_${path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const tmpPath = path.join(os.tmpdir(), safeTmpName);
    const outStream = createWriteStream(tmpPath);

    fileMeta = {
      originalName,
      mimeType,
      tmpPath,
      truncated: false,
    };

    fileStream.on("limit", () => {
      if (fileMeta) fileMeta.truncated = true;
    });

    fileTask = pipeline(fileStream, outStream);
  });

  bb.on("error", (err) => {
    console.error("[documents] Multipart parse error:", err);
    if (fileMeta?.tmpPath) {
      unlink(fileMeta.tmpPath).catch(() => {});
    }
    respond(400, { message: "Malformed upload request" });
  });

  bb.on("close", async () => {
    try {
      await fileTask;
      if (!fileSeen || !fileMeta) {
        respond(400, { message: "No file uploaded" });
        return;
      }
      if (fileMeta.truncated) {
        await unlink(fileMeta.tmpPath).catch(() => {});
        respond(413, { message: `File exceeds the ${MAX_UPLOAD_BYTES / 1048576}MB limit` });
        return;
      }

      const displayName = fields["name"]?.trim() || fileMeta.originalName;
      const caseId = fields["caseId"]?.trim() || undefined;
      const clientId = fields["clientId"]?.trim() || undefined;
      const taskId = fields["taskId"]?.trim() || undefined;

      await processFile(fileMeta.tmpPath, {
        originalName: fileMeta.originalName,
        displayName,
        mimeType: fileMeta.mimeType,
        caseId,
        clientId,
        taskId,
      });
    } catch (err: any) {
      if (fileMeta?.tmpPath) {
        await unlink(fileMeta.tmpPath).catch(() => {});
      }
      const status = err.status || 500;
      respond(status, { message: err.message || "Upload failed" });
    }
  });

  req.pipe(bb);

  async function processFile(
    tmpPath: string,
    meta: { originalName: string; displayName: string; mimeType: string; caseId?: string; clientId?: string; taskId?: string },
  ): Promise<void> {
    let doc: IDocument | null = null;
    let nasPath = "";
    let nasFolder = "/General";
    try {
      const mimeCheck = validateMimeType(meta.mimeType);
      if (!mimeCheck.valid) {
        throw httpError(415, mimeCheck.error ?? "File type not allowed");
      }

      let caseNumber = "";
      let linkedClientId: Types.ObjectId | null = null;
      let linkedTask: any = null;
      let taskAllowsUpload = false;

      if (meta.taskId) {
        if (!Types.ObjectId.isValid(meta.taskId)) throw httpError(400, "Invalid task ID format");
        linkedTask = await Task.findById(meta.taskId).select("_id caseId clientId").lean();
        if (!linkedTask) throw httpError(404, "Task not found");

        // A task-linked upload must be authorized against the task itself,
        // including standalone tasks that have no caseId/clientId.
        taskAllowsUpload = await canAccessTask(
          req.userId!,
          req.user!.role,
          meta.taskId,
          req.user?.permissions,
        );
        if (!taskAllowsUpload) throw httpError(403, "Cannot upload to a task you don't have access to");

        const canonicalTaskCaseId = linkedTask.caseId?.toString() ?? "";
        if (meta.caseId && meta.caseId !== canonicalTaskCaseId) {
          throw httpError(400, "The selected case does not match this task");
        }
        if (canonicalTaskCaseId) meta.caseId = canonicalTaskCaseId;
        if (linkedTask.clientId) linkedClientId = linkedTask.clientId as any;
      } else if (meta.caseId && !Types.ObjectId.isValid(meta.caseId)) {
        throw httpError(400, "Invalid case ID format");
      }

      if (meta.caseId) {
        const caseDoc = await Case.findById(meta.caseId).select("number _id parties").lean();
        if (!caseDoc) throw httpError(404, "Case not found");
        let allowed = await canAccessCase(req.userId!, req.user!.role, meta.caseId, req.user?.permissions);
        if (!allowed && meta.taskId) {
          const hasTaskAccess = await canAccessTask(req.userId!, req.user!.role, meta.taskId, req.user?.permissions);
          if (hasTaskAccess) {
            allowed = true;
          }
        }
        if (!allowed) throw httpError(403, "Cannot upload to a case you don't have access to");
        caseNumber = caseDoc.number;
        nasFolder = getCaseFolderPath(caseNumber, meta.caseId);

        // Derive the permitted client relationships from this case's actual
        // parties. Do not allow a clientId from an unrelated profile to be
        // attached to a case document.
        const casePartyClientIds = new Set<string>(
          (caseDoc.parties ?? [])
            .filter((p: any) => (p.type === "client" || p.type === "sub_client") && p.clientId)
            .map((p: any) => String(p.clientId?._id ?? p.clientId)),
        );
        const clientParty = caseDoc.parties?.find((p: any) => (p.type === "client" || p.type === "sub_client") && p.clientId);
        if (clientParty && clientParty.clientId && !linkedClientId) {
          linkedClientId = clientParty.clientId as any;
        }
        if (
          meta.clientId &&
          !casePartyClientIds.has(meta.clientId) &&
          !(linkedTask?.clientId && String(linkedTask.clientId) === meta.clientId)
        ) {
          throw httpError(400, "The selected client is not linked to this case or task");
        }
      }

      if (meta.clientId) {
        if (!Types.ObjectId.isValid(meta.clientId)) throw httpError(400, "Invalid client ID format");
        const clientDoc = await Client.findById(meta.clientId).select("_id").lean();
        if (!clientDoc) throw httpError(404, "Client not found");

        // Never let a task upload silently link to an unrelated client.
        // Task-linked uploads must use the canonical client relationship from
        // the task or its case; standalone unlinked tasks must be linked first.
        if (linkedTask) {
          if (!linkedClientId || linkedClientId.toString() !== clientDoc._id.toString()) {
            throw httpError(400, "This task is not linked to the selected client. Link the task to the client first.");
          }
        }

        let canClient = await canAccessClient(req.userId!, req.user!.role, meta.clientId, req.user?.permissions);
        if (!canClient && linkedTask && taskAllowsUpload && linkedClientId?.toString() === clientDoc._id.toString()) {
          // Task assignment authorizes work on this task's canonical client,
          // but does not authorize choosing an unrelated client.
          canClient = true;
        }
        if (!canClient) throw httpError(403, "Cannot upload to a client you don't have access to");
        linkedClientId = clientDoc._id as Types.ObjectId;
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
        clientId: linkedClientId ?? (meta.clientId ? new Types.ObjectId(meta.clientId) : null),
        taskId: meta.taskId ? new Types.ObjectId(meta.taskId) : null,
        uploadedBy: req.userId,
        state: "Pending",
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

      const fileStream = createReadStream(tmpPath);
      const { size, sha256 } = await uploadStream(nasPath, fileStream);

      doc.size = size;
      doc.sizeFormatted = formatBytes(size);
      doc.sha256 = sha256;
      doc.storagePath = nasPath;
      doc.storageFolder = nasFolder;
      doc.nasPath = nasPath;
      doc.nasFolder = nasFolder;
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

      // Notify admins of pending document approval
      const io = req.app.get("io");
      const adminUsers = await User.find({
        $or: [{ role: "admin" }, { "permissions.approvals": true }],
      }).select("_id");

      for (const adminUser of adminUsers) {
        if (adminUser._id.toString() !== req.userId) {
          await NotificationService.createNotification({
            userId: adminUser._id,
            type: "APPROVAL_REQUEST",
            title: "Document Awaiting Approval",
            message: `${req.user?.name ?? "Employee"} uploaded "${meta.displayName}" for review`,
            relatedId: doc._id,
            relatedModel: "Document",
            actorId: new Types.ObjectId(req.userId),
            dedupeKey: `doc-approval:${doc._id.toString()}:${adminUser._id.toString()}`,
            metadata: {
              documentId: doc._id.toString(),
              documentName: meta.displayName,
              taskId: meta.taskId,
              caseId: meta.caseId,
            },
          }, io);
        }
      }

      if (io) {
        io.emit("document:created", {
          documentId: doc._id.toString(),
          caseId: meta.caseId?.toString(),
          taskId: meta.taskId?.toString(),
          clientId: (linkedClientId || meta.clientId)?.toString(),
        });
        if (meta.taskId) {
          io.emit("task:updated", {
            taskId: meta.taskId.toString(),
            caseId: meta.caseId?.toString(),
            clientId: (linkedClientId || meta.clientId)?.toString(),
          });
        }
      }

      const sanitizedDoc: any = doc.toObject ? doc.toObject() : { ...doc };
      delete sanitizedDoc.storagePath;
      delete sanitizedDoc.storageFolder;
      delete sanitizedDoc.nasPath;
      delete sanitizedDoc.nasFolder;
      delete sanitizedDoc.filePath;
      delete sanitizedDoc.tempPath;

      respond(201, { document: sanitizedDoc });
    } catch (err) {
      if (doc) {
        await DocumentModel.findByIdAndDelete(doc._id).catch(() => { });
      }
      if (nasPath) {
        await deletePath(nasPath).catch(() => { });
      }
      const status = (err as { status?: number }).status ?? 502;
      const message = err instanceof Error ? err.message : "Failed to upload file to storage";
      console.error("[documents] Upload stream error:", err);
      respond(status, { message });
    } finally {
      await unlink(tmpPath).catch(() => {});
    }
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/documents/:id — update metadata or approval state (with authorization)
// ---------------------------------------------------------------------------

router.patch("/:id", requireResourceAccess("document"), async (req: Request, res: Response) => {
  try {
    const updates: Record<string, unknown> = {};
    const allowed = ["name", "state"];
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

    // Verify document exists and enforce rename permissions
    const existing = await DocumentModel.findById(req.params["id"]);
    if (!existing) {
      res.status(404).json({ message: "Document not found" });
      return;
    }

    if (updates["name"] && req.user!.role !== "admin" && existing.uploadedBy?.toString() !== req.userId) {
      res.status(403).json({ message: "Only the uploader or an administrator can rename this document" });
      return;
    }

    // Atomically update state if this is an approval/rejection action
    let document;
    if (updates["state"] === "Approved" || updates["state"] === "Rejected") {
      document = await DocumentModel.findOneAndUpdate(
        { _id: req.params["id"], state: "Pending" },
        { $set: updates },
        { new: true, runValidators: true }
      );
      if (!document) {
        // Check if document was already processed in a concurrent request
        if (existing.state !== "Pending") {
          res.json({ document: existing, code: "ALREADY_PROCESSED", message: "This document has already been reviewed." });
          return;
        }
        res.status(404).json({ message: "Document not found" });
        return;
      }
    } else {
      document = await DocumentModel.findByIdAndUpdate(req.params["id"], updates, {
        new: true,
        runValidators: true,
      });
      if (!document) {
        res.status(404).json({ message: "Document not found" });
        return;
      }
    }

    // Notify uploader if document was approved or rejected
    if (
      updates["state"] !== undefined &&
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

    const io = req.app.get("io");
    if (io) {
      io.emit("document:updated", {
        documentId: document._id.toString(),
        taskId: document.taskId ? document.taskId.toString() : undefined,
        caseId: document.caseId ? document.caseId.toString() : undefined,
        clientId: document.clientId ? document.clientId.toString() : undefined,
      });
      if (document.taskId) {
        io.emit("task:updated", {
          taskId: document.taskId.toString(),
          caseId: document.caseId ? document.caseId.toString() : undefined,
          clientId: document.clientId ? document.clientId.toString() : undefined,
        });
      }
    }

    res.json({ document });
  } catch (err) {
    console.error("[documents] Update error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/documents/:docId/request-access (with authorization)
// ---------------------------------------------------------------------------

router.post("/:docId/request-access", async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const document = await DocumentModel.findById(req.params["docId"]);
    if (!document) {
      res.status(404).json({ message: "Document not found" });
      return;
    }

    const existingReq = (document.accessRequests || []).find(
      (ar: any) => ar.userId?.toString() === req.userId && ar.status === "pending"
    );
    if (existingReq) {
      res.json({
        message: "Access request is already pending review",
        document: {
          _id: document._id,
          name: document.name,
          state: document.state,
          accessRequests: [{ status: existingReq.status, reason: existingReq.reason, createdAt: existingReq.createdAt }],
        },
      });
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

    const requesterAccessRequest = document.accessRequests.find(
      (ar: any) => ar.userId?.toString() === req.userId && ar.status === "pending",
    );
    res.json({
      message: "Access requested",
      document: {
        _id: document._id,
        name: document.name,
        state: document.state,
        accessRequests: requesterAccessRequest
          ? [{ status: requesterAccessRequest.status, reason: requesterAccessRequest.reason, createdAt: requesterAccessRequest.createdAt }]
          : [],
      },
    });
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

    const rawReqId = req.params["requestId"];
    const requestId = String(Array.isArray(rawReqId) ? rawReqId[0] : rawReqId || "");

    let request = document.accessRequests.find(
      (ar: any) =>
        ar._id?.toString() === requestId ||
        ar.createdAt?.getTime?.()?.toString() === requestId ||
        (ar.userId?._id || ar.userId)?.toString() === requestId
    );

    let targetUserId = request?.userId;
    if (!request) {
      if (Types.ObjectId.isValid(requestId)) {
        targetUserId = new Types.ObjectId(requestId);
        request = {
          userId: targetUserId,
          reason: (req.body.reason as string) || `Access ${status} by administrator`,
          status,
          createdAt: new Date(),
        } as (typeof document.accessRequests)[number];
        document.accessRequests.push(request);
      } else {
        res.status(404).json({ message: "Access request not found" });
        return;
      }
    } else {
      request.status = status;
      if (req.body.reason) request.reason = req.body.reason;
    }

    await document.save();

    // Notify the requester about the outcome of their access request / revocation
    if (targetUserId && !targetUserId.equals(req.userId)) {
      const reqReason = request?.reason || "";
      const notificationTitle = status === "approved" ? "Access Request Approved" : "Document Access Revoked";
      const notificationMessage = status === "approved"
        ? `Your request to access document "${document.name}" has been approved.`
        : `Your access to document "${document.name}" has been revoked by an administrator.${reqReason ? " Reason: " + reqReason : ""}`;

      await NotificationService.createNotification({
        userId: targetUserId,
        type: "DOCUMENT_SHARED",
        title: notificationTitle,
        message: notificationMessage,
        relatedId: document._id,
        relatedModel: "Document",
        actorId: new Types.ObjectId(req.userId),
        metadata: {
          documentName: document.name,
          documentId: document._id.toString(),
          requesterId: targetUserId,
          status: status,
          reason: reqReason,
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
        request?.reason
      ));
    } catch (logErr) {
      console.error("[documents] Access review audit log error:", logErr);
    }

    const io = req.app.get("io");
    if (io) {
      io.emit("document:updated", {
        documentId: document._id.toString(),
        taskId: document.taskId ? document.taskId.toString() : undefined,
        caseId: document.caseId ? document.caseId.toString() : undefined,
        clientId: document.clientId ? document.clientId.toString() : undefined,
      });
    }

    res.json({ message: `Access request ${status}`, document });
  } catch (err) {
    console.error("[documents] Access request review error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/documents/:docId/revoke-user — revoke a specific user's access (admin)
// ---------------------------------------------------------------------------

router.post("/:docId/revoke-user", requireAuth, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== "admin") {
      res.status(403).json({ message: "Only admins can revoke document access" });
      return;
    }

    const { userId, reason } = req.body;
    if (!userId) {
      res.status(400).json({ message: "userId is required" });
      return;
    }

    const document = await DocumentModel.findById(req.params["docId"]);
    if (!document) {
      res.status(404).json({ message: "Document not found" });
      return;
    }

    const existingIndex = document.accessRequests.findIndex(
      (ar: any) => (ar.userId?._id || ar.userId)?.toString() === userId
    );

    if (existingIndex >= 0) {
      document.accessRequests[existingIndex].status = "rejected";
      if (reason) document.accessRequests[existingIndex].reason = reason;
    } else {
      document.accessRequests.push({
        userId: new Types.ObjectId(userId),
        reason: reason || "Access revoked by administrator",
        status: "rejected",
        createdAt: new Date(),
      } as any);
    }

    await document.save();

    await NotificationService.createNotification(
      {
        userId: new Types.ObjectId(userId),
        type: "DOCUMENT_SHARED",
        title: "Document Access Revoked",
        message: `Your access to document "${document.name}" has been revoked by an administrator.`,
        relatedId: document._id,
        relatedModel: "Document",
        actorId: new Types.ObjectId(req.userId),
        metadata: {
          documentName: document.name,
          documentId: document._id.toString(),
          status: "rejected",
          reason: reason || "",
        },
      },
      req.app.get("io")
    ).catch(() => {});

    try {
      await AuditLog.create(createDocumentAuditLog(
        req.userId!,
        req.user?.name ?? "Unknown",
        "reject",
        document._id.toString(),
        document.name,
        req,
        reason || "Administrator revoked user access"
      ));
    } catch (auditErr) {
      console.error("[documents] Audit error on revocation:", auditErr);
    }

    const io = req.app.get("io");
    if (io) {
      io.emit("document:updated", {
        documentId: document._id.toString(),
        taskId: document.taskId ? document.taskId.toString() : undefined,
        caseId: document.caseId ? document.caseId.toString() : undefined,
        clientId: document.clientId ? document.clientId.toString() : undefined,
      });
    }

    res.json({ message: "User access revoked successfully", document });
  } catch (err) {
    console.error("[documents] Revoke user error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/documents/:id (with authorization)
// ---------------------------------------------------------------------------

router.delete("/:id", requireResourceAccess("document"), async (req: Request, res: Response) => {
  try {
    const document = await DocumentModel.findById(req.params["id"]);
    if (!document) {
      res.status(404).json({ message: "Document not found" });
      return;
    }

    if (req.user!.role !== "admin" && document.uploadedBy?.toString() !== req.userId) {
      res.status(403).json({ message: "Only the uploader or an administrator can delete this document" });
      return;
    }

    const filePath = document.storagePath || document.nasPath;
    if (filePath) {
      try {
        await deletePath(filePath);
      } catch (storageErr: any) {
        console.error("[documents] Could not delete file from disk:", storageErr);
        if (storageErr?.code !== "ENOENT") {
          res.status(500).json({
            message: "Failed to delete physical file from storage. Document record preserved.",
          });
          return;
        }
      }
    }

    await FileIntegrity.deleteMany({ documentId: document._id }).catch(() => {});
    await DocumentModel.findByIdAndDelete(document._id);

    await AuditLog.create(createDocumentAuditLog(
      req.userId!,
      req.user?.name ?? "Unknown",
      "delete",
      document._id.toString(),
      document.name,
      req
    ));

    const io = req.app.get("io");
    if (io) {
      io.emit("document:deleted", {
        documentId: document._id.toString(),
      });
    }

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

    const folder = document.storageFolder || document.nasFolder || "/General";
    const filter: any = { name: document.name };
    if (document.caseId) {
      filter.caseId = document.caseId;
    } else {
      filter.$or = [{ storageFolder: folder }, { nasFolder: folder }];
    }

    const versions = await DocumentModel.find(filter)
      .sort({ version: -1 })
      .populate("uploadedBy", "name")
      .populate("caseId", "title number")
      .lean();

    const sanitizedVersions = versions.map((v: any) => {
      delete v.storagePath;
      delete v.storageFolder;
      delete v.nasPath;
      delete v.nasFolder;
      delete v.filePath;
      delete v.tempPath;
      return v;
    });

    res.json({ versions: sanitizedVersions, count: sanitizedVersions.length });
  } catch (err) {
    console.error("[documents] Get versions error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;