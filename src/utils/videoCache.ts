/** Persist complete authenticated video bytes for replay. IndexedDB may be evicted by browser. */
const DB='waybook_private_video_cache_v1', STORE='videos';
export type CachedVideo = {fileId:string;size:number;mimeType:string;blob:Blob;savedAt:number};
function openDB():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    if(!('indexedDB' in window))return reject(new Error('此裝置不支援影片快取'));
    const request=indexedDB.open(DB,1);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE);};
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error('影片快取資料庫不可用'));
  });
}
export async function getCachedVideo(fileId:string,size:number):Promise<CachedVideo|null>{
  const db=await openDB();
  try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,'readonly');const req=tx.objectStore(STORE).get(fileId);
    tx.oncomplete=()=>{
      const x=req.result as CachedVideo|undefined;
      resolve(x?.fileId===fileId && x.size===size && x.blob instanceof Blob && x.blob.size===size?x:null);
    };
    tx.onerror=()=>reject(tx.error||new Error('讀取影片快取失敗'));
  });}finally{db.close();}
}
export async function putCachedVideo(item:CachedVideo):Promise<boolean>{
  try{
    const db=await openDB();
    try {await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(item,item.fileId);
      tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('儲存影片快取失敗'));
    });return true;}finally{db.close();}
  }catch{return false;}
}
