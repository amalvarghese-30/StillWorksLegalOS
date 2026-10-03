// ---------------------------------------------------------------------------
// StillWorks LegalOS — Cross-Platform Notification Provider
// ---------------------------------------------------------------------------
// Adapts notification delivery between Web (Browser Notification API + In-App chime)
// and Windows Desktop EXE (Native Windows Toast via IPC + In-App chime).
// Includes strict deduplication across socket reconnects and dual triggers.
// ---------------------------------------------------------------------------

import { isElectron } from "./index";

export interface NotificationPayload {
  id?: string;
  title: string;
  body: string;
  sound?: boolean;
  tag?: string;
  onClick?: () => void;
}

// In-memory deduplication cache: retains notification IDs for 30s to prevent
// duplicate toasts during network retries or rapid socket events.
const recentNotificationCache = new Set<string>();

function isDuplicate(id?: string): boolean {
  if (!id) return false;
  if (recentNotificationCache.has(id)) return true;
  recentNotificationCache.add(id);
  setTimeout(() => recentNotificationCache.delete(id), 30_000);
  return false;
}

/**
 * Synthesizes a clean legal alert chime via Web Audio API.
 * Guarantees zero missing audio asset dependencies on both Web and Electron.
 */
export function playAlertBeep(frequency = 784, duration = 0.28): void {
  try {
    if (typeof window === "undefined") return;
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    // Pleasant dual-frequency sequence: root -> third
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(frequency * 1.25, ctx.currentTime + duration * 0.5);

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch (err) {
    // Non-critical audio error (e.g. user has not interacted with document yet)
    console.debug("[Audio] Notification sound skipped:", err);
  }
}

export interface NotificationProvider {
  requestPermission(): Promise<boolean>;
  hasPermission(): boolean;
  show(payload: NotificationPayload): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// 1. Browser Notification Provider (Web)
// ---------------------------------------------------------------------------
class BrowserNotificationProvider implements NotificationProvider {
  hasPermission(): boolean {
    if (typeof window === "undefined" || !("Notification" in window)) return false;
    return Notification.permission === "granted";
  }

  async requestPermission(): Promise<boolean> {
    if (typeof window === "undefined" || !("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    try {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    } catch {
      return false;
    }
  }

  async show(payload: NotificationPayload): Promise<boolean> {
    if (isDuplicate(payload.id)) return false;

    // Optional audio alert
    if (payload.sound !== false) {
      playAlertBeep();
    }

    if (typeof window === "undefined" || !("Notification" in window)) {
      return false;
    }

    // Attempt permission request if still in default state
    if (Notification.permission === "default") {
      await this.requestPermission();
    }

    if (Notification.permission === "granted") {
      try {
        const notif = new Notification(payload.title, {
          body: payload.body,
          icon: "/icon.png",
          ...(payload.tag || payload.id ? { tag: payload.tag || payload.id } : {}),
        });
        if (payload.onClick) {
          notif.onclick = () => {
            window.focus();
            payload.onClick?.();
          };
        }
        return true;
      } catch (err) {
        console.warn("[Web Notification] Failed to display:", err);
        return false;
      }
    }

    return false;
  }
}

// ---------------------------------------------------------------------------
// 2. Electron Notification Provider (Windows Desktop EXE)
// ---------------------------------------------------------------------------
class ElectronNotificationProvider implements NotificationProvider {
  hasPermission(): boolean {
    return true; // Native desktop apps always have system notification capability
  }

  async requestPermission(): Promise<boolean> {
    return true;
  }

  async show(payload: NotificationPayload): Promise<boolean> {
    if (isDuplicate(payload.id)) return false;

    // Optional audio alert
    if (payload.sound !== false) {
      playAlertBeep();
    }

    const electronApi = typeof window !== "undefined" ? window.electronAPI : undefined;
    if (electronApi?.showNotification) {
      try {
        const result = await electronApi.showNotification({
          title: payload.title,
          body: payload.body,
          sound: false, // We already played the Web Audio chime
          ...(payload.tag || payload.id ? { tag: payload.tag || payload.id } : {}),
        });
        return result.shown;
      } catch (err) {
        console.warn("[Desktop Notification] IPC showNotification failed:", err);
      }
    }

    // Fallback to browser Notification if Electron IPC is unavailable
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(payload.title, { body: payload.body, ...(payload.tag ? { tag: payload.tag } : {}) });
        return true;
      } catch {
        /* ignore */
      }
    }

    return false;
  }
}

// Export singleton instance based on active runtime
export const notifications: NotificationProvider = isElectron()
  ? new ElectronNotificationProvider()
  : new BrowserNotificationProvider();

export function getNotificationPermissionStatus(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}
