import React, { useId } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowUpRight, Navigation } from 'lucide-react';
import type { ItineraryDay, ItineraryStop } from '../types/itinerary';
import { slots, inactive, routeLabel } from '../utils/branchRoutes';
import { StopCard } from './StopCard';
import { TransitConnector } from './TransitConnector';
import { CategoryBadge } from './CategoryBadge';
import { buildStopMapsUrl, buildFullDayMapsUrl } from '../utils/itinerary';
interface Props {day:ItineraryDay; photos?:Record<string,string[]>; onSelect?:(stop:ItineraryStop,rect:DOMRect)=>void; onChoose?:(ids:[string,string],id:string|null)=>void; route?:boolean}
export function BranchTimeline({day,photos,onSelect,onChoose,route=false}:Props) {
 const rows=slots(day), reduced=useReducedMotion(), gradientId=useId().replace(/:/g,'');
 const animated=route&&!reduced;
 const anim=(delay:number)=>({initial:animated?{opacity:0,y:5}:false,animate:{opacity:1,y:0},transition:{duration:animated?.28:0,delay:animated?delay:0}});
 const step=0.8;
 const edgeText=(a:ItineraryStop,b:ItineraryStop,linear:boolean)=>routeLabel(day,a,b)||(linear?a.transitToNext?.trim():'')||'';
 return <div className={route?'space-y-4':''}>
 <div className={route?'rounded-3xl bg-[#F4F2ED] p-4 sm:p-5 shadow-sm ring-1 ring-black/[0.06]':''}>
 {route&&<div className="flex items-center justify-between gap-2 pb-4 mb-4 border-b border-black/[0.06]"><div><p className="text-xs font-medium text-[#5E5A52]">Route Overview</p><h3 className="text-base font-semibold text-[#1A1A1A] mt-0.5">Day {day.dayNumber} · {rows.length} 個站點</h3></div><span className="text-xs font-mono text-[#5E5A52] tabular-nums text-right">{day.stops[0]?.time} – {day.stops[day.stops.length-1]?.time}</span></div>}
 {rows.map((row,i)=>{const next=rows[i+1], group=day.optionalGroups?.find(g=>g.eventIds[0]===row[0].id);const linear=row.length===1&&next?.length===1;
 return <React.Fragment key={row[0].id}>
 <motion.div {...anim(i*step)} className={`grid items-stretch gap-2 ${row.length===2?'grid-cols-2':'grid-cols-1'}`}>
 {row.map((stop,j)=><div key={stop.id} className="min-w-0 flex flex-col relative">
 {route&&next&&<div aria-hidden="true" className="absolute left-[13px] top-8 bottom-0 w-px bg-[#D2CEC4] overflow-hidden"><motion.div className="absolute inset-0 origin-top" style={{background:inactive(day,stop.id)?'#B9B5AD':'#1F3FB0'}} initial={animated?{scaleY:0}:false} animate={{scaleY:1}} transition={{duration:animated?.18:0,delay:animated?i*step+.28:0,ease:'linear'}}/></div>}
 <div className={`flex-1 ${route?'':'[&>article]:h-full'} ${inactive(day,stop.id)?'opacity-40':''}`}>
 {route?<div className="flex gap-2.5 items-start relative"><span className="flex shrink-0 w-7 h-7 rounded-full bg-[#1F3FB0] text-white items-center justify-center text-xs font-semibold tabular-nums">{i+1}{row.length===2?(j===0?'A':'B'):''}</span><div className={`min-w-0 flex-1 ${row.length===1?'pr-10':''}`}><div className="flex flex-wrap items-center gap-1.5"><span className="font-mono text-[11px] font-medium text-[#5E5A52] tabular-nums">{stop.time}</span><CategoryBadge category={stop.category}/></div><h4 className="mt-1 text-[15px] font-semibold text-[#1A1A1A] leading-snug break-words">{stop.title}</h4><p className="mt-0.5 text-xs text-[#5E5A52] break-words">{stop.locationName}</p><a href={buildStopMapsUrl(stop.mapQuery)} target="_blank" rel="noopener noreferrer" aria-label={`Open ${stop.title} in Google Maps`} className={`${row.length===1?'absolute right-0 top-0':'mt-2'} inline-flex min-h-[32px] min-w-[32px] items-center justify-center rounded-full bg-[#EDEBE6] text-[#1F3FB0] ring-1 ring-black/[0.06]`}><ArrowUpRight className="w-4 h-4"/></a></div></div>:<StopCard compact={row.length===2} stop={stop} customPhotoUrl={photos?.[stop.id]?.[0]??''} onSelect={onSelect!}/>}
 </div>
 {group&&<div className={`text-center text-xs py-1 ${route?'text-[#5E5A52]':''}`}>{group.selectedEventId===stop.id?'✓ 已選擇':group.selectedEventId?'未前往':'備選行程'}{onChoose&&!route&&<button type="button" className="block mx-auto rounded-full bg-white px-3 py-2 mt-1 text-[#1F3FB0]" onClick={()=>onChoose(group.eventIds,group.selectedEventId===stop.id?null:stop.id)}>{group.selectedEventId===stop.id?'取消選擇':'選擇此行程'}</button>}</div>}
 </div>)}
 </motion.div>
 {next&&(linear&&!route?<TransitConnector transitText={edgeText(row[0],next[0],true)}/>:<div className={`relative ${linear?'min-h-[48px]':'min-h-[84px]'} flex items-center ${route?'py-2':'py-3'}`}>
 <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute top-0 bottom-0 h-full overflow-visible" style={route?{left:14,width:'calc(100% - 20px)'}:{left:0,width:'100%'}} aria-hidden="true">
 <defs><linearGradient id={`${gradientId}-${i}`} x1="0%" y1="0%" x2="0%" y2="100%" gradientUnits="objectBoundingBox"><stop offset="0%" stopColor="#C8C3B8" stopOpacity=".45"/><stop offset="50%" stopColor="#C8C3B8"/><stop offset="100%" stopColor="#C8C3B8" stopOpacity=".45"/></linearGradient><clipPath id={`${gradientId}-clip-${i}`} clipPathUnits="userSpaceOnUse"><motion.rect x="-5" y="0" width="110" height="100" initial={animated?{height:0}:false} animate={{height:100}} transition={{duration:animated?.32:0,delay:animated?i*step+.46:0,ease:'linear'}}/></clipPath></defs>
 {row.flatMap((a,j)=>next.map((b,k)=>{const x=route?(row.length===1?0:j*50):(row.length===1?50:j===0?25:75),y=route?(next.length===1?0:k*50):(next.length===1?50:k===0?25:75);const faded=inactive(day,a.id)||inactive(day,b.id);const d=`M${x} 0 V20 C${x} 50 ${y} 50 ${y} 80 V100`;return route?<React.Fragment key={`${a.id}-${b.id}`}><path d={d} fill="none" stroke="#D2CEC4" strokeWidth="1.4" vectorEffect="non-scaling-stroke" opacity={faded?.35:1}/><g clipPath={`url(#${gradientId}-clip-${i})`}><path d={d} fill="none" stroke={faded?'#B9B5AD':'#1F3FB0'} strokeWidth="1.4" vectorEffect="non-scaling-stroke" opacity={faded?.35:1}/></g></React.Fragment>:<path key={`${a.id}-${b.id}`} d={d} fill="none" stroke={x===y?'#C8C3B8':`url(#${gradientId}-${i})`} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" opacity={faded?.35:1} strokeDasharray={faded?'4 4':undefined}/>;}))}</svg>
 <motion.div {...anim(i*step+.32)} className={`relative w-full grid gap-2 pointer-events-none ${linear?'grid-cols-1':'grid-cols-2'} ${route?'pl-10':''}`}>
 {row.flatMap(a=>next.map(b=>{const label=edgeText(a,b,!!linear);return <div key={`${a.id}-${b.id}`} className={`${route?'text-left':'text-center'} min-w-0 ${inactive(day,a.id)||inactive(day,b.id)?'opacity-40':''}`}>{label&&<span className="inline-block rounded-full bg-[#EDEBE6] px-2 py-1 text-[11px] font-medium text-[#5E5A52] break-words">{label}</span>}</div>}))}
 </motion.div></div>)}
 </React.Fragment>})}
 </div>
 {route&&(day.optionalGroups?.some(g=>!g.selectedEventId)?<p className="text-xs text-center text-[#5E5A52]">選定所有備選行程後可開啟完整路線。</p>:<a className="w-full min-h-[52px] flex items-center justify-center gap-2 rounded-2xl bg-[#1F3FB0] px-5 py-3.5 text-sm font-semibold text-white shadow-sm" href={buildFullDayMapsUrl(day.stops.filter(s=>!inactive(day,s.id)))} target="_blank" rel="noopener noreferrer"><Navigation className="w-4 h-4"/>Open Full Day Route in Google Maps</a>)}
 </div>
}
