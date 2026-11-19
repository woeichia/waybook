const SOUND_STORAGE_KEY = 'waybook_sound_enabled_v1';

export type UiSoundKind = 'tap' | 'navigate' | 'slide' | 'confirm';

let sharedAudioContext: AudioContext | null = null;

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return win.AudioContext ?? win.webkitAudioContext ?? null;
}

function getOrCreateAudioContext(): AudioContext | null {
  const Ctor = getAudioContextConstructor();
  if (!Ctor) return null;
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new Ctor();
  }
  return sharedAudioContext;
}

export function readSoundEnabled(): boolean {
  try {
    const raw = localStorage.getItem(SOUND_STORAGE_KEY);
    if (raw === null) return true;
    return raw !== 'false';
  } catch {
    return true;
  }
}

export function storeSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(SOUND_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // Ignore storage errors in restricted browsing modes
  }
}

function scheduleTone(
  ctx: AudioContext,
  options: {
    startOffset: number;
    duration: number;
    freqStart: number;
    freqEnd: number;
    gainPeak: number;
    type: OscillatorType;
  }
): void {
  const startTime = ctx.currentTime + options.startOffset;
  const endTime = startTime + options.duration;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = options.type;
  osc.frequency.setValueAtTime(options.freqStart, startTime);
  if (options.freqEnd !== options.freqStart) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, options.freqEnd), endTime);
  }

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(options.gainPeak, startTime + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(endTime + 0.01);
}

export async function playUiSound(
  kind: UiSoundKind,
  enabled: boolean = readSoundEnabled(),
  force: boolean = false
): Promise<boolean> {
  if (!force && !enabled) return false;

  const ctx = getOrCreateAudioContext();
  if (!ctx) return false;

  try {
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    if (ctx.state !== 'running') {
      return false;
    }

    switch (kind) {
      case 'tap':
        // Gentle paper-like tactile click
        scheduleTone(ctx, {
          startOffset: 0.004,
          duration: 0.055,
          freqStart: 540,
          freqEnd: 320,
          gainPeak: 0.16,
          type: 'triangle',
        });
        break;

      case 'navigate':
        // Distinct soft two-note interval for switching itinerary days
        scheduleTone(ctx, {
          startOffset: 0.004,
          duration: 0.085,
          freqStart: 440,
          freqEnd: 440,
          gainPeak: 0.14,
          type: 'sine',
        });
        scheduleTone(ctx, {
          startOffset: 0.068,
          duration: 0.13,
          freqStart: 554.37,
          freqEnd: 554.37,
          gainPeak: 0.15,
          type: 'sine',
        });
        break;

      case 'slide':
        // Light tick for photo gallery navigation
        scheduleTone(ctx, {
          startOffset: 0.003,
          duration: 0.036,
          freqStart: 860,
          freqEnd: 600,
          gainPeak: 0.12,
          type: 'sine',
        });
        break;

      case 'confirm':
        // Warm chime for test audio & enabling sound
        scheduleTone(ctx, {
          startOffset: 0.004,
          duration: 0.1,
          freqStart: 523.25,
          freqEnd: 523.25,
          gainPeak: 0.17,
          type: 'sine',
        });
        scheduleTone(ctx, {
          startOffset: 0.082,
          duration: 0.17,
          freqStart: 659.25,
          freqEnd: 659.25,
          gainPeak: 0.18,
          type: 'triangle',
        });
        break;
    }

    return true;
  } catch {
    return false;
  }
}
