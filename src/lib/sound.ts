/**
 * Professional Notification Sound Utility
 * Uses the Web Audio API to synthesize smooth, executive chime tones.
 * Works completely offline without needing audio asset files.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export type NotificationSoundTone = "chime" | "bell" | "ping";

/** Check if notification sound is enabled in local settings */
export function isNotificationSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem("stillworks_sound_enabled") !== "false";
}

/** Toggle notification sound on or off */
export function setNotificationSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("stillworks_sound_enabled", enabled ? "true" : "false");
}

/** Get selected notification sound tone */
export function getNotificationSoundTone(): NotificationSoundTone {
  if (typeof window === "undefined") return "chime";
  const stored = localStorage.getItem("stillworks_sound_tone");
  if (stored === "bell" || stored === "ping" || stored === "chime") {
    return stored;
  }
  return "chime";
}

/** Set selected notification sound tone */
export function setNotificationSoundTone(tone: NotificationSoundTone): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("stillworks_sound_tone", tone);
}

/**
 * Play a crisp synthesized tone based on active or provided sound tone.
 * Safe against browser autoplay policy restrictions.
 */
export function playNotificationSound(overrideTone?: NotificationSoundTone): void {
  if (!isNotificationSoundEnabled()) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const tone = overrideTone || getNotificationSoundTone();
    const now = ctx.currentTime;

    if (tone === "bell") {
      // Warm tubular bell tone
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now); // A5
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.25, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.65);
    } else if (tone === "ping") {
      // Short high crisp ping
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1046.5, now); // C6
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    } else {
      // Primary executive chime (harmonic two-tone D5 -> A5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880.0, now + 0.08); // A5

      gain1.gain.setValueAtTime(0.0001, now);
      gain1.gain.exponentialRampToValueAtTime(0.28, now + 0.025);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      // Harmonic overtone for brilliance
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();

      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1174.66, now + 0.03); // D6
      osc2.frequency.exponentialRampToValueAtTime(1760.0, now + 0.11); // A6

      gain2.gain.setValueAtTime(0.0001, now + 0.03);
      gain2.gain.exponentialRampToValueAtTime(0.12, now + 0.06);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.36);

      osc2.start(now + 0.03);
      osc2.stop(now + 0.39);
    }
  } catch (err) {
    console.debug("[sound] Notification chime suppressed:", err);
  }
}
