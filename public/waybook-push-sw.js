/* Imported by Workbox's existing generated service worker. No separate SW scope. */
self.addEventListener('message', event => {
  if(event.data?.type==='WAYBOOK_PUSH_PING')event.ports?.[0]?.postMessage({type:'WAYBOOK_PUSH_READY'});
});
self.addEventListener('push', event => {
  let kind='content';
  try { const payload=event.data?.json(); if(['app','content','video','test'].includes(payload?.kind))kind=payload.kind; } catch (_) {}
  const notices={
    app:['Waybook 有新版本','開啟 App 查看最新版本。'],
    content:['旅程資料已更新','開啟 Waybook 查看最新行程及回憶。'],
    video:['旅遊回憶已更新','開啟 Waybook 查看最新回憶。'],
    test:['Waybook 測試通知','此裝置已成功收到推播通知。']
  };
  const [title,body]=notices[kind];
  event.waitUntil(self.registration.showNotification(title,{
    body,icon:new URL('pwa-192x192.png',self.registration.scope).href,
    tag:'waybook-'+kind,data:{kind},renotify:kind==='test'
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const scope=self.registration.scope;
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const existing=windows.find(client=>client.url.startsWith(scope));
    if(existing){await existing.focus();existing.postMessage({type:'WAYBOOK_PUSH_OPEN'});return;}
    await self.clients.openWindow(scope);
  })());
});
