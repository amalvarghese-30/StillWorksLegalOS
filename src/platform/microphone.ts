// ---------------------------------------------------------------------------
// StillWorks LegalOS — Cross-Platform Microphone & Audio Provider
// ---------------------------------------------------------------------------
// Manages audio recording streams and microphone permissions for LegalOS Voice Notes.
// Handles device access across Modern Browsers and Windows Desktop Electron.
// ---------------------------------------------------------------------------

export interface AudioStreamResult {
  stream: MediaStream | null;
  error?: string;
  isPermissionDenied?: boolean;
}

export interface MicrophoneProvider {
  isSupported(): boolean;
  requestAudioStream(): Promise<AudioStreamResult>;
}

class CrossPlatformMicrophoneProvider implements MicrophoneProvider {
  isSupported(): boolean {
    return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
  }

  async requestAudioStream(): Promise<AudioStreamResult> {
    if (!this.isSupported()) {
      return {
        stream: null,
        error: "Audio recording is not supported in this environment.",
      };
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      return { stream };
    } catch (err) {
      const error = err as Error;
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        return {
          stream: null,
          isPermissionDenied: true,
          error: "Microphone permission was denied. Please allow microphone access in system settings.",
        };
      }
      if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        return {
          stream: null,
          error: "No microphone hardware detected on this device.",
        };
      }
      if (error.name === "NotReadableError" || error.name === "TrackStartError") {
        return {
          stream: null,
          error: "The microphone is currently in use by another application.",
        };
      }
      return {
        stream: null,
        error: error.message || "Failed to initialize microphone.",
      };
    }
  }
}

export const microphone: MicrophoneProvider = new CrossPlatformMicrophoneProvider();
