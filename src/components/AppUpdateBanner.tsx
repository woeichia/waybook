import React,{useEffect,useRef,useState} from 'react';
import {RefreshCw} from 'lucide-react';
const buildId=String(import.meta.env.VITE_WAYBOOK_BUILD_ID||'');
const versionUrl=new URL(import.meta.env.BASE_URL+'waybook-version.json',window.location.origin);
export function AppUpdateBanner({blocked,canUpdate}:{blocked:boolean;canUpdate:()=>boolean}){
  const [available,setAvailable]=useState(false);
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
          setAvailable(true);if(r&&!r.waiting)void r.update().catch(()=>{});
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
    if(busy||blocked||!canUpdateRef.current())return;
    setBusy(true);setMessage('');
    try{
      const r=await navigator.serviceWorker.getRegistration();
      if(!r)throw Error('App 服務尚未就緒，請稍後重開。');
      if(!r.waiting)await r.update();
      if(!canUpdateRef.current())throw Error('請先儲存變更並關閉活動內容。');
      if(r.waiting){
        const waiting=r.waiting;
        await new Promise<void>((resolve,reject)=>{
          const cleanup=()=>{window.clearTimeout(timer);waiting.removeEventListener('statechange',change);navigator.serviceWorker.removeEventListener('controllerchange',controller);};
          const change=()=>{if(waiting.state==='activated'){cleanup();resolve();}else if(waiting.state==='redundant'){cleanup();reject(Error('更新已被取代，請重試。'));}};
          const controller=()=>{if(navigator.serviceWorker.controller===waiting){cleanup();resolve();}};
          const timer=window.setTimeout(()=>{cleanup();reject(Error('更新尚未完成，請稍後重試或關閉再開啟。'));},15000);
          waiting.addEventListener('statechange',change);navigator.serviceWorker.addEventListener('controllerchange',controller);
          waiting.postMessage({type:'SKIP_WAITING'});change();
        });
      }else if(r.installing)throw Error('正在下載新版，請稍後再按更新。');
      // Reload only on the explicit user action, and never when a draft/detail is open.
      if(!canUpdateRef.current())throw Error('新版已準備好，請儲存變更後再更新。');
      window.location.reload();
    }catch(e){setMessage(e instanceof Error?e.message:'更新暫未完成');setBusy(false);}
  };
  if(!available)return null;
  return <div role="status" className="mt-2 mb-2 rounded-2xl bg-[#F4F2ED] ring-1 ring-black/10 px-3 py-2.5 text-xs text-[#26241F]">
    <div className="flex items-center gap-2"><RefreshCw className="w-4 h-4 shrink-0 text-[#1F3FB0]"/><span className="flex-1">Waybook 有新版本</span><button type="button" disabled={blocked||busy} onClick={()=>void update()} className="rounded-full bg-[#1F3FB0] px-3 py-2 text-white disabled:opacity-50">{busy?'更新中…':'立即更新'}</button></div>
    {(blocked||message)&&<p className="mt-1 text-[#5E5A52]">{message||'請先完成編輯、發佈或關閉活動內容。'}</p>}
  </div>;
}
