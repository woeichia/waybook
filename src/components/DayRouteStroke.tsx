import { motion } from 'motion/react';

// CSS-pixel coordinates, no viewBox scaling. Every Day Route stroke shares these values.
export const DAY_ROUTE_STROKE = {stroke:'#1F3FB0',strokeWidth:1,strokeLinecap:'butt' as const,strokeLinejoin:'round' as const,fill:'none',vectorEffect:'non-scaling-stroke' as const};
export const DAY_ROUTE_ANCHOR = 14;
interface AnimationProps {animated:boolean;delay:number;duration:number}
const animation=({animated,delay,duration}:AnimationProps)=>({initial:animated?{pathLength:0}:false as const,animate:{pathLength:1},transition:{duration:animated?duration:0,delay:animated?delay:0,ease:'linear' as const}});
export function DayRouteRail({top=0,...props}:AnimationProps&{top?:number}) {
 return <div aria-hidden="true" className="absolute pointer-events-none" style={{left:0,right:0,top,bottom:0}}><svg width="100%" height="100%" className="block overflow-visible"><motion.line x1={DAY_ROUTE_ANCHOR} x2={DAY_ROUTE_ANCHOR} y1={0} y2="100%" {...DAY_ROUTE_STROKE} {...animation(props)}/></svg></div>;
}
export function DayRouteStroke({height,paths,...props}:AnimationProps&{height:number;paths:string[]}) {
 return <svg width="100%" height={height} style={{height}} className="block w-full shrink-0 overflow-visible pointer-events-none" aria-hidden="true">{paths.map((d,k)=><motion.path key={k} d={d} {...DAY_ROUTE_STROKE} {...animation(props)}/>)}</svg>;
}
// Build a tree with one trunk and one horizontal bus, without duplicated strokes.
// Branches use clean T-junctions; single-lane elbows remain rounded.
function tree(source:number,targets:number[],y:number,h:number,reverse=false):string[] {
 const bs=[...new Set(targets)], mid=y+h/2, end=y+h;
 const far=bs.reduce((a,b)=>Math.abs(b-source)>Math.abs(a-source)?b:a);
 const d=Math.sign(far-source),r=Math.min(6,Math.abs(far-source)/2,h/4);
 if(bs.length>1){
  const lo=Math.min(source,...bs),hi=Math.max(source,...bs);
  const path=reverse?`M${source} ${mid} V${end} M${lo} ${mid} H${hi}`:`M${source} ${y} V${mid} M${lo} ${mid} H${hi}`;
  return [path+bs.map(b=>reverse?` M${b} ${y} V${mid}`:` M${b} ${mid} V${end}`).join('')];
 }
 const main=reverse
  ? (r<.01?`M${far} ${y} V${end}`:`M${far} ${y} V${mid-r} Q${far} ${mid} ${far-d*r} ${mid} H${source+d*r} Q${source} ${mid} ${source} ${mid+r} V${end}`)
  : (r<.01?`M${source} ${y} V${end}`:`M${source} ${y} V${mid-r} Q${source} ${mid} ${source+d*r} ${mid} H${far-d*r} Q${far} ${mid} ${far} ${mid+r} V${end}`);
 return [main];
}
export function routeBandPaths(a:number[],b:number[],h:number,junction:number,neutral=false):string[] {
 if(!neutral&&a.length===b.length&&a.every((x,j)=>Math.abs(x-b[j])<.01))return a.map(x=>`M${x} 0 V${h}`);
 if(a.length===1)return tree(a[0],b,0,h);
 if(b.length===1)return tree(b[0],a,0,h,true);
 return [...tree(junction,a,0,h/2,true),...tree(junction,b,h/2,h/2)];
}
