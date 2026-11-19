import { useEffect, useState } from 'react';
import type { ItineraryData } from '../types/itinerary';
import type { TripWeatherSummary } from '../types/weather';

function buildLocationQueries(itinerary: ItineraryData): string[] {
  const candidates: string[] = [];

  for (const day of itinerary.days) {
    for (const stop of day.stops) {
      const loc = stop.locationName?.trim();
      if (loc) {
        const parts = loc.split(',').map((p) => p.trim()).filter(Boolean);
        if (parts.length > 1) {
          candidates.push(parts[parts.length - 1]);
        }
        candidates.push(loc);
      }
      const query = stop.mapQuery?.trim();
      if (query) {
        candidates.push(query);
      }
    }
  }

  if (itinerary.trip.title.trim()) {
    candidates.push(itinerary.trip.title.trim());
  }

  return Array.from(new Set(candidates)).slice(0, 4);
}

function buildTripDates(itinerary: ItineraryData): string[] {
  const dates = new Set<string>();
  for (const day of itinerary.days) {
    if (day.date && /^\d{4}-\d{2}-\d{2}$/.test(day.date.trim())) {
      dates.add(day.date.trim());
    }
  }

  const start = itinerary.trip.startDate?.trim();
  const end = itinerary.trip.endDate?.trim();
  if (start && end && /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end)) {
    const startMs = Date.parse(`${start}T00:00:00Z`);
    const endMs = Date.parse(`${end}T00:00:00Z`);
    if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs >= startMs) {
      const dayMs = 86_400_000;
      for (let t = startMs; t <= endMs && dates.size < 14; t += dayMs) {
        dates.add(new Date(t).toISOString().slice(0, 10));
      }
    }
  }

  return Array.from(dates).sort();
}

export function useTripWeather(itinerary: ItineraryData, isOnline: boolean) {
  const [weather, setWeather] = useState<TripWeatherSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locationQueries = buildLocationQueries(itinerary);
  const tripDates = buildTripDates(itinerary);
  const requestSignature = JSON.stringify({ locationQueries, tripDates });

  useEffect(() => {
    if (!isOnline || locationQueries.length === 0) {
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    async function fetchWeather() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/weather', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: requestSignature,
          signal: controller.signal,
        });

        const payload = await res.json();

        if (res.status === 429 || payload?.status === 'RESOURCE_EXHAUSTED') {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          throw new Error('Weather forecast quota reached.');
        }

        if (!res.ok) {
          throw new Error(payload?.error || 'Unable to load weather forecast.');
        }

        if (!cancelled) {
          setWeather(payload as TripWeatherSummary);
        }
      } catch (err: unknown) {
        if (cancelled || (err instanceof Error && err.name === 'AbortError')) {
          return;
        }
        const message = err instanceof Error ? err.message : 'Weather unavailable.';
        setError(message);
        setWeather(null);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchWeather();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [requestSignature, isOnline]);

  return { weather, isLoading, error };
}
