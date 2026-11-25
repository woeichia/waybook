import React, {useRef,useState} from 'react';

type Photo = {src:string;alt:string};
interface Props {images:Photo[];index:number;onChange:(index:number)=>void;}

/** Full-size photo rail: one page at a time, with finger-tracked horizontal movement. */
export function PhotoSwipeStage({images,index,onChange}:Props){
  const stage=useRef<HTMLDivElement>(null);
  const gesture=useRef<{id:number;x:number;y:number;axis:'x'|'y'|null;at:number}|null>(null);
  const [offset,setOffset]=useState(0);
  const [dragging,setDragging]=useState(false);
  const reset=()=>{gesture.current=null;setDragging(false);setOffset(0);};
  return <div ref={stage} className="relative w-full h-[min(72dvh,720px)] overflow-hidden select-none" style={{touchAction:'none'}}
    onClick={e=>e.stopPropagation()}
    onPointerDown={e=>{
      if(!e.isPrimary || e.button!==0 || (e.pointerType==='touch' && e.clientX<=35))return;
      gesture.current={id:e.pointerId,x:e.clientX,y:e.clientY,axis:null,at:performance.now()};
      e.currentTarget.setPointerCapture(e.pointerId);
    }}
    onPointerMove={e=>{
      const g=gesture.current;if(!g||g.id!==e.pointerId)return;
      const dx=e.clientX-g.x,dy=e.clientY-g.y;
      if(!g.axis){if(Math.max(Math.abs(dx),Math.abs(dy))<8)return;g.axis=Math.abs(dx)>Math.abs(dy)*1.2?'x':'y';}
      if(g.axis!=='x')return;
      setDragging(true);setOffset((index===0&&dx>0)||(index===images.length-1&&dx<0)?dx*.22:dx);
    }}
    onPointerUp={e=>{
      const g=gesture.current;if(!g||g.id!==e.pointerId)return;
      const dx=e.clientX-g.x,dy=e.clientY-g.y;
      const threshold=Math.min(95,Math.max(45,(stage.current?.clientWidth||300)*.2));
      const flick=performance.now()-g.at<260&&Math.abs(dx)>40;
      if(g.axis==='x'&&Math.abs(dx)>Math.abs(dy)*1.2&&(Math.abs(dx)>=threshold||flick)){
        const next=Math.max(0,Math.min(images.length-1,index+(dx<0?1:-1)));if(next!==index)onChange(next);
      }
      reset();
    }}
    onPointerCancel={reset} onLostPointerCapture={reset}>
    <div className="absolute inset-0 flex" style={{transform:`translate3d(calc(${-index*100}% + ${offset}px),0,0)`,transition:dragging?'none':'transform 260ms cubic-bezier(.22,.8,.24,1)'}}>
      {images.map((photo,i)=><div key={i} className="h-full w-full shrink-0 flex items-center justify-center px-1" aria-hidden={i!==index}>
        {Math.abs(i-index)<=1&&photo.src&&<img src={photo.src} alt={photo.alt} draggable={false} className="max-w-full max-h-full object-contain pointer-events-none"/>}
      </div>)}
    </div>
  </div>;
}
