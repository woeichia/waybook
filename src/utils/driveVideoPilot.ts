import { GOOGLE_CLIENT_ID } from './driveCloud';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export type DriveVideoResult = { id: string; name: string; size: number; mimeType: string; webViewLink?: string; createdTime?: string };

type GoogleTokenResponse = { access_token?: string; error?: string; error_description?: string; scope?: string };
type TokenClient = { requestAccessToken: (options?: { prompt?: string }) => void };
type GoogleWindow = Window & { google?: { accounts?: { oauth2?: { initTokenClient: (opts: { client_id: string; scope: string; callback: (response: GoogleTokenResponse) => void }) => TokenClient } } } };

function loadGoogleIdentity(): Promise<void> {
  const w = window as GoogleWindow;
  if (w.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => w.google?.accounts?.oauth2 ? resolve() : reject(new Error('Google OAuth 無法初始化'));
    script.onerror = () => reject(new Error('無法載入 Google 授權服務'));
    document.head.appendChild(script);
  });
}

export function warmupDriveOAuth(): Promise<void> { return loadGoogleIdentity(); }

/** Call from a real button click; never store this token in localStorage, URLs or logs. */
export async function authorizeDriveVideoUpload(): Promise<string> {
  if (!GOOGLE_CLIENT_ID) throw new Error('未設定 VITE_WAYBOOK_GOOGLE_CLIENT_ID');
  await loadGoogleIdentity();
  const oauth2 = (window as GoogleWindow).google?.accounts?.oauth2;
  if (!oauth2) throw new Error('Google OAuth 不可用');
  return new Promise<string>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID, scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) reject(new Error(response.error_description || response.error || 'Google Drive 授權未完成'));
        else if (!response.scope?.split(' ').includes(DRIVE_SCOPE)) reject(new Error('沒有取得 Google Drive 檔案權限'));
        else resolve(response.access_token);
      },
    });
    try { client.requestAccessToken({ prompt: 'consent' }); }
    catch (e) { reject(e instanceof Error ? e : new Error('無法啟動 Google Drive 授權')); }
  });
}

async function responseError(response: Response): Promise<Error> {
  let details = '';
  try { const body = await response.json(); details = body?.error?.message || body?.error || ''; } catch { /* ignore */ }
  return new Error(`Google Drive HTTP ${response.status}${details ? `：${details}` : ''}`);
}

/** Private test: create file owned by the granting Google account; do not change sharing permissions. */
export async function uploadPrivateVideoTest(
  blob: Blob, fileName: string, token: string,
  onProgress: (percent: number) => void,
): Promise<DriveVideoResult> {
  if (!blob.size || blob.size > 25 * 1024 * 1024) throw new Error('本機短片必須介於 0 至 25 MB');
  const mimeType = blob.type || 'video/mp4';
  // Do not use arbitrary user-provided names in Google Drive. These are test-only uploads.
  const name = `Waybook_TEST_${new Date().toISOString().replace(/[:.]/g, '-')}_${fileName.slice(0, 80).replace(/[^\p{L}\p{N}._-]/gu, '_')}`;
  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size,webViewLink,createdTime', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': mimeType, 'X-Upload-Content-Length': String(blob.size) },
    body: JSON.stringify({ name, mimeType, description: 'Waybook v15.3A private video upload test; not published to family.' }),
  });
  if (!response.ok) throw await responseError(response);
  const location = response.headers.get('Location');
  if (!location || !location.startsWith('https://www.googleapis.com/')) throw new Error('Google Drive 沒有回傳可用的上傳工作階段。請確認 Drive API 與瀏覽器 CORS 權限。');

  // XHR gives real request-body progress; Google resumable sessions also support retry,
  // but this isolated pilot intentionally stops after network failure to avoid duplicates.
  const uploaded = await new Promise<DriveVideoResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', location);
    xhr.setRequestHeader('Content-Type', mimeType);
    xhr.setRequestHeader('Content-Range', `bytes 0-${blob.size - 1}/${blob.size}`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) onProgress(Math.min(99, Math.round(event.loaded / event.total * 100)));
    };
    xhr.onerror = () => reject(new Error('影片傳輸中斷；請先檢查 Drive 中是否已建立檔案，勿立即重複上傳'));
    xhr.ontimeout = () => reject(new Error('影片上傳逾時；請先檢查 Drive 是否已有檔案'));
    xhr.timeout = 180000;
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) { reject(new Error(`Google Drive 上傳失敗（HTTP ${xhr.status}）：${xhr.responseText.slice(0, 240)}`)); return; }
      try { resolve(JSON.parse(xhr.responseText) as DriveVideoResult); }
      catch { reject(new Error('已傳輸但無法解讀 Drive 回應，請先檢查檔案避免重複上傳')); }
    };
    xhr.send(blob);
  });
  if (!uploaded.id) throw new Error('上傳未回傳 Google Drive file ID，請檢查 Drive');

  const verification = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(uploaded.id)}?fields=id,name,mimeType,size,webViewLink,createdTime`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!verification.ok) throw await responseError(verification);
  const file = await verification.json() as DriveVideoResult;
  if (file.id !== uploaded.id || Number(file.size) !== blob.size) throw new Error(`已上傳但檔案大小驗證不一致。請檢查 Drive ID：${uploaded.id}`);
  onProgress(100);
  return file;
}

export async function readLocalVideoPilot(stopId: string): Promise<{ blob: Blob; name: string; duration: number } | null> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('waybook_local_video_pilot_v1', 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('clips')) request.result.createObjectStore('clips'); };
    request.onerror = () => reject(new Error('無法讀取本機影片資料庫'));
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('clips', 'readonly');
      const get = tx.objectStore('clips').get(stopId);
      tx.oncomplete = () => { resolve(get.result?.blob instanceof Blob ? get.result : null); db.close(); };
      tx.onerror = () => { db.close(); reject(new Error('無法讀取本機短片')); };
    };
  });
}
