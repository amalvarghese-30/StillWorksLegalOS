import { Types } from "mongoose";
import { Notification, INotification } from "../models/Notification";
import { User } from "../models/User";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationType =
  | "HEARING_REMINDER"
  | "APPROVAL_REQUEST"
  | "DOCUMENT_SHARED"
  | "TASK_ASSIGNED"
  | "TASK_DUE"
  | "OVERDUE_TASK"
  | "CASE_UPDATE"
  | "COMMENT_MENTION"
  | "SYSTEM_ALERT"
  | "CUSTOM";

export interface NotificationData {
  userId: Types.ObjectId; // The user to notify
  type: NotificationType;
  title: string; // Short title
  message: string; // Detailed message
  read?: boolean; // Whether the user has read it (default: false)
  relatedId?: Types.ObjectId; // Optional: ID of related entity (document, case, etc.)
  relatedModel?: string; // Optional: Model name of related entity (e.g., "Document", "Case")
  actorId?: Types.ObjectId; // Optional: User who triggered the notification
  metadata?: Record<string, unknown>; // Additional data
  dedupeKey?: string; // Optional: Key for deduplication (e.g., hash of content to avoid duplicates)
}

// ---------------------------------------------------------------------------
// Notification Service
// ---------------------------------------------------------------------------

/**
 * Service for creating and sending notifications.
 * Handles persistence and real-time delivery via Socket.IO.
 */
export class NotificationService {
  /**
   * Create a new notification and optionally emit it via Socket.IO.
   * @param data Notification data
   * @param io Optional Socket.IO server instance for real-time emission
   * @returns The created notification document
   */
  static async createNotification(
    data: NotificationData,
    io?: any
  ): Promise<INotification | null> {
    try {
      // Check for dedupeKey to avoid duplicates
      if (data.dedupeKey) {
        const existing = await Notification.findOne({ dedupeKey: data.dedupeKey });
        if (existing) {
          // Optionally, we could update the existing notification, but for now we just skip
          return null;
        }
      }

      // Create the notification
      const notification = await Notification.create({
        userId: data.userId,
        type: data.type,
        title: data.title.trim(),
        message: data.message.trim(),
        read: data.read ?? false,
        relatedId: data.relatedId,
        relatedModel: data.relatedModel,
        actorId: data.actorId,
        metadata: data.metadata ?? {},
        dedupeKey: data.dedupeKey,
      });

      // Emit real-time notification if Socket.IO instance is provided
      if (io) {
        await this.emitNotification(notification, io);
      }

      return notification;
    } catch (err) {
      console.error("[NotificationService] Failed to create notification:", err);
      return null;
    }
  }

  /**
   * Emit a notification to the relevant Socket.IO rooms.
   * @param notification The notification to emit
   * @param io Socket.IO server instance
   */
  private static async emitNotification(
    notification: INotification,
    io: any
  ): Promise<void> {
    try {
      // Fetch the user to get their name for the notification payload
      const user = await User.findById(notification.userId).select("name");
      const userName = user?.name ?? "Unknown";

      // Prepare the notification payload for the client
      const payload = {
        id: notification._id,
        userId: notification.userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        read: notification.read,
        createdAt: notification.createdAt,
        relatedId: notification.relatedId,
        relatedModel: notification.relatedModel,
        actorId: notification.actorId,
        metadata: notification.metadata,
        userName, // Include the user's name for convenience
      };

      // Emit to the user's personal room
      io.to(`user:${notification.userId}`).emit("notification:new", payload);

      // If the notification is of a type that should appear in the admin live-feed, emit there too
      // For example, system alerts, approval requests, etc.
      if (
        notification.type === "SYSTEM_ALERT" ||
        notification.type === "APPROVAL_REQUEST" ||
        notification.type === "DOCUMENT_SHARED" ||
        notification.type === "CASE_UPDATE"
      ) {
        // Emit to admin live-feed room (only admins are in this room)
        io.to("admin:live-feed").emit("notification:new", payload);
      }
    } catch (err) {
      console.error("[NotificationService] Failed to emit notification:", err);
    }
  }

  /**
   * Mark a notification as read.
   * @param notificationId The ID of the notification to mark as read
   * @param userId The ID of the user (for authorization)
   * @returns The updated notification document or null if not found/unauthorized
   */
  static async markAsRead(
    notificationId: Types.ObjectId,
    userId: Types.ObjectId
  ): Promise<INotification | null> {
    try {
      const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, userId },
        { read: true },
        { new: true }
      );
      return notification;
    } catch (err) {
      console.error("[NotificationService] Failed to mark notification as read:", err);
      return null;
    }
  }

  /**
   * Mark all notifications as read for a user.
   * @param userId The ID of the user
   * @returns The number of notifications marked as read
   */
  static async markAllAsRead(userId: Types.ObjectId): Promise<number> {
    try {
      const result = await Notification.updateMany(
        { userId, read: false },
        { read: true }
      );
      return result.modifiedCount;
    } catch (err) {
      console.error("[NotificationService] Failed to mark all notifications as read:", err);
      return 0;
    }
  }

  /**
   * Delete a notification.
   * @param notificationId The ID of the notification to delete
   * @param userId The ID of the user (for authorization)
   * @returns True if deleted, false otherwise
   */
  static async deleteNotification(
    notificationId: Types.ObjectId,
    userId: Types.ObjectId
  ): Promise<boolean> {
    try {
      const result = await Notification.deleteOne({
        _id: notificationId,
        userId,
      });
      return result.deletedCount > 0;
    } catch (err) {
      console.error("[NotificationService] Failed to delete notification:", err);
      return false;
    }
  }

  /**
   * Get notifications for a user with pagination and filtering.
   * @param userId The ID of the user
   * @param options Filter and pagination options
   * @returns Array of notifications and total count
   */
  static async getNotifications(
    userId: Types.ObjectId,
    options: {
      page?: number;
      limit?: number;
      unreadOnly?: boolean;
      types?: NotificationType[];
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{ notifications: INotification[]; total: number }> {
    try {
      const {
        page = 1,
        limit = 20,
        unreadOnly = false,
        types,
        startDate,
        endDate,
      } = options;

      const skip = (page - 1) * limit;

      // Build filter
      const filter: any = { userId };
      if (unreadOnly) filter.read = false;
      if (types && types.length > 0) filter.type = { $in: types };
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = startDate;
        if (endDate) filter.createdAt.$lte = endDate;
      }

      // Query notifications
      const [notifications, total] = await Promise.all([
        Notification.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Notification.countDocuments(filter),
      ]);

      return { notifications: notifications as unknown as INotification[], total };
    } catch (err) {
      console.error("[NotificationService] Failed to get notifications:", err);
      return { notifications: [], total: 0 };
    }
  }
}