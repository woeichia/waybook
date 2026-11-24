import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Cloud, ExternalLink, Play, X } from 'lucide-react';
import { readCachedPhotos, saveCachedPhoto } from '../utils/cloudCache';
import { createPortal } from 'react-dom';
import { cloudRead } from '../utils/driveCloud';

/**
 * v15.3B - metadata only. The video bytes are NOT cached or fetched by Waybook.
 * Drive's own authorization is enforced by the preview iframe/new-tab page.
 * Never use unlisted / anyone-with-link permissions automatically.
 */
type VideoRef = { id: string; size: number; mimeType: string; posterId?: string; width?: number; height?: number };
type VideoIndex = { updatedAt: string; videos: Record<string, VideoRef> };
const CACHE_KEY = 'waybook_video_index_153b';
const DRIVE_ID = /^[A-Za-z0-9_-]{10,120}$/;
const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const formatSize = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`;

function readIndex(): VideoIndex | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { cachedAt?: number; data?: VideoIndex };
    if (!parsed.cachedAt || Date.now() - parsed.cachedAt > CACHE_MAX_AGE_MS) return null;
    return parsed.data?.videos && typeof parsed.data.updatedAt === 'string' ? parsed.data : null;
  } catch { return null; }
}
function writeIndex(data: VideoIndex) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ cachedAt: Date.now(), data })); } catch { /* Storage unavailable */ }
}

export function CloudVideoGallery({stopId,readOnly,posterSrc,posterTitle}: {stopId:string; readOnly:boolean; posterSrc?:string; posterTitle?:string}) {
  const [index,setIndex] = useState<VideoIndex|null>(()=>readIndex());
  const [actualPoster,setActualPoster]=useState('');
  const [viewerOpen,setViewerOpen] = useState(false);
  const [posterFailed,setPosterFailed] = useState(false);
  useEffect(()=>setPosterFailed(false),[posterSrc,actualPoster]);
  const requestRef = useRef(false);
  const refresh = useCallback(async (silent = false) => {
    if(requestRef.current) return;
    requestRef.current = true;
    try {
      const next = await cloudRead<VideoIndex>({action:'videos'},20000);
      if(!next || !next.videos || typeof next.updatedAt !== 'string') throw new Error('影片索引回傳格式不正確');
      // Same index: retain the cached object; never discard media or redraw unnecessarily.
      setIndex(prev => prev?.updatedAt === next.updatedAt ? prev : next);
      writeIndex(next);
    } catch {
      // A failed network call must never erase cached metadata.
    } finally { requestRef.current = false; }
  },[]);

  useEffect(()=>{
    const cached=readIndex();
    if(cached) setIndex(cached);
    void refresh(true);
    const onFocus=()=>{ if(!document.hidden) void refresh(true); };
    document.addEventListener('visibilitychange',onFocus);
    return ()=>document.removeEventListener('visibilitychange',onFocus);
  },[refresh]);

  useEffect(()=>{const onPublished=()=>void refresh(true);window.addEventListener('waybook:videoPublished',onPublished);return()=>window.removeEventListener('waybook:videoPublished',onPublished);},[refresh]);
  const video=index?.videos?.[stopId];
  const registeredPosterId=video?.posterId;
  useEffect(()=>{
    let alive=true;setActualPoster('');
    if(!registeredPosterId)return;
    (async()=>{
      const cached=await readCachedPhotos([registeredPosterId]).catch(()=>({} as Record<string,string>));
      if(!alive)return;
      if(cached[registeredPosterId]) {setActualPoster(cached[registeredPosterId]);return;}
      try {
        const result=await cloudRead<{dataUrl:string}>({action:'videoPoster',stopId,fileId:registeredPosterId},30000);
        if(!alive||!result?.dataUrl?.startsWith('data:image/'))return;
        setActualPoster(result.dataUrl);
        void saveCachedPhoto(registeredPosterId,result.dataUrl).catch(()=>{});
      }catch {/* Keep event-cover fallback when offline or thumbnail is unavailable. */}
    })();
    return()=>{alive=false;};
  },[registeredPosterId,stopId]);
  const effectivePoster=actualPoster || posterSrc;
  const posterIsReal=Boolean(actualPoster);

  const available=Boolean(video && DRIVE_ID.test(video.id));
  const driveUrl=available ? `https://drive.google.com/file/d/${video!.id}/view` : '';
  const previewUrl=available ? `https://drive.google.com/file/d/${video!.id}/preview` : '';
  const close=()=>setViewerOpen(false);
  useEffect(()=>{
    if(!viewerOpen) return;
    const previous=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const onBack=()=>close();
    const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.stopImmediatePropagation();close();}};
    window.addEventListener('waybook:back',onBack);
    window.addEventListener('keydown',onKey,true);
    return ()=>{ document.body.style.overflow=previous; window.removeEventListener('waybook:back',onBack);window.removeEventListener('keydown',onKey,true); };
  },[viewerOpen]);

  if(!available) return null;
  return <section className="mt-4 rounded-2xl bg-[#F0F2F7] p-3 ring-1 ring-[#1F3FB0]/15 space-y-3" aria-label="Google Drive 雲端回憶短片">
    <div className="flex items-center gap-2 font-semibold text-[#203A7C] text-sm"><Cloud size={17}/>雲端回憶短片</div>
    {available ? <>
      <button type="button" onClick={()=>setViewerOpen(true)} className={`group relative block w-full ${video?.height && video.width && video.height>video.width ? 'aspect-[4/5]' : 'aspect-video'} overflow-hidden rounded-2xl bg-[#25364D] text-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F3FB0]`} aria-label={`播放雲端短片${posterTitle ? '：'+posterTitle : ''}`}>
        {effectivePoster && !posterFailed ? <img src={effectivePoster} onError={()=>setPosterFailed(true)} alt={posterIsReal ? '影片實際畫面' : (posterTitle ? `${posterTitle} 活動封面` : '活動封面')} className={`absolute inset-0 h-full w-full ${posterIsReal ? 'object-contain' : 'object-cover'} transition-transform duration-200 group-active:scale-[1.02]`}/> : <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-[#243B56] via-[#34596A] to-[#17243C]"/>}
        <span className="absolute inset-0 bg-black/30" aria-hidden="true"/>
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2"><span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-[#1F3FB0] shadow-lg"><Play size={29} fill="currentColor" className="ml-1"/></span><span className="rounded-full bg-black/55 px-3 py-1 text-sm font-semibold">播放回憶短片</span></span>
        <span className="absolute bottom-3 right-3 rounded-lg bg-black/65 px-2.5 py-1 text-[11px] font-semibold">{formatSize(video!.size)}</span>
        {effectivePoster && <span className="absolute bottom-3 left-3 rounded-lg bg-black/60 px-2 py-1 text-[10px]">{posterIsReal?'影片封面':'活動封面（尚無影片縮圖）'}</span>}
      </button>
      <p className="text-xs text-[#5B6070]">點按封面即可播放。Google Drive 自帶的播放控制列由 Google 管理，Waybook 無法隱藏。</p>
      <a href={driveUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#1F3FB0] text-xs underline"><ExternalLink size={14}/>若內嵌播放失敗，請在 Google Drive 中開啟</a>
    </> : <p className="text-xs text-[#5B6070]">此活動尚未發布雲端影片。</p>}
    {viewerOpen&&available&&createPortal(
      <div data-waybook-video-viewer role="dialog" aria-modal="true" aria-label="雲端影片播放" className="fixed inset-0 z-[9999] flex flex-col bg-[#050505] text-white" onClick={close}>
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 pt-[env(safe-area-inset-top)]" onClick={e=>e.stopPropagation()}>
          <span className="min-w-0 truncate text-sm font-semibold">{posterTitle || '回憶短片'}</span>
          <button type="button" onClick={close} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-4 text-sm" aria-label="關閉雲端影片"><X size={19}/>關閉</button>
        </header>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-2 sm:p-4" onClick={e=>e.stopPropagation()}>
          <iframe key={video!.id} src={previewUrl} title="Google Drive 雲端短片" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="no-referrer-when-downgrade" style={{aspectRatio:video?.width && video?.height?`${video.width} / ${video.height}`:undefined}} className={`w-full rounded-lg border-0 bg-black ${video?.width && video.height && video.height > video.width ? 'max-w-[min(75vw,440px)] h-[min(75dvh,850px)]' : 'max-w-[1000px] h-[min(76dvh,750px)]'}`} />
        </div>
        <footer className="flex shrink-0 flex-col gap-2 items-center justify-center px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-2" onClick={e=>e.stopPropagation()}>
          <p className="text-center text-[11px] text-white/60">Google Drive 原生控制列會蓋在畫面上；可嘗試播放後輕觸空白處隱藏，或使用全螢幕鍵。</p>
          <a href={driveUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs text-white/85"><ExternalLink size={14}/>若無法播放，使用 Google Drive 開啟</a>
        </footer>
      </div>,document.body
    )}
  </section>;
}
