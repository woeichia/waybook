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
  const [backHint, setBackHint] = useState('');

  // Chrome on Android can ignore a history entry created without a user gesture.
  // Therefore, create navigation entries from actual user clicks (event/day/media).
  // Do not trap Back with a perpetual synthetic history entry at app start.
  useEffect(() => {
    const state = window.history.state;
    if (!state?.waybookNav) {
      window.history.replaceState({ ...(state && typeof state === 'object' ? state : {}), waybookNav: true, day: currentDayRef.current, layer: 'day' }, '', window.location.href);
    }

    const onClickCapture = (e: MouseEvent) => {
      const el = e.target instanceof Element ? e.target : null;
      const button = el?.closest<HTMLButtonElement>('button');
      if (!button || button.disabled) return;

      // User tapped a different day: add a real browser-history entry.
      const dayButton = button.closest<HTMLButtonElement>('[data-waybook-day-index]');
      if (dayButton) {
        const day = Number(dayButton.dataset.waybookDayIndex);
        if (Number.isInteger(day) && day !== currentDayRef.current) {
          window.history.pushState({waybookNav:true, day, layer:'day'}, '', window.location.href);
          setBackHint('');
        }
        return;
      }

      // Only an attraction's details button (never its Directions link).
      if (button.closest('[data-waybook-stop-id]')) {
        window.history.pushState({waybookNav:true, day:currentDayRef.current, layer:'event'}, '', window.location.href);
        return;
      }

      const label = (button.getAttribute('aria-label') || button.textContent || '').trim();
      const inEvent = Boolean(button.closest('[data-waybook-event-viewer]'));
      if (!inEvent) return;

      // Video/full-photo openers must add a history step as well.
      if (/放大照片|查看回憶照片|查看大圖|播放短片|全螢幕方式播放/.test(label)) {
        window.history.pushState({waybookNav:true, day:currentDayRef.current, layer:'media'}, '', window.location.href);
      }
    };

    const onBack = (event: PopStateEvent) => {
      const hasViewer = Boolean(document.querySelector('[data-waybook-video-viewer], [data-waybook-memory-photo-viewer], [data-waybook-ref-photo-viewer]'));
      const hasEvent = Boolean(document.querySelector('[data-waybook-event-viewer]'));
      if (hasViewer || hasEvent) {
        // Child components decide which *single* visible layer to close.
        window.dispatchEvent(new Event('waybook:back'));
        setBackHint('');
        return;
      }
      const target = event.state;
      if (target?.waybookNav && Number.isInteger(target.day) && target.day >= 0 && target.day < days.length) {
        if (target.day !== currentDayRef.current) selectDayRef.current(target.day);
        setBackHint('');
      }
      // At the root of browser history, Android is allowed to exit naturally.
    };
    document.addEventListener('click', onClickCapture, true);
    window.addEventListener('popstate', onBack);
    return () => {
      document.removeEventListener('click', onClickCapture, true);
      window.removeEventListener('popstate', onBack);
    };
  }, [days.length]);

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
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4">
        {days.map((day, idx) => {
          const isActive = idx === selectedDayIndex;
          const shortDate = formatShortDate(day.date);

          return (
            <button
              key={`${day.dayNumber}-${idx}`}
              data-waybook-day-index={idx}
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
