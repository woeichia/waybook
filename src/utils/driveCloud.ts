import type { ItineraryData } from '../types/itinerary';
import { familyRead } from './familyAccess';

/** Public cloud snapshots contain only references to image files, not binary images. */
export type CloudSnapshot = { version: number; updatedAt: string; itinerary: ItineraryData; galleries: Record<string, string[]>; memoryGalleries?: Record<string, {id:string;caption:string}[]> };
export const CLOUD_URL = (import.meta.env.VITE_WAYBOOK_APPS_SCRIPT_URL || '').trim();
export const GOOGLE_CLIENT_ID = (import.meta.env.VITE_WAYBOOK_GOOGLE_CLIENT_ID || '').trim();

/** All family reads are authenticated POSTs; no password/session token appears in URL. */
export function cloudRead<T>(params: Record<string, string>, timeout = 30000): Promise<T> {
  return familyRead<T>(params, timeout);
}

/** Administrator writes retain the existing receipt fallback and Google ID-token checks. */
export function cloudWrite<T>(action: string, data: unknown, idToken: string): Promise<T> {
  if (!CLOUD_URL) return Promise.reject(new Error('尚未設定 Apps Script URL'));
  if (!globalThis.crypto?.randomUUID) return Promise.reject(new Error('瀏覽器不支援安全請求識別碼'));
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const frame = document.createElement('iframe');
    const form = document.createElement('form');
    frame.name = `waybook_upload_${requestId}`;
    frame.style.display = 'none'; form.style.display = 'none';
    form.method = 'POST'; form.action = CLOUD_URL; form.target = frame.name;
    const field = document.createElement('input'); field.type = 'hidden'; field.name = 'payload';
    field.value = JSON.stringify({ requestId, action, idToken, data }); form.appendChild(field);
    let settled = false;
    let polling = false;
    let pollTimer: number | undefined;
    const timer = window.setTimeout(() => {
      finish(new Error('雲端尚未確認寫入結果。請先檢查 Google Drive，勿立即重複上傳。'));
    }, 90000);
    function finish(error?: Error, response?: T) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (pollTimer !== undefined) window.clearTimeout(pollTimer);
      window.removeEventListener('message', onMessage);
      window.setTimeout(() => { frame.remove(); form.remove(); }, 100);
      if (error) reject(error); else resolve(response as T);
    }
    const onMessage = (event: MessageEvent) => {
      if (!/^https:\/\/(?:[a-z0-9-]+\.)*(?:googleusercontent\.com|google\.com)$/i.test(event.origin)) return;
      const msg = event.data;
      if (!msg || msg.type !== 'WAYBOOK_WRITE_RESULT' || msg.requestId !== requestId) return;
      if (!msg.ok) finish(new Error(msg.error || '雲端寫入失敗'));
      else finish(undefined, msg.data as T);
    };
    async function checkReceipt() {
      if (settled || polling) return;
      polling = true;
      try {
        // Read-only receipt is an unguessable UUID and contains no family session data.
        const receipt = await receiptRead<{state:'pending'|'complete';ok?:boolean;data?:T;error?:string}>(requestId);
        if (receipt?.state === 'complete') {
          if (receipt.ok) finish(undefined, receipt.data);
          else finish(new Error(receipt.error || '雲端寫入失敗'));
        }
      } catch { /* Ignore transient receipt failure */ }
      finally {polling=false; if (!settled) pollTimer=window.setTimeout(checkReceipt,2500);}
    }
    window.addEventListener('message', onMessage);
    document.body.append(frame,form);
    try { form.submit(); pollTimer=window.setTimeout(checkReceipt,2000); }
    catch (err) { finish(err instanceof Error?err:new Error('無法送出雲端寫入請求')); }
  });
}

function receiptRead<T>(requestId: string): Promise<T> {
  return new Promise((resolve,reject)=>{
    const callback=`__waybook_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const root=window as unknown as Record<string,unknown>;
    const script=document.createElement('script');
    const timer=window.setTimeout(()=>end(new Error('回條逾時')),10000);
    const end=(error?:Error,value?:T)=>{clearTimeout(timer); script.remove();delete root[callback];if(error)reject(error);else resolve(value as T);};
    root[callback]=(response:{ok:boolean;data?:T;error?:string})=>response?.ok?end(undefined,response.data):end(new Error(response?.error||'回條讀取失敗'));
    script.onerror=()=>end(new Error('網路暫時無法讀取回條'));
    const url=new URL(CLOUD_URL);
    url.searchParams.set('action','writeReceipt');url.searchParams.set('requestId',requestId);url.searchParams.set('callback',callback);
    script.src=url.toString();document.head.appendChild(script);
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
