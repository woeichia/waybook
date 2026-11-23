import React, { useEffect, useRef, useState } from 'react';
import { Film, Loader2, Play, Trash2, Upload } from 'lucide-react';

/** A deliberately device-local preview. Does not change photo data or published snapshots. */
const DB_NAME = 'waybook_local_video_pilot_v1';
const STORE_NAME = 'clips';
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_SECONDS = 10;

type Clip = { blob: Blob; name: string; duration: number; updatedAt: number };
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('此瀏覽器不支援本機影片儲存')); return; }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('影片儲存空間無法開啟'));
  });
}
async function loadClip(stopId: string): Promise<Clip | null> {
  const db = await openDb();
  try {
    return await new Promise<Clip | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(stopId);
      tx.oncomplete = () => resolve(request.result ?? null);
      tx.onerror = () => reject(tx.error ?? new Error('無法讀取影片'));
    });
  } finally { db.close(); }
}
async function saveClip(stopId: string, clip: Clip | null): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      if (clip) tx.objectStore(STORE_NAME).put(clip, stopId);
      else tx.objectStore(STORE_NAME).delete(stopId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('無法儲存影片'));
    });
  } finally { db.close(); }
}
function videoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const src = URL.createObjectURL(file);
    const video = document.createElement('video');
    let finished = false;
    const finish = (duration?: number, error?: Error) => {
      if (finished) return;
      finished = true;
      video.removeAttribute('src'); video.load(); URL.revokeObjectURL(src);
      if (error) reject(error); else resolve(duration as number);
    };
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) finish(undefined, new Error('無法確認影片長度，請試另一個檔案'));
      else finish(video.duration);
    };
    video.onerror = () => finish(undefined, new Error('手機無法讀取此影片格式'));
    video.src = src;
  });
}

export function MemoryClipPilot({ stopId }: { stopId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [clip, setClip] = useState<Clip | null>(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    setClip(null); setError(''); setReady(false);
    loadClip(stopId).then(value => { if (mounted) { setClip(value); setReady(true); } })
      .catch(err => { if (mounted) { setError(String(err?.message || err)); setReady(true); } });
    return () => { mounted = false; };
  }, [stopId]);
  useEffect(() => {
    if (!clip) { setUrl(''); return; }
    const objectUrl = URL.createObjectURL(clip.blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [clip]);

  const selectFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    setError('');
    if (!file.type.startsWith('video/')) { setError('請選擇影片檔案'); return; }
    if (file.size > MAX_BYTES) { setError('影片超過 8 MB。請先在手機上壓縮後再試。'); return; }
    setBusy(true);
    try {
      const duration = await videoDuration(file);
      if (duration > MAX_SECONDS + 0.1) { setError(`影片長度 ${duration.toFixed(1)} 秒，請先剪輯至 10 秒內。`); return; }
      const next: Clip = { blob: file, name: file.name, duration, updatedAt: Date.now() };
      await saveClip(stopId, next);
      setClip(next);
    } catch(err) { setError(err instanceof Error ? err.message : '影片儲存失敗'); }
    finally { setBusy(false); }
  };
  const removeClip = async () => {
    if (!window.confirm('刪除這台裝置儲存的短片？')) return;
    setBusy(true); setError('');
    try { await saveClip(stopId, null); setClip(null); }
    catch(err) { setError(err instanceof Error ? err.message : '無法刪除短片'); }
    finally { setBusy(false); }
  };

  return <section className="mt-4 rounded-2xl bg-[#F6F0E6] p-3 ring-1 ring-black/10 space-y-3" aria-label="回憶短片本機測試">
    <div className="flex items-center justify-between gap-2">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-[#28251F]"><Film size={17}/>回憶短片 · 10 秒</h4>
      <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-900">本機測試</span>
    </div>
    <p className="text-xs leading-relaxed text-[#61594C]">目前只保存在這台裝置，不會上傳 Google Drive，也不會顯示在家人的手機。請勿清除網站資料；正式雲端分享將在確認影片播放正常後加入。</p>
    {!ready ? <p className="text-xs text-[#6A6256]">載入短片…</p> : clip && url ? <>
      <video ref={videoRef} src={url} controls playsInline preload="metadata" className="w-full max-h-[340px] rounded-xl bg-black object-contain" aria-label="回憶短片播放器"/>
      <p className="text-xs text-[#6A6256]">{clip.name} · {clip.duration.toFixed(1)} 秒 · 原始聲音由影片播放器控制</p>
      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={() => { videoRef.current?.play().catch(() => {}); }} className="inline-flex items-center gap-1 rounded-full bg-[#1F3FB0] px-3 py-2 text-xs text-white"><Play size={14}/>播放短片</button>
        <button type="button" disabled={busy} onClick={() => void removeClip()} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-2 text-xs text-red-700 ring-1 ring-black/10 disabled:opacity-50"><Trash2 size={14}/>刪除短片</button>
      </div>
    </> : <p className="text-xs text-[#6A6256]">這個活動暫時沒有本機短片。</p>}
    <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={selectFile}/>
    <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="w-full min-h-11 flex items-center justify-center gap-2 rounded-xl bg-[#E4E5F0] text-[#1F3FB0] text-sm font-semibold disabled:opacity-50">
      {busy ? <Loader2 size={16} className="animate-spin"/> : <Upload size={16}/>}{clip ? '更換本機短片' : '加入 10 秒短片'}
    </button>
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
  </section>;
}
