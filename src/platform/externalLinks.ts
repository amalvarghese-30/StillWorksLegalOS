// ---------------------------------------------------------------------------
// StillWorks LegalOS — Cross-Platform External Link & Phone Provider
// ---------------------------------------------------------------------------
// Adapts URL and phone navigation between Web (window.open / anchor tel:)
// and Windows Desktop EXE (Electron shell.openExternal with protocol whitelisting).
// Provides seamless phone-number clipboard fallback when no dialer is registered.
// ---------------------------------------------------------------------------

import { isElectron } from "./index";

const ALLOWED_PROTOCOLS = ["https:", "http:", "mailto:", "tel:"];

export interface ExternalLinkResult {
  success: boolean;
  copiedToClipboard?: boolean;
  error?: string;
}

export interface ExternalLinkProvider {
  open(url: string): Promise<ExternalLinkResult>;
  dialPhone(phone: string): Promise<ExternalLinkResult>;
  copyToClipboard(text: string): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// 1. Browser External Link Provider (Web)
// ---------------------------------------------------------------------------
class BrowserExternalLinkProvider implements ExternalLinkProvider {
  async copyToClipboard(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      // Legacy fallback
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      const success = document.execCommand("copy");
      document.body.removeChild(textArea);
      return success;
    } catch {
      return false;
    }
  }

  async open(rawUrl: string): Promise<ExternalLinkResult> {
    try {
      const parsed = new URL(rawUrl);
      if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
        return { success: false, error: `Protocol ${parsed.protocol} is not permitted.` };
      }
      if (parsed.protocol === "tel:" || parsed.protocol === "mailto:") {
        window.location.href = rawUrl;
        return { success: true };
      }
      window.open(rawUrl, "_blank", "noopener,noreferrer");
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  async dialPhone(phoneNumber: string): Promise<ExternalLinkResult> {
    const cleaned = phoneNumber.replace(/[^+\d]/g, "");
    if (!cleaned) return { success: false, error: "Invalid phone number" };
    // Attempt standard tel: protocol
    window.location.href = `tel:${cleaned}`;
    // Also copy to clipboard so the user has the number handy if browser doesn't have dialer
    await this.copyToClipboard(cleaned);
    return { success: true, copiedToClipboard: true };
  }
}

// ---------------------------------------------------------------------------
// 2. Electron External Link Provider (Windows Desktop EXE)
// ---------------------------------------------------------------------------
class ElectronExternalLinkProvider implements ExternalLinkProvider {
  async copyToClipboard(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async open(rawUrl: string): Promise<ExternalLinkResult> {
    try {
      const parsed = new URL(rawUrl);
      if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
        return { success: false, error: `Protocol ${parsed.protocol} is not permitted.` };
      }
      const electronApi = typeof window !== "undefined" ? window.electronAPI : undefined;
      if (electronApi?.openExternal) {
        const res = await electronApi.openExternal(rawUrl);
        return { success: res.success, error: res.error };
      }
      // Fallback
      window.open(rawUrl, "_blank", "noopener,noreferrer");
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  async dialPhone(phoneNumber: string): Promise<ExternalLinkResult> {
    const cleaned = phoneNumber.replace(/[^+\d]/g, "");
    if (!cleaned) return { success: false, error: "Invalid phone number" };
    const telUrl = `tel:${cleaned}`;
    const electronApi = typeof window !== "undefined" ? window.electronAPI : undefined;
    let openError: string | undefined;
    if (electronApi?.openExternal) {
      const res = await electronApi.openExternal(telUrl);
      opened = res.success;
      openError = res.error;
    }
    // Always copy to clipboard on desktop so the user can easily paste it into softphone/WhatsApp
    const copied = await this.copyToClipboard(cleaned);
    return { success: opened, copiedToClipboard: copied, error: openError };
  }
}

// Export singleton instance based on active runtime
export const externalLinks: ExternalLinkProvider = isElectron()
  ? new ElectronExternalLinkProvider()
  : new BrowserExternalLinkProvider();
