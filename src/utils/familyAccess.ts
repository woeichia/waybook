const CLOUD_URL = (import.meta.env.VITE_WAYBOOK_APPS_SCRIPT_URL || '').trim();

const SESSION_KEY = 'waybook_family_session_v153c';
export type FamilySession = { token: string; expiresAt: number };

export function readFamilySession(): FamilySession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as FamilySession;
    if (typeof value.token !== 'string' || !/^[a-f0-9]{64}$/.test(value.token) || !Number.isFinite(value.expiresAt) || value.expiresAt <= Date.now()) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return value;
  } catch { return null; }
}
export function saveFamilySession(session: FamilySession) { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
export function clearFamilySession() { try { sessionStorage.removeItem(SESSION_KEY); } catch {} }

/** POST-only iframe bridge: never put the family code or session in URL/query strings. */
export function familyRequest<T>(action: string, data: unknown, timeout = 30000): Promise<T> {
  if (!CLOUD_URL) return Promise.reject(new Error('Waybook Apps Script URL 尚未設定'));
  return new Promise<T>((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const frame = document.createElement('iframe');
    frame.name = 'waybook_family_' + requestId;
    frame.style.display = 'none';
    const form = document.createElement('form');
    form.style.display = 'none';
    form.method = 'POST';
    form.action = CLOUD_URL;
    form.target = frame.name;
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'payload';
    input.value = JSON.stringify({ requestId, action, data });
    form.appendChild(input);
    let completed = false;
    const timer = window.setTimeout(() => finish(new Error('Google 服務逾時，請確認網路或重新開啟 Waybook')), timeout);
    function finish(error?: Error, value?: T) {
      if (completed) return;
      completed = true;
      window.clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      window.setTimeout(() => { frame.remove(); form.remove(); }, 100);
      if (error) reject(error); else resolve(value as T);
    }
    function onMessage(e: MessageEvent) {
      if (!/^https:\/\/(?:[a-z0-9-]+\.)*(?:googleusercontent\.com|google\.com)$/i.test(e.origin)) return;
      // Apps Script may insert an extra iframe layer, so match origin + cryptographic requestId.
      const msg = e.data;
      if (msg?.type !== 'WAYBOOK_FAMILY_RESULT' || msg.requestId !== requestId) return;
      if (msg.ok) finish(undefined, msg.data as T);
      else finish(new Error(String(msg.error || '伺服器拒絕要求')));
    }
    window.addEventListener('message', onMessage);
    document.body.append(frame, form);
    try { form.submit(); }
    catch(e) { finish(e instanceof Error ? e : new Error('無法連接 Google Apps Script')); }
  });
}

export function familyLogin(code: string) {
  return familyRequest<FamilySession>('familyLogin', { code }, 25000);
}
export function familyCheck(token: string) {
  return familyRequest<{ valid: boolean; expiresAt: number }>('familyCheck', { token }, 25000);
}
export function familyRead<T>(params: Record<string,string>, timeout = 30000) {
  const session = readFamilySession();
  if (!session) return Promise.reject(new Error('家庭登入已過期，請重新輸入密碼'));
  return familyRequest<T>('familyRead', { token: session.token, params }, timeout);
}
