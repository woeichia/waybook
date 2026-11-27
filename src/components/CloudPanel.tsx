import React, { useState } from 'react';
import { PushSettings } from './PushSettings';
import { Cloud, CloudUpload, Download, LockKeyhole, LogIn, RefreshCw } from 'lucide-react';

interface Props {
  adminToken: string; expiresAt:number; onLogout:()=>void; connected: boolean; isAdmin: boolean; status: string; updatedAt: string;
  busy: boolean; onLogin: () => void; onLoad: () => void; onPublish: (notifyFamily: boolean) => void;
}
export function CloudPanel({adminToken,expiresAt,onLogout,connected,isAdmin,status,updatedAt,busy,onLogin,onLoad,onPublish}: Props) {
  const [showFeedback,setShowFeedback]=useState(false);
  const [notifyFamily,setNotifyFamily]=useState(true);
  if(connected&&!isAdmin)return <div className="mt-2 mb-3">
    <div className="flex items-center justify-end gap-2">
      <PushSettings adminToken={adminToken}/>
      <button type="button" disabled={busy} onClick={()=>{setShowFeedback(true);onLoad();}} aria-label="重新載入" className="min-h-[44px] inline-flex items-center gap-1.5 rounded-full bg-[#F4F2ED] px-3 text-xs text-[#5E5A52] ring-1 ring-black/10 disabled:opacity-50"><RefreshCw className={`w-3.5 h-3.5 ${busy?'animate-spin':''}`}/>重新載入</button>
      <button type="button" disabled={busy} onClick={()=>{setShowFeedback(true);onLogin();}} aria-label="管理員登入" className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full bg-[#F4F2ED] text-[#5E5A52] ring-1 ring-black/10 disabled:opacity-50"><LogIn className="w-4 h-4"/></button>
    </div>
    {showFeedback&&status&&<p role="status" className="mt-1 text-right text-[11px] text-[#5E5A52] break-words">{status}</p>}
  </div>;
  return <section className="rounded-2xl bg-[#F4F2ED] ring-1 ring-black/10 p-3.5 mb-3 text-[#26241F]">
    <div className="flex items-center gap-2 text-sm font-bold mb-2"><Cloud className="w-4 h-4"/> Google Drive 同步 {connected ? '· 已設定' : '· 尚未設定'}</div>
    {connected ? <>
      <p className="text-xs text-[#5E5A52] mb-2">{status || '訪客只可查看已發佈的行程。'}</p>
      {isAdmin && <p className="text-[11px] text-[#5E5A52] mb-2">管理員登入有效至：{new Date(expiresAt).toLocaleString('zh-TW')}</p>}
      {updatedAt && <p className="text-[11px] text-[#5E5A52] mb-2">上次發佈：{new Date(updatedAt).toLocaleString('zh-TW')}</p>}
      {isAdmin && <label className="flex items-center gap-2 text-xs mb-2"><input type="checkbox" checked={notifyFamily} onChange={e=>setNotifyFamily(e.target.checked)} disabled={busy}/>同步成功後通知家庭成員</label>}
      <div className="flex gap-2 flex-wrap items-center">
        <PushSettings adminToken={adminToken}/>
        {isAdmin&&<button type="button" disabled={busy} onClick={onLogout} className="bg-white rounded-full px-3 py-2 text-xs ring-1 ring-black/10">管理員登出</button>}
        <button disabled={busy} onClick={()=>onLoad()} className="bg-white rounded-full px-3 py-2 text-xs ring-1 ring-black/10 flex items-center gap-1"><RefreshCw className="w-3 h-3"/>重新載入</button>
        {!isAdmin ? <button disabled={busy} onClick={onLogin} className="bg-[#1F3FB0] text-white rounded-full px-3 py-2 text-xs flex items-center gap-1"><LogIn className="w-3 h-3"/>管理員登入</button> : <button disabled={busy} onClick={()=>onPublish(notifyFamily)} className="bg-[#1F3FB0] text-white rounded-full px-3 py-2 text-xs flex items-center gap-1"><CloudUpload className="w-3 h-3"/>發佈行程及照片</button>}
      </div>
      {!isAdmin && <p className="text-[11px] mt-2 text-[#5E5A52] flex gap-1 items-center"><LockKeyhole className="w-3 h-3"/>未登入時不能修改已發佈資料</p>}
    </> : <p className="text-xs text-[#5E5A52]">離線測試模式：相片及行程仍儲存在本機。請參閱 GOOGLE_DRIVE_SETUP_v6.md 啟用共用資料。</p>}
  </section>
}
