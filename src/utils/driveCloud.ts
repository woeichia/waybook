import type { ItineraryData } from '../types/itinerary';

/** Public cloud snapshots contain only references to image files, not binary images. */
export type CloudSnapshot = { version: number; updatedAt: string; itinerary: ItineraryData; galleries: Record<string, string[]> };
export const CLOUD_URL = (import.meta.env.VITE_WAYBOOK_APPS_SCRIPT_URL || '').trim();
export const GOOGLE_CLIENT_ID = (import.meta.env.VITE_WAYBOOK_GOOGLE_CLIENT_ID || '').trim();

// Apps Script ContentService redirects do not reliably expose CORS headers. JSONP is used
// exclusively for public, read-only state and image requests. Never pass credentials to it.
export function cloudRead<T>(params: Record<string, string>, timeout = 20000): Promise<T> {
  if (!CLOUD_URL) return Promise.reject(new Error('尚未設定 Apps Script URL'));
  return new Promise((resolve, reject) => {
    const name = `__waybook_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const root = window as unknown as Record<string, unknown>;
    const timer = window.setTimeout(() => finish(new Error('Google Drive 讀取逾時')), timeout);
    function finish(error?: Error, result?: T) {
      clearTimeout(timer); script.remove(); delete root[name];
      if (error) reject(error); else resolve(result as T);
    }
    root[name] = (data: { ok: boolean; data?: T; error?: string }) => {
      if (!data?.ok) finish(new Error(data?.error || '雲端讀取失敗'));
      else finish(undefined, data.data);
    };
    script.onerror = () => finish(new Error('無法連接 Apps Script，請檢查部署網址與權限'));
    const url = new URL(CLOUD_URL);
    url.searchParams.set('action', params.action || 'snapshot');
    for (const [key, value] of Object.entries(params)) if (key !== 'action') url.searchParams.set(key, value);
    url.searchParams.set('callback', name);
    script.src = url.toString();
    document.head.appendChild(script);
  });
}

export function cloudWrite<T>(action: string, data: unknown, idToken: string): Promise<T> {
  if (!CLOUD_URL) return Promise.reject(new Error('尚未設定 Apps Script URL'));
  return new Promise((resolve, reject) => {
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const frame = document.createElement('iframe');
    const form = document.createElement('form');
    frame.name = `waybook_upload_${requestId}`;
    frame.style.display = 'none'; form.style.display = 'none';
    form.method = 'POST'; form.action = CLOUD_URL; form.target = frame.name;
    const field = document.createElement('input'); field.type = 'hidden'; field.name = 'payload';
    field.value = JSON.stringify({ requestId, action, idToken, data }); form.appendChild(field);
    const timer = window.setTimeout(() => done(new Error('雲端寫入逾時，請查看雲端版本後再重試')), 60000);
    const onMessage = (event: MessageEvent) => {
      if (!/^https:\/\/(?:[a-z0-9-]+\.)*(?:googleusercontent\.com|google\.com)$/i.test(event.origin)) return;
      const msg = event.data;
      if (!msg || msg.type !== 'WAYBOOK_WRITE_RESULT' || msg.requestId !== requestId) return;
      if (!msg.ok) done(new Error(msg.error || '雲端寫入失敗'));
      else done(undefined, msg.data as T);
    };
    function done(error?: Error, response?: T) {
      window.clearTimeout(timer); window.removeEventListener('message', onMessage);
      window.setTimeout(() => { frame.remove(); form.remove(); }, 100);
      if (error) reject(error); else resolve(response as T);
    }
    window.addEventListener('message', onMessage);
    document.body.appendChild(frame); document.body.appendChild(form);
    form.submit();
  });
}

export async function loadCloudPhoto(fileId: string): Promise<string> {
  const result = await cloudRead<{ dataUrl: string }>({ action: 'photo', fileId }, 30000);
  if (!result?.dataUrl?.startsWith('data:image/')) throw new Error('雲端照片格式不正確');
  return result.dataUrl;
}

export function hasCloudConfiguration() { return Boolean(CLOUD_URL && GOOGLE_CLIENT_ID); }

export function getGoogleIdToken(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const w = window as unknown as { google?: { accounts: { id: { initialize: (o: unknown) => void; prompt: (cb: (notice: { isNotDisplayed: () => boolean }) => void) => void; renderButton: (el: HTMLElement, o: unknown) => void } } } };
    const holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;z-index:10000;top:50%;left:50%;transform:translate(-50%,-50%);padding:22px;background:white;border-radius:16px;box-shadow:0 0 0 9999px #0009';
    const close = document.createElement('button'); close.textContent = '✕ 取消'; close.style.cssText='display:block;margin-bottom:12px;cursor:pointer'; holder.appendChild(close);
    const target = document.createElement('div'); holder.appendChild(target);
    const cleanup = () => holder.remove();
    close.onclick = () => { cleanup(); reject(new Error('已取消登入')); };
    const init = () => {
      if (!w.google?.accounts?.id) { cleanup(); reject(new Error('Google 登入服務無法載入')); return; }
      document.body.appendChild(holder);
      w.google.accounts.id.initialize({ client_id: clientId, callback: (response: { credential?: string }) => {
        cleanup(); response.credential ? resolve(response.credential) : reject(new Error('Google 登入失敗'));
      }});
      w.google.accounts.id.renderButton(target, { theme: 'outline', size: 'large', text: 'signin_with', width: 240 });
    };
    if (w.google?.accounts?.id) { init(); return; }
    const script = document.createElement('script'); script.src = 'https://accounts.google.com/gsi/client'; script.async = true;
    script.onload = init; script.onerror = () => reject(new Error('無法載入 Google 登入'));
    document.head.appendChild(script);
  });
}
