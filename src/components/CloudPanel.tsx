import React from 'react';
import { Cloud, CloudUpload, Download, LockKeyhole, LogIn, RefreshCw } from 'lucide-react';

interface Props {
  connected: boolean; isAdmin: boolean; status: string; updatedAt: string;
  busy: boolean; onLogin: () => void; onLoad: () => void; onPublish: () => void;
}
export function CloudPanel({connected,isAdmin,status,updatedAt,busy,onLogin,onLoad,onPublish}: Props) {
  return <section className="rounded-2xl bg-[#F4F2ED] ring-1 ring-black/10 p-3.5 mb-3 text-[#26241F]">
    <div className="flex items-center gap-2 text-sm font-bold mb-2"><Cloud className="w-4 h-4"/> Google Drive 同步 {connected ? '· 已設定' : '· 尚未設定'}</div>
    {connected ? <>
      <p className="text-xs text-[#5E5A52] mb-2">{status || '訪客只可查看已發佈的行程。'}</p>
      {updatedAt && <p className="text-[11px] text-[#5E5A52] mb-2">上次發佈：{new Date(updatedAt).toLocaleString('zh-TW')}</p>}
      <div className="flex gap-2 flex-wrap">
        <button disabled={busy} onClick={onLoad} className="bg-white rounded-full px-3 py-2 text-xs ring-1 ring-black/10 flex items-center gap-1"><RefreshCw className="w-3 h-3"/>重新載入</button>
        {!isAdmin ? <button disabled={busy} onClick={onLogin} className="bg-[#1F3FB0] text-white rounded-full px-3 py-2 text-xs flex items-center gap-1"><LogIn className="w-3 h-3"/>管理員登入</button> : <button disabled={busy} onClick={onPublish} className="bg-[#1F3FB0] text-white rounded-full px-3 py-2 text-xs flex items-center gap-1"><CloudUpload className="w-3 h-3"/>發佈行程及照片</button>}
      </div>
      {!isAdmin && <p className="text-[11px] mt-2 text-[#5E5A52] flex gap-1 items-center"><LockKeyhole className="w-3 h-3"/>未登入時不能修改已發佈資料</p>}
    </> : <p className="text-xs text-[#5E5A52]">離線測試模式：相片及行程仍儲存在本機。請參閱 GOOGLE_DRIVE_SETUP_v6.md 啟用共用資料。</p>}
  </section>
}
