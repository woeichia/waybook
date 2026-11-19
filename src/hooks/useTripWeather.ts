import { useEffect, useMemo, useState } from 'react';
import type { ItineraryData, ItineraryDay } from '../types/itinerary';
import type { DailyWeatherSummary, TripWeatherSummary } from '../types/weather';

/** Free, browser-accessible forecast: no Express backend, billing or API key. */
const CITIES = {
  taipei: { label: '台北', lat: 25.033, lon: 121.5654 },
  taichung: { label: '台中', lat: 24.1477, lon: 120.6736 },
  cingjing: { label: '清境', lat: 24.059, lon: 121.162 },
} as const;
type City = keyof typeof CITIES;

function cityForDay(day?: ItineraryDay): City {
  if (!day) return 'taipei';
  // Match the planned day's destination, not the visitor's current location.
  const text = [day.title, ...day.stops.flatMap(s => [s.title, s.locationName])].join(' ').toLowerCase();
  if (/清境|青青草原|cingjing|qingjing/.test(text)) return 'cingjing';
  if (/台中|臺中|逢甲|高美|歌劇院|屋馬|taichung|fengjia|gaomei/.test(text)) return 'taichung';
  return 'taipei';
}

function describeWeather(code: number): { text: string; type: string } {
  if (code === 0) return { text: '晴朗', type: 'CLEAR' };
  if (code === 1 || code === 2) return { text: '晴時多雲', type: 'PARTLY_CLOUDY' };
  if (code === 3) return { text: '多雲', type: 'CLOUDY' };
  if (code === 45 || code === 48) return { text: '有霧', type: 'FOG' };
  if ([51, 53, 55, 56, 57].includes(code)) return { text: '毛毛雨', type: 'DRIZZLE' };
  if ([61, 63, 65, 66, 67].includes(code)) return { text: '下雨', type: 'RAIN' };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { text: '降雪', type: 'SNOW' };
  if ([80, 81, 82].includes(code)) return { text: '陣雨', type: 'SHOWERS' };
  if ([95, 96, 99].includes(code)) return { text: '雷雨', type: 'THUNDERSTORM' };
  return { text: '天氣變化', type: 'CLOUDY' };
}

type Forecast = {
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: (number | null)[];
    temperature_2m_min?: (number | null)[];
    precipitation_probability_max?: (number | null)[];
  };
  error?: boolean;
  reason?: string;
};

function toDailyRows(data: Forecast): DailyWeatherSummary[] {
  const daily = data.daily;
  if (!daily?.time || !daily.temperature_2m_max || !daily.temperature_2m_min || !daily.weather_code) {
    throw new Error('天氣服務回傳資料不完整');
  }
  return daily.time.flatMap((date, i) => {
    const high = daily.temperature_2m_max?.[i];
    const low = daily.temperature_2m_min?.[i];
    if (!date || high == null || low == null) return [];
    const condition = describeWeather(daily.weather_code?.[i] ?? 3);
    return [{
      date,
      conditionText: condition.text,
      conditionType: condition.type,
      maxTempC: Math.round(high),
      minTempC: Math.round(low),
      precipitationPercent: Math.min(100, Math.max(0, Math.round(daily.precipitation_probability_max?.[i] ?? 0))),
      matchesTripDate: false,
    }];
  });
}

export function useTripWeather(itinerary: ItineraryData, isOnline: boolean, selectedDayDate?: string) {
  const [weather, setWeather] = useState<TripWeatherSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const city = useMemo(() => cityForDay(itinerary.days.find(d => d.date === selectedDayDate)), [itinerary.days, selectedDayDate]);
  const cityInfo = CITIES[city];
  const tripDates = useMemo(() => itinerary.days.map(d => d.date).filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)), [itinerary.days]);
  const tripSignature = tripDates.join(',');

  useEffect(() => {
    let lastFetch = Date.now();
    const onFocus = () => {
      if (Date.now() - lastFetch >= 30 * 60 * 1000) {
        lastFetch = Date.now();
        setRefreshKey(v => v + 1);
      }
    };
    document.addEventListener('visibilitychange', onFocus);
    return () => document.removeEventListener('visibilitychange', onFocus);
  }, []);

  useEffect(() => {
    if (!isOnline) {
      setIsLoading(false);
      setError('離線模式 — 無法更新天氣預報');
      return;
    }
    const controller = new AbortController();
    let active = true;

    async function fetchWeather() {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          latitude: String(cityInfo.lat),
          longitude: String(cityInfo.lon),
          daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
          timezone: 'Asia/Taipei',
          forecast_days: '16',
          temperature_unit: 'celsius',
        });
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) throw new Error(`天氣服務暫時無法使用 (${response.status})`);
        const data: Forecast = await response.json();
        if (data.error) throw new Error(data.reason || '天氣服務暫時無法使用');
        const forecastDays = toDailyRows(data);
        const tripDateSet = new Set(tripSignature.split(',').filter(Boolean));
        const matchingDays = forecastDays.filter(d => d.date === selectedDayDate && tripDateSet.has(d.date));
        const exact = matchingDays.length > 0;
        const days = (exact ? matchingDays : forecastDays.slice(0, 5)).map(day => ({
          ...day,
          matchesTripDate: exact && tripDateSet.has(day.date),
        }));
        if (!active) return;
        setWeather({
          locationLabel: `${cityInfo.label}${exact ? '行程天氣' : '近期天氣'}`,
          formattedAddress: `${cityInfo.label}, 台灣`,
          isExactTripDates: exact,
          days,
        });
      } catch (e) {
        if (!active || (e instanceof Error && e.name === 'AbortError')) return;
        setError(e instanceof Error ? e.message : '天氣服務暫時無法使用');
        setWeather(null);
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void fetchWeather();
    return () => { active = false; controller.abort(); };
  }, [isOnline, city, cityInfo.lat, cityInfo.lon, cityInfo.label, tripSignature, selectedDayDate, refreshKey]);

  return { weather, isLoading, error };
}
