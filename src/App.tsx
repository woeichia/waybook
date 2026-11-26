import { BranchTimeline } from './components/BranchTimeline';
import React, { useEffect, useState } from 'react';
import { WifiOff, Pencil } from 'lucide-react';
import { playUiSound, readSoundEnabled, storeSoundEnabled, type UiSoundKind } from './utils/uiSounds';
import { CloudPanel } from './components/CloudPanel';
import type { RoutePlanResponse } from './utils/routePlanning';
import { GOOGLE_CLIENT_ID, cloudRead, cloudWrite, getGoogleIdToken, loadCloudPhoto, type CloudSnapshot, hasCloudConfiguration } from './utils/driveCloud';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { SAMPLE_TRIP } from './data/sampleTrip';
import type { ItineraryData, ItineraryStop } from './types/itinerary';
import { loadSavedItinerary, saveItineraryToStorage, validateItineraryData } from './utils/itinerary';
import { loadPhotoGalleries, writeGallery } from './utils/photoGallery';
import { MemoryGallery, type MemoryPhoto } from './components/MemoryGallery';
import { readMemories, writeMemories } from './utils/memoryGallery';
import { readPublishedCache, readCachedPhotos, saveCachedPhoto, savePublishedSnapshot } from './utils/cloudCache';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useTripWeather } from './hooks/useTripWeather';
import { PaperGrainOverlay } from './components/PaperGrainOverlay';
import { TripHeader } from './components/TripHeader';
import { DaySelector } from './components/DaySelector';
import { ViewToggle, type ItineraryViewMode } from './components/ViewToggle';
import { StopCard } from './components/StopCard';
import { TransitConnector } from './components/TransitConnector';
import { DayRouteView } from './components/DayRouteView';
import { StopDetailSheet } from './components/StopDetailSheet';
import { ShareImportSheet } from './components/ShareImportSheet';
import { ItineraryEditor } from './components/ItineraryEditor';

const TACTILE_EASE = [0.2, 0.8, 0.2, 1] as const;

export default function App() {
  const [soundEnabled, setSoundEnabled] = useState(readSoundEnabled);
  const toggleSound = () => {
    const next = !soundEnabled;
    storeSoundEnabled(next);
    setSoundEnabled(next);
    if (next) {
      void playUiSound('confirm', true, true);
    }
  };
  // Delegation also covers buttons within modal sheets and dynamically created stops.
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const element = event.target;
      if (!(element instanceof Element)) return;
      const button = element.closest('button, [role="button"]') as HTMLElement | null;
      if (!button || button.hasAttribute('disabled') || button.getAttribute('aria-disabled') === 'true' || button.closest('[data-sound-scope="days"]') || button.closest('[data-sound-control]')) return;
      const label = ((button.getAttribute('aria-label') || '') + ' ' + (button.getAttribute('title') || '')).toLowerCase();
      void playUiSound(/上一張|下一張|photo|照片/.test(label) ? 'slide' : 'tap', soundEnabled);
    };
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [soundEnabled]);
  const [itinerary, setItinerary] = useState<ItineraryData>(() => loadSavedItinerary() ?? SAMPLE_TRIP);
  const [photoGalleries, setPhotoGalleries] = useState<Record<string, string[]>>({});
  const [photoStorageError, setPhotoStorageError] = useState<string | null>(null);
  const [memoryGalleries, setMemoryGalleries] = useState<Record<string, MemoryPhoto[]>>({});
  const [cloudMemoryRefs, setCloudMemoryRefs] = useState<Record<string, {id:string;caption:string}[]>>({});
  const editedMemoryIdsRef = React.useRef(new Set<string>());
  const pendingMemoryKey = 'waybook_v15_pending_memory_ids';
  useEffect(() => { if (!hasCloudConfiguration()) {
    loadPhotoGalleries().then(setPhotoGalleries).catch(() => setPhotoStorageError('瀏覽器照片儲存無法使用，請確認沒有使用私人瀏覽模式。'));
    readMemories().then(setMemoryGalleries).catch(() => {});
  } }, []);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [dayDirection, setDayDirection] = useState(1);
  const [viewMode, setViewMode] = useState<ItineraryViewMode>('timeline');
  const [selectedStop, setSelectedStop] = useState<ItineraryStop | null>(null);
  const selectedSourceRef = React.useRef<{x:number;y:number;width:number;height:number}|null>(null);
  const selectedStopRef = React.useRef<ItineraryStop | null>(null);
  const openPostcard = (stop: ItineraryStop, rect: DOMRect) => {
    if (selectedStopRef.current) return;
    selectedSourceRef.current = { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
    window.history.pushState({waybookNav:true,day:selectedDayIndex,layer:'event'},'',window.location.href);
    selectedStopRef.current = stop;
    setSelectedStop(stop);
  };
  const closePostcard = () => {
    selectedStopRef.current = null;
    setSelectedStop(null);
  };
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const cloudConfigured = hasCloudConfiguration();
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudStatus, setCloudStatus] = useState('');
  const [cloudUpdatedAt, setCloudUpdatedAt] = useState('');
  const [cloudPhotoIds, setCloudPhotoIds] = useState<Record<string, string[]>>({});
  const [cloudPhotoData, setCloudPhotoData] = useState<Record<string, string>>({});
  const [adminToken, setAdminToken] = useState('');
  const isAdmin = !cloudConfigured || !!adminToken;
  const [cloudLoaded, setCloudLoaded] = useState(false);
  // Preserve admin edits while checking for newly published family updates.
  const unpublishedEditsRef = React.useRef(false);
  const latestCloudVersionRef = React.useRef('');
  const photoCacheRef = React.useRef<Record<string, string>>({});
  const lastBackgroundCheckRef = React.useRef(0);
  const cloudRequestRef = React.useRef(false);
  const editedGalleryIdsRef = React.useRef(new Set<string>());

  const isOnline = useOnlineStatus();
  const { weather, isLoading: weatherLoading, error: weatherError } = useTripWeather(itinerary, isOnline, itinerary.days[selectedDayIndex]?.date);

  useEffect(() => {
    saveItineraryToStorage(itinerary);
  }, [itinerary]);

  useEffect(() => {
    if (selectedDayIndex >= itinerary.days.length) {
      setSelectedDayIndex(0);
    }
  }, [itinerary.days.length, selectedDayIndex]);

  useEffect(() => {
    const handleQuota = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  const handleSelectDay = (nextIndex: number) => {
    if (nextIndex === selectedDayIndex) return;
    playUiSound('navigate', soundEnabled);
    setDayDirection(nextIndex > selectedDayIndex ? 1 : -1);
    setSelectedDayIndex(nextIndex);
  };

  const applyCloudPhotos = (galleriesById: Record<string, string[]>, photos: Record<string, string>, memories: Record<string,{id:string;caption:string}[]> = {}) => {
    const galleries: Record<string, string[]> = {};
    for (const [stopId, ids] of Object.entries(galleriesById)) {
      galleries[stopId] = ids.map(id => photos[id]).filter((url): url is string => Boolean(url));
    }
    setCloudPhotoData({ ...photos });
    setPhotoGalleries(galleries);
    const memoryMap: Record<string,MemoryPhoto[]> = {};
    for (const [stopId, refs] of Object.entries(memories)) {
      memoryMap[stopId] = refs.map(ref => ({id:ref.id,src:photos[ref.id] || '',caption:ref.caption || ''}));
    }
    // Keep memory references even while photos download; do not silently discard uncached media.
    setMemoryGalleries(memoryMap);
  };

  const pullCloud = async (background = false) => {
    // Never replace an administrator's unpublished changes with the published copy.
    if (background && (adminToken || unpublishedEditsRef.current || isEditOpen || selectedStopRef.current || document.hidden)) return;
    if (!cloudConfigured || cloudRequestRef.current) return;
    cloudRequestRef.current = true;
    if (!background) { setCloudBusy(true); setCloudStatus('正在檢查雲端行程…'); }
    try {
      const snapshot = await cloudRead<CloudSnapshot | null>({action:'snapshot'});
      if (!snapshot) {
        if (!background) {
          setCloudUpdatedAt(''); setCloudPhotoIds({}); setCloudLoaded(true);
          setCloudStatus('雲端尚無行程，管理員可發佈目前台灣行程。');
        }
        return;
      }
      const memoryRefs = snapshot.memoryGalleries || {};
      const ids = [...new Set([...Object.values(snapshot.galleries || {}).flat(), ...Object.values(memoryRefs).flat().map(item=>item.id)])];
      const sameVersion = Boolean(snapshot.updatedAt && snapshot.updatedAt === latestCloudVersionRef.current);
      const missing = ids.filter(id => !photoCacheRef.current[id]);
      if (sameVersion && missing.length === 0) {
        setCloudLoaded(true);
        if (!background) setCloudStatus('已是最新雲端行程。');
        return;
      }
      const validated = validateItineraryData(snapshot.itinerary);
      if (!validated.ok) throw new Error(validated.error);
      // A warm cache must not be overwritten by an unchanged cloud response.
      if (!sameVersion) {
        setItinerary(validated.data);
        setCloudPhotoIds(snapshot.galleries || {});
        setCloudMemoryRefs(memoryRefs);
        setCloudUpdatedAt(snapshot.updatedAt || '');
        latestCloudVersionRef.current = snapshot.updatedAt || '';
        setCloudLoaded(true);
        // Persist only the published snapshot, never draft administrator edits.
        void savePublishedSnapshot(snapshot).catch(() => {});
      }
      const photoMap = { ...photoCacheRef.current };
      if (missing.length) {
        try { Object.assign(photoMap, await readCachedPhotos(missing)); }
        catch { /* Device storage might be disabled; cloud loading still works. */ }
      }
      photoCacheRef.current = photoMap;
      applyCloudPhotos(snapshot.galleries || {}, photoMap, memoryRefs);
      const uncached = ids.filter(id => !photoMap[id]);
      if (uncached.length && !background) setCloudStatus('正在載入新照片…');
      // Download only missing images. Download a few concurrently, not the whole library on every launch.
      for (let i = 0; i < uncached.length; i += 3) {
        const batch = uncached.slice(i, i + 3);
        await Promise.all(batch.map(async id => {
          try {
            const photo = await loadCloudPhoto(id);
            photoMap[id] = photo;
            void saveCachedPhoto(id, photo).catch(() => {});
          } catch { /* Leave any already cached images untouched. */ }
        }));
        photoCacheRef.current = { ...photoMap };
        applyCloudPhotos(snapshot.galleries || {}, photoMap, memoryRefs);
      }
      if (!background) {
        setCloudStatus(ids.every(id => photoMap[id]) ? '雲端行程及照片已同步。' : '行程已同步，部分照片未能載入。');
      }
    } catch (error) {
      // Silent background failures must not interrupt or erase the last good copy.
      if (!background) setCloudStatus(error instanceof Error ? error.message : '同步失敗');
    } finally {
      cloudRequestRef.current = false;
      if (!background) setCloudBusy(false);
    }
  };

  useEffect(() => {
    if (!cloudConfigured) return;
    let active = true;
    const boot = async () => {
      try {
        const cached = await readPublishedCache();
        if (active && cached) {
          const validated = validateItineraryData(cached.snapshot.itinerary);
          if (validated.ok) {
            setItinerary(validated.data);
            setCloudUpdatedAt(cached.snapshot.updatedAt);
            setCloudPhotoIds(cached.snapshot.galleries);
            setCloudMemoryRefs(cached.snapshot.memoryGalleries || {});
            latestCloudVersionRef.current = cached.snapshot.updatedAt;
            photoCacheRef.current = cached.photos;
            applyCloudPhotos(cached.snapshot.galleries, cached.photos, cached.snapshot.memoryGalleries || {});
            setCloudLoaded(true);
            setCloudStatus('已顯示手機儲存的行程，背景檢查更新。');
          }
        }
      } catch { /* IndexedDB can be disabled; continue with normal cloud fetch. */ }
      if (active) {
        lastBackgroundCheckRef.current = Date.now();
        // First launch still checks the cloud, silently if a stored copy exists.
        // Keep this request in the foreground when no local copy exists.
        void pullCloudRef.current(Boolean(latestCloudVersionRef.current));
      }
    };
    void boot();
    return () => { active = false; };
  }, []);

  // Opening the PWA, returning from another app, and returning online fetch
  // the latest published version automatically. The visible Reload button
  // remains a manual fallback. No need to reinstall or redeploy after edits.
  const pullCloudRef = React.useRef(pullCloud);
  pullCloudRef.current = pullCloud;
  useEffect(() => {
    if (!cloudConfigured || !!adminToken || isEditOpen || !isOnline) return;
    const check = () => {
      if (document.hidden || unpublishedEditsRef.current || selectedStopRef.current) return;
      const now = Date.now();
      if (now - lastBackgroundCheckRef.current < 15000) return;
      lastBackgroundCheckRef.current = now;
      void pullCloudRef.current(true);
    };
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    window.addEventListener('focus', check);
    window.addEventListener('pageshow', check);
    window.addEventListener('online', check);
    document.addEventListener('visibilitychange', onVisible);
    const interval = window.setInterval(check, 120000);
    return () => {
      window.removeEventListener('focus', check);
      window.removeEventListener('pageshow', check);
      window.removeEventListener('online', check);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(interval);
    };
  }, [cloudConfigured, adminToken, isEditOpen, isOnline]);

  const loginAdmin = async () => {
    try {
      const token = await getGoogleIdToken(GOOGLE_CLIENT_ID);
      // The Apps Script server verifies this token and checks the admin email for every write.
      setAdminToken(token); setCloudStatus('已取得 Google 登入憑證，發佈時將由伺服器驗證管理員權限。');
      // Restore only unpublished memory edits saved locally, not stale published images.
      try {
        const ids: string[] = JSON.parse(localStorage.getItem(pendingMemoryKey) || '[]');
        if (Array.isArray(ids) && ids.length) {
          const drafts = await readMemories();
          ids.forEach(id => editedMemoryIdsRef.current.add(id));
          setMemoryGalleries(current => {
            const next = {...current};
            ids.forEach(id=>{if(drafts[id]) next[id] = drafts[id];else if(!next[id]) next[id]=[];});
            return next;
          });
          unpublishedEditsRef.current = true;
          setCloudStatus('已登入；偵測到未發佈的本機回憶照片修改，請檢查後再發佈。');
        }
      } catch { /* Existing published copy is unaffected if local drafts cannot be loaded. */ }
    } catch (error) { setCloudStatus(error instanceof Error ? error.message : '登入失敗'); }
  };

  const publishCloud = async () => {
    if (!cloudConfigured || !adminToken || cloudBusy || !cloudLoaded) return;
    if (!window.confirm('發佈後家人的手機將看到這份行程和相片。確定發佈？')) return;
    setCloudBusy(true);
    try {
      const activeStopIds = new Set(itinerary.days.flatMap(day => day.stops.map(stop => stop.id)));
      const remote: Record<string,string[]> = {};
      // Retain existing cloud refs unless the admin explicitly edited this gallery.
      // A partially cached photo list must NEVER delete Drive references on publish.
      for (const [stopId, refs] of Object.entries(cloudPhotoIds)) {
        if (activeStopIds.has(stopId) && !editedGalleryIdsRef.current.has(stopId)) remote[stopId] = [...refs];
      }
      for (const [stopId, photos] of Object.entries(photoGalleries)) {
        if (!activeStopIds.has(stopId) || (!editedGalleryIdsRef.current.has(stopId) && cloudPhotoIds[stopId])) continue;
        if (!photos.length) {delete remote[stopId]; continue;}
        remote[stopId] = [];
        for (const dataUrl of photos) {
          // Reuse unchanged cloud files; don't duplicate every photo on each publish.
          let photoId = (cloudPhotoIds[stopId] || []).find(id => cloudPhotoData[id] === dataUrl);
          // A copied event may reuse an image already uploaded under another stop.
          if (!photoId) photoId = Object.keys(cloudPhotoData).find(id => cloudPhotoData[id] === dataUrl);
          if (!photoId) {
            if (!dataUrl.startsWith('data:image/')) throw new Error('相片需要重新上傳，請使用上傳照片功能。');
            setCloudStatus(`正在上傳 ${stopId} 的照片…`);
            const result = await cloudWrite<{fileId:string}>('uploadPhoto', {dataUrl}, adminToken);
            photoId = result.fileId;
          }
          remote[stopId].push(photoId);
        }
      }
      // Memory photo references are independent from reference/planning galleries.
      // Preserve unchanged remote IDs, including photos not yet loaded on this phone.
      const memoryRemote: Record<string,{id:string;caption:string}[]> = {};
      for (const [stopId, refs] of Object.entries(cloudMemoryRefs)) {
        if (activeStopIds.has(stopId) && !editedMemoryIdsRef.current.has(stopId)) memoryRemote[stopId] = [...refs];
      }
      for (const stopId of editedMemoryIdsRef.current) {
        if (!activeStopIds.has(stopId)) continue;
        memoryRemote[stopId] = [];
        for (const photo of (memoryGalleries[stopId] || [])) {
          let fileId = photo.id && photo.id.length >= 10 && photo.id.length <= 120 ? photo.id : '';
          if (!fileId && photo.src) fileId = Object.keys(cloudPhotoData).find(id => cloudPhotoData[id] === photo.src) || '';
          if (!fileId) {
            if (!photo.src.startsWith('data:image/')) throw new Error('回憶照片尚未準備好，請重新選擇照片。');
            setCloudStatus(`正在上傳 ${stopId} 的回憶照片…`);
            const uploaded = await cloudWrite<{fileId:string}>('uploadPhoto', {dataUrl:photo.src}, adminToken);
            fileId = uploaded.fileId;
          }
          memoryRemote[stopId].push({id:fileId,caption:photo.caption.slice(0,240)});
        }
      }
      setCloudStatus('正在發佈行程及回憶…');
      const result = await cloudWrite<{updatedAt:string}>('publish', {itinerary, galleries:remote, memoryGalleries:memoryRemote, expectedUpdatedAt:cloudUpdatedAt}, adminToken);
      setCloudUpdatedAt(result.updatedAt); setCloudPhotoIds(remote); setCloudMemoryRefs(memoryRemote);
      latestCloudVersionRef.current = result.updatedAt;
      unpublishedEditsRef.current = false;
      editedGalleryIdsRef.current.clear();
      editedMemoryIdsRef.current.clear();
      try { localStorage.removeItem(pendingMemoryKey); } catch { /* Private mode */ }
      const nextData = {...cloudPhotoData};
      for (const [stopId, ids] of Object.entries(remote)) ids.forEach((id, i) => {
        const photo = photoGalleries[stopId]?.[i];
        if (photo) nextData[id] = photo;
      });
      for (const [stopId, refs] of Object.entries(memoryRemote)) {
        refs.forEach((ref, index) => {
          const photo = memoryGalleries[stopId]?.[index];
          if (photo?.src) nextData[ref.id] = photo.src;
        });
      }
      photoCacheRef.current = nextData;
      setCloudPhotoData(nextData);
      // Save newly published state for the administrator's own next launch too.
      void savePublishedSnapshot({version:1, updatedAt:result.updatedAt, itinerary, galleries:remote, memoryGalleries:memoryRemote}).catch(() => {});
      for (const [id, photo] of Object.entries(nextData)) void saveCachedPhoto(id, photo).catch(() => {});
      setCloudStatus('發佈成功！家人開啟 App 後會自動更新。');
    } catch (error) { setCloudStatus(error instanceof Error ? error.message : '發佈失敗'); }
    finally { setCloudBusy(false); }
  };

  const handleSaveMemories = async (stopId: string, items: MemoryPhoto[]) => {
    if (!isAdmin) throw new Error('只有管理員可以修改回憶');
    if (items.length > 12) throw new Error('每個活動最多 12 張回憶照片');
    // Save locally first so a failed upload cannot lose a draft.
    await writeMemories(stopId, items);
    editedMemoryIdsRef.current.add(stopId);
    try {localStorage.setItem(pendingMemoryKey, JSON.stringify([...editedMemoryIdsRef.current]));} catch { /* IndexedDB still retains media */ }
    unpublishedEditsRef.current = true;
    setMemoryGalleries(current => ({...current,[stopId]:items}));
  };

  const handleCopyEventPhotos = (sourceId: string, newId: string) => {
    const originals = photoGalleries[sourceId] || [];
    const refs = cloudPhotoIds[sourceId] || [];
    const memoryItems = memoryGalleries[sourceId] || [];
    const memoryRefs = cloudMemoryRefs[sourceId] || [];
    if (!originals.length && !refs.length && !memoryItems.length && !memoryRefs.length) return;
    // Copies share existing media file IDs without re-uploading. Even if the phone
    // has only partially downloaded a gallery, the cloud references remain intact.
    if (refs.length) setCloudPhotoIds(current => ({...current,[newId]:[...refs]}));
    else editedGalleryIdsRef.current.add(newId);
    if (originals.length) setPhotoGalleries(current => ({ ...current, [newId]: [...originals] }));
    if (memoryRefs.length) setCloudMemoryRefs(current=>({...current,[newId]:memoryRefs.map(v=>({...v}))}));
    if (memoryItems.length) {
      setMemoryGalleries(current=>({...current,[newId]:memoryItems.map(v=>({...v}))}));
      void writeMemories(newId,memoryItems).catch(()=>{});
    }
    unpublishedEditsRef.current = true;
  };
  const handleSaveGallery = async (stopId: string, photos: string[]) => {
    if (!isAdmin) throw new Error('只有管理員可以修改照片');
    unpublishedEditsRef.current = true;
    editedGalleryIdsRef.current.add(stopId);
    await writeGallery(stopId, photos);
    setPhotoGalleries(current => ({ ...current, [stopId]: photos }));
  };

  const handleApplyItinerary = (nextData: ItineraryData, backupGalleryRefs?: Record<string,string[]>, backupMemoryRefs?: Record<string,{id:string;caption:string}[]>) => {
    if (!isAdmin) { setCloudStatus('請先以管理員身分登入後再匯入行程。'); return; }
    unpublishedEditsRef.current = true;
    if (backupGalleryRefs) {
      // Restore references for events with no current media; never replace working
      // local photos or mappings supplied by the currently published snapshot.
      const additions: Record<string,string[]> = {};
      for (const [id, refs] of Object.entries(backupGalleryRefs)) {
        if (!cloudPhotoIds[id]?.length && refs.length) additions[id] = refs;
      }
      if (Object.keys(additions).length) {
        setCloudPhotoIds(current => ({...current, ...additions}));
        void (async () => {
          const additionalPhotos: Record<string,string> = {};
          for (const id of [...new Set(Object.values(additions).flat())]) {
            if (photoCacheRef.current[id]) continue;
            try {additionalPhotos[id] = await loadCloudPhoto(id); }
            catch { /* Keep original photos if references cannot be restored. */ }
          }
          const nextPhotos = {...photoCacheRef.current, ...additionalPhotos};
          photoCacheRef.current = nextPhotos;
          setCloudPhotoData(nextPhotos);
          setPhotoGalleries(current => {
            const merged = {...current};
            for (const [stopId, refs] of Object.entries(additions)) {
              if (!merged[stopId]?.length) merged[stopId] = refs.map(id => nextPhotos[id]).filter(Boolean);
            }
            return merged;
          });
        })();
      }
    }
    if (backupMemoryRefs) {
      const additions:Record<string,{id:string;caption:string}[]> = {};
      for (const [id,refs] of Object.entries(backupMemoryRefs)) {
        if (!cloudMemoryRefs[id]?.length && refs.length) additions[id] = refs;
      }
      if (Object.keys(additions).length) {
        setCloudMemoryRefs(current=>({...current,...additions}));
        // References are kept even if binary photo downloads are not yet available.
        setMemoryGalleries(current=>{
          const merged={...current};
          for(const [id,refs] of Object.entries(additions)) if(!merged[id]?.length) merged[id] = refs.map(r=>({id:r.id,src:photoCacheRef.current[r.id]||'',caption:r.caption}));
          return merged;
        });
      }
    }
    setItinerary(nextData);
    setDayDirection(1);
    setSelectedDayIndex(0);
    setViewMode('timeline');
    if (window.location.hash.startsWith('#trip=')) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  };

  // Motion trial: horizontal day swipe uses the same day selection and history as a day tab.
  const motionSwipeRef = React.useRef<{x:number;y:number}|null>(null);
  const motionSuppressClickUntil = React.useRef(0);
  const motionDaySwipe = (deltaX: number, deltaY: number) => {
    if (Math.abs(deltaX) < 85 || Math.abs(deltaX) < Math.abs(deltaY)*1.6) return;
    if (selectedStopRef.current || isEditOpen || isShareOpen) return;
    motionSuppressClickUntil.current=Date.now()+500;
    const next = selectedDayIndex + (deltaX < 0 ? 1 : -1);
    if (next < 0 || next >= itinerary.days.length) return;
    // DaySelector normally pushes this history on day-tab clicks; swipes must do the same.
    window.history.pushState({waybookNav:true,day:next,layer:'day'},'',window.location.href);
    handleSelectDay(next);
  };
  const activeDay = itinerary.days[selectedDayIndex] ?? itinerary.days[0];

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-[#EDEBE6] sm:py-6 sm:px-4">
        <PaperGrainOverlay />

        {photoStorageError && <div className="p-3 bg-amber-100 text-amber-900 text-xs text-center">{photoStorageError}</div>}
        {quotaExceeded && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
            <span>
              Google Maps Platform quota reached. If you are the app owner, visit{' '}
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold text-amber-950 hover:text-amber-800"
              >
                maps developer site
              </a>{' '}
              for instructions to update your account.
            </span>
          </div>
        )}

        <div className="mx-auto w-full max-w-[480px] min-h-screen sm:min-h-[calc(100vh-3rem)] bg-[#EDEBE6] sm:rounded-[36px] sm:shadow-[0_14px_48px_rgba(26,26,26,0.09)] sm:ring-1 sm:ring-black/[0.07] flex flex-col">
          {!isOnline && (
            <div className="mx-4 mt-4 rounded-2xl bg-[#1F3FB0] px-3.5 py-2.5 text-xs font-medium text-white flex items-center gap-2">
              <WifiOff className="w-3.5 h-3.5 text-white/85 shrink-0" />
              <span>離線模式 — 目前顯示已儲存的行程資料。</span>
            </div>
          )}

          <main className="flex-1 px-4 pt-4 pb-10">
            <TripHeader
              trip={itinerary.trip}
              totalDays={itinerary.days.length}
              selectedDayDate={activeDay?.date}
              weather={weather}
              weatherLoading={weatherLoading}
              weatherError={weatherError}
              isOnline={isOnline}
              soundEnabled={soundEnabled}
              onToggleSound={toggleSound}
              onOpenShareImport={() => setIsShareOpen(true)}
            />

            <CloudPanel connected={cloudConfigured} isAdmin={!!adminToken} status={cloudStatus} updatedAt={cloudUpdatedAt} busy={cloudBusy} onLogin={loginAdmin} onLoad={pullCloud} onPublish={publishCloud} />
            <div data-sound-scope="days">
            <DaySelector
              days={itinerary.days}
              selectedDayIndex={selectedDayIndex}
              direction={dayDirection}
              onSelectDay={handleSelectDay}
            />
            </div>

            {isAdmin && <div className="flex justify-end mt-2 mb-2">
              <button type="button" onClick={() => setIsEditOpen(v => !v)} className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold text-[#1F3FB0] bg-[#F4F2ED] ring-1 ring-black/10">
                <Pencil className="w-3.5 h-3.5" /> {isEditOpen ? '關閉編輯' : '編輯行程'}
              </button>
            </div>}
            {isAdmin && isEditOpen && <ItineraryEditor data={itinerary} dayIndex={selectedDayIndex} onChange={data => { unpublishedEditsRef.current = true; setItinerary(data); }} onCopyEventPhotos={handleCopyEventPhotos} onEstimateRoutes={async stops => { if (!adminToken) throw new Error('請先以管理員身分登入'); return cloudWrite<RoutePlanResponse>('routePlan', {stops}, adminToken); }}
               photoEventIds={[...new Set([...Object.keys(cloudPhotoIds).filter(id => cloudPhotoIds[id]?.length), ...Object.keys(photoGalleries).filter(id => photoGalleries[id]?.length), ...Object.keys(cloudMemoryRefs).filter(id=>cloudMemoryRefs[id]?.length), ...Object.keys(memoryGalleries).filter(id=>memoryGalleries[id]?.length)])]}
               onPhoto={async (id, photo) => { try { await handleSaveGallery(id, [photo, ...(photoGalleries[id] ?? []).slice(1)]); return true; } catch { return false; } }} onClose={() => setIsEditOpen(false)} />}
            <ViewToggle mode={viewMode} onChange={setViewMode} />

            <div className="mt-5" style={{perspective:'1100px',touchAction:'pan-y pinch-zoom'}}
              onClickCapture={e=>{if(Date.now()<motionSuppressClickUntil.current){e.preventDefault();e.stopPropagation();}}}
              onTouchStartCapture={e=>{
                motionSuppressClickUntil.current=0;
                const el=e.target as HTMLElement;
                // Card buttons and cover images participate in day swipes; native controls and viewers do not.
                if(e.touches.length!==1 || e.touches[0].clientX<35 || el.closest('a,input,textarea,select,video,[contenteditable="true"],[role="slider"],[data-waybook-video-viewer],[data-waybook-event-viewer],[data-waybook-memory-photo-viewer],[role="dialog"],.overflow-x-auto')) {motionSwipeRef.current=null;return;}
                motionSwipeRef.current={x:e.touches[0].clientX,y:e.touches[0].clientY};
              }}
              onTouchEndCapture={e=>{
                const start=motionSwipeRef.current;motionSwipeRef.current=null;
                if(!start||e.changedTouches.length!==1)return;
                motionDaySwipe(e.changedTouches[0].clientX-start.x,e.changedTouches[0].clientY-start.y);
              }}
              onTouchCancelCapture={()=>{motionSwipeRef.current=null;}}>
              <AnimatePresence mode="wait" initial={false}>
                {activeDay && viewMode === 'timeline' && (
                  <motion.div
                    key={`timeline-${selectedDayIndex}-${activeDay.dayNumber}`}
                    initial={{ opacity: 0, x: dayDirection * 30, rotateY: dayDirection * -26, scale: 0.97 }}
                    animate={{ opacity: 1, x: 0, rotateY: 0, scale: 1 }}
                    exit={{ opacity: 0, x: dayDirection * -26, rotateY: dayDirection * 24, scale: 0.97 }}
                    transition={{ duration: 0.33, ease: TACTILE_EASE }}
                  >
                    {activeDay.stops.length === 0 ? (
                      <div className="rounded-3xl bg-[#F4F2ED] p-8 text-center shadow-sm ring-1 ring-black/[0.06]">
                        <p className="text-sm font-medium text-[#1A1A1A]">本日尚無行程站點</p>
                        <p className="mt-1 text-xs text-[#5E5A52]">
                          點擊上方 Share / Import 可生成或匯入行程。
                        </p>
                      </div>
                    ) : (
                      <BranchTimeline day={activeDay} photos={photoGalleries} onSelect={openPostcard} onChoose={isAdmin?(ids,id)=>{unpublishedEditsRef.current=true;setItinerary(current=>({...current,days:current.days.map((day,i)=>i===selectedDayIndex?{...day,optionalGroups:day.optionalGroups?.map(g=>g.eventIds[0]===ids[0]?{...g,selectedEventId:id}:g)}:day)}));}:undefined}/>
                    )}
                  </motion.div>
                )}

                {activeDay && viewMode === 'route' && (
                  <motion.div
                    key={`route-${selectedDayIndex}-${activeDay.dayNumber}`}
                    initial={{ opacity: 0, x: dayDirection * 30, rotateY: dayDirection * -26, scale: 0.97 }}
                    animate={{ opacity: 1, x: 0, rotateY: 0, scale: 1 }}
                    exit={{ opacity: 0, x: dayDirection * -26, rotateY: dayDirection * 24, scale: 0.97 }}
                    transition={{ duration: 0.33, ease: TACTILE_EASE }}
                  >
                    {activeDay.optionalGroups?.length ? <BranchTimeline day={activeDay} route/> : <DayRouteView day={activeDay} />}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </main>
        </div>

        <StopDetailSheet
          stop={selectedStop}
          gallery={selectedStop ? (photoGalleries[selectedStop.id] ?? []) : []}
          memoryPhotos={selectedStop ? (memoryGalleries[selectedStop.id] ?? []) : []}
          onSaveMemories={handleSaveMemories}
          onSaveGallery={handleSaveGallery}
          onGalleryTick={() => {
            void playUiSound('slide', soundEnabled);
          }}
          onMemorySound={(kind: UiSoundKind) => { void playUiSound(kind, soundEnabled); }}
          readOnly={!isAdmin}
          sourceRect={selectedSourceRef.current}
          onClose={closePostcard}
        />


        <ShareImportSheet
          isOpen={isShareOpen}
          currentTrip={itinerary}
          onClose={() => setIsShareOpen(false)}
          onApplyItinerary={handleApplyItinerary}
          cloudGalleryReferences={cloudPhotoIds}
          cloudMemoryReferences={cloudMemoryRefs}
          galleryEventIds={Object.keys(photoGalleries).filter(id => photoGalleries[id]?.length)}
          readOnly={!isAdmin}
        />
      </div>
    </MotionConfig>
  );
}
