/** Waybook shared itinerary backend — paste into a Google Apps Script project.
 * Script Properties: FOLDER_ID, GOOGLE_CLIENT_ID, ADMIN_EMAIL.
 * Deploy > Web app: Execute as Me, Who has access: Anyone.
 * Anyone can READ public itinerary/photos. WRITES require a Google ID token
 * whose audience matches GOOGLE_CLIENT_ID and whose verified email matches ADMIN_EMAIL.
 */
const ITINERARY_FILE = 'waybook_snapshot.json';
const MAX_IMAGE_BYTES = 650000; // compressed photo limit

function cfg_(key) { return PropertiesService.getScriptProperties().getProperty(key) || ''; }
function root_() { const id = cfg_('FOLDER_ID'); if (!id) throw Error('FOLDER_ID is missing'); return DriveApp.getFolderById(id); }
function findFile_(name) { const iter = root_().getFilesByName(name); return iter.hasNext() ? iter.next() : null; }
function json_(val) { return JSON.stringify(val).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029'); }
function idValid_(id) { return /^[a-zA-Z0-9_-]{10,120}$/.test(String(id || '')); }
function getSnapshot_() {
  const file = findFile_(ITINERARY_FILE);
  return file ? JSON.parse(file.getBlob().getDataAsString('UTF-8')) : null;
}
function doGet(e) {
  const cb = String((e.parameter || {}).callback || '');
  // The public read API requires a callback; no admin credentials in GET requests.
  if (!/^__waybook_[A-Za-z0-9_]+$/.test(cb)) return ContentService.createTextOutput('Invalid callback');
  let response;
  try {
    const action = e.parameter.action || 'snapshot';
    if (action === 'snapshot') response = {ok:true,data:getSnapshot_()};
    else if (action === 'photo') {
      const id = e.parameter.fileId;
      if (!idValid_(id)) throw Error('Invalid photo id');
      const snapshot = getSnapshot_();
      const approved = snapshot && Object.values(snapshot.galleries || {}).some(list => Array.isArray(list) && list.indexOf(id) >= 0);
      if (!approved) throw Error('Photo not in published itinerary');
      const file = DriveApp.getFileById(id);
      if (!file.getParents().hasNext()) throw Error('Invalid photo');
      const blob = file.getBlob();
      if (!/^image\/(jpeg|png|webp)$/.test(blob.getContentType()) || blob.getBytes().length > MAX_IMAGE_BYTES) throw Error('Photo too large');
      response = {ok:true,data:{dataUrl:'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes())}};
    } else throw Error('Unknown action');
  } catch(err) { response = {ok:false,error:String(err.message || err)}; }
  return ContentService.createTextOutput(cb + '(' + json_(response) + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
}
function checkAdmin_(token) {
  if (!token || !cfg_('GOOGLE_CLIENT_ID') || !cfg_('ADMIN_EMAIL')) throw Error('Backend authentication not configured');
  const url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token);
  const res = UrlFetchApp.fetch(url,{muteHttpExceptions:true});
  if (res.getResponseCode() !== 200) throw Error('Google sign-in expired or invalid');
  const claims = JSON.parse(res.getContentText());
  if (claims.aud !== cfg_('GOOGLE_CLIENT_ID') || claims.email_verified !== 'true' || String(claims.email).toLowerCase() !== cfg_('ADMIN_EMAIL').toLowerCase()) throw Error('Account is not an authorized administrator');
  if (+claims.exp * 1000 < Date.now()) throw Error('Google sign-in expired');
}
function imageUpload_(d) {
  if (!d || typeof d.dataUrl !== 'string') throw Error('Photo missing');
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(d.dataUrl);
  if (!match) throw Error('Only jpeg/png/webp photos are supported');
  const bytes = Utilities.base64Decode(match[2]);
  if (bytes.length > MAX_IMAGE_BYTES) throw Error('Image exceeds 650KB; compress and retry');
  const file = root_().createFile(Utilities.newBlob(bytes,match[1],'waybook_' + Utilities.getUuid() + (match[1] === 'image/png' ? '.png' : '.jpg')));
  return {fileId:file.getId()};
}
function publish_(data) {
  if (!data || !data.itinerary || !data.itinerary.trip || !Array.isArray(data.itinerary.days) || !data.galleries || typeof data.galleries !== 'object') throw Error('Invalid itinerary payload');
  const galleries = data.galleries;
  if (Object.keys(galleries).length > 300) throw Error('Too many galleries');
  for (const photos of Object.values(galleries)) {
    if (!Array.isArray(photos) || photos.length > 8 || photos.some(id=>!idValid_(id))) throw Error('Invalid gallery references');
    for (const id of photos) {
      const file = DriveApp.getFileById(id);
      const parents = file.getParents(); let belongs = false;
      while(parents.hasNext()) { if(parents.next().getId() === root_().getId()) belongs = true; }
      if (!belongs) throw Error('Photo file outside Waybook folder');
    }
  }
  const existing = findFile_(ITINERARY_FILE);
  const current = existing ? JSON.parse(existing.getBlob().getDataAsString('UTF-8')) : null;
  const expected = String(data.expectedUpdatedAt || '');
  if (current && expected !== String(current.updatedAt || '')) throw Error('The cloud itinerary was updated elsewhere. Reload before publishing.');
  if (!current && expected) throw Error('The cloud itinerary no longer matches. Reload first.');
  const snapshot = {version:1,updatedAt:new Date().toISOString(),itinerary:data.itinerary,galleries:galleries};
  const text = JSON.stringify(snapshot);
  if (text.length > 1500000) throw Error('Itinerary JSON too large');
  const root = root_();
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const latest = findFile_(ITINERARY_FILE);
    if ((latest ? JSON.parse(latest.getBlob().getDataAsString('UTF-8')).updatedAt : '') !== expected) throw Error('Conflict: another publish completed. Reload first.');
    if (latest) {
      root.createFile('backup_' + Date.now() + '.json',latest.getBlob());
      latest.setContent(text);
    } else root.createFile(ITINERARY_FILE,text,MimeType.PLAIN_TEXT);
  } finally { lock.releaseLock(); }
  return {updatedAt:snapshot.updatedAt};
}
function doPost(e) {
  let requestId = '';
  let answer;
  try {
    const payload = JSON.parse((e.parameter || {}).payload || '{}');
    requestId = String(payload.requestId || '').slice(0,100);
    checkAdmin_(payload.idToken);
    if (payload.action === 'uploadPhoto') answer = {ok:true,data:imageUpload_(payload.data)};
    else if (payload.action === 'publish') answer = {ok:true,data:publish_(payload.data)};
    else throw Error('Unsupported write action');
  } catch(err) {answer={ok:false,error:String(err.message || err)};}
  // HTML iframe postMessage permits browser writes without CORS bypass or credentials in URLs.
  const message = {type:'WAYBOOK_WRITE_RESULT',requestId:requestId,ok:answer.ok,data:answer.data,error:answer.error};
  const html = '<!doctype html><html><body><script>parent.postMessage(' + json_(message) + ',"*");</script></body></html>';
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
