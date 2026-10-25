import { useState, useEffect, useCallback, useRef } from "react";
import { useSocketEvent } from "@/lib/socket";
import { apiFetch } from "@/services/api";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { notifications as platformNotifications } from "@/platform";
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
  const { user } = useAuth();
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
  const notificationsRef = useRef<Notification[]>([]);
  const processedIdsRef = useRef<Set<string>>(new Set());
  const processedReadIdsRef = useRef<Set<string>>(new Set());

  const rememberId = (set: Set<string>, id: string) => {
    set.add(id);
    if (set.size > 500) {
      const toRemove = Array.from(set).slice(0, 100);
      toRemove.forEach((item) => set.delete(item));
    }
  };

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      notificationsRef.current = [];
      setNotifications([]);
      setUnreadCount(0);
      processedIdsRef.current.clear();
      processedReadIdsRef.current.clear();
      return;
    }
    try {
      const data = await apiFetch<{ notifications: Notification[]; total?: number; unreadCount?: number }>(
        "/notifications"
      );
      const list = (data.notifications ?? [])
        .map((n) => ({ ...n, _id: n._id || n.id || "" }))
        .filter((n) => Boolean(n._id));
      notificationsRef.current = list;
      for (const item of list) {
        rememberId(processedIdsRef.current, item._id);
        if (item.read) rememberId(processedReadIdsRef.current, item._id);
      }
      setNotifications(list);

      // Derive the count from the server when available; otherwise count only
      // the fetched unread items. Socket events must not decrement twice.
      const count = data.unreadCount ?? list.filter((n) => !n.read).length;
      setUnreadCount(count);
    } catch (err) {
      console.error("[useNotifications] Failed to fetch notifications:", err);
    }
  }, [user]);

  // Listen for new notifications via socket
  useSocketEvent("notification:new", (notification: any) => {
    if (!notification) return;

    // Personal notification events must identify their intended recipient and
    // carry a stable persisted ID. Never fan out unidentified alerts locally.
    if (!user?._id || !notification.userId || String(notification.userId) !== String(user._id)) {
      return;
    }

    const normId = String(notification._id || notification.id || "");
    if (!normId || processedIdsRef.current.has(normId)) {
      return;
    }
    rememberId(processedIdsRef.current, normId);

    const norm: Notification = { ...notification, _id: normId, read: Boolean(notification.read) };
    if (!notificationsRef.current.some((item) => item._id === normId)) {
      notificationsRef.current = [norm, ...notificationsRef.current];
      setNotifications(notificationsRef.current);
      if (!norm.read) setUnreadCount((prev) => prev + 1);
    }

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

    // 3. Trigger OS-level notification (Browser push or Windows native toast)
    platformNotifications.show({
      id: normId,
      title: norm.title,
      body: norm.message,
      sound: false,
      onClick: () => {
        window.dispatchEvent(
          new CustomEvent("stillworks:navigate-notification", { detail: norm })
        );
      },
    });
  });

  // Apply read transitions once per notification ID. The server event and the
  // local mutation response can represent the same transition.
  useSocketEvent("notification:updated", (updated: any) => {
    if (!updated) return;
    const normId = String(updated._id || updated.id || "");
    if (!normId) return;

    const current = notificationsRef.current.find((item) => item._id === normId);
    if (updated.read && current && !current.read && !processedReadIdsRef.current.has(normId)) {
      rememberId(processedReadIdsRef.current, normId);
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    notificationsRef.current = notificationsRef.current.map((item) =>
      item._id === normId ? { ...item, ...updated, _id: normId } : item
    );
    setNotifications(notificationsRef.current);
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
      const current = notificationsRef.current.find((item) => item._id === notificationId);
      if (current && !current.read && !processedReadIdsRef.current.has(notificationId)) {
        rememberId(processedReadIdsRef.current, notificationId);
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
      notificationsRef.current = notificationsRef.current.map((item) =>
        item._id === notificationId ? { ...item, read: true } : item
      );
      setNotifications(notificationsRef.current);
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
      for (const item of notificationsRef.current) {
        if (!item.read) rememberId(processedReadIdsRef.current, item._id);
      }
      notificationsRef.current = notificationsRef.current.map((item) => ({ ...item, read: true }));
      setNotifications(notificationsRef.current);
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
        const target = notificationsRef.current.find((item) => item._id === notificationId);
        notificationsRef.current = notificationsRef.current.filter((item) => item._id !== notificationId);
        setNotifications(notificationsRef.current);
        if (target && !target.read) setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        console.error("[useNotifications] Failed to delete notification:", err);
      }
    },
    [notifications]
  );

  // Initial fetch when user is authenticated
  useEffect(() => {
    if (user) {
      fetchNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [user, fetchNotifications]);

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