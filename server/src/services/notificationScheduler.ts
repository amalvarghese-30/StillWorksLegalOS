import { Types } from "mongoose";
import { NotificationService } from "./notifications.js";
import { CalendarEvent } from "../models/CalendarEvent.js";
import { Task } from "../models/Task.js";
import { AppSettings } from "../models/AppSettings.js";
import { processOutboxQueue } from "./externalNotifications/index.js";
import { dispatchDailyAdminReport } from "./dailyAdminReport.js";
import { processAttachmentRetention } from "./attachmentRetention.js";
import { resolveTaskClientName, resolveTaskAssigneeName } from "../utils/taskHelpers.js";

// ---------------------------------------------------------------------------
// Deduplication key helpers
// ---------------------------------------------------------------------------

function hearingDedupeKey(eventId: string, windowStart: Date): string {
  return `hearing-reminder:${eventId}:${windowStart.toISOString()}`;
}

function taskDueTodayDedupeKey(taskId: string, date: Date): string {
  const d = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  return `task-due-today:${taskId}:${d}`;
}

function overdueDedupeKey(taskId: string, date: Date): string {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const week = Math.ceil(
    ((date.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7,
  );
  return `overdue-task:${taskId}:${date.getFullYear()}-W${week}`;
}

function workingHoursDedupeKey(taskId: string, date: Date, slot: number): string {
  const d = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  return `working-hours-task:${taskId}:${d}:slot-${slot}`;
}

export class NotificationScheduler {
  private static instance: NotificationScheduler;
  private io: unknown;
  private timers: NodeJS.Timeout[] = [];

  private constructor(io: unknown) {
    this.io = io;
  }

  static start(io: unknown): void {
    if (!NotificationScheduler.instance) {
      NotificationScheduler.instance = new NotificationScheduler(io);
    }
    NotificationScheduler.instance.scheduleJobs();
  }

  static stop(): void {
    if (NotificationScheduler.instance) {
      NotificationScheduler.instance.timers.forEach(clearTimeout);
      NotificationScheduler.instance.timers = [];
    }
  }

  // ---------------------------------------------------------------------------
  // Job orchestration
  // ---------------------------------------------------------------------------

  private scheduleJobs(): void {
    this.scheduleHearingReminders();
    this.scheduleOverdueTaskReminders();
    this.scheduleTodayTaskReminders();
    this.scheduleWorkingHoursTaskReminders();
    this.scheduleOutboxWorker();
    this.scheduleDailyAdminReportJob();
    this.scheduleAttachmentRetentionJob();
  }

  // ---------------------------------------------------------------------------
  // Hearing reminders
  // ---------------------------------------------------------------------------

  private scheduleHearingReminders(): void {
    const job = async () => {
      try {
        await this.checkForUpcomingHearings();
      } catch (err) {
        console.error("[NotificationScheduler] Hearing check error:", err);
      }
      const timer = setTimeout(() => this.scheduleHearingReminders(), 5 * 60 * 1000);
      this.timers.push(timer);
    };
    setTimeout(job, 0);
  }

  private async checkForUpcomingHearings(): Promise<void> {
    const now = new Date();
    const soon = new Date(now.getTime() + 30 * 60 * 1000);
    const windowStart = new Date(Math.floor(now.getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000));

    const hearings = await CalendarEvent.find({
      type: "hearing",
      start: { $gte: now, $lte: soon },
    }).select("_id title start assignedTo createdBy caseId").lean();

    if (hearings.length === 0) return;

    for (const hearing of hearings) {
      const eventId = (hearing._id as Types.ObjectId).toString();
      const startStr = hearing.start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      const recipientSet = new Set<string>(
        (hearing.assignedTo as Types.ObjectId[]).map((id) => id.toString()),
      );
      if (hearing.createdBy) {
        recipientSet.add((hearing.createdBy as Types.ObjectId).toString());
      }

      for (const recipientIdStr of recipientSet) {
        const dedupeKey = hearingDedupeKey(`${eventId}:${recipientIdStr}`, windowStart);

        await NotificationService.createNotification(
          {
            userId: new Types.ObjectId(recipientIdStr),
            type: "HEARING_REMINDER",
            title: "Upcoming Hearing",
            message: `Hearing "${hearing.title}" is scheduled to start at ${startStr} (within the next 30 minutes).`,
            relatedId: hearing._id as Types.ObjectId,
            relatedModel: "CalendarEvent",
            metadata: {
              hearingId: eventId,
              caseId: hearing.caseId ? (hearing.caseId as Types.ObjectId).toString() : null,
              start: hearing.start.toISOString(),
            },
            dedupeKey,
          },
          this.io,
        );
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Overdue task reminders
  // ---------------------------------------------------------------------------

  private scheduleOverdueTaskReminders(): void {
    const job = async () => {
      try {
        await this.checkForOverdueTasks();
      } catch (err) {
        console.error("[NotificationScheduler] Overdue task check error:", err);
      }
      const timer = setTimeout(() => this.scheduleOverdueTaskReminders(), 5 * 60 * 1000);
      this.timers.push(timer);
    };
    setTimeout(job, 0);
  }

  private async checkForOverdueTasks(): Promise<void> {
    const now = new Date();

    const overdueTasks = await Task.find({
      deadline: { $lt: now },
      status: { $nin: ["completed", "pending_approval"] },
      assignedTo: { $ne: null },
      isDeleted: { $ne: true },
    })
      .select("_id title deadline assignedTo caseId priority")
      .lean();

    if (overdueTasks.length === 0) return;

    for (const task of overdueTasks) {
      if (!task.assignedTo) continue;

      const taskId = (task._id as Types.ObjectId).toString();
      const assigneeId = (task.assignedTo as Types.ObjectId).toString();
      const dedupeKey = overdueDedupeKey(`${taskId}:${assigneeId}`, now);

      await NotificationService.createNotification(
        {
          userId: new Types.ObjectId(assigneeId),
          type: "OVERDUE_TASK",
          title: "Overdue Task",
          message: `Task "${task.title}" is overdue (deadline was ${task.deadline ? new Date(task.deadline).toLocaleDateString() : "unknown"}). Please review or complete it.`,
          relatedId: task._id as Types.ObjectId,
          relatedModel: "Task",
          metadata: {
            taskId,
            priority: task.priority,
            deadline: task.deadline ? new Date(task.deadline).toISOString() : null,
            caseId: task.caseId ? (task.caseId as Types.ObjectId).toString() : null,
          },
          dedupeKey,
        },
        this.io,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Tasks due today
  // ---------------------------------------------------------------------------

  private scheduleTodayTaskReminders(): void {
    const job = async () => {
      try {
        await this.checkForTodayTasks();
      } catch (err) {
        console.error("[NotificationScheduler] Today tasks check error:", err);
      }
      const timer = setTimeout(() => this.scheduleTodayTaskReminders(), 60 * 60 * 1000);
      this.timers.push(timer);
    };
    setTimeout(job, 0);
  }

  private async checkForTodayTasks(): Promise<void> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const tasksDueToday = await Task.find({
      deadline: { $gte: todayStart, $lte: todayEnd },
      status: { $nin: ["completed", "pending_approval"] },
      assignedTo: { $ne: null },
      isDeleted: { $ne: true },
    })
      .select("_id title deadline assignedTo caseId priority")
      .lean();

    if (tasksDueToday.length === 0) return;

    for (const task of tasksDueToday) {
      if (!task.assignedTo) continue;

      const taskId = (task._id as Types.ObjectId).toString();
      const assigneeId = (task.assignedTo as Types.ObjectId).toString();
      const dedupeKey = taskDueTodayDedupeKey(`${taskId}:${assigneeId}`, now);

      const timeStr = task.deadline
        ? new Date(task.deadline).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "";

      await NotificationService.createNotification(
        {
          userId: new Types.ObjectId(assigneeId),
          type: "TASK_DUE",
          title: "Task Due Today",
          message: `Task "${task.title}" is due today${timeStr ? ` at ${timeStr}` : ""}. Make sure to complete it on time.`,
          relatedId: task._id as Types.ObjectId,
          relatedModel: "Task",
          metadata: {
            taskId,
            priority: task.priority,
            deadline: task.deadline ? new Date(task.deadline).toISOString() : null,
            caseId: task.caseId ? (task.caseId as Types.ObjectId).toString() : null,
          },
          dedupeKey,
        },
        this.io,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Two-hour pending-task reminders (Remind every 2 hours for all pending tasks)
  // ---------------------------------------------------------------------------

  private scheduleWorkingHoursTaskReminders(): void {
    const job = async () => {
      try {
        await this.checkWorkingHoursPendingTasks();
      } catch (err) {
        console.error("[NotificationScheduler] Pending task 2-hour reminder error:", err);
      }
      const timer = setTimeout(() => this.scheduleWorkingHoursTaskReminders(), 15 * 60 * 1000);
      this.timers.push(timer);
    };
    setTimeout(job, 5000);
  }

  private async checkWorkingHoursPendingTasks(): Promise<void> {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    const pendingTasks = await Task.find({
      status: { $in: ["pending", "in_progress"] },
      isDeleted: { $ne: true },
      $or: [
        { createdAt: { $lte: twoHoursAgo } },
        { startedAt: { $lte: twoHoursAgo } },
      ],
    })
      .populate("assignedTo", "name email title")
      .populate("clientId", "name phone")
      .populate("caseId", "title number parties")
      .lean();

    if (!pendingTasks || pendingTasks.length === 0) return;

    for (const task of pendingTasks) {
      const taskId = (task._id as Types.ObjectId).toString();
      const startTime = new Date(task.startedAt || task.createdAt || now).getTime();
      const pendingHours = Math.max(2, Math.floor((now.getTime() - startTime) / (60 * 60 * 1000)));
      // 2-hour slot index (e.g. 1 = 2h, 2 = 4h, 3 = 6h, etc.)
      const slot = Math.floor(pendingHours / 2);

      const clientName = resolveTaskClientName(task);
      const assignedStaff = resolveTaskAssigneeName(task);
      const deadlineStr = task.deadline ? new Date(task.deadline).toISOString() : null;
      const assignedToId = (task.assignedTo as any)?._id?.toString() || (task.assignedTo ? (task.assignedTo as Types.ObjectId).toString() : null);

      const reminderPayload = {
        taskId,
        taskTitle: task.title,
        clientName,
        assignedStaff,
        assignedToId,
        deadline: deadlineStr,
        priority: task.priority || "Medium",
        pendingHours,
        slot,
      };

      // Real-time socket event for immediate frontend reminder popup
      if (this.io && (this.io as any).emit) {
        (this.io as any).emit("task:pending-reminder", reminderPayload);
      }

      // Persist deduplicated notification for the assigned staff
      if (assignedToId) {
        const dedupeKey = `pending-2hr:${taskId}:${assignedToId}:${slot}`;

        await NotificationService.createNotification(
          {
            userId: new Types.ObjectId(assignedToId),
            type: "TASK_DUE",
            title: "Pending Work Reminder (2h+)",
            message: `Reminder: Task "${task.title}" for client "${clientName}" has been pending for ${pendingHours} hours. Deadline: ${task.deadline ? new Date(task.deadline).toLocaleDateString() : "None"}`,
            relatedId: task._id as Types.ObjectId,
            relatedModel: "Task",
            metadata: {
              ...reminderPayload,
              subType: "2hr_pending_reminder",
            },
            dedupeKey,
          },
          this.io,
        );
      }
    }
  }

  // ---------------------------------------------------------------------------
  // External notification outbox worker
  // ---------------------------------------------------------------------------

  private scheduleOutboxWorker(): void {
    const job = async () => {
      try {
        await processOutboxQueue(this.io);
      } catch (err) {
        console.error("[NotificationScheduler] Outbox worker error:", err);
      }
      const timer = setTimeout(() => this.scheduleOutboxWorker(), 20 * 1000);
      this.timers.push(timer);
    };
    setTimeout(job, 5000);
  }

  // ---------------------------------------------------------------------------
  // Daily admin report job
  // ---------------------------------------------------------------------------

  private scheduleDailyAdminReportJob(): void {
    const job = async () => {
      try {
        const now = new Date();
        const config = await (AppSettings as any).getDailyReportConfig();
        const [targetHour] = (config.time || "19:00").split(":").map(Number);

        if (now.getHours() >= targetHour) {
          await dispatchDailyAdminReport(this.io, now);
        }
      } catch (err) {
        console.error("[NotificationScheduler] Daily admin report error:", err);
      }
      const timer = setTimeout(() => this.scheduleDailyAdminReportJob(), 15 * 60 * 1000);
      this.timers.push(timer);
    };
    setTimeout(job, 15000);
  }

  // ---------------------------------------------------------------------------
  // Attachment retention cleanup job
  // ---------------------------------------------------------------------------

  private scheduleAttachmentRetentionJob(): void {
    const job = async () => {
      try {
        await processAttachmentRetention(this.io);
      } catch (err) {
        console.error("[NotificationScheduler] Attachment retention error:", err);
      }
      const timer = setTimeout(() => this.scheduleAttachmentRetentionJob(), 24 * 60 * 60 * 1000);
      this.timers.push(timer);
    };
    setTimeout(job, 30000);
  }
}