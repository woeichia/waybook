import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Cloud, ExternalLink, Loader2, Play, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { cloudRead, cloudWrite, getGoogleIdToken, GOOGLE_CLIENT_ID } from '../utils/driveCloud';

/**
 * v15.3B - metadata only. The video bytes are NOT cached or fetched by Waybook.
 * Drive's own authorization is enforced by the preview iframe/new-tab page.
 * Never use unlisted / anyone-with-link permissions automatically.
 */
type VideoRef = { id: string; size: number; mimeType: string };
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

export function CloudVideoGallery({stopId,readOnly}: {stopId:string; readOnly:boolean}) {
  const [index,setIndex] = useState<VideoIndex|null>(()=>readIndex());
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [fileId,setFileId] = useState('');
  const [viewerOpen,setViewerOpen] = useState(false);
  const [publishing,setPublishing] = useState(false);
  const [status,setStatus] = useState('');
  const requestRef = useRef(false);
  const refresh = useCallback(async (silent = false) => {
    if(requestRef.current) return;
    requestRef.current = true;
    if(!silent) setBusy(true);
    try {
      const next = await cloudRead<VideoIndex>({action:'videos'},20000);
      if(!next || !next.videos || typeof next.updatedAt !== 'string') throw new Error('影片索引回傳格式不正確');
      // Same index: retain the cached object; never discard media or redraw unnecessarily.
      setIndex(prev => prev?.updatedAt === next.updatedAt ? prev : next);
      writeIndex(next);
      if(!silent) setError('');
    } catch(e) {
      if(!silent) setError(e instanceof Error ? e.message : '無法檢查雲端短片');
      // A failed network call must never erase cached metadata.
    } finally { requestRef.current = false; if(!silent) setBusy(false); }
  },[]);

  useEffect(()=>{
    const cached=readIndex();
    if(cached) setIndex(cached);
    void refresh(true);
    const onFocus=()=>{ if(!document.hidden) void refresh(true); };
    document.addEventListener('visibilitychange',onFocus);
    return ()=>document.removeEventListener('visibilitychange',onFocus);
  },[refresh]);

  // v15.3A upload test can notify us about its latest file ID without publishing.
  useEffect(()=>{
    const onUpload=(event:Event)=>{
      const detail=(event as CustomEvent<{stopId:string;fileId:string}>).detail;
      if(detail?.stopId===stopId && DRIVE_ID.test(detail.fileId)) setFileId(detail.fileId);
    };
    window.addEventListener('waybook:driveVideoUploaded',onUpload);
    return ()=>window.removeEventListener('waybook:driveVideoUploaded',onUpload);
  },[stopId]);

  const video=index?.videos?.[stopId];
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

  const publish=async()=>{
    const id=fileId.trim();
    if(!DRIVE_ID.test(id)){setError('請填寫有效的 Google Drive File ID');return;}
    if(!window.confirm('將此 Drive 私人短片加入這個行程活動？此動作不會公開影片。只有獲得 Drive 個別授權的家庭成員可以觀看。'))return;
    setPublishing(true);setError('');setStatus('');
    try {
      const token=await getGoogleIdToken(GOOGLE_CLIENT_ID);
      await cloudWrite<{updatedAt:string}>('registerVideo',{stopId,fileId:id},token);
      setStatus('影片已登錄並移至 Waybook Family Videos 子資料夾。請將該資料夾以「檢視者」身分分享給家人的 Google 帳戶。');
      await refresh();
    } catch(e) {setError(e instanceof Error?e.message:'影片登錄失敗');}
    finally {setPublishing(false);}
  };
  const unpublish=async()=>{
    if(!window.confirm('從 Waybook 行程移除此影片？Drive 原始影片不會被刪除。'))return;
    setPublishing(true);setError('');setStatus('');
    try {
      const token=await getGoogleIdToken(GOOGLE_CLIENT_ID);
      await cloudWrite('removeVideo',{stopId},token);
      setStatus('已移除行程影片參照。Drive 檔案未刪除。');
      await refresh();
    }catch(e){setError(e instanceof Error?e.message:'取消發布失敗');}
    finally{setPublishing(false);}
  };

  if(readOnly && !available) return null;
  return <section className="mt-4 rounded-2xl bg-[#F0F2F7] p-3 ring-1 ring-[#1F3FB0]/15 space-y-3" aria-label="Google Drive 雲端回憶短片">
    <div className="flex items-center gap-2 font-semibold text-[#203A7C] text-sm"><Cloud size={17}/>雲端回憶短片</div>
    {available ? <>
      <button type="button" onClick={()=>setViewerOpen(true)} className="flex items-center justify-center gap-3 w-full rounded-xl bg-[#1B294B] min-h-[88px] text-white" aria-label="播放短片（雲端）"><Play size={22}/>播放雲端影片 <span className="text-xs text-white/70">{formatSize(video!.size)}</span></button>
      <p className="text-xs text-[#5B6070]">只在按播放後載入影片；Google Drive 會檢查您是否有觀看權限。首次觀看可能需要登入獲邀請的 Google 帳戶。</p>
      <a href={driveUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#1F3FB0] text-xs underline"><ExternalLink size={14}/>若內嵌播放失敗，請在 Google Drive 中開啟</a>
    </> : <p className="text-xs text-[#5B6070]">此活動尚未發布雲端影片。</p>}
    {!readOnly && <div className="border-t border-[#1F3FB0]/10 pt-3 space-y-2">
      <p className="text-xs leading-relaxed text-[#4A5568] flex gap-1 items-start"><ShieldCheck size={15} className="shrink-0"/>管理員：先使用上方 v15.3A 上傳測試功能取得 File ID，然後在這裡登錄。登錄會將影片移入 Waybook Family Videos 私人子資料夾，不會公開分享。</p>
      <input aria-label="要發布的 Drive File ID" type="text" className="w-full rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-black/10" placeholder="貼上已上傳的 Google Drive File ID" value={fileId} onChange={e=>setFileId(e.target.value)}/>
      <div className="flex gap-2 flex-wrap">
        <button type="button" disabled={publishing||busy} onClick={()=>void publish()} className="rounded-full bg-[#1F3FB0] px-4 py-2 text-xs text-white disabled:opacity-40">{publishing?'處理中…':'登錄雲端影片'}</button>
        {available && <button type="button" disabled={publishing} onClick={()=>void unpublish()} className="rounded-full bg-white px-3 py-2 text-xs text-red-700 ring-1 ring-black/10 disabled:opacity-40">移除影片參照</button>}
        <button type="button" disabled={busy} onClick={()=>void refresh()} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-2 text-xs ring-1 ring-black/10"><RefreshCw size={13}/>{busy?'檢查中':'檢查更新'}</button>
      </div>
      {status&&<p role="status" className="text-xs text-green-800">{status}</p>}
    </div>}
    {error&&<p role="alert" className="text-xs text-red-700">{error}</p>}
    {viewerOpen&&available&&createPortal(<div data-waybook-video-viewer role="dialog" aria-modal="true" aria-label="雲端影片" className="fixed inset-0 z-[9999] bg-black/95 flex flex-col items-center justify-center p-2" onClick={close}>
      <button type="button" className="absolute top-3 right-3 z-10 rounded-full bg-white/20 text-white p-3" onClick={e=>{e.stopPropagation();close();}} aria-label="關閉雲端影片"><X size={22}/></button>
      <iframe src={previewUrl} title="Google Drive 私人影片播放" allow="autoplay; fullscreen" allowFullScreen className="w-full max-w-3xl h-[76dvh] border-0 bg-black" onClick={e=>e.stopPropagation()}/>
      <a href={driveUrl} target="_blank" rel="noopener noreferrer" className="mt-3 text-sm text-white underline" onClick={e=>e.stopPropagation()}>無法播放？使用 Google Drive 開啟</a>
    </div>,document.body)}
  </section>;
}
