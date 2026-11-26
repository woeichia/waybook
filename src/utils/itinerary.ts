import { parseBranchData } from './branchRoutes';
import type { ItineraryData, ItineraryDay, ItineraryStop } from '../types/itinerary';

const STORAGE_KEY = 'waybook_active_itinerary_pdf_2026_v3';
// Previous versions remain in browser storage as backups but are not loaded into the PDF itinerary.
const LEGACY_STORAGE_KEY = 'waybook_active_itinerary_pdf_2026_v3_legacy';

export function buildStopMapsUrl(mapQuery: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;
}

export function buildFullDayMapsUrl(stops: ItineraryStop[]): string {
  const queries = stops.map((s) => s.mapQuery.trim()).filter(Boolean);
  if (queries.length === 0) {
    return 'https://www.google.com/maps';
  }
  if (queries.length === 1) {
    return buildStopMapsUrl(queries[0]);
  }
  const origin = encodeURIComponent(queries[0]);
  const destination = encodeURIComponent(queries[queries.length - 1]);
  const middle = queries.slice(1, -1).map((q) => encodeURIComponent(q));
  const waypointsParam = middle.length > 0 ? `&waypoints=${middle.join('%7C')}` : '';
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypointsParam}`;
}

export function formatShortDate(isoDate: string): string {
  if (!isoDate) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return isoDate;
  const [, year, month, day] = match;
  const dateObj = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(dateObj.getTime())) return isoDate;
  return `${Number(month)}/${Number(day)}`;
}

export function formatDateRange(startDate: string, endDate: string): string {
  if (!startDate && !endDate) return '';
  if (!endDate || startDate === endDate) return formatShortDate(startDate);
  const startMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startDate.trim());
  const endMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(endDate.trim());
  if (!startMatch || !endMatch) {
    return `${startDate} – ${endDate}`;
  }
  const sDate = new Date(Number(startMatch[1]), Number(startMatch[2]) - 1, Number(startMatch[3]));
  const eDate = new Date(Number(endMatch[1]), Number(endMatch[2]) - 1, Number(endMatch[3]));
  if (Number.isNaN(sDate.getTime()) || Number.isNaN(eDate.getTime())) {
    return `${startDate} – ${endDate}`;
  }
  if (startMatch[1] === endMatch[1] && startMatch[2] === endMatch[2]) {
    const monthStr = sDate.toLocaleDateString('en-US', { month: 'short' });
    return `${monthStr} ${sDate.getDate()}–${eDate.getDate()}, ${startMatch[1]}`;
  }
  return `${sDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${eDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${endMatch[1]}`;
}

export function validateItineraryData(raw: unknown): { ok: true; data: ItineraryData } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Itinerary must be a JSON object with "trip" and "days" keys.' };
  }
  const obj = raw as Record<string, unknown>;
  if (!obj.trip || typeof obj.trip !== 'object') {
    return { ok: false, error: 'Missing required "trip" object.' };
  }
  if (!Array.isArray(obj.days) || obj.days.length === 0) {
    return { ok: false, error: '"days" must be a non-empty array.' };
  }

  const tripRaw = obj.trip as Record<string, unknown>;
  const title = typeof tripRaw.title === 'string' && tripRaw.title.trim() ? tripRaw.title.trim() : '';
  if (!title) {
    return { ok: false, error: '"trip.title" must be a non-empty string.' };
  }

  const normalizedDays: ItineraryDay[] = [];
  for (let i = 0; i < obj.days.length; i++) {
    const d = obj.days[i] as Record<string, unknown>;
    if (!d || typeof d !== 'object') {
      return { ok: false, error: `Day at index ${i} must be an object.` };
    }
    if (!Array.isArray(d.stops)) {
      return { ok: false, error: `Day ${i + 1} is missing a "stops" array.` };
    }
    const stops: ItineraryStop[] = d.stops.map((sRaw, sIdx) => {
      const s = (sRaw && typeof sRaw === 'object' ? sRaw : {}) as Record<string, unknown>;
      const stopTitle = typeof s.title === 'string' && s.title.trim() ? s.title.trim() : `Stop ${sIdx + 1}`;
      const locationName =
        typeof s.locationName === 'string' && s.locationName.trim() ? s.locationName.trim() : stopTitle;
      const mapQuery = typeof s.mapQuery === 'string' && s.mapQuery.trim() ? s.mapQuery.trim() : locationName;
      return {
        id: typeof s.id === 'string' && s.id.trim() ? s.id.trim() : `day-${i + 1}-stop-${sIdx + 1}`,
        time: typeof s.time === 'string' && s.time.trim() ? s.time.trim() : 'TBD',
        title: stopTitle,
        category: typeof s.category === 'string' && s.category.trim() ? s.category.trim() : 'Sightseeing',
        description: typeof s.description === 'string' ? s.description.trim() : '',
        image: typeof s.image === 'string' ? s.image.trim() : '',
        images: Array.isArray(s.images) ? s.images.filter((value): value is string => typeof value === 'string' && /^(https?:\/\/|\/images\/)/.test(value)).slice(0, 3) : [],
        locationName,
        mapQuery,
        transitToNext: typeof s.transitToNext === 'string' ? s.transitToNext.trim() : '',
        schedule: s.schedule && typeof s.schedule === 'object' ? (() => {
          const x = s.schedule as Record<string, unknown>;
          return {
            durationMinutes: typeof x.durationMinutes === 'number' && Number.isFinite(x.durationMinutes) && x.durationMinutes > 0 && x.durationMinutes <= 1440 ? Math.round(x.durationMinutes) : undefined,
            travelFromPreviousMinutes: typeof x.travelFromPreviousMinutes === 'number' && Number.isFinite(x.travelFromPreviousMinutes) && x.travelFromPreviousMinutes >= 0 && x.travelFromPreviousMinutes <= 1440 ? Math.round(x.travelFromPreviousMinutes) : undefined,
            fixedStart: x.fixedStart === true,
          };
        })() : undefined,
      };
    });

    normalizedDays.push({
      dayNumber: typeof d.dayNumber === 'number' && Number.isFinite(d.dayNumber) ? d.dayNumber : i + 1,
      date: typeof d.date === 'string' ? d.date.trim() : '',
      title: typeof d.title === 'string' && d.title.trim() ? d.title.trim() : `Day ${i + 1}`,
      stops,
    });
    const branchError = parseBranchData(normalizedDays[normalizedDays.length-1], d);
    if (branchError) return {ok:false,error:`Day ${i+1}: ${branchError}`};
  }

  return {
    ok: true,
    data: {
      trip: {
        title,
        startDate: typeof tripRaw.startDate === 'string' ? tripRaw.startDate.trim() : normalizedDays[0]?.date ?? '',
        endDate:
          typeof tripRaw.endDate === 'string'
            ? tripRaw.endDate.trim()
            : normalizedDays[normalizedDays.length - 1]?.date ?? '',
        travelers:
          typeof tripRaw.travelers === 'number' && tripRaw.travelers > 0 ? Math.round(tripRaw.travelers) : 1,
        coverImage: typeof tripRaw.coverImage === 'string' ? tripRaw.coverImage.trim() : '',
        currency: typeof tripRaw.currency === 'string' && tripRaw.currency.trim() ? tripRaw.currency.trim() : 'TWD',
      },
      days: normalizedDays,
    },
  };
}

function isLegacyKyotoSample(data: ItineraryData): boolean {
  return (
    data.trip.title === 'Kyoto Autumn Escape' ||
    data.days[0]?.stops?.[0]?.id === 'stop-1'
  );
}

export function loadSavedItinerary(): ItineraryData | null {
  try {
    const hash = window.location.hash;
    if (hash.startsWith('#trip=')) {
      const encoded = hash.slice(6);
      const json = decodeURIComponent(escape(atob(encoded.replace(/-/g, '+').replace(/_/g, '/'))));
      const parsed = JSON.parse(json);
      const validated = validateItineraryData(parsed);
      if (validated.ok) {
        return validated.data;
      }
    }
  } catch {
    // Ignore malformed share hash
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const validated = validateItineraryData(parsed);
      if (validated.ok && !isLegacyKyotoSample(validated.data)) {
        return validated.data;
      }
    }

    const legacyStored = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyStored) {
      const parsed = JSON.parse(legacyStored);
      const validated = validateItineraryData(parsed);
      if (validated.ok && !isLegacyKyotoSample(validated.data)) {
        return validated.data;
      }
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }

    return null;
  } catch {
    return null;
  }
}

export function saveItineraryToStorage(data: ItineraryData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota issues
  }
}

export function buildShareUrl(data: ItineraryData): string {
  const json = JSON.stringify(data);
  const base64 = btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const url = new URL(window.location.href);
  url.hash = `trip=${base64}`;
  return url.toString();
}
