import type { ItineraryDay, ItineraryStop, TravelRoute, OptionalEventGroup } from '../types/itinerary';
export function slots(day: ItineraryDay): ItineraryStop[][] {
  const result: ItineraryStop[][] = [];
  for (let i=0;i<day.stops.length;i++) {
    const a=day.stops[i], b=day.stops[i+1];
    if (b && day.optionalGroups?.some(g=>g.eventIds[0]===a.id && g.eventIds[1]===b.id)) { result.push([a,b]); i++; }
    else result.push([a]);
  }
  return result;
}
export function edges(day: ItineraryDay) {
  const rows=slots(day);
  return rows.slice(0,-1).flatMap((row,i)=>row.flatMap(a=>rows[i+1].map(b=>({fromEventId:a.id,toEventId:b.id}))));
}
export function inactive(day: ItineraryDay,id:string) { return !!day.optionalGroups?.some(g=>g.eventIds.includes(id) && g.selectedEventId && g.selectedEventId!==id); }
export function cleanDay(day: ItineraryDay): ItineraryDay {
  const groups=(day.optionalGroups??[]).filter(g=>{const i=day.stops.findIndex(s=>s.id===g.eventIds[0]);return i>=0 && day.stops[i+1]?.id===g.eventIds[1];});
  const result={...day,optionalGroups:groups};
  const valid=edges(result);
  return {...result,travelRoutes:(day.travelRoutes??[]).filter(r=>valid.some(e=>e.fromEventId===r.fromEventId&&e.toEventId===r.toEventId))};
}
export const modes: Record<string,string>={car:'開車',charter:'包車',mrt:'捷運',walking:'步行',train:'火車',hsr:'高鐵',flight:'飛機',mixed:'轉乘',bus:'公車',taxi:'計程車',ferry:'渡輪'};
export function routeLabel(day:ItineraryDay,a:ItineraryStop,b:ItineraryStop) {
  const r=day.travelRoutes?.find(r=>r.fromEventId===a.id&&r.toEventId===b.id);
  if(r) return `${modes[r.transportMode??'']??''}${r.transportMode?' · ':''}約 ${r.durationMinutes} 分鐘`;
  if (!day.optionalGroups?.some(g=>g.eventIds.includes(a.id)||g.eventIds.includes(b.id)) && b.schedule?.travelFromPreviousMinutes!=null) return `約 ${b.schedule.travelFromPreviousMinutes} 分鐘`;
  return '';
}
export function parseBranchData(day:ItineraryDay,raw:Record<string,unknown>): string|null {
  if(raw.optionalGroups!==undefined && !Array.isArray(raw.optionalGroups)) return '備選行程格式不正確';
  const used=new Set<string>(); const groups:OptionalEventGroup[]=[];
  for(const g of (raw.optionalGroups??[]) as OptionalEventGroup[]) {
    if(!g||!Array.isArray(g.eventIds)||g.eventIds.length!==2||g.eventIds.some(id=>typeof id!=='string'||used.has(id))||g.eventIds[0]===g.eventIds[1]) return '備選行程 ID 不正確或重複';
    const i=day.stops.findIndex(s=>s.id===g.eventIds[0]);
    if(i<0||day.stops[i+1]?.id!==g.eventIds[1]|| (g.selectedEventId!=null&&!g.eventIds.includes(g.selectedEventId))) return '備選行程必須為相鄰的兩個活動';
    g.eventIds.forEach(id=>used.add(id));groups.push({eventIds:[...g.eventIds],selectedEventId:g.selectedEventId??null});
  }
  day.optionalGroups=groups;
  if(raw.travelRoutes!==undefined&&!Array.isArray(raw.travelRoutes)) return '交通路線格式不正確';
  const allowed=edges(day), seen=new Set<string>(); const routes:TravelRoute[]=[];
  for(const r of (raw.travelRoutes??[]) as TravelRoute[]) {
    if(!r||!allowed.some(e=>e.fromEventId===r.fromEventId&&e.toEventId===r.toEventId)||!Number.isFinite(r.durationMinutes)||r.durationMinutes<0||r.durationMinutes>1440|| (r.transportMode!==undefined&&!Object.hasOwn(modes,r.transportMode))) return '交通路線或時間不正確';
    const key=JSON.stringify([r.fromEventId,r.toEventId]);if(seen.has(key)) return '交通路線重複';seen.add(key);
    routes.push({fromEventId:r.fromEventId,toEventId:r.toEventId,durationMinutes:Math.round(r.durationMinutes),...(r.transportMode?{transportMode:r.transportMode}:{}),...(typeof r.notes==='string'?{notes:r.notes.slice(0,500)}:{})});
  }
  day.travelRoutes=routes; return null;
}

export type RoutePreview = Record<string,string>;
export function groupKey(day:ItineraryDay, ids:[string,string]) { return JSON.stringify([day.date,...ids]); }
export function effectiveChoice(day:ItineraryDay, ids:[string,string], preview:RoutePreview) {
 const g=day.optionalGroups?.find(g=>g.eventIds[0]===ids[0]&&g.eventIds[1]===ids[1]);
 const id=g?.selectedEventId || preview[groupKey(day,ids)];
 return ids.includes(id) ? id : null;
}
export function previewDay(day:ItineraryDay, preview:RoutePreview):ItineraryDay {
 return {...day,optionalGroups:day.optionalGroups?.map(g=>({...g,selectedEventId:effectiveChoice(day,g.eventIds,preview)}))};
}
export function routeMinutes(day:ItineraryDay,a:ItineraryStop,b:ItineraryStop):number|undefined {
 const r=day.travelRoutes?.find(r=>r.fromEventId===a.id&&r.toEventId===b.id);
 if(r) return r.durationMinutes;
 if(!day.optionalGroups?.some(g=>g.eventIds.includes(a.id)||g.eventIds.includes(b.id))) return b.schedule?.travelFromPreviousMinutes;
}
export function totalTravel(day:ItineraryDay):{min:number;max:number}|null {
 const rows=slots(day).map(row=>row.filter(s=>!inactive(day,s.id)));
 if(!rows.length) return null;
 let totals=new Map(rows[0].map(s=>[s.id,{min:0,max:0}]));
 for(let i=1;i<rows.length;i++) {
  const next=new Map<string,{min:number;max:number}>();
  for(const b of rows[i]) {
   const values=rows[i-1].map(a=>{const t=totals.get(a.id), m=routeMinutes(day,a,b);return t&&m!=null?{min:t.min+m,max:t.max+m}:null;});
   if(values.some(v=>!v)) return null;
   next.set(b.id,{min:Math.min(...values.map(v=>v!.min)),max:Math.max(...values.map(v=>v!.max))});
  }
  totals=next;
 }
 return {min:Math.min(...Array.from(totals.values(),v=>v.min)),max:Math.max(...Array.from(totals.values(),v=>v.max))};
}
export function travelSummary(day:ItineraryDay) {
 const t=totalTravel(day); if(!t)return '預計交通時間：尚未完整估算';
 const fmt=(m:number)=>m>=60?`${Math.floor(m/60)} 小時${m%60?` ${m%60} 分鐘`:''}`:`${m} 分鐘`;
 return `預計交通時間：約 ${fmt(t.min)}${t.min!==t.max?` – ${fmt(t.max)}`:''}`;
}


// Planning buffers use explicit schedule information only, never guessed visit durations.
function exactClock(text:string):number|null {
 const m=/^(\d{1,2}):(\d{2})$/.exec(text.trim());
 if(!m)return null;
 const h=Number(m[1]),min=Number(m[2]);return h<24&&min<60?h*60+min:null;
}
function timeWindow(stop:ItineraryStop):{start:number;end:number|null}|null {
 const parts=stop.time.trim().split(/\s*[-–—~～－至]\s*/);
 if(parts.length>2)return null;
 const start=exactClock(parts[0]);if(start===null)return null;
 if(parts.length===2){const end=exactClock(parts[1]);return {start,end:end!==null&&end>=start?end:null};}
 const duration=stop.schedule?.durationMinutes;
 if(typeof duration==='number'&&Number.isFinite(duration)&&duration>=0&&start+duration<1440)return {start,end:start+duration};
 // An explicitly labelled departure is an instant, not a visit of unknown length.
 return {start,end:stop.category==='Transport'&&/(出發|啟程|departure|depart)/i.test(stop.title)?start:null};
}
export function travelBuffer(day:ItineraryDay,a:ItineraryStop,b:ItineraryStop):number|null {
 const from=timeWindow(a),to=timeWindow(b),minutes=routeMinutes(day,a,b);
 if(!from||from.end===null||!to||minutes==null||!Number.isFinite(minutes)||minutes<0)return null;
 // Earlier clock times can be an overnight journey or invalid ordering; do not guess.
 if(to.start<from.start)return null;
 return Math.round(to.start-from.end-minutes);
}
export function bufferSummary(day:ItineraryDay,pairs:[ItineraryStop,ItineraryStop][]):{text:string;warning:boolean}|null {
 if(!pairs.length)return null;
 const values=pairs.map(([a,b])=>travelBuffer(day,a,b));
 if(values.some(v=>v===null))return null;
 const min=Math.min(...values as number[]),max=Math.max(...values as number[]);
 if(min===max)return {text:min<0?`時間不足 ${-min} 分鐘`:`緩衝 ${min} 分鐘`,warning:min<0};
 if(max<0)return {text:`時間不足 ${-max}–${-min} 分鐘`,warning:true};
 if(min<0)return {text:`不足 ${-min} 至緩衝 ${max} 分鐘`,warning:true};
 return {text:`緩衝 ${min}–${max} 分鐘`,warning:false};
}
