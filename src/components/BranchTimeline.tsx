import React, { useLayoutEffect, useRef, useState, useId } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ArrowUpRight, Navigation } from 'lucide-react';
import type { ItineraryDay, ItineraryStop } from '../types/itinerary';
import { slots, inactive, routeMinutes, routeInstructions, routeModes, routeVisible, previewDay, travelSummary, type RoutePreview } from '../utils/branchRoutes';
import { TransportDisclosure } from './TransportDisclosure';
import { DayRouteStroke, DayRouteRail, routeBandPaths, DAY_ROUTE_ANCHOR } from './DayRouteStroke';
import { StopCard } from './StopCard';
import { CategoryBadge } from './CategoryBadge';
import { buildStopMapsUrl, buildFullDayMapsUrl } from '../utils/itinerary';
interface Props {day:ItineraryDay; photos?:Record<string,string[]>; onSelect?:(stop:ItineraryStop,rect:DOMRect)=>void; preview:RoutePreview; onPreview:(ids:[string,string],id:string|null)=>void; onConfirm?:(ids:[string,string],id:string|null)=>void; route?:boolean}
export function BranchTimeline({day,photos,onSelect,preview,onPreview,onConfirm,route=false}:Props) {
 const effective=previewDay(day,preview), allRows=slots(day), rows=allRows.map(row=>row.filter(stop=>!inactive(effective,stop.id))), reduced=useReducedMotion();
 const [interacted,setInteracted]=useState(false);
 const animated=route&&!reduced&&!interacted, step=.85;
 const choose=(ids:[string,string],id:string|null)=>{setInteracted(true);onPreview(ids,id);};
 const confirm=(ids:[string,string],id:string|null)=>{setInteracted(true);onConfirm?.(ids,id);};
 const layoutTransition={duration:reduced?0:.32,ease:[.22,.75,.25,1] as [number,number,number,number]};
 const root=useRef<HTMLDivElement>(null), [width,setWidth]=useState(0);
 useLayoutEffect(()=>{const el=root.current;if(!el)return;const measure=()=>setWidth(route?el.getBoundingClientRect().width:el.clientWidth);measure();const observer=new ResizeObserver(measure);observer.observe(el);return()=>observer.disconnect();},[]);
 const maskPrefix=useId().replace(/[^a-zA-Z0-9_-]/g,'');
 // Cut connector strokes out of the translucent transport strips, without changing geometry.
 useLayoutEffect(()=>{
  const el=root.current;if(!el)return;
  const update=()=>{
   el.querySelectorAll<SVGSVGElement>('svg[data-transport-connector]').forEach(svg=>{
    const holes=svg.querySelector<SVGGElement>('[data-transport-mask-holes]');
    const parent=svg.parentElement;if(!holes||!parent)return;
    const bounds=svg.getBoundingClientRect();const vb=svg.viewBox.baseVal;
    if(!bounds.width||!bounds.height)return;
    const rects=Array.from(parent.querySelectorAll<HTMLElement>('[data-transport-strip]')).map(strip=>{
     const b=strip.getBoundingClientRect();const r=document.createElementNS('http://www.w3.org/2000/svg','rect');
     r.setAttribute('x',String((b.left-bounds.left-1)*vb.width/bounds.width));
     r.setAttribute('y',String((b.top-bounds.top-1)*vb.height/bounds.height));
     r.setAttribute('width',String((b.width+2)*vb.width/bounds.width));
     r.setAttribute('height',String((b.height+2)*vb.height/bounds.height));
     r.setAttribute('fill','black');return r;
    });holes.replaceChildren(...rects);
   });
  };
  update();const observer=new ResizeObserver(update);observer.observe(el);
  el.querySelectorAll<HTMLElement>('[data-transport-strip], [data-transport-connector]').forEach(node=>observer.observe(node));
  return()=>observer.disconnect();
 });
 const anim=(delay:number)=>({initial:animated?{opacity:0}:false,animate:{opacity:1},transition:{duration:animated?.24:0,delay:animated?delay:0}});
 // Match the normal DayRouteView rail margins (my-1.5 = 6 CSS px).
 const nodeGap=6, nodeDiameter=28;
 const straightRail=(delay:number,duration:number,top=0)=><DayRouteRail top={top} animated={animated} delay={delay} duration={duration}/>;
 const center=(count:number,index:number)=>count===1?(route?DAY_ROUTE_ANCHOR:width/2):index===0?(width-8)/4:(3*width+8)/4;
 function connector(row:ItineraryStop[],next:ItineraryStop[],i:number){
  const linear=row.length===1&&next.length===1, junction=width/2;
  const from=row.filter(s=>!inactive(effective,s.id));
  const pairs:[ItineraryStop,ItineraryStop][][]=next.length===2?next.map(b=>from.map(a=>[a,b] as [ItineraryStop,ItineraryStop])):row.map(a=>[[a,next[0]]]);
  const instructions=pairs.map(ps=>ps.map(([a,b])=>({key:JSON.stringify([a.id,b.id]),from:a.title,text:routeInstructions(day,a,b,!route),modeKeys:routeModes(day,a,b),enabled:routeVisible(effective,a,b),duration:route?routeMinutes(day,a,b):undefined})).filter(x=>x.text||x.modeKeys.length||x.duration!=null));
  // Deduplicate only identical ordered, known mode lists on unresolved connections.
  const items=instructions.flat();
  const shared= !linear && items.length===pairs.flat().length && items.length>1 && items.every(x=>!x.enabled&&x.modeKeys.length>0&&JSON.stringify(x.modeKeys)===JSON.stringify(items[0].modeKeys));
  const color=route?'#1F3FB0':'#777777';
  const lines: {d:string;faded:boolean;phase:number}[]=[];
  if(linear)lines.push({d:`M${center(1,0)} 0 V100`,faded:false,phase:0});
  else {
   row.forEach((a,j)=>{const x=center(row.length,j);lines.push({d:`M${x} 0 V15 Q${x} 25 ${x+(junction-x)*.08} 25 H${junction+(x-junction)*.08} Q${junction} 25 ${junction} 35`,faded:inactive(effective,a.id),phase:0});});
   lines.push({d:`M${junction} 35 V65`,faded:false,phase:0});
   next.forEach((b,j)=>{const x=center(next.length,j);lines.push({d:`M${junction} 65 Q${junction} 75 ${junction+(x-junction)*.08} 75 H${x+(junction-x)*.08} Q${x} 75 ${x} 85 V100`,faded:inactive(effective,b.id),phase:1});});
  }
  // Route-only geometry: connector bands live outside the transport content.
  // Their height is independent of wrapped instructions, and no masking is needed.
  if(route||!linear){
   const showInfo=items.some(x=>x.modeKeys.length>0||(x.enabled&&(!!x.text||x.duration!=null)));
   if(linear){
    return <motion.div layout={reduced?false:"position"} transition={{layout:layoutTransition}} className="relative" style={{minHeight:48}}>
     {straightRail(i*step+.24,.55)}
     {showInfo&&<motion.div {...anim(i*step+.4)} className="relative w-full pl-10 py-[26px] text-center">
      {items.map(item=><TransportDisclosure key={item.key} text={item.text} modeKeys={item.modeKeys} enabled={item.enabled} duration={item.enabled?item.duration:undefined}/>)}
     </motion.div>}
    </motion.div>;
   }
   const source=row.map((_,j)=>center(row.length,j)), target=next.map((_,j)=>center(next.length,j));
   const lanes=linear?[14]:shared?[junction]:next.length===2?target:source;
   const topHeight=row.length===2&&lanes.length===2&&next.length===2?48:26;
   const bottomHeight=26;
   const bandPaths=(a:number[],b:number[],h:number,neutral=false)=>routeBandPaths(a,b,h,junction,neutral);
   const band=(paths:string[],height:number,phase:number)=><DayRouteStroke height={height} paths={width>0?paths:[]} animated={animated} delay={i*step+.24+phase*.28} duration={.27} color={color} strokeWidth={route?1:2}/>;
   // No info: connect directly, with no unnecessary blank transport row.
   if(!showInfo)return <div>{band(bandPaths(source,target,48,row.length===2&&next.length===2),48,0)}</div>;
   return <motion.div layout={reduced?false:"position"} transition={{layout:layoutTransition}} className="relative flex flex-col">
    {band(bandPaths(source,lanes,topHeight,row.length===2&&next.length===2&&lanes.length===2),topHeight,0)}
    <div className="relative">
     <motion.div {...anim(i*step+.4)} className={`relative w-full grid gap-2 items-stretch ${!shared&&pairs.length===2?'grid-cols-2':'grid-cols-1'} ${linear?'pl-10':''}`}>
      {shared?<TransportDisclosure text="" modeKeys={items[0].modeKeys} enabled={false}/>:instructions.map((entries,j)=><div key={j} className="min-w-0 flex flex-col justify-center text-center">
       {entries.map(item=><TransportDisclosure key={item.key} text={item.text} modeKeys={item.modeKeys} enabled={item.enabled} duration={item.enabled?item.duration:undefined} from={pairs[j].length>1?item.from:undefined}/>)}
      </div>)}
     </motion.div>
    </div>
    {band(bandPaths(lanes,target,bottomHeight),bottomHeight,1)}
   </motion.div>;
  }
  return <motion.div layout={reduced?false:"position"} transition={{layout:layoutTransition}} className={`relative flex items-center ${linear?(route?'min-h-[58px]':instructions.some(xs=>xs.length)?'min-h-[40px]':'min-h-[24px]'):'min-h-[100px]'} ${route?'py-2':'py-3'}`}>
   {width>0&&<svg viewBox={`0 0 ${width} 100`} preserveAspectRatio="none" data-transport-connector="" className="absolute inset-0 w-full h-full overflow-visible" aria-hidden="true">
    <defs><mask id={`${maskPrefix}-transport-${i}`} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x={-4} y={-4} width={width+8} height={108} style={{maskType:'luminance'}}><rect x={-4} y={-4} width={width+8} height={108} fill="white"/><g data-transport-mask-holes=""/></mask></defs><g mask={`url(#${maskPrefix}-transport-${i})`}>

    {lines.map((l,k)=><motion.path key={k} d={l.d} fill="none" stroke={route&&l.faded?'#B9B5AD':color} strokeWidth={route?1.5:2} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" opacity={l.faded?(route?.35:.18):1} initial={animated?{pathLength:0}:false} animate={{pathLength:1}} transition={{duration:animated?(linear?.55:.27):0,delay:animated?i*step+.24+l.phase*.28:0,ease:'linear'}}/>)}</g></svg>}
   <motion.div {...anim(i*step+.4)} className={`relative w-full grid gap-2 items-start ${!shared&&pairs.length===2?'grid-cols-2':'grid-cols-1'} ${linear&&route?'pl-10':''}`}>
    {shared?<TransportDisclosure text="" modeKeys={items[0].modeKeys} enabled={false}/>:instructions.map((items,j)=><div key={j} className={`min-w-0 ${linear&&route?'text-left':'text-center'} ${inactive(effective,(next.length===2?next[j]:row[j]).id)?'opacity-40':''}`}>
     {items.map(item=><TransportDisclosure key={item.key} text={item.text} modeKeys={item.modeKeys} enabled={item.enabled} duration={item.enabled?item.duration:undefined} from={pairs[j].length>1?item.from:undefined}/>)}
    </div>)}
   </motion.div>
  </motion.div>;
 }
 return <div className={route?'space-y-4':''}>
 <div className={route?'rounded-3xl bg-[#F4F2ED] p-4 sm:p-5 shadow-sm ring-1 ring-black/[0.06]':''}>
 {route&&<><div className="flex items-center justify-between gap-2 pb-4 mb-3 border-b border-black/[0.06]"><div><p className="text-xs font-medium text-[#5E5A52]">Route Overview</p><h3 className="text-base font-semibold text-[#1A1A1A] mt-0.5">Day {day.dayNumber} · {rows.length} 個站點</h3></div><span className="text-xs font-mono text-[#5E5A52] tabular-nums text-right">{day.stops[0]?.time} – {day.stops[day.stops.length-1]?.time}</span></div><p className="text-xs text-[#5E5A52] mb-4">{effective.optionalGroups?.some(g=>!g.selectedEventId)?'選擇備選行程後顯示預計交通時間':travelSummary(effective)}</p></>}
 <div ref={root}>
 {rows.map((row,i)=>{const next=rows[i+1],group=day.optionalGroups?.find(g=>g.eventIds.includes(row[0].id)),chosen=effective.optionalGroups?.find(g=>g.eventIds.includes(row[0].id))?.selectedEventId;return <React.Fragment key={allRows[i][0].id}>
 <motion.div {...anim(i*step)} layout={reduced?false:"position"} transition={{...anim(i*step).transition,layout:layoutTransition}} className={`relative grid items-stretch gap-2 ${row.length===2?'grid-cols-2':'grid-cols-1'}`}>
 <AnimatePresence initial={false} mode="popLayout">{row.map((stop,j)=>{const faded=inactive(effective,stop.id),confirmed=!!group?.selectedEventId;return <motion.div key={stop.id} layout={!reduced} initial={reduced?false:{opacity:0}} animate={{opacity:1}} exit={{opacity:0,transition:{duration:reduced?0:.14}}} transition={{layout:layoutTransition,duration:reduced?0:.2}} className="min-w-0 flex flex-col relative" style={route&&row.length===1&&next?{minHeight:nodeDiameter+nodeGap}:undefined}>
 {route&&row.length===1&&next&&straightRail(i*step,.24,nodeDiameter+nodeGap)}
 <div className={`flex-1 ${route?'':'[&>article]:h-full'} ${faded?'opacity-40':''}`}>
 {route?<div className={`relative ${row.length===2?'flex flex-col items-center text-center gap-1 rounded-xl bg-white/50 p-2 h-full':'flex items-start gap-2.5'}`}><span className="flex shrink-0 w-7 h-7 rounded-full bg-[#1F3FB0] text-white items-center justify-center text-xs font-semibold tabular-nums">{i+1}{row.length===2?(j===0?'A':'B'):''}</span><div className={`min-w-0 flex-1 ${row.length===1?'pr-10':''}`}><div className={`flex flex-wrap items-center gap-1.5 ${row.length===2?'justify-center':''}`}><span className="font-mono text-[11px] font-medium text-[#5E5A52] tabular-nums">{stop.time}</span><CategoryBadge category={stop.category}/></div><h4 className="mt-1 text-[15px] font-semibold text-[#1A1A1A] leading-snug break-words">{stop.title}</h4><p className="mt-0.5 text-xs text-[#5E5A52] break-words">{stop.locationName}</p><a href={buildStopMapsUrl(stop.mapQuery)} target="_blank" rel="noopener noreferrer" aria-label={`Open ${stop.title} in Google Maps`} className={`${row.length===1?'absolute right-0 top-0':'mt-2'} inline-flex min-h-[32px] min-w-[32px] items-center justify-center rounded-full bg-[#EDEBE6] text-[#1F3FB0] ring-1 ring-black/[0.06]`}><ArrowUpRight className="w-4 h-4"/></a></div></div>:<StopCard compact={row.length===2} stop={stop} customPhotoUrl={photos?.[stop.id]?.[0]??''} onSelect={onSelect!}/>}
 </div>
 {group&&<div className="text-center text-xs py-2 text-[#5E5A52] space-y-1">{confirmed?<><p>{group.selectedEventId===stop.id?'✓ 已前往':'未前往'}</p>{!route&&onConfirm&&group.selectedEventId===stop.id&&<button type="button" className="rounded-full bg-white px-2 py-2 text-[#1F3FB0]" onClick={()=>confirm(group.eventIds,null)}>解除確認</button>}</>:<><button type="button" aria-pressed={chosen===stop.id} className={`rounded-full px-2 py-2 ${chosen===stop.id?'bg-[#1F3FB0] text-white':'bg-white text-[#1F3FB0]'}`} onClick={()=>choose(group.eventIds,chosen===stop.id?null:stop.id)}>{chosen===stop.id?'取消預覽 · 查看其他選項':'預覽此行程'}</button>{!route&&onConfirm&&chosen===stop.id&&<button type="button" className="block mx-auto rounded-full bg-[#1F3FB0] text-white px-2 py-2" onClick={()=>confirm(group.eventIds,stop.id)}>確認實際前往</button>}</>}</div>}
 </motion.div>})}</AnimatePresence>
 </motion.div>
 {next&&(route?(next.length===1?<div style={{paddingBottom:nodeGap}}>{connector(row,next,i)}</div>:connector(row,next,i)):<div data-waybook-route-to={JSON.stringify(next.map(stop=>stop.id))}>{connector(row,next,i)}</div>)}
 </React.Fragment>})}
 </div></div>
 {day.optionalGroups?.some(g=>!g.selectedEventId)&&<p className="text-xs text-center text-[#5E5A52] mt-2">個人預覽不會更改共享行程；實際行程由管理員確認及發佈。</p>}
 {route&&(effective.optionalGroups?.some(g=>!g.selectedEventId)?<p className="text-xs text-center text-[#5E5A52]">選定所有備選行程後可開啟完整路線。</p>:<a className="w-full min-h-[52px] flex items-center justify-center gap-2 rounded-2xl bg-[#1F3FB0] px-5 py-3.5 text-sm font-semibold text-white shadow-sm" href={buildFullDayMapsUrl(day.stops.filter(s=>!inactive(effective,s.id)))} target="_blank" rel="noopener noreferrer"><Navigation className="w-4 h-4"/>Open Full Day Route in Google Maps</a>)}
 </div>
}
