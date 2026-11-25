import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowUpRight, MapPin, Navigation } from 'lucide-react';
import type { ItineraryDay } from '../types/itinerary';
import { buildFullDayMapsUrl, buildStopMapsUrl } from '../utils/itinerary';
import { CategoryBadge } from './CategoryBadge';

interface DayRouteViewProps {
  day: ItineraryDay;
}

export const DayRouteView: React.FC<DayRouteViewProps> = ({ day }) => {
  const fullDayMapsUrl = buildFullDayMapsUrl(day.stops);
  const reducedMotion = useReducedMotion();

  if (day.stops.length === 0) {
    return (
      <div className="rounded-3xl bg-[#F4F2ED] p-8 text-center shadow-sm ring-1 ring-black/[0.06]">
        <MapPin className="w-8 h-8 text-[#9CA3AF] mx-auto" />
        <p className="mt-3 text-sm font-medium text-[#1A1A1A]">本日尚無行程站點</p>
        <p className="mt-1 text-xs text-[#5E5A52]">點擊上方 Share / Import 可生成或匯入行程。</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-[#F4F2ED] p-5 shadow-sm ring-1 ring-black/[0.06]">
        <div className="flex items-center justify-between gap-2 pb-4 border-b border-black/[0.06]">
          <div>
            <p className="text-xs font-medium text-[#5E5A52]">Route Overview</p>
            <h3 className="text-base font-semibold text-[#1A1A1A] mt-0.5">
              Day {day.dayNumber} · {day.stops.length} 個站點
            </h3>
          </div>
          <span className="text-xs font-mono text-[#5E5A52] tabular-nums">
            {day.stops[0]?.time} – {day.stops[day.stops.length - 1]?.time}
          </span>
        </div>

        <ol className="mt-4 space-y-0">
          {day.stops.map((stop, idx) => {
            const isLast = idx === day.stops.length - 1;
            return (
              <li key={stop.id} className="relative flex gap-3.5">
                <div className="flex flex-col items-center">
                  <motion.div initial={reducedMotion?false:{opacity:0,scale:0.68}} animate={{opacity:1,scale:1}}
                    transition={{duration:0.28,delay:reducedMotion?0:idx*0.11,ease:[0.2,0.8,0.2,1]}}
                    className="w-7 h-7 rounded-full bg-[#1F3FB0] text-white text-xs font-semibold flex items-center justify-center shrink-0 tabular-nums z-10 shadow-xs">
                    {idx + 1}
                  </motion.div>
                  {!isLast && <div className="w-px flex-1 bg-[#D2CEC4] my-1.5 min-h-[28px] relative overflow-hidden">
                    <motion.div className="absolute inset-0 bg-[#1F3FB0] origin-top"
                      initial={reducedMotion?false:{scaleY:0}} animate={{scaleY:1}}
                      transition={{duration:0.35,delay:reducedMotion?0:idx*0.11+0.12,ease:'easeOut'}} />
                  </div>}
                </div>

                <motion.div initial={reducedMotion?false:{opacity:0,y:8}} animate={{opacity:1,y:0}}
                  transition={{duration:0.3,delay:reducedMotion?0:idx*0.11,ease:'easeOut'}}
                  className={`min-w-0 flex-1 ${isLast ? 'pb-1' : 'pb-5'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[11px] font-medium text-[#5E5A52] tabular-nums">
                          {stop.time}
                        </span>
                        <CategoryBadge category={stop.category} />
                      </div>
                      <h4 className="mt-1 text-[15px] font-semibold text-[#1A1A1A] leading-snug">
                        {stop.title}
                      </h4>
                      <p className="mt-0.5 text-xs text-[#5E5A52] truncate">{stop.locationName}</p>
                    </div>

                    <a
                      href={buildStopMapsUrl(stop.mapQuery)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open ${stop.title} in Google Maps`}
                      className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-full bg-[#EDEBE6] text-[#1F3FB0] ring-1 ring-black/[0.06] hover:bg-[#1F3FB0] hover:text-white transition-colors shrink-0"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                    </a>
                  </div>

                  {!isLast && (
                    <div className="mt-2.5 inline-flex items-center rounded-full bg-[#EDEBE6] px-2.5 py-1 text-[11px] font-medium text-[#5E5A52]">
                      {stop.transitToNext.trim() || '前往下一站'}
                    </div>
                  )}
                </motion.div>
              </li>
            );
          })}
        </ol>
      </div>

      <a
        href={fullDayMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full min-h-[52px] flex items-center justify-center gap-2 rounded-2xl bg-[#1F3FB0] px-5 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-[#183391] transition-colors active:scale-[0.98]"
      >
        <Navigation className="w-4 h-4" />
        <span>Open Full Day Route in Google Maps</span>
      </a>
    </div>
  );
};
