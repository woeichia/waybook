import React, {useEffect,useRef,useState} from 'react';
import {Film, X} from 'lucide-react';

/** Admin-only isolated video display test. Never uploads data or touches Drive. */
export function VideoPlayerLab() {
  const inputRef=useRef<HTMLInputElement>(null);
  const videoRef=useRef<HTMLVideoElement>(null);
  const [url,setUrl]=useState('');
  const [name,setName]=useState('');
  const [size,setSize]=useState({width:0,height:0});
  useEffect(()=>()=>{if(url)URL.revokeObjectURL(url);},[url]);
  const select=(e:React.ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0];e.target.value='';
    if(!file||!file.type.startsWith('video/'))return;
    videoRef.current?.pause();
    setSize({width:0,height:0});setName(file.name);setUrl(URL.createObjectURL(file));
  };
  const close=()=>{videoRef.current?.pause();setUrl('');setName('');};
  return <section className="mt-3 rounded-2xl bg-[#EAF0F1] p-3 ring-1 ring-[#1F3FB0]/10 space-y-2" aria-label="HTML5 影片播放器獨立測試">
    <div className="flex items-center gap-2 text-sm font-semibold text-[#203A7C]"><Film size={16}/>播放器畫面測試（僅管理員）</div>
    <p className="text-xs text-[#56616A]">選取手機或電腦上的影片，測試原生播放器在螢幕上的大小與控制列。不會上傳、發布或修改 Google Drive 影片。</p>
    <input ref={inputRef} className="hidden" type="file" accept="video/*" onChange={select}/>
    {!url ? <button type="button" className="rounded-full bg-[#1F3FB0] text-white px-4 py-2 text-xs" onClick={()=>inputRef.current?.click()}>選擇影片試播</button> : <>
      <div className="flex items-center justify-between gap-2"><span className="text-xs truncate">{name}</span><button type="button" className="flex items-center gap-1 px-3 py-2 rounded-full bg-white text-xs" onClick={close}><X size={14}/>關閉測試</button></div>
      <div className="w-full mx-auto rounded-lg bg-black overflow-hidden" style={{maxWidth:size.height>size.width && size.width>0?'360px':'100%'}}>
        <video ref={videoRef} src={url} controls playsInline preload="metadata" className="block w-full h-auto max-h-[65dvh] object-contain" onLoadedMetadata={e=>{const v=e.currentTarget;setSize({width:v.videoWidth,height:v.videoHeight});}}/>
      </div>
      <p className="text-[11px] text-[#56616A] text-center">{size.width>0?`${size.width} × ${size.height} · `:''}原始畫面比例 · 頁內播放 · 可使用原生暫停及快轉</p>
    </>}
  </section>;
}
