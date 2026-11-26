import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { ItineraryDay, ItineraryStop } from '../types/itinerary';
import { slots, inactive, routeLabel } from '../utils/branchRoutes';
import { StopCard } from './StopCard';
import { TransitConnector } from './TransitConnector';
import { buildStopMapsUrl, buildFullDayMapsUrl } from '../utils/itinerary';
interface Props {day:ItineraryDay; photos?:Record<string,string[]>; onSelect?:(stop:ItineraryStop,rect:DOMRect)=>void; onChoose?:(ids:[string,string],id:string|null)=>void; route?:boolean}
export function BranchTimeline({day,photos,onSelect,onChoose,route=false}:Props) {
 const rows=slots(day), reduced=useReducedMotion();
 const anim=(delay:number)=>({initial:reduced||!route?false:{opacity:0},animate:{opacity:1},transition:{duration:route&&!reduced?.25:0,delay:route&&!reduced?delay:0}});
 return <div className={route?'rounded-3xl bg-[#F4F2ED] p-4 shadow-sm ring-1 ring-black/5':''}>
 {rows.map((row,i)=>{const next=rows[i+1], group=day.optionalGroups?.find(g=>g.eventIds[0]===row[0].id);return <React.Fragment key={row[0].id}>
 <motion.div {...anim(i*.9)} className={`grid gap-2 ${row.length===2?'grid-cols-2':'grid-cols-1'}`}>
 {row.map((stop,j)=><div key={stop.id} className="min-w-0">
 <div className={inactive(day,stop.id)?'opacity-40':''}>
 {route?<a href={buildStopMapsUrl(stop.mapQuery)} target="_blank" rel="noopener noreferrer" className="block rounded-xl bg-white/70 p-3 text-center break-words"><span className="inline-flex w-7 h-7 rounded-full bg-[#1F3FB0] text-white items-center justify-center text-xs">{i+1}{row.length===2?(j===0?'A':'B'):''}</span><p className="text-xs mt-1">{stop.time}</p><p className="font-semibold text-sm">{stop.title}</p><p className="text-xs">{stop.locationName}</p></a>:<StopCard compact={row.length===2} stop={stop} customPhotoUrl={photos?.[stop.id]?.[0]??''} onSelect={onSelect!}/>}
 </div>
 {group&&<div className="text-center text-xs py-1">{group.selectedEventId===stop.id?'✓ 已選擇':group.selectedEventId?'未前往':'備選行程'}{onChoose&&!route&&<button type="button" className="block mx-auto rounded-full bg-white px-3 py-2 mt-1 text-[#1F3FB0]" onClick={()=>onChoose(group.eventIds,group.selectedEventId===stop.id?null:stop.id)}>{group.selectedEventId===stop.id?'取消選擇':'選擇此行程'}</button>}</div>}
 </div>)}
 </motion.div>
 {next&&(row.length===1&&next.length===1&&!route?<div><TransitConnector transitText={routeLabel(day,row[0],next[0])||row[0].transitToNext}/></div>:<motion.div {...anim(i*.9+.25)} className="relative h-[90px]">
 <svg viewBox="0 0 100 90" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" aria-hidden="true">{row.flatMap((a,j)=>next.map((b,k)=>{const x=row.length===1?50:j===0?25:75,y=next.length===1?50:k===0?25:75;const faded=inactive(day,a.id)||inactive(day,b.id);return <motion.path key={a.id+b.id} d={`M${x} 0 V12 Q${x} 20 ${x+(y-x)*.2} 25 L${y-(y-x)*.2} 65 Q${y} 70 ${y} 78 V90`} fill="none" stroke={faded?'#b9b5ad':'#1F3FB0'} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeDasharray={faded?'4 4':undefined} initial={route&&!reduced?{pathLength:0}:false} animate={{pathLength:1}} transition={{duration:route&&!reduced?.55:0,delay:route&&!reduced?i*.9+.25:0,ease:'linear'}}/>}))}</svg>
 <div className="absolute inset-0 flex items-center justify-around pointer-events-none">{row.flatMap(a=>next.map(b=><span key={a.id+b.id} className={`bg-[#F4F2ED] rounded-full px-2 py-1 text-[10px] ${inactive(day,a.id)||inactive(day,b.id)?'opacity-50':''}`}>{routeLabel(day,a,b)||(row.length===1&&next.length===1?a.transitToNext:'')||'下一站'}</span>))}</div></motion.div>)}
 </React.Fragment>})}
 {route&&<div className="mt-4 space-y-2">{day.optionalGroups?.some(g=>!g.selectedEventId)?<p className="text-xs text-center">選定所有備選行程後可開啟完整路線。</p>:<a className="block rounded-xl bg-[#1F3FB0] text-white text-center p-3 text-sm" href={buildFullDayMapsUrl(day.stops.filter(s=>!inactive(day,s.id)))} target="_blank" rel="noopener noreferrer">在 Google Maps 開啟完整路線</a>}</div>}
 </div>
}
