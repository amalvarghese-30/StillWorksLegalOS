// ---------------------------------------------------------------------------
// StillWorks LegalOS — Cross-Platform Download Provider
// ---------------------------------------------------------------------------
// Adapts file saving between Web (Browser Blob download anchor) and
// Windows Desktop EXE (Native OS Save Dialog with controlled file writing).
// ---------------------------------------------------------------------------

import { isElectron } from "./index";

export interface DownloadOptions {
  filename: string;
  data: Blob | ArrayBuffer | Uint8Array | string;
  mimeType?: string;
}

export interface DownloadResult {
  success: boolean;
  canceled?: boolean;
  filePath?: string;
  error?: string;
}

export interface DownloadProvider {
  download(options: DownloadOptions): Promise<DownloadResult>;
}

// ---------------------------------------------------------------------------
// 1. Browser Download Provider (Web)
// ---------------------------------------------------------------------------
class BrowserDownloadProvider implements DownloadProvider {
  async download(options: DownloadOptions): Promise<DownloadResult> {
    try {
      if (typeof window === "undefined" || typeof document === "undefined") {
        return { success: false, error: "DOM environment unavailable" };
      }

      let blob: Blob;
      if (options.data instanceof Blob) {
        blob = options.data;
      } else if (typeof options.data === "string") {
        blob = new Blob([options.data], { type: options.mimeType || "text/plain;charset=utf-8" });
      } else {
        blob = new Blob([options.data], { type: options.mimeType || "application/octet-stream" });
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = options.filename;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up object URL after small timeout to ensure browser starts download
      setTimeout(() => URL.revokeObjectURL(url), 10_000);

      return { success: true };
    } catch (err) {
      const error = err instanceof Error ? err.message : "Browser download failed";
      return { success: false, error };
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Electron Download Provider (Windows Desktop EXE)
// ---------------------------------------------------------------------------
class ElectronDownloadProvider implements DownloadProvider {
  async download(options: DownloadOptions): Promise<DownloadResult> {
    const electronApi = typeof window !== "undefined" ? window.electronAPI : undefined;

    // Use native save dialog if available
    if (electronApi?.saveFile) {
      try {
        let buffer: Uint8Array;
        if (options.data instanceof Uint8Array) {
          buffer = options.data;
        } else if (options.data instanceof ArrayBuffer) {
          buffer = new Uint8Array(options.data);
        } else if (options.data instanceof Blob) {
          const ab = await options.data.arrayBuffer();
          buffer = new Uint8Array(ab);
        } else if (typeof options.data === "string") {
          buffer = new TextEncoder().encode(options.data);
        } else {
          return { success: false, error: "Unsupported data format for desktop save" };
        }

        const result = await electronApi.saveFile({
          defaultFilename: options.filename,
          buffer: Array.from(buffer),
          mimeType: options.mimeType,
        });

        if (result.canceled) {
          return { success: false, canceled: true };
        }
        if (result.error) {
          return { success: false, error: result.error };
        }
        return { success: true, filePath: result.filePath };
      } catch (err) {
        console.warn("[Desktop Download] Native saveFile failed, falling back to browser download:", err);
      }
    }

    // Fallback to browser anchor download if Electron API isn't present
    const browserProvider = new BrowserDownloadProvider();
    return browserProvider.download(options);
  }
}

// Export singleton instance based on active runtime
export const downloads: DownloadProvider = isElectron()
  ? new ElectronDownloadProvider()
  : new BrowserDownloadProvider();
