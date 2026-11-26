import React from 'react';
import { TrainFront, Bus, Car, Footprints, Plane, Ship, Route } from 'lucide-react';
import { modes } from '../utils/branchRoutes';
interface Props {text:string; modeKeys:string[]; enabled:boolean; from?:string; duration?:number}
const icons:Record<string,typeof Route>={mrt:TrainFront,train:TrainFront,hsr:TrainFront,bus:Bus,charter:Bus,car:Car,taxi:Car,walking:Footprints,flight:Plane,ferry:Ship,mixed:Route};
export function TransportDisclosure({text,modeKeys,enabled,from,duration}:Props){
 const label=modeKeys.map(m=>modes[m]??m).join(' ＋ ');
 const details=!!text&&text!==label;
 if(!label&&(!enabled||!text)&&(!enabled||duration==null))return null;
 return <div className="mt-1 rounded-md bg-black/[0.05] px-2 py-1 text-center text-[11px] text-[#5E5A52] break-words leading-relaxed min-w-0">
 {from&&<span className="block font-medium">從 {from} 出發</span>}
 {enabled&&duration!=null&&<p className="text-[15px] font-semibold text-[#1F3FB0]">約 {duration} 分鐘</p>}
 {modeKeys.length>0&&<div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1">{modeKeys.map((m,i)=>{const Icon=icons[m]??Route;return <React.Fragment key={i}>{i>0&&<span>＋</span>}<span className="inline-flex items-center gap-0.5"><Icon className="w-3.5 h-3.5 shrink-0"/>{modes[m]??m}</span></React.Fragment>})}</div>}
 {enabled&&details&&<p className="mt-1 whitespace-pre-line text-center">{text}</p>}
 </div>;
}
