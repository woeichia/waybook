import React, {useEffect,useState} from 'react';
import {CloudUpload,CheckCircle2,AlertTriangle} from 'lucide-react';
import {authorizeDriveVideoUpload,readLocalVideoPilot,uploadPrivateVideoTest,warmupDriveOAuth,type DriveVideoResult} from '../utils/driveVideoPilot';
import {createVideoPoster,readPendingVideo,savePendingVideo} from '../utils/videoUploadReceipt';

/** Administrator upload remains separate from publishing, but its receipt survives refresh. */
export function DriveVideoUploadPilot({stopId}:{stopId:string}) {
  const [local,setLocal]=useState<{blob:Blob;name:string;duration:number}|null>(null);
  const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);
  const [progress,setProgress]=useState(0);const [error,setError]=useState('');
  const [done,setDone]=useState<DriveVideoResult|null>(null);const [reload,setReload]=useState(0);
  useEffect(()=>{void warmupDriveOAuth().catch(()=>{});},[]);
  useEffect(()=>{
    let active=true;setLoading(true);setError('');
    const saved=readPendingVideo(stopId);
    setDone(saved?{id:saved.fileId,name:saved.name,size:saved.size,mimeType:'video/mp4'}:null);
    readLocalVideoPilot(stopId).then(c=>{if(active)setLocal(c);})
      .catch(e=>{if(active)setError(e instanceof Error?e.message:'讀取失敗');})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[stopId,reload]);
  const send=async()=>{
    if(!local||busy)return;
    const saved=readPendingVideo(stopId);
    if(saved&&!window.confirm('此活動有尚未登錄的影片（File ID 已保留）。確定要再上傳一次？'))return;
    if(!window.confirm('確認上傳私人影片至 Google Drive？上傳後仍需登錄到行程。'))return;
    setBusy(true);setError('');setProgress(0);
    try{
      const token=await authorizeDriveVideoUpload();
      const result=await uploadPrivateVideoTest(local.blob,local.name,token,setProgress);
      // Record the verified file ID FIRST. Poster generation is best-effort and must not lose it.
      const receipt={fileId:result.id,name:result.name,size:Number(result.size)};
      savePendingVideo(stopId,receipt);
      try {const still=await createVideoPoster(local.blob);savePendingVideo(stopId,{...receipt,...still});}
      catch { /* A valid upload may not have a poster on all devices. */ }
      setDone(result);
      window.dispatchEvent(new CustomEvent('waybook:driveVideoUploaded',{detail:{stopId,fileId:result.id}}));
    }catch(e){setError(e instanceof Error?e.message:'Google Drive 上傳失敗');}
    finally{setBusy(false);}
  };
  return <section className="mt-3 rounded-2xl bg-[#EDF3FB] p-3 ring-1 ring-[#1F3FB0]/15 space-y-2" aria-label="Google Drive 私人影片上傳">
    <div className="flex items-center gap-2 text-[#203A7C] text-sm font-semibold"><CloudUpload size={17}/>Google Drive 私人影片上傳</div>
    <p className="text-xs leading-relaxed text-[#4A5568]">已上傳的 File ID 會保留在本裝置，重新整理也不會遺失。上傳後請在下方「雲端回憶短片」按「登錄雲端影片」才會分享至行程。上傳成功時也會嘗試擷取真正的影片封面。</p>
    {loading?<p className="text-xs">正在檢查本機短片…</p>:<p className="text-xs text-[#465772]">{local?`本機短片：${local.name} · ${(local.blob.size/1048576).toFixed(1)} MB`:'此活動尚無本機短片。請先在上方新增短片。'}</p>}
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy} onClick={()=>setReload(n=>n+1)} className="rounded-full bg-white px-3 py-2 text-xs ring-1 ring-black/10">重新檢查</button>
      <button type="button" disabled={!local||busy||loading} onClick={()=>void send()} className="rounded-full bg-[#1F3FB0] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">{busy?`上傳中 ${progress}%`:done?'再上傳其他版本':'上傳私人短片至 Drive'}</button>
    </div>
    {busy&&<div className="h-1.5 bg-white overflow-hidden rounded-full"><div className="h-full bg-[#1F3FB0]" style={{width:`${progress}%`}}/></div>}
    {done&&<div role="status" className="text-xs text-green-800 space-y-1"><p className="font-semibold flex items-center gap-1"><CheckCircle2 size={15}/>已上傳並記錄 File ID，請在下方完成登錄。</p><p className="break-all">File ID: {done.id}</p><p>Size: {(Number(done.size)/1048576).toFixed(2)} MB</p></div>}
    {error&&<p role="alert" className="text-xs text-red-700 flex gap-1"><AlertTriangle size={15}/>{error}</p>}
  </section>;
}
