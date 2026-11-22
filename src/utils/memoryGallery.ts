import type { MemoryPhoto } from '../components/MemoryGallery';

const DB = 'waybook_memories_v15';
const STORE = 'memories';
function connect(): Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{
    const request = indexedDB.open(DB,1);
    request.onupgradeneeded = ()=>{if(!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);};
    request.onsuccess = ()=>resolve(request.result);
    request.onerror = ()=>reject(request.error ?? new Error('無法使用本機回憶照片儲存空間'));
  });
}
export async function readMemories(): Promise<Record<string,MemoryPhoto[]>> {
  const db = await connect();
  try {return await new Promise((resolve,reject)=>{
    const tx = db.transaction(STORE,'readonly');
    const keys = tx.objectStore(STORE).getAllKeys();
    const values = tx.objectStore(STORE).getAll();
    tx.oncomplete = ()=>{ const output:Record<string,MemoryPhoto[]> = {};
      keys.result.forEach((key,i)=>{if(Array.isArray(values.result[i])) output[String(key)] = values.result[i];});
      resolve(output);
    };
    tx.onerror = ()=>reject(tx.error);
  });} finally {db.close();}
}
export async function writeMemories(stopId:string, photos:MemoryPhoto[]): Promise<void> {
  const db = await connect();
  try {await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(STORE,'readwrite');
    if (photos.length) tx.objectStore(STORE).put(photos,stopId);
    else tx.objectStore(STORE).delete(stopId);
    tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error);
  });} finally{db.close();}
}
