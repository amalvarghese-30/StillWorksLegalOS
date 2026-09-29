// ---------------------------------------------------------------------------
// StillWorks LegalOS — Cross-Platform Storage Provider
// ---------------------------------------------------------------------------
// Encapsulates credential vaulting and local storage between Web and Desktop.
// On Web: Refresh tokens are kept in secure httpOnly cookies.
// On Desktop: Refresh tokens are stored via Electron safeStorage (OS-level encryption).
// ---------------------------------------------------------------------------

import { isElectron } from "./index";

export interface StorageProvider {
  // Sensitive token management
  saveRefreshToken(token: string): Promise<boolean>;
  getRefreshToken(): Promise<string | null>;
  clearRefreshToken(): Promise<void>;

  // Standard client preferences
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

// ---------------------------------------------------------------------------
// 1. Browser Storage Provider (Web)
// ---------------------------------------------------------------------------
class BrowserStorageProvider implements StorageProvider {
  async saveRefreshToken(_token: string): Promise<boolean> {
    // In web browsers, refresh tokens are handled securely via httpOnly cookies
    // set directly by the backend to prevent XSS exfiltration.
    return true;
  }

  async getRefreshToken(): Promise<string | null> {
    // Web relies on the backend reading the httpOnly cookie on /auth/refresh
    return null;
  }

  async clearRefreshToken(): Promise<void> {
    // Cleared by backend on /auth/logout
  }

  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* ignore storage quota errors */
    }
  }

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Electron Storage Provider (Windows Desktop EXE)
// ---------------------------------------------------------------------------
class ElectronStorageProvider implements StorageProvider {
  async saveRefreshToken(token: string): Promise<boolean> {
    const electronApi = typeof window !== "undefined" ? window.electronAPI : undefined;
    if (electronApi?.saveRefreshToken) {
      try {
        const res = await electronApi.saveRefreshToken(token);
        return res?.success !== false;
      } catch (err) {
        console.error("[Desktop Storage] saveRefreshToken failed:", err);
      }
    }
    return false;
  }

  async getRefreshToken(): Promise<string | null> {
    const electronApi = typeof window !== "undefined" ? window.electronAPI : undefined;
    if (electronApi?.getRefreshToken) {
      try {
        const res = await electronApi.getRefreshToken();
        return res?.token ?? null;
      } catch (err) {
        console.error("[Desktop Storage] getRefreshToken failed:", err);
      }
    }
    return null;
  }

  async clearRefreshToken(): Promise<void> {
    const electronApi = typeof window !== "undefined" ? window.electronAPI : undefined;
    if (electronApi?.clearRefreshToken) {
      try {
        await electronApi.clearRefreshToken();
      } catch (err) {
        console.error("[Desktop Storage] clearRefreshToken failed:", err);
      }
    }
  }

  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  }

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

// Export singleton instance based on active runtime
export const storage: StorageProvider = isElectron()
  ? new ElectronStorageProvider()
  : new BrowserStorageProvider();
