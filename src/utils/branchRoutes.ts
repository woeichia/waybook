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
    if(groups.some(p=>day.stops.findIndex(s=>s.id===p.eventIds[1])===i-1||day.stops.findIndex(s=>s.id===p.eventIds[0])===i+2)) return '備選行程之間必須有共同站點';
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
