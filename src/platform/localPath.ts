// ---------------------------------------------------------------------------
// Local Path Opener & Clipboard Fallback (Web + Electron Parity)
// ---------------------------------------------------------------------------

import { isElectron } from "./index";

export interface OpenPathResult {
  opened: boolean;
  copied: boolean;
  message: string;
}

/**
 * Opens a local file or directory path in Electron, or copies it to clipboard in Web.
 */
export async function openLocalPath(rawPath: string): Promise<OpenPathResult> {
  const cleanPath = (rawPath || "").trim();
  if (!cleanPath) {
    return {
      opened: false,
      copied: false,
      message: "No file or folder path specified",
    };
  }

  if (isElectron() && window.electronAPI?.openPath) {
    try {
      const res = await window.electronAPI.openPath(cleanPath);
      if (res.success) {
        return {
          opened: true,
          copied: false,
          message: "Path opened successfully",
        };
      } else {
        // Fall back to copying if the file doesn't exist on this machine
        await copyToClipboard(cleanPath);
        return {
          opened: false,
          copied: true,
          message: res.error || "Unable to open path directly. Path copied to clipboard.",
        };
      }
    } catch {
      await copyToClipboard(cleanPath);
      return {
        opened: false,
        copied: true,
        message: "Failed to open local path. Path copied to clipboard.",
      };
    }
  }

  // Web fallback: write to clipboard
  const copied = await copyToClipboard(cleanPath);
  return {
    opened: false,
    copied,
    message: copied
      ? "Local path copied to clipboard (Desktop app required to open directly)"
      : "Could not copy path to clipboard",
  };
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.warn("[platform] Clipboard copy failed:", err);
    return false;
  }
}
