import React from 'react';
import { List, Map } from 'lucide-react';
import { motion } from 'motion/react';

export type ItineraryViewMode = 'timeline' | 'route';

interface ViewToggleProps {
  mode: ItineraryViewMode;
  onChange: (mode: ItineraryViewMode) => void;
}

const TACTILE_EASE = [0.2, 0.8, 0.2, 1] as const;

export const ViewToggle: React.FC<ViewToggleProps> = ({ mode, onChange }) => {
  return (
    <div
      role="tablist"
      aria-label="Itinerary view mode"
      className="mt-3.5 grid grid-cols-2 gap-1 rounded-2xl bg-[#E4E1DA] p-1"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'timeline'}
        onClick={() => onChange('timeline')}
        className={`relative min-h-[40px] flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors duration-150 whitespace-nowrap ${
          mode === 'timeline'
            ? 'text-[#1F3FB0]'
            : 'text-[#5E5A52] hover:text-[#1A1A1A]'
        }`}
      >
        {mode === 'timeline' && (
          <motion.span
            layoutId="view-toggle-pill"
            transition={{ duration: 0.3, ease: TACTILE_EASE }}
            className="absolute inset-0 rounded-xl bg-[#F4F2ED] shadow-xs ring-1 ring-black/[0.04]"
          />
        )}
        <List className="relative z-10 w-3.5 h-3.5" />
        <span className="relative z-10">Timeline</span>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={mode === 'route'}
        onClick={() => onChange('route')}
        className={`relative min-h-[40px] flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors duration-150 whitespace-nowrap ${
          mode === 'route'
            ? 'text-[#1F3FB0]'
            : 'text-[#5E5A52] hover:text-[#1A1A1A]'
        }`}
      >
        {mode === 'route' && (
          <motion.span
            layoutId="view-toggle-pill"
            transition={{ duration: 0.3, ease: TACTILE_EASE }}
            className="absolute inset-0 rounded-xl bg-[#F4F2ED] shadow-xs ring-1 ring-black/[0.04]"
          />
        )}
        <Map className="relative z-10 w-3.5 h-3.5" />
        <span className="relative z-10">Day Route</span>
      </button>
    </div>
  );
};
