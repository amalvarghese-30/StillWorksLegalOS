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

/**
 * Play a crisp, pleasant chime (harmonic two-tone D5 -> A5).
 * Safe against browser autoplay policy restrictions.
 */
export function playNotificationSound(): void {
  if (!isNotificationSoundEnabled()) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Primary bell tone
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
  } catch (err) {
    console.debug("[sound] Notification chime suppressed:", err);
  }
}
