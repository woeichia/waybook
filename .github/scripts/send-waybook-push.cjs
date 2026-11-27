'use strict';
// No endpoints, credentials, notification content or response bodies in CI logs.
const allowedKinds = new Set(['app','content','video','test']);
function validEndpoint(value) {
  if(typeof value!=='string'||value.length>2048||/[\s#\\]/.test(value))return false;
  try {
    const u=new URL(value);
    return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&!u.hash&&
      /^(?:fcm\.googleapis\.com|(?:[a-z0-9-]+\.)+push\.apple\.com|updates\.push\.services\.mozilla\.com|(?:[a-z0-9-]+\.)+notify\.windows\.com)$/i.test(u.hostname);
  } catch{return false;}
}
function validSub(s) {
  return s&&validEndpoint(s.endpoint)&&s.keys&&/^[A-Za-z0-9_-]{87}$/.test(s.keys.p256dh||'')&&/^[A-Za-z0-9_-]{22}$/.test(s.keys.auth||'')&&Buffer.from(s.keys.p256dh,'base64url')[0]===4;
}
async function bridge(env,op,extra={}) {
  const url=new URL(env.WAYBOOK_APPS_SCRIPT_URL);
  if(url.protocol!=='https:'||url.hostname!=='script.google.com'||url.port||url.username||url.password||url.search||url.hash||!/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname))throw Error('Invalid Apps Script deployment URL');
  let r=await fetch(url,{method:'POST',body:new URLSearchParams({payload:JSON.stringify({action:'pushBridge',data:{secret:env.WAYBOOK_PUSH_BRIDGE_SECRET,op,...extra}})}),redirect:'manual',signal:AbortSignal.timeout(30000)});
  // ContentService returns a one-time googleusercontent URL. Never forward secrets
  // across redirects; follow only the expected redirect with a fresh GET.
  if([301,302,303].includes(r.status)){
    const target=new URL(r.headers.get('location')||'',url);
    if(target.protocol!=='https:'||target.hostname!=='script.googleusercontent.com'||target.port||target.username||target.password)throw Error('Unexpected bridge redirect');
    r=await fetch(target,{method:'GET',redirect:'error',signal:AbortSignal.timeout(30000)});
  }
  if(!r.ok)throw Error('Push bridge HTTP '+r.status);
  let value;try{value=await r.json();}catch{throw Error('Push bridge did not return JSON; redeploy the updated Apps Script');}
  if(!value?.ok)throw Error('Push bridge authentication or configuration rejected');
  return value;
}
async function main(env=process.env) {
  const kind=env.WAYBOOK_PUSH_KIND;
  if(!allowedKinds.has(kind))throw Error('Invalid notification type');
  const required=['WAYBOOK_APPS_SCRIPT_URL','WAYBOOK_PUSH_BRIDGE_SECRET','VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','VAPID_SUBJECT'];
  const missing=required.filter(k=>!env[k]);
  if(missing.length){
    // A first deployment can succeed before notification setup is complete.
    if(kind==='app'){console.log('Push skipped: configuration incomplete ('+missing.join(', ')+')');return;}
    throw Error('Missing configuration: '+missing.join(', '));
  }
  if(!/^[a-f0-9]{64}$/i.test(env.WAYBOOK_PUSH_BRIDGE_SECRET))throw Error('Invalid bridge secret format');
  const webPush=require('../push-deps/node_modules/web-push');
  try{webPush.setVapidDetails(env.VAPID_SUBJECT,env.VAPID_PUBLIC_KEY,env.VAPID_PRIVATE_KEY);}catch{throw Error('Invalid VAPID configuration');}
  const list=await bridge(env,'list');
  if(!Array.isArray(list.devices)||list.devices.length>40)throw Error('Invalid device list');
  const dead=[];let accepted=0,failed=0;
  async function send(device){
    if(!device||!/^[0-9a-f-]{36}$/i.test(device.id||'')||!validSub(device.subscription)){failed++;return;}
    try{
      await webPush.sendNotification(device.subscription,JSON.stringify({kind}),{TTL:kind==='test'?300:3600,urgency:kind==='test'?'high':'normal',topic:'waybook-'+kind,timeout:10000});
      accepted++;
    }catch(e){
      if(e.statusCode===404||e.statusCode===410)dead.push({id:device.id,endpoint:device.subscription.endpoint});
      else {failed++;console.warn('Push provider rejected a request (HTTP '+(Number(e.statusCode)||'network error')+')');}
    }
  }
  for(let i=0;i<list.devices.length;i+=4)await Promise.all(list.devices.slice(i,i+4).map(send));
  if(dead.length)await bridge(env,'prune',{devices:dead});
  console.log(`Registered: ${list.devices.length}; accepted by provider: ${accepted}; expired removed: ${dead.length}; failed: ${failed}. Provider acceptance is not a delivery receipt.`);
  if(failed)process.exitCode=1;
}
module.exports={validEndpoint,validSub,bridge,main};
if(require.main===module)main().catch(e=>{console.error('Waybook push sender failed: '+(e instanceof Error?e.message:'unknown failure'));process.exitCode=1;});
