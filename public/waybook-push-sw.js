/* Imported by Workbox's generated service worker. No separate SW scope. */
const wbUpdateId=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)?value:'';
self.addEventListener('message',event=>{
  if(event.data?.type==='WAYBOOK_PUSH_PING')event.ports?.[0]?.postMessage({type:'WAYBOOK_PUSH_READY'});
});
self.addEventListener('push',event=>{
  let kind='content',updateId='',changeType='';
  try{const p=event.data?.json();if(['app','content','video','test'].includes(p?.kind))kind=p.kind;if(['content','video'].includes(kind)){updateId=wbUpdateId(p?.updateId);changeType=p?.changeType;}}catch(_){}
  const generic={app:'App 有新版本，點擊查看。',content:'旅遊行程及回憶已更新，點擊查看。',video:'有新的旅遊影片，快來看看吧！',test:'測試通知，點擊開啟旅程。'};
  const types={added:'新增了旅遊行程，快來看看吧！',event:'旅遊行程已更新，點擊查看。',route:'交通資訊已更新，點擊查看。',cover:'行程照片已更新，點擊查看。',memory:'新增了旅遊照片，重溫美好回憶！',video:'有新的旅遊影片，快來看看吧！',memoryRemoved:'旅遊回憶已更新，點擊查看。',deleted:'旅遊行程已更新，點擊查看。',day:'旅遊行程已更新，點擊查看。',multiple:'多項旅程內容已更新，點擊查看。'};
  const body=updateId&&Object.prototype.hasOwnProperty.call(types,changeType)?types[changeType]:generic[kind];
  event.waitUntil(self.registration.showNotification('台灣2026',{body,icon:new URL('pwa-192x192.png',self.registration.scope).href,tag:updateId?'waybook-update-'+updateId:'waybook-'+kind,data:{kind,updateId},renotify:kind==='test'}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const scope=self.registration.scope,updateId=wbUpdateId(event.notification.data?.updateId),kind=event.notification.data?.kind;
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const existing=windows.find(c=>c.url.startsWith(scope));
    if(existing){await existing.focus();existing.postMessage({type:'WAYBOOK_PUSH_OPEN',kind,updateId});return;}
    const target=new URL(scope);if(updateId)target.searchParams.set('wbUpdate',updateId);
    await self.clients.openWindow(target.href);
  })());
});
