import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { ItineraryDay } from '../types/itinerary';
import { formatShortDate } from '../utils/itinerary';

interface DaySelectorProps {
  days: ItineraryDay[];
  selectedDayIndex: number;
  direction: number;
  onSelectDay: (index: number) => void;
}

const TACTILE_EASE = [0.2, 0.8, 0.2, 1] as const;

const titleVariants = {
  enter: (dir: number) => ({
    y: dir >= 0 ? '105%' : '-105%',
    opacity: 0,
  }),
  center: {
    y: '0%',
    opacity: 1,
  },
  exit: (dir: number) => ({
    y: dir >= 0 ? '-105%' : '105%',
    opacity: 0,
  }),
};

export const DaySelector: React.FC<DaySelectorProps> = ({
  days,
  selectedDayIndex,
  direction,
  onSelectDay,
}) => {
  const activeDay = days[selectedDayIndex];
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const currentDayRef = useRef(selectedDayIndex);
  currentDayRef.current = selectedDayIndex;
  const selectDayRef = useRef(onSelectDay);
  selectDayRef.current = onSelectDay;
  const lastRootBackRef = useRef(0);
  const [backHint, setBackHint] = useState('');

  // Android PWA Back gestures use browser history. Keep one cancellable in-app
  // entry so Back closes a viewer or returns to the preceding day first.
  // A second Back within 2 seconds at Day 1 is allowed to leave the PWA.
  useEffect(() => {
    window.history.pushState({waybookNavigationGuard:true}, '', window.location.href);
    const onBack = () => {
      const mediaOpen = Boolean(document.querySelector('[data-waybook-video-viewer], [data-waybook-memory-photo-viewer], [data-waybook-ref-photo-viewer]'));
      const eventOpen = Boolean(document.querySelector('[data-waybook-event-viewer]'));
      if(mediaOpen || eventOpen) {
        window.dispatchEvent(new Event('waybook:back'));
        window.history.pushState({waybookNavigationGuard:true}, '', window.location.href);
        return;
      }
      if(currentDayRef.current > 0) {
        selectDayRef.current(currentDayRef.current - 1);
        window.history.pushState({waybookNavigationGuard:true}, '', window.location.href);
        setBackHint('');
        return;
      }
      const now=Date.now();
      if(now - lastRootBackRef.current < 2000) {
        // A deliberate second Back exits the guard and returns to the OS.
        // Standalone PWA exit behavior is ultimately controlled by the browser.
        window.setTimeout(() => window.history.back(), 0);
        return;
      }
      lastRootBackRef.current=now;
      setBackHint('再按一次返回以離開');
      window.history.pushState({waybookNavigationGuard:true}, '', window.location.href);
    };
    window.addEventListener('popstate', onBack);
    return ()=>window.removeEventListener('popstate',onBack);
  }, []);

  useEffect(() => { if (backHint) {
    const id=window.setTimeout(()=>setBackHint(''),2100);
    return ()=>window.clearTimeout(id);
  }},[backHint]);

  useEffect(() => {
    const activeButton = tabRefs.current[selectedDayIndex];
    if (activeButton) {
      activeButton.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [selectedDayIndex]);

  return (
    <section aria-label="Trip days" className="mt-5">
      {backHint && <div role="status" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[10000] rounded-full bg-[#242424] px-4 py-2 text-white text-xs shadow-xl">{backHint}</div>}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4">
        {days.map((day, idx) => {
          const isActive = idx === selectedDayIndex;
          const shortDate = formatShortDate(day.date);

          return (
            <button
              key={`${day.dayNumber}-${idx}`}
              ref={(el) => {
                tabRefs.current[idx] = el;
              }}
              type="button"
              onClick={() => onSelectDay(idx)}
              aria-pressed={isActive}
              className={`relative min-h-[44px] inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-colors duration-200 whitespace-nowrap shrink-0 active:scale-[0.97] ${
                isActive
                  ? 'text-white'
                  : 'bg-[#F4F2ED] text-[#1A1A1A] ring-1 ring-black/[0.06] hover:bg-black/[0.04]'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="active-day-pill"
                  transition={{ duration: 0.36, ease: TACTILE_EASE }}
                  className="absolute inset-0 rounded-full bg-[#1F3FB0] shadow-sm"
                />
              )}
              <span className="relative z-10">Day {day.dayNumber}</span>
              {shortDate && (
                <span
                  className={`relative z-10 font-mono text-[11px] font-normal tabular-nums ${
                    isActive ? 'text-white/80' : 'text-[#6B6760]'
                  }`}
                >
                  {shortDate}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeDay && (
        <div className="mt-4 flex items-baseline justify-between gap-3">
          <div className="overflow-hidden flex-1 min-w-0 py-0.5">
            <AnimatePresence mode="wait" custom={direction} initial={false}>
              <motion.h2
                key={`day-title-${activeDay.dayNumber}-${activeDay.date}`}
                custom={direction}
                variants={titleVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.32, ease: TACTILE_EASE }}
                className="font-calligraphy text-[25px] font-semibold leading-snug text-[#1A1A1A] [text-wrap:balance]"
              >
                {activeDay.title}
              </motion.h2>
            </AnimatePresence>
          </div>
          <span className="text-xs font-medium text-[#6B6760] whitespace-nowrap shrink-0 tabular-nums">
            {activeDay.stops.length} {activeDay.stops.length === 1 ? '站' : '站'}
          </span>
        </div>
      )}
    </section>
  );
};
