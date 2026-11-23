import React, { useEffect, useRef, useState } from 'react';
import { Film, Loader2, Play, Trash2, Upload, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { compressVideoWhenNeeded } from '../utils/compressVideo';

/** A deliberately device-local preview. Does not change photo data or published snapshots. */
const DB_NAME = 'waybook_local_video_pilot_v1';
const STORE_NAME = 'clips';
const MAX_BYTES = 25 * 1024 * 1024;

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
  const [progress, setProgress] = useState<number | null>(null);
  const [compressionNote, setCompressionNote] = useState('');
  const [viewerOpen, setViewerOpen] = useState(false);
  const playFull = () => {
    setViewerOpen(true);
  };
  const closeFull = () => {
    videoRef.current?.pause();
    setViewerOpen(false);
  };
  useEffect(() => {
    if (!viewerOpen) return;
    const onBack = () => closeFull();
    const onKey = (event: KeyboardEvent) => { if(event.key === 'Escape') {event.stopPropagation();closeFull();} };
    window.addEventListener('waybook:back', onBack);
    window.addEventListener('keydown', onKey, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Browser video autoplay may be blocked; the user can press the native play control.
    void videoRef.current?.play().catch(() => {});
    return () => { window.removeEventListener('waybook:back', onBack);window.removeEventListener('keydown', onKey, true);document.body.style.overflow=previousOverflow; };
  }, [viewerOpen]);

  useEffect(() => {
    let mounted = true;
    setClip(null); setError(''); setReady(false); setViewerOpen(false);
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
    setError('');setCompressionNote('');
    if (!file.type.startsWith('video/')) { setError('請選擇影片檔案'); return; }
    setBusy(true);
    try {
      const duration = await videoDuration(file);
      setProgress(0);
      const output = await compressVideoWhenNeeded(file,duration,MAX_BYTES,setProgress);
      const next: Clip = {blob: output.blob, name: output.wasCompressed ? `${file.name.replace(/\.[^.]+$/,'')}-720p.${output.extension}` : file.name, duration,updatedAt:Date.now()};
      if(output.wasCompressed) setCompressionNote(`已在手機壓縮：${(file.size/1048576).toFixed(1)} MB → ${(output.blob.size/1048576).toFixed(1)} MB，保留原聲音。`);
      else setCompressionNote('影片未超過 25 MB，保留原始畫質及聲音。');
      await saveClip(stopId, next);
      setClip(next);
    } catch(err) { setError(err instanceof Error ? err.message : '影片儲存失敗'); }
    finally { setBusy(false);setProgress(null); }
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
      <h4 className="flex items-center gap-2 text-sm font-semibold text-[#28251F]"><Film size={17}/>回憶短片 · 25 MB</h4>
      <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-900">本機測試</span>
    </div>
    <p className="text-xs leading-relaxed text-[#61594C]">僅儲存在這台裝置；未同步 Google Drive。沒有固定秒數限制，每站最多一支影片，檔案上限 25 MB。超過 25 MB 時嘗試在手機內壓縮為 720p，並保留聲音。較長影片壓縮可能花較多時間。部分手機瀏覽器不支援壓縮，會顯示指示，不會上傳原始影片。</p>
    {!ready ? <p className="text-xs text-[#6A6256]">載入短片…</p> : clip && url ? <>
      <button type="button" onClick={playFull} className="relative w-full rounded-xl bg-[#191919] flex items-center justify-center overflow-hidden" aria-label="以全螢幕方式播放回憶短片">
        <video src={url} muted playsInline preload="metadata" className="block w-full h-[190px] object-contain pointer-events-none" aria-hidden="true"/>
        <span className="absolute inset-0 flex items-center justify-center bg-black/15"><span className="bg-white/90 rounded-full p-4 text-[#1F3FB0]"><Play size={27} fill="currentColor"/></span></span>
      </button>
      <p className="text-xs text-[#6A6256]">{clip.name} · {clip.duration.toFixed(1)} 秒 · 原始聲音由影片播放器控制</p>
      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={playFull} className="inline-flex items-center gap-1 rounded-full bg-[#1F3FB0] px-3 py-2 text-xs text-white"><Play size={14}/>播放短片</button>
        <button type="button" disabled={busy} onClick={() => void removeClip()} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-2 text-xs text-red-700 ring-1 ring-black/10 disabled:opacity-50"><Trash2 size={14}/>刪除短片</button>
      </div>
    </> : <p className="text-xs text-[#6A6256]">這個活動暫時沒有本機短片。</p>}
    <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={selectFile}/>
    <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="w-full min-h-11 flex items-center justify-center gap-2 rounded-xl bg-[#E4E5F0] text-[#1F3FB0] text-sm font-semibold disabled:opacity-50">
      {busy ? <Loader2 size={16} className="animate-spin"/> : <Upload size={16}/>}{clip ? '更換本機短片' : '加入回憶短片'}
    </button>
    {progress!==null && <div className="space-y-1"><p role="status" className="text-xs text-[#5C554B]">{progress===100?'處理完成':`正在壓縮影片… ${progress}%（實際播放速度處理）`}</p><div className="h-1.5 bg-[#DDD6CB] rounded-full overflow-hidden"><div className="h-full bg-[#1F3FB0] rounded-full" style={{width:`${progress}%`}}/></div></div>}
    {compressionNote && <p role="status" className="text-xs text-[#33664A]">{compressionNote}</p>}
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    {viewerOpen && url && createPortal(
      <div data-waybook-video-viewer role="dialog" aria-modal="true" aria-label="回憶短片完整播放" className="fixed inset-0 z-[9999] bg-black/95 flex flex-col items-center justify-center p-3" onClick={closeFull}>
        <button type="button" className="absolute top-4 right-4 z-10 flex items-center gap-1 rounded-full bg-white/20 text-white px-3 py-2 text-sm" aria-label="關閉短片" onClick={e => {e.stopPropagation();closeFull();}}><X size={20}/>關閉</button>
        <video ref={videoRef} src={url} controls playsInline autoPlay preload="metadata" className="block max-w-full w-auto h-auto max-h-[82dvh] object-contain bg-black" onClick={e=>e.stopPropagation()} aria-label="回憶短片全圖播放"/>
        <p className="text-white/80 text-xs mt-3 text-center">{clip?.duration.toFixed(1)} 秒 · 原始聲音 · 點擊關閉返回行程</p>
      </div>, document.body
    )}
  </section>;
}
