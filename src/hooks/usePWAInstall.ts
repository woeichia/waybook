import { useSyncExternalStore } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}
// Capture the one-shot install event even while the family passcode gate is open.
// The header and onboarding share the same event, never prompt twice.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const mode = window.matchMedia('(display-mode: standalone)');
const standalone = () => mode.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
let installed = standalone();
let revision = 0;
const listeners = new Set<() => void>();
const emit = () => { revision++; listeners.forEach(fn => fn()); };
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferredPrompt = e as BeforeInstallPromptEvent; emit();
});
window.addEventListener('appinstalled', () => { installed = true; deferredPrompt = null; emit(); });
const refresh = () => { if (standalone() && !installed) { installed = true; deferredPrompt = null; emit(); } };
mode.addEventListener?.('change', refresh);
window.addEventListener('pageshow', refresh);
window.addEventListener('focus', refresh);
const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
async function install() {
  const prompt = deferredPrompt;
  if (!prompt) return false;
  deferredPrompt = null; emit();
  try {
    await prompt.prompt();
    const result = await prompt.userChoice;
    if (result.outcome === 'accepted') { installed = true; emit(); return true; }
  } catch { /* Browser may withdraw the one-shot prompt. Offer manual install instead. */ }
  return false;
}
export function usePWAInstall() {
  useSyncExternalStore(subscribe, () => revision);
  return { isInstallable: !!deferredPrompt, isInstalled: installed, isIOS: ios, install };
}
