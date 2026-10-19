import { Types } from "mongoose";
import type { Request } from "express";
import { AuditLog } from "../models/AuditLog.js";
import { User } from "../models/User.js";
import { NotificationService } from "../services/notifications.js";

export interface TaskAuditOptions {
  task: any;
  action: "create" | "update" | "delete" | "approve" | "reject";
  mutationType: string;
  details: string;
  humanMessage?: string;
  previousValues?: Record<string, any>;
  newValues?: Record<string, any>;
  diffs?: string[];
  io?: any;
}

export interface CaseAuditOptions {
  caseRecord: any;
  action: "create" | "update" | "delete" | "approve" | "reject";
  mutationType: string;
  details: string;
  humanMessage?: string;
  previousValues?: Record<string, any>;
  newValues?: Record<string, any>;
  diffs?: string[];
  io?: any;
}

/**
 * Record a tamper-evident task audit log entry and dispatch an administrator notification
 * whenever a non-admin employee performs a meaningful task mutation.
 */
export async function recordTaskAuditAndAdminNotification(
  req: Request,
  options: TaskAuditOptions
): Promise<void> {
  const io = options.io || req.app?.get?.("io");
  const metadata: Record<string, any> = {
    mutationType: options.mutationType,
    taskId: String(options.task?._id || ""),
    taskTitle: options.task?.title || "",
    caseId: options.task?.caseId ? String((options.task.caseId as any)?._id || options.task.caseId) : undefined,
    clientId: options.task?.clientId ? String((options.task.clientId as any)?._id || options.task.clientId) : undefined,
  };
  if (options.diffs && options.diffs.length > 0) metadata.diffs = options.diffs;
  if (options.previousValues) metadata.previousValues = options.previousValues;
  if (options.newValues) metadata.newValues = options.newValues;

  try {
    if (AuditLog.logWithActivity) {
      await AuditLog.logWithActivity(
        {
          userId: new Types.ObjectId(req.userId!),
          userName: req.user?.name ?? "Unknown",
          action: options.action,
          resource: "task",
          resourceId: String(options.task?._id || ""),
          resourceName: options.task?.title || "Task",
          details: options.details,
          metadata,
          ip: req.ip || "",
          userAgent: req.headers?.["user-agent"] || "",
        },
        io
      );
    } else {
      await AuditLog.create({
        userId: req.userId,
        userName: req.user?.name ?? "Unknown",
        action: options.action,
        resource: "task",
        resourceId: String(options.task?._id || ""),
        resourceName: options.task?.title || "Task",
        details: options.details,
        metadata,
        ip: req.ip || "",
        userAgent: req.headers?.["user-agent"] || "",
      });
    }
  } catch (auditErr) {
    console.error("[auditNotificationHelper] Failed to persist task audit log:", auditErr);
  }

  // Notify admins when a non-admin employee modifies a task
  if (req.user?.role !== "admin" && options.humanMessage) {
    try {
      const admins = await User.find({ role: "admin", status: { $ne: "Inactive" } })
        .select("_id")
        .lean();
      for (const admin of admins) {
        await NotificationService.createNotification(
          {
            userId: admin._id as Types.ObjectId,
            type: "TASK_MUTATION",
            title: `Task Update: ${options.task?.title || "Task"}`,
            message: options.humanMessage,
            relatedId: options.task?._id,
            relatedModel: "Task",
            actorId: new Types.ObjectId(req.userId!),
            metadata: {
              taskId: String(options.task?._id || ""),
              taskTitle: options.task?.title || "",
              mutationType: options.mutationType,
              action: options.action,
              actorName: req.user?.name || "Employee",
              timestamp: new Date().toISOString(),
              previousValues: options.previousValues,
              newValues: options.newValues,
            },
          },
          io
        );
      }
    } catch (notifErr) {
      console.error("[auditNotificationHelper] Failed to dispatch admin notification for task mutation:", notifErr);
    }
  }
}

/**
 * Record a tamper-evident case audit log entry and dispatch an administrator notification
 * whenever a non-admin employee performs a meaningful case mutation.
 */
export async function recordCaseAuditAndAdminNotification(
  req: Request,
  options: CaseAuditOptions
): Promise<void> {
  const io = options.io || req.app?.get?.("io");
  const metadata: Record<string, any> = {
    mutationType: options.mutationType,
    caseId: String(options.caseRecord?._id || ""),
    caseNumber: options.caseRecord?.number || "",
    caseTitle: options.caseRecord?.title || "",
  };
  if (options.diffs && options.diffs.length > 0) metadata.diffs = options.diffs;
  if (options.previousValues) metadata.previousValues = options.previousValues;
  if (options.newValues) metadata.newValues = options.newValues;

  try {
    if (AuditLog.logWithActivity) {
      await AuditLog.logWithActivity(
        {
          userId: new Types.ObjectId(req.userId!),
          userName: req.user?.name ?? "Unknown",
          action: options.action,
          resource: "case",
          resourceId: String(options.caseRecord?._id || ""),
          resourceName: options.caseRecord?.title || options.caseRecord?.number || "Case",
          details: options.details,
          metadata,
          ip: req.ip || "",
          userAgent: req.headers?.["user-agent"] || "",
        },
        io
      );
    } else {
      await AuditLog.create({
        userId: req.userId,
        userName: req.user?.name ?? "Unknown",
        action: options.action,
        resource: "case",
        resourceId: String(options.caseRecord?._id || ""),
        resourceName: options.caseRecord?.title || options.caseRecord?.number || "Case",
        details: options.details,
        metadata,
        ip: req.ip || "",
        userAgent: req.headers?.["user-agent"] || "",
      });
    }
  } catch (auditErr) {
    console.error("[auditNotificationHelper] Failed to persist case audit log:", auditErr);
  }

  // Notify admins when a non-admin employee modifies a case
  if (req.user?.role !== "admin" && options.humanMessage) {
    try {
      const admins = await User.find({ role: "admin", status: { $ne: "Inactive" } })
        .select("_id")
        .lean();
      for (const admin of admins) {
        await NotificationService.createNotification(
          {
            userId: admin._id as Types.ObjectId,
            type: "CASE_UPDATE",
            title: `Case Update: ${options.caseRecord?.number || "Matter"}`,
            message: options.humanMessage,
            relatedId: options.caseRecord?._id,
            relatedModel: "Case",
            actorId: new Types.ObjectId(req.userId!),
            metadata: {
              caseId: String(options.caseRecord?._id || ""),
              caseNumber: options.caseRecord?.number || "",
              caseTitle: options.caseRecord?.title || "",
              mutationType: options.mutationType,
              action: options.action,
              actorName: req.user?.name || "Employee",
              timestamp: new Date().toISOString(),
              previousValues: options.previousValues,
              newValues: options.newValues,
            },
          },
          io
        );
      }
    } catch (notifErr) {
      console.error("[auditNotificationHelper] Failed to dispatch admin notification for case mutation:", notifErr);
    }
  }
}
