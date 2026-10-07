import { Request, Response, NextFunction } from "express";
import { Case } from "../models/Case.js";
import { Client } from "../models/Client.js";
import { Task } from "../models/Task.js";
import { CalendarEvent } from "../models/CalendarEvent.js";
import { DocumentModel } from "../models/Document.js";
import { ChatGroup } from "../models/Chat.js";
import { type IUser, type UserPermissions } from "../models/User.js";

// Extend Express Request with user info
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      userId?: string;
    }
  }
}

/**
 * Check if user is admin
 */
export function isAdmin(user: IUser | undefined): boolean {
  return user?.role === "admin";
}

/**
 * Authorization check for cases
 * Admins: full access
 * Employees: can access only if they created or are assigned to the case.
 * NOTE: Module permission (`userPermissions.cases`) allows using the module,
 * but does NOT grant access to every individual case resource (Phase 2 & 3).
 */
export async function canAccessCase(
  userId: string,
  userRole: string,
  caseId: string,
  userPermissions?: UserPermissions | Record<string, boolean>
): Promise<boolean> {
  if (userRole === "admin") return true;
  if (userPermissions && userPermissions["cases"] === false) return false;

  const c = await Case.findById(caseId).select("assignedTo createdBy accessRequests").lean();
  if (!c) return false;

  if (
    c.assignedTo?.toString() === userId ||
    c.createdBy?.toString() === userId
  ) {
    return true;
  }

  // Explicit case access grant
  if (c.accessRequests && Array.isArray(c.accessRequests)) {
    const hasGrant = (c.accessRequests as any[]).some(
      (ar) => ar.userId?.toString() === userId && ar.status === "approved"
    );
    if (hasGrant) return true;
  }

  return false;
}

/**
 * Authorization check for clients
 * Admins: full access
 * Employees: can access only if they created the client OR the client is a party in an accessible case.
 * Module permission does NOT grant blanket access to all client records.
 */
export async function canAccessClient(
  userId: string,
  userRole: string,
  clientId: string,
  userPermissions?: UserPermissions | Record<string, boolean>
): Promise<boolean> {
  if (userRole === "admin") return true;
  if (userPermissions && userPermissions["clients"] === false) return false;

  const c = await Client.findById(clientId).select("createdBy assignedTo").lean();
  if (!c) return false;

  // 1. Creator
  if (c.createdBy?.toString() === userId) return true;

  // 2. Directly assigned staff
  const assignedList = Array.isArray(c.assignedTo) ? c.assignedTo : [];
  if (assignedList.some((id: any) => (id?._id || id)?.toString() === userId)) {
    return true;
  }

  // 3. Client is a party in an accessible case
  const linkedCase = await Case.findOne({
    "parties.clientId": clientId,
    $or: [{ assignedTo: userId }, { createdBy: userId }],
  })
    .select("_id")
    .lean();

  if (linkedCase) return true;

  // If client is explicitly assigned to specific advocate(s), other unassigned employees cannot access it
  if (assignedList.length > 0) {
    return false;
  }

  // 4. Firm member with active clients permission (for unassigned firm clients)
  if (userPermissions && userPermissions["clients"] === true) {
    return true;
  }

  // If clients permission is not explicitly disabled, allow firm employees to view unassigned client details
  return userPermissions?.["clients"] !== false;
}

/**
 * Authorization check for tasks
 * Admins: full access
 * Employees: can access tasks assigned to them, created by them, or in their accessible cases.
 */
export async function canAccessTask(
  userId: string,
  userRole: string,
  taskId: string,
  userPermissions?: UserPermissions | Record<string, boolean>
): Promise<boolean> {
  if (userRole === "admin") return true;
  if (userPermissions && userPermissions["tasks"] === false) return false;

  const task = await Task.findById(taskId)
    .select("assignedTo createdBy caseId")
    .lean();
  if (!task) return false;

  // Direct assignment or creator
  if (task.assignedTo?.toString() === userId) return true;
  if (task.createdBy?.toString() === userId) return true;

  // Check if task's case is accessible
  if (task.caseId) {
    return canAccessCase(userId, userRole, task.caseId.toString(), userPermissions);
  }

  // Firm member with tasks permission
  if (!userPermissions || userPermissions["tasks"] !== false) {
    return true;
  }

  return false;
}

/**
 * Authorization check for calendar events
 * Admins: full access
 * Employees: can access events they created, are assigned to, firm events, or events in their accessible cases.
 */
export async function canAccessCalendarEvent(
  userId: string,
  userRole: string,
  eventId: string,
  userPermissions?: UserPermissions | Record<string, boolean>
): Promise<boolean> {
  if (userRole === "admin") return true;
  if (userPermissions && userPermissions["calendar"] === false) return false;

  const event = await CalendarEvent.findById(eventId)
    .select("createdBy assignedTo type caseId")
    .lean();
  if (!event) return false;

  if (event.createdBy?.toString() === userId) return true;
  if (event.assignedTo?.some((id) => id.toString() === userId)) return true;
  if (event.type === "firm_event") return true;

  if (event.caseId) {
    return canAccessCase(userId, userRole, event.caseId.toString(), userPermissions);
  }

  return false;
}

/**
 * Authorization check for documents (Phase 2 & 3: Document BOLA Prevention)
 * Admins: full access
 * Employees: can access a document ONLY if:
 * 1. They uploaded it (`uploadedBy === userId`)
 * 2. It belongs to a case they are assigned to / created (`canAccessCase(...)`)
 * 3. An explicit approved access grant exists (`accessRequests` with status `approved`)
 *
 * CRITICAL SECURITY FIX: Module permission `userPermissions.documents === true` does
 * NOT bypass individual document authorization.
 */
export async function canAccessDocument(
  userId: string,
  userRole: string,
  documentId: string,
  userPermissions?: UserPermissions | Record<string, boolean>
): Promise<boolean> {
  if (userRole === "admin") return true;
  if (userPermissions && userPermissions["documents"] === false) return false;

  const doc = await DocumentModel.findById(documentId)
    .select("uploadedBy caseId accessRequests state")
    .lean();
  if (!doc) return false;

  // If the document is Rejected by admin, non-admins cannot download or view it
  if (doc.state === "Rejected") return false;

  // Check explicit access requests / revocations for this user
  if (doc.accessRequests && Array.isArray(doc.accessRequests)) {
    const userReqs = doc.accessRequests.filter(
      (ar: any) => (ar.userId?._id || ar.userId)?.toString() === userId
    );
    if (userReqs.length > 0) {
      const latestReq = userReqs[userReqs.length - 1];
      if (latestReq.status === "rejected") {
        // Admin explicitly rejected or revoked access for this user
        return false;
      }
      if (latestReq.status === "approved") {
        return true;
      }
    }
  }

  // 1. Direct uploader (if not revoked)
  if (doc.uploadedBy?.toString() === userId) return true;

  // 2. Case relationship (if not revoked)
  if (doc.caseId) {
    const hasCaseAccess = await canAccessCase(userId, userRole, doc.caseId.toString(), userPermissions);
    if (hasCaseAccess) return true;
  }

  return false;
}

/**
 * Authorization check for chat groups
 * Admins: full access
 * Members: user must be an active member of the chat group.
 */
export async function canAccessChatGroup(
  userId: string,
  userRole: string,
  groupId: string,
): Promise<boolean> {
  if (userRole === "admin") return true;

  const group = await ChatGroup.findById(groupId).select("members").lean();
  if (!group) return false;

  return group.members.some((m: any) => m.userId?.toString() === userId);
}

/**
 * Middleware factory for protecting single resource endpoints
 */
export function requireResourceAccess(
  resourceType: "case" | "client" | "task" | "calendarEvent" | "document" | "chatGroup",
  paramName: string = "id"
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const resourceId = req.params[paramName] as string;
      if (!resourceId) {
        res.status(400).json({ message: `${resourceType} ID required` });
        return;
      }

      const userId = req.userId!;
      const userRole = req.user?.role ?? "employee";
      const permissions = req.user?.permissions as Record<string, boolean> | undefined;

      let hasAccess = false;

      switch (resourceType) {
        case "case":
          hasAccess = await canAccessCase(userId, userRole, resourceId, permissions);
          break;
        case "client":
          hasAccess = await canAccessClient(userId, userRole, resourceId, permissions);
          break;
        case "task":
          hasAccess = await canAccessTask(userId, userRole, resourceId, permissions);
          break;
        case "calendarEvent":
          hasAccess = await canAccessCalendarEvent(userId, userRole, resourceId, permissions);
          break;
        case "document":
          hasAccess = await canAccessDocument(userId, userRole, resourceId, permissions);
          break;
        case "chatGroup":
          hasAccess = await canAccessChatGroup(userId, userRole, resourceId);
          break;
      }

      if (!hasAccess) {
        res.status(403).json({
          code: "ACCESS_DENIED",
          resourceType,
          resourceId,
          message:
            resourceType === "document"
              ? "You don't have access to this document. Kindly ask for access request."
              : `Access denied: you don't have permission to access this ${resourceType}.`,
        });
        return;
      }

      next();
    } catch (err) {
      console.error(`[authz] ${resourceType} access check error:`, err);
      res.status(500).json({ message: "Internal server error" });
    }
  };
}

/**
 * Get case IDs accessible by user (for filtering related resources)
 */
export async function getAccessibleCaseIds(userId: string, userRole: string): Promise<string[]> {
  if (userRole === "admin") return [];

  const cases = await Case.find({
    $or: [
      { assignedTo: userId },
      { createdBy: userId },
      { accessRequests: { $elemMatch: { userId, status: "approved" } } },
    ],
  })
    .select("_id")
    .lean();

  return cases.map((c) => c._id.toString());
}

/**
 * Get client IDs accessible by user
 */
export async function getAccessibleClientIds(userId: string, userRole: string): Promise<string[]> {
  if (userRole === "admin") return [];

  // Clients the user created directly
  const createdClientIds = await Client.find({ createdBy: userId }).distinct("_id");

  // Clients linked as parties in cases the user can access
  const accessibleCases = await Case.find({
    $or: [{ assignedTo: userId }, { createdBy: userId }],
  })
    .select("parties.clientId")
    .lean();

  const linkedClientIds = accessibleCases.flatMap((c) =>
    c.parties
      .filter((p) => p.clientId)
      .map((p) => p.clientId!.toString()),
  );

  return Array.from(
    new Set([
      ...createdClientIds.map((id) => id.toString()),
      ...linkedClientIds,
    ]),
  );
}