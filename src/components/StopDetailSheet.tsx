import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Camera, Clock, Images, Loader2, MapPin, Navigation, RotateCcw, Star, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { ItineraryStop } from '../types/itinerary';
import { buildStopMapsUrl } from '../utils/itinerary';
import { compressImageToDataUrl } from '../utils/customPhotos';
import { MAX_PHOTOS_PER_STOP } from '../utils/photoGallery';
import { CategoryBadge } from './CategoryBadge';
import { SmartImage } from './SmartImage';
import { MemoryGallery, type MemoryPhoto } from './MemoryGallery';
import { MemoryClipPilot } from './MemoryClipPilot';
import { DriveVideoUploadPilot } from './DriveVideoUploadPilot';
import { CloudVideoGallery } from './CloudVideoGallery';
import type { UiSoundKind } from '../utils/uiSounds';

interface StopDetailSheetProps {
  stop: ItineraryStop | null;
  gallery: string[];
  memoryPhotos: MemoryPhoto[];
  onSaveMemories: (stopId:string, photos:MemoryPhoto[])=>Promise<void>;
  onSaveGallery: (stopId: string, photos: string[]) => Promise<void>;
  onGalleryTick?: () => void;
  onMemorySound?: (kind: UiSoundKind) => void;
  onClose: () => void;
  readOnly?: boolean;
}

export const StopDetailSheet: React.FC<StopDetailSheetProps> = ({ stop, gallery, memoryPhotos, onSaveMemories, onSaveGallery, onGalleryTick, onMemorySound, onClose, readOnly = false }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullView, setFullView] = useState(false);
  const fullViewRef = useRef(false);
  fullViewRef.current = fullView;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const images = stop ? [...gallery, ...(gallery.length === 0 && stop.image ? [stop.image] : []), ...(stop.images ?? [])].slice(0, MAX_PHOTOS_PER_STOP) : [];
  const localImageCount = gallery.length;
  const imageCount = images.length;
  const showingOriginal = localImageCount === 0;

  useEffect(() => {
    setPosition(0); setError(null); setFullView(false);
    scrollRef.current?.scrollTo({ left: 0 });
  }, [stop?.id]);

  useEffect(() => {
    if (!stop) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { if (document.querySelector('[data-waybook-video-viewer], [data-waybook-memory-photo-viewer]')) return; if (fullView) setFullView(false); else onClose(); }
      if (fullView && event.key === 'ArrowRight') {
        setPosition((p) => {
          const next = Math.min(imageCount - 1, p + 1);
          if (next !== p) onGalleryTick?.();
          return next;
        });
      }
      if (fullView && event.key === 'ArrowLeft') {
        setPosition((p) => {
          const next = Math.max(0, p - 1);
          if (next !== p) onGalleryTick?.();
          return next;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stop, onClose, fullView, imageCount, onGalleryTick]);

  useEffect(() => {
    if (!stop) return;
    const back = () => {
      if (document.querySelector('[data-waybook-video-viewer], [data-waybook-memory-photo-viewer]')) return;
      if (fullViewRef.current) setFullView(false);
      else onCloseRef.current();
    };
    window.addEventListener('waybook:back', back);
    return () => window.removeEventListener('waybook:back', back);
  }, [stop?.id]);

  const goTo = (next: number) => {
    const n = Math.min(Math.max(next, 0), imageCount - 1);
    if (n !== position) onGalleryTick?.();
    setPosition(n);
    if (scrollRef.current) scrollRef.current.scrollTo({ left: n * scrollRef.current.clientWidth, behavior: 'smooth' });
  };

  const choosePhotos = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!stop || !files.length) return;
    const remaining = MAX_PHOTOS_PER_STOP - localImageCount;
    if (files.length > remaining) { setError(`最多可以存 ${MAX_PHOTOS_PER_STOP} 張照片，目前還可加 ${remaining} 張。`); return; }
    setBusy(true); setError(null);
    try {
      const additions: string[] = [];
      for (const file of files) {
        if (!file.type.startsWith('image/')) throw new Error('請選擇圖片檔案。');
        additions.push(await compressImageToDataUrl(file, 1200, 0.76));
      }
      await onSaveGallery(stop.id, [...gallery, ...additions]);
      goTo(0);
    } catch (e) { setError(e instanceof Error ? e.message : '照片儲存失敗。'); }
    finally { setBusy(false); }
  };

  const changeGallery = async (next: string[]) => {
    if (!stop) return;
    setBusy(true); setError(null);
    try { await onSaveGallery(stop.id, next); setPosition(0); scrollRef.current?.scrollTo({ left: 0 }); }
    catch (e) { setError(e instanceof Error ? e.message : '照片儲存失敗。'); }
    finally { setBusy(false); }
  };

  return <AnimatePresence>
    {stop && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm p-0 sm:p-4" onClick={onClose} data-waybook-event-viewer role="dialog" aria-modal="true" aria-labelledby="stop-detail-title">
      <motion.div initial={{y:40,opacity:0}} animate={{y:0,opacity:1}} exit={{y:40,opacity:0}} transition={{duration:0.22}} className="w-full max-w-[480px] rounded-t-3xl sm:rounded-3xl bg-[#F4F2ED] overflow-hidden shadow-2xl max-h-[92vh] flex flex-col" onClick={e=>e.stopPropagation()}>
        <div className="relative shrink-0 bg-[#E5E2DC]">
          <div ref={scrollRef} className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none" style={{scrollbarWidth:'none'}} onScroll={e=>{const el=e.currentTarget; setPosition(Math.min(imageCount-1,Math.max(0,Math.round(el.scrollLeft/Math.max(1,el.clientWidth)))));}}>
            {imageCount ? images.map((src,i)=><button key={`${stop.id}-${i}`} type="button" className="w-full aspect-[5/3] shrink-0 snap-center overflow-hidden bg-[#DFDDD6]" onClick={()=>{setPosition(i);setFullView(true);}} aria-label={`放大照片 ${i+1}`}>
              <SmartImage src={src} alt={`${stop.title} 照片 ${i+1}`} category={stop.category} className="h-full w-full object-cover"/>
            </button>) : <div className="w-full aspect-[5/3] shrink-0"><SmartImage src="" alt={stop.title} category={stop.category} className="w-full h-full"/></div>}
          </div>
          <div className="absolute inset-x-0 bottom-0 h-16 pointer-events-none bg-gradient-to-t from-black/40 to-transparent"/>
          {imageCount > 1 && <>
            <button data-sound-control className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 rounded-full p-2 disabled:opacity-30" aria-label="上一張照片" disabled={position===0} onClick={()=>goTo(position-1)}><ArrowLeft className="w-4 h-4"/></button>
            <button data-sound-control className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 rounded-full p-2 disabled:opacity-30" aria-label="下一張照片" disabled={position===imageCount-1} onClick={()=>goTo(position+1)}><ArrowRight className="w-4 h-4"/></button>
            <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-1.5 pointer-events-none">{images.map((_,i)=><span key={i} className={`h-1.5 rounded-full ${position===i?'w-5 bg-white':'w-1.5 bg-white/60'}`}/>)}</div>
          </>}
          <span className="absolute top-3 left-3 rounded-full bg-black/50 text-white text-xs px-3 py-1 flex items-center gap-1.5"><Images className="w-3.5 h-3.5"/>{Math.min(position+1,Math.max(1,imageCount))}/{Math.max(1,imageCount)}</span>
          <button type="button" aria-label="關閉詳情" onClick={onClose} className="absolute right-3 top-3 min-w-11 min-h-11 flex justify-center items-center rounded-full bg-white/95"><X className="w-5 h-5"/></button>
        </div>
        <div className="p-5 sm:p-6 overflow-y-auto">
          <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-xs text-[#5E5A52]"><Clock className="w-3.5 h-3.5 text-[#1F3FB0]"/>{stop.time}</span><CategoryBadge category={stop.category}/></div>
          <h3 id="stop-detail-title" className="mt-2 font-calligraphy text-[26px] font-semibold text-[#1A1A1A]">{stop.title}</h3>
          <div className="mt-2 flex gap-1.5 text-xs text-[#5E5A52]"><MapPin className="w-3.5 h-3.5 text-[#1F3FB0]"/>{stop.locationName}</div>
          {stop.description && <p className="mt-4 text-sm leading-relaxed text-[#3F3D38]">{stop.description}</p>}
          {stop.transitToNext.trim() && <div className="mt-4 rounded-xl bg-[#EDEBE6] p-3 flex gap-2 text-xs text-[#5E5A52]"><Navigation className="w-4 h-4 text-[#1F3FB0] shrink-0"/>前往下一站：{stop.transitToNext}</div>}
          <MemoryGallery stopId={stop.id} photos={memoryPhotos} onSave={onSaveMemories} readOnly={readOnly} onSound={onMemorySound}/>
          {!readOnly && <MemoryClipPilot stopId={stop.id}/>}
          {!readOnly && <DriveVideoUploadPilot stopId={stop.id}/>}
          <CloudVideoGallery stopId={stop.id} readOnly={readOnly}/>
          <div className="mt-5 pt-4 border-t border-black/10 space-y-3">
            {!readOnly && <>
            <div className="flex items-center justify-between"><h4 className="font-semibold text-sm">行程參考照片</h4><span className="text-xs text-[#5E5A52]">本機上傳 {localImageCount}/{MAX_PHOTOS_PER_STOP}</span></div>
            <p className="text-xs text-[#66635E]">第一張是行程卡片封面；左右滑動瀏覽照片，點擊可查看完整照片。</p>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={choosePhotos}/>
            <button type="button" onClick={()=>fileInputRef.current?.click()} disabled={busy||localImageCount>=MAX_PHOTOS_PER_STOP} className="w-full min-h-11 bg-[#E4E5F0] rounded-xl flex items-center justify-center gap-2 font-semibold text-sm text-[#1F3FB0] disabled:opacity-50">{busy?<Loader2 className="w-4 h-4 animate-spin"/>:<Camera className="w-4 h-4"/>}上傳照片（可一次選多張）</button>
            {localImageCount > 0 && <div className="grid grid-cols-4 gap-2">{gallery.map((src,i)=><div key={`${stop.id}-edit-${i}`} className="space-y-1"><div className="relative aspect-square overflow-hidden rounded-lg"><img src={src} alt={`上傳照片 ${i+1}`} className="w-full h-full object-cover"/>{i===0&&<span className="absolute bottom-0 inset-x-0 bg-[#1F3FB0]/85 text-center text-white text-[10px]">封面</span>}</div><div className="flex justify-center gap-1"><button title="設為封面" aria-label={`照片 ${i+1} 設為封面`} disabled={busy||i===0} className="p-1 rounded bg-white disabled:opacity-30" onClick={()=>changeGallery([src,...gallery.filter((_,j)=>j!==i)])}><Star className="w-3.5 h-3.5"/></button><button title="刪除照片" aria-label={`刪除照片 ${i+1}`} disabled={busy} className="p-1 rounded bg-white text-red-700" onClick={()=>changeGallery(gallery.filter((_,j)=>j!==i))}><Trash2 className="w-3.5 h-3.5"/></button></div></div>)}</div>}
            {localImageCount>0 && <button type="button" disabled={busy} onClick={()=>changeGallery([])} className="flex gap-1 items-center text-xs text-[#5E5A52]"><RotateCcw className="w-3.5 h-3.5"/>還原原本的景點封面</button>}
            {showingOriginal && <p className="text-xs text-[#5E5A52]">尚未上傳照片，目前顯示內建景點圖片。上傳後第一張會取代封面。</p>}
            {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
            </>}
            <a href={buildStopMapsUrl(stop.mapQuery)} target="_blank" rel="noopener noreferrer" className="w-full min-h-12 rounded-xl bg-[#1F3FB0] text-white flex items-center justify-center gap-2 text-sm font-semibold">在 Google Maps 開啟導航 <ArrowUpRight className="w-4 h-4"/></a>
          </div>
        </div>
      </motion.div>
      {fullView && imageCount>0 && <div data-waybook-ref-photo-viewer className="fixed inset-0 z-[60] bg-black/95 flex flex-col items-center justify-center p-4" onClick={e=>e.stopPropagation()} role="dialog" aria-modal="true" aria-label="完整照片">
        <button type="button" onClick={()=>setFullView(false)} aria-label="關閉照片" className="absolute top-5 right-5 text-white bg-white/20 rounded-full p-3"><X className="w-6 h-6"/></button>
        <img src={images[position]} alt={`${stop.title} 完整照片 ${position+1}`} className="max-w-full max-h-[78vh] object-contain"/>
        <div className="mt-5 flex gap-5 items-center text-white"><button data-sound-control aria-label="上一張照片" disabled={position===0} onClick={()=>goTo(position-1)} className="p-2 disabled:opacity-30"><ArrowLeft/></button><span className="text-sm">{position+1} / {imageCount}</span><button data-sound-control aria-label="下一張照片" disabled={position===imageCount-1} onClick={()=>goTo(position+1)} className="p-2 disabled:opacity-30"><ArrowRight/></button></div>
      </div>}
    </motion.div>}
  </AnimatePresence>;
};
