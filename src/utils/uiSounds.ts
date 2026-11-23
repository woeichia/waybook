const SOUND_STORAGE_KEY = 'waybook_sound_enabled_v1';

/** Six original, locally synthesized sounds. No downloaded audio or external APIs. */
export type UiSoundKind = 'tap' | 'navigate' | 'slide' | 'pickup' | 'whoosh' | 'confirm';
let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const win = window as typeof window & { webkitAudioContext?: typeof AudioContext };
  const AudioCtor = win.AudioContext ?? win.webkitAudioContext;
  if (!AudioCtor) return null;
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') sharedAudioContext = new AudioCtor();
  return sharedAudioContext;
}

export function readSoundEnabled(): boolean {
  try { return localStorage.getItem(SOUND_STORAGE_KEY) !== 'false'; }
  catch { return true; }
}
export function storeSoundEnabled(enabled: boolean): void {
  try { localStorage.setItem(SOUND_STORAGE_KEY, enabled ? 'true' : 'false'); }
  catch { /* Private mode may reject local storage. */ }
}

function tone(ctx: AudioContext, options: {
  start: number; duration: number; from: number; to: number; volume: number;
  wave: OscillatorType;
}) {
  const start = ctx.currentTime + options.start;
  const end = start + options.duration;
  const oscillator = ctx.createOscillator();
  const envelope = ctx.createGain();
  oscillator.type = options.wave;
  oscillator.frequency.setValueAtTime(Math.max(40, options.from), start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, options.to), end);
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, options.volume), start + Math.min(0.012, options.duration * 0.22));
  envelope.gain.exponentialRampToValueAtTime(0.0001, end);
  oscillator.connect(envelope).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(end + 0.01);
}

/** Short, filtered noise to imitate paper movement without sharp digital clicks. */
function paper(ctx: AudioContext, options: {start: number; duration: number; volume: number; filterFrom: number; filterTo: number}) {
  const sr = ctx.sampleRate;
  const size = Math.ceil(sr * options.duration);
  const buffer = ctx.createBuffer(1, size, sr);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) samples[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  const begin = ctx.currentTime + options.start;
  const end = begin + options.duration;
  filter.frequency.setValueAtTime(options.filterFrom, begin);
  filter.frequency.exponentialRampToValueAtTime(options.filterTo, end);
  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(0.0001, begin);
  envelope.gain.linearRampToValueAtTime(options.volume, begin + Math.min(0.025, options.duration * 0.24));
  envelope.gain.exponentialRampToValueAtTime(0.0001, end);
  source.connect(filter).connect(envelope).connect(ctx.destination);
  source.start(begin);
  source.stop(end);
}

export async function playUiSound(
  kind: UiSoundKind,
  enabled: boolean = readSoundEnabled(),
  force = false
): Promise<boolean> {
  if (!force && !enabled) return false;
  const ctx = getAudioContext();
  if (!ctx) return false;
  try {
    if (ctx.state === 'suspended') await ctx.resume();
    if (ctx.state !== 'running') return false;
    switch (kind) {
      case 'tap':
        // Quiet paper contact, warmer and less sharp than the previous button click.
        paper(ctx,{start:0,duration:0.045,volume:0.035,filterFrom:1350,filterTo:550});
        tone(ctx,{start:0,duration:0.045,from:340,to:220,volume:0.035,wave:'sine'});
        break;
      case 'navigate':
        // The recognizable two-note day-navigation signal, at reduced volume.
        tone(ctx,{start:0,duration:0.09,from:440,to:440,volume:0.11,wave:'sine'});
        tone(ctx,{start:0.067,duration:0.13,from:554.37,to:554.37,volume:0.115,wave:'sine'});
        break;
      case 'slide':
        // Light paper swish for photo movement and gallery navigation.
        paper(ctx,{start:0,duration:0.09,volume:0.026,filterFrom:2000,filterTo:680});
        break;
      case 'pickup':
        // A tiny tactile lift / flick when the centered memory frame settles.
        paper(ctx,{start:0,duration:0.065,volume:0.028,filterFrom:750,filterTo:1900});
        tone(ctx,{start:0.008,duration:0.055,from:300,to:430,volume:0.038,wave:'sine'});
        break;
      case 'whoosh':
        // Soft airy dissolve for opening a memory in full screen.
        paper(ctx,{start:0,duration:0.23,volume:0.045,filterFrom:450,filterTo:1700});
        tone(ctx,{start:0.015,duration:0.19,from:260,to:460,volume:0.019,wave:'sine'});
        break;
      case 'confirm':
        // Existing warm confirmation chime.
        tone(ctx,{start:0,duration:0.1,from:523.25,to:523.25,volume:0.15,wave:'sine'});
        tone(ctx,{start:0.082,duration:0.17,from:659.25,to:659.25,volume:0.15,wave:'triangle'});
        break;
    }
    return true;
  } catch { return false; }
}
