import { Types } from "mongoose";
import { Task } from "../models/Task.js";
import { Case } from "../models/Case.js";
import { User } from "../models/User.js";
import { ApprovalRequest } from "../models/ApprovalRequest.js";
import { NotificationOutbox } from "../models/NotificationOutbox.js";
import { NotificationService } from "./notifications.js";
import { AppSettings } from "../models/AppSettings.js";

export interface DailyReportSummary {
  date: string;
  tasksCompleted: number;
  tasksPending: number;
  tasksOverdue: number;
  tasksDueSoon: number;
  pendingApprovals: number;
  employeeProgress: Array<{
    name: string;
    completed: number;
    pending: number;
    overdue: number;
  }>;
  upcomingHearings: number;
  failedDeliveries: number;
}

export async function generateDailyAdminReportData(referenceDate: Date = new Date()): Promise<DailyReportSummary> {
  const startOfDay = new Date(referenceDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(referenceDate);
  endOfDay.setHours(23, 59, 59, 999);

  const dueSoonWindow = new Date(referenceDate.getTime() + 48 * 3600 * 1000);

  const [
    tasksCompleted,
    tasksPending,
    tasksOverdue,
    tasksDueSoon,
    pendingApprovals,
    employees,
    upcomingHearings,
    failedDeliveries,
  ] = await Promise.all([
    Task.countDocuments({
      status: "completed",
      completedAt: { $gte: startOfDay, $lte: endOfDay },
      isDeleted: { $ne: true },
    }),
    Task.countDocuments({
      status: { $in: ["pending", "in_progress", "pending_approval"] },
      isDeleted: { $ne: true },
    }),
    Task.countDocuments({
      status: { $ne: "completed" },
      deadline: { $lt: referenceDate },
      isDeleted: { $ne: true },
    }),
    Task.countDocuments({
      status: { $ne: "completed" },
      deadline: { $gte: referenceDate, $lte: dueSoonWindow },
      isDeleted: { $ne: true },
    }),
    ApprovalRequest.countDocuments({ status: "pending" }),
    User.find({ role: { $ne: "admin" } }).select("_id name").lean(),
    Case.countDocuments({
      nextHearing: { $gte: referenceDate, $lte: dueSoonWindow },
      isDeleted: { $ne: true },
    }),
    NotificationOutbox.countDocuments({
      status: "failed",
      createdAt: { $gte: startOfDay },
    }),
  ]);

  const employeeProgress = await Promise.all(
    employees.map(async (emp) => {
      const [completed, pending, overdue] = await Promise.all([
        Task.countDocuments({
          assignedTo: emp._id,
          status: "completed",
          completedAt: { $gte: startOfDay, $lte: endOfDay },
          isDeleted: { $ne: true },
        }),
        Task.countDocuments({
          assignedTo: emp._id,
          status: { $in: ["pending", "in_progress", "pending_approval"] },
          isDeleted: { $ne: true },
        }),
        Task.countDocuments({
          assignedTo: emp._id,
          status: { $ne: "completed" },
          deadline: { $lt: referenceDate },
          isDeleted: { $ne: true },
        }),
      ]);
      return {
        name: emp.name,
        completed,
        pending,
        overdue,
      };
    })
  );

  const dateStr = referenceDate.toISOString().slice(0, 10);
  return {
    date: dateStr,
    tasksCompleted,
    tasksPending,
    tasksOverdue,
    tasksDueSoon,
    pendingApprovals,
    employeeProgress,
    upcomingHearings,
    failedDeliveries,
  };
}

export async function dispatchDailyAdminReport(io?: any, referenceDate: Date = new Date()): Promise<number> {
  const config = await (AppSettings as any).getDailyReportConfig();
  if (!config.enabled) {
    return 0;
  }

  const summary = await generateDailyAdminReportData(referenceDate);
  const admins = await User.find({
    $or: [{ role: "admin" }, { "permissions.approvals": true }],
  }).select("_id name email phone");

  let dispatchedCount = 0;

  for (const admin of admins) {
    const dedupeKey = `daily-admin-report:${admin._id.toString()}:${summary.date}`;

    const reportMessage =
      `📊 Daily LegalOS Progress Report (${summary.date}):\n` +
      `• Completed Today: ${summary.tasksCompleted}\n` +
      `• Pending Work: ${summary.tasksPending}\n` +
      `• Overdue Tasks: ${summary.tasksOverdue}\n` +
      `• Due Soon (48h): ${summary.tasksDueSoon}\n` +
      `• Outstanding Approvals: ${summary.pendingApprovals}\n` +
      `• Hearings Next 48h: ${summary.upcomingHearings}`;

    const notif = await NotificationService.createNotification(
      {
        userId: admin._id,
        type: "SYSTEM_ALERT",
        title: `Daily Admin Summary (${summary.date})`,
        message: reportMessage,
        metadata: {
          subType: "daily_progress_report",
          summary,
        },
        dedupeKey,
      },
      io
    );

    if (notif) {
      dispatchedCount++;

      // Also queue external outbox message if admin has email or phone
      if (admin.email) {
        await NotificationOutbox.create({
          recipientId: admin._id,
          channel: "email",
          eventType: "DAILY_PROGRESS_REPORT",
          title: `Daily LegalOS Progress Report — ${summary.date}`,
          message: reportMessage,
          recipientContact: admin.email,
          status: "queued",
          metadata: { summary },
        });
      }
    }
  }

  return dispatchedCount;
}
