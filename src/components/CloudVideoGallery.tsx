import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Cloud, ExternalLink, Play, X, Loader2, DownloadCloud, Maximize2, Minimize2, RotateCw, RotateCcw, Pause, Volume2, VolumeX } from 'lucide-react';
import { createPortal } from 'react-dom';
import { readCachedPhotos, saveCachedPhoto } from '../utils/cloudCache';
import { cloudRead } from '../utils/driveCloud';
import { getCachedVideo, putCachedVideo } from '../utils/videoCache';
import { downloadForCache } from '../utils/downloadForCache';

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
  const [loading,setLoading] = useState(false);
  const [progress,setProgress] = useState(0);
  const [playError,setPlayError] = useState('');
  const [videoUrl,setVideoUrl] = useState('');
  const [sourceLabel,setSourceLabel] = useState('');
  // A Waybook-owned viewer avoids triggering the phone's native fullscreen rotation.
  const inlineRef=useRef<HTMLVideoElement>(null);
  const expandedRef=useRef<HTMLVideoElement>(null);
  const [expanded,setExpanded]=useState(false);
  const [landscape,setLandscape]=useState(false);
  const [playing,setPlaying]=useState(false);
  const [muted,setMuted]=useState(false);
  const [currentTime,setCurrentTime]=useState(0);
  const [duration,setDuration]=useState(0);
  const savedTimeRef=useRef(0);
  const resumeRef=useRef(false);
  const openExpanded=()=>{
    const player=inlineRef.current;
    savedTimeRef.current=player?.currentTime||0;
    resumeRef.current=Boolean(player && !player.paused);
    player?.pause();
    setLandscape(false);setExpanded(true);
    // Give the expanded view its own browser history entry so phone Back closes it once.
    if(window.history.state?.waybookNav){
      window.history.pushState({waybookNav:true,day:window.history.state.day,layer:'media'},'',window.location.href);
    }
  };
  const closeExpanded=()=>{
    const player=expandedRef.current;
    savedTimeRef.current=player?.currentTime||savedTimeRef.current;
    resumeRef.current=Boolean(player && !player.paused);
    player?.pause();setExpanded(false);setLandscape(false);
    requestAnimationFrame(()=>{
      const inline=inlineRef.current;
      if(inline){inline.currentTime=savedTimeRef.current;if(resumeRef.current)void inline.play().catch(()=>{});}
    });
  };
  const requestCloseExpanded=()=>{
    if(window.history.state?.waybookNav && window.history.state.layer==='media' && window.history.length>1)
      window.history.back();
    else closeExpanded();
  };
  useEffect(()=>{
    if(!expanded)return;
    const onBack=()=>closeExpanded();
    window.addEventListener('waybook:back',onBack);
    return()=>window.removeEventListener('waybook:back',onBack);
  },[expanded]);
  const syncExpanded=()=>{
    const player=expandedRef.current;
    if(!player)return;
    player.currentTime=Math.min(savedTimeRef.current,Number.isFinite(player.duration)?player.duration:0);
    player.muted=muted;
    if(resumeRef.current)void player.play().catch(()=>{});
  };
  const togglePlay=()=>{
    const player=expandedRef.current;
    if(!player)return;
    if(player.paused)void player.play().catch(()=>{});else player.pause();
  };

  const requestAbort=useRef<AbortController|null>(null);
  const videoUrlRef=useRef('');
  const playSequence=useRef(0);
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

  const stopPlayback=()=>{
    playSequence.current++;
    requestAbort.current?.abort();requestAbort.current=null;
    setExpanded(false);setLandscape(false);setViewerOpen(false);setLoading(false);setPlayError('');setProgress(0);
    if(videoUrlRef.current)URL.revokeObjectURL(videoUrlRef.current);
    videoUrlRef.current='';setVideoUrl('');setSourceLabel('');
  };
  useEffect(()=>{stopPlayback();},[stopId,video?.id]);
  useEffect(()=>()=>{
    playSequence.current++;
    requestAbort.current?.abort();
    if(videoUrlRef.current)URL.revokeObjectURL(videoUrlRef.current);
  },[]);
  const play=async()=>{
    if(!video||!available)return;
    const sequence=++playSequence.current;
    const abort=new AbortController();requestAbort.current=abort;
    setViewerOpen(true);setLoading(true);setProgress(0);setPlayError('');
    try{
      let blob:Blob;
      const cached=await getCachedVideo(video.id,Number(video.size)).catch(()=>null);
      if(abort.signal.aborted||sequence!==playSequence.current)return;
      if(cached){blob=cached.blob;setSourceLabel('已從手機快取播放');}
      else{
        setSourceLabel('首次下載中（下載完成後可重播）');
        blob=await downloadForCache(stopId,Number(video.size),setProgress,abort.signal);
        if(abort.signal.aborted||sequence!==playSequence.current)return;
        const saved=await putCachedVideo({fileId:video.id,size:Number(video.size),mimeType:blob.type,blob,savedAt:Date.now()});
        setSourceLabel(saved?'已儲存在手機快取':'播放準備完成（手機儲存空間不足，未能快取）');
      }
      if(abort.signal.aborted||sequence!==playSequence.current)return;
      if(videoUrlRef.current)URL.revokeObjectURL(videoUrlRef.current);
      const url=URL.createObjectURL(blob);videoUrlRef.current=url;setVideoUrl(url);
    }catch(e){
      if(!abort.signal.aborted&&sequence===playSequence.current)setPlayError(e instanceof Error?e.message:'無法下載影片');
    }finally{
      if(sequence===playSequence.current){setLoading(false);requestAbort.current=null;}
    }
  };
  useEffect(()=>{
    if(!viewerOpen)return;
    const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'){if(expanded)requestCloseExpanded();else stopPlayback();}};
    window.addEventListener('keydown',onKey);
    return()=>window.removeEventListener('keydown',onKey);
  },[viewerOpen,expanded]);

  if (!available) return null;
  return <section className="mt-4 rounded-2xl bg-[#F0F2F7] p-3 ring-1 ring-[#1F3FB0]/15 space-y-3" aria-label="Google Drive 雲端回憶短片">
    <div className="flex items-center gap-2 font-semibold text-[#203A7C] text-sm"><Cloud size={17}/>雲端回憶短片</div>
    {!viewerOpen ? (
      <button type="button" onClick={()=>void play()} className={`group relative block w-full ${portrait ? 'aspect-[4/5]' : 'aspect-video'} overflow-hidden rounded-2xl bg-[#25364D] text-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F3FB0]`} aria-label={`播放雲端短片${posterTitle ? '：'+posterTitle : ''}`}>
        {effectivePoster && !posterFailed ? <img src={effectivePoster} onError={()=>setPosterFailed(true)} alt={posterIsReal ? '影片實際畫面' : (posterTitle ? `${posterTitle} 活動封面` : '活動封面')} className={`absolute inset-0 h-full w-full ${posterIsReal ? 'object-contain' : 'object-cover'} transition-transform duration-200 group-active:scale-[1.02]`}/> : <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-[#243B56] via-[#34596A] to-[#17243C]"/>}
        <span className="absolute inset-0 bg-black/30" aria-hidden="true"/>
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2"><span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-[#1F3FB0] shadow-lg"><Play size={29} fill="currentColor" className="ml-1"/></span><span className="rounded-full bg-black/55 px-3 py-1 text-sm font-semibold">播放回憶短片</span></span>
        <span className="absolute bottom-3 right-3 rounded-lg bg-black/65 px-2.5 py-1 text-[11px] font-semibold">{formatSize(video!.size)}</span>
        {effectivePoster && <span className="absolute bottom-3 left-3 rounded-lg bg-black/60 px-2 py-1 text-[10px]">{posterIsReal?'影片封面':'活動封面（尚無影片縮圖）'}</span>}
      </button>
    ) : (
      <div className="space-y-2" aria-label="回憶短片 HTML5 播放">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-semibold text-[#203A7C]">{posterTitle || '回憶短片'}</span>
          <button type="button" onClick={stopPlayback} className="inline-flex min-h-10 items-center gap-1 rounded-full bg-white px-3 py-2 text-xs text-[#203A7C] ring-1 ring-black/10"><X size={15}/>收起影片</button>
        </div>
        {loading ? <div className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-xl bg-[#19273A] p-4 text-white" role="status">
          <Loader2 size={24} className="animate-spin"/><span className="text-sm">正在準備私人影片… {progress}%</span>
          <span className="text-xs text-white/70">首次下載可能較慢；完成後將在這台手機快取。</span>
          <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/20"><div className="h-full bg-white" style={{width:`${progress}%`}}/></div>
        </div> : playError ? <div className="rounded-xl bg-red-50 p-3 space-y-2">
          <p className="text-xs text-red-800" role="alert">{playError}</p>
          <button type="button" onClick={()=>void play()} className="rounded-full bg-[#1F3FB0] px-3 py-2 text-xs text-white">重試下載</button>
        </div> : videoUrl ? <div className="space-y-2">
          <div className={`mx-auto w-full overflow-hidden rounded-xl bg-black ${portrait?'max-w-[360px]':''}`}>
            <video ref={inlineRef} key={videoUrl} src={videoUrl} controls playsInline autoPlay preload="metadata"
              controlsList="nofullscreen" disablePictureInPicture
              className="block h-auto w-full max-h-[65dvh] object-contain" />
          </div>
          <button type="button" onClick={openExpanded} className="mx-auto flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1F3FB0] px-4 py-2 text-sm font-semibold text-white">
            <Maximize2 size={17}/>符合螢幕放大（不自動旋轉）
          </button>
        </div> : null}
        {sourceLabel&&<p className="text-center text-[11px] text-[#5B6070]">{sourceLabel}</p>}
      </div>
    )}
    <a href={driveUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#1F3FB0] text-xs underline"><ExternalLink size={14}/>若內嵌播放失敗，請在 Google Drive 中開啟</a>
    {expanded && videoUrl && createPortal(
      <div data-waybook-video-viewer role="dialog" aria-modal="true" aria-label="回憶短片放大播放"
        className="fixed inset-0 z-[9999] flex flex-col bg-black text-white" style={{height:'100dvh'}}>
        <div className="flex shrink-0 items-center justify-between px-3 pt-[max(env(safe-area-inset-top),8px)] pb-2">
          <span className="min-w-0 truncate text-xs">{posterTitle || '回憶短片'}</span>
          <button type="button" onClick={requestCloseExpanded} className="flex min-h-11 items-center gap-2 rounded-full bg-white/15 px-4 text-sm">
            <Minimize2 size={16}/>返回行程
          </button>
        </div>
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
            <video ref={expandedRef} src={videoUrl} playsInline preload="metadata"
              onLoadedMetadata={syncExpanded}
              onTimeUpdate={e=>setCurrentTime(e.currentTarget.currentTime)}
              onDurationChange={e=>setDuration(Number.isFinite(e.currentTarget.duration)?e.currentTarget.duration:0)}
              onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)}
              className="block max-w-full max-h-full object-contain"
              style={landscape?{
                width:'100dvh',height:'100dvw',maxWidth:'none',maxHeight:'none',
                transform:'rotate(90deg)',objectFit:'contain'
              }:{width:'100%',height:'100%',objectFit:'contain'}}
              onClick={togglePlay}/>
          </div>
        </div>
        <div className="shrink-0 space-y-3 bg-black/95 px-3 pt-3 pb-[max(env(safe-area-inset-bottom),16px)]">
          <input type="range" aria-label="影片進度" min={0} max={duration || 1} step={0.1} value={Math.min(currentTime,duration || 1)}
            onChange={e=>{const v=expandedRef.current;if(v){v.currentTime=Number(e.target.value);setCurrentTime(v.currentTime);}}}
            className="w-full accent-white"/>
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={togglePlay} aria-label={playing?'暫停影片':'播放影片'} className="flex min-h-11 items-center gap-2 rounded-full bg-white/15 px-4 text-sm">
              {playing?<Pause size={18}/>:<Play size={18}/>} {playing?'暫停':'播放'}
            </button>
            <button type="button" onClick={()=>{const value=!muted;setMuted(value);if(expandedRef.current)expandedRef.current.muted=value;}}
              aria-label={muted?'開啟聲音':'靜音'} className="flex min-h-11 items-center rounded-full bg-white/15 px-3">
              {muted?<VolumeX size={18}/>:<Volume2 size={18}/>}
            </button>
            <button type="button" onClick={()=>setLandscape(value=>!value)}
              className="flex min-h-11 items-center gap-2 rounded-full bg-white/15 px-4 text-sm">
              {landscape?<RotateCcw size={18}/>:<RotateCw size={18}/>}
              {landscape?'返回直向':'橫向放大'}
            </button>
          </div>
        </div>
      </div>,document.body
    )}
  </section>;
}
