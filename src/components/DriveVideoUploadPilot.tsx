import React, { useEffect, useState } from 'react';
import { CloudUpload, CheckCircle2, AlertTriangle } from 'lucide-react';
import { authorizeDriveVideoUpload, readLocalVideoPilot, uploadPrivateVideoTest, warmupDriveOAuth, type DriveVideoResult } from '../utils/driveVideoPilot';

/** Admin-only, disconnected from published snapshots and public/family reads. */
export function DriveVideoUploadPilot({ stopId }: { stopId: string }) {
  const [local, setLocal] = useState<{ blob: Blob; name: string; duration: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [done, setDone] = useState<DriveVideoResult | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => { void warmupDriveOAuth().catch(() => {}); }, []);
  useEffect(() => {
    let active = true;
    setLoading(true); setDone(null); setError('');
    readLocalVideoPilot(stopId).then(c => { if (active) setLocal(c); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : '讀取失敗'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [stopId, reload]);
  const send = async () => {
    if (!local || busy) return;
    if (!window.confirm('確認將此短片上傳至您選擇的 Google Drive 帳戶？檔案預設為私人，不會發布給家人。')) return;
    setBusy(true); setError(''); setProgress(0); setDone(null);
    try {
      const token = await authorizeDriveVideoUpload();
      const result = await uploadPrivateVideoTest(local.blob, local.name, token, setProgress);
      setDone(result);
      window.dispatchEvent(new CustomEvent('waybook:driveVideoUploaded', {detail:{stopId,fileId:result.id}}));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google Drive 上傳失敗');
    } finally { setBusy(false); }
  };
  return <section className="mt-3 rounded-2xl bg-[#EDF3FB] p-3 ring-1 ring-[#1F3FB0]/15 space-y-2" aria-label="Google Drive 私人影片上傳測試">
    <div className="flex items-center gap-2 text-[#203A7C] text-sm font-semibold"><CloudUpload size={17}/>v15.3A · Google Drive 私人上傳測試</div>
    <p className="text-xs leading-relaxed text-[#4A5568]">使用目前裝置的短片，授權您選擇的 Google 帳戶後直接上傳。<strong>不會變更任何照片、發布行程或自動分享影片。</strong>測試檔保留在您自己的 Drive 根目錄，名稱以 Waybook_TEST_ 開頭。</p>
    {loading ? <p className="text-xs">正在檢查本機短片…</p> : <p className="text-xs text-[#465772]">{local ? `已找到：${local.name} · ${(local.blob.size / 1048576).toFixed(1)} MB` : '本活動尚無本機短片。請先在上方新增短片，然後按「重新檢查」。'}</p>}
    <div className="flex gap-2 flex-wrap">
      <button type="button" onClick={() => setReload(n => n + 1)} disabled={busy} className="rounded-full bg-white px-3 py-2 text-xs text-[#203A7C] ring-1 ring-black/10 disabled:opacity-40">重新檢查</button>
      <button type="button" onClick={() => void send()} disabled={!local || busy || loading || !!done} className="rounded-full bg-[#1F3FB0] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">{busy ? `上傳中 ${progress}%` : done ? '已驗證' : '上傳測試影片至 Drive'}</button>
    </div>
    {busy && <div className="h-1.5 w-full overflow-hidden rounded-full bg-white"><div className="h-full bg-[#1F3FB0]" style={{width:`${progress}%`}}/></div>}
    {done && <div role="status" className="text-xs text-green-800 space-y-1"><p className="flex gap-1 items-center font-semibold"><CheckCircle2 size={15}/>Google Drive 已確認上傳成功，檔案大小一致</p><p className="break-all">File ID: {done.id}</p><p>Size: {(done.size / 1048576).toFixed(2)} MB</p>{done.webViewLink && <a href={done.webViewLink} target="_blank" rel="noopener noreferrer" className="underline">在 Google Drive 中檢視私人測試檔</a>}</div>}
    {error && <p role="alert" className="text-xs text-red-700 flex gap-1 items-start"><AlertTriangle size={15} className="shrink-0"/>{error}</p>}
  </section>;
}
