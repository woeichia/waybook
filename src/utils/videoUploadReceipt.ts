/** Non-secret upload receipt. Never store OAuth access tokens or family passwords here. */
const PREFIX = 'waybook_pending_drive_video_v153d3_';
const validDriveId = /^[A-Za-z0-9_-]{10,120}$/;
export type PendingVideo = {fileId:string; name:string; size:number; poster?:string; width?:number; height?:number};
export function readPendingVideo(stopId:string):PendingVideo|null {
  try {
    const v=JSON.parse(localStorage.getItem(PREFIX+stopId)||'null') as PendingVideo|null;
    return v && validDriveId.test(v.fileId) ? v : null;
  } catch {return null;}
}
export function savePendingVideo(stopId:string, data:PendingVideo):void {
  try { localStorage.setItem(PREFIX+stopId,JSON.stringify(data)); }
  catch { // In storage-restricted browsers the upload result still remains visible this session.
    try {localStorage.setItem(PREFIX+stopId,JSON.stringify({...data,poster:undefined}));} catch {}
  }
}
export function clearPendingVideo(stopId:string, fileId?:string):void {
  try { const v=readPendingVideo(stopId); if(!fileId || v?.fileId===fileId) localStorage.removeItem(PREFIX+stopId); } catch {}
}
/** Capture a video frame locally, for PRIVATE thumbnail publishing through the existing admin photo API. */
export function createVideoPoster(blob:Blob):Promise<{poster:string;width:number;height:number}> {
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(blob); const video=document.createElement('video');
    video.muted=true; video.playsInline=true;video.preload='auto';
    let finished=false;
    const timeout=window.setTimeout(()=>finish(undefined,new Error('Video preview timed out')),10000);
    const finish=(value?:{poster:string;width:number;height:number},error?:Error)=>{
      if(finished)return;finished=true;clearTimeout(timeout);
      video.pause();video.removeAttribute('src');video.load(); URL.revokeObjectURL(url);
      if(error)reject(error);else resolve(value!);
    };
    const capture=()=>{
      try {
        const width=video.videoWidth,height=video.videoHeight;
        if(!width||!height)throw new Error('No video dimensions');
        const scale=Math.min(1,640/Math.max(width,height));
        const canvas=document.createElement('canvas');canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);
        const context=canvas.getContext('2d');if(!context)throw new Error('Canvas unavailable');
        context.drawImage(video,0,0,canvas.width,canvas.height);
        const poster=canvas.toDataURL('image/jpeg',0.72);
        if(poster.length>700000)throw new Error('Video poster too large');
        finish({poster,width,height});
      } catch(e){finish(undefined,e instanceof Error?e:new Error('Cannot generate poster'));}
    };
    video.onloadedmetadata=()=>{
      const duration=video.duration;
      if(Number.isFinite(duration)&&duration>0.3){
        const frame=Math.min(1, duration*0.25);
        try{video.currentTime=frame;}catch{capture();}
      } else capture();
    };
    video.onseeked=capture;
    video.onloadeddata=()=>{if(!Number.isFinite(video.duration)||video.duration<=0.3)capture();};
    video.onerror=()=>finish(undefined,new Error('Unable to read video preview'));
    video.src=url; video.load();
  });
}
