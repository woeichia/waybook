import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { ItineraryStop } from '../types/itinerary';
import { SmartImage } from './SmartImage';

export interface PostcardMotionState {
  stop: ItineraryStop;
  source: { x: number; y: number; width: number; height: number };
  cover?: string;
  direction: 'open' | 'close';
}

interface Props {
  motionState: PostcardMotionState;
  onComplete: () => void;
}

/** A temporary visual postcard; the underlying itinerary and detail panel stay unchanged. */
export function PostcardPageTurn({ motionState, onComplete }: Props) {
  const reduceMotion = useReducedMotion();
  const { stop, source, cover, direction } = motionState;
  const viewportWidth = typeof window === 'undefined' ? 390 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 780 : window.innerHeight;
  const targetWidth = Math.min(480, viewportWidth - 24);
  const targetHeight = Math.min(viewportHeight * 0.76, 590);
  const destination = {
    x: (viewportWidth - targetWidth) / 2,
    y: Math.max(14, (viewportHeight - targetHeight) / 2),
    width: targetWidth,
    height: targetHeight,
  };
  const first = direction === 'open' ? source : destination;
  const last = direction === 'open' ? destination : source;
  const midpoint = {
    x: (source.x + destination.x) / 2,
    y: (source.y + destination.y) / 2 - 16,
    width: (source.width + destination.width) / 2,
    height: (source.height + destination.height) / 2,
  };
  const frames = direction === 'open' ? [first, midpoint, last] : [first, midpoint, last];

  return (
    <div className="fixed inset-0 z-[70] pointer-events-none" aria-hidden="true" style={{ perspective: '1200px' }}>
      <motion.div
        initial={{ x: first.x, y: first.y, width: first.width, height: first.height, rotateY: 0, rotateZ: 0, opacity: 1 }}
        animate={reduceMotion ? {
          x: last.x, y: last.y, width: last.width, height: last.height, opacity: [1, 0.7, 0],
        } : {
          x: frames.map(f => f.x),
          y: frames.map(f => f.y),
          width: frames.map(f => f.width),
          height: frames.map(f => f.height),
          rotateY: direction === 'open' ? [0, -68, 0] : [0, 68, 0],
          rotateZ: direction === 'open' ? [0, -4.5, 0] : [0, 4.5, 0],
          scale: [1, 1.035, 1],
          borderRadius: ['24px', '12px', '24px'],
          opacity: [1, 1, 1],
        }}
        transition={reduceMotion ? { duration: 0.06 } : {
          duration: 0.68,
          times: [0, 0.43, 1],
          ease: [0.2, 0.8, 0.2, 1],
        }}
        onAnimationComplete={onComplete}
        className="absolute overflow-hidden bg-[#F4F2ED] ring-1 ring-black/10"
        style={{ transformStyle: 'preserve-3d', boxShadow: '0 26px 65px -20px rgba(28,23,16,0.38)', transformOrigin: 'center center' }}
      >
        <div className="absolute inset-0 flex flex-col overflow-hidden bg-[#F4F2ED]">
          <div className="relative flex-1 min-h-0 bg-[#E5E2DC]">
            <SmartImage src={stop.image} stopId={stop.id} customPhotoUrl={cover} alt={stop.title} category={stop.category} className="w-full h-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/20 to-transparent" />
          </div>
          <div className="shrink-0 px-4 py-3 bg-[#F4F2ED] border-t border-black/[0.05]">
            <div className="text-[11px] tracking-wider text-[#1F3FB0]">{stop.time}</div>
            <div className="mt-0.5 font-semibold text-[#1A1A1A] text-[16px] truncate">{stop.title}</div>
            <div className="mt-0.5 text-xs text-[#5E5A52] truncate">{stop.locationName}</div>
          </div>
        </div>
        <div className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-r from-black/20 to-transparent" />
      </motion.div>
    </div>
  );
}
