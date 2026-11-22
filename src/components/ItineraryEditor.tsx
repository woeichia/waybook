import React, { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Camera, Check, CopyPlus, Plus, Trash2, X } from 'lucide-react';
import type { ItineraryData, ItineraryDay, ItineraryStop } from '../types/itinerary';
import { compressImageToDataUrl } from '../utils/customPhotos';
import { applyPlanTimes, clock, eventDuration, planStops, type PlannerInputs } from '../utils/schedulePlanner';

interface Props {
  data: ItineraryData;
  dayIndex: number;
  onChange: (data: ItineraryData) => void;
  onPhoto: (id: string, dataUrl: string) => Promise<boolean>;
  onCopyEventPhotos?: (sourceId: string, newId: string) => void;
  photoEventIds?: string[];
  onClose: () => void;
}
const inputClass = 'w-full min-h-10 px-3 py-2 rounded-xl bg-white ring-1 ring-black/10 text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#1F3FB0]';
function Field({ label, value, onChange, rows }: { label: string; value: string; onChange: (value: string) => void; rows?: number }) {
  return <label className="block text-xs font-medium text-[#5E5A52]">{label}
    {rows ? <textarea className={`${inputClass} mt-1 resize-y`} rows={rows} value={value} onChange={e => onChange(e.target.value)} /> : <input className={`${inputClass} mt-1`} value={value} onChange={e => onChange(e.target.value)} />}
  </label>;
}
export function ItineraryEditor({ data, dayIndex, onChange, onPhoto, onCopyEventPhotos, photoEventIds = [], onClose }: Props) {
  const day = data.days[dayIndex];
  const [expanded, setExpanded] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const photoRef = useRef<HTMLInputElement>(null);
  const [photoStop, setPhotoStop] = useState<string | null>(null);
  const [transfer, setTransfer] = useState<{id: string; mode: "move" | "copy"} | null>(null);
  const [destinationDay, setDestinationDay] = useState(0);
  const [insertAt, setInsertAt] = useState(0);
  const [plannerStart, setPlannerStart] = useState('09:00');
  const [plannerEnd, setPlannerEnd] = useState('19:00');
  const [plannerBuffer, setPlannerBuffer] = useState(15);
  const [travelEdits, setTravelEdits] = useState<Record<string, number>>({});
  const [durationEdits, setDurationEdits] = useState<Record<string, number>>({});
  const [fixedEdits, setFixedEdits] = useState<Record<string, boolean>>({});
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
  const openTransfer = (id: string, mode: 'move' | 'copy') => {
    const nextDay = dayIndex === data.days.length - 1 ? 0 : dayIndex + 1;
    setTransfer({ id, mode });
    setDestinationDay(nextDay);
    setInsertAt(data.days[nextDay]?.stops.length ?? 0);
    setPlannerStart('09:00');
    setPlannerEnd(data.days[nextDay]?.title.includes('包車') ? '19:00' : '21:00');
    setPlannerBuffer(15);
    setTravelEdits({}); setDurationEdits({}); setFixedEdits({});
  };
  const movingStop = transfer ? day.stops.find(stop => stop.id === transfer.id) : undefined;
  const targetDay = data.days[destinationDay];
  const proposedEvent = movingStop ? {...movingStop, id: transfer?.mode === 'copy' ? '__waybook_preview_copy__' : movingStop.id, schedule: {...movingStop.schedule, travelFromPreviousMinutes: undefined} } : undefined;
  const proposedStops = proposedEvent && targetDay ? [
    ...targetDay.stops.slice(0,insertAt), proposedEvent,
    ...targetDay.stops.slice(insertAt).map((stop,index)=>index === 0 ? {...stop,schedule:{...stop.schedule,travelFromPreviousMinutes:undefined}} : stop),
  ] : [];
  const plannerInputs: PlannerInputs = {startTime:plannerStart,endTime:plannerEnd,bufferMinutes:plannerBuffer,travelById:travelEdits,durationById:durationEdits,fixedById:fixedEdits};
  const plan = proposedStops.length ? planStops(proposedStops,plannerInputs) : null;
  const transferEvent = () => {
    if (!transfer || !movingStop || destinationDay === dayIndex || !targetDay || !plan) return;
    if (plan.issues.length && !window.confirm(`行程存在 ${plan.issues.length} 項時間衝突，仍要依預覽時間套用嗎？\n\n${plan.issues.join('\n')}`)) return;
    if (plan.unverified && !window.confirm(`還有 ${plan.unverified} 項交通／停留時間為未核實估計，可能不符合實際路程。仍要繼續嗎？`)) return;
    const isCopy = transfer.mode === 'copy';
    const eventId = isCopy ? `stop-${crypto.randomUUID()}` : movingStop.id;
    const plannedStops = applyPlanTimes(plan,plannerInputs).map(stop => stop.id === '__waybook_preview_copy__' ? {...stop,id:eventId} : stop);
    const days = data.days.map((item,index) => {
      if (index === dayIndex && !isCopy) return {...item,stops:item.stops.filter(stop=>stop.id!==movingStop.id)};
      if (index === destinationDay) return {...item,stops:plannedStops};
      return item;
    });
    if (isCopy) onCopyEventPhotos?.(movingStop.id,eventId);
    onChange({...data,days});
    setStatus(`已${isCopy ? '複製':'移動'}「${movingStop.title}」到 ${targetDay.date}，並依預覽調整時間。請人工核實交通、預約及各景點營業時間。`);
    setTransfer(null);
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
        <button type="button" className="rounded-xl px-3 py-2 text-xs bg-[#EEEDE8] flex items-center gap-1" onClick={() => {const id = `stop-${crypto.randomUUID()}`;const stops = [...day.stops];stops.splice(index + 1,0,{...stop,id});onCopyEventPhotos?.(stop.id,id);updateDay({stops});setExpanded(id);}}><CopyPlus size={15}/>複製到本日</button>
        <button type="button" className="rounded-xl px-3 py-2 text-xs bg-[#E8ECFA] text-[#1F3FB0]" onClick={() => openTransfer(stop.id,'move')}>移動到另一天</button>
        <button type="button" className="rounded-xl px-3 py-2 text-xs bg-[#E8ECFA] text-[#1F3FB0]" onClick={() => openTransfer(stop.id,'copy')}>複製到另一天</button>
        <button type="button" className="rounded-xl px-3 py-2 text-xs bg-red-50 text-red-700 flex items-center gap-1" onClick={() => {if(window.confirm(photoEventIds.includes(stop.id) ? `「${stop.title}」已有照片。刪除活動會令照片與行程失去連結。建議先匯出完整備份，確定仍要刪除？` : `確定刪除「${stop.title}」？`)){updateDay({stops:day.stops.filter(s=>s.id!==stop.id)});setExpanded(null);}}}><Trash2 size={15}/>刪除</button></div>
      </div>}
    </div>)}</div>
    {transfer && targetDay && movingStop && plan && <div className="mt-4 rounded-2xl bg-white p-3 ring-1 ring-[#1F3FB0]/25 space-y-3" role="group" aria-label="智能行程排程預覽">
      <p className="text-sm font-semibold">{transfer.mode === 'move' ? '移動活動' : '複製活動'} · 智能時間預覽</p>
      <p className="text-xs text-[#68635C]">此版本不呼叫地圖路線 API。交通時間及未知活動時長是估計值，須由你自行核實；不會自動刪除活動或修改來源日的其他行程。</p>
      <label className="text-xs block">目標日期
        <select className={`${inputClass} mt-1`} value={destinationDay} onChange={e => {const i=Number(e.target.value);setDestinationDay(i);setInsertAt(data.days[i]?.stops.length??0);setPlannerEnd(data.days[i]?.title.includes('包車')?'19:00':'21:00');setTravelEdits({});setDurationEdits({});setFixedEdits({});}}>
          {data.days.map((d,i)=><option key={`${d.date}-${i}`} value={i} disabled={i===dayIndex}>{d.date} · {d.title}</option>)}
        </select>
      </label>
      <label className="text-xs block">插入活動位置
        <select className={`${inputClass} mt-1`} value={insertAt} onChange={e=>setInsertAt(Number(e.target.value))}>
          {Array.from({length:targetDay.stops.length+1},(_,i)=><option key={i} value={i}>{i===0?'當日第一站':`在「${targetDay.stops[i-1]?.title}」之後`}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs">開始時間<input type="time" className={`${inputClass} mt-1`} value={plannerStart} onChange={e=>setPlannerStart(e.target.value)}/></label>
        <label className="text-xs">結束上限<input type="time" className={`${inputClass} mt-1`} value={plannerEnd} onChange={e=>setPlannerEnd(e.target.value)}/></label>
        <label className="text-xs col-span-2">每站交通後緩衝（分鐘）<input type="number" min={0} max={120} className={`${inputClass} mt-1`} value={plannerBuffer} onChange={e=>setPlannerBuffer(Math.max(0,Math.min(120,Number(e.target.value)||0)))}/></label>
      </div>
      <p className="text-xs text-[#68635C]">包車日預設 09:00–19:00（10 小時）；非包車日預設 09:00–21:00。可依當天實際安排修改。包車結束後自行安排的活動，請另行評估。</p>
      <div className="space-y-2">
        {plan.rows.map((row,i)=><div key={row.stop.id} className={`rounded-xl p-2.5 ${row.stop.id === '__waybook_preview_copy__'||row.stop.id===movingStop.id?'bg-[#EDF0FA]':'bg-[#F5F4F1]'}`}>
          <div className="flex items-center justify-between gap-2"><span className="font-semibold text-xs">{i+1}. {row.stop.title}</span><span className="font-mono text-xs shrink-0">{clock(row.start)}–{clock(row.end)}</span></div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <label className="text-[11px]">由上站交通（分鐘）<input type="number" min={0} max={1440} disabled={i===0} className={`${inputClass} mt-1`} value={travelEdits[row.stop.id]??row.stop.schedule?.travelFromPreviousMinutes??(i===0?0:30)} onChange={e=>setTravelEdits(v=>({...v,[row.stop.id]:Math.max(0,Number(e.target.value)||0)}))}/>{row.estimatedTravel&&<span className="text-amber-800">未核實估計</span>}</label>
            <label className="text-[11px]">活動時長（分鐘）<input type="number" min={5} max={1440} className={`${inputClass} mt-1`} value={durationEdits[row.stop.id]??eventDuration(row.stop).minutes} onChange={e=>setDurationEdits(v=>({...v,[row.stop.id]:Math.max(5,Number(e.target.value)||5)}))}/>{row.estimatedDuration&&<span className="text-amber-800">未核實估計</span>}</label>
          </div>
          <label className="flex items-center gap-2 text-xs mt-1.5"><input type="checkbox" checked={row.fixed} onChange={e=>setFixedEdits(v=>({...v,[row.stop.id]:e.target.checked}))}/>固定開始時間（例如預約餐廳）</label>
          {row.conflict&&<p className="text-xs text-red-700 mt-1">{row.conflict}</p>}
        </div>)}
      </div>
      <div className={`rounded-xl p-3 text-xs space-y-1 ${plan.issues.length?'bg-red-50 text-red-900':'bg-amber-50 text-amber-900'}`}>
        <p className="font-semibold">{plan.issues.length?`發現 ${plan.issues.length} 項時間衝突`:`預計 ${clock(plan.endTime)} 完成 · ${plan.unverified?'尚未核實':'時間檢查無衝突'}`}</p>
        {plan.issues.map((issue,i)=><p key={i}>• {issue}</p>)}
        {plan.unverified>0&&<p>另有 {plan.unverified} 項估計時長／交通時間尚未核實，不能據此判定實際路程一定可行。</p>}
      </div>
      <div className="flex flex-wrap gap-2"><button type="button" disabled={destinationDay===dayIndex} className="rounded-full bg-[#1F3FB0] text-white px-4 py-2 text-xs disabled:opacity-40" onClick={transferEvent}>確認並套用預覽時間</button><button type="button" className="rounded-full bg-[#EEEDE8] px-4 py-2 text-xs" onClick={()=>setTransfer(null)}>取消</button></div>
    </div>}
    {status && <p role="status" className="text-xs mt-3 text-[#1F3FB0]">{status}</p>}
    <div className="mt-4 flex items-center justify-between gap-2"><span className="text-[11px] text-[#68635C]">修改自動儲存，分享前請匯出新版本。</span><button onClick={onClose} className="rounded-full text-white bg-[#1A1A1A] px-3 py-2 flex gap-1 items-center text-xs"><Check size={14}/>完成</button></div>
  </section>;
}
