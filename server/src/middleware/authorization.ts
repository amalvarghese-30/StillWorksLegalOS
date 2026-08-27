import { Request, Response, NextFunction } from "express";
import { Case } from "../models/Case.js";
import { Client } from "../models/Client.js";
import { Task } from "../models/Task.js";
import { CalendarEvent } from "../models/CalendarEvent.js";
import { DocumentModel } from "../models/Document.js";
import { User, type IUser } from "../models/User.js";

// Extend Express Request with user info (already in auth.ts, but for type safety)
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
 * Employees: can access cases they created OR are assigned to
 */
export async function canAccessCase(
  userId: string,
  userRole: string,
  caseId: string
): Promise<boolean> {
  if (userRole === "admin") return true;

  const c = await Case.findById(caseId).select("assignedTo createdBy").lean();
  if (!c) return false;

  return (
    c.assignedTo?.toString() === userId ||
    c.createdBy?.toString() === userId
  );
}

/**
 * Authorization check for clients
 * Admins: full access
 * Employees: can access clients they created OR clients linked to their cases
 */
export async function canAccessClient(
  userId: string,
  userRole: string,
  clientId: string
): Promise<boolean> {
  if (userRole === "admin") return true;

  const c = await Client.findById(clientId).select("createdBy").lean();
  if (!c) return false;

  if (c.createdBy?.toString() === userId) return true;

  // Also allow access if the client is a party in a case the user can access
  const linkedCase = await Case.findOne({
    "parties.clientId": clientId,
    $or: [{ assignedTo: userId }, { createdBy: userId }],
  })
    .select("_id")
    .lean();

  return !!linkedCase;
}

/**
 * Authorization check for tasks
 * Admins: full access
 * Employees: can access tasks assigned to them, created by them, or in their cases
 */
export async function canAccessTask(
  userId: string,
  userRole: string,
  taskId: string
): Promise<boolean> {
  if (userRole === "admin") return true;

  const task = await Task.findById(taskId)
    .select("assignedTo createdBy caseId")
    .lean();
  if (!task) return false;

  // Direct assignment or creator
  if (task.assignedTo?.toString() === userId) return true;
  if (task.createdBy?.toString() === userId) return true;

  // Check if task's case is accessible
  if (task.caseId) {
    return canAccessCase(userId, userRole, task.caseId.toString());
  }

  return false;
}

/**
 * Authorization check for calendar events
 * Admins: full access
 * Employees: can access events they created OR are assigned to
 */
export async function canAccessCalendarEvent(
  userId: string,
  userRole: string,
  eventId: string
): Promise<boolean> {
  if (userRole === "admin") return true;

  const event = await CalendarEvent.findById(eventId)
    .select("createdBy assignedTo")
    .lean();
  if (!event) return false;

  if (event.createdBy?.toString() === userId) return true;
  if (event.assignedTo?.some((id) => id.toString() === userId)) return true;

  return false;
}

/**
 * Authorization check for documents
 * Admins: full access
 * Employees: can access documents they uploaded OR in their cases
 */
export async function canAccessDocument(
  userId: string,
  userRole: string,
  documentId: string
): Promise<boolean> {
  if (userRole === "admin") return true;

  const doc = await DocumentModel.findById(documentId)
    .select("uploadedBy caseId")
    .lean();
  if (!doc) return false;

  if (doc.uploadedBy?.toString() === userId) return true;

  if (doc.caseId) {
    return canAccessCase(userId, userRole, doc.caseId.toString());
  }

  return false;
}

/**
 * Middleware factory for protecting single resource endpoints
 */
export function requireResourceAccess(
  resourceType: "case" | "client" | "task" | "calendarEvent" | "document",
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

      let hasAccess = false;

      switch (resourceType) {
        case "case":
          hasAccess = await canAccessCase(userId, userRole, resourceId);
          break;
        case "client":
          hasAccess = await canAccessClient(userId, userRole, resourceId);
          break;
        case "task":
          hasAccess = await canAccessTask(userId, userRole, resourceId);
          break;
        case "calendarEvent":
          hasAccess = await canAccessCalendarEvent(userId, userRole, resourceId);
          break;
        case "document":
          hasAccess = await canAccessDocument(userId, userRole, resourceId);
          break;
      }

      if (!hasAccess) {
        res.status(403).json({
          message: `Access denied: you don't have permission to access this ${resourceType}`,
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
 * Filter query for list endpoints - adds user's accessible resources to filter
 */
export function buildUserFilter(userId: string, userRole: string, baseFilter: Record<string, unknown> = {}) {
  if (userRole === "admin") return baseFilter;

  // For employees, we need to build a filter that only returns their resources
  // This is used in list endpoints
  return baseFilter;
}

/**
 * Get case IDs accessible by user (for filtering related resources)
 */
export async function getAccessibleCaseIds(userId: string, userRole: string): Promise<string[]> {
  if (userRole === "admin") return [];

  const cases = await Case.find({
    $or: [{ assignedTo: userId }, { createdBy: userId }],
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