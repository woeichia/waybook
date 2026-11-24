import { familyRead } from './familyAccess';
/** Authenticated private Drive download. No family Google login and no OAuth token in browser. */
const CHUNK=256*1024, LIMIT=25*1024*1024;
type Chunk={base64:string;start:number;end:number;total:number;mimeType:string};
function decode(b64:string):Uint8Array{
  const raw=atob(b64), bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  return bytes;
}
export async function downloadForCache(stopId:string,expectedSize:number,onProgress:(p:number)=>void, signal:AbortSignal):Promise<Blob>{
  if(!Number.isSafeInteger(expectedSize)||expectedSize<1||expectedSize>LIMIT)throw Error('影片必須在 25 MB 以內');
  if(!/^[a-zA-Z0-9_-]{1,110}$/.test(stopId))throw Error('活動識別碼無效');
  const count=Math.ceil(expectedSize/CHUNK);
  const parts=new Array<Uint8Array>(count);
  let next=0, completed=0, mime='';
  async function worker(){
    while(true){
      if(signal.aborted)throw Error('下載已取消');
      const index=next++;
      if(index>=count)return;
      const start=index*CHUNK, end=Math.min(start+CHUNK,expectedSize)-1;
      // Retry transient failures twice; never cache partial or corrupt files.
      let result:Chunk|undefined;
      for(let attempt=0;attempt<3;attempt++){
        try {result=await familyRead<Chunk>({action:'videoChunk',stopId,start:String(start)},45000);break;}
        catch(err){if(signal.aborted)throw Error('下載已取消');if(attempt===2)throw err;}
      }
      if(!result||result.start!==start||result.end!==end||result.total!==expectedSize)throw Error('影片區段資料不一致');
      if(!/^video\/(mp4|webm|quicktime)$/i.test(result.mimeType))throw Error('不支援的影片格式');
      if(mime && mime!==result.mimeType)throw Error('影片格式不一致');
      mime=result.mimeType;
      const bytes=decode(result.base64);
      if(bytes.length!==end-start+1)throw Error('影片區段不完整');
      parts[index]=bytes;
      completed++;
      if(!signal.aborted)onProgress(Math.round(completed/count*100));
    }
  }
  // Two requests in parallel, rather than ~100 sequential requests for a 25 MB clip.
  await Promise.all([worker(),worker()]);
  if(signal.aborted)throw Error('下載已取消');
  const blob=new Blob(parts as BlobPart[],{type:mime});
  if(blob.size!==expectedSize)throw Error('影片大小校驗失敗');
  return blob;
}
