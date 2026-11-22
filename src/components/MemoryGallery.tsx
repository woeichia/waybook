import React, {useRef,useState} from 'react';
import {Camera, Star, Trash2, Images, Loader2} from 'lucide-react';
import {compressImageToDataUrl} from '../utils/customPhotos';

export type MemoryPhoto = {id?:string;src:string;caption:string};
const MAX_MEMORIES = 12;
interface Props {
  stopId:string;
  photos:MemoryPhoto[];
  onSave:(stopId:string,photos:MemoryPhoto[])=>Promise<void>;
  readOnly:boolean;
}
export function MemoryGallery({stopId,photos,onSave,readOnly}:Props) {
  const fileRef=useRef<HTMLInputElement>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [selected,setSelected]=useState<number|null>(null);
  const change = async (next:MemoryPhoto[])=>{
    setBusy(true);setError('');
    try {await onSave(stopId,next);} catch(e){setError(e instanceof Error?e.message:'無法儲存回憶照片');}
    finally{setBusy(false);}
  };
  const upload = async (event:React.ChangeEvent<HTMLInputElement>)=>{
    const files=Array.from(event.target.files||[]);event.target.value='';
    if (!files.length)return;
    if(files.length+photos.length>MAX_MEMORIES){setError(`每站最多 ${MAX_MEMORIES} 張回憶照片`);return;}
    setBusy(true);setError('');
    try{
      const additions:MemoryPhoto[]=[];
      for(const file of files){
        if(!file.type.startsWith('image/'))throw new Error('僅支援照片，影片將在 v15.1 加入');
        additions.push({src:await compressImageToDataUrl(file,960,0.60),caption:''});
      }
      await onSave(stopId,[...photos,...additions]);
    }catch(e){setError(e instanceof Error?e.message:'上傳失敗');}
    finally{setBusy(false);}
  };
  return <section className="mt-5 pt-4 border-t border-black/10 space-y-3" aria-label="旅途回憶相簿">
    <div className="flex justify-between items-center gap-2"><h4 className="text-sm font-semibold flex items-center gap-1.5"><Images className="w-4 h-4"/>旅途回憶 · Memories</h4><span className="text-xs text-[#5E5A52]">{photos.length}/{MAX_MEMORIES}</span></div>
    <p className="text-xs text-[#68635C]">真實旅行照片與行程參考照片分開保存。第一張照片為回憶封面，發布後家人可瀏覽。</p>
    {photos.length>0?<div className="grid grid-cols-3 gap-2">{photos.map((photo,i)=><div key={`${stopId}-${photo.id||'local'}-${i}`} className="min-w-0 space-y-1">
      <button type="button" className="relative aspect-square w-full overflow-hidden rounded-xl bg-[#E5E2DA]" onClick={()=>setSelected(i)} aria-label={`查看回憶照片 ${i+1}`}>
        {photo.src?<img src={photo.src} alt={`回憶照片 ${i+1}`} className="w-full h-full object-cover"/>:<span className="text-xs text-[#777]">載入中</span>}
        {i===0&&<span className="absolute bottom-0 inset-x-0 bg-[#1F3FB0]/85 text-white text-[10px]">回憶封面</span>}
      </button>
      {readOnly?<p className="text-[11px] text-[#666] truncate">{photo.caption}</p>:<>
        <input key={`${stopId}-${i}-${photo.caption}`} aria-label={`照片 ${i+1} 說明`} maxLength={240} placeholder="照片說明" defaultValue={photo.caption} onBlur={e=>{if(e.target.value!==photo.caption)void change(photos.map((p,j)=>j===i?{...p,caption:e.target.value}:p));}} className="w-full min-h-8 px-1.5 rounded-lg bg-white text-[11px] ring-1 ring-black/10"/>
        <div className="flex justify-center gap-2"><button disabled={busy||i===0} aria-label="設為回憶封面" className="disabled:opacity-30" onClick={()=>void change([photo,...photos.filter((_,j)=>j!==i)])}><Star size={15}/></button><button disabled={busy} aria-label="刪除回憶照片" className="text-red-700" onClick={()=>{if(window.confirm('確定刪除這張回憶照片？'))void change(photos.filter((_,j)=>j!==i));}}><Trash2 size={15}/></button></div>
      </>}
    </div>)}</div>:<p className="text-xs text-[#5E5A52]">還沒有旅途回憶照片。</p>}
    {!readOnly&&<><input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={upload}/><button className="w-full min-h-11 rounded-xl bg-[#E4E5F0] text-[#1F3FB0] flex justify-center items-center gap-2 text-sm font-semibold disabled:opacity-50" disabled={busy||photos.length>=MAX_MEMORIES} onClick={()=>fileRef.current?.click()}>{busy?<Loader2 className="w-4 h-4 animate-spin"/>:<Camera className="w-4 h-4"/>}新增回憶照片</button></>}
    {error&&<p role="alert" className="text-red-700 text-xs">{error}</p>}
    {selected!==null&&photos[selected]?.src&&<div role="dialog" aria-modal="true" className="fixed inset-0 z-[80] bg-black/95 flex flex-col justify-center items-center p-4" onClick={()=>setSelected(null)}>
      <button aria-label="關閉回憶照片" className="absolute top-5 right-5 text-white p-2 bg-white/20 rounded-full" onClick={()=>setSelected(null)}>✕</button>
      <img className="max-w-full max-h-[75vh] object-contain" src={photos[selected].src} alt={photos[selected].caption||'旅途回憶'}/>
      <p className="text-white text-sm mt-4 text-center">{photos[selected].caption}</p>
      <div className="flex items-center gap-4 mt-3 text-white"><button disabled={selected===0} className="disabled:opacity-30" onClick={e=>{e.stopPropagation();setSelected(Math.max(0,selected-1));}}>上一張</button><span>{selected+1}/{photos.length}</span><button disabled={selected===photos.length-1} className="disabled:opacity-30" onClick={e=>{e.stopPropagation();setSelected(Math.min(photos.length-1,selected+1));}}>下一張</button></div>
    </div>}
  </section>;
}
