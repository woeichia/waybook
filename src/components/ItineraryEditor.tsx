import React, { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Camera, Check, CopyPlus, Plus, Trash2, X } from 'lucide-react';
import type { ItineraryData, ItineraryDay, ItineraryStop } from '../types/itinerary';
import { compressImageToDataUrl } from '../utils/customPhotos';

interface Props {
  data: ItineraryData;
  dayIndex: number;
  onChange: (data: ItineraryData) => void;
  onPhoto: (id: string, dataUrl: string) => Promise<boolean>;
  onClose: () => void;
}
const inputClass = 'w-full min-h-10 px-3 py-2 rounded-xl bg-white ring-1 ring-black/10 text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#1F3FB0]';
function Field({ label, value, onChange, rows }: { label: string; value: string; onChange: (value: string) => void; rows?: number }) {
  return <label className="block text-xs font-medium text-[#5E5A52]">{label}
    {rows ? <textarea className={`${inputClass} mt-1 resize-y`} rows={rows} value={value} onChange={e => onChange(e.target.value)} /> : <input className={`${inputClass} mt-1`} value={value} onChange={e => onChange(e.target.value)} />}
  </label>;
}
export function ItineraryEditor({ data, dayIndex, onChange, onPhoto, onClose }: Props) {
  const day = data.days[dayIndex];
  const [expanded, setExpanded] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const photoRef = useRef<HTMLInputElement>(null);
  const [photoStop, setPhotoStop] = useState<string | null>(null);
  if (!day) return null;
  const updateDay = (patch: Partial<ItineraryDay>) => {
    onChange({ ...data, days: data.days.map((d, i) => i === dayIndex ? { ...d, ...patch } : d) });
  };
  const updateStop = (id: string, patch: Partial<ItineraryStop>) => updateDay({ stops: day.stops.map(s => s.id === id ? { ...s, ...patch } : s) });
  const addStop = () => {
    const id = `stop-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    updateDay({ stops: [...day.stops, { id, time: '10:00 AM', title: '新景點', category: 'Sightseeing', description: '', image: '', locationName: '', mapQuery: '', transitToNext: '' }] });
    setExpanded(id);
  };
  const moveStop = (index: number, direction: number) => {
    const dest = index + direction;
    if (dest < 0 || dest >= day.stops.length) return;
    const stops = [...day.stops];
    [stops[index], stops[dest]] = [stops[dest], stops[index]];
    updateDay({ stops });
  };
  const photoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !photoStop) return;
    if (!file.type.startsWith('image/')) { setStatus('請選擇圖片格式'); return; }
    setStatus('正在壓縮圖片…');
    try {
      const resized = await compressImageToDataUrl(file, 800, 0.68);
      setStatus((await onPhoto(photoStop, resized)) ? '照片已儲存於這個裝置' : '瀏覽器儲存空間不足，請改用圖片網址');
    } catch { setStatus('圖片處理失敗，請試另一張'); }
    event.target.value = '';
  };
  return <section className="mt-4 rounded-3xl bg-[#F8F6F0] ring-1 ring-black/10 p-4 shadow-sm" aria-label="行程編輯器">
    <div className="flex items-center justify-between gap-2 mb-3">
      <div><h2 className="font-calligraphy text-[27px] text-[#1A1A1A]">編輯我的旅程</h2><p className="text-xs text-[#6B675F]">修改立即保存在此裝置 · 尚未跨手機同步</p></div>
      <button type="button" onClick={onClose} className="p-2 rounded-full bg-white" aria-label="關閉編輯"><X size={18}/></button>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2"><Field label="旅程名稱" value={data.trip.title} onChange={v => onChange({ ...data, trip: { ...data.trip, title: v } })}/></div>
      <Field label="開始日期 (YYYY-MM-DD)" value={data.trip.startDate} onChange={v => onChange({ ...data, trip: { ...data.trip, startDate: v } })}/>
      <Field label="結束日期 (YYYY-MM-DD)" value={data.trip.endDate} onChange={v => onChange({ ...data, trip: { ...data.trip, endDate: v } })}/>
      <label className="block text-xs font-medium text-[#5E5A52]">同行人數<input type="number" min="1" className={`${inputClass} mt-1`} value={data.trip.travelers} onChange={e => onChange({ ...data, trip: { ...data.trip, travelers: Math.max(1, Number(e.target.value) || 1) } })}/></label>
      <Field label="封面圖片網址" value={data.trip.coverImage} onChange={v => onChange({ ...data, trip: { ...data.trip, coverImage: v } })}/>
      <div className="col-span-2"><Field label="當日主題" value={day.title} onChange={v => updateDay({ title: v })}/></div>
      <Field label="當日日期 (YYYY-MM-DD)" value={day.date} onChange={v => updateDay({ date: v })}/>
    </div>
    <div className="flex items-center justify-between mt-5 mb-2"><p className="font-semibold text-sm">當日行程 · {day.stops.length} 站</p><button type="button" onClick={addStop} className="flex items-center gap-1 text-xs rounded-full px-3 py-2 bg-[#1F3FB0] text-white"><Plus size={14}/>新增景點</button></div>
    <input type="file" accept="image/*" ref={photoRef} className="hidden" onChange={photoChange}/>
    <div className="space-y-2">{day.stops.map((stop, index) => <div key={stop.id} className="rounded-2xl bg-white ring-1 ring-black/[0.07] p-3">
      <div className="flex items-center gap-2"><button type="button" onClick={() => setExpanded(expanded === stop.id ? null : stop.id)} className="flex-1 min-w-0 text-left"><span className="text-[11px] text-[#68635C]">{stop.time}</span><p className="truncate text-sm font-medium">{stop.title}</p></button>
      <button type="button" aria-label="上移" disabled={index === 0} className="p-1.5 disabled:opacity-25" onClick={() => moveStop(index,-1)}><ArrowUp size={15}/></button>
      <button type="button" aria-label="下移" disabled={index === day.stops.length - 1} className="p-1.5 disabled:opacity-25" onClick={() => moveStop(index,1)}><ArrowDown size={15}/></button>
      <button type="button" aria-label="展開編輯" className="text-xs text-[#1F3FB0]" onClick={() => setExpanded(expanded === stop.id ? null : stop.id)}>{expanded === stop.id ? '收起' : '編輯'}</button></div>
      {expanded === stop.id && <div className="mt-3 pt-3 border-t border-black/10 space-y-3">
        <div className="grid grid-cols-2 gap-2"><Field label="時間" value={stop.time} onChange={v => updateStop(stop.id, { time: v })}/><label className="text-xs font-medium text-[#5E5A52]">類別<select value={stop.category} className={`${inputClass} mt-1`} onChange={e => updateStop(stop.id, { category: e.target.value })}>{Array.from(new Set(['Sightseeing','Food','Hotel','Transport',stop.category])).map(c => <option key={c}>{c}</option>)}</select></label></div>
        <Field label="景點 / 活動名稱" value={stop.title} onChange={v => updateStop(stop.id, { title: v })}/>
        <Field label="詳細說明" value={stop.description} rows={3} onChange={v => updateStop(stop.id, { description: v })}/>
        <Field label="位置文字" value={stop.locationName} onChange={v => updateStop(stop.id, { locationName: v })}/>
        <Field label="Google Maps 搜尋名稱 / 地址" value={stop.mapQuery} onChange={v => updateStop(stop.id, { mapQuery: v })}/>
        <Field label="前往下一站交通說明" value={stop.transitToNext} onChange={v => updateStop(stop.id, { transitToNext: v })}/>
        <Field label="圖片網址 (可貼入 HTTPS 連結)" value={stop.image} onChange={v => updateStop(stop.id, { image: v })}/>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => {setPhotoStop(stop.id);photoRef.current?.click();}} className="rounded-xl px-3 py-2 text-xs bg-[#E8ECFA] text-[#1F3FB0] flex items-center gap-1"><Camera size={15}/>上傳本機照片</button>
        <button type="button" className="rounded-xl px-3 py-2 text-xs bg-[#EEEDE8] flex items-center gap-1" onClick={() => {const id = `stop-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;const stops = [...day.stops];stops.splice(index + 1,0,{...stop,id});updateDay({stops});setExpanded(id);}}><CopyPlus size={15}/>複製</button>
        <button type="button" className="rounded-xl px-3 py-2 text-xs bg-red-50 text-red-700 flex items-center gap-1" onClick={() => {if(window.confirm(`確定刪除「${stop.title}」？`)){updateDay({stops:day.stops.filter(s=>s.id!==stop.id)});setExpanded(null);}}}><Trash2 size={15}/>刪除</button></div>
      </div>}
    </div>)}</div>
    {status && <p role="status" className="text-xs mt-3 text-[#1F3FB0]">{status}</p>}
    <div className="mt-4 flex items-center justify-between gap-2"><span className="text-[11px] text-[#68635C]">修改自動儲存，分享前請匯出新版本。</span><button onClick={onClose} className="rounded-full text-white bg-[#1A1A1A] px-3 py-2 flex gap-1 items-center text-xs"><Check size={14}/>完成</button></div>
  </section>;
}
