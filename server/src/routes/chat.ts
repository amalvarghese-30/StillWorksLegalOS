import { Router, type Request, type Response, type NextFunction } from "express";
import mongoose from "mongoose";
import fs from "node:fs";
import path from "node:path";
import busboy from "busboy";
import { ChatGroup, ChatMessage } from "../models/Chat.js";
import { AuditLog } from "../models/AuditLog.js";
import { User } from "../models/User.js";
import { NotificationService } from "../services/notifications.js";
import { uploadStream, downloadStream } from "../services/webdav.js";
import { formatBytes } from "../services/nas.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import rateLimit from "express-rate-limit";

const router = Router();
router.use(requireAuth);

// ---------------------------------------------------------------------------
// Limits (Phase 3 — Chat Security)
// ---------------------------------------------------------------------------
const MAX_MESSAGE_LENGTH = 10_000; // P3-10: message length cap
const MAX_GROUP_NAME_LENGTH = 100; // P3-11: group name cap
const MESSAGES_PAGE_SIZE = 50; // P3-14: default cursor page size

// ---------------------------------------------------------------------------
// Rate limiter for sending messages (10 messages per 10 seconds)
// ---------------------------------------------------------------------------
const sendMessageLimiter = rateLimit({
  windowMs: 10 * 1000, // 10 seconds
  max: 10,
  message: { message: "Rate limit exceeded. Slow down." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId ?? req.ip ?? "anonymous",
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HONORIFICS = ["Adv.", "Mr.", "Mrs.", "Ms.", "Dr.", "Shri", "Smt."];

function computeInitials(name: string): string {
  if (!name) return "??";
  const initials = name
    .split(/\s+/)
    .filter((p) => p && !HONORIFICS.includes(p))
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();
  return initials || "??";
}

/** Strip control characters, collapse whitespace, and cap length. */
function sanitizeGroupName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[\x00-\x1F\x7F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_GROUP_NAME_LENGTH);
}
function toIso(d: unknown): string | null {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d as string);
  return isNaN(date.getTime()) ? null : date.toISOString();
}

function toObjectId(id: unknown): mongoose.Types.ObjectId | null {
  try {
    return new mongoose.Types.ObjectId(id as string);
  } catch {
    return null;
  }
}

/** Resolve each member's display-name snapshot from the User collection. The
 *  member `name` field is required by the schema; it also serves as a fallback
 *  in serializeGroup if a user document is ever missing. */
async function fillMemberNames(
  members: { userId: mongoose.Types.ObjectId; name: string; role: "admin" | "member"; joinedAt: Date }[],
): Promise<void> {
  const users = await User.find({ _id: { $in: members.map((m) => m.userId) } })
    .select("name")
    .lean();
  const nameById = new Map(users.map((u: any) => [u._id.toString(), u.name]));
  for (const m of members) {
    if (!m.name) m.name = nameById.get(m.userId.toString()) ?? "Unknown";
  }
}

/** Normalize a message into the shape the UI expects (populated sender, string ids). */
function serializeMessage(msg: any): Record<string, unknown> {
  const m = msg;
  return {
    _id: m._id?.toString(),
    groupId: m.groupId?.toString(),
    text: m.text ?? "",
    sender: {
      _id: m.sender?.toString() ?? "",
      name: m.senderName ?? "",
      initials:
        m.senderInitials && m.senderInitials !== "??"
          ? m.senderInitials
          : computeInitials(m.senderName ?? ""),
    },
    attachments: (m.attachments ?? []).map((a: any) => ({
      name: a.name,
      nasPath: a.nasPath,
      size: a.size,
    })),
    mentions: (m.mentions ?? []).map((id: any) => id?.toString()),
    readBy: (m.readBy ?? []).map((id: any) => id?.toString()),
    reactions: (m.reactions ?? []).map((r: any) => ({
      userId: r.userId?.toString(),
      emoji: r.emoji,
    })),
    replyTo: m.replyTo?.messageId
      ? {
          messageId: m.replyTo.messageId.toString(),
          text: m.replyTo.text ?? "",
          senderName: m.replyTo.senderName ?? "",
        }
      : null,
    createdAt: toIso(m.createdAt),
  };
}

/** Normalize a group (members with presence + per-user pin/mute/archive flags). */
async function serializeGroup(
  group: any,
  currentUserId: string,
): Promise<Record<string, unknown>> {
  const memberUserIds = (group.members ?? []).map((m: any) => m.userId?.toString());
  const users = await User.find({ _id: { $in: memberUserIds } })
    .select("name status lastActiveAt")
    .lean();
  const userById = new Map(users.map((u: any) => [u._id.toString(), u]));

  const members = (group.members ?? []).map((m: any) => {
    const uid = m.userId?.toString();
    const u = userById.get(uid);
    const name = u?.name ?? m.name ?? "Unknown";
    return {
      _id: uid,
      name,
      initials: computeInitials(name),
      role: m.role,
      online: u?.status === "online",
      lastActiveAt: toIso(u?.lastActiveAt),
      joinedAt: toIso(m.joinedAt),
    };
  });

  const contains = (arr: any[]) =>
    (arr ?? []).some((id: any) => id?.toString() === currentUserId);

  // Direct chats store the creator's peer name at creation time. Derive the
  // display name from the OTHER member so it is correct for every viewer.
  const isDirect = group.type === "direct";
  const displayName = isDirect
    ? (members.find((m: any) => m._id !== currentUserId)?.name ?? group.name)
    : group.name;

  return {
    _id: group._id?.toString(),
    name: displayName,
    type: group.type,
    members,
    createdBy: group.createdBy?.toString(),
    lastMessage: group.lastMessage
      ? {
          text: group.lastMessage.text,
          senderId: group.lastMessage.senderId?.toString(),
          senderName: group.lastMessage.senderName,
          at: toIso(group.lastMessage.at),
        }
      : null,
    isPinned: contains(group.pinnedBy),
    isMuted: contains(group.mutedBy),
    isArchived: contains(group.archivedBy),
    pinnedMessage: group.pinnedMessage
      ? {
          messageId: group.pinnedMessage.messageId?.toString(),
          text: group.pinnedMessage.text,
          senderName: group.pinnedMessage.senderName,
          pinnedBy: group.pinnedMessage.pinnedBy?.toString(),
          pinnedByName: group.pinnedMessage.pinnedByName,
          at: toIso(group.pinnedMessage.at),
        }
      : null,
    createdAt: toIso(group.createdAt),
  };
}

/** Non-fatal audit logging (tamper-evident chain). */
async function logChatAudit(
  req: Request,
  action: "create" | "update" | "delete" | "report",
  resourceId?: string,
  resourceName?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await AuditLog.logWithActivity(
      {
        userId: req.user!._id,
        userName: req.user?.name ?? "Unknown",
        action,
        resource: "chat",
        resourceId,
        resourceName,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        metadata,
      },
      req.app.get("io")
    );
  } catch (err) {
    console.error("[chat] audit log error:", err);
  }
}

// ---------------------------------------------------------------------------
// Middleware: verify user is member of chat group (or admin)
// Fetches a MUTABLE document so downstream handlers can .save() it.
// ---------------------------------------------------------------------------

async function requireChatMembership(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const groupId = req.params["groupId"];
    if (!groupId) {
      res.status(400).json({ message: "Group ID required" });
      return;
    }

    const group = await ChatGroup.findById(groupId);
    if (!group) {
      res.status(404).json({ message: "Group not found" });
      return;
    }

    // Admins can access any group
    if (req.user?.role === "admin") {
      (req as any).chatGroup = group;
      next();
      return;
    }

    const isMember = group.members.some(
      (m) => m.userId.toString() === req.userId,
    );
    if (!isMember) {
      res.status(403).json({ message: "Access denied: not a member of this chat" });
      return;
    }

    (req as any).chatGroup = group;
    next();
  } catch (err) {
    console.error("[chat] Membership check error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

// ---------------------------------------------------------------------------
// GET /api/chat/groups — list groups the current user belongs to
// ---------------------------------------------------------------------------

router.get("/groups", async (req: Request, res: Response) => {
  try {
    const groups = await ChatGroup.find({
      "members.userId": req.userId,
    })
      .sort({ updatedAt: -1 })
      .lean();

    // Single aggregation for unread counts across all groups (avoids N+1).
    const userIdOid = new mongoose.Types.ObjectId(req.userId!);
    const unreadAgg = await ChatMessage.aggregate<{
      _id: mongoose.Types.ObjectId;
      unread: number;
    }>([
      {
        $match: {
          groupId: { $in: groups.map((g) => g._id) },
          deletedForEveryone: false,
          deletedFor: { $nin: [userIdOid] },
          readBy: { $nin: [userIdOid] },
        },
      },
      { $group: { _id: "$groupId", unread: { $sum: 1 } } },
    ]);
    const unreadByGroup = new Map(
      unreadAgg.map((r) => [r._id.toString(), r.unread]),
    );

    const serialized = [];
    for (const g of groups) {
      const s = await serializeGroup(g, req.userId!);
      serialized.push({ ...s, unread: unreadByGroup.get(g._id.toString()) ?? 0 });
    }

    res.json({ groups: serialized });
  } catch (err) {
    console.error("[chat] Groups list error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/chat/groups — create group (admin only for group type)
// ---------------------------------------------------------------------------

router.post("/groups", async (req: Request, res: Response) => {
  try {
    const { name, memberIds, type = "group" } = req.body;
    const isDirect = type === "direct";

    // Only admins can create group chats (direct chats are allowed for everyone)
    if (!isDirect && req.user?.role !== "admin") {
      res.status(403).json({ message: "Only admins can create group chats" });
      return;
    }

    const members: {
      userId: mongoose.Types.ObjectId;
      name: string;
      role: "admin" | "member";
      joinedAt: Date;
    }[] = [];

    for (const raw of (memberIds ?? []) as string[]) {
      const oid = toObjectId(raw);
      if (oid && !members.some((m) => m.userId.toString() === oid.toString())) {
        members.push({ userId: oid, name: "", role: "member", joinedAt: new Date() });
      }
    }

    // Always include the creator as admin
    const creatorOid = req.user!._id;
    if (!members.some((m) => m.userId.toString() === creatorOid.toString())) {
      members.push({
        userId: creatorOid,
        name: req.user?.name ?? "",
        role: "admin",
        joinedAt: new Date(),
      });
    }

    // Deduplicate direct chats: reuse an existing 1:1 conversation between the
    // same two users instead of creating a duplicate.
    if (isDirect) {
      const otherId = members.find(
        (m) => m.userId.toString() !== req.userId?.toString(),
      )?.userId;
      if (otherId) {
        const existing = await ChatGroup.findOne({
          type: "direct",
          members: { $size: 2 },
          "members.userId": { $all: [creatorOid, otherId] },
        });
        if (existing) {
          res.json({ group: await serializeGroup(existing, req.userId!) });
          return;
        }
      }
    }

    // Direct chats have no explicit name — derive it from the other participant.
    let groupName = sanitizeGroupName(name);
    if (isDirect && !groupName) {
      const other = members.find((m) => m.userId.toString() !== req.userId?.toString());
      const otherUser = other
        ? await User.findById(other.userId).select("name").lean()
        : null;
      groupName = otherUser?.name ?? "Direct Chat";
    }

    if (!groupName) {
      res.status(400).json({ message: "Group name is required" });
      return;
    }

    await fillMemberNames(members);

    const group = await ChatGroup.create({
      name: groupName,
      type,
      members,
      createdBy: req.user!._id,
    });

    await logChatAudit(req, "create", group._id.toString(), group.name);

    res.status(201).json({ group: await serializeGroup(group, req.userId!) });
  } catch (err) {
    console.error("[chat] Create group error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/chat/groups/:groupId — rename group (admin/creator/group-admin)
// ---------------------------------------------------------------------------

router.patch(
  "/groups/:groupId",
  requireChatMembership,
  async (req: Request, res: Response) => {
    try {
      const group = (req as any).chatGroup;
      const name = sanitizeGroupName(req.body?.name);
      if (!name) {
        res.status(400).json({ message: "Group name is required" });
        return;
      }

      const isSysAdmin = req.user?.role === "admin";
      const isCreator = group.createdBy.toString() === req.userId;
      const isGroupAdmin = group.members.some(
        (m: any) => m.userId.toString() === req.userId && m.role === "admin",
      );
      if (!isSysAdmin && !isCreator && !isGroupAdmin) {
        res.status(403).json({ message: "Only group admins can rename this group" });
        return;
      }

      group.name = name;
      await group.save();

      const io = req.app.get("io");
      if (io) {
        io.to(`chat:${req.params["groupId"]}`).emit("chat:group-updated", {
          groupId: group._id.toString(),
          action: "renamed",
          name: group.name,
        });
      }

      await logChatAudit(req, "update", group._id.toString(), group.name, { action: "rename" });

      res.json({ group: await serializeGroup(group, req.userId!) });
    } catch (err) {
      console.error("[chat] Rename group error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /api/chat/groups/:groupId — admin only
// ---------------------------------------------------------------------------

router.delete("/groups/:groupId", requireAdmin, async (req: Request, res: Response) => {
  try {
    const group = await ChatGroup.findByIdAndDelete(req.params["groupId"]);
    if (!group) {
      res.status(404).json({ message: "Group not found" });
      return;
    }

    await ChatMessage.deleteMany({ groupId: group._id });
    await logChatAudit(req, "delete", group._id.toString(), group.name);

    res.json({ message: "Group deleted" });
  } catch (err) {
    console.error("[chat] Delete group error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/chat/groups/:groupId/messages — paginated messages (member only)
// ---------------------------------------------------------------------------

router.get(
  "/groups/:groupId/messages",
  requireChatMembership,
  async (req: Request, res: Response) => {
    try {
      const groupId = req.params["groupId"];
      const limit = Math.min(
        Math.max(parseInt(req.query["limit"] as string, 10) || MESSAGES_PAGE_SIZE, 1),
        100,
      );
      const before = req.query["before"]
        ? toObjectId(req.query["before"] as string)
        : null;

      const filter: Record<string, unknown> = {
        groupId,
        deletedForEveryone: false,
        deletedFor: { $nin: [req.userId] },
      };
      if (before) filter._id = { $lt: before };

      // Fetch one extra to detect whether more older messages remain.
      const docs = await ChatMessage.find(filter)
        .sort({ _id: -1 })
        .limit(limit + 1)
        .lean();

      const hasMore = docs.length > limit;
      const page = hasMore ? docs.slice(0, limit) : docs;
      const messages = page.reverse().map((m) => serializeMessage(m));
      const oldest = messages[0];
      const nextCursor = hasMore && oldest ? (oldest._id as string) : null;

      // Return oldest-first for the UI, plus a cursor for older history.
      res.json({ messages, nextCursor });
    } catch (err) {
      console.error("[chat] Messages list error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/chat/groups/:groupId/messages — send message (member only + rate limit)
// ---------------------------------------------------------------------------

router.post(
  "/groups/:groupId/messages",
  requireChatMembership,
  sendMessageLimiter,
  async (req: Request, res: Response) => {
    try {
      const { text, mentions, replyTo, attachments } = req.body;
      const cleanText = typeof text === "string" ? text.trim() : "";
      const validAttachments = (Array.isArray(attachments) ? attachments : [])
        .filter((a: any) => a && typeof a.name === "string" && typeof a.nasPath === "string")
        .map((a: any) => ({
          name: String(a.name).slice(0, 200),
          nasPath: String(a.nasPath),
          size: String(a.size || ""),
        }));

      if (!cleanText && validAttachments.length === 0) {
        res.status(400).json({ message: "Message text or attachment is required" });
        return;
      }
      if (cleanText.length > MAX_MESSAGE_LENGTH) {
        res.status(400).json({
          message: `Message too long (max ${MAX_MESSAGE_LENGTH} characters)`,
        });
        return;
      }

      const group = (req as any).chatGroup;
      const groupId = group._id;

      const senderName = req.user?.name ?? "Unknown";
      const senderInitials = computeInitials(senderName);

      // Validate mentions against actual group membership (IDOR guard).
      const memberIds = new Set(
        (group.members ?? []).map((m: any) => m.userId.toString()),
      );
      const validMentions = (Array.isArray(mentions) ? (mentions as unknown[]) : [])
        .map((id) => toObjectId(id))
        .filter(
          (oid): oid is mongoose.Types.ObjectId =>
            !!oid && memberIds.has(oid.toString()),
        );

      const replyPayload = replyTo?.messageId
        ? {
            messageId: toObjectId(replyTo.messageId),
            text: (replyTo.text ?? "").slice(0, 200),
            senderName: replyTo.senderName ?? "",
          }
        : undefined;

      const now = new Date();
      const message = await ChatMessage.create({
        groupId,
        text: cleanText,
        sender: req.user!._id,
        senderName,
        senderInitials,
        attachments: validAttachments,
        mentions: validMentions,
        replyTo: replyPayload,
        readBy: [req.user!._id],
        sentAt: now,
      });

      // Update group's last message
      const lastMessageText = cleanText
        ? cleanText.slice(0, 100)
        : validAttachments.length > 0
          ? `📎 ${validAttachments[0].name}`
          : "";

      await ChatGroup.findByIdAndUpdate(groupId, {
        lastMessage: {
          text: lastMessageText,
          senderId: req.user!._id,
          senderName,
          at: now,
        },
      });

      const serialized = serializeMessage(message);

      const io = req.app.get("io");
      if (io) {
        // Emit message:sent event to the sender (for optimistic UI if needed)
        io.to(`user:${req.userId}`).emit("message:sent", {
          messageId: message._id.toString(),
          groupId: groupId,
          sentAt: now,
        });

        // Broadcast the message to the group
        io.to(`chat:${groupId}`).emit("chat:message", serialized);

        // Mark message as delivered (when successfully broadcast to group)
        await ChatMessage.findByIdAndUpdate(message._id, { deliveredAt: now });

        // Emit message:delivered event
        io.to(`chat:${groupId}`).emit("message:delivered", {
          messageId: message._id.toString(),
          groupId: groupId,
          deliveredAt: now,
        });

        // Mention notifications: create notification for each mentioned colleague
        if (validMentions.length > 0) {
          for (const mentionOid of validMentions) {
            if (mentionOid.toString() === req.userId) continue;
            try {
              const preview = cleanText || validAttachments[0]?.name || "a file";
              await NotificationService.createNotification(
                {
                  userId: mentionOid,
                  type: "COMMENT_MENTION",
                  title: "Mentioned in Chat",
                  message: `${senderName} mentioned you in ${group.type === "direct" ? "direct chat" : group.name}: "${preview.slice(0, 80)}"`,
                  relatedId: groupId,
                  relatedModel: "ChatGroup",
                  actorId: req.user!._id,
                  metadata: { groupId: groupId.toString(), messageId: message._id.toString() },
                },
                io,
              );
            } catch (notifErr) {
              console.error("[chat] Mention notification error:", notifErr);
            }
          }
        }
      }

      res.status(201).json(serialized);
    } catch (err) {
      console.error("[chat] Send message error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/chat/groups/:groupId/upload — upload file attachment for chat
// ---------------------------------------------------------------------------

const MAX_CHAT_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB

router.post(
  "/groups/:groupId/upload",
  requireChatMembership,
  async (req: Request, res: Response) => {
    try {
      const contentType = req.headers["content-type"] ?? "";
      if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
        res.status(400).json({ message: "Expected multipart/form-data" });
        return;
      }

      const groupId = String(req.params["groupId"] ?? "");
      const bb = busboy({
        headers: req.headers,
        limits: { fileSize: MAX_CHAT_UPLOAD_BYTES },
      });

      let fileSeen = false;
      let settled = false;
      let uploadTask: Promise<void> = Promise.resolve();

      const respond = (status: number, body: unknown) => {
        if (settled) return;
        settled = true;
        res.status(status).json(body);
      };

      bb.on("file", (_fieldname, fileStream, info) => {
        if (fileSeen) {
          fileStream.resume();
          return;
        }
        fileSeen = true;

        const originalName = info.filename || "file";
        const mimeType = info.mimeType || "application/octet-stream";

        uploadTask = (async () => {
          try {
            const safeBase = originalName
              .replace(/\.[^.]+$/, "")
              .replace(/[^a-zA-Z0-9_-]/g, "_")
              .slice(0, 80);
            const ext = originalName.includes(".")
              ? originalName.substring(originalName.lastIndexOf("."))
              : "";
            const uniqueName = `${Date.now()}-${safeBase}${ext}`;

            // Local fallback persistence ensures attachments always work regardless of WebDAV status
            const uploadsDir = path.resolve(process.cwd(), "uploads", "chat", groupId);
            await fs.promises.mkdir(uploadsDir, { recursive: true });
            const localFilePath = path.join(uploadsDir, uniqueName);

            const localWriteStream = fs.createWriteStream(localFilePath);
            let bytesWritten = 0;

            await new Promise<void>((resolve, reject) => {
              fileStream.on("data", (chunk: Buffer) => {
                bytesWritten += chunk.length;
              });
              fileStream.pipe(localWriteStream);
              localWriteStream.on("finish", () => resolve());
              localWriteStream.on("error", reject);
              fileStream.on("error", reject);
            });

            const localNasPath = `local:chat/${groupId}/${uniqueName}`;
            let finalNasPath = localNasPath;

            // Attempt WebDAV replication to Synology NAS if configured
            try {
              const webdavPath = `/Chat/${groupId}/${uniqueName}`;
              const fileReadStream = fs.createReadStream(localFilePath);
              await uploadStream(webdavPath, fileReadStream);
              finalNasPath = webdavPath;
            } catch {
              // WebDAV not active or failed; local storage remains authoritative
            }

            respond(200, {
              attachment: {
                name: originalName,
                nasPath: finalNasPath,
                size: formatBytes(bytesWritten),
                mimeType,
              },
            });
          } catch (err) {
            console.error("[chat] Attachment upload processing error:", err);
            respond(500, { message: "Failed to process chat attachment" });
          }
        })();
      });

      bb.on("error", (err) => {
        console.error("[chat] Multipart parse error:", err);
        respond(400, { message: "Malformed upload request" });
      });

      bb.on("close", async () => {
        await uploadTask;
        if (!settled) {
          respond(fileSeen ? 500 : 400, { message: fileSeen ? "Upload failed" : "No file uploaded" });
        }
      });

      req.pipe(bb);
    } catch (err) {
      console.error("[chat] Upload endpoint error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/chat/groups/:groupId/attachments/download — download chat attachment
// ---------------------------------------------------------------------------

router.get(
  "/groups/:groupId/attachments/download",
  requireChatMembership,
  async (req: Request, res: Response) => {
    try {
      const nasPath = (req.query["path"] as string) || "";
      const fileName = (req.query["name"] as string) || "attachment";

      if (!nasPath) {
        res.status(400).json({ message: "Attachment path is required" });
        return;
      }

      if (nasPath.startsWith("local:")) {
        const localRel = nasPath.replace(/^local:/, "");
        const safeBase = path.resolve(process.cwd(), "uploads");
        const fullPath = path.resolve(safeBase, localRel);

        if (!fullPath.startsWith(safeBase)) {
          res.status(403).json({ message: "Access denied: invalid file path" });
          return;
        }

        if (!fs.existsSync(fullPath)) {
          res.status(404).json({ message: "Attachment file not found on server" });
          return;
        }

        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${encodeURIComponent(fileName)}"`,
        );
        fs.createReadStream(fullPath).pipe(res);
        return;
      }

      // Stream from WebDAV NAS
      try {
        const stream = await downloadStream(nasPath);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${encodeURIComponent(fileName)}"`,
        );
        stream.pipe(res);
      } catch (davErr) {
        console.error("[chat] WebDAV download error:", davErr);
        res.status(502).json({ message: "Failed to retrieve attachment from NAS storage" });
      }
    } catch (err) {
      console.error("[chat] Attachment download error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/chat/groups/:groupId/read — mark all messages as read (member only)
// ---------------------------------------------------------------------------

router.post(
  "/groups/:groupId/read",
  requireChatMembership,
  async (req: Request, res: Response) => {
    try {
      const groupId = req.params["groupId"];

      // Mark messages as read for the user
      const updateResult = await ChatMessage.updateMany(
        { groupId, readBy: { $nin: [req.userId] } },
        { $addToSet: { readBy: req.userId } },
      );

      const readAt = new Date();

// Get the IDs of messages that were just read
      const messages = await ChatMessage.find(
        { groupId, readBy: { $nin: [req.userId] } },
        { _id: 1 }
      ).limit(100); // Limit to prevent too many events

      // Update the readAt timestamp for these messages (last read time)
      if (messages.length > 0) {
        await ChatMessage.updateMany(
          { _id: { $in: messages.map(m => m._id) } },
          { $set: { readAt: readAt } }
        );
      }

      const io = req.app.get("io");
      if (io && messages.length > 0) {
        // Emit message:read events for each message that was just read
        messages.forEach((msg) => {
          io.to(`chat:${groupId}`).emit("message:read", {
            messageId: msg._id.toString(),
            groupId,
            userId: req.userId,
            readAt: readAt,
          });
        });

        // Also emit activity for live feed
        io.to("admin:live-feed").emit("activity:event", {
          userId: req.userId,
          action: "read_messages",
          resource: "chat",
          resourceId: groupId,
          timestamp: new Date().toISOString(),
        });
      }

      res.json({ message: "Marked as read" });
    } catch (err) {
      console.error("[chat] Read error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/chat/groups/:groupId/messages/:id/delivered — mark message as delivered
// ---------------------------------------------------------------------------

router.post(
  "/groups/:groupId/messages/:messageId/delivered",
  requireChatMembership,
  async (req: Request, res: Response) => {
    try {
      const { groupId, messageId } = req.params;

      // Verify the message exists and user is member of the group
      const group = await ChatGroup.findById(groupId);
      if (!group) {
        res.status(404).json({ message: "Group not found" });
        return;
      }

      const isMember = group.members.some(
        (m) => m.userId.toString() === req.userId
      );
      const isAdmin = req.user?.role === "admin";

      if (!isMember && !isAdmin) {
        res.status(403).json({ message: "Access denied" });
        return;
      }

      const message = await ChatMessage.findById(messageId);
      if (!message) {
        res.status(404).json({ message: "Message not found" });
        return;
      }

      // Verify message belongs to this group
      if (message.groupId.toString() !== groupId) {
        res.status(400).json({ message: "Message does not belong to this group" });
        return;
      }

      // Update delivered timestamp if not already set
      const updateResult = await ChatMessage.updateOne(
        { _id: messageId, deliveredAt: { $exists: false } },
        { $set: { deliveredAt: new Date() } }
      );

      const io = req.app.get("io");
      if (io && updateResult.modifiedCount > 0) {
        // Emit message:delivered event
        io.to(`chat:${groupId}`).emit("message:delivered", {
          messageId,
          groupId,
          userId: req.userId,
          deliveredAt: new Date(),
        });

        // Also emit activity for live feed
        io.to("admin:live-feed").emit("activity:event", {
          userId: req.userId,
          action: "delivered_message",
          resource: "chat",
          resourceId: messageId,
          timestamp: new Date().toISOString(),
        });
      }

      res.json({ message: "Marked as delivered" });
    } catch (err) {
      console.error("[chat] Delivered error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/chat/groups/:groupId/read — mark all messages as read (member only)
// ---------------------------------------------------------------------------

router.post(
  "/groups/:groupId/read",
  requireChatMembership,
  async (req: Request, res: Response) => {
    try {
      const groupId = req.params["groupId"];

      await ChatMessage.updateMany(
        { groupId, readBy: { $nin: [req.userId] } },
        { $addToSet: { readBy: req.userId } },
      );

      res.json({ message: "Marked as read" });
    } catch (err) {
      console.error("[chat] Read error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /api/chat/groups/:groupId/messages/:messageId — delete for everyone
// ---------------------------------------------------------------------------

router.delete(
  "/groups/:groupId/messages/:messageId",
  requireChatMembership,
  async (req: Request, res: Response) => {
    try {
      const message = await ChatMessage.findById(req.params["messageId"]);
      if (!message) {
        res.status(404).json({ message: "Message not found" });
        return;
      }

      const group = (req as any).chatGroup;
      const isSender = message.sender.toString() === req.userId;
      const isSysAdmin = req.user?.role === "admin";
      const isGroupAdmin = group.members.some(
        (m: any) => m.userId.toString() === req.userId && m.role === "admin",
      );
      if (!isSender && !isSysAdmin && !isGroupAdmin) {
        res.status(403).json({ message: "You can only delete your own messages" });
        return;
      }

      message.deletedForEveryone = true;
      await message.save();

      const io = req.app.get("io");
      if (io) {
        io.to(`chat:${req.params["groupId"]}`).emit("chat:message-deleted", {
          groupId: req.params["groupId"],
          messageId: message._id.toString(),
        });
      }

      res.json({ messageId: message._id.toString() });
    } catch (err) {
      console.error("[chat] Delete for everyone error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/chat/groups/:groupId/messages/:messageId/delete-for-me
// ---------------------------------------------------------------------------

router.post(
  "/groups/:groupId/messages/:messageId/delete-for-me",
  requireChatMembership,
  async (req: Request, res: Response) => {
    try {
      const message = await ChatMessage.findById(req.params["messageId"]);
      if (!message) {
        res.status(404).json({ message: "Message not found" });
        return;
      }

      if (!message.deletedFor.some((id: any) => id.toString() === req.userId)) {
        message.deletedFor.push(req.user!._id);
        await message.save();
      }

      res.json({ messageId: message._id.toString() });
    } catch (err) {
      console.error("[chat] Delete for me error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/chat/users — list all active users for contact discovery
// ---------------------------------------------------------------------------

router.get("/users", async (req: Request, res: Response) => {
  try {
    const users = await User.find({})
      .select("_id name email role status lastActiveAt")
      .sort({ name: 1 })
      .lean();

    res.json({ users });
  } catch (err) {
    console.error("[chat] Users list error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/chat/groups/:groupId/members — list group members (for group info)
// ---------------------------------------------------------------------------

router.get(
  "/groups/:groupId/members",
  requireChatMembership,
  async (req: Request, res: Response) => {
    try {
      const group = (req as any).chatGroup;
      const serialized = await serializeGroup(group, req.userId!);
      res.json({ members: serialized.members });
    } catch (err) {
      console.error("[chat] Members list error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/chat/groups/:groupId/members — add members to group
// ---------------------------------------------------------------------------

router.post(
  "/groups/:groupId/members",
  requireChatMembership,
  async (req: Request, res: Response) => {
    try {
      const group = (req as any).chatGroup;
      const groupId = group._id;
      const { memberIds } = req.body;

      if (!memberIds?.length) {
        res.status(400).json({ message: "Member IDs required" });
        return;
      }

      const isGroupAdmin = group.members.some(
        (m: any) => m.userId.toString() === req.userId && m.role === "admin",
      );
      const isCreator = group.createdBy.toString() === req.userId;

      if (!isGroupAdmin && !isCreator) {
        res.status(403).json({ message: "Only group admins can add members" });
        return;
      }

      const validIds: mongoose.Types.ObjectId[] = [];
      for (const raw of (memberIds ?? []) as string[]) {
        const oid = toObjectId(raw);
        if (oid) validIds.push(oid);
      }

      const existingMemberIds = new Set(group.members.map((m: any) => m.userId.toString()));
      const toAdd = validIds
        .filter((oid) => !existingMemberIds.has(oid.toString()))
        .map((oid) => ({
          userId: oid,
          name: "",
          role: "member" as const,
          joinedAt: new Date(),
        }));

      if (!toAdd.length) {
        res.status(400).json({ message: "All users are already members" });
        return;
      }

      await fillMemberNames(toAdd);
      group.members.push(...toAdd);
      await group.save();

      const io = req.app.get("io");
      if (io) {
        io.to(`chat:${groupId}`).emit("chat:group-updated", {
          groupId: groupId.toString(),
          action: "members_added",
          members: toAdd.map((m) => ({ userId: m.userId.toString() })),
        });
      }

      await logChatAudit(req, "update", groupId.toString(), group.name, {
        action: "add_members",
        memberIds: toAdd.map((m) => m.userId.toString()),
      });

      res.json({ group: await serializeGroup(group, req.userId!) });
    } catch (err) {
      console.error("[chat] Add members error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /api/chat/groups/:groupId/members/:userId — remove member from group
// ---------------------------------------------------------------------------

router.delete(
  "/groups/:groupId/members/:userId",
  requireChatMembership,
  async (req: Request, res: Response) => {
    try {
      const group = (req as any).chatGroup;
      const groupId = group._id;
      const { userId } = req.params;

      const requesterMember = group.members.find((m: any) => m.userId.toString() === req.userId);
      const targetMember = group.members.find((m: any) => m.userId.toString() === userId);

      if (!targetMember) {
        res.status(404).json({ message: "Member not found in group" });
        return;
      }

      const isAdmin = requesterMember?.role === "admin";
      const isSelf = req.userId === userId;

      if (!isAdmin && !isSelf) {
        res.status(403).json({ message: "Only group admins can remove other members" });
        return;
      }

      const adminCount = group.members.filter((m: any) => m.role === "admin").length;
      if (adminCount === 1 && targetMember.role === "admin" && !isSelf) {
        res.status(400).json({ message: "Cannot remove the last admin. Promote another member first." });
        return;
      }

      group.members = group.members.filter((m: any) => m.userId.toString() !== userId);
      await group.save();

      const io = req.app.get("io");
      if (io) {
        io.to(`chat:${groupId}`).emit("chat:group-updated", {
          groupId: groupId.toString(),
          action: isSelf ? "member_left" : "member_removed",
          userId,
        });
      }

      await logChatAudit(req, "update", groupId.toString(), group.name, {
        action: isSelf ? "leave_group" : "remove_member",
        targetUserId: userId,
      });

      res.json({ group: await serializeGroup(group, req.userId!) });
    } catch (err) {
      console.error("[chat] Remove member error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /api/chat/groups/:groupId/members/:userId/role — change member role
// ---------------------------------------------------------------------------

router.patch(
  "/groups/:groupId/members/:userId/role",
  requireChatMembership,
  async (req: Request, res: Response) => {
    try {
      const group = (req as any).chatGroup;
      const groupId = group._id;
      const { userId } = req.params;
      const { role } = req.body;

      if (!["admin", "member"].includes(role)) {
        res.status(400).json({ message: "Invalid role" });
        return;
      }

      const requesterMember = group.members.find((m: any) => m.userId.toString() === req.userId);
      const targetMember = group.members.find((m: any) => m.userId.toString() === userId);

      if (!targetMember) {
        res.status(404).json({ message: "Member not found in group" });
        return;
      }

      if (requesterMember?.role !== "admin") {
        res.status(403).json({ message: "Only group admins can change roles" });
        return;
      }

      const adminCount = group.members.filter((m: any) => m.role === "admin").length;
      if (adminCount === 1 && targetMember.role === "admin" && role === "member") {
        res.status(400).json({ message: "Cannot demote the last admin" });
        return;
      }

      targetMember.role = role;
      await group.save();

      const io = req.app.get("io");
      if (io) {
        io.to(`chat:${groupId}`).emit("chat:group-updated", {
          groupId: groupId.toString(),
          action: "role_changed",
          userId,
          role,
        });
      }

      await logChatAudit(req, "update", groupId.toString(), group.name, {
        action: "change_role",
        targetUserId: userId,
        newRole: role,
      });

      res.json({ group: await serializeGroup(group, req.userId!) });
    } catch (err) {
      console.error("[chat] Change role error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/chat/groups/:groupId/leave — leave group
// ---------------------------------------------------------------------------

router.post(
  "/groups/:groupId/leave",
  requireChatMembership,
  async (req: Request, res: Response) => {
    try {
      const group = (req as any).chatGroup;
      const groupId = group._id;
      const userId = req.userId!;

      const member = group.members.find((m: any) => m.userId.toString() === userId);
      if (!member) {
        res.status(404).json({ message: "Not a member of this group" });
        return;
      }

      const adminCount = group.members.filter((m: any) => m.role === "admin").length;
      if (adminCount === 1 && member.role === "admin") {
        const otherMembers = group.members.filter((m: any) => m.userId.toString() !== userId);
        if (otherMembers.length > 0) {
          otherMembers[0].role = "admin";
        }
      }

      group.members = group.members.filter((m: any) => m.userId.toString() !== userId);

      if (group.members.length === 0) {
        await ChatGroup.findByIdAndDelete(groupId);
        await ChatMessage.deleteMany({ groupId });
        res.json({ group: null, message: "Group deleted (no members remaining)" });
        return;
      }

      await group.save();

      const io = req.app.get("io");
      if (io) {
        io.to(`chat:${groupId}`).emit("chat:group-updated", {
          groupId: groupId.toString(),
          action: "member_left",
          userId,
        });
      }

      await logChatAudit(req, "update", groupId.toString(), group.name, {
        action: "leave_group",
      });

      res.json({ group: await serializeGroup(group, req.userId!) });
    } catch (err) {
      console.error("[chat] Leave group error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/chat/groups/:groupId/reactions — add/remove emoji reaction
// ---------------------------------------------------------------------------

router.post(
  "/groups/:groupId/reactions",
  requireChatMembership,
  async (req: Request, res: Response) => {
    try {
      const { messageId, emoji } = req.body;
      if (!messageId || !emoji) {
        res.status(400).json({ message: "messageId and emoji required" });
        return;
      }

      const message = await ChatMessage.findById(messageId);
      if (!message) {
        res.status(404).json({ message: "Message not found" });
        return;
      }

      const existingIdx = message.reactions.findIndex(
        (r) => r.userId.toString() === req.userId && r.emoji === emoji,
      );

      if (existingIdx >= 0) {
        message.reactions.splice(existingIdx, 1);
      } else {
        message.reactions.push({ userId: req.user!._id, emoji });
      }

      await message.save();

      const io = req.app.get("io");
      if (io) {
        io.to(`chat:${req.params["groupId"]}`).emit("chat:reaction", {
          messageId,
          emoji,
          userId: req.userId,
          action: existingIdx >= 0 ? "remove" : "add",
        });
      }

      res.json({ reactions: message.reactions });
    } catch (err) {
      console.error("[chat] Reaction error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/chat/groups/:groupId/messages/:messageId/report — report a message
// ---------------------------------------------------------------------------

router.post(
  "/groups/:groupId/messages/:messageId/report",
  requireChatMembership,
  async (req: Request, res: Response) => {
    try {
      const group = (req as any).chatGroup;
      const message = await ChatMessage.findById(req.params["messageId"]);
      if (!message || message.groupId.toString() !== group._id.toString()) {
        res.status(404).json({ message: "Message not found" });
        return;
      }

      const { reason } = req.body as { reason?: string };

      await logChatAudit(
        req,
        "report",
        message._id.toString(),
        (message.text ?? "").slice(0, 80),
        {
          groupId: group._id.toString(),
          messageId: message._id.toString(),
          reportedBy: req.user?.name ?? "Unknown",
          reason: (reason ?? "").slice(0, 500),
        },
      );

      res.json({ message: "Report submitted to administrators" });
    } catch (err) {
      console.error("[chat] Report message error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  },
);

// ---------------------------------------------------------------------------
// Pin / mute / archive (per-user list management)
// ---------------------------------------------------------------------------

type PrefField = "pinnedBy" | "mutedBy" | "archivedBy";

function makePrefHandler(field: PrefField, on: boolean) {
  return async (req: Request, res: Response) => {
    try {
      const group = (req as any).chatGroup;
      const idx = group[field].findIndex((id: any) => id.toString() === req.userId);

      if (on && idx === -1) group[field].push(req.user!._id);
      if (!on && idx !== -1) group[field].splice(idx, 1);

      await group.save();
      res.json({ group: await serializeGroup(group, req.userId!) });
    } catch (err) {
      console.error(`[chat] ${field} toggle error:`, err);
      res.status(500).json({ message: "Internal server error" });
    }
  };
}

router.post("/groups/:groupId/pin", requireChatMembership, makePrefHandler("pinnedBy", true));
router.post("/groups/:groupId/unpin", requireChatMembership, makePrefHandler("pinnedBy", false));
router.post("/groups/:groupId/mute", requireChatMembership, makePrefHandler("mutedBy", true));
router.post("/groups/:groupId/unmute", requireChatMembership, makePrefHandler("mutedBy", false));
router.post("/groups/:groupId/archive", requireChatMembership, makePrefHandler("archivedBy", true));
router.post("/groups/:groupId/unarchive", requireChatMembership, makePrefHandler("archivedBy", false));

// ---------------------------------------------------------------------------
// Pin / Unpin a critical notice message to the top of the chat group header
// ---------------------------------------------------------------------------

router.post(
  "/groups/:groupId/pin-message",
  requireChatMembership,
  async (req: Request, res: Response) => {
    try {
      const { messageId } = req.body ?? {};
      if (!messageId) {
        res.status(400).json({ message: "messageId is required" });
        return;
      }

      const message = await ChatMessage.findById(messageId);
      const group = (req as any).chatGroup;

      if (!message || message.groupId.toString() !== group._id.toString()) {
        res.status(404).json({ message: "Message not found in this group" });
        return;
      }

      const textSnippet = message.text?.trim()
        ? message.text.slice(0, 200)
        : message.attachments?.[0]?.name
          ? `📎 ${message.attachments[0].name}`
          : "Pinned notice";

      group.pinnedMessage = {
        messageId: message._id,
        text: textSnippet,
        senderName: message.senderName || "Member",
        pinnedBy: req.user!._id,
        pinnedByName: req.user?.name || "Member",
        at: new Date(),
      };

      await group.save();
      const serialized = await serializeGroup(group, req.userId!);

      const io = req.app.get("io");
      if (io) {
        io.to(`chat:${group._id}`).emit("chat:message-pinned", {
          groupId: group._id.toString(),
          pinnedMessage: (serialized as any).pinnedMessage,
        });
      }

      res.json({ group: serialized });
    } catch (err) {
      console.error("[chat] Pin message error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  },
);

router.post(
  "/groups/:groupId/unpin-message",
  requireChatMembership,
  async (req: Request, res: Response) => {
    try {
      const group = (req as any).chatGroup;
      group.pinnedMessage = undefined;
      await group.save();

      const serialized = await serializeGroup(group, req.userId!);

      const io = req.app.get("io");
      if (io) {
        io.to(`chat:${group._id}`).emit("chat:message-unpinned", {
          groupId: group._id.toString(),
        });
      }

      res.json({ group: serialized });
    } catch (err) {
      console.error("[chat] Unpin message error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  },
);

export default router;
