import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Camera, Clock, Images, Loader2, MapPin, Navigation, RotateCcw, Star, Trash2, X } from 'lucide-react';
import { PhotoSwipeStage } from './PhotoSwipeStage';
import type { ItineraryStop } from '../types/itinerary';
import { buildStopMapsUrl } from '../utils/itinerary';
import { compressImageToDataUrl } from '../utils/customPhotos';
import { MAX_PHOTOS_PER_STOP } from '../utils/photoGallery';
import { CategoryBadge } from './CategoryBadge';
import { SmartImage } from './SmartImage';
import { MemoryGallery, type MemoryPhoto } from './MemoryGallery';
import { VideoPublishPanel } from './VideoPublishPanel';
import { CloudVideoGallery } from './CloudVideoGallery';
import { VideoPlayerLab } from './VideoPlayerLab';
import type { UiSoundKind } from '../utils/uiSounds';

interface StopDetailSheetProps {
  stop: ItineraryStop | null;
  gallery: string[];
  memoryPhotos: MemoryPhoto[];
  onSaveMemories: (stopId:string, photos:MemoryPhoto[])=>Promise<void>;
  onSaveGallery: (stopId: string, photos: string[]) => Promise<void>;
  onGalleryTick?: () => void;
  onMemorySound?: (kind: UiSoundKind) => void;
  sourceRect: {x:number;y:number;width:number;height:number}|null;
  onClose: () => void;
  readOnly?: boolean;
}

export const StopDetailSheet: React.FC<StopDetailSheetProps> = ({ stop, gallery, memoryPhotos, onSaveMemories, onSaveGallery, onGalleryTick, onMemorySound, sourceRect, onClose, readOnly = false }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const eventHeaderRef = useRef<HTMLDivElement>(null);
  const eventSheetRef = useRef<HTMLDivElement>(null);
  const eventBackdropRef = useRef<HTMLDivElement>(null);
  const suppressClickUntil=useRef(0);
  const edgeStateRef = useRef<{startX:number;startY:number;direction:'up'|'down'|null;amount:number;top:boolean;bottom:boolean}|null>(null);
  const [position, setPosition] = useState(0);
  const positionRef=useRef(0);positionRef.current=position;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullView, setFullView] = useState(false);
  const closingRef = useRef(false);
  const pendingBackRef = useRef(false);
  const animationRef = useRef<Animation|null>(null);
  const backdropAnimationRef = useRef<Animation|null>(null);
  const photoBackPendingRef = useRef(false);
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
    if(eventSheetRef.current)eventSheetRef.current.scrollTop=0;
  }, [stop?.id]);

  const cardTransform = (panel: HTMLElement, opening=false) => {
    const card = Array.from(document.querySelectorAll<HTMLElement>('[data-waybook-stop-id]')).find(el=>el.dataset.waybookStopId===stop?.id);
    const rect = card?.getBoundingClientRect();
    const target = opening && sourceRect ? sourceRect : rect ? {x:rect.left,y:rect.top,width:rect.width,height:rect.height} : sourceRect;
    // offset dimensions are untransformed; temporarily measuring with transform removed avoids drag geometry contamination.
    const old = panel.style.transform;
    panel.style.transform='none';
    const base = panel.getBoundingClientRect();
    panel.style.transform=old;
    if(!target || !base.width || !base.height) return 'translateY(24px) scale(.94)';
    return `translate(${target.x-base.left}px, ${target.y-base.top}px) scale(${target.width/base.width}, ${target.height/base.height})`;
  };
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  useLayoutEffect(()=>{
    if(!stop || !eventSheetRef.current || !eventBackdropRef.current)return;
    const panel=eventSheetRef.current, backdrop=eventBackdropRef.current;
    closingRef.current=false;pendingBackRef.current=false;
    const oldOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    panel.scrollTop=0;
    const duration=reduced()?0:300;
    animationRef.current=panel.animate([{transform:cardTransform(panel,true),opacity:0},{opacity:1,offset:.18},{transform:'none',opacity:1}],{duration,easing:'cubic-bezier(.22,.8,.24,1)'});
    backdropAnimationRef.current=backdrop.querySelector<HTMLElement>('[data-motion-scrim]')!.animate([{opacity:0},{opacity:1}],{duration,easing:'ease-out'});
    return()=>{animationRef.current?.cancel();backdropAnimationRef.current?.cancel();document.body.style.overflow=oldOverflow;};
  },[stop?.id]);
  const finishClose = () => {
    if(closingRef.current)return;
    closingRef.current=true;pendingBackRef.current=false;
    const panel=eventSheetRef.current, backdrop=eventBackdropRef.current;
    if(!panel||!backdrop){onCloseRef.current();return;}
    const current=getComputedStyle(panel).transform;
    const currentOpacity=getComputedStyle(panel).opacity;
    const scrim=backdrop.querySelector<HTMLElement>('[data-motion-scrim]')!;
    const shade=getComputedStyle(scrim).opacity;
    animationRef.current?.cancel();backdropAnimationRef.current?.cancel();
    panel.style.transition='none';panel.style.transform=current;
    const target=cardTransform(panel);
    const duration=reduced()?0:310;
    animationRef.current=panel.animate([{transform:current,opacity:Number(currentOpacity)},{opacity:1,offset:.8},{transform:target,opacity:0}],{duration,easing:'cubic-bezier(.22,.8,.24,1)',fill:'forwards'});
    backdropAnimationRef.current=scrim.animate([{opacity:Number(shade)},{opacity:0}],{duration,easing:'ease-out',fill:'forwards'});
    animationRef.current.finished.then(()=>onCloseRef.current()).catch(()=>{});
  };
  const closeActionRef=useRef(finishClose);closeActionRef.current=finishClose;
  const requestClose = () => {
    if(closingRef.current||pendingBackRef.current)return;
    if(window.history.state?.waybookNav && window.history.state.layer==='event'){
      pendingBackRef.current=true;window.history.back();
    }else finishClose();
  };
  const requestCloseRef=useRef(requestClose);requestCloseRef.current=requestClose;
  const openReferencePhoto = (index:number) => {
    if(fullViewRef.current||closingRef.current||pendingBackRef.current)return;
    window.history.pushState({...window.history.state,waybookNav:true,layer:'media'},'',window.location.href);
    photoBackPendingRef.current=false;fullViewRef.current=true;setPosition(index);setFullView(true);
  };
  const closeReferencePhoto = () => {
    if(!fullViewRef.current||photoBackPendingRef.current)return;
    if(window.history.state?.waybookNav && window.history.state.layer==='media'){photoBackPendingRef.current=true;window.history.back();}
    else {fullViewRef.current=false;setFullView(false);}
  };
  useEffect(() => {
    if (!stop) return;
    const onKey = (event: KeyboardEvent) => {
      if (document.querySelector('[data-waybook-video-viewer], [data-waybook-memory-photo-viewer]')) return;
      if (event.key === 'Escape') { if (fullView) closeReferencePhoto(); else requestClose(); }
      if (fullView && event.key === 'ArrowRight') goTo(position+1);
      if (fullView && event.key === 'ArrowLeft') goTo(position-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  useEffect(() => {
    if (!stop) return;
    const back = (event:Event) => {
      if ((event as CustomEvent).detail?.layer==='media' && !fullViewRef.current) return;
      if (document.querySelector('[data-waybook-video-viewer], [data-waybook-memory-photo-viewer]')) return;
      if (fullViewRef.current) {photoBackPendingRef.current=false;fullViewRef.current=false;setFullView(false); if(scrollRef.current)scrollRef.current.scrollTo({left:positionRef.current*scrollRef.current.clientWidth,behavior:'auto'}); }
      else closeActionRef.current();
    };
    window.addEventListener('waybook:back', back);
    return () => window.removeEventListener('waybook:back', back);
  }, [stop?.id]);

  // Motion test: dismiss only from a fresh gesture when event content is already at an edge.
  // Nested photo and video interactions keep their own gestures.
  useEffect(()=>{
    if(!stop)return;
    const panel=eventSheetRef.current;
    const header=eventHeaderRef.current;
    const sheet=eventSheetRef.current;
    const backdrop=eventBackdropRef.current;
    if(!panel||!header||!sheet||!backdrop)return;
    const priorOverflowY=sheet.style.overflowY;
    const priorOverscroll=sheet.style.overscrollBehaviorY;
    sheet.style.overflowY='auto';
    sheet.style.overscrollBehaviorY='contain';
    const floatingClose=sheet.querySelector<HTMLElement>('[data-motion-v2-close]');
    const updateClose=()=>{if(floatingClose)floatingClose.style.visibility=panel.scrollTop>60?'visible':'hidden';};
    panel.addEventListener('scroll',updateClose,{passive:true});updateClose();

    const scrim=backdrop.querySelector<HTMLElement>('[data-motion-scrim]')!;
    let frame=0, width=0, height=0;
    const cancelFrame=()=>{if(frame)cancelAnimationFrame(frame);frame=0;};
    const renderDrag=()=>{
      frame=0;const state=edgeStateRef.current;if(!state?.direction)return;
      const amount=state.amount,scale=1-Math.min(.18,amount/950);
      const shift=(state.direction==='down'?1:-1)*amount*.48;
      sheet.style.transform=`translate3d(${width*(1-scale)/2}px, ${shift+height*(1-scale)/2}px, 0) scale(${scale})`;
      scrim.style.opacity=String(Math.max(.06,.55-amount/650)/.55);
    };
    const excluded='button,a,input,textarea,select,video,[contenteditable="true"],[role="slider"],[data-waybook-video-viewer],[data-waybook-memory-photo-viewer],[data-waybook-ref-photo-viewer],.overflow-x-auto';
    const touchStart=(e:TouchEvent)=>{
      const el=e.target as Element;
      const coverButton=el.closest('button[aria-label^="放大照片"]');
      const videoPoster=el.closest('[data-motion-video-poster]');
      const inlineVideo=el.closest<HTMLVideoElement>('video[data-motion-inline-video]');
      // Reserve the lower portion of the native player for seek/play controls.
      const videoSurface=inlineVideo && e.touches[0] && e.touches[0].clientY < inlineVideo.getBoundingClientRect().bottom-Math.min(80,inlineVideo.clientHeight*.4);
      if(e.touches.length!==1||closingRef.current||pendingBackRef.current||(el.closest(excluded)&&!coverButton&&!videoPoster&&!videoSurface)){edgeStateRef.current=null;return;}
      const t=e.touches[0];if(t.clientX<=35){edgeStateRef.current=null;return;}const bottom=panel.scrollHeight-panel.clientHeight-panel.scrollTop<=3;
      edgeStateRef.current={startX:t.clientX,startY:t.clientY,direction:null,amount:0,top:panel.scrollTop<=3,bottom};
    };
    const touchMove=(e:TouchEvent)=>{
      const state=edgeStateRef.current;
      if(!state||e.touches.length!==1||closingRef.current||pendingBackRef.current)return;
      const t=e.touches[0];const dx=t.clientX-state.startX,dy=t.clientY-state.startY;
      if(!state.direction){
        if(Math.abs(dx)>Math.abs(dy)*1.25&&Math.abs(dx)>18){edgeStateRef.current=null;return;}
        if(Math.abs(dy)<10)return;
        const dir=dy>0?'down':'up';
        if(!((dir==='down'&&state.top)||(dir==='up'&&state.bottom))){edgeStateRef.current=null;return;}
        state.direction=dir;
        width=sheet.clientWidth;height=sheet.clientHeight;
        animationRef.current?.cancel();backdropAnimationRef.current?.cancel();
        sheet.style.transition='none';scrim.style.transition='none';
      }
      if(e.cancelable)e.preventDefault();
      suppressClickUntil.current=Date.now()+450;
      state.amount=Math.max(0,state.direction==='down'?dy:-dy);
      if(!frame)frame=requestAnimationFrame(renderDrag);
    };
    const touchEnd=()=>{
      if(frame){cancelFrame();renderDrag();}
      const state=edgeStateRef.current;edgeStateRef.current=null;
      if(!state?.direction||closingRef.current||pendingBackRef.current)return;
      if(state.amount>=160){
        requestCloseRef.current();
      }else{
        sheet.style.transition='transform 260ms cubic-bezier(.2,.8,.2,1)';
        sheet.style.transform='';sheet.style.borderRadius='';
        scrim.style.transition='opacity 260ms ease-out';scrim.style.opacity='';
      }
    };
    for(const target of [panel]) target.addEventListener('touchstart',touchStart,{passive:true});
    for(const target of [panel]) target.addEventListener('touchmove',touchMove,{passive:false});
    for(const target of [panel]) target.addEventListener('touchend',touchEnd,{passive:true});
    const touchCancel=()=>{cancelFrame();edgeStateRef.current=null;if(closingRef.current||pendingBackRef.current)return;
      sheet.style.transition='transform 260ms cubic-bezier(.2,.8,.2,1)';
      sheet.style.transform='';sheet.style.borderRadius='';scrim.style.transition='opacity 260ms ease-out';scrim.style.opacity='';};
    for(const target of [panel]) target.addEventListener('touchcancel',touchCancel,{passive:true});
    return()=>{
      for(const target of [panel]) {target.removeEventListener('touchstart',touchStart);target.removeEventListener('touchmove',touchMove);
      target.removeEventListener('touchend',touchEnd);target.removeEventListener('touchcancel',touchCancel);}
      cancelFrame();scrim.style.opacity='';scrim.style.transition='';
      panel.removeEventListener('scroll',updateClose);sheet.style.transform='';sheet.style.transition='';sheet.style.borderRadius='';sheet.style.opacity='';sheet.style.overflowY=priorOverflowY;sheet.style.overscrollBehaviorY=priorOverscroll;backdrop.style.backgroundColor='';backdrop.style.transition='';
    };
  },[stop?.id]);

  const goTo = (next: number) => {
    const n = Math.min(Math.max(next, 0), imageCount - 1);
    if (n !== position) onGalleryTick?.();
    setPosition(n);
    if (scrollRef.current) scrollRef.current.scrollTo({ left: n * scrollRef.current.clientWidth, behavior: fullViewRef.current ? 'auto' : 'smooth' });
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

  return <>
    {stop && <div ref={eventBackdropRef} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={requestClose} data-waybook-event-viewer role="dialog" aria-modal="true" aria-labelledby="stop-detail-title">
      <div data-motion-scrim aria-hidden="true" className="absolute inset-0 bg-black/55 pointer-events-none" style={{willChange:'opacity'}}/>
      <div ref={eventSheetRef} style={{transformOrigin:'top left',willChange:'transform, opacity'}} className="relative w-full max-w-[480px] rounded-t-3xl sm:rounded-3xl bg-[#F4F2ED] overflow-hidden shadow-2xl max-h-[92vh] flex flex-col" onClickCapture={e=>{if(Date.now()<suppressClickUntil.current||closingRef.current||pendingBackRef.current){e.preventDefault();e.stopPropagation();}}} onClick={e=>e.stopPropagation()}>
        <div className="sticky top-0 z-50 h-0 shrink-0 pointer-events-none">
              <button type="button" data-motion-v2-close aria-label="關閉活動詳情" onClick={requestClose} className="pointer-events-auto absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white shadow-md" style={{touchAction:'manipulation',visibility:'hidden'}}>
                <span aria-hidden="true" className="text-2xl leading-none">×</span>
              </button>
            </div>
            <div ref={eventHeaderRef} className="relative shrink-0 bg-[#E5E2DC]">
          <div ref={scrollRef} className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none" style={{scrollbarWidth:'none'}} onScroll={e=>{if(fullViewRef.current)return;const el=e.currentTarget; setPosition(Math.min(imageCount-1,Math.max(0,Math.round(el.scrollLeft/Math.max(1,el.clientWidth)))));}}>
            {imageCount ? images.map((src,i)=><button key={`${stop.id}-${i}`} type="button" className="w-full aspect-[5/3] shrink-0 snap-center overflow-hidden bg-[#DFDDD6]" onClick={()=>openReferencePhoto(i)} aria-label={`放大照片 ${i+1}`}>
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
          <button type="button" aria-label="關閉詳情" onClick={requestClose} className="absolute right-3 top-3 min-w-11 min-h-11 flex justify-center items-center rounded-full bg-white/95"><X className="w-5 h-5"/></button>
        </div>
        <div className="p-5 sm:p-6 shrink-0 overflow-visible">
          <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-xs text-[#5E5A52]"><Clock className="w-3.5 h-3.5 text-[#1F3FB0]"/>{stop.time}</span><CategoryBadge category={stop.category}/></div>
          <h3 id="stop-detail-title" className="mt-2 font-calligraphy text-[26px] font-semibold text-[#1A1A1A]">{stop.title}</h3>
          <div className="mt-2 flex gap-1.5 text-xs text-[#5E5A52]"><MapPin className="w-3.5 h-3.5 text-[#1F3FB0]"/>{stop.locationName}</div>
          {stop.description && <p className="mt-4 text-sm leading-relaxed text-[#3F3D38]">{stop.description}</p>}
          {stop.transitToNext.trim() && <div className="mt-4 rounded-xl bg-[#EDEBE6] p-3 flex gap-2 text-xs text-[#5E5A52]"><Navigation className="w-4 h-4 text-[#1F3FB0] shrink-0"/>前往下一站：{stop.transitToNext}</div>}
          <MemoryGallery stopId={stop.id} photos={memoryPhotos} onSave={onSaveMemories} readOnly={readOnly} onSound={onMemorySound}/>
          {!readOnly && <VideoPublishPanel stopId={stop.id}/>}
          <CloudVideoGallery stopId={stop.id} readOnly={readOnly} posterSrc={images[0] || undefined} posterTitle={stop.title}/>
          {!readOnly && <VideoPlayerLab/>}
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
      </div>
      {fullView && imageCount>0 && <div data-waybook-ref-photo-viewer className="fixed inset-0 z-[60] bg-black/95 flex flex-col items-center justify-center p-4" onClick={e=>e.stopPropagation()} role="dialog" aria-modal="true" aria-label="完整照片">
        <button type="button" onClick={closeReferencePhoto} aria-label="關閉照片" className="absolute z-10 top-5 right-5 text-white bg-white/20 rounded-full p-3"><X className="w-6 h-6"/></button>
        <PhotoSwipeStage images={images.map((src,i)=>({src,alt:`${stop.title} 完整照片 ${i+1}`}))} index={position} onChange={goTo}/>
        <div className="mt-5 flex gap-5 items-center text-white"><button data-sound-control aria-label="上一張照片" disabled={position===0} onClick={()=>goTo(position-1)} className="p-2 disabled:opacity-30"><ArrowLeft/></button><span className="text-sm">{position+1} / {imageCount}</span><button data-sound-control aria-label="下一張照片" disabled={position===imageCount-1} onClick={()=>goTo(position+1)} className="p-2 disabled:opacity-30"><ArrowRight/></button></div>
      </div>}
    </div>}
  </>;
};
