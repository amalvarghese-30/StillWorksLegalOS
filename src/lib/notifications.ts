import { useState, useEffect, useCallback } from "react";
import { useSocketEvent } from "@/lib/socket";
import { apiFetch } from "@/services/api";
import { toast } from "sonner";
import {
  playNotificationSound,
  isNotificationSoundEnabled,
  setNotificationSoundEnabled,
} from "@/lib/sound";

// Standard notification record shape
export interface Notification {
  _id: string;
  id?: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string; // ISO string
  relatedId?: string;
  relatedModel?: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Hook to manage notifications state.
 * Provides notifications, unread count, sound controls, and socket-driven live alerts.
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [soundEnabled, setSoundEnabledState] = useState(() => isNotificationSoundEnabled());

  const toggleSound = useCallback(() => {
    const next = !soundEnabled;
    setSoundEnabledState(next);
    setNotificationSoundEnabled(next);
    if (next) {
      playNotificationSound();
    }
  }, [soundEnabled]);

  // Fetch notifications on mount and whenever we want to refetch
  const fetchNotifications = useCallback(async () => {
    try {
      const data = await apiFetch<{ notifications: Notification[]; total?: number; unreadCount?: number }>(
        "/notifications"
      );
      const list = (data.notifications ?? []).map((n) => ({
        ...n,
        _id: n._id || n.id || "",
      }));
      setNotifications(list);

      // Calculate unread count
      const count = data.unreadCount ?? list.filter((n) => !n.read).length;
      setUnreadCount(count);
    } catch (err) {
      console.error("[useNotifications] Failed to fetch notifications:", err);
    }
  }, []);

  // Listen for new notifications via socket
  useSocketEvent("notification:new", (notification: any) => {
    if (!notification) return;
    const normId = notification._id || notification.id || String(Date.now());
    const norm: Notification = {
      ...notification,
      _id: normId,
      read: false,
    };

    setNotifications((prev) => {
      if (prev.some((n) => n._id === normId)) return prev;
      return [norm, ...prev];
    });
    setUnreadCount((prev) => prev + 1);

    // 1. Play auditory chime pop
    playNotificationSound();

    // 2. Trigger rich live toast popup
    toast(norm.title, {
      description: norm.message,
      action: {
        label: "Open",
        onClick: () => {
          window.dispatchEvent(
            new CustomEvent("stillworks:navigate-notification", { detail: norm })
          );
        },
      },
      duration: 6000,
    });
  });

  // Listen for notification updates (e.g., marked as read)
  useSocketEvent("notification:updated", (updated: any) => {
    if (!updated) return;
    const normId = updated._id || updated.id;
    setNotifications((prev) =>
      prev.map((n) => (n._id === normId ? { ...n, ...updated, _id: normId } : n))
    );
    if (updated.read) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  });

  // Listen for notification deletion
  useSocketEvent("notification:deleted", (deletedId: string) => {
    setNotifications((prev) => prev.filter((n) => n._id !== deletedId));
    fetchNotifications();
  });

  // Mark a notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await apiFetch(`/notifications/${notificationId}/read`, {
        method: "PATCH",
      });
      setNotifications((prev) =>
        prev.map((n) => (n._id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("[useNotifications] Failed to mark notification as read:", err);
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      await apiFetch("/notifications/read-all", {
        method: "PATCH",
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("[useNotifications] Failed to mark all notifications as read:", err);
    }
  }, []);

  // Delete a notification
  const deleteNotification = useCallback(
    async (notificationId: string) => {
      try {
        await apiFetch(`/notifications/${notificationId}`, {
          method: "DELETE",
        });
        setNotifications((prev) => prev.filter((n) => n._id !== notificationId));
        setUnreadCount((prev) => {
          const target = notifications.find((n) => n._id === notificationId);
          return target && !target.read ? Math.max(0, prev - 1) : prev;
        });
      } catch (err) {
        console.error("[useNotifications] Failed to delete notification:", err);
      }
    },
    [notifications]
  );

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refetch: fetchNotifications,
    soundEnabled,
    toggleSound,
  };
}