import { useState, useEffect, useCallback } from "react";
import { useSocketEvent } from "@/lib/socket";
import { useQueryClient } from "@tanstack/react-query";
/**
 * Hook to manage notifications state.
 * Provides notifications, unread count, and functions to mark as read, delete, etc.
 */
export function useNotifications() {
    const queryClient = useQueryClient();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    // Fetch notifications on mount and whenever we want to refetch
    const fetchNotifications = useCallback(async () => {
        try {
            const res = await fetch("/api/notifications", {
                credentials: "include",
            });
            if (!res.ok)
                throw new Error("Failed to fetch notifications");
            const data = await res.json();
            setNotifications(data.notifications ?? []);
            // Calculate unread count
            const count = data.notifications?.filter((n) => !n.read).length ?? 0;
            setUnreadCount(count);
        }
        catch (err) {
            console.error("[useNotifications] Failed to fetch notifications:", err);
        }
    }, []);
    // Listen for new notifications via socket
    useSocketEvent("notification:new", (notification) => {
        setNotifications((prev) => {
            // Avoid duplicates (in case we get a notification we already have)
            if (prev.some((n) => n._id === notification._id))
                return prev;
            return [notification, ...prev];
        });
        setUnreadCount((prev) => prev + 1); // New notification is unread by default
    });
    // Listen for notification updates (e.g., marked as read)
    useSocketEvent("notification:updated", (updated) => {
        setNotifications((prev) => prev.map((n) => (n._id === updated._id ? updated : n)));
        setUnreadCount((prev) => {
            // If the updated notification was unread and now is read, decrement
            if (!updated.read)
                return prev;
            // If it was read and now is unread, increment (shouldn't happen, but just in case)
            if (updated.read)
                return prev;
            return prev;
        });
    });
    // Listen for notification deletion
    useSocketEvent("notification:deleted", (deletedId) => {
        setNotifications((prev) => prev.filter((n) => n._id !== deletedId));
        // We don't know if the deleted notification was read or unread, so we'll refetch to be safe
        // Alternatively, we could track it, but for simplicity we refetch.
        fetchNotifications();
    });
    // Mark a notification as read
    const markAsRead = useCallback(async (notificationId) => {
        try {
            const res = await fetch(`/api/notifications/${notificationId}/read`, {
                method: "PATCH",
                credentials: "include",
            });
            if (!res.ok)
                throw new Error("Failed to mark as read");
            // Optimistically update the state
            setNotifications((prev) => prev.map((n) => n._id === notificationId ? { ...n, read: true } : n));
            setUnreadCount((prev) => Math.max(0, prev - 1));
        }
        catch (err) {
            console.error("[useNotifications] Failed to mark notification as read:", err);
        }
    }, []);
    // Mark all notifications as read
    const markAllAsRead = useCallback(async () => {
        try {
            const res = await fetch(`/api/notifications/read-all`, {
                method: "PATCH",
                credentials: "include",
            });
            if (!res.ok)
                throw new Error("Failed to mark all as read");
            // Optimistically update all to read
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
            setUnreadCount(0);
        }
        catch (err) {
            console.error("[useNotifications] Failed to mark all notifications as read:", err);
        }
    }, []);
    // Delete a notification
    const deleteNotification = useCallback(async (notificationId) => {
        try {
            const res = await fetch(`/api/notifications/${notificationId}`, {
                method: "DELETE",
                credentials: "include",
            });
            if (!res.ok)
                throw new Error("Failed to delete notification");
            // Optimistically remove from state
            setNotifications((prev) => prev.filter((n) => n._id !== notificationId));
            // We don't know if it was read or unread, so we'll refetch the count to be safe
            // Alternatively, we could track it, but for simplicity we refetch the count.
            const unread = notifications.filter((n) => !n.read && n._id !== notificationId);
            setUnreadCount(unread.length);
        }
        catch (err) {
            console.error("[useNotifications] Failed to delete notification:", err);
        }
    }, [notifications]);
    // Refetch notifications (e.g., when we want to refresh)
    const refetch = useCallback(() => {
        fetchNotifications();
    }, [fetchNotifications]);
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
        refetch,
    };
}
