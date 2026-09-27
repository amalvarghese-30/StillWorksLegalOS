import { Types } from "mongoose";
import { NotificationService } from "./notifications.js";
import { CalendarEvent } from "../models/CalendarEvent.js";
import { Task } from "../models/Task.js";

// ---------------------------------------------------------------------------
// Deduplication key helpers
// ---------------------------------------------------------------------------
// All keys include a time-window component so the same event/task generates at
// most one notification per window, even though the scheduler polls frequently.

/**
 * Hearing reminder: one notification per (event × 30-min window).
 * Window = the half-hour slot the scheduler is currently running in.
 */
function hearingDedupeKey(eventId: string, windowStart: Date): string {
  return `hearing-reminder:${eventId}:${windowStart.toISOString()}`;
}

/**
 * Task-due-today: one notification per (task × calendar date).
 */
function taskDueTodayDedupeKey(taskId: string, date: Date): string {
  const d = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  return `task-due-today:${taskId}:${d}`;
}

/**
 * Overdue-task: one notification per (task × ISO week).
 * This limits the reminder to once per week so overdue tasks don't spam.
 */
function overdueDedupeKey(taskId: string, date: Date): string {
  // ISO week: year + week number
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const week = Math.ceil(
    ((date.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7,
  );
  return `overdue-task:${taskId}:${date.getFullYear()}-W${week}`;
}

// ---------------------------------------------------------------------------
// Scheduler class
// ---------------------------------------------------------------------------

/**
 * Notification scheduler for time-based notifications.
 * Runs periodic checks for upcoming events, overdue tasks, etc.
 *
 * Deduplication strategy: every `createNotification` call includes a
 * `dedupeKey`. The Notification model has a unique sparse index on that field,
 * so duplicate notifications within the same time-window are silently skipped
 * by the service.
 */
export class NotificationScheduler {
  private static instance: NotificationScheduler;
  private io: unknown;
  private timers: NodeJS.Timeout[] = [];

  private constructor(io: unknown) {
    this.io = io;
  }

  /**
   * Initialize and start the scheduler (singleton).
   * @param io Socket.IO server instance for real-time delivery
   */
  static start(io: unknown): void {
    if (!NotificationScheduler.instance) {
      NotificationScheduler.instance = new NotificationScheduler(io);
    }
    NotificationScheduler.instance.scheduleJobs();
  }

  /**
   * Stop all scheduled jobs (used during graceful shutdown).
   */
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
    // Hearing reminders — poll every 5 minutes
    this.scheduleHearingReminders();
    // Overdue tasks — poll every 5 minutes
    this.scheduleOverdueTaskReminders();
    // Tasks due today — poll every hour
    this.scheduleTodayTaskReminders();
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

  /**
   * Find hearings starting within the next 30 minutes and create a
   * HEARING_REMINDER notification for every user in assignedTo[].
   * Also notifies the createdBy user if they aren't already in assignedTo.
   */
  private async checkForUpcomingHearings(): Promise<void> {
    const now = new Date();
    const soon = new Date(now.getTime() + 30 * 60 * 1000);

    // Round now down to the nearest 5-min boundary for stable dedupe keys
    const windowStart = new Date(Math.floor(now.getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000));

    const hearings = await CalendarEvent.find({
      type: "hearing",
      start: { $gte: now, $lte: soon },
    }).select("_id title start assignedTo createdBy caseId").lean();

    if (hearings.length === 0) return;

    console.info(`[NotificationScheduler] ${hearings.length} upcoming hearing(s) found.`);

    for (const hearing of hearings) {
      const eventId = (hearing._id as Types.ObjectId).toString();
      const startStr = hearing.start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      // Collect unique recipient IDs (assignedTo + createdBy)
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

  /**
   * Find tasks past their deadline that are not completed and notify the
   * assignee. Deduped per task per ISO calendar week to avoid daily spam.
   */
  private async checkForOverdueTasks(): Promise<void> {
    const now = new Date();

    const overdueTasks = await Task.find({
      deadline: { $lt: now },
      status: { $nin: ["completed", "pending_approval"] },
      assignedTo: { $ne: null },
    })
      .select("_id title deadline assignedTo caseId priority")
      .lean();

    if (overdueTasks.length === 0) return;

    console.info(`[NotificationScheduler] ${overdueTasks.length} overdue task(s) found.`);

    for (const task of overdueTasks) {
      if (!task.assignedTo) continue;

      const taskId = (task._id as Types.ObjectId).toString();
      const assigneeId = (task.assignedTo as Types.ObjectId).toString();
      const dedupeKey = overdueDedupeKey(`${taskId}:${assigneeId}`, now);

      const deadlineStr = task.deadline
        ? new Date(task.deadline).toLocaleDateString([], {
            weekday: "short",
            month: "short",
            day: "numeric",
          })
        : "unknown date";

      await NotificationService.createNotification(
        {
          userId: new Types.ObjectId(assigneeId),
          type: "OVERDUE_TASK",
          title: "Overdue Task",
          message: `Task "${task.title}" was due on ${deadlineStr} and is still ${task.status}. Please update its status or request an extension.`,
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

  /**
   * Find tasks whose deadline falls within today (midnight→midnight) that are
   * not yet completed. Notifies the assignee once per calendar day.
   */
  private async checkForTodayTasks(): Promise<void> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const tasksDueToday = await Task.find({
      deadline: { $gte: todayStart, $lte: todayEnd },
      status: { $nin: ["completed"] },
      assignedTo: { $ne: null },
    })
      .select("_id title deadline assignedTo caseId priority")
      .lean();

    if (tasksDueToday.length === 0) return;

    console.info(`[NotificationScheduler] ${tasksDueToday.length} task(s) due today.`);

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
}