import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Camera, Star, Trash2, Images, Loader2, ImageIcon, ChevronLeft, ChevronRight, Expand} from 'lucide-react';
import {compressImageToDataUrl} from '../utils/customPhotos';
import type { UiSoundKind } from '../utils/uiSounds';

export type MemoryPhoto = {id?:string;src:string;caption:string};
const MAX_MEMORIES = 12;
const CARD_WIDTH = 220;
const CARD_GAP = -44;
const rotations = ['-rotate-2','rotate-[1.5deg]','-rotate-[1deg]','rotate-2','-rotate-[1.5deg]'];

interface Props {
  stopId:string;
  photos:MemoryPhoto[];
  onSave:(stopId:string,photos:MemoryPhoto[])=>Promise<void>;
  readOnly:boolean;
  onSound?:(kind:UiSoundKind)=>void;
}

export function MemoryGallery({stopId,photos,onSave,readOnly,onSound}:Props) {
  const fileRef=useRef<HTMLInputElement>(null);
  const railRef=useRef<HTMLDivElement>(null);
  const gestureRef=useRef(false);
  const pointerStartRef=useRef<number|null>(null);
  const settledIndexRef=useRef(0);
  const settleTimerRef=useRef<ReturnType<typeof setTimeout>|null>(null);
  const lastGestureSoundRef=useRef(0);
  const soundRef=useRef(onSound);
  soundRef.current=onSound;
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [selected,setSelected]=useState<number|null>(null);
  const [active,setActive]=useState(0);

  useEffect(()=>{
    if(active>Math.max(photos.length-1,0)) setActive(Math.max(photos.length-1,0));
  },[photos.length,active]);

  const activePhoto = photos[active] || null;

  const change = async (next:MemoryPhoto[])=>{
    setBusy(true);setError('');
    try {
      await onSave(stopId,next);
      if(next.length===0) setActive(0);
      else if(active>=next.length) setActive(next.length-1);
    } catch(e){
      setError(e instanceof Error?e.message:'無法儲存回憶照片');
    } finally{
      setBusy(false);
    }
  };

  const upload = async (event:React.ChangeEvent<HTMLInputElement>)=>{
    const files=Array.from(event.target.files||[]);event.target.value='';
    if(!files.length)return;
    if(files.length+photos.length>MAX_MEMORIES){setError(`每站最多 ${MAX_MEMORIES} 張回憶照片`);return;}
    setBusy(true);setError('');
    try{
      const additions:MemoryPhoto[]=[];
      for(const file of files){
        if(!file.type.startsWith('image/')) throw new Error('僅支援照片，影片將在下一版加入');
        additions.push({src:await compressImageToDataUrl(file,1280,0.72),caption:''});
      }
      await onSave(stopId,[...photos,...additions]);
      setActive(photos.length);
      requestAnimationFrame(()=>scrollToCard(photos.length));
    }catch(e){
      setError(e instanceof Error?e.message:'上傳失敗');
    }finally{
      setBusy(false);
    }
  };

  const gestureSound = ()=>{
    gestureRef.current=true;
    const now=Date.now();
    if(now-lastGestureSoundRef.current>220){
      lastGestureSoundRef.current=now;
      soundRef.current?.('slide');
    }
  };

  useEffect(()=>()=>{if(settleTimerRef.current) clearTimeout(settleTimerRef.current);},[]);

  const scrollToCard = (index:number)=>{
    const rail = railRef.current;
    const el = rail?.querySelector<HTMLElement>(`[data-card-index="${index}"]`);
    el?.scrollIntoView({behavior:'smooth', inline:'center', block:'nearest'});
  };

  const moveActive = (next:number)=>{
    const index = Math.min(Math.max(next,0), photos.length-1);
    gestureSound();
    setActive(index);
    scrollToCard(index);
  };

  useEffect(()=>{
    const rail = railRef.current;
    if(!rail || photos.length===0) return;
    let raf = 0;
    const updateActive = ()=>{
      raf = 0;
      const rect = rail.getBoundingClientRect();
      const center = rect.left + rect.width/2;
      const cards = Array.from(rail.querySelectorAll<HTMLElement>('[data-card-index]'));
      let best = active;
      let bestDistance = Number.POSITIVE_INFINITY;
      for(const card of cards){
        const idx = Number(card.dataset.cardIndex||0);
        const cardRect = card.getBoundingClientRect();
        const cardCenter = cardRect.left + cardRect.width/2;
        const distance = Math.abs(center - cardCenter);
        if(distance < bestDistance){best = idx;bestDistance = distance;}
      }
      setActive(current => current===best ? current : best);
      if(gestureRef.current){
        if(settleTimerRef.current) clearTimeout(settleTimerRef.current);
        settleTimerRef.current=setTimeout(()=>{
          if(best!==settledIndexRef.current){
            settledIndexRef.current=best;
            soundRef.current?.('pickup');
          }
          gestureRef.current=false;
        },190);
      } else {
        settledIndexRef.current=best;
      }
    };
    const onScroll = ()=>{ if(!raf) raf = requestAnimationFrame(updateActive); };
    rail.addEventListener('scroll', onScroll, {passive:true});
    window.addEventListener('resize', onScroll);
    onScroll();
    return ()=>{
      rail.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if(raf) cancelAnimationFrame(raf);
    };
  },[photos.length, active]);

  const wallFrames = useMemo(()=> photos.map((photo,i)=>({photo,index:i,rotation:rotations[i % rotations.length]})),[photos]);

  return <section data-sound-control className="mt-5 pt-4 border-t border-black/10 space-y-3" aria-label="旅途回憶相簿">
    <div className="flex justify-between items-center gap-2">
      <div>
        <h4 className="text-sm font-semibold flex items-center gap-1.5"><Images className="w-4 h-4"/>旅途回憶 · Memories</h4>
        <p className="text-[11px] text-[#68635C] mt-1">像掛在牆上的相框一樣左右滑動。置中的照片會被輕輕「拿起」，點一下可放大查看全圖。</p>
      </div>
      <span className="text-xs text-[#5E5A52] shrink-0">{photos.length}/{MAX_MEMORIES}</span>
    </div>

    {photos.length>0 ? <>
      <div className="relative">
        <div
          ref={railRef}
          onPointerDown={e=>{pointerStartRef.current=e.clientX;}}
          onPointerMove={e=>{
            if(pointerStartRef.current!==null && Math.abs(e.clientX-pointerStartRef.current)>12){
              pointerStartRef.current=null;
              gestureSound();
            }
          }}
          onPointerUp={()=>{pointerStartRef.current=null;}}
          onPointerCancel={()=>{pointerStartRef.current=null;}}
          onWheel={gestureSound}
          className="overflow-x-auto overflow-y-visible px-4 py-5 -mx-2 no-scrollbar snap-x snap-mandatory"
          style={{scrollPaddingLeft:'4rem', scrollPaddingRight:'4rem'}}
        >
          <div className="flex items-end min-w-max pr-6">
            {wallFrames.map(({photo,index,rotation},i)=>{
              const isActive = active===index;
              return <button
                type="button"
                key={`${stopId}-${photo.id||'local'}-${index}`}
                data-card-index={index}
                onClick={()=>{onSound?.('whoosh');setSelected(index);}}
                aria-label={`查看回憶照片 ${index+1}`}
                className={`group relative snap-center shrink-0 transition-all duration-300 ease-out focus:outline-none ${rotation} ${isActive ? 'z-20 scale-[1.05] -translate-y-3 rotate-0' : 'z-10 opacity-90 hover:opacity-100'}`}
                style={{width:`${CARD_WIDTH}px`, marginLeft:i===0?0:`${CARD_GAP}px`}}
              >
                <div className={`rounded-[22px] bg-[#F9F6EE] p-3 shadow-[0_8px_24px_rgba(0,0,0,0.12)] ring-1 ring-black/8 transition-all duration-300 ${isActive ? 'shadow-[0_18px_38px_rgba(0,0,0,0.20)]' : ''}`}>
                  <div className="rounded-[16px] bg-[#EDE7DC] p-2">
                    <div className="relative aspect-[4/5] rounded-[12px] bg-[#EFEAE0] overflow-hidden flex items-center justify-center">
                      {photo.src
                        ? <img src={photo.src} alt={photo.caption||`回憶照片 ${index+1}`} className="w-full h-full object-contain bg-[#F7F4EC]"/>
                        : <span className="text-xs text-[#777]">載入中</span>}
                      {index===0 && <span className="absolute left-2 bottom-2 rounded-full bg-[#1F3FB0]/88 px-2 py-1 text-[10px] text-white">回憶封面</span>}
                      <span className="absolute right-2 bottom-2 rounded-full bg-black/50 px-2 py-1 text-[10px] text-white flex items-center gap-1"><Expand className="w-3 h-3"/>放大</span>
                    </div>
                  </div>
                  <div className="pt-2 px-1 min-h-[2.5rem] flex items-start justify-between gap-2">
                    <p className="text-[11px] leading-4 text-[#5E5A52] text-left line-clamp-2">{photo.caption?.trim() || `回憶照片 ${index+1}`}</p>
                    <span className="text-[10px] text-[#8A8479] shrink-0">{index+1}/{photos.length}</span>
                  </div>
                </div>
              </button>;
            })}
          </div>
        </div>

        {photos.length>1 && <>
          <button type="button" aria-label="上一張回憶照片" className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full bg-white/90 shadow-lg ring-1 ring-black/10 p-2 disabled:opacity-30" disabled={active===0} onClick={()=>moveActive(active-1)}><ChevronLeft className="w-4 h-4"/></button>
          <button type="button" aria-label="下一張回憶照片" className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full bg-white/90 shadow-lg ring-1 ring-black/10 p-2 disabled:opacity-30" disabled={active===photos.length-1} onClick={()=>moveActive(active+1)}><ChevronRight className="w-4 h-4"/></button>
        </>}
      </div>

      <div className="rounded-2xl bg-[#F8F4EA] ring-1 ring-black/8 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#38342F]">目前選取</p>
            <p className="text-[11px] text-[#726C61]">{activePhoto ? `${active+1} / ${photos.length}` : '尚未選取'}</p>
          </div>
          <div className="flex items-center gap-1 text-[#6F675C] text-[11px]">
            <ImageIcon className="w-3.5 h-3.5"/>
            左右滑動相框
          </div>
        </div>

        {activePhoto && (readOnly ? <>
          <p className="text-sm text-[#3A352E]">{activePhoto.caption?.trim() || '這張回憶照片尚未加入說明。'}</p>
          <button type="button" onClick={()=>{onSound?.('whoosh');setSelected(active);}} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-2 text-xs font-medium ring-1 ring-black/10">
            <Expand className="w-3.5 h-3.5"/>查看大圖
          </button>
        </> : <>
          <label className="block text-xs text-[#5E5A52]">照片說明</label>
          <textarea
            key={`${stopId}-${active}-${activePhoto.caption}`}
            rows={2}
            maxLength={240}
            placeholder="輸入這張回憶照片的說明，例如：bingo！"
            defaultValue={activePhoto.caption}
            onBlur={e=>{ if(e.target.value!==activePhoto.caption) void change(photos.map((p,j)=>j===active?{...p,caption:e.target.value}:p)); }}
            className="w-full rounded-xl bg-white p-2.5 text-sm ring-1 ring-black/10"
          />
          <div className="flex flex-wrap gap-2">
            <button disabled={busy||active===0} type="button" className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-2 text-xs font-medium ring-1 ring-black/10 disabled:opacity-30" onClick={()=>{onSound?.('tap');void change([activePhoto,...photos.filter((_,j)=>j!==active)]);}}><Star className="w-3.5 h-3.5"/>設為回憶封面</button>
            <button disabled={busy} type="button" className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-2 text-xs font-medium text-red-700 ring-1 ring-red-200 disabled:opacity-30" onClick={()=>{onSound?.('tap'); if(window.confirm('確定刪除這張回憶照片？')) void change(photos.filter((_,j)=>j!==active)); }}><Trash2 className="w-3.5 h-3.5"/>刪除這張</button>
            <button type="button" onClick={()=>{onSound?.('whoosh');setSelected(active);}} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-2 text-xs font-medium ring-1 ring-black/10"><Expand className="w-3.5 h-3.5"/>查看大圖</button>
          </div>
        </>)}
      </div>
    </> : <div className="rounded-2xl bg-[#F8F4EA] ring-1 ring-black/8 px-4 py-5 text-center text-sm text-[#5E5A52]">還沒有旅途回憶照片。</div>}

    {!readOnly && <>
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={upload}/>
      <button className="w-full min-h-11 rounded-xl bg-[#E4E5F0] text-[#1F3FB0] flex justify-center items-center gap-2 text-sm font-semibold disabled:opacity-50" disabled={busy||photos.length>=MAX_MEMORIES} onClick={()=>{onSound?.('tap');fileRef.current?.click();}}>{busy?<Loader2 className="w-4 h-4 animate-spin"/>:<Camera className="w-4 h-4"/>}新增回憶照片</button>
    </>}
    {error&&<p role="alert" className="text-red-700 text-xs">{error}</p>}

    {selected!==null && photos[selected]?.src && <div role="dialog" aria-modal="true" className="fixed inset-0 z-[80] bg-black/95 flex flex-col justify-center items-center p-4" onClick={()=>{onSound?.('tap');setSelected(null);}}>
      <button aria-label="關閉回憶照片" className="absolute top-5 right-5 text-white p-2 bg-white/20 rounded-full" onClick={e=>{e.stopPropagation();onSound?.('tap');setSelected(null);}}>✕</button>
      <img className="max-w-full max-h-[75vh] object-contain" src={photos[selected].src} alt={photos[selected].caption||'旅途回憶'}/>
      <p className="text-white text-sm mt-4 text-center max-w-xl">{photos[selected].caption || '旅途回憶'}</p>
      <div className="flex items-center gap-4 mt-3 text-white">
        <button disabled={selected===0} className="disabled:opacity-30" onClick={e=>{e.stopPropagation();onSound?.('slide');setSelected(Math.max(0,selected-1));setActive(Math.max(0,selected-1));}}>上一張</button>
        <span>{selected+1}/{photos.length}</span>
        <button disabled={selected===photos.length-1} className="disabled:opacity-30" onClick={e=>{e.stopPropagation();onSound?.('slide');setSelected(Math.min(photos.length-1,selected+1));setActive(Math.min(photos.length-1,selected+1));}}>下一張</button>
      </div>
    </div>}
  </section>;
}
