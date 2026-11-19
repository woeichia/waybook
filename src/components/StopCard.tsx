import React from 'react';
import { ArrowUpRight, MapPin } from 'lucide-react';
import type { ItineraryStop } from '../types/itinerary';
import { buildStopMapsUrl } from '../utils/itinerary';
import { CategoryBadge } from './CategoryBadge';
import { SmartImage } from './SmartImage';

interface StopCardProps {
  stop: ItineraryStop;
  customPhotoUrl?: string;
  onSelect: (stop: ItineraryStop, rect: DOMRect) => void;
}

export const StopCard: React.FC<StopCardProps> = ({ stop, customPhotoUrl, onSelect }) => {
  const cardRef = React.useRef<HTMLElement>(null);
  const openPostcard = () => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (rect) onSelect(stop, rect);
  };
  const mapsUrl = buildStopMapsUrl(stop.mapQuery);

  return (
    <article data-waybook-stop-id={stop.id} ref={cardRef} className="rounded-3xl bg-[#F4F2ED] p-3.5 shadow-sm ring-1 ring-black/[0.06] transition-shadow duration-150 hover:shadow-md">
      <div className="flex items-stretch gap-3.5">
        <button
          type="button"
          onClick={openPostcard}
          aria-label={`查看 ${stop.title} 詳細資訊`}
          className="relative w-[92px] h-[112px] rounded-2xl overflow-hidden shrink-0 bg-[#E6E3DC] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F3FB0]"
        >
          <SmartImage
            src={stop.image}
            stopId={stop.id}
            customPhotoUrl={customPhotoUrl}
            alt={stop.title}
            category={stop.category}
            className="w-full h-full object-cover transition-transform duration-200 hover:scale-[1.03]"
          />
        </button>

        <div className="min-w-0 flex-1 flex flex-col justify-between py-0.5">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] font-medium text-[#5E5A52] tabular-nums whitespace-nowrap">
                {stop.time}
              </span>
              <CategoryBadge category={stop.category} />
            </div>

            <button
              type="button"
              onClick={openPostcard}
              className="mt-1.5 block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F3FB0] rounded-md"
            >
              <h3 className="text-[16px] font-semibold text-[#1A1A1A] leading-snug truncate">
                {stop.title}
              </h3>
              {stop.description && (
                <p className="mt-1 text-[13px] text-[#5E5A52] leading-relaxed line-clamp-2">
                  {stop.description}
                </p>
              )}
            </button>
          </div>

          <div className="mt-2.5 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] text-[#5E5A52] min-w-0">
              <MapPin className="w-3 h-3 shrink-0 text-[#1F3FB0]" />
              <span className="truncate">{stop.locationName}</span>
            </span>

            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[36px] inline-flex items-center gap-1 rounded-full bg-[#1F3FB0] px-3 py-1.5 text-[11px] font-medium text-white hover:bg-[#183391] transition-colors active:scale-[0.97] whitespace-nowrap shrink-0"
            >
              <span>Directions</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </article>
  );
};
