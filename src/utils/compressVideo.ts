/**
 * Device-local optional video compression. No network service, no ffmpeg download.
 * Uses CanvasCaptureMediaStreamTrack + Web Audio + MediaRecorder where supported.
 * Never silently discards audio when transcoding.
 */
export type CompressedVideo = { blob: Blob; extension: string; wasCompressed: boolean };

const TARGET_LONG_SIDE = 720;
const TARGET_VIDEO_BITRATE = 1_450_000;
const TARGET_AUDIO_BITRATE = 96_000;

function supportedType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const mime of [
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm',
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
  ]) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return null;
}

function fitSize(width: number, height: number) {
  if (width <= 0 || height <= 0) throw new Error('無法讀取影片畫面尺寸');
  const scale = Math.min(1, TARGET_LONG_SIDE / Math.max(width, height));
  return {
    width: Math.max(2, Math.round(width * scale / 2) * 2),
    height: Math.max(2, Math.round(height * scale / 2) * 2),
  };
}

/**
 * Re-encode only when the original exceeds the permitted size.
 * Compression can take approximately the duration of the video on supported browsers.
 * On unsupported browsers, rejects with an actionable message.
 */
export async function compressVideoWhenNeeded(
  file: File,
  duration: number,
  maxBytes: number,
  onProgress: (percent: number) => void = () => {},
): Promise<CompressedVideo> {
  if (file.size <= maxBytes) {
    onProgress(100);
    return {blob:file, extension:file.name.split('.').pop()?.toLowerCase() || 'mp4', wasCompressed:false};
  }
  const mime = supportedType();
  if (!mime) throw new Error('這個瀏覽器不支援影片壓縮。請先用手機相簿匯出較小的 720p 影片再上傳。');
  if (typeof HTMLCanvasElement.prototype.captureStream !== 'function') {
    throw new Error('這台手機不支援直接壓縮影片。請先用手機相簿匯出 720p 版本。');
  }
  const AudioCtor = window.AudioContext || (window as typeof window & {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
  if (!AudioCtor) throw new Error('這台手機無法確保壓縮後保留原聲音，請先用手機相簿壓縮。');

  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'auto';
  video.playsInline = true;
  video.crossOrigin = 'anonymous';
  video.src = objectUrl;
  video.muted = false;
  video.volume = 1;
  // Make media decodable on browsers that suspend off-DOM playback.
  video.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
  document.body.appendChild(video);

  let ctx: AudioContext | null = null;
  let recorder: MediaRecorder | null = null;
  let animationId = 0;
  let timeoutId = 0;
  let stream: MediaStream | null = null;
  let progressTimer = 0;
  try {
    await new Promise<void>((resolve,reject)=>{
      if (video.readyState >= 1) {resolve();return;}
      const timer = window.setTimeout(()=>reject(new Error('影片讀取逾時，無法壓縮')),12000);
      video.onloadedmetadata = ()=>{clearTimeout(timer);resolve();};
      video.onerror = ()=>{clearTimeout(timer);reject(new Error('無法讀取影片格式'));};
      video.load();
    });
    const shape = fitSize(video.videoWidth,video.videoHeight);
    const canvas = document.createElement('canvas');
    canvas.width=shape.width;
    canvas.height=shape.height;
    const drawContext = canvas.getContext('2d',{alpha:false});
    if (!drawContext) throw new Error('手機無法建立影片壓縮畫布');
    const canvasStream = canvas.captureStream(24);
    stream = canvasStream;

    // Route the original video's audio into the recorder, NOT to speakers.
    // MediaElementSource retains the audio content when the input has sound.
    ctx = new AudioCtor();
    const source = ctx.createMediaElementSource(video);
    const dest = ctx.createMediaStreamDestination();
    source.connect(dest);
    if (!dest.stream.getAudioTracks().length) throw new Error('無法保留影片聲音，壓縮已取消');
    for(const track of dest.stream.getAudioTracks()) stream.addTrack(track);
    if (ctx.state === 'suspended') await ctx.resume();
    if (ctx.state !== 'running') throw new Error('手機暫停了音訊處理，請先點擊頁面後重試');

    const recorderOptions: MediaRecorderOptions = {
      mimeType:mime,
      videoBitsPerSecond:TARGET_VIDEO_BITRATE,
      audioBitsPerSecond:TARGET_AUDIO_BITRATE,
    };
    recorder=new MediaRecorder(stream,recorderOptions);
    const chunks:Blob[]=[];
    const result = new Promise<Blob>((resolve,reject)=>{
      if (!recorder) return reject(new Error('影片編碼器無法啟動'));
      recorder.ondataavailable=e=>{if(e.data.size) chunks.push(e.data);};
      recorder.onerror=()=>reject(new Error('影片壓縮失敗，請改用手機相簿壓縮'));
      recorder.onstop=()=>{
        const resultBlob = new Blob(chunks,{type:recorder?.mimeType||mime});
        if (resultBlob.size<1024) reject(new Error('壓縮後影片沒有有效內容'));
        else resolve(resultBlob);
      };
    });

    const draw=()=>{
      if (!video.paused && !video.ended && video.readyState >= 2) {
        drawContext.fillStyle='#000';
        drawContext.fillRect(0,0,canvas.width,canvas.height);
        // source aspect ratio is retained; no faces are cropped.
        drawContext.drawImage(video,0,0,canvas.width,canvas.height);
      }
      if (!video.ended) animationId=requestAnimationFrame(draw);
    };
    const finish=()=>{
      if (recorder?.state==='recording') recorder.stop();
    };
    video.addEventListener('ended',finish,{once:true});
    recorder.start(250);
    try {await video.play();}
    catch { throw new Error('手機禁止自動處理影片。請再次點擊上傳，或在相簿中先壓縮影片。'); }
    draw();
    progressTimer=window.setInterval(()=>onProgress(Math.min(99,Math.round(video.currentTime/Math.max(1,duration)*100))),400);
    timeoutId=window.setTimeout(finish,Math.ceil((duration+8)*1000));
    const compressed=await result;
    if (compressed.size>maxBytes) throw new Error('已嘗試壓縮，但仍超過 25 MB。請先用手機相簿降低影片畫質。');
    onProgress(100);
    return {blob:compressed,extension:compressed.type.includes('mp4')?'mp4':'webm',wasCompressed:true};
  } finally {
    if (progressTimer) clearInterval(progressTimer);
    if (timeoutId) clearTimeout(timeoutId);
    if (animationId) cancelAnimationFrame(animationId);
    video.pause();
    if (recorder?.state==='recording') recorder.stop();
    stream?.getTracks().forEach(track=>track.stop());
    if (ctx) void ctx.close().catch(()=>{});
    video.removeAttribute('src');
    video.load();
    video.remove();
    URL.revokeObjectURL(objectUrl);
  }
}
