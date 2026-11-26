import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Code2,
  Copy,
  Download,
  Loader2,
  RotateCcw,
  Share2,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import type { ItineraryData } from '../types/itinerary';
import { SAMPLE_TRIP } from '../data/sampleTrip';
import { buildShareUrl, validateItineraryData } from '../utils/itinerary';
import { PWAInstallButton } from './PWAInstallButton';

interface ShareImportSheetProps {
  isOpen: boolean;
  currentTrip: ItineraryData;
  onClose: () => void;
  onApplyItinerary: (data: ItineraryData, galleryReferences?: Record<string, string[]>, memories?: Record<string,{id:string;caption:string}[]>) => void;
  cloudGalleryReferences?: Record<string, string[]>;
  cloudMemoryReferences?: Record<string,{id:string;caption:string}[]>;
  galleryEventIds?: string[];
  readOnly?: boolean;
}

type SheetTab = 'ai' | 'json' | 'share';

const SAMPLE_PROMPTS = [
  '3 days in Tokyo focused on architecture, specialty coffee, and museums for 2 travelers',
  '2-day Lisbon food & scenic tram weekend for 4 friends',
  '3-day Seoul art galleries, markets, and riverside walk for 3 travelers',
];


/** Self-describing planning export; metadata is ignored by the itinerary importer. */
function planningExport(data: ItineraryData) {
  return {
    ...data,
    days: data.days.map(day => ({...day, optionalGroups: day.optionalGroups ?? [], travelRoutes: day.travelRoutes ?? []})),
    waybookPlanningGuide: {
      version: '4.6.2',
      instructions: [
        'Return the full itinerary object with trip and days; use Taiwanese Traditional Chinese for descriptions and route notes.',
        'Preserve existing stop IDs, media-related fields, confirmed selections and bookings. Give newly added stops unique IDs across the entire trip. Do not silently remove existing stops.',
        'Optional events are supported even when optionalGroups is empty. Place two alternative stops adjacent in days[].stops, in the same intended time slot, and add their IDs to optionalGroups in that order. Use selectedEventId: null for new undecided groups. Consecutive groups are allowed; no overlapping or nested groups.',
        'Treat each optional pair as one itinerary slot. Add a travelRoutes entry for every connection between consecutive slots: 1-to-1, 1-to-2, 2-to-1, and all four 2-to-2 combinations. Never connect the two alternatives within the same slot.',
        'Use route-specific ordered transportModes (including repeated modes if needed). Use transportMode mixed for combinations, otherwise the single mode. The duration is the total journey in minutes including walking, waiting and transfers. Keep notes concise and omit duration expressions from notes. Include station names, lines, transfers and exits when verified.',
        'Do not invent routes, exits or travel durations. If insufficient information, omit the unknown route and report it separately; do not use zero as a placeholder. Report schedule conflicts separately.',
        'Use full itinerary import for new optional groups or changed stops; travel-only import requires identical stop IDs, order and optional group membership.'
      ],
      allowedTransportModes: ['car','charter','mrt','walking','train','hsr','flight','bus','taxi','ferry'],
      optionalGroupExample: {eventIds:['EXAMPLE_2A','EXAMPLE_2B'],selectedEventId:null},
      travelRouteExample: {fromEventId:'EXAMPLE_1',toEventId:'EXAMPLE_2A',transportMode:'mixed',transportModes:['mrt','bus','walking'],durationMinutes:50,notes:'搭乘捷運至指定車站，轉乘公車後步行前往。'},
      examplesAreIllustrative: true
    }
  };
}

export const ShareImportSheet: React.FC<ShareImportSheetProps> = ({
  isOpen,
  currentTrip,
  onClose,
  onApplyItinerary,
  cloudGalleryReferences = {},
  cloudMemoryReferences = {},
  galleryEventIds = [],
  readOnly = false,
}) => {
  const [activeTab, setActiveTab] = useState<SheetTab>('share');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [jsonInput, setJsonInput] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<{data: ItineraryData; refs?: Record<string,string[]>; memories?: Record<string,{id:string;caption:string}[]>; summary: string} | null>(null);
  const [copiedState, setCopiedState] = useState<'json' | 'link' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setJsonInput(JSON.stringify(planningExport(currentTrip), null, 2));
      setJsonError(null);
      setImportPreview(null);
      setAiError(null);
    }
  }, [isOpen, currentTrip]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleGenerateAI = async (e: React.FormEvent) => {
    e.preventDefault();
    const prompt = aiPrompt.trim();
    if (!prompt) {
      setAiError('Describe a destination or paste raw travel notes first.');
      return;
    }

    setIsGenerating(true);
    setAiError(null);

    try {
      const response = await fetch('/api/itinerary/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Could not generate itinerary.');
      }

      const validated = validateItineraryData(payload);
      if (!validated.ok) {
        throw new Error(validated.error);
      }

      onApplyItinerary(validated.data);
      setAiPrompt('');
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong while generating.';
      setAiError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const previewJsonImport = (text: string) => {
    const parsed = JSON.parse(text) as unknown;
    const object = parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
    const fullBackup = object?.format === 'waybook-full-backup-v1';
    const candidate = fullBackup ? object?.itinerary : parsed;
    const validated = validateItineraryData(candidate);
    if (!validated.ok) throw new Error(validated.error);
    const rawDays = (candidate as ItineraryData).days;
    const rawIds = rawDays.flatMap(d => d.stops.map(s => s.id));
    if (rawIds.some(id => typeof id !== 'string' || !id.trim())) throw new Error('每個活動都必須保留原本的 ID。');
    if (new Set(rawIds).size !== rawIds.length) throw new Error('匯入檔案有重複活動 ID，請先修正。');
    const incoming = new Set(rawIds);
    const currentIds = new Set(currentTrip.days.flatMap(d => d.stops.map(s => s.id)));
    const existingGalleryIds = new Set([...Object.keys(cloudGalleryReferences), ...Object.keys(cloudMemoryReferences), ...galleryEventIds]);
    const detached = [...existingGalleryIds].filter(id => currentIds.has(id) && !incoming.has(id));
    if (detached.length) throw new Error(`停止匯入：${detached.length} 個有照片的活動 ID 消失，會造成照片失去連結。請保留原 ID，或先移動活動。`);
    const refsRaw = fullBackup && object?.galleries && typeof object.galleries === 'object' ? object.galleries as Record<string, unknown> : undefined;
    const refs: Record<string,string[]> | undefined = refsRaw ? {} : undefined;
    if (refs && refsRaw) for (const [id, list] of Object.entries(refsRaw)) {
      if (!incoming.has(id) || !Array.isArray(list) || list.some(value => typeof value !== 'string' || !/^[A-Za-z0-9_-]{10,120}$/.test(value)) || list.length > 8) {
        throw new Error('完整備份的照片參照不正確，無法安全還原。');
      }
      refs[id] = list as string[];
    }
    const memoriesRaw = fullBackup && object?.memoryGalleries && typeof object.memoryGalleries === 'object' ? object.memoryGalleries as Record<string,unknown> : undefined;
    const memories: Record<string,{id:string;caption:string}[]> | undefined = memoriesRaw ? {} : undefined;
    if (memories && memoriesRaw) for (const [id, list] of Object.entries(memoriesRaw)) {
      if (!incoming.has(id) || !Array.isArray(list) || list.length > 12 || list.some(item => !item || typeof item !== 'object' ||
          typeof item.id !== 'string' || !/^[A-Za-z0-9_-]{10,120}$/.test(item.id) || typeof item.caption !== 'string' || item.caption.length > 240))
        throw new Error('完整備份的回憶照片參照不正確，無法安全還原。');
      memories[id] = list as {id:string;caption:string}[];
    }
    const oldLocation = new Map(currentTrip.days.flatMap(d => d.stops.map(s => [s.id,d.date] as const)));
    const moved = validated.data.days.flatMap(d => d.stops.filter(s => oldLocation.has(s.id) && oldLocation.get(s.id)!==d.date)).length;
    const newIds = [...incoming].filter(id => !currentIds.has(id)).length;
    const removed = [...currentIds].filter(id => !incoming.has(id)).length;
    setImportPreview({data:validated.data,refs,memories,summary:`移動 ${moved} 個 · 新增 ${newIds} 個 · 移除 ${removed} 個活動。${fullBackup ? '含照片參照備份（不包含照片檔案）。' : '現有照片參照將保留。'}`});
    setJsonError(null);
  };
  const handleApplyJson = () => {
    if (readOnly) return;
    setJsonError(null);
    setImportPreview(null);
    try { previewJsonImport(jsonInput); }
    catch (error) { setJsonError(error instanceof Error ? error.message : 'JSON 格式不正確。'); }
  };
  const previewTravelOnly = () => {
    if(readOnly)return;
    setImportPreview(null);setJsonError(null);
    try {
      const raw=JSON.parse(jsonInput);const validated=validateItineraryData(raw);
      if(!validated.ok)throw new Error(validated.error);
      const incoming=validated.data;
      if(!raw.days.every((d: any)=>Array.isArray(d.travelRoutes)))throw new Error("每一天必須包含 travelRoutes 陣列。");
      const identity=(d:ItineraryData['days'][number])=>JSON.stringify([d.date,d.stops.map(s=>s.id), (d.optionalGroups??[]).map(g=>g.eventIds)]);
      if(incoming.days.length!==currentTrip.days.length||currentTrip.days.some((d,i)=>identity(d)!==identity(incoming.days[i])))throw new Error('活動 ID、順序或備選組合不一致，已停止更新。');
      const days=currentTrip.days.map((d,i)=>({...d,travelRoutes:incoming.days[i].travelRoutes??[]}));
      setImportPreview({data:{...currentTrip,days},summary:`僅更新 ${days.reduce((n,d)=>n+(d.travelRoutes?.length??0),0)} 段交通資訊；活動、選擇及照片影片保持不變。`});
    }catch(e){setJsonError(e instanceof Error?e.message:'JSON 格式不正確');}
  };
  const confirmImport = () => {
    if (!importPreview) return;
    onApplyItinerary(importPreview.data, importPreview.refs, importPreview.memories);
    setImportPreview(null);
    onClose();
  };
  const handleUploadJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      setJsonInput(content);
      setImportPreview(null);
      previewJsonImport(content);
    } catch(error) {
      setJsonError(error instanceof Error ? error.message : '無法讀取 JSON 檔案。');
    } finally { e.target.value = ''; }
  };
  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(planningExport(currentTrip), null, 2));
      setCopiedState('json');
      setTimeout(() => setCopiedState(null), 2000);
    } catch {
      setJsonError('Clipboard permission unavailable in this browser.');
    }
  };

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(planningExport(currentTrip), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const slug = currentTrip.trip.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    a.download = `${slug || 'itinerary'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadFullBackup = () => {
    const payload = {
      format: 'waybook-full-backup-v1', exportedAt: new Date().toISOString(),
      itinerary: currentTrip, galleries: cloudGalleryReferences, memoryGalleries: cloudMemoryReferences,
      note: 'Gallery values are Google Drive file IDs. Actual photo bytes are NOT included. Keep the Waybook Drive folder backed up separately.'
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `waybook-full-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const handleCopyShareLink = async () => {
    try {
      const shareUrl = buildShareUrl(currentTrip);
      await navigator.clipboard.writeText(shareUrl);
      setCopiedState('link');
      setTimeout(() => setCopiedState(null), 2000);
    } catch {
      // Clipboard blocked
    }
  };

  const handleNativeShare = async () => {
    const shareUrl = buildShareUrl(currentTrip);
    if (navigator.share) {
      try {
        await navigator.share({
          title: currentTrip.trip.title,
          text: `查看我們的 ${currentTrip.days.length} 天行程：${currentTrip.trip.title}`,
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled or fallback to copy
      }
    }
    await handleCopyShareLink();
  };

  const handleResetSample = () => {
    if (readOnly) return;
    onApplyItinerary(SAMPLE_TRIP);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-import-title"
    >
      <div
        className="w-full max-w-[480px] rounded-t-3xl sm:rounded-3xl bg-[#F4F2ED] shadow-2xl ring-1 ring-black/[0.08] max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-3 pb-4 border-b border-black/[0.06]">
          <div className="w-10 h-1 bg-[#C8C3B8] rounded-full mx-auto mb-3 sm:hidden" />
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 id="share-import-title" className="text-lg font-semibold text-[#1A1A1A]">
                Share & Import Trip
              </h2>
              <p className="text-xs text-[#5E5A52] mt-0.5">
                AI 生成行程、匯入嚴格 JSON 或與旅伴分享
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-[#5E5A52] hover:bg-black/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div role="tablist" className="mt-4 grid grid-cols-3 gap-1 rounded-2xl bg-[#E4E1DA] p-1">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'ai'}
              onClick={() => !readOnly && setActiveTab('ai')} disabled={readOnly}
              className={`min-h-[38px] flex items-center justify-center gap-1.5 rounded-xl px-2 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === 'ai' ? 'bg-[#F4F2ED] text-[#1F3FB0] shadow-xs' : 'text-[#5E5A52] hover:text-[#1A1A1A]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Import</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'json'}
              onClick={() => !readOnly && setActiveTab('json')} disabled={readOnly}
              className={`min-h-[38px] flex items-center justify-center gap-1.5 rounded-xl px-2 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === 'json' ? 'bg-[#F4F2ED] text-[#1F3FB0] shadow-xs' : 'text-[#5E5A52] hover:text-[#1A1A1A]'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>JSON</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'share'}
              onClick={() => setActiveTab('share')}
              className={`min-h-[38px] flex items-center justify-center gap-1.5 rounded-xl px-2 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === 'share' ? 'bg-[#F4F2ED] text-[#1F3FB0] shadow-xs' : 'text-[#5E5A52] hover:text-[#1A1A1A]'
              }`}
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share & App</span>
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {activeTab === 'ai' && !readOnly && (
            <form onSubmit={handleGenerateAI} className="space-y-4">
              <div>
                <label htmlFor="ai-trip-prompt" className="block text-xs font-semibold text-[#1A1A1A]">
                  輸入旅遊想法或貼上筆記內容
                </label>
                <textarea
                  id="ai-trip-prompt"
                  rows={4}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="例如：規劃 3 天台北親子美食與博物館散步行程，2 大 1 小..."
                  className="mt-2 w-full rounded-2xl border border-black/10 bg-[#EDEBE6] p-3.5 text-sm text-[#1A1A1A] placeholder:text-[#8A857C] focus:outline-none focus:ring-2 focus:ring-[#1F3FB0]"
                />
              </div>

              <div>
                <p className="text-[11px] font-medium text-[#5E5A52] mb-2">快速靈感</p>
                <div className="flex flex-wrap gap-1.5">
                  {SAMPLE_PROMPTS.map((sample) => (
                    <button
                      key={sample}
                      type="button"
                      onClick={() => setAiPrompt(sample)}
                      className="rounded-full bg-[#EDEBE6] border border-black/[0.06] px-3 py-1.5 text-[11px] text-[#434039] hover:bg-[#E4E1DA] hover:text-[#1A1A1A] transition-colors text-left"
                    >
                      {sample}
                    </button>
                  ))}
                </div>
              </div>

              {aiError && (
                <div role="alert" className="rounded-2xl bg-[#FEF2F2] border border-[#FECACA] px-4 py-3 text-xs text-[#991B1B]">
                  {aiError}
                </div>
              )}

              <button
                type="submit"
                disabled={isGenerating}
                className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-2xl bg-[#1F3FB0] px-5 py-3 text-sm font-semibold text-white hover:bg-[#183391] disabled:opacity-60 transition-colors"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>正在建立結構化行程...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>生成並載入行程</span>
                  </>
                )}
              </button>
            </form>
          )}

          {activeTab === 'json' && !readOnly && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyJson}
                    className="min-h-[38px] inline-flex items-center gap-1.5 rounded-full bg-[#EDEBE6] border border-black/[0.08] px-3 py-1.5 text-xs font-medium text-[#1A1A1A] hover:bg-[#E4E1DA] transition-colors"
                  >
                    {copiedState === 'json' ? <Check className="w-3.5 h-3.5 text-[#1F3FB0]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedState === 'json' ? '已複製' : 'Copy JSON'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadJson}
                    className="min-h-[38px] inline-flex items-center gap-1.5 rounded-full bg-[#EDEBE6] border border-black/[0.08] px-3 py-1.5 text-xs font-medium text-[#1A1A1A] hover:bg-[#E4E1DA] transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export</span>
                  </button>
                  <button type="button" onClick={handleDownloadFullBackup}
                    className="min-h-[38px] inline-flex items-center gap-1.5 rounded-full bg-[#E8ECFA] border border-black/[0.08] px-3 py-1.5 text-xs font-medium text-[#1F3FB0]">
                    <Download className="w-3.5 h-3.5"/><span>Full Backup + Photo References</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="min-h-[38px] inline-flex items-center gap-1.5 rounded-full bg-[#EDEBE6] border border-black/[0.08] px-3 py-1.5 text-xs font-medium text-[#1A1A1A] hover:bg-[#E4E1DA] transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json,.json"
                    onChange={handleUploadJsonFile}
                    className="hidden"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleResetSample}
                  className="min-h-[38px] inline-flex items-center gap-1 text-xs font-medium text-[#5E5A52] hover:text-[#1F3FB0] px-2"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>重設台灣範例</span>
                </button>
              </div>

              <textarea
                rows={9}
                value={jsonInput}
                onChange={(e) => {setJsonInput(e.target.value);setImportPreview(null);}}
                spellCheck={false}
                aria-label="Itinerary JSON editor"
                className="w-full rounded-2xl border border-black/10 bg-[#EDEBE6] p-3.5 font-mono text-[11px] leading-relaxed text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#1F3FB0]"
              />

              {jsonError && (
                <div role="alert" className="rounded-2xl bg-[#FEF2F2] border border-[#FECACA] px-4 py-3 text-xs text-[#991B1B]">
                  {jsonError}
                </div>
              )}

              <p className="text-xs text-[#68635C]">Export = 行程 JSON；Full Backup = 行程 + Google Drive 照片 ID（不包含相片檔案）。匯入先預覽，確認後才套用；照片活動 ID 遺失會阻止匯入。</p>
              {importPreview && <div className="rounded-xl border border-[#1F3FB0]/25 bg-[#E8ECFA] p-3 space-y-2">
                <p className="text-sm font-semibold">匯入預覽（尚未變更行程）</p>
                <p className="text-xs">{importPreview.summary}</p>
                <div className="flex gap-2"><button type="button" onClick={confirmImport} className="rounded-full bg-[#1F3FB0] text-white px-4 py-2 text-xs">確認套用</button><button type="button" onClick={() => setImportPreview(null)} className="rounded-full bg-white px-4 py-2 text-xs">取消</button></div>
              </div>}
              <button
                type="button"
                onClick={handleApplyJson}
                className="w-full min-h-[48px] rounded-2xl bg-[#1F3FB0] px-5 py-3 text-sm font-semibold text-white hover:bg-[#183391] transition-colors"
              >
                Import & Apply JSON
              </button>
              <button type="button" onClick={previewTravelOnly} className="w-full rounded-xl bg-[#E8ECFA] text-[#1F3FB0] p-3 text-sm font-semibold">僅更新交通資訊</button>
            </div>
          )}

          {activeTab === 'share' && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-[#EDEBE6] p-4 border border-black/[0.06]">
                <h3 className="text-sm font-semibold text-[#1A1A1A]">與同行旅伴分享行程</h3>
                <p className="mt-1 text-xs text-[#5E5A52] leading-relaxed">
                  產生內含完整行程的連結，傳給家人或朋友即可在手機上同步查看每日站點與導航。
                </p>

                <div className="mt-3.5 grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleCopyShareLink}
                    className="min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl bg-[#F4F2ED] border border-black/10 px-3 py-2.5 text-xs font-semibold text-[#1A1A1A] hover:bg-[#E4E1DA] transition-colors"
                  >
                    {copiedState === 'link' ? <Check className="w-4 h-4 text-[#1F3FB0]" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedState === 'link' ? '已複製連結' : 'Copy Link'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleNativeShare}
                    className="min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl bg-[#1F3FB0] px-3 py-2.5 text-xs font-semibold text-white hover:bg-[#183391] transition-colors"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Share Trip</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-[#1A1A1A]">安裝至手機主畫面</h3>
                <p className="text-xs text-[#5E5A52] leading-relaxed">
                  將 Waybook 加入手機主畫面，旅途中離線也能流暢查看所有行程卡片。
                </p>
                <div className="pt-1">
                  <PWAInstallButton variant="panel" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
