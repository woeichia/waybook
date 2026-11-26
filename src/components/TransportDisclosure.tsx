import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
interface Props {text:string; mode:string; enabled:boolean; defaultOpen:boolean; from?:string}
export function TransportDisclosure({text,mode,enabled,defaultOpen,from}:Props){
 const [open,setOpen]=useState(defaultOpen);
 const details=!!text&&text!==mode;
 if(!text&&!mode)return null;
 const label=mode||'交通說明';
 return <div className="mt-1 rounded-lg bg-[#F4F2ED] px-2 py-1 text-[11px] text-[#5E5A52] break-words leading-relaxed min-w-0">
 {from&&<span className="block font-medium">從 {from} 出發</span>}
 {enabled&&details?<button type="button" aria-expanded={open} className="w-full inline-flex items-center justify-center gap-1 min-h-[28px] text-left font-medium" onClick={()=>setOpen(v=>!v)}>{label}{open?<ChevronUp className="w-3 h-3 shrink-0"/>:<ChevronDown className="w-3 h-3 shrink-0"/>}</button>:<span>{label}</span>}
 {enabled&&details&&open&&<p className="mt-1 whitespace-pre-line text-left">{text}</p>}
 </div>;
}
