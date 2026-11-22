import type { ItineraryStop } from '../types/itinerary';

export type PlannerInputs = {
  startTime: string;
  endTime: string;
  bufferMinutes: number;
  travelById: Record<string, number>;
  durationById: Record<string, number>;
  fixedById: Record<string, boolean>;
};
export type PlannedStop = { stop: ItineraryStop; start: number; end: number; duration: number; travel: number; fixed: boolean; originalStart: number | null; estimatedDuration: boolean; estimatedTravel: boolean; conflict: string | null };
export type PlanResult = { rows: PlannedStop[]; issues: string[]; unverified: number; endTime: number; overMinutes: number };

export function parseClock(text: string): number | null {
  const match = /(?:^|[^\d])(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(text);
  if (!match) return null;
  let hours = Number(match[1]); const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  if (match[3] && hours <= 12) {
    if (/PM/i.test(match[3]) && hours < 12) hours += 12;
    if (/AM/i.test(match[3]) && hours === 12) hours = 0;
  }
  return hours * 60 + minutes;
}
export function clock(minutes: number): string {
  const h = Math.floor(minutes / 60); const m = Math.floor(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
export function eventDuration(stop: ItineraryStop): { minutes: number; estimated: boolean } {
  const explicit = stop.schedule?.durationMinutes;
  if (typeof explicit === 'number' && explicit > 0) return { minutes: explicit, estimated: false };
  const times = [...stop.time.matchAll(/(\d{1,2}):(\d{2})\s*(?:AM|PM)?/gi)].map(m => parseClock(m[0])).filter((x): x is number => x !== null);
  if (times.length >= 2 && /[–—~-]/.test(stop.time)) {
    let diff = times[1] - times[0]; if (diff < 0) diff += 1440;
    if (diff >= 5 && diff <= 600) return { minutes: diff, estimated: false };
  }
  return { minutes: stop.category === 'Transport' ? 15 : stop.category === 'Food' ? 60 : stop.category === 'Hotel' ? 30 : 60, estimated: true };
}
export function planStops(stops: ItineraryStop[], input: PlannerInputs): PlanResult {
  const start = parseClock(input.startTime) ?? 540;
  const limit = parseClock(input.endTime) ?? 1140;
  const buffer = Math.max(0, Math.min(120, input.bufferMinutes));
  let cursor = start;
  const rows: PlannedStop[] = []; const issues: string[] = []; let unverified = 0;
  for (const stop of stops) {
    const durationInfo = eventDuration(stop);
    const customDuration = input.durationById[stop.id];
    const duration = Number.isFinite(customDuration) && customDuration > 0 ? customDuration : durationInfo.minutes;
    const customTravel = input.travelById[stop.id];
    const explicitTravel = stop.schedule?.travelFromPreviousMinutes;
    const estimatedTravel = rows.length > 0 && !Number.isFinite(customTravel) && !Number.isFinite(explicitTravel);
    const travel = rows.length === 0 ? 0 : Math.max(0, Number.isFinite(customTravel) ? customTravel : Number.isFinite(explicitTravel) ? explicitTravel! : 30);
    const originalStart = parseClock(stop.time);
    const fixed = input.fixedById[stop.id] ?? Boolean(stop.schedule?.fixedStart);
    const arrival = cursor + (rows.length ? travel + buffer : 0);
    const proposedStart = fixed && originalStart !== null ? Math.max(arrival, originalStart) : arrival;
    const conflict = fixed && originalStart !== null && arrival > originalStart ? `抵達可能晚於固定時間 ${clock(originalStart)}（晚 ${arrival - originalStart} 分鐘）` : fixed && originalStart === null ? '固定活動沒有可辨識的開始時間' : null;
    if (conflict) issues.push(`${stop.title}：${conflict}`);
    if (estimatedTravel) unverified++;
    if (durationInfo.estimated && !Number.isFinite(customDuration)) unverified++;
    rows.push({ stop, start: proposedStart, end: proposedStart + duration, duration, travel, fixed, originalStart, estimatedDuration:durationInfo.estimated&&!Number.isFinite(customDuration), estimatedTravel, conflict });
    cursor = proposedStart + duration;
  }
  const overMinutes = Math.max(0, cursor - limit);
  if (overMinutes > 0) issues.push(`預估結束 ${clock(cursor)}，超過當日上限 ${clock(limit)}（${overMinutes} 分鐘）`);
  if (cursor > 24 * 60) issues.push('行程延伸至隔天，請重新安排');
  return { rows, issues, unverified, endTime: cursor, overMinutes };
}

export function applyPlanTimes(plan: PlanResult, input: PlannerInputs): ItineraryStop[] {
  return plan.rows.map(row => ({ ...row.stop,
    time: row.fixed ? row.stop.time : `${clock(row.start)}–${clock(row.end)}`,
    schedule: { ...row.stop.schedule, durationMinutes: row.duration,
      travelFromPreviousMinutes: row.travel, fixedStart: row.fixed },
  }));
}
