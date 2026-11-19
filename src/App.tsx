import React, { useEffect, useState } from 'react';
import { WifiOff, Pencil } from 'lucide-react';
import { playUiSound, readSoundEnabled, storeSoundEnabled } from './utils/uiSounds';
import { CloudPanel } from './components/CloudPanel';
import { GOOGLE_CLIENT_ID, cloudRead, cloudWrite, getGoogleIdToken, loadCloudPhoto, type CloudSnapshot, hasCloudConfiguration } from './utils/driveCloud';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { SAMPLE_TRIP } from './data/sampleTrip';
import type { ItineraryData, ItineraryStop } from './types/itinerary';
import { loadSavedItinerary, saveItineraryToStorage, validateItineraryData } from './utils/itinerary';
import { loadPhotoGalleries, writeGallery } from './utils/photoGallery';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useTripWeather } from './hooks/useTripWeather';
import { PaperGrainOverlay } from './components/PaperGrainOverlay';
import { TripHeader } from './components/TripHeader';
import { DaySelector } from './components/DaySelector';
import { ViewToggle, type ItineraryViewMode } from './components/ViewToggle';
import { StopCard } from './components/StopCard';
import { PostcardPageTurn, type PostcardMotionState } from './components/PostcardPageTurn';
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
  useEffect(() => { if (!hasCloudConfiguration()) loadPhotoGalleries().then(setPhotoGalleries).catch(() => setPhotoStorageError('瀏覽器照片儲存無法使用，請確認沒有使用私人瀏覽模式。')); }, []);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [dayDirection, setDayDirection] = useState(1);
  const [viewMode, setViewMode] = useState<ItineraryViewMode>('timeline');
  const [selectedStop, setSelectedStop] = useState<ItineraryStop | null>(null);
  const [postcardMotion, setPostcardMotion] = useState<PostcardMotionState | null>(null);
  const selectedSourceRef = React.useRef<PostcardMotionState | null>(null);
  const selectedStopRef = React.useRef<ItineraryStop | null>(null);
  const openPostcard = (stop: ItineraryStop, rect: DOMRect) => {
    if (selectedStopRef.current || postcardMotion) return;
    const source = { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
    const context: PostcardMotionState = { stop, source, cover: photoGalleries[stop.id]?.[0], direction: 'open' };
    selectedSourceRef.current = context;
    setPostcardMotion(context);
  };
  const closePostcard = () => {
    if (!selectedStopRef.current || postcardMotion) return;
    const original = selectedSourceRef.current;
    selectedStopRef.current = null;
    setSelectedStop(null);
    if (original && original.stop.id === selectedStop?.id && viewMode === 'timeline') {
      // Re-measure in case the vertical list moved while the detail sheet was open.
      const card = Array.from(document.querySelectorAll<HTMLElement>('[data-waybook-stop-id]'))
        .find(node => node.dataset.waybookStopId === original.stop.id);
      const rect = card?.getBoundingClientRect();
      const source = rect ? { x: rect.left, y: rect.top, width: rect.width, height: rect.height } : original.source;
      setPostcardMotion({ ...original, source, direction: 'close' });
    }
  };
  const finishPostcardMotion = () => {
    if (!postcardMotion) return;
    if (postcardMotion.direction === 'open') {
      selectedStopRef.current = postcardMotion.stop;
      setSelectedStop(postcardMotion.stop);
    }
    setPostcardMotion(null);
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
  const isOnline = useOnlineStatus();
  const { weather, isLoading: weatherLoading, error: weatherError } = useTripWeather(itinerary, isOnline);

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

  const pullCloud = async () => {
    if (!cloudConfigured || cloudBusy) return;
    setCloudBusy(true); setCloudStatus('正在取得雲端行程…');
    try {
      const snapshot = await cloudRead<CloudSnapshot | null>({action:'snapshot'});
      if (!snapshot) {
        setCloudUpdatedAt(''); setCloudPhotoIds({}); setCloudLoaded(true);
        setCloudStatus('雲端尚無行程，管理員可發佈目前台灣行程。');
        return;
      }
      const validated = validateItineraryData(snapshot.itinerary);
      if (!validated.ok) throw new Error(validated.error);
      setItinerary(validated.data);
      setCloudPhotoIds(snapshot.galleries || {});
      setCloudUpdatedAt(snapshot.updatedAt || '');
      setCloudLoaded(true);
      setCloudStatus('已載入雲端行程，正在同步照片…');
      const allIds = Array.from(new Set(Object.values(snapshot.galleries || {}).flat()));
      const photoMap: Record<string,string> = {};
      for (const id of allIds) {
        try { photoMap[id] = await loadCloudPhoto(id); }
        catch { /* Keep remaining pictures viewable even if one fails. */ }
      }
      setCloudPhotoData(photoMap);
      const galleries: Record<string,string[]> = {};
      for (const [stopId, ids] of Object.entries(snapshot.galleries || {})) {
        galleries[stopId] = ids.map(id=>photoMap[id]).filter(Boolean);
      }
      setPhotoGalleries(galleries);
      setCloudStatus(allIds.length === Object.keys(photoMap).length ? '雲端行程及照片已同步。' : '行程已同步，部分照片未能載入。');
    } catch (error) { setCloudStatus(error instanceof Error ? error.message : '同步失敗'); }
    finally { setCloudBusy(false); }
  };

  useEffect(() => { if (cloudConfigured) { void pullCloud(); } }, []);

  const loginAdmin = async () => {
    try {
      const token = await getGoogleIdToken(GOOGLE_CLIENT_ID);
      // The Apps Script server verifies this token and checks the admin email for every write.
      setAdminToken(token); setCloudStatus('已取得 Google 登入憑證，發佈時將由伺服器驗證管理員權限。');
    } catch (error) { setCloudStatus(error instanceof Error ? error.message : '登入失敗'); }
  };

  const publishCloud = async () => {
    if (!cloudConfigured || !adminToken || cloudBusy || !cloudLoaded) return;
    if (!window.confirm('發佈後家人的手機將看到這份行程和相片。確定發佈？')) return;
    setCloudBusy(true);
    try {
      const remote: Record<string,string[]> = {};
      for (const [stopId, photos] of Object.entries(photoGalleries)) {
        if (!photos.length) continue;
        remote[stopId] = [];
        for (const dataUrl of photos) {
          // Reuse unchanged cloud files; don't duplicate every photo on each publish.
          let photoId = (cloudPhotoIds[stopId] || []).find(id => cloudPhotoData[id] === dataUrl);
          if (!photoId) {
            if (!dataUrl.startsWith('data:image/')) throw new Error('相片需要重新上傳，請使用上傳照片功能。');
            setCloudStatus(`正在上傳 ${stopId} 的照片…`);
            const result = await cloudWrite<{fileId:string}>('uploadPhoto', {dataUrl}, adminToken);
            photoId = result.fileId;
          }
          remote[stopId].push(photoId);
        }
      }
      setCloudStatus('正在發佈行程…');
      const result = await cloudWrite<{updatedAt:string}>('publish', {itinerary, galleries:remote, expectedUpdatedAt:cloudUpdatedAt}, adminToken);
      setCloudUpdatedAt(result.updatedAt); setCloudPhotoIds(remote);
      const nextData = {...cloudPhotoData};
      for (const [stopId, ids] of Object.entries(remote)) ids.forEach((id, i) => {nextData[id] = photoGalleries[stopId][i]});
      setCloudPhotoData(nextData);
      setCloudStatus('發佈成功！家人重新整理網頁後即可查看。');
    } catch (error) { setCloudStatus(error instanceof Error ? error.message : '發佈失敗'); }
    finally { setCloudBusy(false); }
  };

  const handleSaveGallery = async (stopId: string, photos: string[]) => {
    if (!isAdmin) throw new Error('只有管理員可以修改照片');
    await writeGallery(stopId, photos);
    setPhotoGalleries(current => ({ ...current, [stopId]: photos }));
  };

  const handleApplyItinerary = (nextData: ItineraryData) => {
    if (!isAdmin) { setCloudStatus('請先以管理員身分登入後再匯入行程。'); return; }
    setItinerary(nextData);
    setDayDirection(1);
    setSelectedDayIndex(0);
    setViewMode('timeline');
    if (window.location.hash.startsWith('#trip=')) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
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
            {isAdmin && isEditOpen && <ItineraryEditor data={itinerary} dayIndex={selectedDayIndex} onChange={setItinerary} onPhoto={async (id, photo) => { try { await handleSaveGallery(id, [photo, ...(photoGalleries[id] ?? []).slice(1)]); return true; } catch { return false; } }} onClose={() => setIsEditOpen(false)} />}
            <ViewToggle mode={viewMode} onChange={setViewMode} />

            <div className="mt-5">
              <AnimatePresence mode="wait" initial={false}>
                {activeDay && viewMode === 'timeline' && (
                  <motion.div
                    key={`timeline-${selectedDayIndex}-${activeDay.dayNumber}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.22, ease: TACTILE_EASE }}
                  >
                    {activeDay.stops.length === 0 ? (
                      <div className="rounded-3xl bg-[#F4F2ED] p-8 text-center shadow-sm ring-1 ring-black/[0.06]">
                        <p className="text-sm font-medium text-[#1A1A1A]">本日尚無行程站點</p>
                        <p className="mt-1 text-xs text-[#5E5A52]">
                          點擊上方 Share / Import 可生成或匯入行程。
                        </p>
                      </div>
                    ) : (
                      <div>
                        {activeDay.stops.map((stop, idx) => {
                          const hasNext = idx < activeDay.stops.length - 1;
                          return (
                            <React.Fragment key={stop.id}>
                              <StopCard
                                stop={stop}
                                customPhotoUrl={photoGalleries[stop.id]?.[0] ?? ''}
                                onSelect={openPostcard}
                              />
                              {hasNext && <TransitConnector transitText={stop.transitToNext} />}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}

                {activeDay && viewMode === 'route' && (
                  <motion.div
                    key={`route-${selectedDayIndex}-${activeDay.dayNumber}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.22, ease: TACTILE_EASE }}
                  >
                    <DayRouteView day={activeDay} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </main>
        </div>

        <StopDetailSheet
          stop={selectedStop}
          gallery={selectedStop ? (photoGalleries[selectedStop.id] ?? []) : []}
          onSaveGallery={handleSaveGallery}
          onGalleryTick={() => {
            void playUiSound('slide', soundEnabled);
          }}
          readOnly={!isAdmin}
          onClose={closePostcard}
        />

        {postcardMotion && (
          <PostcardPageTurn motionState={postcardMotion} onComplete={finishPostcardMotion} />
        )}

        <ShareImportSheet
          isOpen={isShareOpen}
          currentTrip={itinerary}
          onClose={() => setIsShareOpen(false)}
          onApplyItinerary={handleApplyItinerary}
          readOnly={!isAdmin}
        />
      </div>
    </MotionConfig>
  );
}
