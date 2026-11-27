import React, {useEffect,useState,useRef} from 'react';
import {Bell,BellRing} from 'lucide-react';
import {familyRead} from '../utils/familyAccess';
import {cloudWrite} from '../utils/driveCloud';

const key = String(import.meta.env.VITE_WAYBOOK_VAPID_PUBLIC_KEY || '').trim();
const DEVICE_KEY = 'waybook_push_device_v48';
function deviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id || !/^[a-f0-9-]{36}$/i.test(id)) {id=crypto.randomUUID();localStorage.setItem(DEVICE_KEY,id);}
  return id;
}
function vapidKey() {
  const raw=atob(key.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-key.length%4)%4));
  if(raw.length!==65 || raw.charCodeAt(0)!==4)throw Error('推播公開金鑰設定不正確');
  return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
function workerSupportsPush(worker: ServiceWorker | null):Promise<boolean>{
  if(!worker)return Promise.resolve(false);
  return new Promise(resolve=>{
    const channel=new MessageChannel();
    const done=(ok:boolean)=>{clearTimeout(timer);channel.port1.close();resolve(ok);};
    const timer=window.setTimeout(()=>done(false),2500);
    channel.port1.onmessage=e=>done(e.data?.type==='WAYBOOK_PUSH_READY');
    try{worker.postMessage({type:'WAYBOOK_PUSH_PING'},[channel.port2]);}catch{done(false);}
  });
}
function isDenied(){return Notification.permission==='denied';}
function isSupported(){return window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;}
export function PushSettings({adminToken}:{adminToken:string}) {
  const [open,setOpen]=useState(false);
  const [ready,setReady]=useState(false);
  const [enabled,setEnabled]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const reg=useRef<ServiceWorkerRegistration|null>(null);
  const sub=useRef<PushSubscription|null>(null);
  const supported=isSupported();
  const ios=/iPad|iPhone|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const standalone=window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & {standalone?:boolean}).standalone===true;
  useEffect(()=>{
    if(!supported || !key || (ios&&!standalone))return;
    let alive=true;let request=0;
    const load=async()=>{
      const attempt=++request;
      try{
        const registration=await navigator.serviceWorker.ready;
        if(!alive||attempt!==request)return;
        const compatible=await workerSupportsPush(registration.active);
        if(!alive||attempt!==request)return;
        if(!compatible){setReady(false);setMessage('請先完成新版 App 更新，或關閉所有 Waybook 視窗再重開。');return;}
        reg.current=registration;
        const current=await registration.pushManager.getSubscription();
        if(!alive||attempt!==request)return;
        sub.current=current;
        let registered=false;
        if(current){
          try{const status=await familyRead<{registered:boolean}>({action:'pushStatus',deviceId:deviceId(),endpoint:current.endpoint});registered=Boolean(status.registered && Notification.permission==='granted');}
          catch{if(alive&&attempt===request)setMessage('無法確認雲端訂閱；可按啟用通知重新登錄。');}
        }
        if(alive&&attempt===request){setEnabled(registered);setReady(true);}
      }catch{if(alive&&attempt===request)setMessage('無法確認通知設定，請稍後重試。');}
    };
    void load();
    navigator.serviceWorker.addEventListener('controllerchange',load);
    return()=>{alive=false;navigator.serviceWorker.removeEventListener('controllerchange',load);};
  },[supported,ios,standalone]);
  const enable=async()=>{
    if(!reg.current || busy)return;
    if(isDenied()){setMessage('通知已被封鎖，請在手機或瀏覽器設定中允許。');return;}
    setBusy(true);setMessage('');
    try{
      // Subscribe directly in the click handler, before any network await (iOS gesture requirement).
      const current=sub.current || await reg.current.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:vapidKey()});
      sub.current=current;
      await familyRead({action:'pushRegister',deviceId:deviceId(),subscription:JSON.stringify(current.toJSON())});
      setEnabled(true);setMessage('此裝置已啟用旅程通知。');
    }catch(e){setEnabled(false);setMessage(isDenied()?'通知已被封鎖，請至系統設定開啟。':(e instanceof Error?e.message:'無法啟用通知'));}
    finally{setBusy(false);}
  };
  const disable=async()=>{
    if(!reg.current || busy)return;
    setBusy(true);setMessage('');
    try{
      const current=await reg.current.pushManager.getSubscription();
      if(current){await current.unsubscribe();if(await reg.current.pushManager.getSubscription())throw Error('無法取消瀏覽器推播訂閱');}
      sub.current=null;setEnabled(false);
      try{await familyRead({action:'pushRemove',deviceId:deviceId()});setMessage('此裝置已停止接收通知。');}
      catch{setMessage('本機已停止通知；雲端記錄將於下次傳送失敗時清除。');}
    }catch(e){setMessage(e instanceof Error?e.message:'無法關閉通知');}
    finally{setBusy(false);}
  };
  const test=async()=>{
    if(!adminToken||busy)return;
    setBusy(true);setMessage('');
    try{const result=await cloudWrite<{queued:boolean}>('pushTest',{},adminToken);setMessage(result.queued?'已提交測試通知（尚未確認送達）。':'無法提交測試通知，請檢查 Apps Script 設定或稍後重試。');}
    catch(e){setMessage(e instanceof Error?e.message:'測試通知提交失敗');}
    finally{setBusy(false);}
  };
  return <div className="relative shrink-0">
    <button type="button" aria-label="通知設定" aria-expanded={open} onClick={()=>setOpen(v=>!v)} className="min-h-[44px] min-w-[44px] rounded-full inline-flex items-center justify-center bg-[#F4F2ED] ring-1 ring-black/10 text-[#5E5A52]">{enabled?<BellRing className="w-4 h-4 text-[#1F3FB0]"/>:<Bell className="w-4 h-4"/>}</button>
    {open&&<><div className="fixed inset-0 z-[59] bg-black/25" onClick={()=>setOpen(false)}/><div role="dialog" aria-label="通知設定" className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] w-[min(320px,88vw)] rounded-2xl bg-[#F4F2ED] p-4 shadow-lg ring-1 ring-black/10 text-left space-y-2">
      <div className="flex items-center justify-between"><b className="text-sm">通知設定</b><button type="button" aria-label="關閉通知設定" onClick={()=>setOpen(false)} className="p-2 text-xs">✕</button></div>
      <p className="text-xs text-[#5E5A52]">此裝置接收行程、回憶及 App 更新通知。App 鎖定時仍可收到不含私人內容的通知。</p>
      {!key?<p className="text-xs">推播尚未設定。</p>:ios&&!standalone?<p className="text-xs">iPhone 請先加入主畫面，再從 App 圖示開啟（iOS 16.4 以上）。</p>:!supported?<p className="text-xs">此瀏覽器不支援 Web Push。</p>:!ready?<p className="text-xs">正在等待 App 服務啟用，請稍後重開。</p>:<>
        <p className="text-xs font-medium">{enabled?'已啟用通知':'尚未啟用通知'}</p>
        <button type="button" disabled={busy} onClick={()=>void (enabled?disable():enable())} className="w-full min-h-10 rounded-xl bg-[#1F3FB0] text-white text-xs disabled:opacity-50">{busy?'處理中…':enabled?'關閉通知':'啟用通知'}</button>
        {!enabled&&sub.current&&<button type="button" disabled={busy} onClick={()=>void disable()} className="text-xs underline">移除此裝置訂閱</button>}
      </>}
      {adminToken&&<button type="button" disabled={busy} onClick={()=>void test()} className="w-full min-h-10 rounded-xl bg-white ring-1 ring-black/10 text-[#1F3FB0] text-xs disabled:opacity-50">發送測試通知（所有訂閱裝置）</button>}
      {message&&<p role="status" className="text-xs break-words text-[#5E5A52]">{message}</p>}
    </div></>}
  </div>;
}
