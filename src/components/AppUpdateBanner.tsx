import React,{useEffect,useRef,useState} from 'react';
import {RefreshCw} from 'lucide-react';
const buildId=String(import.meta.env.VITE_WAYBOOK_BUILD_ID||'');
const markerKey='waybook-update-target';
const delay=(ms:number)=>new Promise<void>(resolve=>window.setTimeout(resolve,ms));
const versionUrl=new URL(import.meta.env.BASE_URL+'waybook-version.json',window.location.origin);
export function AppUpdateBanner({blocked,canUpdate}:{blocked:boolean;canUpdate:()=>boolean}){
  const [available,setAvailable]=useState(false);
  const [verified,setVerified]=useState(()=>{try{return !!buildId && sessionStorage.getItem(markerKey)===buildId;}catch{return false;}});
  const target=useRef('');
  const running=useRef(false);
  useEffect(()=>{if(!verified)return;try{sessionStorage.removeItem(markerKey);}catch{} const timer=window.setTimeout(()=>setVerified(false),5000);return()=>window.clearTimeout(timer);},[verified]);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const lastCheck=useRef(0);
  const canUpdateRef=useRef(canUpdate);canUpdateRef.current=canUpdate;
  useEffect(()=>{
    if(!buildId || !('serviceWorker' in navigator))return;
    let active=true;
    let watched:ServiceWorkerRegistration|undefined;
    let installing:ServiceWorker|null=null;
    const stateChanged=()=>{if(active&&watched?.waiting)setAvailable(true);};
    const found=()=>{
      installing?.removeEventListener('statechange',stateChanged);
      installing=watched?.installing||null;
      installing?.addEventListener('statechange',stateChanged);
      stateChanged();
    };
    const check=async()=>{
      if(document.hidden||!navigator.onLine||Date.now()-lastCheck.current<30000)return;
      lastCheck.current=Date.now();
      try{
        const r=await navigator.serviceWorker.getRegistration();
        if(!active)return;
        if(r&&r!==watched){watched?.removeEventListener('updatefound',found);watched=r;r.addEventListener('updatefound',found);found();}
        const url=new URL(versionUrl);url.searchParams.set('_',String(Date.now()));
        const response=await fetch(url,{cache:'no-store'});
        if(!response.ok)return;
        const info=await response.json();
        if(!active)return;
        if(typeof info.build==='string' && /^[a-f0-9]{40}$/i.test(info.build) && info.build!==buildId){
          target.current=info.build;setAvailable(true);if(r&&!r.waiting)void r.update().catch(()=>{});
        }
        if(r?.waiting)setAvailable(true);
      }catch{/* Network errors must not interrupt Waybook. */}
    };
    const onController=()=>{if(active)void check();};
    const onPush=(e:MessageEvent)=>{if(e.data?.type==='WAYBOOK_PUSH_OPEN'){lastCheck.current=0;void check();}};
    navigator.serviceWorker.addEventListener('controllerchange',onController);
    navigator.serviceWorker.addEventListener('message',onPush);
    document.addEventListener('visibilitychange',check);window.addEventListener('focus',check);window.addEventListener('online',check);
    const id=window.setInterval(check,120000);void check();
    return()=>{active=false;window.clearInterval(id);watched?.removeEventListener('updatefound',found);installing?.removeEventListener('statechange',stateChanged);navigator.serviceWorker.removeEventListener('controllerchange',onController);navigator.serviceWorker.removeEventListener('message',onPush);document.removeEventListener('visibilitychange',check);window.removeEventListener('focus',check);window.removeEventListener('online',check);};
  },[]);
  const update=async()=>{
    if(running.current||blocked||!canUpdateRef.current())return;
    running.current=true;setBusy(true);setMessage('正在檢查新版本…');
    const deadline=Date.now()+120000;
    const bounded=<T,>(task:Promise<T>):Promise<T>=>new Promise((resolve,reject)=>{
      const timer=window.setTimeout(()=>reject(Error('更新逾時，請重試或關閉所有 Waybook 視窗再開啟。')),Math.max(0,deadline-Date.now()));
      task.then(v=>{window.clearTimeout(timer);resolve(v);},e=>{window.clearTimeout(timer);reject(e);});
    });
    try{
      const r=await bounded(navigator.serviceWorker.getRegistration());
      if(!r)throw Error('App 服務尚未就緒，請稍後重開。');
      const initial=navigator.serviceWorker.controller;
      const initialActive=r.active;
      let requested:ServiceWorker|null=null;
      let nextCheck=0;
      const safe=()=>{if(!canUpdateRef.current())throw Error('請先儲存變更並關閉活動內容。');};
      while(Date.now()<deadline){
        safe();
        const current=navigator.serviceWorker.controller;
        // The active/controller object may change before the next polling tick.
        if(current && current.state==='activated' && (current!==initial || (requested && current===requested)))break;
        if(r.active && r.active.state==='activated' && r.active!==initialActive && current===r.active)break;
        if(r.waiting){
          setMessage('正在啟用新版…');
          if(requested!==r.waiting){requested=r.waiting;requested.postMessage({type:'SKIP_WAITING'});}
        }else if(r.installing){setMessage('正在下載新版…');}
        else if(Date.now()>=nextCheck){
          setMessage('正在檢查新版本…');nextCheck=Date.now()+10000;
          // A failed network check is retried within the overall deadline.
          const checked=await bounded(r.update()).then(()=>true,e=>{if(Date.now()>=deadline)throw e;return false;});
          if(checked && !r.installing && !r.waiting && target.current && r.active?.state==='activated')break;
        }
        await delay(400);
      }
      safe();
      const current=navigator.serviceWorker.controller;
      const changed=!!current && current.state==='activated' && (current!==initial || current===requested || (r.active!==initialActive && current===r.active));
      if(!changed){
        // Another tab or a previous attempt may already have activated the update.
        // Reload explicitly once, but only when there is no installing/waiting worker.
        if(r.installing||r.waiting||!target.current)throw Error('更新尚未啟用，請重試或關閉所有 Waybook 視窗再開啟。');
      }
      if(target.current)try{sessionStorage.setItem(markerKey,target.current);}catch{}
      setMessage('正在重新啟動，確認新版…');
      window.location.reload();
    }catch(e){setMessage(e instanceof Error?e.message:'更新暫未完成');setBusy(false);running.current=false;}
  };
  if(verified&&!available)return <p role="status" className="text-xs text-[#35704C] px-3 py-2">已確認新版 App 載入完成。</p>;
  if(!available)return null;
  return <div role="status" className="mt-2 mb-2 rounded-2xl bg-[#F4F2ED] ring-1 ring-black/10 px-3 py-2.5 text-xs text-[#26241F]">
    <div className="flex items-center gap-2"><RefreshCw className="w-4 h-4 shrink-0 text-[#1F3FB0]"/><span className="flex-1">Waybook 有新版本</span><button type="button" disabled={blocked||busy} onClick={()=>void update()} className="rounded-full bg-[#1F3FB0] px-3 py-2 text-white disabled:opacity-50">{busy?'更新中…':'立即更新'}</button></div>
    {(blocked||message)&&<p className="mt-1 text-[#5E5A52]">{message||'請先完成編輯、發佈或關閉活動內容。'}</p>}
  </div>;
}
