// ---------------------------------------------------------------------------
// StillWorks LegalOS — Cross-Platform App Lifecycle Provider
// ---------------------------------------------------------------------------
// Exposes application lifecycle information, version metadata, and desktop tray
// notification controls while providing clean no-ops for browser environments.
// ---------------------------------------------------------------------------

import { isElectron } from "./index";

export interface AppLifecycleProvider {
  getVersion(): Promise<string>;
  isDev(): Promise<boolean>;
  isNotificationsPaused(): Promise<boolean>;
  setNotificationsPaused(paused: boolean): Promise<boolean>;
}

class CrossPlatformLifecycleProvider implements AppLifecycleProvider {
  async getVersion(): Promise<string> {
    const electronApi = typeof window !== "undefined" ? window.electronAPI : undefined;
    if (electronApi?.getVersion) {
      try {
        return await electronApi.getVersion();
      } catch {
        /* ignore */
      }
    }
    return "1.0.0";
  }

  async isDev(): Promise<boolean> {
    const electronApi = typeof window !== "undefined" ? window.electronAPI : undefined;
    if (electronApi?.isDev) {
      try {
        return await electronApi.isDev();
      } catch {
        /* ignore */
      }
    }
    return import.meta.env.DEV;
  }

  async isNotificationsPaused(): Promise<boolean> {
    if (!isElectron()) return false;
    const electronApi = typeof window !== "undefined" ? window.electronAPI : undefined;
    if (electronApi?.isNotificationsPaused) {
      try {
        return await electronApi.isNotificationsPaused();
      } catch {
        return false;
      }
    }
    return false;
  }

  async setNotificationsPaused(paused: boolean): Promise<boolean> {
    if (!isElectron()) return false;
    const electronApi = typeof window !== "undefined" ? window.electronAPI : undefined;
    if (electronApi?.setNotificationsPaused) {
      try {
        const res = await electronApi.setNotificationsPaused(paused);
        return res.success;
      } catch {
        return false;
      }
    }
    return false;
  }
}

export const appLifecycle: AppLifecycleProvider = new CrossPlatformLifecycleProvider();
