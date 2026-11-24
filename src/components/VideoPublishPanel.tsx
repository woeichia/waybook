import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, CloudUpload, Loader2 } from 'lucide-react';
import { compressVideoWhenNeeded } from '../utils/compressVideo';
import { authorizeDriveVideoUpload, uploadPrivateVideoTest, warmupDriveOAuth } from '../utils/driveVideoPilot';
import { cloudRead, cloudWrite, getGoogleIdToken, GOOGLE_CLIENT_ID } from '../utils/driveCloud';
import { createVideoPoster, readPendingVideo, savePendingVideo, clearPendingVideo, type PendingVideo } from '../utils/videoUploadReceipt';

const MAX_BYTES = 25 * 1024 * 1024;
type VideoIndex = { videos: Record<string, {id:string;posterId?:string}> };
function durationOf(file: File): Promise<number> {
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file);const video=document.createElement('video');let done=false;
    const finish=(value?:number,error?:Error)=>{if(done)return;done=true;clearTimeout(timer);video.removeAttribute('src');video.load();URL.revokeObjectURL(url);error?reject(error):resolve(value!);};
    const timer=window.setTimeout(()=>finish(undefined,new Error('無法讀取影片長度')),12000);
    video.preload='metadata';video.onloadedmetadata=()=>Number.isFinite(video.duration)&&video.duration>0?finish(video.duration):finish(undefined,new Error('無法確認影片長度'));
    video.onerror=()=>finish(undefined,new Error('不支援這個影片格式'));video.src=url;
  });
}
async function publishConfirmed(stopId:string, fileId:string) {
  try { const index=await cloudRead<VideoIndex>({action:'videos'},20000);return index?.videos?.[stopId]?.id===fileId; }
  catch{return false;}
}

/** One visible admin action. Drive upload, optional poster and publish are resumable by a local receipt. */
export function VideoPublishPanel({stopId}:{stopId:string}) {
  const fileRef=useRef<HTMLInputElement>(null);
  const [selected,setSelected]=useState<File|null>(null);
  const [pending,setPending]=useState<PendingVideo|null>(()=>readPendingVideo(stopId));
  const [busy,setBusy]=useState(false);
  const [step,setStep]=useState('');
  const [progress,setProgress]=useState(0);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  useEffect(()=>{setPending(readPendingVideo(stopId));setSelected(null);setStep('');setProgress(0);setError('');setSuccess('');},[stopId]);
  useEffect(()=>{void warmupDriveOAuth().catch(()=>{});},[]);
  const store=(receipt:PendingVideo)=>{savePendingVideo(stopId,receipt);setPending(receipt);};
  const run=async()=>{
    if(busy||(!selected&&!pending))return;
    if(selected&&pending&&!window.confirm('這個活動已有尚未完成發布的影片。確定改用新影片？先前的 Drive 檔案不會自動刪除。'))return;
    setBusy(true);setError('');setSuccess('');setProgress(0);
    let receipt=selected?null:readPendingVideo(stopId);
    let driveToken='';
    try{
      if(selected){
        setStep('準備影片，超過 25 MB 時嘗試在本機壓縮…');
        const duration=await durationOf(selected);
        const output=await compressVideoWhenNeeded(selected,duration,MAX_BYTES,setProgress);
        const clip=output.blob;
        const name=output.wasCompressed ? `${selected.name.replace(/\.[^.]+$/,'')}-720p.${output.extension}` : selected.name;
        setStep('正在上傳影片至 Google Drive…');setProgress(0);
        driveToken=await authorizeDriveVideoUpload();
        const uploaded=await uploadPrivateVideoTest(clip,name,driveToken,setProgress);
        // Persist the verified ID before any optional thumbnail or registration work.
        receipt={fileId:uploaded.id,name:uploaded.name,size:Number(uploaded.size)};
        store(receipt);
        setSelected(null); // Next click resumes from the saved Drive ID instead of uploading a duplicate.
        try {
          setStep('正在製作影片封面…');
          const frame=await createVideoPoster(clip);
          receipt={...receipt,...frame};store(receipt);
        }catch{/* Video may still publish without a thumbnail. */}
      }
      if(!receipt) throw Error('找不到待發布影片，請先選取影片。');
      // Existing pending Drive video can be resumed after a refresh without uploading twice.
      if(!receipt.posterId&&receipt.poster){
        try{
          setStep('正在儲存影片封面…');
          if(!driveToken) driveToken=await authorizeDriveVideoUpload();
          const posterBlob=await (await fetch(receipt.poster)).blob();
          if(posterBlob.type!=='image/jpeg'||posterBlob.size>650000) throw Error('Thumbnail too large');
          const result=await uploadPrivateVideoTest(posterBlob,'waybook_video_poster.jpg',driveToken,()=>{});
          receipt={...receipt,posterId:result.id};store(receipt);
        }catch{/* Poster is optional, video is not lost. */}
      }
      setStep('正在關聯影片與行程…');
      // Before retrying after an uncertain receipt, check the published index.
      let confirmed=await publishConfirmed(stopId,receipt.fileId);
      if(!confirmed){
        try{
          const token=await getGoogleIdToken(GOOGLE_CLIENT_ID);
          await cloudWrite('registerVideo',{stopId,fileId:receipt.fileId,
            ...(receipt.posterId?{posterId:receipt.posterId}:{}),
            ...(receipt.width&&receipt.height?{width:receipt.width,height:receipt.height}:{})},token);
        }catch(e){
          confirmed=await publishConfirmed(stopId,receipt.fileId);
          if(!confirmed) throw e;
        }
      }
      if(!(await publishConfirmed(stopId,receipt.fileId))) throw Error('已上傳，但行程尚未確認發布。請稍後按「繼續發布」，不必再次上傳影片。');
      clearPendingVideo(stopId,receipt.fileId);setPending(null);setSelected(null);if(fileRef.current)fileRef.current.value='';
      setSuccess('已上傳並發布到此活動。家人可在下方點擊影片預覽。');setStep('');
      window.dispatchEvent(new CustomEvent('waybook:videoPublished',{detail:{stopId}}));
    }catch(e){
      setError((e instanceof Error?e.message:'發布失敗')+'。已成功上傳的影片會保留；請勿重複上傳。');
    }finally{setBusy(false);setProgress(0);}
  };
  return <section className="mt-4 rounded-2xl bg-[#EDF3FB] p-3 ring-1 ring-[#1F3FB0]/15 space-y-3" aria-label="上傳及發布回憶短片">
    <h4 className="text-sm font-semibold text-[#203A7C] flex items-center gap-2"><CloudUpload size={17}/>上傳及發布回憶短片</h4>
    <p className="text-xs text-[#465772]">選擇一支影片，按一次上傳及發布。最多 25 MB；超過時在支援的裝置自動壓縮。Drive File ID、封面及活動登錄由 Waybook 處理。</p>
    <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={e=>{setSelected(e.target.files?.[0]||null);setError('');setSuccess('');}} />
    <button type="button" onClick={()=>fileRef.current?.click()} disabled={busy} className="w-full min-h-11 rounded-xl bg-white ring-1 ring-black/10 px-3 text-sm text-[#1F3FB0] disabled:opacity-50">{selected?`已選：${selected.name}`:'選擇影片'}</button>
    {!selected&&pending&&<p className="text-xs text-[#465772]">偵測到先前已上傳但未完成發布的影片；可直接繼續，不必重新上傳。</p>}
    <button type="button" onClick={()=>void run()} disabled={busy||(!selected&&!pending)} className="w-full min-h-12 rounded-xl bg-[#1F3FB0] text-white text-sm font-semibold flex justify-center items-center gap-2 disabled:opacity-50">{busy?<Loader2 className="animate-spin" size={18}/>:<CloudUpload size={18}/>}{busy?'處理中…':!selected&&pending?'繼續發布':'上傳並發布'}</button>
    {busy&&<div role="status" className="space-y-1"><p className="text-xs text-[#465772]">{step}</p>{progress>0&&<div className="h-1.5 bg-white rounded-full overflow-hidden"><div className="h-full bg-[#1F3FB0]" style={{width:`${progress}%`}}/></div>}</div>}
    {success&&<p role="status" className="text-xs text-green-800 flex gap-1"><CheckCircle2 size={15}/>{success}</p>}
    {error&&<p role="alert" className="text-xs text-red-700">{error}</p>}
  </section>;
}
