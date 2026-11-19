import React from 'react';
import { ArrowDown, Car, Footprints, TrainFront } from 'lucide-react';

interface TransitConnectorProps {
  transitText: string;
}

function getTransitIcon(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes('walk') || lower.includes('步行')) return Footprints;
  if (
    lower.includes('train') ||
    lower.includes('metro') ||
    lower.includes('subway') ||
    lower.includes('bus') ||
    lower.includes('tram') ||
    lower.includes('捷運') ||
    lower.includes('高鐵') ||
    lower.includes('機捷') ||
    lower.includes('火車')
  ) {
    return TrainFront;
  }
  if (
    lower.includes('drive') ||
    lower.includes('taxi') ||
    lower.includes('car') ||
    lower.includes('uber') ||
    lower.includes('包車') ||
    lower.includes('計程車') ||
    lower.includes('車程')
  ) {
    return Car;
  }
  return ArrowDown;
}

export const TransitConnector: React.FC<TransitConnectorProps> = ({ transitText }) => {
  const label = transitText.trim() || '下一站';
  const Icon = transitText.trim() ? getTransitIcon(label) : ArrowDown;

  return (
    <div className="flex flex-col items-center py-0.5" aria-label={`Transit: ${label}`}>
      <div className="w-px h-3 bg-[#C8C3B8]" />
      <div className="inline-flex items-center gap-1.5 rounded-full bg-[#F4F2ED] px-3 py-1 text-[11px] font-medium text-[#5E5A52] ring-1 ring-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <Icon className="w-3 h-3 text-[#1F3FB0]" />
        <span>{label}</span>
      </div>
      <div className="w-px h-3 bg-[#C8C3B8]" />
    </div>
  );
};
