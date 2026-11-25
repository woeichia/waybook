/** Remove only the matching private Waybook video blob from this device. */
export function removeCachedWaybookVideo(fileId:string):Promise<void>{
  if(!/^[A-Za-z0-9_-]{10,120}$/.test(fileId))return Promise.reject(Error('Invalid file ID'));
  if(!('indexedDB' in window))return Promise.resolve();
  return new Promise<void>((resolve,reject)=>{
    const request=indexedDB.open('waybook_private_video_cache_v1',1);
    request.onupgradeneeded=()=>{
      if(!request.result.objectStoreNames.contains('videos'))request.result.createObjectStore('videos');
    };
    request.onerror=()=>reject(request.error||Error('Video cache unavailable'));
    request.onsuccess=()=>{
      const db=request.result;
      try{
        const tx=db.transaction('videos','readwrite');
        tx.objectStore('videos').delete(fileId);
        tx.oncomplete=()=>{db.close();resolve();};
        tx.onerror=()=>{db.close();reject(tx.error||Error('Cannot clear video cache'));};
      }catch(err){db.close();reject(err);}
    };
  });
}
