import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Cloud, ExternalLink, Play, X } from 'lucide-react';
import { readCachedPhotos, saveCachedPhoto } from '../utils/cloudCache';
import { cloudRead } from '../utils/driveCloud';

/** Cloud video references only. Google Drive handles streaming and access permissions. */
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
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ cachedAt: Date.now(), data })); }
  catch { /* Storage unavailable */ }
}

export function CloudVideoGallery({stopId,readOnly,posterSrc,posterTitle}: {stopId:string; readOnly:boolean; posterSrc?:string; posterTitle?:string}) {
  const [index,setIndex] = useState<VideoIndex|null>(()=>readIndex());
  const [actualPoster,setActualPoster] = useState('');
  const [viewerOpen,setViewerOpen] = useState(false);
  const [posterFailed,setPosterFailed] = useState(false);
  const requestRef = useRef(false);
  useEffect(()=>setPosterFailed(false),[posterSrc,actualPoster]);

  const refresh = useCallback(async () => {
    if (requestRef.current) return;
    requestRef.current = true;
    try {
      const next = await cloudRead<VideoIndex>({action:'videos'},20000);
      if (!next || !next.videos || typeof next.updatedAt !== 'string') throw new Error('影片索引回傳格式不正確');
      setIndex(prev => prev?.updatedAt === next.updatedAt ? prev : next);
      writeIndex(next);
    } catch { /* Retain cached metadata while offline. */ }
    finally { requestRef.current = false; }
  },[]);

  useEffect(()=>{
    const cached = readIndex();
    if (cached) setIndex(cached);
    void refresh();
    const onFocus = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange',onFocus);
    return () => document.removeEventListener('visibilitychange',onFocus);
  },[refresh]);
  useEffect(()=>{
    const onPublished = () => { void refresh(); };
    window.addEventListener('waybook:videoPublished',onPublished);
    return () => window.removeEventListener('waybook:videoPublished',onPublished);
  },[refresh]);

  const video = index?.videos?.[stopId];
  const registeredPosterId = video?.posterId;
  useEffect(()=>{
    let alive = true;
    setActualPoster('');
    if (!registeredPosterId) return;
    (async()=>{
      const cached = await readCachedPhotos([registeredPosterId]).catch(()=>({} as Record<string,string>));
      if (!alive) return;
      if (cached[registeredPosterId]) { setActualPoster(cached[registeredPosterId]); return; }
      try {
        const result = await cloudRead<{dataUrl:string}>({action:'videoPoster',stopId,fileId:registeredPosterId},30000);
        if (!alive || !result?.dataUrl?.startsWith('data:image/')) return;
        setActualPoster(result.dataUrl);
        void saveCachedPhoto(registeredPosterId,result.dataUrl).catch(()=>{});
      } catch { /* Fallback to event cover. */ }
    })();
    return () => { alive = false; };
  },[registeredPosterId,stopId]);

  const effectivePoster = actualPoster || posterSrc;
  const posterIsReal = Boolean(actualPoster);
  const available = Boolean(video && DRIVE_ID.test(video.id));
  const driveUrl = available ? `https://drive.google.com/file/d/${video!.id}/view` : '';
  const previewUrl = available ? `https://drive.google.com/file/d/${video!.id}/preview` : '';
  const portrait = Boolean(video?.width && video?.height && video.height > video.width);
  const ratio = video?.width && video?.height ? `${video.width} / ${video.height}` : '16 / 9';

  // Important: no fullscreen portal. Unmount the iframe when event/video changes or the user closes it.
  useEffect(()=>{ setViewerOpen(false); },[stopId,video?.id]);
  useEffect(()=>{
    if (!viewerOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setViewerOpen(false); };
    window.addEventListener('keydown',onKey);
    return () => window.removeEventListener('keydown',onKey);
  },[viewerOpen]);

  if (!available) return null;
  return <section className="mt-4 rounded-2xl bg-[#F0F2F7] p-3 ring-1 ring-[#1F3FB0]/15 space-y-3" aria-label="Google Drive 雲端回憶短片">
    <div className="flex items-center gap-2 font-semibold text-[#203A7C] text-sm"><Cloud size={17}/>雲端回憶短片</div>
    {!viewerOpen ? (
      <button type="button" onClick={()=>setViewerOpen(true)} className={`group relative block w-full ${portrait ? 'aspect-[4/5]' : 'aspect-video'} overflow-hidden rounded-2xl bg-[#25364D] text-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F3FB0]`} aria-label={`播放雲端短片${posterTitle ? '：'+posterTitle : ''}`}>
        {effectivePoster && !posterFailed ? <img src={effectivePoster} onError={()=>setPosterFailed(true)} alt={posterIsReal ? '影片實際畫面' : (posterTitle ? `${posterTitle} 活動封面` : '活動封面')} className={`absolute inset-0 h-full w-full ${posterIsReal ? 'object-contain' : 'object-cover'} transition-transform duration-200 group-active:scale-[1.02]`}/> : <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-[#243B56] via-[#34596A] to-[#17243C]"/>}
        <span className="absolute inset-0 bg-black/30" aria-hidden="true"/>
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2"><span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-[#1F3FB0] shadow-lg"><Play size={29} fill="currentColor" className="ml-1"/></span><span className="rounded-full bg-black/55 px-3 py-1 text-sm font-semibold">播放回憶短片</span></span>
        <span className="absolute bottom-3 right-3 rounded-lg bg-black/65 px-2.5 py-1 text-[11px] font-semibold">{formatSize(video!.size)}</span>
        {effectivePoster && <span className="absolute bottom-3 left-3 rounded-lg bg-black/60 px-2 py-1 text-[10px]">{posterIsReal?'影片封面':'活動封面（尚無影片縮圖）'}</span>}
      </button>
    ) : (
      <div className="space-y-2" aria-label="回憶短片頁內播放">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-semibold text-[#203A7C]">{posterTitle || '回憶短片'}</span>
          <button type="button" onClick={()=>setViewerOpen(false)} className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full bg-white px-3 py-2 text-xs text-[#203A7C] ring-1 ring-black/10" aria-label="收起影片"><X size={15}/>收起影片</button>
        </div>
        <div className={`relative mx-auto w-full overflow-hidden rounded-xl bg-black ${portrait ? 'max-w-[340px]' : ''}`} style={{aspectRatio:ratio}}>
          <iframe key={video!.id} src={previewUrl} title="Google Drive 雲端短片" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="no-referrer-when-downgrade" className="absolute inset-0 h-full w-full border-0 bg-black"/>
        </div>
        <p className="text-center text-[11px] text-[#5B6070]">影片在行程內播放，不會自動全螢幕。Google Drive 的內建控制列仍由 Google 管理。</p>
      </div>
    )}
    <a href={driveUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#1F3FB0] text-xs underline"><ExternalLink size={14}/>若內嵌播放失敗，請在 Google Drive 中開啟</a>
  </section>;
}
