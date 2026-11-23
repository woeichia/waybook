import React, {useEffect, useState} from 'react';
import { LockKeyhole, Eye, EyeOff, LogOut } from 'lucide-react';
import { clearFamilySession, familyCheck, familyLogin, readFamilySession, saveFamilySession } from '../utils/familyAccess';

type GateProps = { children: React.ReactNode };
export function FamilyGate({children}: GateProps) {
  const [ready,setReady] = useState(false);
  const [unlocked,setUnlocked] = useState(false);
  const [code,setCode] = useState('');
  const [show,setShow] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  useEffect(()=>{
    let live=true;
    const session=readFamilySession();
    if (!session) { setReady(true); return; }
    familyCheck(session.token).then(result=>{
      if (!live) return;
      if (result.valid && result.expiresAt > Date.now()) setUnlocked(true);
      else clearFamilySession();
    }).catch(()=>{
      // No credentials are accepted solely from local storage. Fail closed when offline.
      if (live) setError('暫時無法驗證家庭登入，請確認網路連線。');
    }).finally(()=>{if(live)setReady(true);});
    return ()=>{live=false;};
  },[]);
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();
    if (busy || !code.trim()) return;
    setBusy(true);setError('');
    try{
      const session=await familyLogin(code);
      if(!session.token || session.expiresAt<=Date.now())throw new Error('登入回應無效');
      saveFamilySession(session);
      setCode('');setUnlocked(true);
    } catch(e) {setError(e instanceof Error?e.message:'驗證失敗');}
    finally{setBusy(false);}
  };
  const lock=()=>{clearFamilySession();setUnlocked(false);setCode('');};
  if (!ready) return <div className="min-h-dvh flex items-center justify-center bg-[#EDEBE6] text-[#4F4A40]">正在驗證家庭登入…</div>;
  if (unlocked) return <><div className="fixed bottom-4 right-4 z-[40]"><button type="button" onClick={lock} className="rounded-full bg-[#1A1A1A] px-3 py-2 text-xs text-white shadow-lg flex items-center gap-1" aria-label="鎖定 Waybook"><LogOut size={14}/>鎖定</button></div>{children}</>;
  return <main className="min-h-dvh flex items-center justify-center bg-[#EDEBE6] px-5 py-12">
    <form onSubmit={submit} className="w-full max-w-sm rounded-3xl bg-[#F4F2ED] px-6 py-8 shadow-xl ring-1 ring-black/10 space-y-5">
      <div className="flex flex-col items-center gap-2"><LockKeyhole size={30} className="text-[#1F3FB0]"/><h1 className="text-2xl font-semibold text-[#1A1A1A]">台湾2026</h1><p className="text-sm text-[#5E5A52]">家庭專屬行程 · 請輸入家庭通行密碼</p></div>
      <div className="flex items-center gap-2 rounded-xl bg-white ring-1 ring-black/10 px-3"><input className="w-full min-w-0 py-3 outline-none bg-transparent text-sm" autoComplete="off" type={show?'text':'password'} value={code} onChange={e=>setCode(e.target.value)} placeholder="家庭通行密碼" required minLength={12} maxLength={128} aria-label="家庭通行密碼"/><button type="button" className="p-2 text-[#5E5A52]" onClick={()=>setShow(v=>!v)} aria-label={show?'隱藏密碼':'顯示密碼'}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      <button type="submit" disabled={busy||code.length<12} className="w-full min-h-11 rounded-xl bg-[#1F3FB0] text-white font-semibold disabled:opacity-40">{busy?'正在驗證…':'進入行程'}</button>
      <p className="text-xs leading-relaxed text-[#686259]">登入只在目前瀏覽器工作階段有效；過期或選擇「鎖定」後需重新輸入。不要將密碼貼到公開群組。</p>
    </form>
  </main>;
}
