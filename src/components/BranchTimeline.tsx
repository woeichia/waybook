import React, { useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowUpRight, Navigation } from 'lucide-react';
import type { ItineraryDay, ItineraryStop } from '../types/itinerary';
import { slots, inactive, routeLabel, routeMinutes, routeInstructions, modes, previewDay, travelSummary, type RoutePreview } from '../utils/branchRoutes';
import { TransportDisclosure } from './TransportDisclosure';
import { StopCard } from './StopCard';
import { CategoryBadge } from './CategoryBadge';
import { buildStopMapsUrl, buildFullDayMapsUrl } from '../utils/itinerary';
interface Props {day:ItineraryDay; photos?:Record<string,string[]>; onSelect?:(stop:ItineraryStop,rect:DOMRect)=>void; preview:RoutePreview; onPreview:(ids:[string,string],id:string|null)=>void; onConfirm?:(ids:[string,string],id:string|null)=>void; route?:boolean}
export function BranchTimeline({day,photos,onSelect,preview,onPreview,onConfirm,route=false}:Props) {
 const effective=previewDay(day,preview), rows=slots(day), reduced=useReducedMotion();
 const animated=route&&!reduced, step=.85;
 const root=useRef<HTMLDivElement>(null), [width,setWidth]=useState(0);
 useLayoutEffect(()=>{const el=root.current;if(!el)return;const measure=()=>setWidth(el.clientWidth);measure();const observer=new ResizeObserver(measure);observer.observe(el);return()=>observer.disconnect();},[]);
 const anim=(delay:number)=>({initial:animated?{opacity:0}:false,animate:{opacity:1},transition:{duration:animated?.24:0,delay:animated?delay:0}});
 const label=(a:ItineraryStop,b:ItineraryStop)=>routeLabel(day,a,b)||'';
 const center=(count:number,index:number)=>count===1?(route?14:width/2):index===0?(width-8)/4:(3*width+8)/4;
 function connector(row:ItineraryStop[],next:ItineraryStop[],i:number){
  const linear=row.length===1&&next.length===1, junction=width/2;
  const from=row.filter(s=>!inactive(effective,s.id));
  const pairs:[ItineraryStop,ItineraryStop][][]=next.length===2?next.map(b=>from.map(a=>[a,b] as [ItineraryStop,ItineraryStop])):row.map(a=>[[a,next[0]]]);
  const labels=next.length===2?next.map(b=>{
    if(from.length===1)return label(from[0],b);
    const values=from.map(a=>routeMinutes(day,a,b));if(values.some(v=>v==null))return '';
    const min=Math.min(...values as number[]),max=Math.max(...values as number[]);return `約 ${min}${min===max?'':`–${max}`} 分鐘`;
  }):row.map(a=>label(a,next[0]));
  const shownLabels=route?labels:labels.map(()=> '');
  const instructions=pairs.map(ps=>ps.map(([a,b])=>{
    const groups=effective.optionalGroups?.filter(g=>g.eventIds.includes(a.id)||g.eventIds.includes(b.id))??[];
    const blocked=inactive(effective,a.id)||inactive(effective,b.id);
    const optional=groups.length>0;
    const resolved=groups.every(g=>!!g.selectedEventId);
    const mode=modes[day.travelRoutes?.find(r=>r.fromEventId===a.id&&r.toEventId===b.id)?.transportMode??'']||'';
    return {key:JSON.stringify([a.id,b.id]),from:a.title,text:routeInstructions(day,a,b,!route),mode,enabled:!blocked&&(!optional||resolved),auto:optional&&resolved&&!blocked};
   }).filter(x=>x.text||x.mode));
  const color=route?'#1F3FB0':'#777777';
  const lines: {d:string;faded:boolean;phase:number}[]=[];
  if(linear)lines.push({d:`M${center(1,0)} 0 V100`,faded:false,phase:0});
  else {
   row.forEach((a,j)=>{const x=center(row.length,j);lines.push({d:`M${x} 0 V15 Q${x} 25 ${x+(junction-x)*.08} 25 H${junction+(x-junction)*.08} Q${junction} 25 ${junction} 35`,faded:inactive(effective,a.id),phase:0});});
   lines.push({d:`M${junction} 35 V65`,faded:false,phase:0});
   next.forEach((b,j)=>{const x=center(next.length,j);lines.push({d:`M${junction} 65 Q${junction} 75 ${junction+(x-junction)*.08} 75 H${x+(junction-x)*.08} Q${x} 75 ${x} 85 V100`,faded:inactive(effective,b.id),phase:1});});
  }
  return <div className={`relative flex items-center ${linear?(route?'min-h-[58px]':instructions.some(xs=>xs.length)?'min-h-[40px]':'min-h-[24px]'):'min-h-[100px]'} ${route?'py-2':'py-3'}`}>
   {width>0&&<svg viewBox={`0 0 ${width} 100`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible" aria-hidden="true">

    {lines.map((l,k)=><motion.path key={k} d={l.d} fill="none" stroke={route&&l.faded?'#B9B5AD':color} strokeWidth={route?1.5:2} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" opacity={l.faded?(route?.35:.18):1} initial={animated?{pathLength:0}:false} animate={{pathLength:1}} transition={{duration:animated?(linear?.55:.27):0,delay:animated?i*step+.24+l.phase*.28:0,ease:'linear'}}/>)}</svg>}
   <motion.div {...anim(i*step+.4)} className={`relative w-full grid gap-2 items-start ${labels.length===2?'grid-cols-2':'grid-cols-1'} ${linear&&route?'pl-10':''}`}>
    {shownLabels.map((text,j)=><div key={j} className={`min-w-0 ${linear&&route?'text-left':'text-center'} ${inactive(effective,(next.length===2?next[j]:row[j]).id)?'opacity-40':''}`}>
     {text&&<span className={`inline-block rounded-full px-2 py-1 text-[11px] font-medium text-[#5E5A52] break-words ${route?'bg-[#EDEBE6] text-[15px] font-semibold text-[#1F3FB0]':'bg-[#F4F2ED]'}`}>{text}</span>}
     {instructions[j]?.filter(item=>item.text!==text).map(item=><TransportDisclosure key={`${item.key}:${item.auto}:${item.enabled}`} text={item.text} mode={item.mode} enabled={item.enabled} defaultOpen={item.auto} from={pairs[j].length>1?item.from:undefined}/>)}
    </div>)}
   </motion.div>
  </div>;
 }
 return <div className={route?'space-y-4':''}>
 <div className={route?'rounded-3xl bg-[#F4F2ED] p-4 sm:p-5 shadow-sm ring-1 ring-black/[0.06]':''}>
 {route&&<><div className="flex items-center justify-between gap-2 pb-4 mb-3 border-b border-black/[0.06]"><div><p className="text-xs font-medium text-[#5E5A52]">Route Overview</p><h3 className="text-base font-semibold text-[#1A1A1A] mt-0.5">Day {day.dayNumber} · {rows.length} 個站點</h3></div><span className="text-xs font-mono text-[#5E5A52] tabular-nums text-right">{day.stops[0]?.time} – {day.stops[day.stops.length-1]?.time}</span></div><p className="text-xs text-[#5E5A52] mb-4">{travelSummary(effective)}</p></>}
 <div ref={root}>
 {rows.map((row,i)=>{const next=rows[i+1],group=day.optionalGroups?.find(g=>g.eventIds[0]===row[0].id),chosen=effective.optionalGroups?.find(g=>g.eventIds[0]===row[0].id)?.selectedEventId;return <React.Fragment key={row[0].id}>
 <motion.div {...anim(i*step)} className={`grid items-stretch gap-2 ${row.length===2?'grid-cols-2':'grid-cols-1'}`}>
 {row.map((stop,j)=>{const faded=inactive(effective,stop.id),confirmed=!!group?.selectedEventId;return <div key={stop.id} className="min-w-0 flex flex-col relative">
 {route&&row.length===1&&next&&<svg aria-hidden="true" className="absolute top-7 -bottom-px overflow-visible pointer-events-none" style={{left:12,width:4,height:'calc(100% - 27px)'}} viewBox="0 0 4 100" preserveAspectRatio="none"><motion.path d="M2 0 V100" fill="none" stroke="#1F3FB0" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" initial={animated?{pathLength:0}:false} animate={{pathLength:1}} transition={{duration:animated?.24:0,delay:animated?i*step:0,ease:'linear'}}/></svg>}
 <div className={`flex-1 ${route?'':'[&>article]:h-full'} ${faded?'opacity-40':''}`}>
 {route?<div className={`relative ${row.length===2?'flex flex-col items-center text-center gap-1 rounded-xl bg-white/50 p-2 h-full':'flex items-start gap-2.5'}`}><span className="flex shrink-0 w-7 h-7 rounded-full bg-[#1F3FB0] text-white items-center justify-center text-xs font-semibold tabular-nums">{i+1}{row.length===2?(j===0?'A':'B'):''}</span><div className={`min-w-0 flex-1 ${row.length===1?'pr-10':''}`}><div className={`flex flex-wrap items-center gap-1.5 ${row.length===2?'justify-center':''}`}><span className="font-mono text-[11px] font-medium text-[#5E5A52] tabular-nums">{stop.time}</span><CategoryBadge category={stop.category}/></div><h4 className="mt-1 text-[15px] font-semibold text-[#1A1A1A] leading-snug break-words">{stop.title}</h4><p className="mt-0.5 text-xs text-[#5E5A52] break-words">{stop.locationName}</p><a href={buildStopMapsUrl(stop.mapQuery)} target="_blank" rel="noopener noreferrer" aria-label={`Open ${stop.title} in Google Maps`} className={`${row.length===1?'absolute right-0 top-0':'mt-2'} inline-flex min-h-[32px] min-w-[32px] items-center justify-center rounded-full bg-[#EDEBE6] text-[#1F3FB0] ring-1 ring-black/[0.06]`}><ArrowUpRight className="w-4 h-4"/></a></div></div>:<StopCard compact={row.length===2} stop={stop} customPhotoUrl={photos?.[stop.id]?.[0]??''} onSelect={onSelect!}/>}
 </div>
 {group&&<div className="text-center text-xs py-2 text-[#5E5A52] space-y-1">{confirmed?<><p>{group.selectedEventId===stop.id?'✓ 已前往':'未前往'}</p>{!route&&onConfirm&&group.selectedEventId===stop.id&&<button type="button" className="rounded-full bg-white px-2 py-2 text-[#1F3FB0]" onClick={()=>onConfirm(group.eventIds,null)}>解除確認</button>}</>:<><button type="button" aria-pressed={chosen===stop.id} className={`rounded-full px-2 py-2 ${chosen===stop.id?'bg-[#1F3FB0] text-white':'bg-white text-[#1F3FB0]'}`} onClick={()=>onPreview(group.eventIds,chosen===stop.id?null:stop.id)}>{chosen===stop.id?'取消預覽':'預覽此行程'}</button>{!route&&onConfirm&&chosen===stop.id&&<button type="button" className="block mx-auto rounded-full bg-[#1F3FB0] text-white px-2 py-2" onClick={()=>onConfirm(group.eventIds,stop.id)}>確認實際前往</button>}</>}</div>}
 </div>})}
 </motion.div>
 {next&&connector(row,next,i)}
 </React.Fragment>})}
 </div></div>
 {day.optionalGroups?.some(g=>!g.selectedEventId)&&<p className="text-xs text-center text-[#5E5A52] mt-2">個人預覽不會更改共享行程；實際行程由管理員確認及發佈。</p>}
 {route&&(effective.optionalGroups?.some(g=>!g.selectedEventId)?<p className="text-xs text-center text-[#5E5A52]">選定所有備選行程後可開啟完整路線。</p>:<a className="w-full min-h-[52px] flex items-center justify-center gap-2 rounded-2xl bg-[#1F3FB0] px-5 py-3.5 text-sm font-semibold text-white shadow-sm" href={buildFullDayMapsUrl(day.stops.filter(s=>!inactive(effective,s.id)))} target="_blank" rel="noopener noreferrer"><Navigation className="w-4 h-4"/>Open Full Day Route in Google Maps</a>)}
 </div>
}
