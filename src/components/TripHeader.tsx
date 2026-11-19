import React from 'react';
import {
  Calendar,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  Share2,
  Sun,
  Users,
  Volume2,
  VolumeX,
  Wind,
} from 'lucide-react';
import type { TripInfo } from '../types/itinerary';
import type { DailyWeatherSummary, TripWeatherSummary } from '../types/weather';
import { formatDateRange, formatShortDate } from '../utils/itinerary';
import { SmartImage } from './SmartImage';
import { PWAInstallButton } from './PWAInstallButton';

interface TripHeaderProps {
  trip: TripInfo;
  totalDays: number;
  selectedDayDate?: string;
  weather: TripWeatherSummary | null;
  weatherLoading: boolean;
  weatherError: string | null;
  isOnline: boolean;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenShareImport: () => void;
}

function getWeatherIcon(conditionType: string) {
  const t = conditionType.toUpperCase();
  if (t.includes('THUNDER')) return CloudLightning;
  if (t.includes('SNOW') || t.includes('SLEET') || t.includes('HAIL') || t.includes('ICE')) return CloudSnow;
  if (t.includes('HEAVY_RAIN') || t.includes('SHOWERS') || t.includes('RAIN')) return CloudRain;
  if (t.includes('DRIZZLE')) return CloudDrizzle;
  if (t.includes('FOG') || t.includes('MIST') || t.includes('HAZE')) return CloudFog;
  if (t.includes('WIND')) return Wind;
  if (t.includes('PARTLY') || t.includes('MOSTLY_CLEAR') || t.includes('SCATTERED')) return CloudSun;
  if (t.includes('CLOUD') || t.includes('OVERCAST')) return Cloud;
  return Sun;
}

export const TripHeader: React.FC<TripHeaderProps> = ({
  trip,
  totalDays,
  selectedDayDate,
  weather,
  weatherLoading,
  weatherError,
  isOnline,
  soundEnabled,
  onToggleSound,
  onOpenShareImport,
}) => {
  const dateRangeLabel = formatDateRange(trip.startDate, trip.endDate);
  const travelerLabel = `${trip.travelers} ${trip.travelers === 1 ? 'traveler' : 'travelers'}`;

  const daysList: DailyWeatherSummary[] = weather?.days ?? [];
  const featuredDay =
    daysList.find((d) => selectedDayDate && d.date === selectedDayDate) ?? daysList[0];
  const FeaturedIcon = featuredDay ? getWeatherIcon(featuredDay.conditionType) : CloudSun;

  return (
    <header className="relative overflow-hidden rounded-3xl bg-[#1A1A1A] shadow-sm min-h-[272px] ring-1 ring-black/[0.08]">
      <SmartImage
        src={trip.coverImage}
        alt={trip.title}
        isCover
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/20" />

      <div className="relative z-10 flex h-full min-h-[272px] flex-col justify-between p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="inline-flex items-center rounded-full bg-black/40 backdrop-blur-md px-3 py-1.5 text-[11px] font-medium text-white/95 border border-white/15 whitespace-nowrap">
              {totalDays} {totalDays === 1 ? 'day' : 'days'} · {trip.currency}
            </span>
            <PWAInstallButton variant="header" />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              data-sound-control
              onClick={onToggleSound}
              aria-pressed={soundEnabled}
              aria-label={soundEnabled ? '靜音' : '音效開啟'}
              className={`min-h-[44px] inline-flex items-center gap-1.5 rounded-full backdrop-blur-md px-3 py-2 text-xs font-semibold shadow-sm transition-colors active:scale-[0.98] whitespace-nowrap shrink-0 ${
                soundEnabled
                  ? 'bg-[#F4F2ED]/95 text-[#1A1A1A] hover:bg-white'
                  : 'bg-black/45 text-white/90 border border-white/20 hover:bg-black/60'
              }`}
            >
              {soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5 text-[#1F3FB0]" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-white/80" />
              )}
              <span>{soundEnabled ? '音效開啟' : '靜音'}</span>
            </button>

            <button
              type="button"
              onClick={onOpenShareImport}
              aria-label="Share or import itinerary"
              className="min-h-[44px] inline-flex items-center gap-1.5 rounded-full bg-[#F4F2ED]/95 backdrop-blur-md px-3.5 py-2 text-xs font-semibold text-[#1A1A1A] shadow-sm hover:bg-white transition-colors active:scale-[0.98] whitespace-nowrap shrink-0"
            >
              <Share2 className="w-3.5 h-3.5 text-[#1F3FB0]" />
              <span>Share / Import</span>
            </button>
          </div>
        </div>

        <div className="mt-6">
          <h1 className="font-calligraphy text-[30px] sm:text-[32px] font-semibold leading-[1.1] tracking-tight text-white [text-wrap:balance] drop-shadow-xs">
            {trip.title}
          </h1>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/90">
            {dateRangeLabel && (
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Calendar className="w-3.5 h-3.5 text-white/80" />
                <span>{dateRangeLabel}</span>
              </span>
            )}
            <span aria-hidden="true" className="text-white/50">·</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/18 backdrop-blur-md px-2.5 py-0.5 text-[11px] font-medium text-white border border-white/15">
              <Users className="w-3 h-3" />
              <span>{travelerLabel}</span>
            </span>
          </div>

          <div
            aria-label="Trip weather forecast summary"
            className="mt-3 rounded-2xl bg-black/38 backdrop-blur-md border border-white/15 px-3.5 py-2.5 text-white"
          >
            {weatherLoading && !weather && (
              <div className="flex items-center justify-between gap-3 animate-pulse">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-white/20" />
                  <div className="space-y-1.5">
                    <div className="h-3 w-28 rounded bg-white/25" />
                    <div className="h-2.5 w-20 rounded bg-white/15" />
                  </div>
                </div>
                <div className="h-6 w-24 rounded-lg bg-white/15" />
              </div>
            )}

            {!weatherLoading && weather && featuredDay && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FeaturedIcon className="w-5 h-5 text-white shrink-0" strokeWidth={1.8} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-semibold truncate">
                        <span>{weather.locationLabel}</span>
                        <span aria-hidden="true" className="text-white/45">·</span>
                        <span className="font-mono tabular-nums">
                          {featuredDay.maxTempC}° / {featuredDay.minTempC}°C
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-white/80 truncate">
                        <span>{featuredDay.conditionText}</span>
                        {featuredDay.precipitationPercent > 0 && (
                          <>
                            <span aria-hidden="true" className="text-white/45">·</span>
                            <span className="inline-flex items-center gap-0.5 tabular-nums">
                              <Droplets className="w-3 h-3" />
                              {featuredDay.precipitationPercent}%
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] font-medium text-white/75 whitespace-nowrap shrink-0">
                    {weather.isExactTripDates ? 'Trip dates' : 'Local outlook'}
                  </span>
                </div>

                {daysList.length > 1 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1.5 border-t border-white/10">
                    {daysList.slice(0, 5).map((dayItem) => {
                      const DayIcon = getWeatherIcon(dayItem.conditionType);
                      const isSelectedDate = selectedDayDate && dayItem.date === selectedDayDate;
                      return (
                        <div
                          key={dayItem.date}
                          className={`flex items-center gap-1.5 rounded-xl px-2 py-1 text-[11px] whitespace-nowrap shrink-0 ${
                            isSelectedDate
                              ? 'bg-[#1F3FB0] text-white font-semibold'
                              : 'bg-white/8 text-white/85'
                          }`}
                        >
                          <span className="text-white/80">{formatShortDate(dayItem.date)}</span>
                          <DayIcon className="w-3.5 h-3.5 shrink-0" />
                          <span className="font-mono tabular-nums">
                            {dayItem.maxTempC}°/{dayItem.minTempC}°
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {!weatherLoading && !weather && (
              <div className="flex items-center gap-2 text-[11px] text-white/80">
                <CloudSun className="w-4 h-4 text-white/70 shrink-0" />
                <span className="truncate">
                  {!isOnline
                    ? '離線模式 — 無法取得即時天氣預報'
                    : weatherError || '目前無法取得此地點的天氣預報'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
